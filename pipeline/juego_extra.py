"""Datos extra para la sección «Juego» (Fases) de la web, uno por DT:

  - redes de pases por club dirigido (mismo método que build.pass_network: los 11 con más minutos en ese club,
    posición media de sus pases completos, aristas con ≥1 pase por partido; un solo portero),
  - detalle de cada tiro (partido, rival, minuto, marcador en ese momento, autor, resultado, parte del cuerpo,
    destino final x/y/z de StatsBomb),
  - jugadores y desenlace de los ejemplos de arquetipos (mismo orden que arquetipos_ejemplos en dt_<id>.json).

No ajusta ningún modelo: sólo lee data/processed, data/events (para la altura final del tiro) y artifacts/.

  .venv/bin/python -m pipeline.juego_extra   ->  web/public/data/juego_<id>.json
"""
from __future__ import annotations

import gzip
import json
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PROC = DATA / "processed"
ART = ROOT / "artifacts"
OUT = ROOT / "web" / "public" / "data"
CACHE = DATA / "model_cache" / "juego_shots_raw.parquet"
CACHE_MIN = DATA / "model_cache" / "juego_poss_minute.parquet"

RES = ["Goal", "Saved", "Saved to Post", "Saved Off Target", "Post", "Off T", "Wayward", "Blocked"]
BODY = ["Right Foot", "Left Foot", "Head", "Other"]
TIPO = ["Open Play", "Penalty", "Free Kick", "Corner"]


# ---------------------------------------------------------------- tiros crudos (destino z, marcador)
def _raw_match(path: str):
    mid = int(Path(path).name.split(".")[0])
    ev = json.load(gzip.open(path, "rt"))
    ev.sort(key=lambda e: e["index"])
    goals: dict[int, int] = {}
    rows, pmin = [], {}
    for e in ev:
        tn = e["type"]["name"]
        pmin.setdefault(e.get("possession"), int(e.get("minute", 0)))
        if e.get("period", 1) >= 5:
            continue
        tid = e.get("team", {}).get("id")
        if tn == "Shot":
            s = e["shot"]
            el = s.get("end_location") or [None, None, None]
            rows.append({"match_id": mid, "poss": e["possession"], "x": round(float(e["location"][0]), 1), "y": round(float(e["location"][1]), 1),
                         "team_id": tid, "second": int(e.get("second", 0)),
                         "ex": el[0], "ey": el[1] if len(el) > 1 else None, "ez": el[2] if len(el) > 2 else None,
                         "first_time": bool(s.get("first_time", False)),
                         "pre": dict(goals)})
            if s.get("outcome", {}).get("name") == "Goal":
                goals[tid] = goals.get(tid, 0) + 1
        elif tn == "Own Goal For":
            goals[tid] = goals.get(tid, 0) + 1
    for r in rows:
        r["g_own"] = r["pre"].get(r["team_id"], 0)
        r["g_opp"] = sum(v for k, v in r["pre"].items() if k != r["team_id"])
        del r["pre"]
    return rows, [{"match_id": mid, "poss": k, "minute": v} for k, v in pmin.items() if k is not None]


def raw_shots():
    """Tiros con destino x/y/z y marcador previo + minuto de inicio de cada posesión (caché en data/model_cache)."""
    if CACHE.exists() and CACHE_MIN.exists():
        return pd.read_parquet(CACHE), pd.read_parquet(CACHE_MIN)
    files = sorted(str(p) for p in (DATA / "events").glob("*.json.gz"))
    rows, mins = [], []
    with ProcessPoolExecutor() as ex:
        for r, m in ex.map(_raw_match, files, chunksize=8):
            rows += r
            mins += m
    df, dm = pd.DataFrame(rows), pd.DataFrame(mins)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(CACHE)
    dm.to_parquet(CACHE_MIN)
    return df, dm


