"""Experimento: ¿cuánto cambiaría el modelo si las jugadas tipo nuevas entran como indicadores?

NO toca artifacts/ ni la web: reajusta en memoria y compara contra el modelo actual.

Los 9 indicadores nuevos son el % de las jugadas efectivas de cada tipo (5 de «cómo se arma» + 4 de «cómo termina»),
con la misma semántica que los arquetipos (contador / total por tramo). Se comparan:

  actual      34 base + 8 arquetipos (lo que usa la app)
  + nuevas    34 base + 8 arquetipos + 9 nuevas
  reemplazo   34 base + 9 nuevas (los arquetipos salen)

y se mide: (1) si cambian los efectos de los indicadores que ya existen, (2) cuánto del estilo es del DT en los
indicadores nuevos frente a los viejos, (3) el promedio de la app, (4) la prueba de transferencia cuando el vector
de estilo incluye cada grupo.

  .venv/bin/python -m pipeline.experiments.jugadas_en_modelo   ->  artifacts/exp_jugadas_modelo.json
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline import build as B
from pipeline import jugadas as jg
from pipeline.features.style_kpis import BASE_KPIS, register_kpi
from pipeline.models import archetypes as arq
from pipeline.models import decomposition as dec
from pipeline.models import transfer_test as tt

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts" / "exp_jugadas_modelo.json"


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def main():
    T = B.load()
    M, S, P = T["matches"], T["stints"], T["possessions"]
    # ---- arquetipos, igual que build.py
    log("arquetipos")
    gmm, scaler, labels, cent, arq_names = arq.fit(P)
    P["arq"] = labels.values
    st_t0 = S[S.home == 1].groupby("match_id").t0.apply(np.sort)

    def stint_of(df):
        return np.clip([int(np.searchsorted(st_t0[m], t, side="right") - 1) if m in st_t0.index else 0 for m, t in zip(df.match_id, df.t0)], 0, None)

    P["stint"] = stint_of(P)
    ac = P[P.arq >= 0].pivot_table(index=["match_id", "stint", "team_id"], columns="arq", values="poss", aggfunc="count", fill_value=0)
    ac.columns = [f"arq_{c}" for c in ac.columns]
    ac["n_poss_op"] = ac.sum(1)
    S = S.merge(ac.reset_index(), on=["match_id", "stint", "team_id"], how="left")
    for c in ac.columns:
        S[c] = S[c].fillna(0)
    for k, v in arq_names.items():
        register_kpi(f"arq_{k}", f"arq_{k}", "n_poss_op", 100, v["nombre"], "Arquetipos", "arquetipo del modelo actual")
    # ---- jugadas tipo nuevas
    log("jugadas tipo nuevas")
    E = jg.classify(refresh=True)
    E["stint"] = stint_of(E)
    parts = []
    for col, ids in (("arma", jg.BUILD_IDS), ("termina", jg.FINISH_IDS)):
        c = E.pivot_table(index=["match_id", "stint", "team_id"], columns=col, values="poss", aggfunc="count", fill_value=0)
        c = c.reindex(columns=ids, fill_value=0)
        c.columns = [f"jg_{i}" for i in ids]
        parts.append(c)
    jc = pd.concat(parts, axis=1)
    jc["n_eff"] = E.groupby(["match_id", "stint", "team_id"]).size()
    S = S.merge(jc.reset_index(), on=["match_id", "stint", "team_id"], how="left")
    for c in jc.columns:
        S[c] = S[c].fillna(0)
    labels_new = {f"jg_{i}": es for i, es, *_ in jg.BUILD + jg.FINISH}
    new = [f"jg_{i}" for i in jg.CAT_IDS]
    for k in new:
        register_kpi(k, k, "n_eff", 100, labels_new[k], "Jugadas tipo", "% de las jugadas efectivas")

    log("segmentos y diseño")
    seg = dec.build_segments(S, M)
    D = dec.build_design(seg)
    old = list(BASE_KPIS) + [f"arq_{k}" for k in arq_names]
    allk = old + new
    t0 = time.time()
    F_old = dec.fit(seg, design=D, kpis=old)
    F_all = dec.fit(seg, design=D, kpis=allk)
    log(f"ajustes listos ({time.time() - t0:.0f} s)")

    # (1) ¿cambian los efectos de los indicadores que ya estaban?
    a0 = dec.coach_table(F_old)[old]
    a1 = dec.coach_table(F_all)[old]
    dmax = float((a0 - a1).abs().max().max())
    # (2) cuánto del estilo es del DT en cada grupo (entre equipos-temporada)
    sh_old = dec.variance_shares_grouped(F_old, seg)
    sh_all = dec.variance_shares_grouped(F_all, seg)
    grp = {"34 base": list(BASE_KPIS), "8 arquetipos": [f"arq_{k}" for k in arq_names], "9 nuevas": new, "5 «cómo se arma»": new[:5], "4 «cómo termina»": new[5:]}
    shares = {g: {b: float(sh_all.loc[ks, b].mean()) for b in ["coach", "player", "club", "opp", "ctx", "residual"]} for g, ks in grp.items()}
    por_kpi = {k: {"etiqueta": labels_new.get(k, k), "coach": float(sh_all.loc[k, "coach"]), "player": float(sh_all.loc[k, "player"])} for k in new}
    prom = {
        "actual (42)": {b: float(sh_old[b].mean()) for b in ["coach", "player", "club", "opp", "ctx", "residual"]},
        "con nuevas (51)": {b: float(sh_all[b].mean()) for b in ["coach", "player", "club", "opp", "ctx", "residual"]},
        "reemplazo (43)": {b: float(sh_all.loc[list(BASE_KPIS) + new, b].mean()) for b in ["coach", "player", "club", "opp", "ctx", "residual"]},
    }
    # ¿qué tan parecidos son entre sí los grupos? correlación de las huellas α entre DTs
    al = dec.coach_table(F_all)
    corr = {}
    for k in new:
        r = {o: float(np.corrcoef(al[k], al[o])[0, 1]) for o in old if al[k].notna().all() and al[o].notna().all()}
        best = max(r, key=lambda x: abs(r[x]))
        corr[k] = {"mas_parecido": best, "r": r[best]}

    # (3) prueba de transferencia con cada vector de estilo
    variants = {"34 base (la que usa la app)": list(BASE_KPIS), "34 base + 8 arquetipos": old, "34 base + 9 nuevas": list(BASE_KPIS) + new, "34 base + 8 arquetipos + 9 nuevas": allk}
    transfer = {}
    for name, ks in variants.items():
        log("transferencia:", name)
        t = tt.run(seg, F_old.lam, kpis=ks, log=lambda *a: None)
        s = tt.summary(t)
        transfer[name] = {"etapas": s["etapas"], "mitad_superior_ajustado": s["ajustado"]["mitad_superior"], "mediana_ajustado": s["ajustado"]["mediana"],
                          "top5_ajustado": s["ajustado"]["top5"], "p_signo": s["ajustado"]["p_signo"], "mitad_superior_crudo": s["crudo"]["mitad_superior"]}
        log("   ", transfer[name])

    out = {"max_cambio_alpha_indicadores_viejos": dmax, "participacion_por_grupo": shares, "promedio_app": prom, "por_indicador_nuevo": por_kpi,
           "parecido_con_viejos": corr, "transferencia": transfer, "n_filas": len(seg)}
    json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
    log("listo ->", OUT)
    print(json.dumps({k: out[k] for k in ["max_cambio_alpha_indicadores_viejos", "participacion_por_grupo", "promedio_app", "transferencia"]}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
