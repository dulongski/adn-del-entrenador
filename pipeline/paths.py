"""Dónde viven los datos: FUERA del repositorio (y fuera de iCloud).

Los datos de StatsBomb (eventos, 360, alineaciones), las tablas procesadas, los cachés del modelo
y el marcaje 360 van en una carpeta aparte, para que nunca se suban a git ni se sincronicen con
la nube. Por defecto es ~/coach-dna-data; se cambia con la variable de entorno COACH_DNA_DATA_DIR.

    ~/coach-dna-data/
        events/ 360/ lineups/ matches/   caché del API de StatsBomb (pipeline/sb_client.py)
        processed/                       tablas procesadas (pipeline/process.py)
        model_cache/                     cachés del pipeline (transferencia, 360, jugadas…)
        marking/                         córners con su foto 360 (pipeline/marking.py)
        cache/fit_base.pkl               ajuste base en caché (pipeline/fitcache.py)
        artifacts_ridge/                 respaldo de la huella del ridge (pipeline/apply_latent.py)
        .env                             credenciales del API (también se lee ./.env)
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get("COACH_DNA_DATA_DIR", Path.home() / "coach-dna-data")).expanduser()
PROC = DATA / "processed"
MODEL_CACHE = DATA / "model_cache"
MARK = DATA / "marking"
CACHE = DATA / "cache"
