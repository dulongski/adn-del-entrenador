"""Arquetipos de posesión ("jugadas tipo"): mezcla gaussiana (covarianza completa) sobre seis
descriptores de cada posesión en juego abierto. K=8, elegido en el codo del BIC (K=4..12) y
por interpretabilidad. Los nombres salen de reglas explícitas sobre los centroides."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler

FEATS = ["start_x", "max_x", "log_dur", "log_pass", "direct", "peligro"]
K = 8


def features(P: pd.DataFrame, jitter: bool = True, seed: int = 0) -> pd.DataFrame:
    f = pd.DataFrame(index=P.index)
    f["start_x"] = P.start_x
    f["max_x"] = P.max_x
    f["log_dur"] = np.log1p(P.dur.clip(0, 180))
    f["log_pass"] = np.log1p(P.n_pass)
    f["direct"] = ((P.max_x - P.start_x).clip(lower=0) / P.path.replace(0, np.nan)).clip(0, 1).fillna(0)
    # peligro ordinal: 0 nada, 1 último tercio, 2 área, 3 remate
    f["peligro"] = P.reach_f3.astype(float) + P.reach_box.astype(float) + P.shot.astype(float)
    if jitter:  # ruido pequeño para que la variable ordinal no degenere la covarianza
        f["peligro"] += np.random.default_rng(seed).normal(0, 0.1, len(f))
    return f


def eligible(P: pd.DataFrame) -> pd.Series:
    return ~P.set_piece & (P.n_pass + P.n_carry >= 1) & P.start_x.notna() & P.max_x.notna()


def fit(P: pd.DataFrame, k: int = K, sample=60000, seed=0):
    m = eligible(P)
    F = features(P[m], seed=seed)
    S = StandardScaler().fit(F)
    Xs = S.transform(F.sample(min(sample, len(F)), random_state=seed))
    gmm = GaussianMixture(k, covariance_type="full", random_state=seed, n_init=3).fit(Xs)
    labels = pd.Series(-1, index=P.index)
    labels[m] = gmm.predict(S.transform(F))
    cent = pd.DataFrame(S.inverse_transform(gmm.means_), columns=FEATS)
    names = name_clusters(cent, P[m], labels[m])
    return gmm, S, labels, cent, names


def _rule(c) -> str:
    if c.start_x < 20:
        return "Construcción elaborada desde el portero" if c.max_x >= 70 else "Salida del portero sin progresar"
    if c.peligro >= 1.8:
        return "Ataque que pisa el área"
    if c.start_x >= 60:
        return "Posesión iniciada en campo rival"
    if c.max_x >= 80:
        return "Progresión al último tercio"
    if c.max_x - c.start_x < 5 and c.log_pass < 1:
        return "Pérdida inmediata"
    if c.direct >= 0.5:
        return "Intento vertical cortado"
    return "Circulación sin avance"


def name_clusters(cent: pd.DataFrame, P: pd.DataFrame, lab: pd.Series) -> dict[int, dict]:
    stats = P.assign(lab=lab.values).groupby("lab").agg(
        n=("poss", "size"), dur=("dur", "median"), passes=("n_pass", "median"),
        f3=("reach_f3", "mean"), box=("reach_box", "mean"), shot=("shot", "mean"), xg=("xg", "mean"),
        start_x=("start_x", "median"), max_x=("max_x", "median"), wide=("wide_share", "mean"), obv=("obv", "mean"))
    out, used = {}, {}
    for k, c in cent.iterrows():
        s = stats.loc[k]
        n = _rule(c)
        used[n] = used.get(n, 0) + 1
        if used[n] > 1:
            n = f"{n} ({used[n]})"
        out[int(k)] = {"nombre": n, "n": int(s.n), "dur_mediana": float(s.dur), "pases_mediana": float(s.passes),
                       "llega_ultimo_tercio": float(s.f3), "llega_area": float(s.box), "tiro": float(s.shot),
                       "xg_medio": float(s.xg), "obv_medio": float(s.obv), "inicio_x": float(s.start_x),
                       "max_x": float(s.max_x), "uso_banda": float(s.wide)}
    return out
