"""Datos para "¿Y si…?": combinar el estilo propio de un DT (α) con el club (φ) y una
plantilla (β de 11 jugadores) de otro lugar. El modelo es aditivo (decomposition.py), así que
la predicción de un estilo nunca visto es una suma de efectos estimados por separado.

  python -m pipeline.whatif      ->  web/public/data/whatif.json

Además valida esa suma en combinaciones REALES (mandatos DT-club), dentro de muestra y
dejando fuera el mandato completo (DTs que cambiaron de club)."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.features.players import POS_ES
from pipeline.features.style_kpis import BASE_KPIS, KPIS
from pipeline.models import decomposition as dec

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
ART = ROOT / "artifacts"
OUT = ROOT / "web" / "public" / "data" / "whatif.json"
CTX = ["home", "losing", "winning", "manadv", "tmid", "tmid2"]
RECENT = ["2025/26", "2026/27"]
MIN_SPELL = 10          # partidos para validar un mandato
MIN_SEASON_MATCHES = 8  # 2026/27 apenas empieza (8-9 partidos por club): con >= 8 se usa como plantilla actual
N_LOSO = 40             # mandatos de DTs con movilidad a validar dejando fuera


def r3(v):
    return [round(float(x), 3) for x in v]


def formation_str(f) -> str | None:
    if f is None or f != f:
        return None
    return "-".join(str(int(f)))


def spell_exposure(rows: pd.DataFrame) -> dict:
    """Exposición media de cada jugador en un conjunto de filas (fracción del tiempo en cancha,
    ponderada por duración): suma ≈ 11 como en los segmentos."""
    tot = rows.dur.sum()
    acc: dict = {}
    for e, d in zip(rows.exposure, rows.dur):
        for p, x in (e or {}).items():
            acc[p] = acc.get(p, 0.0) + x * d
    return {p: v / tot for p, v in acc.items()}


def beta_sum(exp: dict, coef: pd.DataFrame, kpis: list) -> np.ndarray:
    out = np.zeros(len(kpis))
    otros = coef.loc[("player", -1), kpis].values if ("player", -1) in coef.index else 0
    for p, x in exp.items():
        k = ("player", p)
        out += x * (coef.loc[k, kpis].values if k in coef.index else otros)
    return out


def neutral_ctx(seg: pd.DataFrame, F: dec.Fit) -> dict:
    D = F.design
    w = seg.dur.values / seg.dur.sum()
    return {c: float(np.asarray(D.X[:, D.index[("ctx", c)]].todense()).ravel() @ w) for c in CTX}


def base_vec(coef: pd.DataFrame, neutral: dict, kpis: list) -> np.ndarray:
    b = coef.loc[("ctx", "intercept"), kpis].values.copy()
    for c, v in neutral.items():
        b += coef.loc[("ctx", c), kpis].values * v
    return b


def spell_obs(seg_rows: pd.DataFrame, Z: pd.DataFrame, W: pd.DataFrame, kpis: list) -> np.ndarray:
    idx = seg_rows.index
    w = W.loc[idx, kpis]
    z = Z.loc[idx, kpis].fillna(0)
    return ((z * w).sum() / w.sum().replace(0, np.nan)).values


def metrics(pred: np.ndarray, obs: np.ndarray, kpis: list, alt: dict | None = None) -> dict:
    """pred/obs: (mandatos × KPIs) en z. Correlación por KPI entre mandatos + RMSE vs media de liga."""
    corr = {}
    for j, k in enumerate(kpis):
        ok = np.isfinite(obs[:, j])
        corr[k] = round(float(np.corrcoef(pred[ok, j], obs[ok, j])[0, 1]), 3)
    ok = np.isfinite(obs)
    rmse = float(np.sqrt(np.mean((pred[ok] - obs[ok]) ** 2)))
    rmse0 = float(np.sqrt(np.mean(obs[ok] ** 2)))
    out = {"n_mandatos": int(pred.shape[0]), "correlacion_media": round(float(np.mean(list(corr.values()))), 3),
           "correlacion_por_kpi": corr, "rmse": round(rmse, 3), "rmse_media_liga": round(rmse0, 3),
           "mejora_vs_liga": round(1 - rmse / rmse0, 3)}
    for name, p in (alt or {}).items():
        cc = [np.corrcoef(p[np.isfinite(obs[:, j]), j], obs[np.isfinite(obs[:, j]), j])[0, 1] for j in range(len(kpis))]
        out[name] = {"correlacion_media": round(float(np.mean(cc)), 3),
                     "rmse": round(float(np.sqrt(np.mean((p[ok] - obs[ok]) ** 2))), 3)}
    return out


def main():
    kpis = list(BASE_KPIS)
    M = pd.read_parquet(PROC / "matches.parquet")
    S = pd.read_parquet(PROC / "stints.parquet")
    PL = pd.read_parquet(PROC / "players.parquet")
    LU = pd.read_parquet(PROC / "lineups.parquet")
    glob = json.load(open(ART / "global.json"))

    print("segmentos y ajuste (KPIs base)", flush=True)
    seg = dec.build_segments(S, M)
    D = dec.build_design(seg)
    F = dec.fit(seg, design=D, kpis=kpis)
    coef = F.coef
    Z, W, _ = dec.targets(seg, F.stats)
    neutral = neutral_ctx(seg, F)
    base = base_vec(coef, neutral, kpis)

    club_names = pd.concat([M[["home_id", "home"]].set_axis(["id", "n"], axis=1),
                            M[["away_id", "away"]].set_axis(["id", "n"], axis=1)]).drop_duplicates("id").set_index("id").n
    coach_names = pd.concat([M[["home_coach_id", "home_coach"]].set_axis(["id", "n"], axis=1),
                             M[["away_coach_id", "away_coach"]].set_axis(["id", "n"], axis=1)]).dropna().drop_duplicates("id").set_index("id").n

    # ---------------------------------------------------------------- jugadores
    tm = pd.concat([M[["match_id", "date", "season", "home_id", "home_coach_id"]].set_axis(["match_id", "date", "season", "team_id", "coach_id"], axis=1),
                    M[["match_id", "date", "season", "away_id", "away_coach_id"]].set_axis(["match_id", "date", "season", "team_id", "coach_id"], axis=1)])
    ex = S[["match_id", "team_id", "dur", "players"]].explode("players").dropna(subset=["players"])
    ex["player_id"] = ex.players.astype(int)
    pm = ex.groupby(["match_id", "team_id", "player_id"]).dur.sum().reset_index()
    pm = pm.merge(tm[["match_id", "team_id", "date", "season"]], on=["match_id", "team_id"])
    pm["min"] = pm.dur / 60
    last_club = pm.sort_values("date").groupby("player_id").team_id.last().map(club_names)
    min_recent = pm[pm.season.isin(RECENT)].groupby("player_id")["min"].sum()
    lu = LU.dropna(subset=["position"]).drop_duplicates(["match_id", "player_id", "position"])
    pos = lu.groupby("player_id").position.agg(lambda s: s.value_counts().index[0]).map(lambda p: POS_ES.get(p, p))
    names = PL.drop_duplicates("player_id").set_index("player_id").player

    own = [c[1] for c in coef.index if c[0] == "player" and c[1] != -1]

    def pinfo(p):
        p = int(p)
        k = ("player", p)
        return {"n": names.get(p, str(p)), "pos": pos.get(p), "club": last_club.get(p),
                "min": int(round(float(min_recent.get(p, 0)))),
                "b": r3(coef.loc[k, kpis].values) if k in coef.index else None}

    players = {int(p): pinfo(p) for p in own}

    # ---------------------------------------------------------------- plantillas actuales
    squads = {}
    for cid, cname in club_names.items():
        t = tm[tm.team_id == cid]
        seasons = t.season.value_counts()
        last = sorted(seasons.index)[-1]
        season = last if seasons[last] >= MIN_SEASON_MATCHES or len(seasons) == 1 else sorted(seasons.index)[-2]
        mids = t[t.season == season].match_id
        q = pm[(pm.team_id == cid) & pm.match_id.isin(mids)].groupby("player_id")["min"].sum().sort_values(ascending=False)
        total = len(mids) * 90.0
        top = q.head(20)
        gk = [p for p in q.index if pos.get(p) == "Portero"]
        xi = ([gk[0]] if gk else []) + [p for p in q.index if pos.get(p) != "Portero"][:11 - (1 if gk else 0)]
        for p in top.index.union(pd.Index(xi)):
            if int(p) not in players:
                players[int(p)] = pinfo(p)
        cur = t.sort_values("date").iloc[-1]
        f = LU[(LU.team_id == cid) & LU.match_id.isin(mids) & (LU.period == 1) & (LU.ts == 0)].drop_duplicates("match_id").formation
        squads[cname] = {"temporada": season, "partidos": int(len(mids)),
                         "dt": int(cur.coach_id), "dt_nombre": coach_names.get(cur.coach_id),
                         "formacion": formation_str(f.value_counts().index[0]) if len(f) else None,
                         "jugadores": [[int(p), round(float(m / total), 3)] for p, m in top.items()],
                         "xi": [int(p) for p in xi]}

    # ---------------------------------------------------------------- DTs y clubes
    dts = {d["id"] for d in glob["dts"]} | {s["dt"] for s in squads.values()}
    coaches = {int(c): r3(coef.loc[("coach", c), kpis].values) for c in sorted(dts) if ("coach", c) in coef.index}
    clubs = {club_names[c]: {"id": int(c), "phi": r3(coef.loc[("club", c), kpis].values)}
             for c in club_names.index if ("club", c) in coef.index}

    # ---------------------------------------------------------------- mandatos reales
    seg["_i"] = np.arange(len(seg))
    spells = seg.groupby(["coach_id", "club_id"]).match_id.nunique()
    spells = spells[spells >= MIN_SPELL]
    P_full, P_nocoach, P_noplayer, O, keys = [], [], [], [], []
    ultima = {}
    for (c, cl), n in spells.items():
        rows = seg[(seg.coach_id == c) & (seg.club_id == cl)]
        bs = beta_sum(spell_exposure(rows), coef, kpis)
        a = coef.loc[("coach", c), kpis].values
        phi = coef.loc[("club", cl), kpis].values
        P_full.append(base + a + phi + bs)
        P_nocoach.append(base + phi + bs)
        P_noplayer.append(base + a + phi + 11 * coef.loc[("player", -1), kpis].values)
        O.append(spell_obs(rows, Z, W, kpis))
        keys.append((c, cl, n, rows.date.max()))
    for (c, cl, n, dmax), bsum in zip(keys, [p - base - coef.loc[("coach", k[0]), kpis].values - coef.loc[("club", k[1]), kpis].values
                                              for p, k in zip(P_full, keys)]):
        if int(c) in coaches and (int(c) not in ultima or dmax > ultima[int(c)]["_d"]):
            ultima[int(c)] = {"club": club_names[cl], "partidos": int(n), "plantilla": r3(bsum), "_d": dmax}
    for v in ultima.values():
        v.pop("_d")
    P_full, O = np.array(P_full), np.array(O)
    val_in = metrics(P_full, O, kpis, {"sin_dt": np.array(P_nocoach), "sin_plantilla": np.array(P_noplayer)})

    # ---------------------------------------------------------------- dejando fuera el mandato (movers)
    ncl = spells.reset_index().groupby("coach_id").club_id.nunique()
    movers = spells.reset_index()
    movers = movers[movers.coach_id.isin(ncl[ncl >= 2].index)].sort_values("match_id", ascending=False).head(N_LOSO)
    print(f"validación dejando fuera: {len(movers)} mandatos", flush=True)
    LP, LN, LO, lrows = [], [], [], []
    for r in movers.itertuples():
        test = (seg.coach_id == r.coach_id) & (seg.club_id == r.club_id)
        tr = seg[~test].reset_index(drop=True)
        Ft = dec.fit(tr, kpis=kpis)
        ct = Ft.coef
        if ("coach", r.coach_id) not in ct.index or ("club", r.club_id) not in ct.index:
            continue
        bt = base_vec(ct, neutral_ctx(tr, Ft), kpis)
        te = seg[test]
        bs = beta_sum(spell_exposure(te), ct, kpis)
        a = ct.loc[("coach", r.coach_id), kpis].values
        phi = ct.loc[("club", r.club_id), kpis].values
        o = spell_obs(te, Z, W, kpis)  # observado en la escala del ajuste completo (misma que F.stats)
        LP.append(bt + a + phi + bs); LN.append(bt + phi + bs); LO.append(o)
        lrows.append({"dt": coach_names.get(r.coach_id), "club": club_names[r.club_id], "partidos": int(r.match_id),
                      "correlacion_perfil": round(float(np.corrcoef(LP[-1][np.isfinite(o)], o[np.isfinite(o)])[0, 1]), 3),
                      "correlacion_perfil_sin_dt": round(float(np.corrcoef(LN[-1][np.isfinite(o)], o[np.isfinite(o)])[0, 1]), 3)})
    val_out = metrics(np.array(LP), np.array(LO), kpis, {"sin_dt": np.array(LN)})
    val_out["mandatos"] = lrows

    out = {
        "formula": ("z_k = base_k + α_DT,k + φ_club,k + Σ_{j en el XI} β_j,k  (cada titular con exposición 1; "
                    "un jugador sin coeficiente propio usa 'otros'). base_k = intercepto_k + Σ contexto_k·neutral "
                    "(local/visitante al 50 %, marcador y minuto promedio de la liga, sin expulsiones). "
                    "Valor en unidades del KPI = media_k + z_k·sd_k; z en desviaciones típicas entre equipos-temporada."),
        "formula_puntos": ("Especulativo. λ_favor = valor previsto de xg_90, λ_contra = valor previsto de xg_contra_90; "
                           "goles de cada equipo ~ Poisson independientes; P(victoria/empate/derrota) y xPts = 3·P(V)+P(E) por partido; "
                           "proyección de temporada = xPts × 34."),
        "kpis": [{"k": k, "etiqueta": KPIS[k][3], "familia": KPIS[k][4], "mean": round(F.stats[k]["mean"], 4),
                  "sd": round(F.stats[k]["sd"], 4)} for k in kpis],
        "base": r3(base),
        "ctx": {c: r3(coef.loc[("ctx", c), kpis].values) for c in CTX + ["intercept"]},
        "neutral": {c: round(v, 3) for c, v in neutral.items()},
        "coaches": coaches,
        "coach_nombres": {int(c): coach_names.get(c) for c in coaches},
        "clubs": clubs,
        "otros": r3(coef.loc[("player", -1), kpis].values),
        "players": players,
        "squads": squads,
        "ultima_etapa": ultima,
        "validacion": {"dentro_muestra": val_in, "fuera_muestra": val_out,
                       "nota": ("Dentro de muestra: cada mandato DT-club (≥10 partidos) se usó para ajustar el modelo. "
                                "Fuera de muestra: se reajusta sin ese mandato y se predice con α del DT aprendido en otros clubes, "
                                "φ del club aprendido con otros DTs y β de los jugadores; mandatos de DTs con ≥2 clubes.")},
    }
    add_roles(out)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"whatif.json: {OUT.stat().st_size / 1024:.0f} KB, {len(players)} jugadores, {len(coaches)} DTs, {len(clubs)} clubes")
    print(f"validación dentro de muestra: r={val_in['correlacion_media']} rmse={val_in['rmse']} (liga {val_in['rmse_media_liga']}) "
          f"sin DT r={val_in['sin_dt']['correlacion_media']}  sin plantilla r={val_in['sin_plantilla']['correlacion_media']}")
    print(f"validación fuera de muestra ({val_out['n_mandatos']}): r={val_out['correlacion_media']} rmse={val_out['rmse']} "
          f"(liga {val_out['rmse_media_liga']}) sin DT r={val_out['sin_dt']['correlacion_media']} rmse={val_out['sin_dt']['rmse']}")


def add_roles(out: dict) -> None:
    """XI coherente y rol de cada jugador en SU club (no su posición más frecuente en toda la carrera).
    Formación modal de la temporada de la plantilla; cada puesto de esa formación se asigna al jugador
    que más veces fue titular ahí (asignación ávida por frecuencia). Sólo usa alineaciones: no toca el ajuste."""
    M = pd.read_parquet(PROC / "matches.parquet")
    LU = pd.read_parquet(PROC / "lineups.parquet")
    known = {int(p) for p in out["players"]}
    for cname, sq in out["squads"].items():
        cid = out["clubs"].get(cname, {}).get("id")
        if cid is None:
            continue
        mids = M[(M.season == sq["temporada"]) & ((M.home_id == cid) | (M.away_id == cid))].match_id
        lu = LU[(LU.team_id == cid) & LU.match_id.isin(mids)].dropna(subset=["position"])
        # rol en el club: posición más frecuente con este club en la temporada
        role = lu.drop_duplicates(["match_id", "player_id", "position"]).groupby("player_id").position \
                 .agg(lambda x: x.value_counts().index[0]).map(lambda q: POS_ES.get(q, q))
        sq["pos"] = {int(p): role[p] for p in role.index if int(p) in known}
        st = lu[(lu.period == 1) & (lu.ts == 0)]
        if st.empty:
            continue
        form = st.drop_duplicates("match_id").formation.value_counts().index[0]
        st = st[st.formation == form]
        slots = st.groupby("match_id").position.apply(list).iloc[0]
        cnt = st.groupby(["player_id", "position"]).size().sort_values(ascending=False)
        free, used, xi, spos = list(slots), set(), [], {}
        for (pid, ps), _ in cnt.items():
            if ps in free and pid not in used and int(pid) in known:
                free.remove(ps); used.add(pid); xi.append(int(pid)); spos[int(pid)] = POS_ES.get(ps, ps)
        for ps in free:  # puesto sin titular conocido: el de más minutos que falte
            rest = [p for p, _ in sq["jugadores"] if p not in xi]
            if rest:
                xi.append(rest[0]); spos[rest[0]] = POS_ES.get(ps, ps)
        sq["xi"], sq["formacion"] = xi, formation_str(form)
        sq["pos"].update(spos)  # en el XI, el puesto que ocupa en la formación


if __name__ == "__main__":
    import sys
    if "--roles" in sys.argv:  # sólo recalcula XI y roles sobre el whatif.json existente (sin reajustar)
        out = json.load(open(OUT))
        add_roles(out)
        json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
        print("roles y XI actualizados")
    else:
        main()
