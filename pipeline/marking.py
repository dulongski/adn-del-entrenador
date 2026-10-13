"""Marcaje en córners (5.4 defensivo) a partir de las fotos 360 del momento del saque.

Por cada córner (Pass subtype 'Corner', period<=4) guarda, en el marco de ataque del cobrador
(hacia x=120 y reflejado para que todos se cobren desde y<40):
  atacantes y defensores visibles cerca del área, portero, primer contacto, remate/xG/gol.
No guarda los eventos ni el 360 crudo: se descargan del API, se extrae el córner y se descartan
(el disco está casi lleno y los datos crudos no deben salir de la máquina).

Salida incremental (reanudable): ~/coach-dna-work/marking/part_*.parquet
Uso: .venv/bin/python -m pipeline.marking [--workers 6] [--limit N]
"""
from __future__ import annotations

import argparse
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pandas as pd
import requests

from pipeline import sb_client as sb

OUT = Path.home() / "coach-dna-work" / "marking"
NEAR_X = 84.0          # sólo jugadores en el último tercio
WINDOW_S = 15.0        # remate dentro de la misma posesión y 15 s
SKIP_FC = {"Ball Receipt*", "Pressure", "Duel", "Block"}
_sess = requests.Session()


def _get(path: str):
    for i in range(5):
        try:
            r = _sess.get(f"{sb.BASE}/{path}", auth=sb._auth(), timeout=600)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
        except requests.RequestException:
            pass
        time.sleep(2 ** i)
    raise RuntimeError(path)


def _sec(e: dict) -> float:
    h, m, s = e["timestamp"].split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def extract(mid: int) -> list[dict]:
    ev = _get(f"v8/events/{mid}")
    if not ev:
        return []
    fr = _get(f"v2/360-frames/{mid}") or []
    ff = {f["event_uuid"]: f.get("freeze_frame") or [] for f in fr}
    del fr
    ev.sort(key=lambda e: e["index"])
    pos = {e["index"]: i for i, e in enumerate(ev)}
    out = []
    for e in ev:
        if e["type"]["name"] != "Pass" or e.get("period", 9) > 4:
            continue
        p = e.get("pass", {})
        if p.get("type", {}).get("name") != "Corner" or not e.get("location"):
            continue
        tid = e["team"]["id"]
        flip = e["location"][1] > 40  # todo se lleva a «cobrado desde y<40»

        def norm(loc, own=True):
            x, y = loc[0], loc[1]
            if not own:  # evento del otro equipo: su marco está invertido
                x, y = 120 - x, 80 - y
            return x, (80 - y if flip else y)

        i0, t0 = pos[e["index"]], _sec(e)
        fc = None
        shots = []
        for f in ev[i0 + 1:i0 + 60]:
            if f.get("period") != e["period"] or _sec(f) - t0 > WINDOW_S:
                break
            if fc is None and f["type"]["name"] not in SKIP_FC and f.get("location"):
                fc = f
            if f["type"]["name"] == "Shot" and f["team"]["id"] == tid and f.get("possession") == e.get("possession"):
                shots.append(f)
        end = p.get("end_location") or [None, None]
        ex, ey = norm(end) if end[0] is not None else (None, None)
        rec = {"match_id": mid, "team_id": tid, "period": e["period"], "minute": e["minute"], "second": e["second"],
               "end_x": ex, "end_y": ey, "short": bool((p.get("length") or 99) < 15),
               "technique": (p.get("technique") or {}).get("name"),
               "fc_own": None if fc is None else fc["team"]["id"] == tid,
               "fc_x": None, "fc_y": None,
               "shot": len(shots) > 0, "xg": float(sum(s["shot"].get("statsbomb_xg", 0) for s in shots)),
               "goal": any(s["shot"]["outcome"]["name"] == "Goal" for s in shots),
               "has360": e["id"] in ff, "att": [], "def": [], "gk": None}
        if fc is not None:
            rec["fc_x"], rec["fc_y"] = norm(fc["location"], fc["team"]["id"] == tid)
        for q in ff.get(e["id"], []):
            x, y = norm(q["location"])
            if q.get("actor"):
                continue
            if q.get("keeper") and not q.get("teammate"):
                rec["gk"] = [round(x, 2), round(y, 2)]
                continue
            if x < NEAR_X:
                continue
            (rec["att"] if q.get("teammate") else rec["def"]).append([round(x, 2), round(y, 2)])
        out.append(rec)
    return out


def done_ids() -> set[int]:
    s = set()
    for f in OUT.glob("part_*.parquet"):
        s |= set(pd.read_parquet(f, columns=["match_id"]).match_id.unique().tolist())
    for f in OUT.glob("empty_*.txt"):
        s |= {int(x) for x in f.read_text().split()}
    return s


def main(workers: int = 6, limit: int | None = None):
    OUT.mkdir(parents=True, exist_ok=True)
    M = pd.read_parquet(sb.DATA / "processed" / "matches.parquet")
    todo = [int(m) for m in M[M.has_360].match_id if int(m) not in done_ids()]
    if limit:
        todo = todo[:limit]
    print(f"{len(todo)} partidos por extraer", flush=True)
    buf, empty, n, t = [], [], 0, time.time()
    part = len(list(OUT.glob("part_*.parquet")))

    def flush():
        nonlocal buf, empty, part
        if buf:
            pd.DataFrame(buf).to_parquet(OUT / f"part_{part:04d}.parquet")
            part += 1
        if empty:
            (OUT / f"empty_{part:04d}.txt").write_text(" ".join(map(str, empty)))
        buf, empty = [], []

    with ThreadPoolExecutor(workers) as ex:
        futs = {ex.submit(extract, m): m for m in todo}
        for f in as_completed(futs):
            m = futs[f]
            try:
                rows = f.result()
            except Exception as err:  # se reintenta en la próxima corrida
                print("error", m, err, flush=True)
                continue
            if rows:
                buf += rows
            else:
                empty.append(m)
            n += 1
            if n % 40 == 0:
                flush()
                el = time.time() - t
                print(f"{n}/{len(todo)} · {el / 60:.1f} min · faltan ~{el / n * (len(todo) - n) / 60:.0f} min", flush=True)
    flush()
    print("listo", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--limit", type=int)
    a = ap.parse_args()
    main(a.workers, a.limit)
