"""¿Funciona el método? (5.5 / 5.6) Cuatro pruebas que NO tocan el modelo publicado.

1) Recuperación sintética. Sobre el MISMO diseño real (qué DT, club, rival y jugadores hubo en
   cada segmento, con sus pesos) se «plantan» efectos conocidos y ruido con la forma del real;
   se vuelve a ajustar con las mismas λ y se compara α estimada con α plantada.
   Escenarios: (a) realista, (b) plantilla a la medida: los jugadores empujan en la misma
   dirección que el DT con el que más juegan (el caso difícil: el DT elige jugadores como él),
   (c) sin DT: α = 0 pero jugadores a la medida (¿inventa un DT que no existe?).
   Se compara con el perfil ingenuo (promedio crudo de sus partidos) y con DT+club sin jugadores.
   Cobertura: % de α plantadas dentro de α ± 1.96·EE (EE por bootstrap por partido).
2) Confiabilidad mitad/mitad: partidos repartidos al azar en dos mitades, se ajusta cada una y
   se correlaciona α entre mitades (DTs con >= 20 partidos), corregida con Spearman-Brown.
3) Fuera de muestra: validación cruzada por partido; R² del estilo de cada partido con y sin
   el bloque del DT (cuánto ayuda saber quién es el entrenador).
4) Mapa de estilos: silueta para K = 2..8 y estabilidad del agrupamiento (ARI por bootstrap).

Salida: web/public/data/validacion.json (agregados, sin datos crudos)
Uso: .venv/bin/python -m pipeline.validation [--reps 30]
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.features.style_kpis import BASE_KPIS, KPIS
from pipeline.fitcache import load
from pipeline.models import decomposition as dec

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "data" / "validacion.json"
DEMO_KPIS = ["posesion", "altura_presion", "verticalidad", "linea_360", "progresion_banda", "contraataque"]


def r4(v):
    return None if v is None or not np.isfinite(v) else round(float(v), 4)


class Solver:
    """Ridge con el diseño real; cachea X'WX por vector de pesos."""

    def __init__(self, D: dec.Design, lam: dict):
        self.D = D
        self.lam = np.array([lam[b] for b in D.block_of], float)
        self.lam[D.index[("ctx", "intercept")]] = 1e-6
        self.Xt = D.X.T.tocsr()
        self._A = {}

    def A(self, w, key=None, lam=None):
        if key is not None and key in self._A and lam is None:
            return self._A[key]
        A = (self.Xt @ self.D.X.multiply(w[:, None]).tocsr()).toarray()
        if key is not None and lam is None:
            self._A[key] = A
        return A

    def solve(self, y, w, key=None, lam=None):
        A = self.A(w, key) + np.diag(self.lam if lam is None else lam)
        return np.linalg.solve(A, np.asarray(self.Xt @ (w * y)).ravel())


def cols_of(D, blk):
    return np.array([j for j, c in enumerate(D.cols) if c[0] == blk])


def main_coach_of_players(seg: pd.DataFrame) -> dict:
    ex = seg[["coach_id", "dur", "exposure"]].copy()
    ex["exposure"] = ex.exposure.map(lambda d: list((d or {}).items()))
    ex = ex.explode("exposure").dropna(subset=["exposure"])
    ex["p"] = ex.exposure.map(lambda t: t[0])
    ex["m"] = ex.exposure.map(lambda t: t[1]) * ex.dur
    g = ex.groupby(["p", "coach_id"]).m.sum().reset_index().sort_values("m").drop_duplicates("p", keep="last")
    return dict(zip(g.p, g.coach_id))


