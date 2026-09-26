"""Descomposición de Estilo: AKM (Abowd-Kramarz-Margolis 1999; Muehlheusser et al. 2018)
aplicado a vectores de estilo + ridge con jugadores en cancha (tipo RAPM, Macdonald 2011/2012).

Para cada KPI k y cada fila i = (segmento, equipo):

  z_ik = α_DT + φ_club + Σ_j β_j·exp_ij + γ_rival(temporada) + Σ δ·contexto + ε

z es el KPI estandarizado (media 0, sd 1 en la liga). La identificación de α_DT separada
de φ_club y de β viene de: (1) DTs que cambian de club, (2) clubes con varios DTs,
(3) rotación y sustituciones dentro del mandato de cada DT.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
import scipy.sparse as sp

from pipeline.features.style_kpis import COUNTERS, KPIS, kpis_from_counters
from pipeline.framework import CFG, segments_from_stints

BLOCKS = ["coach", "club", "player", "opp", "ctx"]
# penalización ridge por bloque, elegida por validación cruzada agrupada por partido
# (pipeline/models/tune.py; rejilla DT {5..1000} × jugadores {20..2000} × club {20,100}).
DEFAULT_LAMBDA = {"coach": 80.0, "club": 100.0, "player": 200.0, "opp": 10.0, "ctx": 1.0}
KPI_LIST = list(KPIS)


# ---------------------------------------------------------------- segmentos
def build_segments(stints: pd.DataFrame, matches: pd.DataFrame) -> pd.DataFrame:
    """Fusiona stints (< 5 min) en segmentos y calcula covariables ponderadas por tiempo."""
    stints = stints.sort_values(["match_id", "stint", "team_id"])
    seg_map = []
    for mid, g in stints[stints.home == 1].groupby("match_id", sort=False):
        s = segments_from_stints(g.reset_index(drop=True))
        seg_map.append(pd.DataFrame({"match_id": mid, "stint": g.stint.values, "seg": s.values}))
    seg_map = pd.concat(seg_map)
    df = stints.merge(seg_map, on=["match_id", "stint"])
    df["w_losing"] = (df.goal_diff < 0) * df.dur
    df["w_drawing"] = (df.goal_diff == 0) * df.dur
    df["w_winning"] = (df.goal_diff > 0) * df.dur
    df["w_manadv"] = (df.n_own - df.n_opp) * df.dur
    df["w_tmid"] = (df.t0 + df.t1) / 2 * df.dur
    keys = ["match_id", "seg", "team_id"]
    agg = df.groupby(keys).agg({**{c: "sum" for c in COUNTERS if c != "dur"}, "dur": "sum",
                                "w_losing": "sum", "w_drawing": "sum", "w_winning": "sum", "w_manadv": "sum",
                                "w_tmid": "sum", "opp_id": "first", "home": "first", "coach_id": "first",
                                "t0": "min", "t1": "max", "goal_diff": "mean"}).reset_index()
    # exposición de jugadores: fracción del segmento en cancha
    ex = df[["match_id", "seg", "team_id", "dur", "players"]].explode("players").dropna(subset=["players"])
    ex = ex.groupby(["match_id", "seg", "team_id", "players"]).dur.sum().reset_index()
    ex = ex.merge(agg[keys + ["dur"]].rename(columns={"dur": "segdur"}), on=keys)
    ex["exp"] = ex.dur / ex.segdur
    agg = agg.set_index(keys)
    agg["exposure"] = ex.groupby(keys).apply(lambda g: dict(zip(g.players.astype(int), g.exp))).reindex(agg.index)
    agg = agg.reset_index()
    for c in ["w_losing", "w_drawing", "w_winning", "w_manadv", "w_tmid"]:
        agg[c] = agg[c] / agg.dur
    m = matches.set_index("match_id")
    agg["season_id"] = agg.match_id.map(m.season_id)
    agg["date"] = agg.match_id.map(m.date)
    agg["club_id"] = agg.team_id
    agg["opp_key"] = agg.opp_id.astype(str) + "_" + agg.season_id.astype(str)
    agg = agg[agg.coach_id.notna()].reset_index(drop=True)
    agg["coach_id"] = agg.coach_id.astype(int)
    return agg


# ---------------------------------------------------------------- diseño
@dataclass
class Design:
    X: sp.csr_matrix
    cols: list
    block_of: np.ndarray
    index: dict = field(default_factory=dict)


def build_design(seg: pd.DataFrame, min_player_minutes: float = 270) -> Design:
    n = len(seg)
    cols, block, rows, cidx, vals = [], [], [], [], []
    index = {}

    def add_col(key, blk):
        index[key] = len(cols)
        cols.append(key)
        block.append(blk)
        return index[key]

    def onehot(series, blk, prefix):
        for i, v in enumerate(series.values):
            k = (prefix, v)
            j = index.get(k)
            if j is None:
                j = add_col(k, blk)
            rows.append(i); cidx.append(j); vals.append(1.0)

    onehot(seg.coach_id, "coach", "coach")
    onehot(seg.club_id, "club", "club")
    onehot(seg.opp_key, "opp", "opp")
    # jugadores con minutos suficientes; el resto se agrupa en "otros"
    pm = {}
    for e, d in zip(seg.exposure, seg.dur):
        for p, x in (e or {}).items():
            pm[p] = pm.get(p, 0) + x * d / 60
    keep = {p for p, m in pm.items() if m >= min_player_minutes}
    for i, e in enumerate(seg.exposure.values):
        for p, x in (e or {}).items():
            k = ("player", p if p in keep else -1)
            j = index.get(k)
            if j is None:
                j = add_col(k, "player")
            rows.append(i); cidx.append(j); vals.append(float(x))
    # contexto
    ctx = pd.DataFrame({
        "home": seg.home.astype(float),
        "losing": seg.w_losing, "winning": seg.w_winning,
        "manadv": seg.w_manadv.clip(-2, 2),
        "tmid": (seg.w_tmid / 5400.0).clip(0, 1.2),
        "tmid2": ((seg.w_tmid / 5400.0).clip(0, 1.2)) ** 2,
    })
    for c in ctx:
        j = add_col(("ctx", c), "ctx")
        for i, v in enumerate(ctx[c].values):
            if v != 0:
                rows.append(i); cidx.append(j); vals.append(float(v))
    j0 = add_col(("ctx", "intercept"), "ctx")
    for i in range(n):
        rows.append(i); cidx.append(j0); vals.append(1.0)
    X = sp.csr_matrix((vals, (rows, cidx)), shape=(n, len(cols)))
    return Design(X, cols, np.array(block), index)


# ---------------------------------------------------------------- objetivo
def targets(seg: pd.DataFrame, stats: dict | None = None):
    """KPI por segmento, estandarizado con media/sd ponderada de la liga, y pesos por fila.
    Si se pasan `stats` (de un ajuste previo) se usan esas constantes: así un conjunto de
    prueba se mide en la MISMA escala que el de entrenamiento."""
    K = kpis_from_counters(seg)
    Z, W, out = {}, {}, {}
    for k, (num, den, *_r) in KPIS.items():
        y = K[k]
        d = seg[den].astype(float)
        ok = y.notna() & np.isfinite(y) & (d > 0)
        if stats is None:
            med = float(d[d > 0].median())
            w = d / (d + med)  # peso creciente y acotado en la exposición
            lo, hi = np.nanpercentile(y[ok], [1, 99])  # winsorizar extremos
            yc = y.clip(lo, hi)
            mu = np.average(yc[ok], weights=w[ok])
            # escala: desviación estándar ENTRE equipos-temporada (no del ruido de segmento).
            # Así +1σ = "una desviación típica de la diferencia de estilo entre equipos".
            g = seg.team_id.astype(str) + "_" + seg.season_id.astype(str)
            tmp = pd.DataFrame({"g": g[ok], "y": yc[ok], "w": w[ok]})
            tmp["yw"] = tmp.y * tmp.w
            gm = tmp.groupby("g").agg(yw=("yw", "sum"), w=("w", "sum"))
            gm["m"] = gm.yw / gm.w
            sd = float(np.sqrt(np.average((gm.m - mu) ** 2, weights=gm.w)))
        else:
            st = stats[k]
            med, lo, hi, mu, sd = st["den_med"], st["lo"], st["hi"], st["mean"], st["sd"]
            w = d / (d + med)
            yc = y.clip(lo, hi)
        Z[k] = ((yc - mu) / sd).where(ok)
        W[k] = w.where(ok, 0.0)
        out[k] = {"mean": float(mu), "sd": float(sd), "lo": float(lo), "hi": float(hi), "den_med": med}
    return pd.DataFrame(Z), pd.DataFrame(W), out


def _solve(X, y, w, lam_vec):
    Xw = X.multiply(w[:, None]).tocsr() if sp.issparse(X) else X * w[:, None]
    A = (X.T @ Xw).toarray() + np.diag(lam_vec)
    b = X.T @ (w * y)
    return np.linalg.solve(A, np.asarray(b).ravel())


@dataclass
class Fit:
    design: Design
    coef: pd.DataFrame          # (columnas del diseño) x KPI
    stats: dict
    lam: dict
    se: pd.DataFrame | None = None


def fit(seg: pd.DataFrame, lam: dict | None = None, design: Design | None = None, kpis=None) -> Fit:
    lam = lam or DEFAULT_LAMBDA
    D = design or build_design(seg)
    Z, W, stats = targets(seg)
    lam_vec = np.array([lam[b] for b in D.block_of])
    lam_vec[D.index[("ctx", "intercept")]] = 1e-6
    kpis = kpis or list(KPIS)
    coefs = {}
    for k in kpis:
        y = Z[k].fillna(0).values
        w = W[k].values
        coefs[k] = _solve(D.X, y, w, lam_vec)
    return Fit(D, pd.DataFrame(coefs, index=pd.MultiIndex.from_tuples(D.cols)), stats, lam)


def components(F: Fit, seg: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Contribución de cada bloque a la predicción de cada fila (en unidades z)."""
    X = F.design.X
    if X.shape[0] != len(seg):  # subconjunto de las filas con las que se ajustó (índice original)
        X = X[seg.index.values]
    out = {}
    for b in BLOCKS:
        mask = (F.design.block_of == b).astype(float)
        out[b] = pd.DataFrame(X @ (F.coef.values * mask[:, None]), columns=F.coef.columns, index=seg.index)
    return out


