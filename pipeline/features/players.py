"""Uso de jugadores (5.3): roles, alineaciones, sustituciones y su impacto.

- Roles espaciales: NMF sobre mapas de calor de acciones (Decroos & Davis, 2019).
- Estabilidad: cambios en el XI entre partidos consecutivos; formaciones.
- Sustituciones: minuto, marcador, tipo de cambio (misma línea / más ofensivo / más defensivo).
- Impacto de cambios: variación de estilo (z) entre el stint previo y el posterior al cambio,
  neta de lo que hace la liga en la misma situación.
- Huella de estilo por jugador: β del jugador en la descomposición (qué KPI mueve)."""
from __future__ import annotations

from collections import Counter

import numpy as np
import pandas as pd
from sklearn.decomposition import NMF

from pipeline.features.style_kpis import kpis_from_counters
from pipeline.models import decomposition as dec

GRID = (12, 8)
LINE = {"Goalkeeper": 0, "Right Back": 1, "Left Back": 1, "Center Back": 1, "Right Center Back": 1, "Left Center Back": 1,
        "Right Wing Back": 2, "Left Wing Back": 2, "Right Defensive Midfield": 2, "Left Defensive Midfield": 2,
        "Center Defensive Midfield": 2, "Right Center Midfield": 3, "Left Center Midfield": 3, "Center Midfield": 3,
        "Right Midfield": 3, "Left Midfield": 3, "Right Attacking Midfield": 4, "Left Attacking Midfield": 4,
        "Center Attacking Midfield": 4, "Right Wing": 4, "Left Wing": 4, "Right Center Forward": 5,
        "Left Center Forward": 5, "Center Forward": 5, "Secondary Striker": 5}
POS_ES = {"Goalkeeper": "Portero", "Right Back": "Lateral der.", "Left Back": "Lateral izq.", "Center Back": "Central",
          "Right Center Back": "Central der.", "Left Center Back": "Central izq.", "Right Wing Back": "Carrilero der.",
          "Left Wing Back": "Carrilero izq.", "Right Defensive Midfield": "Pivote der.", "Left Defensive Midfield": "Pivote izq.",
          "Center Defensive Midfield": "Pivote", "Right Center Midfield": "Interior der.", "Left Center Midfield": "Interior izq.",
          "Center Midfield": "Mediocentro", "Right Midfield": "Volante der.", "Left Midfield": "Volante izq.",
          "Right Attacking Midfield": "Mediapunta der.", "Left Attacking Midfield": "Mediapunta izq.",
          "Center Attacking Midfield": "Mediapunta", "Right Wing": "Extremo der.", "Left Wing": "Extremo izq.",
          "Right Center Forward": "Delantero der.", "Left Center Forward": "Delantero izq.", "Center Forward": "Delantero centro",
          "Secondary Striker": "Segundo delantero"}


def heatmaps(actions: pd.DataFrame, min_actions: int = 300):
    a = actions[actions.type.isin(["Pass", "Carry", "Shot", "Dribble", "Pressure", "Ball Recovery", "Interception", "Duel"])]
    gx = np.clip((a.x / 120 * GRID[0]).astype(int), 0, GRID[0] - 1)
    gy = np.clip((a.y / 80 * GRID[1]).astype(int), 0, GRID[1] - 1)
    cell = gx * GRID[1] + gy
    H = pd.crosstab(a.player_id, cell).reindex(columns=range(GRID[0] * GRID[1]), fill_value=0)
    H = H[H.sum(1) >= min_actions]
    return H.div(H.sum(1), axis=0)


