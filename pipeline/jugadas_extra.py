"""Datos de «Jugadas tipo» y «Formaciones» para la pestaña Cómo juega, uno por DT y por club que dirigió:

  ataque      jugadas efectivas por categoría (pipeline/jugadas.py): jugadas, xG y OBV por partido contra la liga,
              percentil entre DTs y ejemplos animables (siempre del club elegido)
  defensa     bloque defensivo según la situación del rival, con 360 (pipeline/def360.py), contra la liga y
              contra los 4 estilos de rival del mapa
  formaciones los 11 con más minutos en ese club: alineación, posición media CON balón y SIN balón

No ajusta ningún modelo: sólo lee data/processed y data/model_cache.

  .venv/bin/python -m pipeline.jugadas_extra   ->  data/model_cache/jugadas/jugadas_<id>.json + web/public/data/jugadas_liga.json
  (después, pipeline.juego_extra incrusta cada uno como «jg» en web/public/data/juego_<id>.json)
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline import def360 as d360
from pipeline import jugadas as jg

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
ART = ROOT / "artifacts"
OUT = ROOT / "web" / "public" / "data"
PRIV = ROOT / "data" / "model_cache" / "jugadas"   # por DT: juego_extra lo incrusta en juego_<id>.json (el artefacto publicado admite pocos archivos)
MIN_SPELL = 5          # partidos mínimos de un DT en un club para entrar a la comparación con la liga
MIN_FRAMES = 150       # cuadros 360 mínimos por métrica y situación para compararla con la liga
# qué métricas son confiables en cada situación (en «atrás» la línea defensiva queda fuera de cámara)
VALID = {"atras": ["front", "near"], "medio": ["front", "back", "cent", "near"], "bajo": ["front", "back", "wid", "near"], "contra": ["front", "back", "near"]}
W6 = {"front", "near", "bx", "by"}        # métricas con >= 6 jugadores visibles; «wid» con >= 9 y cámara viendo todo el ancho; el resto, con >= 9
KX, KY = d360.KX, d360.KY                 # unidades StatsBomb (120 × 80) -> metros reales (105 × 68)

RES = ["Goal", "Saved", "Saved to Post", "Saved Off Target", "Post", "Off T", "Wayward", "Blocked"]

SITS = [
    ("atras", "Rival sale desde su portería", "Opponent builds from its own box",
     "El rival tiene el balón en su tercio (saque de meta, salida corta). Mide qué tan arriba sube la presión: la altura de su línea más adelantada.",
     "The opponent has the ball in its own third (goal kicks, short build-up). It measures how high the press goes: the height of the most advanced line."),
    ("medio", "Rival en el medio campo", "Opponent in midfield",
     "El rival maneja el balón entre su tercio y el nuestro. Es el bloque medio: dónde se para el equipo mientras el rival decide.",
     "The opponent has the ball between its third and ours. This is the mid-block: where the team stands while the opponent decides."),
    ("bajo", "Rival ataca en nuestro tercio", "Opponent attacks in our third",
     "El rival tiene el balón en nuestro último tercio. Es el bloque bajo: qué tan cerca de su portería se pone la línea defensiva y cuánta gente rodea el balón.",
     "The opponent has the ball in our final third. This is the low block: how close to its own goal the defensive line sits and how many players surround the ball."),
    ("contra", "Rival contragolpea", "Opponent counter-attacks",
     "El rival sale en contragolpe (StatsBomb «From Counter»), en cualquier zona: cómo está parado el equipo cuando pierde el balón y lo atacan rápido.",
     "The opponent breaks on the counter (StatsBomb \"From Counter\"), in any zone: how the team is set when it loses the ball and gets hit fast."),
]

# posición de alineación (StatsBomb) -> (x, y) en la cancha de 120 × 80; ataca hacia x = 120, la derecha del equipo es y alto
POS = {
    "Goalkeeper": (6, 40),
    "Right Back": (34, 70), "Left Back": (34, 10),
    "Right Center Back": (26, 53), "Center Back": (26, 40), "Left Center Back": (26, 27),
    "Right Wing Back": (52, 73), "Left Wing Back": (52, 7),
    "Right Defensive Midfield": (47, 52), "Center Defensive Midfield": (47, 40), "Left Defensive Midfield": (47, 28),
    "Right Center Midfield": (62, 54), "Center Midfield": (62, 40), "Left Center Midfield": (62, 26),
    "Right Midfield": (68, 72), "Left Midfield": (68, 8),
    "Right Attacking Midfield": (80, 56), "Center Attacking Midfield": (80, 40), "Left Attacking Midfield": (80, 24),
    "Right Wing": (90, 70), "Left Wing": (90, 10),
    "Right Center Forward": (100, 50), "Center Forward": (102, 40), "Left Center Forward": (100, 30),
    "Secondary Striker": (94, 40),
}
DEF_ACTIONS = ["Pressure", "Duel", "Interception", "Block", "Clearance"]
ON_BALL = ["Pass", "Carry", "Shot", "Dribble"]


def r1(v, d=1):
    if v is None or v != v:
        return None
    v = round(float(v), d)
    return int(v) if v == int(v) and d == 1 else v


# ---------------------------------------------------------------- ejemplos animables (mismo formato que PlayAnim)
def _example(A_by, SH, nxt, hit, row, J, midx, minute):
    g = A_by[hit].head(40)
    last = g.iloc[-1]
    if bool(row.goal):
        fin = "gol"
    elif last.type == "Shot":
        fin = "tiro"
    elif (last.type == "Pass" and isinstance(last.outcome, str)) or (hit in nxt.index and nxt.loc[hit] == nxt.loc[hit] and nxt.loc[hit] != hit[1]):
        fin = "perdida"
    else:
        fin = "fin"
    res = None
    if last.type == "Shot":
        s_ = SH[(SH.match_id == hit[0]) & (SH.poss == hit[2]) & (SH.team_id == hit[1])]
        if len(s_):
            res = RES.index(s_.outcome.iloc[-1]) if s_.outcome.iloc[-1] in RES else -1
    seq = [[a.type, r1(a.x), r1(a.y), r1(a.end_x) if a.end_x == a.end_x else None, r1(a.end_y) if a.end_y == a.end_y else None] for a in g.itertuples()]
    acc = [[J(a.player_id), J(a.recipient_id) if a.type == "Pass" and not isinstance(a.outcome, str) else None,
            0 if (a.type == "Pass" and isinstance(a.outcome, str)) else 1] for a in g.itertuples()]
    return {"seq": seq, "m": midx[int(hit[0])], "min": minute, "fin": fin, "res": res,
            "xg": round(float(row.xg), 3), "obv": round(float(row.obv), 3), "acc": acc}


# ---------------------------------------------------------------- formaciones
def formaciones(core, mym_keys, A, LU, mins, names, J, OWN=None):
    """core: ids de los 11 con más minutos. Devuelve nominal / con balón / sin balón por jugador."""
    k = A.merge(mym_keys, on=["match_id", "team_id"])
    lu = LU.merge(mym_keys, on=["match_id", "team_id"])
    # alineación típica: de los partidos con la formación más usada, el que más se parece a los 11 con más minutos;
    # cada jugador queda en el puesto que ocupó ahí (los que no jugaron ese partido, en su puesto más frecuente)
    first = lu[lu.period == 1]
    first = first[first.ts == first.groupby(["match_id", "team_id"]).ts.transform("min")]
    forms = first.groupby("match_id").formation.first()
    form = forms.value_counts().index[0] if len(forms) else None
    best, bs = None, -1.0
    for mid, g in first.groupby("match_id"):
        sc = float(g.player_id.isin(core).sum()) + (0.5 if forms[mid] == form else 0.0)
        if sc > bs:
            best, bs = g, sc
    typical = dict(zip(best.player_id, best.position)) if best is not None else {}
    if best is not None and len(best) == 11 and best.player_id.nunique() == 11:
        core = [int(p) for p in best.player_id]   # un once real (el partido que más se parece a los 11 con más minutos): evita dos laterales derechos o sin delantero
    on = k[k.type.isin(ON_BALL) & k.player_id.isin(core)]
    off = k[k.type.isin(DEF_ACTIONS) & k.player_id.isin(core)]
    out = []
    used: dict = {}
    for pid in core:
        pos_rows = lu[lu.player_id == pid].position
        pos = typical.get(pid) or (pos_rows.value_counts().index[0] if len(pos_rows) else None)
        nominal = list(POS.get(pos, (None, None)))
        o, f = on[on.player_id == pid], off[off.player_id == pid]
        con = [r1(o.x.mean()), r1(o.y.mean()), int(len(o))] if len(o) else None
        sin = [r1(f.x.mean()), r1(f.y.mean()), int(len(f))] if len(f) else None
        if nominal[0] is None and con:
            nominal = [con[0], con[1]]
        while nominal[0] is not None and (nominal[0], nominal[1]) in used:  # dos con el mismo puesto: el segundo se corre hacia el centro y un poco atrás
            nominal = [nominal[0] - 4, nominal[1] + (-11 if nominal[1] > 40 else 11 if nominal[1] < 40 else 11)]
        if nominal[0] is not None:
            used[(nominal[0], nominal[1])] = 1
            nominal[1] = min(74, max(6, nominal[1]))
        gk = pos == "Goalkeeper"
        if gk:
            sin = [r1(POS["Goalkeeper"][0]), r1(POS["Goalkeeper"][1]), 0]
        out.append({"id": int(pid), "j": J(pid), "pos": pos, "min": int(round(mins.get(pid, 0))), "portero": bool(gk),
                    "nominal": [r1(nominal[0]), r1(nominal[1])], "con": con, "sin": sin})
    res = {"formacion": "-".join(str(form)) if form else None, "jugadores": out, "con_360": False}
    if OWN is not None and len(OWN) and form:
        _slots_360(res, OWN, d360._sizes(str(form)))
    return res


def _diagram(sizes):
    """Dibujo estándar de la formación (convención, no dato): una fila por línea, repartidas a lo largo de la cancha; dentro de cada línea, de izquierda a derecha."""
    nl = len(sizes)
    xs = {3: [28, 62, 96], 4: [26, 48, 74, 98], 5: [24, 40, 58, 78, 98]}.get(nl) or [24 + 74 * i / (nl - 1) for i in range(nl)]
    ys = {1: [40], 2: [27, 53], 3: [16, 40, 64], 4: [10, 29, 51, 70], 5: [8, 24, 40, 56, 72]}
    pos = []
    for x, n in zip(xs, sizes):
        pos += [(x, y) for y in ys[n]]
    return pos


def _slots_360(res, OWN, sizes):
    """Con balón desde el 360: posición media de cada hueco y quién lo ocupa. El actor de cada evento trae identidad, así que se cuenta cuántas
    veces cada jugador estuvo en cada hueco (línea, de izquierda a derecha) y se asignan los 10 huecos a los 10 de campo maximizando esas cuentas."""
    from scipy.optimize import linear_sum_assignment
    jug = [j for j in res["jugadores"] if not j["portero"]]
    if len(jug) != 10 or OWN.n10.sum() < 20 or sum(sizes) != 10:
        return
    C = np.zeros((10, 10))
    for js in OWN.act:
        for pid, d in json.loads(js).items():
            for k, n in d.items():
                for a, j in enumerate(jug):
                    if j["id"] == int(pid):
                        C[a, int(k)] += n
    if C.sum() < 30:
        return
    # el puesto oficial de la alineación fija la LÍNEA (un lateral no puede acabar de delantero) y orienta el lado dentro de la línea
    # (izquierda < centro < derecha); la evidencia del actor desempata entre vecinos de la misma línea
    order = sorted(range(10), key=lambda a: jug[a]["nominal"][0] if jug[a]["nominal"][0] is not None else 50)
    prior = np.zeros((10, 10))
    allowed = np.zeros((10, 10), bool)
    i = 0
    for n in sizes:
        grp = sorted(order[i:i + n], key=lambda a: jug[a]["nominal"][1] if jug[a]["nominal"][1] is not None else 40)
        for r, a in enumerate(grp):
            prior[a, i + r] = 1.0
            allowed[a, i:i + n] = True
        i += n
    share = C / np.maximum(C.sum(1, keepdims=True), 1)
    score = np.where(allowed, share + 0.8 * prior, -100.0)
    ri, ci = linear_sum_assignment(-score)
    w = float(OWN.n10.sum())
    sl = np.array([[float(OWN[f"sx{k}"].sum() / w), float(OWN[f"sy{k}"].sum() / w)] for k in range(10)])
    diag = _diagram(sizes)
    tot = C.sum(1)
    for a, k in zip(ri, ci):
        j = jug[a]
        j["slot"] = int(k)
        j["nominal"] = [r1(diag[k][0]), r1(diag[k][1])]
        j["con"] = [r1(sl[k][0] / KX), r1(sl[k][1] / KY), None]
        j["ev"] = r1(C[a, k] / tot[a], 2) if tot[a] else None   # de las veces que lo vimos en un hueco, qué parte fue en éste
    res["con_360"] = True
    res["evidencia"] = r1(float(sum(C[a, k] for a, k in zip(ri, ci)) / C.sum()), 2)
    res["cuadros"] = int(OWN.n10.sum())


def asignar_bloque(jugadores, forma, tam):
    """«Sin balón» desde el 360: los 10 huecos del bloque (por línea y de izquierda a derecha) se asignan a los 10 de campo según su
    puesto en la alineación (misma lógica: líneas por altura, dentro de la línea de izquierda a derecha). Devuelve True si se pudo."""
    campo = [j for j in jugadores if not j["portero"] and j["nominal"][0] is not None]
    if len(campo) != 10 or sum(tam) != 10 or not forma:
        return False
    if all("slot" in j for j in campo):
        orden = sorted(campo, key=lambda j: j["slot"])
    else:
        campo.sort(key=lambda j: j["nominal"][0])
        orden, i = [], 0
        for n in tam:
            orden += sorted(campo[i:i + n], key=lambda j: j["nominal"][1])
            i += n
    for j, sl in zip(orden, forma):
        j["sin"] = [sl[0], sl[1], None]
        j["sin360"] = True
    return True


# ---------------------------------------------------------------- liga: ataque
def attack_tables(M, EFF):
    """Por eje (arma / termina), categoría y partido-equipo: jugadas, xG, OBV, goles (con ceros rellenados)."""
    tm = pd.concat([M[["match_id", "home_id", "home_coach_id"]].set_axis(["match_id", "team_id", "coach"], axis=1),
                    M[["match_id", "away_id", "away_coach_id"]].set_axis(["match_id", "team_id", "coach"], axis=1)], ignore_index=True)
    parts = []
    for col, ids in (("arma", jg.BUILD_IDS), ("termina", jg.FINISH_IDS)):
        g = EFF.groupby(["match_id", "team_id", col]).agg(n=("xg", "size"), xg=("xg", "sum"), obv=("obv", "sum"), goles=("goal", "sum")).reset_index().rename(columns={col: "cat"})
        f = tm.merge(pd.DataFrame({"cat": ids}), how="cross").merge(g, on=["match_id", "team_id", "cat"], how="left").fillna({"n": 0, "xg": 0, "obv": 0, "goles": 0})
        f["eje"] = col
        parts.append(f)
    return tm, pd.concat(parts, ignore_index=True)


def main():
    M = pd.read_parquet(PROC / "matches.parquet")
    S = pd.read_parquet(PROC / "stints.parquet", columns=["match_id", "team_id", "dur", "players"])
    LU = pd.read_parquet(PROC / "lineups.parquet")
    SH = pd.read_parquet(PROC / "shots.parquet")
    A = pd.read_parquet(PROC / "actions.parquet")
    names = pd.read_parquet(PROC / "players.parquet").drop_duplicates("player_id").set_index("player_id").player
    glob = json.load(open(ART / "global.json"))
    P = pd.read_parquet(PROC / "possessions.parquet", columns=["match_id", "team_id", "poss", "goal", "xg", "obv"])
    EFF = jg.classify(refresh=True)   # reglas sobre los datos procesados: rápido, siempre al día
    DEF = d360.run()
    OWN = d360.run_own()
    k3 = ["match_id", "team_id", "poss"]
    nxt = P.sort_values(["match_id", "poss"]).assign(next_team=lambda d: d.groupby("match_id").team_id.shift(-1)).set_index(k3).next_team
    PMIN = None
    try:
        PMIN = pd.read_parquet(ROOT / "data" / "model_cache" / "juego_poss_minute.parquet").set_index(["match_id", "poss"]).minute
    except Exception:
        pass

    # ----- liga: ataque
    tm, full = attack_tables(M, EFF)
    league_att = full.groupby(["eje", "cat"])[["n", "xg", "obv", "goles"]].mean()
    tot_eje = full[full.eje == "arma"].n.sum()           # jugadas efectivas de la liga (cada una cae en un solo tipo de cada eje)
    league_share = {(e, c): float(full[(full.eje == e) & (full.cat == c)].n.sum() / tot_eje * 100) for e, c in league_att.index}

    # ----- liga: defensa. Una fila por (partido, equipo, situación) -> promedio ponderado por cuadros
    DEF = DEF.merge(tm, on=["match_id", "team_id"], how="left")
    spells_att = full.merge(tm.groupby(["coach", "team_id"]).match_id.nunique().rename("pj").reset_index(), on=["coach", "team_id"])
    spells_att = spells_att[spells_att.pj >= MIN_SPELL]
    sp_att = spells_att.groupby(["coach", "team_id", "eje", "cat"])[["n", "xg", "obv"]].sum().reset_index()
    sp_att["tot"] = sp_att.groupby(["coach", "team_id", "eje"]).n.transform("sum")
    sp_att["share"] = sp_att.n / sp_att.tot.replace(0, np.nan) * 100

    def wcol(d, col):
        return d.n6 if col in W6 else d.n9w if col == "wid" else d.n9

    def wavg(d, col):
        w = wcol(d, col)
        x = d[col]
        ok = x.notna() & (w > 0)
        return float((x[ok] * w[ok]).sum() / w[ok].sum()) if ok.any() else float("nan")

    def frames(d, col):
        return int(wcol(d, col).sum())

    rows_sp = []
    for (c, t, sit), d in DEF.groupby(["coach", "team_id", "sit"]):
        if d.match_id.nunique() < MIN_SPELL:
            continue
        for m in VALID[sit]:
            if frames(d, m) >= MIN_FRAMES:
                rows_sp.append({"coach": c, "team_id": t, "sit": sit, "m": m, "v": wavg(d, m)})
    sp_def = pd.DataFrame(rows_sp)
    league_def = sp_def.groupby(["sit", "m"]).v.mean()

    def pct_of(series, v):
        s = series.dropna().to_numpy()
        return float((s < v).mean() * 100) if len(s) else None

    # ----- liga (archivo común)
    liga = {
        "bloques": [
            {"id": eje, "es": es_b, "en": en_b, "cats": [
                {"id": i, "es": es, "en": en, "desc_es": de, "desc_en": dn,
                 "n": r1(league_att.loc[(eje, i), "n"], 2), "share": r1(league_share[(eje, i)], 1)} for i, es, en, de, dn in cats]}
            for eje, es_b, en_b, cats in (("arma", "Cómo la arma", "How it is built", jg.BUILD), ("termina", "Cómo la termina", "How it ends", jg.FINISH))],
        "sits": [{"id": i, "es": es, "en": en, "desc_es": de, "desc_en": dn,
                  **{m: r1(league_def.get((i, m)), 1) for m in VALID[i]}} for i, es, en, de, dn in SITS],
        "min_partidos": MIN_SPELL,
    }
    json.dump(liga, open(OUT / "jugadas_liga.json", "w"), ensure_ascii=False, separators=(",", ":"))

    # ----- por DT
    Aeff = A[A.type.isin(["Pass", "Carry", "Shot"])].merge(EFF[k3].drop_duplicates(), on=k3)
    A_by = {k: g for k, g in Aeff.sort_values(k3 + ["t"]).groupby(k3, sort=False)}
    tot = 0
    for d in glob["dts"]:
        c = int(d["id"])
        mym = M[(M.home_coach_id == c) | (M.away_coach_id == c)].copy()
        mym["local"] = mym.home_coach_id == c
        mym["team_id"] = np.where(mym.local, mym.home_id, mym.away_id)
        mym["club"] = np.where(mym.local, mym.home, mym.away)
        mym["rival"] = np.where(mym.local, mym.away, mym.home)
        mym["opp_coach"] = np.where(mym.local, mym.away_coach_id, mym.home_coach_id)
        mym["gf"] = np.where(mym.local, mym.home_score, mym.away_score)
        mym["gc"] = np.where(mym.local, mym.away_score, mym.home_score)
        mym = mym.sort_values("date").reset_index(drop=True)
        clubs = mym.groupby("club").date.agg(["min", "max", "count"]).sort_values("max")
        club_list = list(clubs.index)
        cidx = {kk: i for i, kk in enumerate(club_list)}
        midx = {int(m): i for i, m in enumerate(mym.match_id)}
        partidos = [[r.date, r.rival, int(r.local), int(r.gf), int(r.gc), cidx[r.club]] for r in mym.itertuples()]
        jug: dict[int, int] = {}

        def J(pid):
            if pid is None or pid != pid:
                return None
            return jug.setdefault(int(pid), len(jug))

        por_club = {}
        for club in club_list:
            mc = mym[mym.club == club]
            keys = mc[["match_id", "team_id"]]
            pj = int(len(mc))
            # --- ataque
            ef = EFF.merge(keys, on=["match_id", "team_id"])
            att = {}
            ejemplos = {}
            for eje, ids in (("arma", jg.BUILD_IDS), ("termina", jg.FINISH_IDS)):
                tot_n = len(ef)
                for cid in ids:
                    e = ef[ef[eje] == cid]
                    sp = sp_att[(sp_att.eje == eje) & (sp_att.cat == cid)]
                    share = len(e) / tot_n * 100 if tot_n else 0.0
                    att[cid] = {"eje": eje, "n": r1(len(e) / pj, 2), "share": r1(share, 1), "xg": r1(e.xg.sum() / pj, 3), "obv": r1(e.obv.sum() / pj, 3),
                                "goles": int(e.goal.sum()), "tiros": int(e.shot.sum()), "pct": r1(pct_of(sp.share, share), 0) if len(sp) and tot_n else None}
                    e = e.copy()
                    e["score"] = e.xg + 0.4 * e.obv + 0.3 * e.goal.astype(float)
                    out, seen = [], set()
                    for r in e.sort_values("score", ascending=False).itertuples():
                        hit = (r.match_id, r.team_id, r.poss)
                        if hit not in A_by or len(A_by[hit]) < 2 or r.match_id in seen:
                            continue
                        seen.add(r.match_id)
                        minute = int(PMIN.get((int(r.match_id), int(r.poss)), int(r.t0 // 60))) if PMIN is not None else int(r.t0 // 60)
                        out.append(_example(A_by, SH, nxt, hit, r, J, midx, minute))
                        if len(out) == 3:
                            break
                    ejemplos[cid] = out
            # --- formaciones
            st = S.merge(keys, on=["match_id", "team_id"])
            ex = st[["dur", "players"]].explode("players").dropna()
            mins = ex.groupby("players").dur.sum().sort_values(ascending=False) / 60
            lu = LU.merge(keys, on=["match_id", "team_id"])
            pos = lu.groupby("player_id").position.agg(lambda s: s.value_counts().index[0])
            core, gk = [], False
            for pid in mins.index:
                pid = int(pid)
                is_gk = pos.get(pid) == "Goalkeeper"
                if is_gk and gk:
                    continue
                gk = gk or is_gk
                core.append(pid)
                if len(core) == 11:
                    break
            om = OWN.merge(keys, on=["match_id", "team_id"]) if OWN is not None else None
            form = formaciones(core, keys, A[["match_id", "team_id", "player_id", "type", "x", "y"]], LU, mins, names, J, om)
            # --- defensa 360
            dm = DEF.merge(keys, on=["match_id", "team_id"])
            tam = d360._sizes(form["formacion"].replace("-", "") if form["formacion"] else None)
            dsit = {}
            for sid, *_ in SITS:
                x = dm[dm.sit == sid]
                if x.n6.sum() == 0:
                    continue
                vals, pct, lg = {}, {}, {}
                for m in VALID[sid]:
                    nf = frames(x, m)
                    v = wavg(x, m) if nf >= 40 else float("nan")
                    vals[m] = r1(v, 1)
                    lg[m] = r1(league_def.get((sid, m)), 1)
                    spd = sp_def[(sp_def.sit == sid) & (sp_def.m == m)].v
                    pct[m] = r1(pct_of(spd, v), 0) if v == v and len(spd) else None
                forma = None
                if x.n10.sum() >= 30:
                    forma = [[r1(float(x[f"sx{i}"].sum() / x.n10.sum()) / KX), r1(float(x[f"sy{i}"].sum() / x.n10.sum()) / KY)] for i in range(10)]   # en unidades de cancha, listo para dibujar
                dsit[sid] = {"n": int(x.n.sum()), "n6": int(x.n6.sum()), "n9": int(x.n9.sum()), "n10": int(x.n10.sum()), "partidos": int(x.match_id.nunique()),
                             **vals, "liga": lg, "pct": pct, "bola": [r1(wavg(x, "bx") / KX), r1(wavg(x, "by") / KY)], "forma": forma,
                             "pocos": bool(any(frames(x, m) < MIN_FRAMES for m in VALID[sid]))}
            blk = dsit.get("bajo") if (dsit.get("bajo") or {}).get("forma") else (dsit.get("medio") or {})
            form["sin_360"] = bool(blk.get("forma") and asignar_bloque(form["jugadores"], blk["forma"], tam))
            por_club[club] = {"partidos": pj, "con360": int(dm.match_id.nunique()),
                              "ataque": {"cats": att, "ejemplos": ejemplos, "total_n": r1(len(ef) / pj, 2)},
                              "defensa": {"sits": dsit, "tam": tam},
                              "formaciones": form}
        obj = {"id": c, "actual": club_list[-1], "clubes": [{"club": k, "partidos": int(clubs.loc[k, "count"]), "desde": clubs.loc[k, "min"], "hasta": clubs.loc[k, "max"]} for k in club_list],
               "partidos": partidos, "jugadores": [[k, str(names.get(k, k))] for k in jug], "por_club": por_club}
        PRIV.mkdir(parents=True, exist_ok=True)
        f = PRIV / f"jugadas_{c}.json"
        json.dump(obj, open(f, "w"), ensure_ascii=False, separators=(",", ":"))
        sz = f.stat().st_size
        tot += sz
        print(f"  {c} {d['nombre'][:28]:28s} {sz / 1024:6.0f} KB  clubes={len(club_list)}")
    print(f"total {tot / 1024:.0f} KB")


if __name__ == "__main__":
    main()
