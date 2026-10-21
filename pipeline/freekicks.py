"""Tiros libres por DT (a favor y en contra), incrustados en web/public/data/corners_<id>.json bajo la clave «tl».

Cada tiro libre es un evento «Pass» o «Shot» con tipo «Free Kick»:
  - pase: [minuto, marcador(-1/0/1), x, y, fin_x, fin_y, centro(0/1), altura, completo(0/1), xg_posterior, gol_posterior, jugador(índice)]
  - tiro directo: [minuto, marcador, x, y, fin_y, fin_z, xg, resultado(índice), jugador(índice)]
«xg_posterior»: xG de los tiros de la misma posesión después del tiro libre (lo que generó el envío).
También deja en corners_liga.json el promedio de la liga (por equipo y partido) para comparar.

  .venv/bin/python -m pipeline.freekicks
"""
from __future__ import annotations

import gzip
import json
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd
from pipeline.paths import DATA

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "data"
RES = ["Goal", "Saved", "Saved to Post", "Saved Off Target", "Post", "Off T", "Wayward", "Blocked"]


def _match(path: str):
    mid = int(Path(path).name.split(".")[0])
    ev = json.load(gzip.open(path, "rt"))
    ev.sort(key=lambda e: e["index"])
    goals: dict = {}
    shots_by_poss: dict = {}
    for e in ev:
        if e["type"]["name"] == "Shot" and e.get("period", 1) < 5:
            shots_by_poss.setdefault(e["possession"], []).append((e["index"], e["team"]["id"], e["shot"].get("statsbomb_xg", 0.0), e["shot"]["outcome"]["name"] == "Goal"))
    rows = []
    for e in ev:
        if e.get("period", 1) >= 5:
            continue
        t = e["type"]["name"]
        tid = e.get("team", {}).get("id")
        if t == "Shot":
            if e["shot"].get("type", {}).get("name") == "Free Kick":
                s = e["shot"]
                el = s.get("end_location") or [None, None, None]
                st = goals.get(tid, 0) - sum(v for k, v in goals.items() if k != tid)
                rows.append((mid, tid, "S", int(e["minute"]), int(np.sign(st)), round(e["location"][0], 1), round(e["location"][1], 1),
                             el[1] if len(el) > 1 else None, el[2] if len(el) > 2 else None, round(s.get("statsbomb_xg", 0.0), 3),
                             RES.index(s["outcome"]["name"]) if s["outcome"]["name"] in RES else -1, e["player"]["id"], e["player"]["name"]))
            if e["shot"]["outcome"]["name"] == "Goal":
                goals[tid] = goals.get(tid, 0) + 1
        elif t == "Own Goal For":
            goals[tid] = goals.get(tid, 0) + 1
        elif t == "Pass" and e["pass"].get("type", {}).get("name") == "Free Kick":
            p = e["pass"]
            st = goals.get(tid, 0) - sum(v for k, v in goals.items() if k != tid)
            after = [(x, g) for i, tm, x, g in shots_by_poss.get(e["possession"], []) if i > e["index"] and tm == tid]
            rows.append((mid, tid, "P", int(e["minute"]), int(np.sign(st)), round(e["location"][0], 1), round(e["location"][1], 1),
                         round(p["end_location"][0], 1), round(p["end_location"][1], 1), int(bool(p.get("cross"))),
                         (p.get("height") or {}).get("name", ""), int("outcome" not in p),
                         round(sum(x for x, _ in after), 3), int(any(g for _, g in after)), e["player"]["id"], e["player"]["name"]))
    return rows


