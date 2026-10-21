"""Regenera TODO desde la carpeta de datos (pipeline/paths.py), en orden, con un log por paso.

    python -m pipeline.refresh_all [--desde process] [--sin-descarga]

Pasos (cada uno se puede retomar con --desde <paso>):
  descarga    caché del API de StatsBomb (partidos nuevos incluidos)
  process     tablas procesadas
  build       modelo, perfiles, mapa, simulador, córners, exportación web, trasplante…
  extras      jugadores, tiros libres, puente estilo→xG, liga simulada, fotos y logos
  calendario  quita del calendario oficial los partidos que ya se jugaron
  fitcache    ajuste base en caché (para los módulos nuevos)
  marking     marcaje 360 en córners (incremental: sólo partidos nuevos)
  bp          balón parado 2: saques de banda, marcaje, zonas, por club
  tiempo      perfil por torneo y estabilidad
  latente     huella latente (lowrank + apply_latent) y lo que depende de ella (mapa, campanas, narrativa, web)
  validacion  pruebas del método (sintético, mitad/mitad, fuera de muestra, mapa)
  plan        cómo jugarle, jugadores a su medida, seguimiento
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

from pipeline.paths import DATA, PROC, ROOT

PUB = ROOT / "web" / "public" / "data"
ART = ROOT / "artifacts"
LOG = DATA / "logs"
STEPS = ["descarga", "process", "build", "extras", "calendario", "fitcache", "marking", "bp", "tiempo", "latente", "validacion", "plan"]


def run(name, *args):
    LOG.mkdir(parents=True, exist_ok=True)
    t = time.time()
    print(f"▶ {name}", flush=True)
    with open(LOG / f"{name}.log", "w") as fh:
        r = subprocess.run([sys.executable, "-u", *args], cwd=ROOT, stdout=fh, stderr=subprocess.STDOUT)
    print(f"  {'ok' if r.returncode == 0 else 'FALLÓ'} · {time.time() - t:.0f}s · log {LOG / (name + '.log')}", flush=True)
    if r.returncode != 0:
        raise SystemExit(f"falló {name}: revisa {LOG / (name + '.log')}")


def py(name, code):
    run(name, "-c", code)


def calendario():
    """El simulador de liga toma partidos.json como lo ya jugado y calendario.json como lo que falta:
    se quitan del calendario los partidos del torneo en curso que ya tienen resultado."""
    cal = json.load(open(PUB / "calendario.json"))
    P = json.load(open(PUB / "partidos.json"))
    rows = P["rows"]  # [fecha, temporada, torneo, jornada, local, visita, ...]
    tor = max(rows, key=lambda r: r[0])[1:3]
    jug = {(r[4], r[5]) for r in rows if r[1:3] == tor}
    nuevo = [f for f in cal if (f["h"], f["a"]) not in jug]
    json.dump(nuevo, open(PUB / "calendario.json", "w"), ensure_ascii=False)
    print(f"calendario: {len(cal)} → {len(nuevo)} partidos por jugar ({' '.join(tor)}: {len(jug)} jugados)")


def latente():
    run("lowrank", "-m", "pipeline.lowrank")
    run("apply_latent", "-m", "pipeline.apply_latent")
    py("stylemap", "from pipeline.models import stylemap; stylemap.main()")
    py("dist", "from pipeline import dist; dist.main()")
    run("narrativa", "-m", "pipeline.report.regen_narrative")
    # la web: perfiles + global/mapa dentro de boot.json
    boot = ROOT / "web" / "src" / "boot.json"
    b = json.load(open(boot))
    b["global"] = json.load(open(ART / "global.json"))
    b["mapa"] = json.load(open(ART / "mapa.json"))
    json.dump(b, open(boot, "w"), ensure_ascii=False, separators=(",", ":"))
    for f in ART.glob("dt_*.json"):
        shutil.copyfile(f, PUB / f.name)
    print("web: boot.json y perfiles actualizados")


def main(desde="descarga", sin_descarga=False):
    t0 = time.time()
    todo = STEPS[STEPS.index(desde):]
    for s in todo:
        if s == "descarga":
            if not sin_descarga:
                run("descarga", "-m", "pipeline.sb_client")
        elif s == "process":
            run("process", "-m", "pipeline.process")
        elif s == "build":
            run("build", "-m", "pipeline.build")
        elif s == "extras":
            run("jugadores_extra", "-m", "pipeline.jugadores_extra")
            run("freekicks", "-m", "pipeline.freekicks")
            run("style_xg", "-m", "pipeline.style_xg")
            run("league_sim_data", "-m", "pipeline.league_sim_data")
            run("media", "-m", "pipeline.media")
        elif s == "calendario":
            calendario()
        elif s == "fitcache":
            py("fitcache", "from pipeline.fitcache import load; load(force=True)")
        elif s == "marking":
            run("marking", "-m", "pipeline.marking")
        elif s == "bp":
            run("bp_extra", "-m", "pipeline.bp_extra")
            run("bp_club", "-m", "pipeline.bp_club", "--dts", str(PUB), "--bp2", str(PUB / "bp2.json"),
                "--setpieces", str(PROC / "setpieces.parquet"), "--actions", str(PROC / "actions.parquet"), "--players", str(PROC / "players.parquet"))
        elif s == "tiempo":
            run("tiempo", "-m", "pipeline.tiempo")
        elif s == "latente":
            latente()
        elif s == "validacion":
            run("validacion", "-m", "pipeline.validation")
        elif s == "plan":
            run("plan", "-m", "pipeline.plan")
    print(f"todo listo en {(time.time() - t0) / 60:.0f} min")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--desde", default="descarga", choices=STEPS)
    ap.add_argument("--sin-descarga", action="store_true")
    a = ap.parse_args()
    main(a.desde, a.sin_descarga)
