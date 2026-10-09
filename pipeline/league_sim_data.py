"""Constantes y tasas por jugador para el simulador de liga (web/public/data/liga_sim.json).

  - liga: xG medio por equipo-partido, localía (xG local / visita), goles por xG, cuándo caen los goles y las tarjetas (por tramos de 5 min),
    tarjetas por equipo-partido.
  - jugadores: sólo los de las plantillas actuales (whatif.json): [xG por 90 (con encogimiento), amarillas por 90, rojas por 90, minutos recientes].
    La plantilla NO se edita: sólo sirve para decir quién anota y a quién amonestan.

  .venv/bin/python -m pipeline.league_sim_data
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
OUT = ROOT / "web" / "public" / "data" / "liga_sim.json"
RECENT = ["2023/24", "2024/25", "2025/26", "2026/27"]
CARD = {"Yellow Card": "y", "Second Yellow": "r", "Red Card": "r"}


def _cards(path):
    mid = int(Path(path).name.split(".")[0])
    out = []
    for e in json.load(gzip.open(path, "rt")):
        if e.get("period", 1) >= 5:
            continue
        t = e["type"]["name"]
        c = (e.get("foul_committed") or e.get("bad_behaviour") or {}).get("card", {}).get("name") if t in ("Foul Committed", "Bad Behaviour") else None
        if c in CARD and "player" in e:
            out.append((mid, e["team"]["id"], e["player"]["id"], int(e.get("minute", 0)), CARD[c]))
    return out


def main():
    W = json.load(open(ROOT / "web" / "public" / "data" / "whatif.json"))
    M = pd.read_parquet(PROC / "matches.parquet")
    SH = pd.read_parquet(PROC / "shots.parquet")
    S = pd.read_parquet(PROC / "stints.parquet", columns=["match_id", "team_id", "dur", "players"])
    files = sorted((DATA / "events").glob("*.json.gz"))
    with ProcessPoolExecutor() as ex:
        rows = [r for rs in ex.map(_cards, map(str, files), chunksize=16) for r in rs]
    C = pd.DataFrame(rows, columns=["match_id", "team_id", "player_id", "minute", "k"])
    nm = len(M)
    # ---- liga
    sh = SH.merge(M[["match_id", "home_id", "season"]], on="match_id")
    sh["home"] = sh.team_id == sh.home_id
    xg_h, xg_a = sh[sh.home].xg.sum() / nm, sh[~sh.home].xg.sum() / nm
    goals = (M.home_score.sum() + M.away_score.sum())
    conv = float(goals / sh.xg.sum())
    g = SH[SH.outcome == "Goal"]
    gm = np.minimum(g.minute.values, 89) // 5
    gpdf = (np.bincount(gm.astype(int), minlength=18) / len(g)).tolist()
    cm = np.minimum(C.minute.values, 89) // 5
    cy = (np.bincount(cm[C.k.values == "y"].astype(int), minlength=18) / (C.k == "y").sum()).tolist()
    liga = {"xg_mean": float(sh.xg.sum() / (2 * nm)), "xg_home": float(xg_h), "xg_away": float(xg_a), "conv": conv,
            "goles_pdf5": gpdf, "amarillas_pdf5": cy, "amarillas_por_equipo": float((C.k == "y").sum() / (2 * nm)), "rojas_por_equipo": float((C.k == "r").sum() / (2 * nm)),
            "goles_local": float(M.home_score.mean()), "goles_visita": float(M.away_score.mean()), "n_partidos": int(nm)}
    # ---- jugadores actuales
    pids = {int(p) for s in W["squads"].values() for p, _ in s["jugadores"]} | {int(p) for s in W["squads"].values() for p in s["xi"]}
    ex_ = S.explode("players").dropna(subset=["players"])
    ex_["player_id"] = ex_.players.astype(int)
    ex_ = ex_.merge(M[["match_id", "season"]], on="match_id")
    mins = ex_[ex_.season.isin(RECENT)].groupby("player_id").dur.sum() / 60
    sx = SH[SH.match_id.isin(M[M.season.isin(RECENT)].match_id)].groupby("player_id").xg.sum()
    cc = C[C.match_id.isin(M[M.season.isin(RECENT)].match_id)].groupby(["player_id", "k"]).size().unstack(fill_value=0)
    mu_g = float(sx.sum() / max(mins[mins.index.isin(sx.index)].sum() / 90, 1) / 10)   # xG por 90 de un jugador de campo medio
    mu_y = float(cc.get("y", pd.Series(dtype=float)).sum() / (mins.sum() / 90) / 10 * 11) if len(cc) else 0.2
    jug = {}
    for p in pids:
        m = float(mins.get(p, 0))
        pos = (W["players"].get(str(p)) or {}).get("pos", "")
        gk = pos == "Portero" or any(str(p) in s.get("pos", {}) and s["pos"][str(p)] == "Portero" for s in W["squads"].values())
        x = float(sx.get(p, 0)); y = float(cc.loc[p, "y"]) if p in cc.index and "y" in cc else 0.0; r = float(cc.loc[p, "r"]) if p in cc.index and "r" in cc else 0.0
        a = 8.0
        gr = 0.002 if gk else (x + a * mu_g) / (m / 90 + a)
        yr = (y + a * 0.12) / (m / 90 + a)
        rr = (r + a * 0.004) / (m / 90 + a)
        jug[str(p)] = [round(gr, 4), round(yr, 4), round(rr, 5), round(m)]
    # ---- lo que va del torneo en curso (para arrancar la tabla de goleo a media temporada)
    cur = M[(M.season == "2026/27") & (M.stage == "Apertura")]
    ids = set(cur.match_id)
    club_of = pd.concat([M[["home_id", "home"]].set_axis(["t", "c"], axis=1), M[["away_id", "away"]].set_axis(["t", "c"], axis=1)]).drop_duplicates("t").set_index("t").c
    pn = pd.read_parquet(PROC / "players.parquet").drop_duplicates("player_id").set_index("player_id").player
    gl = SH[SH.match_id.isin(ids) & (SH.outcome == "Goal")].groupby(["player_id", "team_id"]).size().rename("g")
    cd = C[C.match_id.isin(ids)].groupby(["player_id", "team_id", "k"]).size().unstack(fill_value=0)
    R = pd.concat([gl, cd], axis=1).fillna(0).reset_index()
    for c in ("g", "y", "r"):
        if c not in R:
            R[c] = 0
    real = [[int(r.player_id), str(pn.get(r.player_id, r.player_id)), str(club_of.get(r.team_id, "")), int(r.g), int(r.y), int(r.r)] for r in R.itertuples() if r.g + r.y + r.r > 0]
    json.dump({"liga": liga, "jugadores": jug, "real": real}, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(liga["xg_mean"], xg_h / nm * 0, "home/away", round(xg_h, 3), round(xg_a, 3), "conv", round(conv, 3), "yel", round(liga["amarillas_por_equipo"], 2), "red", round(liga["rojas_por_equipo"], 3), len(jug), OUT.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