def fit_roles(actions: pd.DataFrame, k: int = 10, seed: int = 0):
    H = heatmaps(actions)
    nmf = NMF(k, init="nndsvda", random_state=seed, max_iter=600).fit(H.values)
    W = pd.DataFrame(nmf.transform(H.values), index=H.index)
    comps = nmf.components_
    names = {}
    for j, c in enumerate(comps):
        g = c.reshape(GRID)
        cx, cy = np.unravel_index(g.argmax(), GRID)
        # centroide ponderado
        xs = (np.arange(GRID[0]) + 0.5) * 120 / GRID[0]
        ys = (np.arange(GRID[1]) + 0.5) * 80 / GRID[1]
        mx = float((g.sum(1) * xs).sum() / g.sum())
        my = float((g.sum(0) * ys).sum() / g.sum())
        zona = "defensiva" if mx < 45 else ("media" if mx < 75 else "ofensiva")
        carril = "izquierdo" if my < 26 else ("derecho" if my > 54 else "central")
        names[j] = {"nombre": f"Zona {zona} – carril {carril}", "cx": mx, "cy": my, "mapa": (g / g.max()).round(3).tolist()}
    # desambiguar nombres repetidos
    seen = Counter()
    for j in names:
        seen[names[j]["nombre"]] += 1
        if seen[names[j]["nombre"]] > 1:
            names[j]["nombre"] += f" ({seen[names[j]['nombre']]})"
    return W, names


def coach_players(coach_id, matches, stints, subs, lineups, players, seg, F: dec.Fit, roles_W, role_names, team_ids):
    """Resumen de uso de jugadores para un DT."""
    my_matches = matches[((matches.home_coach_id == coach_id) | (matches.away_coach_id == coach_id))].copy()
    my_matches["team_id"] = np.where(my_matches.home_coach_id == coach_id, my_matches.home_id, my_matches.away_id)
    mm = my_matches[["match_id", "team_id", "date"]].sort_values("date")
    st = stints.merge(mm[["match_id", "team_id"]], on=["match_id", "team_id"])
    ex = st[["match_id", "dur", "players"]].explode("players").dropna()
    mins = ex.groupby("players").dur.sum() / 60
    lu = lineups.merge(mm[["match_id", "team_id"]], on=["match_id", "team_id"])
    xi = lu[lu.ts == 0].query("period == 1")
    starts = xi.groupby("player_id").match_id.nunique()
    pos = lu.groupby("player_id").position.agg(lambda s: s.value_counts().index[0])
    name = players.set_index("player_id").player
    # huella de estilo del jugador (β)
    beta = F.coef.loc[[c for c in F.coef.index if c[0] == "player" and c[1] != -1]]
    beta.index = [c[1] for c in beta.index]
    tbl = []
    for p, m in mins.sort_values(ascending=False).items():
        if m < 90:
            continue
        p = int(p)
        b = beta.loc[p] if p in beta.index else None
        top = []
        if b is not None:
            bb = b.drop([c for c in b.index if c.startswith("arq_")], errors="ignore")
            for k in bb.abs().sort_values(ascending=False).index[:3]:
                top.append({"kpi": k, "efecto": float(bb[k])})
        role = None
        if p in roles_W.index:
            j = int(roles_W.loc[p].values.argmax())
            role = role_names[j]["nombre"]
        tbl.append({"player_id": p, "nombre": name.get(p, str(p)), "minutos": float(m),
                    "titularidades": int(starts.get(p, 0)), "posicion": POS_ES.get(pos.get(p), pos.get(p)),
                    "linea": LINE.get(pos.get(p), 3), "rol_espacial": role, "huella": top})
    # estabilidad del XI y formaciones
    xis = xi.groupby("match_id").player_id.apply(set).reindex(mm.match_id).dropna()
    changes = [len(a - b) for a, b in zip(xis.values[1:], xis.values[:-1])]
    forms = lu[(lu.period == 1) & (lu.ts == 0)].drop_duplicates("match_id").formation.value_counts()
    shifts = lu.drop_duplicates(["match_id", "period", "ts"]).groupby("match_id").size() - 1
    # sustituciones
    sb = subs.merge(mm[["match_id", "team_id"]], on=["match_id", "team_id"])
    sb = sb[sb.minute > 0]
    sb["on_pos"] = sb.on_id.map(pos)
    sb["delta_linea"] = sb.on_pos.map(LINE) - sb.off_pos.map(LINE)
    sb["tipo"] = np.select([sb.delta_linea > 0, sb.delta_linea < 0], ["Más ofensivo", "Más defensivo"], "Misma línea")
    sb["estado"] = np.select([sb.goal_diff < 0, sb.goal_diff > 0], ["Perdiendo", "Ganando"], "Empatando")
    order = sb.sort_values("t").groupby("match_id").cumcount() + 1
    sb["n_cambio"] = order
    sub_timing = sb.groupby("n_cambio").minute.median().head(5).to_dict()
    sub_mix = sb.groupby(["estado", "tipo"]).size().unstack(fill_value=0)
    lg = subs[subs.minute > 0]
    lg_timing = lg.sort_values("t").assign(n=lambda d: d.groupby(["match_id", "team_id"]).cumcount() + 1).groupby("n").minute.median().head(5).to_dict()
    return {
        "jugadores": tbl,
        "estabilidad_xi": float(np.mean(changes)) if changes else None,
        "formaciones": {str(k): int(v) for k, v in forms.items()},
        "cambios_tacticos_por_partido": float(shifts.mean()) if len(shifts) else 0.0,
        "minuto_cambios": {int(k): float(v) for k, v in sub_timing.items()},
        "minuto_cambios_liga": {int(k): float(v) for k, v in lg_timing.items()},
        "cambios_por_estado": {e: {t: int(sub_mix.loc[e, t]) if e in sub_mix.index and t in sub_mix.columns else 0
                                   for t in ["Más ofensivo", "Misma línea", "Más defensivo"]} for e in ["Perdiendo", "Empatando", "Ganando"]},
        "mas_usados_por_linea": _by_line(tbl),
    }