# ---------------------------------------------------------------- 1) sintético
def synthetic(seg, F, reps=30, seed=0, log=print):
    D = F.design
    S = Solver(D, F.lam)
    Z, W, _ = dec.targets(seg, F.stats)
    rng = np.random.default_rng(seed)
    cc, fc, pc, oc = (cols_of(D, b) for b in ("coach", "club", "player", "opp"))
    xc = cols_of(D, "ctx")
    coach_ids = np.array([D.cols[j][1] for j in cc])
    pid = np.array([D.cols[j][1] for j in pc])
    mc = main_coach_of_players(seg)
    p_coach = np.array([mc.get(p, -999) for p in pid])
    cpos = {c: i for i, c in enumerate(coach_ids)}
    # magnitudes como las reales (promedio de los 34 KPI): sd de los coeficientes ajustados,
    # inflada por 1.4 porque el ridge los encoge; ruido = residuos reales permutados por peso.
    mad = lambda v: 1.4826 * np.median(np.abs(v - np.median(v)))
    sd = {b: float(np.mean([mad(F.coef.loc[[D.cols[j] for j in idx], k].values) for k in BASE_KPIS])) * 1.4
          for b, idx in (("coach", cc), ("club", fc), ("player", pc), ("opp", oc))}
    nmatch = seg.groupby("coach_id").match_id.nunique().reindex(coach_ids).values
    ident = dec.identifiability(seg).reindex(coach_ids).indice.values
    keep = nmatch >= 10
    # naive: perfil crudo = promedio ponderado del z observado en sus segmentos
    rows_of = {c: np.where(seg.coach_id.values == c)[0] for c in coach_ids}
    # DT + club sin jugadores (FE clásico): λ de jugadores enorme
    lam_nop = S.lam.copy()
    lam_nop[pc] = 1e9
    res = {s: {"modelo": [], "ingenuo": [], "sin_jug": [], "pend": [], "alto": [], "bajo": [], "sd_falso": [], "sd_ingenuo": []} for s in ("realista", "a_medida", "sin_dt")}
    cover, signo, nflag = [], [], []
    t = time.time()
    for rep in range(reps):
        k = DEMO_KPIS[rep % len(DEMO_KPIS)]
        w = W[k].values
        ok = Z[k].notna().values
        beta_real = F.coef[k].values
        fit_real = D.X @ beta_real
        e = (Z[k].fillna(0).values - fit_real)
        # permutación de residuos dentro de deciles de peso (conserva heterocedasticidad)
        dec_w = pd.qcut(pd.Series(w).rank(method="first"), 10, labels=False).values
        eps = e.copy()
        for q in range(10):
            ii = np.where((dec_w == q) & ok)[0]
            eps[ii] = e[rng.permutation(ii)]
        for scen in ("realista", "a_medida", "sin_dt"):
            b = np.zeros(D.X.shape[1])
            b[xc] = beta_real[xc]
            a_true = rng.normal(0, sd["coach"], len(cc))
            if scen == "sin_dt":
                a_true[:] = 0
            b[cc] = a_true
            b[fc] = rng.normal(0, sd["club"], len(fc))
            b[oc] = rng.normal(0, sd["opp"], len(oc))
            bp = rng.normal(0, sd["player"], len(pc))
            if scen in ("a_medida", "sin_dt"):
                # el jugador empuja en la dirección del «estilo» de su DT principal (corr ≈ 0.6):
                # en «a_medida» es el estilo real del DT; en «sin_dt» un estilo falso (el DT no aporta nada)
                src = a_true if scen == "a_medida" else rng.normal(0, sd["coach"], len(cc))
                drive = np.array([src[cpos[c]] if c in cpos else 0.0 for c in p_coach])
                bp = 0.6 * drive / max(sd["coach"], 1e-9) * sd["player"] * 1.2 + 0.8 * bp
            b[pc] = bp
            y = np.where(ok, D.X @ b + eps, 0.0)
            est = S.solve(y, w, key=k)[cc]
            est_np = S.solve(y, w, lam=lam_nop)[cc]
            naive = np.array([np.average(y[rows_of[c]], weights=w[rows_of[c]]) if w[rows_of[c]].sum() > 0 else 0 for c in coach_ids])
            R = res[scen]
            if scen == "sin_dt":
                R["sd_falso"].append(float(est[keep].std()))
                R["sd_ingenuo"].append(float(naive[keep].std()))
                R["sd_sin_jug"] = R.get("sd_sin_jug", []) + [float(est_np[keep].std())]
                continue
            cor = lambda a: float(np.corrcoef(a[keep], a_true[keep])[0, 1])
            R["modelo"].append(cor(est)); R["ingenuo"].append(cor(naive)); R["sin_jug"].append(cor(est_np))
            R["pend"].append(float(np.polyfit(a_true[keep], est[keep], 1)[0]))
            hi, lo = keep & (ident >= 60), keep & (ident < 60)
            R["alto"].append(float(np.corrcoef(est[hi], a_true[hi])[0, 1])); R["bajo"].append(float(np.corrcoef(est[lo], a_true[lo])[0, 1]))
            if scen == "realista" and rep < 6:  # cobertura con EE por bootstrap por partido (caro: sólo 6 réplicas)
                se = boot_se(S, seg, y, w, cc, rng, n=25)
                inside = np.abs(est - a_true) <= 1.96 * se
                cover.append(float(inside[keep].mean()))
                flag = keep & (np.abs(est) > 1.96 * se)
                if flag.any():
                    signo.append(float((np.sign(est[flag]) == np.sign(a_true[flag])).mean()))
                    nflag.append(float(flag.sum() / keep.sum()))
        if rep % 5 == 4:
            log(f"  sintético {rep + 1}/{reps} · {time.time() - t:.0f}s")
    summ = lambda v: {"media": r4(np.mean(v)), "p05": r4(np.percentile(v, 5)), "p95": r4(np.percentile(v, 95))} if v else None
    out = {}
    for s, R in res.items():
        out[s] = {k: summ(v) for k, v in R.items() if isinstance(v, list) and v}
    out["cobertura_95"] = summ(cover)
    out["signo_significativos"] = summ(signo)
    out["share_significativos"] = summ(nflag)
    out["magnitudes"] = {k: r4(v) for k, v in sd.items()}
    out["reps"] = reps
    out["dts"] = int(keep.sum())
    return out