# ---------------------------------------------------------------- red de pases (como build.pass_network)
def pass_network(A, my, stints, lineups, top=11):
    k = A.merge(my[["match_id", "team_id"]], on=["match_id", "team_id"])
    st = stints.merge(my[["match_id", "team_id"]], on=["match_id", "team_id"])
    ex = st[["dur", "players"]].explode("players").dropna()
    mins = ex.groupby("players").dur.sum().sort_values(ascending=False) / 60
    lu = lineups.merge(my[["match_id", "team_id"]], on=["match_id", "team_id"])
    pos = lu.groupby("player_id").position.agg(lambda s: s.value_counts().index[0])
    core, gk = [], False
    for pid in mins.index:
        pid = int(pid)
        is_gk = pos.get(pid) == "Goalkeeper"
        if is_gk and gk:
            continue  # un solo portero: el de más minutos
        gk = gk or is_gk
        core.append(pid)
        if len(core) == top:
            break
    p = k[(k.type == "Pass") & k.outcome.isna() & k.player_id.isin(core)]
    nodes = []
    for pid in core:
        d = p[p.player_id == pid]
        if len(d) == 0:
            continue
        nodes.append({"id": pid, "x": round(float(d.x.mean()), 1), "y": round(float(d.y.mean()), 1),
                      "pases": round(float(len(d) / max(mins[pid] / 90, 1)), 1), "minutos": int(round(mins[pid]))})
    e = p[p.recipient_id.isin(core)].groupby(["player_id", "recipient_id"]).size().reset_index(name="n")
    n = max(my.match_id.nunique(), 1)
    edges = [{"a": int(r.player_id), "b": int(r.recipient_id), "n": round(float(r.n / n), 2)} for r in e.itertuples() if r.n / n >= 1.0]
    return {"partidos": int(n), "nodos": nodes, "aristas": edges}


def r1(v):
    if v is None or v != v:
        return None
    v = round(float(v), 1)
    return int(v) if v.is_integer() else v