def _by_line(tbl):
    out = {}
    for r in tbl:
        out.setdefault(r["linea"], []).append(r)
    return {int(k): sorted(v, key=lambda r: -r["minutos"])[:6] for k, v in out.items()}


def substitution_impact(stints: pd.DataFrame, subs: pd.DataFrame, coach_id: int, stats: dict, kpis) -> list[dict]:
    """Cambio medio de estilo (z) del stint anterior al posterior a cada sustitución del DT,
    menos el cambio medio de la liga en las sustituciones (efecto 'normal' del cambio)."""
    s = stints.sort_values(["match_id", "stint"])
    K = kpis_from_counters(s)
    Z = pd.DataFrame({k: (K[k].clip(stats[k]["lo"], stats[k]["hi"]) - stats[k]["mean"]) / stats[k]["sd"] for k in kpis}, index=s.index)
    s = pd.concat([s[["match_id", "stint", "team_id", "coach_id", "t0", "dur"]], Z], axis=1)
    key = s.set_index(["match_id", "team_id", "stint"])
    sb = subs[subs.minute > 0].drop_duplicates(["match_id", "team_id", "t"])
    rows = []
    t0 = s.groupby(["match_id", "team_id"]).t0.apply(np.array)
    for r in sb.itertuples():
        arr = t0.get((r.match_id, r.team_id))
        if arr is None:
            continue
        j = int(np.searchsorted(arr, r.t + 1e-6, side="right") - 1)
        if j <= 0:
            continue
        pre, post = key.loc[(r.match_id, r.team_id, j - 1)], key.loc[(r.match_id, r.team_id, j)]
        if pre.dur < 180 or post.dur < 180:
            continue
        rows.append({"coach": pre.coach_id, **{k: post[k] - pre[k] for k in kpis}})
    d = pd.DataFrame(rows)
    if d.empty or (d.coach == coach_id).sum() < 5:
        return []
    d[kpis] = d[kpis].clip(-6, 6)  # stints cortos: acotar cambios extremos
    m = d[d.coach == coach_id][kpis]
    mine, league = m.mean(), d[kpis].mean()
    se = m.std() / np.sqrt(m.notna().sum().clip(lower=1))
    n = int((d.coach == coach_id).sum())
    return [{"kpi": k, "dt": float(mine[k]), "liga": float(league[k]), "neto": float(mine[k] - league[k]), "se": float(se[k]), "n": n} for k in kpis]
