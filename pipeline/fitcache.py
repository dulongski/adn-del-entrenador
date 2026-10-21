"""Ajuste del modelo de estilo SIN arquetipos (los 34 KPI base), guardado en la carpeta de datos (pipeline/paths.py: <datos>/cache).

Cada KPI se resuelve por separado con el mismo diseño y las mismas λ, así que α de los KPI base
es idéntica a la publicada (se verifica contra artifacts/dt_*.json). Sirve a los módulos nuevos
(validación, tiempo, plan de partido) sin tocar el modelo publicado."""
from __future__ import annotations

import json
import pickle
import time
from pathlib import Path

import pandas as pd

from pipeline import sb_client as sb
from pipeline.features.style_kpis import BASE_KPIS
from pipeline.models import decomposition as dec
from pipeline.paths import CACHE

ROOT = Path(__file__).resolve().parents[1]


def load(force: bool = False):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / "fit_base.pkl"
    if f.exists() and not force:
        return pickle.load(open(f, "rb"))
    t = time.time()
    P = sb.DATA / "processed"
    M = pd.read_parquet(P / "matches.parquet")
    S = pd.read_parquet(P / "stints.parquet")
    seg = dec.build_segments(S, M)
    D = dec.build_design(seg)
    F = dec.fit(seg, design=D, kpis=list(BASE_KPIS))
    print(f"ajuste base: {len(seg)} filas, {D.X.shape[1]} columnas, {time.time() - t:.0f}s", flush=True)
    # verificación contra lo publicado
    ref = json.load(open(ROOT / "artifacts" / "dt_2947.json"))
    al = dec.coach_table(F)
    dif = max(abs(h["alpha"] - float(al.loc[2947, h["kpi"]])) for h in ref["huella"] if h["kpi"] in al.columns)
    print(f"max |Δα| vs publicado: {dif:.2e}", flush=True)
    out = {"seg": seg, "F": F, "M": M}
    pickle.dump(out, open(f, "wb"))
    return out


if __name__ == "__main__":
    load(force=True)
