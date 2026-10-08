"""Recalcula solo la narrativa (español e inglés) de cada artefacto de DT, sin re-ejecutar el pipeline completo.

  python -m pipeline.report.regen_narrative
"""
from __future__ import annotations

import json

from pipeline.build import ART, jsonable
from pipeline.report import narrative


def main():
    glob = json.load(open(ART / "global.json"))
    files = sorted(ART.glob("dt_*.json"))
    for f in files:
        art = json.load(open(f))
        art["narrativa"] = narrative.build(art, glob)
        art["narrativa_en"] = narrative.build(art, glob, "en")
        json.dump(jsonable(art), open(f, "w"), ensure_ascii=False)
    print(f"narrativa regenerada en {len(files)} artefactos")


if __name__ == "__main__":
    main()
