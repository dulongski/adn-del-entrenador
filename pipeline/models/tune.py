"""Selección de penalizaciones ridge por validación cruzada agrupada por partido (error de
predicción ponderado fuera de muestra sobre un subconjunto representativo de indicadores)."""
from __future__ import annotations

import itertools

import numpy as np
from sklearn.model_selection import GroupKFold

from pipeline.models import decomposition as dec

KPIS_CV = ["posesion", "ppda", "pase_largo", "verticalidad", "altura_presion", "contraataque", "centros", "linea_360"]


def cv_lambda(seg, grid_coach=(5, 20, 80), grid_player=(20, 60, 200), grid_club=(20,), folds=3, log=print):
    D = dec.build_design(seg)
    Z, W, _ = dec.targets(seg)
    groups = seg.match_id.values
    res = []
    for lc, lp, lk in itertools.product(grid_coach, grid_player, grid_club):
        lam = {**dec.DEFAULT_LAMBDA, "coach": lc, "player": lp, "club": lk}
        lam_vec = np.array([lam[b] for b in D.block_of])
        lam_vec[D.index[("ctx", "intercept")]] = 1e-6
        err = wsum = 0.0
        for tr, te in GroupKFold(folds).split(np.zeros(len(seg)), groups=groups):
            Xtr, Xte = D.X[tr], D.X[te]
            for k in KPIS_CV:
                y, w = Z[k].fillna(0).values, W[k].values
                b = dec._solve(Xtr, y[tr], w[tr], lam_vec)
                e = y[te] - Xte @ b
                err += float((w[te] * e ** 2).sum()); wsum += float(w[te].sum())
        res.append({"coach": lc, "player": lp, "club": lk, "mse": err / wsum})
        log(f"  λ DT={lc} jugadores={lp} club={lk}: MSE={err / wsum:.4f}")
    best = min(res, key=lambda r: r["mse"])
    return {**dec.DEFAULT_LAMBDA, "coach": best["coach"], "player": best["player"], "club": best["club"]}, res