def variance_shares(F: Fit, seg: pd.DataFrame) -> pd.DataFrame:
    """Parte de la varianza del estilo explicada por cada bloque: cov(comp, z)/var(z) (ponderado)."""
    Z, W, _ = targets(seg, F.stats)
    comps = components(F, seg)
    rows = {}
    for k in F.coef.columns:
        ok = Z[k].notna().values
        w = W[k].values[ok]
        z = Z[k].values[ok]
        vz = np.average((z - np.average(z, weights=w)) ** 2, weights=w)
        r = {}
        for b in BLOCKS:
            c = comps[b][k].values[ok]
            r[b] = np.average((c - np.average(c, weights=w)) * (z - np.average(z, weights=w)), weights=w) / vz
        r["residual"] = 1 - sum(r.values())
        rows[k] = r
    return pd.DataFrame(rows).T


def variance_shares_grouped(F: Fit, seg: pd.DataFrame, by=("team_id", "season_id")) -> pd.DataFrame:
    """¿Por qué difieren los equipos en estilo? Promedia observado y componentes por
    equipo-temporada (el ruido de segmento se promedia) y reparte cov(comp, obs)/var(obs)."""
    Z, W, _ = targets(seg, F.stats)
    comps = components(F, seg)
    keys = [seg[b] for b in by]
    rows = {}
    for k in F.coef.columns:
        w = W[k]
        tot = w.groupby(keys).sum()
        ok = tot > 0
        obs = (Z[k].fillna(0) * w).groupby(keys).sum()[ok] / tot[ok]
        r = {}
        vz = np.average((obs - np.average(obs, weights=tot[ok])) ** 2, weights=tot[ok])
        for b in BLOCKS:
            c = (comps[b][k] * w).groupby(keys).sum()[ok] / tot[ok]
            r[b] = float(np.average((c - np.average(c, weights=tot[ok])) * (obs - np.average(obs, weights=tot[ok])), weights=tot[ok]) / vz)
        r["residual"] = 1 - sum(r.values())
        rows[k] = r
    return pd.DataFrame(rows).T


