"""API del Laboratorio del Entrenador. Sirve artefactos agregados y la simulación bajo demanda.

  .venv/bin/uvicorn api.main:app --port 8765
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pipeline.models.simulation import simulate_match

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
PROC = ROOT / "data" / "processed"
DIST = ROOT / "web" / "dist"

app = FastAPI(title="ADN del Entrenador")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _global():  # sin caché: los artefactos se pueden regenerar sin reiniciar la API
    return json.load(open(ART / "global.json"))


def _coach(cid: int):
    f = ART / f"dt_{cid}.json"
    if not f.exists():
        raise HTTPException(404, f"No hay artefacto para el DT {cid}. Corre: python -m pipeline.build")
    return json.load(open(f))


@lru_cache
def _shots():
    return pd.read_parquet(PROC / "shots.parquet")


@app.get("/api/global")
def glob():
    return _global()


@app.get("/api/mapa")
def mapa():
    return json.load(open(ART / "mapa.json"))


@app.get("/api/media")
def media():
    f = ART / "media.json"
    return json.load(open(f)) if f.exists() else {"clubes": {}, "dts": {}}


@app.get("/api/dt/{cid}")
def coach(cid: int):
    return _coach(cid)


@app.get("/api/dt/{cid}/simular/{match_id}")
def simulate(cid: int, match_id: int, n: int = 10000):
    art = _coach(cid)
    p = next((x for x in art["partidos"] if x["match_id"] == match_id), None)
    if p is None:
        raise HTTPException(404, "Partido no encontrado para este DT")
    sh = _shots()
    s = sh[sh.match_id == match_id]
    teams = s.team_id.unique().tolist()
    # identificar el equipo del DT por el artefacto de simulación
    sim = next((x for x in art["simulacion"]["partidos"] if x["match_id"] == match_id), None)
    team_id = None
    for t in teams:
        if abs(s[s.team_id == t].xg.sum() - (sim or {}).get("xg", -1)) < 1e-3:
            team_id = t
    if team_id is None:
        raise HTTPException(500, "No se pudo identificar el equipo")
    opp = next((t for t in teams if t != team_id), -1)
    n = max(100, min(n, 100000))
    return {**simulate_match(s, team_id, opp, n=n, seed=match_id % 10000), "n": n, "partido": p,
            "tiros": [[float(x), float(y), float(g), int(t == team_id), int(o == "Goal"), int(m)] for x, y, g, t, o, m in
                      zip(s.x, s.y, s.xg, s.team_id, s.outcome, s.minute)]}


if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = DIST / path
        return FileResponse(f if f.is_file() else DIST / "index.html")
