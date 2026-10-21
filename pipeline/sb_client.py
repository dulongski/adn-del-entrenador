"""Cliente autenticado del API de StatsBomb con caché local (gzip JSON).

Los datos crudos NUNCA salen de data/ (gitignored). Uso exclusivo para la competencia ISAC.
"""
from __future__ import annotations

import gzip
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from dotenv import load_dotenv
from pipeline.paths import DATA

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://data.statsbomb.com/api"
LIGA_MX = 73
SEASONS = [108, 235, 281, 317, 318, 351]  # 2021/22 … 2026/27

load_dotenv(ROOT / ".env")
load_dotenv(DATA / ".env")  # credenciales también junto a los datos (fuera del repo)


def _auth():
    u, p = os.environ.get("SB_USER"), os.environ.get("SB_PASS")
    if not u or not p:
        raise RuntimeError("Define SB_USER y SB_PASS en .env")
    return (u, p)


def _get(path: str, retries: int = 4):
    for i in range(retries):
        try:
            r = requests.get(f"{BASE}/{path}", auth=_auth(), timeout=900)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
        except requests.RequestException:
            pass
        time.sleep(2 ** i)
    raise RuntimeError(f"Fallo al descargar {path}")


def _cached(kind: str, key, path: str):
    f = DATA / kind / f"{key}.json.gz"
    if f.exists():
        with gzip.open(f, "rt") as fh:
            return json.load(fh)
    obj = _get(path)
    if obj is None:
        return None
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_suffix(f".tmp{os.getpid()}{id(obj)}")
    with gzip.open(tmp, "wt") as fh:
        json.dump(obj, fh)
    tmp.replace(f)  # escritura atómica: nunca queda un archivo truncado en caché
    return obj


def matches(season_id: int, comp_id: int = LIGA_MX):
    return _cached("matches", f"{comp_id}_{season_id}", f"v6/competitions/{comp_id}/seasons/{season_id}/matches")


def events(match_id: int):
    return _cached("events", match_id, f"v8/events/{match_id}")


def lineups(match_id: int):
    return _cached("lineups", match_id, f"v4/lineups/{match_id}")


def frames360(match_id: int):
    return _cached("360", match_id, f"v2/360-frames/{match_id}")


def all_matches(seasons=SEASONS, refresh: bool = False):
    out = []
    for s in seasons:
        if refresh:
            (DATA / "matches" / f"{LIGA_MX}_{s}.json.gz").unlink(missing_ok=True)
        ms = matches(s) or []
        out += [m for m in ms if m.get("match_status") == "available"]
    return out


def download_all(with_360: bool = True, workers: int = 8):
    ms = all_matches()
    jobs = []
    have = lambda kind, mid: (DATA / kind / f"{mid}.json.gz").exists()  # no releer el caché
    with ThreadPoolExecutor(workers) as ex:
        # primero eventos y alineaciones (lo que necesita el modelo), después 360
        for m in ms:
            if not have("events", m["match_id"]):
                jobs.append(ex.submit(events, m["match_id"]))
            if not have("lineups", m["match_id"]):
                jobs.append(ex.submit(lineups, m["match_id"]))
        if with_360:
            for m in ms:
                if m.get("match_status_360") == "available" and not have("360", m["match_id"]):
                    jobs.append(ex.submit(frames360, m["match_id"]))
        for n, j in enumerate(as_completed(jobs)):
            try:
                j.result()
            except Exception as e:  # un partido fallido no detiene la descarga
                print("fallo:", e, flush=True)
            if n % 200 == 0:
                print(f"{n}/{len(jobs)}", flush=True)
    print("listo", len(ms), "partidos")


if __name__ == "__main__":
    download_all()
