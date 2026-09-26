"""Prueba de Transferencia: ¿el estilo pertenece al DT o a su plantilla?

Para cada DT que dirigió >= 2 clubes (etapas con >= MIN_SPELL partidos):
  1. Se retira de la muestra la etapa del DT X en el club B.
  2. Se reajusta la descomposición sin esos partidos.
  3. Se compara el perfil medio de esos partidos (crudo, o ajustado = sin club/jugadores/
     rival/contexto) con el perfil medio de cada DT candidato (correlación entre vectores).
  4. Se registra en qué puesto queda X entre ~70 candidatos.
Si X queda arriba con jugadores distintos, el estilo es del DT. Azar: puesto (K+1)/2."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from pipeline.models import decomposition as dec

MIN_SPELL = 8
MIN_CLASS = 12


def match_vectors(seg: pd.DataFrame, F: dec.Fit, adjust: bool) -> pd.DataFrame:
    """Vector de estilo por (partido, equipo) en z. Ajustado = z − (club+jugadores+rival+contexto)."""
    Z, W, _ = dec.targets(seg, F.stats)
    cols = [c for c in Z.columns if c in F.coef.columns]
    Z, W = Z[cols], W[cols]
    if adjust:
        comps = dec.components(F, seg)
        for b in ["club", "player", "opp", "ctx"]:
            Z = Z - comps[b][Z.columns].values
    keys = seg[["match_id", "team_id"]]
    num = (Z.fillna(0) * W).groupby([keys.match_id, keys.team_id]).sum()
    den = W.groupby([keys.match_id, keys.team_id]).sum()
    V = (num / den.replace(0, np.nan))
    return V.fillna(0.0)


def spells(seg: pd.DataFrame) -> pd.DataFrame:
    s = seg.groupby(["coach_id", "club_id"]).agg(partidos=("match_id", "nunique"), desde=("date", "min"), hasta=("date", "max")).reset_index()
    return s


def _clf(Xtr, ytr, C=0.3):
    sc = StandardScaler().fit(Xtr)
    m = LogisticRegression(C=C, max_iter=2000).fit(sc.transform(Xtr), ytr)
    return sc, m


def _spell_rank(sc, m, Xte, true):
    P = m.predict_proba(sc.transform(Xte))
    lp = np.log(P + 1e-9).mean(axis=0)  # agrega partidos de la etapa
    order = m.classes_[np.argsort(-lp)]
    rank = int(np.where(order == true)[0][0]) + 1 if true in m.classes_ else None
    per_match_top1 = float((m.classes_[P.argmax(1)] == true).mean())
    probs = pd.Series(np.exp(lp) / np.exp(lp).sum(), index=m.classes_).sort_values(ascending=False)
    return rank, per_match_top1, probs


def run(seg: pd.DataFrame, lam=None, kpis=None, log=print, **_):
    """Para cada etapa oculta: perfil medio (crudo o ajustado) de sus partidos vs perfil medio
    de cada DT candidato en el resto de la liga; similitud = correlación entre vectores de
    indicadores. Se registra el puesto del DT verdadero. Azar: (K+1)/2."""
    from pipeline.features.style_kpis import BASE_KPIS
    kpis = kpis or BASE_KPIS
    sp_ = spells(seg)
    big = sp_[sp_.partidos >= MIN_SPELL]
    movers = big.groupby("coach_id").filter(lambda g: len(g) >= 2)
    counts = seg.groupby("coach_id").match_id.nunique()
    cands = counts[counts >= MIN_CLASS].index
    results = []
    for r in movers.itertuples():
        test_mask = (seg.coach_id == r.coach_id) & (seg.club_id == r.club_id)
        tr = seg[~test_mask]
        te = seg[test_mask].reset_index(drop=True)
        Ftr = dec.fit(tr, lam, kpis=kpis)
        Fte = dec.Fit(_design_like(te, Ftr), Ftr.coef, Ftr.stats, Ftr.lam)
        out = {"coach_id": r.coach_id, "club_id": r.club_id, "partidos": r.partidos}
        for mode in ["crudo", "ajustado"]:
            Vtr = match_vectors(tr, Ftr, adjust=(mode == "ajustado"))[kpis]
            Vte = match_vectors(te, Fte, adjust=(mode == "ajustado"))[kpis]
            y = tr.groupby(["match_id", "team_id"]).coach_id.first().reindex(Vtr.index)
            cent = Vtr.groupby(y.values).mean()
            cent = cent.loc[cent.index.isin(cands)]
            v = Vte.mean()
            sim = cent.apply(lambda c: np.corrcoef(c.values, v.values)[0, 1], axis=1).sort_values(ascending=False)
            out[f"rank_{mode}"] = int(np.where(sim.index == r.coach_id)[0][0]) + 1 if r.coach_id in sim.index else None
            out[f"prob_{mode}"] = float(sim.get(r.coach_id, np.nan))
            out[f"top5_{mode}"] = [(int(k), float(v_)) for k, v_ in sim.head(5).items()]
            out["n_clases"] = len(sim)
        out["rank_nulo_ajustado"] = (out["n_clases"] + 1) / 2
        if out["rank_ajustado"] is None:
            continue
        log(f"  transfer {r.coach_id}@{r.club_id}: puesto crudo={out['rank_crudo']} ajustado={out['rank_ajustado']} de {out['n_clases']}")
        results.append(out)
    return pd.DataFrame(results)


def summary(t: pd.DataFrame) -> dict:
    """Resumen con prueba de signo (¿el DT verdadero cae en la mitad superior más que el azar?)."""
    from scipy.stats import binomtest
    K = t.n_clases
    out = {"etapas": len(t)}
    for m in ["crudo", "ajustado"]:
        top_half = int((t[f"rank_{m}"] <= K / 2).sum())
        out[m] = {"mediana": float(t[f"rank_{m}"].median()), "top5": float((t[f"rank_{m}"] <= 5).mean()),
                  "top10": float((t[f"rank_{m}"] <= 10).mean()), "mitad_superior": top_half,
                  "p_signo": float(binomtest(top_half, len(t), 0.5, alternative="greater").pvalue)}
    out["azar"] = {"mediana": float(((K + 1) / 2).median()), "top5": float((5 / K).mean()), "top10": float((10 / K).mean())}
    out["ajustado_mejor_que_crudo"] = int((t.rank_ajustado < t.rank_crudo).sum())
    out["ajustado_igual"] = int((t.rank_ajustado == t.rank_crudo).sum())
    return out


def _design_like(te: pd.DataFrame, F: dec.Fit) -> dec.Design:
    """Diseño para filas nuevas con las columnas de un ajuste existente (columnas nuevas → 0)."""
    tmp = dec.build_design(te, min_player_minutes=0)
    import scipy.sparse as sp
    idx = F.coef.index
    pos = {c: i for i, c in enumerate(idx)}
    Xc = tmp.X.tocoo()
    rows, cols, vals = [], [], []
    for i, j, v in zip(Xc.row, Xc.col, Xc.data):
        key = tmp.cols[j]
        if key[0] == "player" and key not in pos:
            key = ("player", -1)
        if key in pos:
            rows.append(i); cols.append(pos[key]); vals.append(v)
    X = sp.csr_matrix((vals, (rows, cols)), shape=(len(te), len(idx)))
    blocks = np.array([c[0] if c[0] in ("coach", "club", "player", "opp") else "ctx" for c in idx])
    return dec.Design(X, list(idx), blocks, pos)


def identity_strength(seg: pd.DataFrame, F: dec.Fit, n_splits: int = 5, seed: int = 0) -> pd.DataFrame:
    """Consistencia (5.2): con validación cruzada por partido, ¿qué tan reconocible es cada DT
    en UN solo partido? Probabilidad media asignada al DT correcto / azar."""
    from sklearn.model_selection import GroupKFold
    V = match_vectors(seg, F, adjust=False)
    y = seg.groupby(["match_id", "team_id"]).coach_id.first().reindex(V.index)
    counts = y.value_counts()
    keep = y.isin(counts[counts >= MIN_CLASS].index).values
    Vk, yk = V.values[keep], y.values[keep]
    groups = np.array([i[0] for i in V.index])[keep]
    pr = np.zeros(len(yk))
    top1 = np.zeros(len(yk))
    for tr, te in GroupKFold(n_splits).split(Vk, yk, groups):
        sc, m = _clf(Vk[tr], yk[tr])
        P = m.predict_proba(sc.transform(Vk[te]))
        ci = {c: i for i, c in enumerate(m.classes_)}
        pr[te] = [P[r, ci[c]] if c in ci else 0 for r, c in enumerate(yk[te])]
        top1[te] = m.classes_[P.argmax(1)] == yk[te]
    k = len(np.unique(yk))
    df = pd.DataFrame({"coach_id": yk, "p": pr, "top1": top1})
    out = df.groupby("coach_id").agg(prob_media=("p", "mean"), acierto=("top1", "mean"), partidos=("p", "size"))
    out["lift"] = out.prob_media * k
    out.attrs["k"] = k
    return out
