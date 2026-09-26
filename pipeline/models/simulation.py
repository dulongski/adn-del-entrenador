"""Simulación explicativa (sección 6, no predictiva): cada partido se 'rejuega' N veces
usando el xG de cada posesión (máx. 1 gol por posesión: p = 1 − Π(1 − xG_tiro)).
Resultado: probabilidad de victoria/empate/derrota, puntos esperados y 'resultado merecido'."""
from __future__ import annotations

import numpy as np
import pandas as pd


def possession_probs(shots: pd.DataFrame, team_id: int) -> np.ndarray:
    s = shots[(shots.team_id == team_id) & shots.xg.notna()]
    if s.empty:
        return np.array([])
    p = s.groupby("poss").xg.apply(lambda x: 1 - np.prod(1 - x.values))
    return p.values


def simulate_match(shots: pd.DataFrame, team_id: int, opp_id: int, n: int = 10000, seed: int = 0) -> dict:
    rng = np.random.default_rng(seed)
    a, b = possession_probs(shots, team_id), possession_probs(shots, opp_id)
    ga = (rng.random((n, len(a))) < a).sum(1) if len(a) else np.zeros(n, int)
    gb = (rng.random((n, len(b))) < b).sum(1) if len(b) else np.zeros(n, int)
    w, d = float((ga > gb).mean()), float((ga == gb).mean())
    l = 1 - w - d
    hist = pd.crosstab(np.minimum(ga, 5), np.minimum(gb, 5), normalize=True)
    grid = [[float(hist.loc[i, j]) if i in hist.index and j in hist.columns else 0.0 for j in range(6)] for i in range(6)]
    return {"victoria": w, "empate": d, "derrota": l, "xpts": 3 * w + d,
            "xg": float(shots[shots.team_id == team_id].xg.sum()), "xg_rival": float(shots[shots.team_id == opp_id].xg.sum()),
            "marcadores": grid}


def coach_simulation(shots: pd.DataFrame, my: pd.DataFrame, n: int = 5000) -> dict:
    """my: partidos del DT (match_id, team_id, opp_id, gf, gc, date, rival)."""
    rows = []
    sh = shots  # penales incluidos con su xG (~0.78)
    by = dict(tuple(sh.groupby("match_id")))
    for r in my.itertuples():
        s = by.get(r.match_id, sh.iloc[:0])
        sim = simulate_match(s, r.team_id, r.opp_id, n=n, seed=int(r.match_id) % 10000)
        pts = 3 if r.gf > r.gc else (1 if r.gf == r.gc else 0)
        rows.append({"match_id": int(r.match_id), "date": r.date, "rival": r.rival, "local": bool(r.local),
                     "gf": int(r.gf), "gc": int(r.gc), "puntos": pts, **{k: v for k, v in sim.items() if k != "marcadores"},
                     "marcadores": sim["marcadores"]})
    df = pd.DataFrame(rows)
    return {
        "partidos": rows,
        "puntos": int(df.puntos.sum()) if len(df) else 0,
        "xpts": float(df.xpts.sum()) if len(df) else 0,
        "dominio_medio": float((df.xg / (df.xg + df.xg_rival).replace(0, np.nan)).mean() * 100) if len(df) else None,
    }
