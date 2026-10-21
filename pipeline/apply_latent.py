"""Aplica la huella latente (pipeline/lowrank.py) al modelo publicado.

Toma el ajuste ridge publicado (mismos datos y λ; cache de pipeline/fitcache.py) y reemplaza la
huella α de los 34 indicadores base de cada DT por su media a posteriori
    E[α_c | α̂_c] = Σ (Σ + S_c)⁻¹ α̂_c ,   Σ = ΛΛᵀ + Ψ  (2 factores, EM),
con el ruido S_c medido comparando dos mitades disjuntas de los partidos.

Qué cambia en artifacts/:
  dt_<id>.json  huella[k].alpha, .pct, .ajustado_valor (indicadores base) y atribucion[k].coach/.residual;
                se guarda alpha_ridge al lado. El EE se deja el del bootstrap del ridge (conservador).
  global.json   varianza / varianza_media de los indicadores base y "huella": {"metodo": "latente", ...}.
Los indicadores de tipos de posesión (arq_*) no entran en el modelo latente y quedan igual.
Después hay que regenerar: mapa (stylemap), dist, narrativa, plan.

Uso: python -m pipeline.apply_latent [--rango 2]
"""
from __future__ import annotations

import argparse
import copy
import json
import shutil
import time
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.features.style_kpis import BASE_KPIS
from pipeline.fitcache import load
from pipeline.lowrank import fit_sigma, noise_from_halves, posterior
from pipeline.models import decomposition as dec

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
BACKUP = Path.home() / "coach-dna-work" / "artifacts_ridge"


def latent_alpha(seg, F, r=2, seed=7):
    ks = list(BASE_KPIS)
    rng = np.random.default_rng(seed)
    um = seg.match_id.unique()
    half = set(rng.choice(um, len(um) // 2, replace=False))
    ma = seg.match_id.isin(half).values
    a1, a2 = (dec.coach_table(dec.fit(x.reset_index(drop=True), F.lam, kpis=ks)) for x in (seg[ma], seg[~ma]))
    al = dec.coach_table(F)[ks]
    n = seg.groupby("coach_id").match_id.nunique()
    # Σ y el nivel de ruido se aprenden con los DTs que tienen ≥ 10 partidos y aparecen en las dos mitades
    cs = [c for c in al.index.intersection(a1.index).intersection(a2.index) if n.get(c, 0) >= 10]
    nn = n.loc[cs].values.astype(float)
    S2_half = noise_from_halves(a1.loc[cs, ks].values, a2.loc[cs, ks].values, nn / 2)
    v_ref = (S2_half * (nn / nn.mean())[:, None]).mean(0) / 2  # σ² por rasgo para un DT con n̄ partidos de carrera
    nbar = nn.mean()
    S2_of = lambda m: v_ref[None, :] * (nbar / np.asarray(m, float))[:, None]
    Sig = fit_sigma(al.loc[cs].values, S2_of(nn), r)
    # posterior para TODOS los DTs del ajuste (los de pocos partidos tienen más ruido → más encogimiento)
    allc = list(al.index)
    P = posterior(al.values, S2_of(n.reindex(allc).fillna(1).clip(lower=1).values), Sig)
    w = np.linalg.eigvalsh(Sig)[::-1]
    info = {"metodo": "latente", "rango": r, "dts_sigma": len(cs), "varianza_factores": round(float(w[:r].sum() / w.sum()), 4)}
    return pd.DataFrame(P, index=allc, columns=ks), al, info


def main(r=2):
    t = time.time()
    C = load()
    seg, F = C["seg"], C["F"]
    lat, ridge, info = latent_alpha(seg, F, r)
    print(f"huella latente: {len(lat)} DTs · {info} · corr con ridge {np.corrcoef(lat.values.ravel(), ridge.values.ravel())[0, 1]:.3f}")

    glob = json.load(open(ART / "global.json"))
    if glob.get("huella", {}).get("metodo") == "latente":
        raise SystemExit("global.json ya tiene la huella latente; restaura artifacts_ridge antes de volver a aplicar")
    BACKUP.mkdir(parents=True, exist_ok=True)
    for f in list(ART.glob("dt_*.json")) + [ART / "global.json", ART / "mapa.json"]:
        if f.exists():
            shutil.copyfile(f, BACKUP / f.name)
    print(f"respaldo del ridge en {BACKUP}")

    # --- reparto de varianza con la huella latente
    F2 = copy.copy(F)
    F2.coef = F.coef.copy()
    for c in lat.index:
        F2.coef.loc[("coach", c), list(BASE_KPIS)] = lat.loc[c].values
    shares = dec.variance_shares_grouped(F2, seg)
    shares_seg = dec.variance_shares(F2, seg)
    for k in BASE_KPIS:
        glob["varianza"][k] = shares.loc[k].to_dict()
        glob["varianza_segmento"][k] = shares_seg.loc[k].to_dict()
    glob["varianza_media"] = shares.loc[list(BASE_KPIS)].mean().to_dict()
    glob["huella"] = info
    json.dump(glob, open(ART / "global.json", "w"), ensure_ascii=False)
    print("varianza media:", {k: round(v, 4) for k, v in glob["varianza_media"].items()})

    # --- perfiles
    elig = [d["id"] for d in glob["dts"] if not d.get("preliminar")]
    le = lat.loc[[c for c in elig if c in lat.index]]
    pct = le.rank(pct=True) * 100
    kd = glob["kpis"]
    n_done = 0
    for d in glob["dts"]:
        f = ART / f"dt_{d['id']}.json"
        if not f.exists() or d["id"] not in lat.index:
            continue
        a = json.load(open(f))
        c = d["id"]
        new = lat.loc[c]
        for h in a["huella"]:
            k = h["kpi"]
            if k not in new.index:
                continue
            h["alpha_ridge"] = h["alpha"]
            h["alpha"] = round(float(new[k]), 4)
            h["pct"] = float(pct.loc[c, k]) if c in pct.index else float((le[k] < new[k]).mean() * 100)
            h["ajustado_valor"] = kd[k]["media"] + h["alpha"] * kd[k]["sd"]
        for row in a.get("atribucion", []):
            k = row["kpi"]
            if k not in new.index:
                continue
            row["coach"] = float(new[k])
            row["residual"] = row["observado"] - sum(row[b] for b in ("coach", "club", "player", "opp", "ctx"))
        a["huella_metodo"] = "latente"
        json.dump(a, open(f, "w"), ensure_ascii=False)
        n_done += 1
    print(f"{n_done} perfiles actualizados · {time.time() - t:.0f}s")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rango", type=int, default=2)
    main(ap.parse_args().rango)
