"""Puente estilo -> xG para el simulador: ¿cuánto cambia el xG esperado de un partido si el estilo del DT se mueve?

Regresión ridge a nivel equipo-partido: xG a favor (y en contra) por 90 en σ de la liga contra el ESTILO propio del equipo en ese partido
(indicadores de intención, sin los de resultado como xG o tiros) y el estilo del rival (control) + localía. Es una asociación entre equipos,
no una causa: sirve para decir «con un DT que juegue así, el xG esperado suele ser éste», no para prometer qué pasaría.

  .venv/bin/python -m pipeline.style_xg  ->  web/public/data/style_xg.json
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.features.style_kpis import BASE_KPIS
from pipeline.models import decomposition as dec

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
OUT = ROOT / "web" / "public" / "data" / "style_xg.json"
# resultados (no intenciones): no entran como «estilo»
OUTPUT_KPIS = {"xg_90", "xg_por_tiro", "tiros_90", "obv_90", "llegada_area", "xg_contra_90", "xg_transicion", "xg_balon_parado_90", "posesion_rival_dur", "field_tilt"}
LAM = 300.0


def main():
    M = pd.read_parquet(PROC / "matches.parquet")
    S = pd.read_parquet(PROC / "stints.parquet")
    seg = dec.build_segments(S, M)
    F = dec.fit(seg, design=dec.build_design(seg), kpis=["posesion"])    # sólo para las constantes de escala
    Z, W, stats = dec.targets(seg, F.stats)
    kp = list(BASE_KPIS)
    style = [k for k in kp if k not in OUTPUT_KPIS]
    d = seg[["match_id", "team_id", "dur", "home"]].copy()
    rows = {}
    for k in kp:
        w = (W[k] * seg.dur).values
        z = Z[k].fillna(0).values
        rows[k] = (z * w, w)
    g = d.groupby(["match_id", "team_id"])
    T = pd.DataFrame({"dur": g.dur.sum(), "home": g.home.max()})
    for k in kp:
        num = pd.Series(rows[k][0], index=d.index).groupby([d.match_id, d.team_id]).sum()
        den = pd.Series(rows[k][1], index=d.index).groupby([d.match_id, d.team_id]).sum()
        T[k] = (num / den.replace(0, np.nan))
    T = T.reset_index()
    O = T[["match_id", "team_id"] + style].rename(columns={k: "o_" + k for k in style})
    O["opp_of"] = O.team_id
    # rival = el otro equipo del partido
    mm = T[["match_id", "team_id"]].merge(T[["match_id", "team_id"]], on="match_id", suffixes=("", "_o")).query("team_id != team_id_o")
    T = T.merge(mm, on=["match_id", "team_id"]).merge(O.drop(columns="opp_of"), left_on=["match_id", "team_id_o"], right_on=["match_id", "team_id"], suffixes=("", "_dup")).drop(columns="team_id_dup")
    T = T[T.dur > 20 * 60].dropna(subset=["xg_90", "xg_contra_90"])
    X = T[style + ["o_" + k for k in style]].fillna(0).values
    X = np.column_stack([X, T.home.values.astype(float)])
    mu, sd = X.mean(0), X.std(0) + 1e-9
    Xs = (X - mu) / sd
    # los coeficientes se expresan por 1σ de la liga de cada indicador, no por 1σ del partido: se des-estandariza con la sd del partido
    res = {"kpis": {}, "n": int(len(T))}
    rng = np.random.default_rng(0)
    for tgt in ("xg_90", "xg_contra_90"):
        y = T[tgt].values
        w = T.dur.values / T.dur.values.mean()
        A = Xs.T @ (Xs * w[:, None]) + LAM * np.eye(Xs.shape[1])
        b = Xs.T @ (w * (y - np.average(y, weights=w)))
        beta = np.linalg.solve(A, b)
        pred = Xs @ beta + np.average(y, weights=w)
        r2 = 1 - np.average((y - pred) ** 2, weights=w) / np.average((y - np.average(y, weights=w)) ** 2, weights=w)
        # validación cruzada por partido (10 pliegues)
        ids = T.match_id.values
        fold = rng.integers(0, 10, len(np.unique(ids)))
        fmap = dict(zip(np.unique(ids), fold))
        f = np.array([fmap[i] for i in ids])
        cvp = np.zeros_like(y)
        for k in range(10):
            tr, te = f != k, f == k
            Ak = Xs[tr].T @ (Xs[tr] * w[tr, None]) + LAM * np.eye(Xs.shape[1])
            bk = Xs[tr].T @ (w[tr] * (y[tr] - np.average(y[tr], weights=w[tr])))
            cvp[te] = Xs[te] @ np.linalg.solve(Ak, bk) + np.average(y[tr], weights=w[tr])
        r2cv = 1 - np.average((y - cvp) ** 2, weights=w) / np.average((y - np.average(y, weights=w)) ** 2, weights=w)
        # coeficiente por 1σ de LIGA del indicador (z de la tabla): beta_std / sd_x
        gam = (beta[: len(style)] / sd[: len(style)])
        res[tgt] = {"r2": float(r2), "r2_cv": float(r2cv)}
        for k, gk in zip(style, gam):
            res["kpis"].setdefault(k, {})[tgt] = round(float(gk), 4)
        res[tgt]["sd_xg"] = float(stats[tgt]["sd"]); res[tgt]["mean_xg"] = float(stats[tgt]["mean"])
    res["estilo"] = style
    json.dump(res, open(OUT, "w"), ensure_ascii=False, indent=1)
    print("n", res["n"], {t: (round(res[t]["r2"], 3), round(res[t]["r2_cv"], 3), round(res[t]["sd_xg"], 3), round(res[t]["mean_xg"], 3)) for t in ("xg_90", "xg_contra_90")})
    top = sorted(res["kpis"].items(), key=lambda kv: -abs(kv[1]["xg_90"]))[:8]
    print("for", [(k, v["xg_90"]) for k, v in top])
    top = sorted(res["kpis"].items(), key=lambda kv: -abs(kv[1]["xg_contra_90"]))[:8]
    print("against", [(k, v["xg_contra_90"]) for k, v in top])


if __name__ == "__main__":
    main()
