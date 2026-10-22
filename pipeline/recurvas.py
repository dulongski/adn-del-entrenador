"""Recalcula sólo las curvas de contexto (marcador, minuto, localía, rival) de cada DT con el ajuste en caché.

No vuelve a ajustar el modelo: usa cache/fit_base.pkl y reescribe art["contexto"]["curvas"] en artifacts/dt_*.json.

  .venv/bin/python -m pipeline.recurvas
"""
from __future__ import annotations

import json

from pipeline import fitcache
from pipeline.build import ART, jsonable
from pipeline.models import context as ctxm


def main():
    B = fitcache.load()
    seg, F = B["seg"], B["F"]
    files = sorted(ART.glob("dt_*.json"))
    for i, f in enumerate(files):
        art = json.load(open(f))
        art["contexto"]["curvas"] = ctxm.reaction_curves(seg, F, int(art["id"]))
        json.dump(jsonable(art), open(f, "w"), ensure_ascii=False)
        print(f"{i + 1}/{len(files)} {f.name}", flush=True)


if __name__ == "__main__":
    main()