def boot_se(S: Solver, seg, y, w, cc, rng, n=25):
    mids = seg.match_id.values
    um, inv = np.unique(mids, return_inverse=True)
    draws = []
    for _ in range(n):
        cnt = np.bincount(rng.integers(0, len(um), len(um)), minlength=len(um))
        ww = w * cnt[inv]
        draws.append(S.solve(y, ww)[cc])
    return np.std(draws, axis=0, ddof=1)


# ---------------------------------------------------------------- 2) mitad / mitad
def split_half(seg, F, n_splits=4, seed=1, log=print):
    rng = np.random.default_rng(seed)
    um = seg.match_id.unique()
    per = {k: [] for k in BASE_KPIS}
    per_raw = {k: [] for k in BASE_KPIS}
    t = time.time()
    for s in range(n_splits):
        half = set(rng.choice(um, len(um) // 2, replace=False))
        ma = seg.match_id.isin(half).values
        A_, B_ = seg[ma].reset_index(drop=True), seg[~ma].reset_index(drop=True)
        FA, FB = dec.fit(A_, F.lam, kpis=list(BASE_KPIS)), dec.fit(B_, F.lam, kpis=list(BASE_KPIS))
        aA, aB = dec.coach_table(FA), dec.coach_table(FB)
        nA, nB = A_.groupby("coach_id").match_id.nunique(), B_.groupby("coach_id").match_id.nunique()
        ok = [c for c in aA.index.intersection(aB.index) if nA.get(c, 0) >= 10 and nB.get(c, 0) >= 10]
        ZA, WA, _ = dec.targets(A_, F.stats)
        ZB, WB, _ = dec.targets(B_, F.stats)
        for k in BASE_KPIS:
            r = np.corrcoef(aA.loc[ok, k], aB.loc[ok, k])[0, 1]
            per[k].append(r)
            raw = lambda Zx, Wx, df: pd.Series({c: np.average(Zx[k][df.coach_id == c].fillna(0), weights=Wx[k][df.coach_id == c] + 1e-12) for c in ok})
            per_raw[k].append(np.corrcoef(raw(ZA, WA, A_), raw(ZB, WB, B_))[0, 1])
        log(f"  mitad/mitad {s + 1}/{n_splits} · {len(ok)} DTs · {time.time() - t:.0f}s")
    sb = lambda r: 2 * r / (1 + r) if r > -1 else r
    out = {}
    for k in BASE_KPIS:
        r, rr = float(np.mean(per[k])), float(np.mean(per_raw[k]))
        out[k] = {"r": r4(r), "confiabilidad": r4(sb(r)), "crudo": r4(sb(rr)), "etiqueta": KPIS[k][3], "familia": KPIS[k][4]}
    return out


# ---------------------------------------------------------------- 3) fuera de muestra
def out_of_sample(seg, F, folds=5, seed=2, log=print):
    from sklearn.model_selection import GroupKFold
    D = F.design
    Z, W, _ = dec.targets(seg, F.stats)
    cc, pc = cols_of(D, "coach"), cols_of(D, "player")
    keys = seg.match_id.astype(str) + "_" + seg.team_id.astype(str)
    variants = {"completo": None, "sin_dt": cc, "sin_jugadores": pc}
    acc = {v: {k: [] for k in BASE_KPIS} for v in variants}
    accm = {v: {k: [] for k in BASE_KPIS} for v in variants}
    movers = set(seg.groupby("coach_id").club_id.nunique().loc[lambda s_: s_ >= 2].index)
    is_mov = seg.coach_id.isin(movers).values
    S = Solver(D, F.lam)
    t = time.time()
    for fi, (tr, te) in enumerate(GroupKFold(folds).split(seg, groups=seg.match_id)):
        mtr = np.zeros(len(seg)); mtr[tr] = 1
        for k in BASE_KPIS:
            y = Z[k].fillna(0).values
            w = W[k].values
            wtr = w * mtr
            A0 = (S.Xt @ D.X.multiply(wtr[:, None]).tocsr()).toarray()
            b0 = np.asarray(S.Xt @ (wtr * y)).ravel()
            for v, drop in variants.items():
                lam = S.lam.copy()
                if drop is not None:
                    lam[drop] = 1e9
                beta = np.linalg.solve(A0 + np.diag(lam), b0)
                pred = D.X[te] @ beta
                # nivel partido: promedio ponderado por equipo-partido
                for sel, store in ((np.ones(len(te), bool), acc), (is_mov[te], accm)):
                    d = pd.DataFrame({"g": keys.values[te][sel], "y": (y[te] * w[te])[sel], "p": (pred * w[te])[sel], "w": w[te][sel]}).groupby("g").sum()
                    d = d[d.w > 0]
                    yy, pp = d.y / d.w, d.p / d.w
                    store[v][k].append(1 - np.average((yy - pp) ** 2, weights=d.w) / np.average((yy - np.average(yy, weights=d.w)) ** 2, weights=d.w))
        log(f"  fuera de muestra {fi + 1}/{folds} · {time.time() - t:.0f}s")
    out = {"por_kpi": {k: {v: r4(np.mean(acc[v][k])) for v in variants} for k in BASE_KPIS}}
    out["media"] = {v: r4(np.mean([np.mean(acc[v][k]) for k in BASE_KPIS])) for v in variants}
    out["media_movers"] = {v: r4(np.mean([np.mean(accm[v][k]) for k in BASE_KPIS])) for v in variants}
    return out


# ---------------------------------------------------------------- 4) mapa
def map_stability(n_boot=200, seed=3):
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    from sklearn.metrics import adjusted_rand_score, silhouette_score
    mp = json.load(open(ROOT / "artifacts" / "mapa.json"))
    ks = mp["kpis"]
    X = np.array([[p["alpha"].get(k, 0) for k in ks] for p in mp["puntos"]])
    X = (X - X.mean(0)) / (X.std(0) + 1e-9)
    P2 = PCA(2, random_state=0).fit_transform(X)
    sil = {}
    for K in range(2, 9):
        lab = KMeans(K, n_init=20, random_state=0).fit_predict(P2)
        sil[K] = r4(silhouette_score(P2, lab))
    K0 = mp.get("k", 4)
    base = KMeans(K0, n_init=20, random_state=0).fit_predict(P2)
    rng = np.random.default_rng(seed)
    aris = []
    for _ in range(n_boot):
        ii = rng.choice(len(P2), len(P2), replace=True)
        lab = KMeans(K0, n_init=10, random_state=int(rng.integers(1e6))).fit(P2[ii]).predict(P2)
        aris.append(adjusted_rand_score(base, lab))
    # referencia: silueta de datos sin estructura (gaussiana con la misma covarianza)
    null = []
    C = np.cov(P2.T)
    for _ in range(50):
        Q = rng.multivariate_normal([0, 0], C, len(P2))
        null.append(silhouette_score(Q, KMeans(K0, n_init=10, random_state=0).fit_predict(Q)))
    return {"silueta": sil, "k": K0, "ari": {"media": r4(np.mean(aris)), "p05": r4(np.percentile(aris, 5)), "p95": r4(np.percentile(aris, 95))},
            "silueta_nula": {"media": r4(np.mean(null)), "p95": r4(np.percentile(null, 95))}, "dts": len(P2)}


def main(reps=30):
    t = time.time()
    log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)
    C = load()
    seg, F = C["seg"], C["F"]
    out = {"generado": time.strftime("%Y-%m-%d %H:%M")}
    log("mapa"); out["mapa"] = map_stability()
    log("sintético"); out["sintetico"] = synthetic(seg, F, reps=reps, log=log)
    json.dump(out, open(OUT, "w"), ensure_ascii=False)
    log("mitad/mitad"); out["confiabilidad"] = split_half(seg, F, log=log)
    json.dump(out, open(OUT, "w"), ensure_ascii=False)
    log("fuera de muestra"); out["fuera_muestra"] = out_of_sample(seg, F, log=log)
    tp = ROOT / "artifacts" / "transplant.json"
    if tp.exists():
        tj = json.load(open(tp))
        out["trasplante"] = {"n_eventos": tj.get("n_eventos"), "crudo": tj.get("crudo_todos"), "coef": tj.get("coef_crudo"),
                             "placebo_tiempo": {k: v for k, v in (tj.get("placebo_tiempo") or {}).items() if k != "hist"}}
    json.dump(out, open(OUT, "w"), ensure_ascii=False)
    log(f"validacion.json listo · {time.time() - t:.0f}s")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reps", type=int, default=30)
    main(ap.parse_args().reps)
