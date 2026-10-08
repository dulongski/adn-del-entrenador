"""Añade a web/public/data/sim_<id>.json el autor de cada tiro (para el tooltip del simulador).

Cada partido gana "s": lista paralela a "t" con [player_id, nombre] del que tiró.
No toca el modelo; solo lee data/processed/shots.parquet. Correr DESPUÉS de export_static.py
(que reescribe los sim_*.json):

    .venv/bin/python -m pipeline.sim_extra
"""
from __future__ import annotations
import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "data"


def main() -> None:
    apodos = json.load(open(ROOT / "data" / "processed" / "apodos.json"))
    shots = pd.read_parquet(ROOT / "data" / "processed" / "shots.parquet")
    by_match = dict(tuple(shots.groupby("match_id")))
    ok = bad = 0
    for f in sorted(OUT.glob("sim_*.json")):
        sims = json.load(open(f))
        for mid, d in sims.items():
            s = by_match.get(int(mid))
            if s is None:
                continue
            # mismo orden y mismo filtro que export_static.py
            rows = [r for r in s.itertuples() if r.xg == r.xg]
            t = d.get("t", [])
            if len(rows) != len(t) or any(abs(float(r.xg) - x[2]) > 1e-3 or int(r.minute) != x[5] for r, x in zip(rows, t)):
                bad += 1
                d.pop("s", None)
                continue
            d["s"] = [[int(r.player_id) if r.player_id == r.player_id else 0,
                       (apodos.get(str(int(r.player_id))) if r.player_id == r.player_id else None) or (r.player or "")] for r in rows]
            ok += 1
        json.dump(sims, open(f, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"autores de tiro añadidos en {ok} partidos ({bad} sin coincidencia)")


if __name__ == "__main__":
    main()