def main():
    M = pd.read_parquet(DATA / "processed" / "matches.parquet")
    files = sorted(str(p) for p in (DATA / "events").glob("*.json.gz"))
    with ProcessPoolExecutor() as ex:
        rows = [r for rs in ex.map(_match, files, chunksize=16) for r in rs]
    print(len(rows), "tiros libres")
    by = {}
    for r in rows:
        by.setdefault((r[0], r[1]), []).append(r)
    glob = json.load(open(ROOT / "artifacts" / "global.json"))
    HEIGHT = ["Ground Pass", "Low Pass", "High Pass"]
    nteam = 2 * len(M)
    # liga: por equipo y partido
    tot = [r for r in rows if r[5] >= 72]   # sólo tiros libres en zona de ataque (el resto son reanudaciones lejos del área)
    shots = [r for r in tot if r[2] == "S"]
    passes = [r for r in tot if r[2] == "P"]
    box = lambda r: r[7] >= 102 and 18 <= r[8] <= 62   # noqa: E731
    cen = [r for r in passes if box(r)]
    liga = {"x_min": 72, "por_equipo_partido": {"total": len(tot) / nteam, "tiros": len(shots) / nteam, "centros": len(cen) / nteam},
            "xg_tiro": float(np.mean([r[9] for r in shots])), "gol_tiro": float(np.mean([r[10] == 0 for r in shots])), "a_puerta": float(np.mean([r[10] in (0, 1, 2) for r in shots])),
            "xg_por_centro": float(np.mean([r[12] for r in cen])), "completo_centro": float(np.mean([r[11] for r in cen])),
            "remate_por_centro": float(np.mean([r[12] > 0 for r in cen]))}
    lj = OUT / "corners_liga.json"
    L = json.load(open(lj))
    L["tl"] = liga
    json.dump(L, open(lj, "w"), ensure_ascii=False, separators=(",", ":"))
    for d in glob["dts"]:
        c = int(d["id"])
        mym = M[(M.home_coach_id == c) | (M.away_coach_id == c)]
        mine = {(int(r.match_id), int(r.home_id if r.home_coach_id == c else r.away_id)): (r.home if r.home_coach_id == c else r.away) for r in mym.itertuples()}
        opp = {(int(r.match_id), int(r.away_id if r.home_coach_id == c else r.home_id)): (r.home if r.home_coach_id == c else r.away) for r in mym.itertuples()}
        last = {}
        for r in mym.sort_values("date").itertuples():
            last[r.home if r.home_coach_id == c else r.away] = str(r.date)[:10]
        clubes = sorted(set(mine.values()), key=lambda k: last[k])      # del más antiguo al más reciente
        cidx = {k: i for i, k in enumerate(clubes)}
        npart = {k: sum(1 for v in mine.values() if v == k) for k in clubes}
        names: dict = {}
        jug: dict = {}

        def J(pid, nm):
            names[pid] = nm
            return jug.setdefault(pid, len(jug))
        out = {}
        for side, keys in (("favor", mine), ("contra", opp)):
            tiros, pases = [], []
            for k, cn in keys.items():
                for r in by.get(k, []):
                    if r[2] == "S":
                        tiros.append([r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], J(r[11], r[12]), cidx[cn]])
                    else:
                        pases.append([r[3], r[4], r[5], r[6], r[7], r[8], r[9], HEIGHT.index(r[10]) if r[10] in HEIGHT else 2, r[11], r[12], r[13], J(r[14], r[15]), cidx[cn]])
            out[side] = {"tiros": tiros, "pases": pases}
        out["jugadores"] = [[pid, names[pid]] for pid in jug]
        out["partidos"] = len(mine)
        out["clubes"] = [{"club": k, "partidos": npart[k]} for k in clubes]
        out["cols"] = {"tiro": ["min", "marcador", "x", "y", "fin_y", "fin_z", "xg", "res", "jug", "club"], "pase": ["min", "marcador", "x", "y", "fin_x", "fin_y", "centro", "altura", "completo", "xg_post", "gol_post", "jug", "club"], "res": RES}
        f = OUT / f"corners_{c}.json"
        if f.exists():
            obj = json.load(open(f))
            obj["tl"] = out
            json.dump(obj, open(f, "w"), ensure_ascii=False, separators=(",", ":"))
    print("listo")


if __name__ == "__main__":
    main()