def coach_table(F: Fit) -> pd.DataFrame:
    idx = [c for c in F.coef.index if c[0] == "coach"]
    t = F.coef.loc[idx].copy()
    t.index = [c[1] for c in idx]
    return t


def attribution(F: Fit, seg: pd.DataFrame, rows_mask) -> pd.DataFrame:
    """Para un subconjunto de filas (p.ej. partidos de un DT): media observada (z) y
    cuánto aporta cada bloque. Responde '¿de dónde sale el perfil crudo?'."""
    Z, W, _ = targets(seg, F.stats)
    comps = components(F, seg)
    res = {}
    for k in F.coef.columns:
        m = rows_mask & Z[k].notna()
        w = W[k][m]
        if w.sum() == 0:
            continue
        r = {"observado": np.average(Z[k][m], weights=w)}
        for b in BLOCKS:
            c = comps[b][k][m]
            r[b] = np.average(c, weights=w)
        # el intercepto es ~0 por construcción; lo reportamos dentro de contexto
        r["residual"] = r["observado"] - sum(r[b] for b in BLOCKS)
        res[k] = r
    return pd.DataFrame(res).T


# ---------------------------------------------------------------- incertidumbre
def bootstrap_coach(seg: pd.DataFrame, D: Design, lam: dict, n_boot: int = 40, seed: int = 0) -> pd.DataFrame:
    """SE de α_DT por bootstrap por conglomerados (partido)."""
    rng = np.random.default_rng(seed)
    Z, W, _ = targets(seg)
    lam_vec = np.array([lam[b] for b in D.block_of])
    lam_vec[D.index[("ctx", "intercept")]] = 1e-6
    coach_cols = [j for j, c in enumerate(D.cols) if c[0] == "coach"]
    mids = seg.match_id.values
    um = np.unique(mids)
    pos = {m: np.where(mids == m)[0] for m in um}
    draws = []
    for b in range(n_boot):
        pick = rng.choice(um, len(um), replace=True)
        cnt = pd.Series(pick).value_counts()
        mult = np.zeros(len(seg))
        for m, c in cnt.items():
            mult[pos[m]] = c
        res = {}
        Xt = D.X.T
        for k in Z.columns:
            w = W[k].values * mult
            y = Z[k].fillna(0).values
            A = (Xt @ D.X.multiply(w[:, None]).tocsr()).toarray() + np.diag(lam_vec)
            beta = np.linalg.solve(A, np.asarray(Xt @ (w * y)).ravel())
            res[k] = beta[coach_cols]
        draws.append(pd.DataFrame(res, index=[D.cols[j][1] for j in coach_cols]))
    arr = np.stack([d.values for d in draws])
    return pd.DataFrame(arr.std(axis=0, ddof=1), index=draws[0].index, columns=draws[0].columns)


