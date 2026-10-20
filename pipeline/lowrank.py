"""Huella latente: encogimiento empírico-bayesiano multitarea sobre la huella del DT.

El ridge estima la huella α de cada DT indicador por indicador. Cuando un rasgo está mal
separado de la plantilla (DT y jugadores casi siempre juntos), su error es grande y el ridge
lo encoge hacia la media de la liga. Pero los rasgos de estilo están correlacionados entre sí
(quien presiona alto también recupera arriba y deja menos pases al rival), así que lo que el
DT muestra en los rasgos que SÍ están bien identificados dice algo de los que no.

Modelo jerárquico (análisis factorial heterocedástico):
    α_c  ~ N(0, Σ),   Σ = Λ Λᵀ + Ψ   (Λ: K×r, r factores de estilo; Ψ diagonal)
    α̂_c | α_c ~ N(α_c, S_c),          S_c = diag(EE_ck²)   (error conocido por DT y rasgo)
Σ se estima por EM con todos los DTs; la huella final es la media a posteriori
    E[α_c | α̂_c] = Σ (Σ + S_c)⁻¹ α̂_c,
que mezcla cada rasgo con los demás según cuánto se parecen (Σ) y cuánto se sabe de cada uno
para ese DT (S_c). r = 0 es el encogimiento univariado (sin compartir entre rasgos).

Prueba (sin tocar el modelo publicado): partidos al azar en dos mitades A y B; se ajusta el ridge
en cada una; el ruido de A se mide partiendo A otra vez en dos (A1, A2) y Σ se aprende SOLO con A.
Se mide qué tan bien la huella de A predice la de B (correlación por rasgo entre DTs con ≥ 10
partidos en ambas), frente al ridge solo y al encogimiento univariado (r = 0).

Salida: web/public/data/lowrank.json (agregados)
Uso: python -m pipeline.lowrank [--splits 4]
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.features.style_kpis import BASE_KPIS
from pipeline.fitcache import load
from pipeline.models import decomposition as dec

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "data" / "lowrank.json"
RANKS = [0, 1, 2, 3, 4, 6, 8]


def r4(v):
    return None if v is None or not np.isfinite(v) else round(float(v), 4)


def fit_sigma(A, S2, r, iters=200, tol=1e-7):
    """EM para Σ = ΛΛᵀ + Ψ con ruido de medición conocido. A: C×K, S2: C×K (varianzas)."""
    C, K = A.shape
    Sig = np.diag(np.maximum(A.var(0) - S2.mean(0), 1e-3))
    prev = None
    for _ in range(iters):
        M = np.zeros_like(A)
        acc = np.zeros((K, K))
        for c in range(C):
            Si = np.diag(1 / S2[c])
            V = np.linalg.inv(np.linalg.inv(Sig) + Si)
            m = V @ (Si @ A[c])
            M[c] = m
            acc += np.outer(m, m) + V
        St = acc / C
        if r == 0:
            Sig = np.diag(np.diag(St))
        else:
            # FA de un paso sobre St: Λ de los r vectores propios, Ψ = diag residual
            psi = np.diag(Sig).copy() if r > 0 else None
            for _ in range(20):
                Dh = 1 / np.sqrt(psi)
                w, U = np.linalg.eigh((St * Dh[:, None]) * Dh[None, :])
                w, U = w[::-1][:r], U[:, ::-1][:, :r]
                L = (U * np.sqrt(np.maximum(w - 1, 0))) / Dh[:, None]
                psi = np.maximum(np.diag(St - L @ L.T), 1e-4)
            Sig = L @ L.T + np.diag(psi)
        if prev is not None and np.abs(Sig - prev).max() < tol:
            break
        prev = Sig.copy()
    return Sig


def posterior(A, S2, Sig):
    out = np.zeros_like(A)
    for c in range(A.shape[0]):
        out[c] = Sig @ np.linalg.solve(Sig + np.diag(S2[c]), A[c])
    return out


def noise_from_halves(x1, x2, n):
    """Varianza del ruido de α̂ con n_c partidos, medida con dos submuestras disjuntas:
    var(α̂₁ − α̂₂) ≈ 4·σ²(n̄) si cada submuestra tiene la mitad de partidos, y σ²_c ∝ 1/n_c."""
    d = x1 - x2
    v = (d ** 2 * (n[:, None] / n.mean())).mean(0) / 4
    return v[None, :] * (n.mean() / n)[:, None]


def split_test(seg, F, n_splits=4, seed=5, log=print):
    rng = np.random.default_rng(seed)
    um = seg.match_id.unique()
    ks = list(BASE_KPIS)
    ident = dec.identifiability(seg).indice
    keys = ["ridge"] + RANKS
    res, res_lo, res_hi = ({r: [] for r in keys} for _ in range(3))
    gk = {k: [] for k in ks}
    nr = {k: [] for k in ks}
    t = time.time()
    for s in range(n_splits):
        half = set(rng.choice(um, len(um) // 2, replace=False))
        ma = seg.match_id.isin(half).values
        A_, B_ = seg[ma].reset_index(drop=True), seg[~ma].reset_index(drop=True)
        uA = A_.match_id.unique()
        q = set(rng.choice(uA, len(uA) // 2, replace=False))
        m2 = A_.match_id.isin(q).values
        aA, aB, a1, a2 = (dec.coach_table(dec.fit(x, F.lam, kpis=ks)) for x in
                          (A_, B_, A_[m2].reset_index(drop=True), A_[~m2].reset_index(drop=True)))
        nA, nB = A_.groupby("coach_id").match_id.nunique(), B_.groupby("coach_id").match_id.nunique()
        cs = [c for c in aA.index.intersection(aB.index).intersection(a1.index).intersection(a2.index)
              if nA.get(c, 0) >= 10 and nB.get(c, 0) >= 10]
        Aa, Bb = aA.loc[cs, ks].values, aB.loc[cs, ks].values
        S2 = noise_from_halves(a1.loc[cs, ks].values, a2.loc[cs, ks].values, nA.loc[cs].values.astype(float))
        lo = np.array([ident.get(c, 0) < 80 for c in cs])
        corr = lambda P, m, j: np.corrcoef(P[m, j], Bb[m, j])[0, 1]
        score = lambda P, m: float(np.mean([corr(P, m, j) for j in range(len(ks))]))
        al = np.ones(len(cs), bool)
        for r in keys:
            P = Aa if r == "ridge" else posterior(Aa, S2, fit_sigma(Aa, S2, r))
            res[r].append(score(P, al)); res_lo[r].append(score(P, lo)); res_hi[r].append(score(P, ~lo))
            if r == 2:
                for j, k in enumerate(ks):
                    gk[k].append(corr(P, al, j) - corr(Aa, al, j))
                    nr[k].append(S2[:, j].mean() / max(Aa[:, j].var(), 1e-9))
        log(f"  mitad {s + 1}/{n_splits} · {len(cs)} DTs · {time.time() - t:.0f}s · " + " ".join(f"{r}:{res[r][-1]:.3f}" for r in keys))
    m = lambda v: r4(np.mean(v))
    g = {k: m(v) for k, v in gk.items()}
    rr = {k: m(v) for k, v in nr.items()}
    kk = [k for k in ks if g[k] is not None and rr[k] is not None]
    return {"dts": len(cs), "kpis": len(ks), "splits": n_splits,
            "todos": {str(r): m(v) for r, v in res.items()},
            "baja_ident": {str(r): m(v) for r, v in res_lo.items()},
            "alta_ident": {str(r): m(v) for r, v in res_hi.items()},
            "mejora_en_cada_particion": {str(r): int(sum(a > b for a, b in zip(res[r], res["ridge"]))) for r in RANKS},
            "ganancia_por_kpi_r2": g, "ruido_senal_por_kpi": rr,
            "corr_ganancia_ruido": r4(np.corrcoef([g[k] for k in kk], [rr[k] for k in kk])[0, 1])}


def apply_full(seg, F, r, seed=7):
    """Huella latente de carrera: ruido medido con dos mitades de la carrera."""
    ks = list(BASE_KPIS)
    rng = np.random.default_rng(seed)
    um = seg.match_id.unique()
    half = set(rng.choice(um, len(um) // 2, replace=False))
    ma = seg.match_id.isin(half).values
    a1, a2 = (dec.coach_table(dec.fit(x.reset_index(drop=True), F.lam, kpis=ks)) for x in (seg[ma], seg[~ma]))
    al = dec.coach_table(F)
    n = seg.groupby("coach_id").match_id.nunique()
    cs = [c for c in al.index.intersection(a1.index).intersection(a2.index) if n.get(c, 0) >= 10]
    A = al.loc[cs, ks].values
    # las mitades tienen la mitad de partidos: σ²(carrera) = σ²(mitad)/2
    S2 = noise_from_halves(a1.loc[cs, ks].values, a2.loc[cs, ks].values, n.loc[cs].values.astype(float) / 2) / 2
    Sig = fit_sigma(A, S2, r)
    P = posterior(A, S2, Sig)
    w, U = np.linalg.eigh(Sig)
    expl = float(w[::-1][:r].sum() / w.sum()) if r else 0.0
    load_ = {f"f{i + 1}": sorted([(k, r4(U[j, ::-1][i] * np.sqrt(w[::-1][i]))) for j, k in enumerate(ks)], key=lambda t: -abs(t[1]))[:6] for i in range(r)}
    i = cs.index(2947) if 2947 in cs else None
    alm = None
    if i is not None:
        alm = sorted([{"kpi": k, "ridge": r4(A[i, j]), "latente": r4(P[i, j]), "ee": r4(np.sqrt(S2[i, j]))} for j, k in enumerate(ks)],
                     key=lambda d: -abs(d["latente"] - d["ridge"]))[:8]
    return {"rango": r, "dts": len(cs), "varianza_factores": r4(expl), "cargas": load_, "almada": alm,
            "corr_ridge_latente": r4(np.corrcoef(A.ravel(), P.ravel())[0, 1])}


def main(n_splits=4):
    t = time.time()
    C = load()
    seg, F = C["seg"], C["F"]
    out = {"generado": time.strftime("%Y-%m-%d %H:%M"), "rangos": RANKS}
    out["mitad"] = split_test(seg, F, n_splits)
    best = max(RANKS, key=lambda r: out["mitad"]["todos"][str(r)])
    out["rango_elegido"] = best
    out["carrera"] = apply_full(seg, F, best)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"lowrank listo en {time.time() - t:.0f}s · rango {best} · {json.dumps(out['mitad']['todos'])}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--splits", type=int, default=4)
    main(ap.parse_args().splits)