def main():
    glob = json.load(open(ART / "global.json"))
    M = pd.read_parquet(PROC / "matches.parquet")
    S = pd.read_parquet(PROC / "stints.parquet", columns=["match_id", "team_id", "dur", "players"])
    LU = pd.read_parquet(PROC / "lineups.parquet", columns=["match_id", "team_id", "player_id", "position"])
    SH = pd.read_parquet(PROC / "shots.parquet")
    P = pd.read_parquet(PROC / "possessions.parquet", columns=["match_id", "team_id", "poss", "shot", "goal", "xg"])
    A = pd.read_parquet(PROC / "actions.parquet")
    names = pd.read_parquet(PROC / "players.parquet").drop_duplicates("player_id").set_index("player_id").player
    print("leyendo tiros crudos…")
    RAW, PMIN = raw_shots()
    PMIN = PMIN.set_index(["match_id", "poss"]).minute
    SH = SH.assign(x=SH.x.round(1), y=SH.y.round(1)).merge(RAW.drop(columns=["team_id"]), on=["match_id", "poss", "x", "y"], how="left")
    SH = SH.drop_duplicates(["match_id", "poss", "t"])
    A_pcs = A[A.type.isin(["Pass", "Carry", "Shot"])]

    tot = 0
    for d in glob["dts"]:
        c = int(d["id"])
        art = json.load(open(ART / f"dt_{c}.json"))
        mym = M[(M.home_coach_id == c) | (M.away_coach_id == c)].copy()
        mym["local"] = mym.home_coach_id == c
        mym["team_id"] = np.where(mym.local, mym.home_id, mym.away_id)
        mym["club"] = np.where(mym.local, mym.home, mym.away)
        mym["rival"] = np.where(mym.local, mym.away, mym.home)
        mym["gf"] = np.where(mym.local, mym.home_score, mym.away_score)
        mym["gc"] = np.where(mym.local, mym.away_score, mym.home_score)
        mym = mym.sort_values("date").reset_index(drop=True)
        clubs = mym.groupby("club").date.agg(["min", "max", "count"]).sort_values("max")
        club_list = list(clubs.index)
        cidx = {k: i for i, k in enumerate(club_list)}
        midx = {int(m): i for i, m in enumerate(mym.match_id)}
        partidos = [[r.date, r.rival, int(r.local), int(r.gf), int(r.gc), cidx[r.club]] for r in mym.itertuples()]
        jug: dict[int, int] = {}  # player_id -> índice en «jugadores»

        def J(pid):
            if pid is None or pid != pid:
                return None
            return jug.setdefault(int(pid), len(jug))

        # redes por club
        redes = {}
        for club in club_list:
            my = mym[mym.club == club][["match_id", "team_id"]]
            net = pass_network(A, my, S, LU)
            for n in net["nodos"]:
                n["j"] = J(n["id"])
            redes[club] = net

        # tiros
        sh = SH.merge(mym[["match_id", "team_id"]], on=["match_id", "team_id"]).sort_values(["match_id", "t"])
        tiros = []
        for r in sh.itertuples():
            tiros.append([r1(r.x), r1(r.y), r1(r.ex), r1(r.ey), r1(r.ez), round(float(r.xg), 3 if r.xg < 0.1 else 2),
                          RES.index(r.outcome) if r.outcome in RES else -1,
                          BODY.index(r.body_part) if r.body_part in BODY else -1,
                          TIPO.index(r.subtype) if r.subtype in TIPO else 0,
                          int(r.minute), midx[int(r.match_id)], J(r.player_id),
                          None if r.g_own != r.g_own else int(r.g_own), None if r.g_opp != r.g_opp else int(r.g_opp)])

        # ejemplos de arquetipos: localizar cada posesión dibujada en dt_<id>.json
        my_all = mym[["match_id", "team_id"]]
        Ac = A_pcs.merge(my_all, on=["match_id", "team_id"])
        Ac = Ac.assign(kk=list(zip(Ac.type, Ac.x.astype(float).round(1), Ac.y.astype(float).round(1))))
        firsts = Ac.groupby(["match_id", "team_id", "poss"], sort=False).head(1)
        index: dict = {}
        for r in firsts.itertuples():
            index.setdefault(r.kk, []).append((r.match_id, r.team_id, r.poss))
        G = {k: g for k, g in Ac.groupby(["match_id", "team_id", "poss"], sort=False)}
        Pm = P.set_index(["match_id", "team_id", "poss"])
        nxt = P.sort_values(["match_id", "poss"]).assign(next_team=lambda d: d.groupby("match_id").team_id.shift(-1)).set_index(["match_id", "team_id", "poss"]).next_team
        ejemplos = {}
        for arq, seqs in art["arquetipos_ejemplos"].items():
            out = []
            for seq in seqs:
                if not seq:
                    out.append(None)
                    continue
                key = (seq[0][0], seq[0][1], seq[0][2])
                hit = None
                for cand in index.get(key, []):
                    g = G[cand]
                    if len(g.head(40)) == len(seq) and all(a == s[0] and round(float(x), 1) == s[1] for a, x, s in zip(g.type, g.x, seq)):
                        hit = cand
                        break
                if hit is None:
                    out.append(None)
                    continue
                g = G[hit].head(40)
                pr = Pm.loc[hit] if hit in Pm.index else None
                last = g.iloc[-1]
                if pr is not None and bool(pr.goal):
                    fin = "gol"
                elif last.type == "Shot":
                    fin = "tiro"
                elif (last.type == "Pass" and isinstance(last.outcome, str)) or (hit in nxt.index and nxt.loc[hit] == nxt.loc[hit] and nxt.loc[hit] != hit[1]):
                    fin = "perdida"
                else:
                    fin = "fin"
                shot_out = None
                if last.type == "Shot":
                    s_ = SH[(SH.match_id == hit[0]) & (SH.poss == hit[2]) & (SH.team_id == hit[1])]
                    if len(s_):
                        shot_out = RES.index(s_.outcome.iloc[-1]) if s_.outcome.iloc[-1] in RES else -1
                acc = [[J(r.player_id), J(r.recipient_id) if r.type == "Pass" and not isinstance(r.outcome, str) else None,
                        0 if (r.type == "Pass" and isinstance(r.outcome, str)) else 1] for r in g.itertuples()]
                minute = int(PMIN.get((int(hit[0]), int(hit[2])), int(g.t.iloc[0] // 60)))
                out.append({"m": midx[int(hit[0])], "min": minute, "fin": fin, "res": shot_out,
                            "xg": round(float(pr.xg), 3) if pr is not None and pr.xg == pr.xg else None, "acc": acc})
            ejemplos[arq] = out

        obj = {"id": c, "clubes": [{"club": k, "partidos": int(clubs.loc[k, "count"]), "desde": clubs.loc[k, "min"], "hasta": clubs.loc[k, "max"]} for k in club_list],
               "partidos": partidos, "jugadores": [[k, str(names.get(k, k))] for k in jug], "redes": redes,
               "tiros_cols": ["x", "y", "ex", "ey", "ez", "xg", "res", "cuerpo", "tipo", "min", "partido", "jugador(índice)", "g_propios", "g_rival"],
               "res": RES, "cuerpo": BODY, "tipo": TIPO, "tiros": tiros, "ejemplos": ejemplos}
        f = OUT / f"juego_{c}.json"
        json.dump(obj, open(f, "w"), ensure_ascii=False, separators=(",", ":"))
        sz = f.stat().st_size
        tot += sz
        miss = sum(1 for v in ejemplos.values() for e in v if e is None)
        print(f"  {c} {d['nombre'][:28]:28s} {sz / 1024:6.0f} KB  tiros={len(tiros)} clubes={len(club_list)} ejemplos sin localizar={miss}")
    print(f"total {tot / 1024:.0f} KB")


if __name__ == "__main__":
    main()
