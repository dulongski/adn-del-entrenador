"""Índice compacto de resultados para el asistente de IA de la web: un renglón por partido
(fecha, temporada, torneo, jornada, local, visitante, marcador, xG de cada lado y DT de cada lado).
Son resultados públicos más el xG agregado por equipo; no incluye eventos ni datos crudos.

  python -m pipeline.partidos_index  ->  web/public/data/partidos.json
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
OUT = ROOT / "web" / "public" / "data" / "partidos.json"


def main():
    M = pd.read_parquet(PROC / "matches.parquet").sort_values("date")
    S = pd.read_parquet(PROC / "shots.parquet")
    xg = S.groupby(["match_id", "team_id"]).xg.sum()
    rows = []
    for m in M.itertuples():
        rows.append([m.date[:10], m.season, m.stage or "", int(m.week) if pd.notna(m.week) else None, m.home, m.away,
                     int(m.home_score), int(m.away_score),
                     round(float(xg.get((m.match_id, m.home_id), 0.0)), 2), round(float(xg.get((m.match_id, m.away_id), 0.0)), 2),
                     int(m.home_coach_id) if pd.notna(m.home_coach_id) else None, int(m.away_coach_id) if pd.notna(m.away_coach_id) else None])
    cols = ["fecha", "temporada", "torneo", "jornada", "local", "visita", "gl", "gv", "xgl", "xgv", "dtl", "dtv"]
    json.dump({"cols": cols, "rows": rows}, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"partidos.json: {len(rows)} partidos, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