# ---------------------------------------------------------------- identificabilidad
def identifiability(seg: pd.DataFrame) -> pd.DataFrame:
    """Qué tan separable es cada DT de su plantilla y su club.
    - movilidad: nº de clubes dirigidos
    - conectividad: % de los minutos-jugador del DT jugados por jugadores que suman
      >= 450 min con OTRO DT (comparación mismo jugador, distinto DT)
    - club_compartido: % de minutos del DT en clubes que tuvieron otros DTs en la muestra"""
    ex = seg[["coach_id", "club_id", "dur", "exposure"]].copy()
    ex["exposure"] = ex.exposure.map(lambda d: list((d or {}).items()))
    ex = ex.explode("exposure").dropna(subset=["exposure"])
    ex["player"] = ex.exposure.map(lambda t: t[0])
    ex["min"] = ex.exposure.map(lambda t: t[1]) * ex.dur / 60
    pc = ex.groupby(["player", "coach_id"])["min"].sum().reset_index()
    tot = pc.groupby("player")["min"].sum()
    pc["other"] = pc.player.map(tot) - pc["min"]
    pc["connected"] = pc.other >= 450
    conn = pc.groupby("coach_id").apply(lambda g: np.average(g.connected, weights=g["min"]))
    cc = seg.groupby("club_id").coach_id.nunique()
    sh = seg.assign(shared=seg.club_id.map(cc) > 1).groupby("coach_id").apply(lambda g: np.average(g.shared, weights=g.dur))
    mob = seg.groupby("coach_id").club_id.nunique()
    nmatch = seg.groupby("coach_id").match_id.nunique()
    out = pd.DataFrame({"movilidad": mob, "conectividad": conn, "club_compartido": sh, "partidos": nmatch})
    # índice 0-100: combina movilidad (cap 3 clubes), conectividad y club compartido
    out["indice"] = 100 * (0.35 * (out.movilidad.clip(upper=3) - 1) / 2 + 0.4 * out.conectividad + 0.25 * out.club_compartido)
    return out
