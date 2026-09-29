"""Tiros de esquina: entregas, primer contacto, xG y posiciones 360 por DT.

Una pasada sobre todos los partidos (eventos + 360), extrae cada córner
(Pass con subtype 'Corner', period<=4) y lo normaliza a un mismo lado:
si el córner se cobró desde y>40 se refleja y -> 80 - y (end point y 360).
Las coordenadas quedan en el marco de ataque del cobrador (hacia x=120).

Salida:
  web/public/data/corners_<coach_id>.json  {"favor": {...}, "contra": {...}}
  web/public/data/corners_liga.json        {"favor": {...}}  (todos los córners)

Uso: .venv/bin/python -m pipeline.corners
"""
from __future__ import annotations

import gzip
import json
import random
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.framework import flatten_events

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "web" / "public" / "data"

FT_X = 84.0        # sólo guardamos jugadores 360 en el último tercio
BOX_X = 96.0       # para contar jugadores "en el área" (define k)
WINDOW_S = 15.0    # ventana de desenlace
FC_MAX_S = 10.0    # primer contacto debe ocurrir dentro de esta ventana
MAX_ENT_DT = 1500
MAX_ENT_LIGA = 3000
SKIP_FC = ("Ball Receipt", "Pressure")


def _load(kind: str, mid: int):
    f = DATA / kind / f"{mid}.json.gz"
    if not f.exists():
        return None
    with gzip.open(f, "rt") as fh:
        return json.load(fh)


def _r1(v: float) -> float:
    return round(float(v), 1)


def extract_match(mid: int) -> list[dict]:
    raw = _load("events", mid)
    if not raw:
        return []
    ev = flatten_events(raw)
    del raw
    ff = {}
    r360 = _load("360", mid)
    if r360:
        ff = {f["event_uuid"]: f.get("freeze_frame") or [] for f in r360}
        del r360
    teams = ev.team_id.dropna().unique().tolist()

    ci = ev.index[(ev.type == "Pass") & (ev.subtype == "Corner") & (ev.period <= 4)]
    out = []
    types = ev.type.values
    tid = ev.team_id.values
    tt = ev.t.values
    poss = ev.poss.values
    xs = ev.x.values
    xg = ev.xg.values
    outc = ev.outcome.values
    per = ev.period.values
    corner_pos = set(ci.tolist())
    n = len(ev)
    for i in ci:
        r = ev.loc[i]
        team = int(r.team_id)
        rival = next((int(t) for t in teams if int(t) != team), None)
        mirror = bool(r.y > 40)
        side = "der" if mirror else "izq"
        ex, ey = r.end_x, r.end_y
        if mirror and not np.isnan(ey):
            ey = 80.0 - ey
        length = r.length if not np.isnan(r.length) else np.hypot(r.end_x - r.x, r.end_y - r.y)
        short = int((length < 15) or (not np.isnan(ex) and ex < 102))

        # primer contacto
        fc = -1
        for j in range(i + 1, n):
            if tt[j] - r.t > FC_MAX_S or per[j] != r.period:
                break
            if str(types[j]).startswith(SKIP_FC) or np.isnan(xs[j]):
                continue
            fc = 1 if int(tid[j]) == team else 0
            break

        # desenlace: tiros del equipo cobrador en misma posesión o <=15 s,
        # cortando en el siguiente córner o cambio de periodo
        sxg, goal, nsh = 0.0, 0, 0
        for j in range(i + 1, n):
            if j in corner_pos or per[j] != r.period:
                break
            same = poss[j] == r.poss
            if not same and tt[j] - r.t > WINDOW_S:
                break
            if types[j] == "Shot" and int(tid[j]) == team:
                nsh += 1
                if not np.isnan(xg[j]):
                    sxg += float(xg[j])
                if outc[j] == "Goal":
                    goal = 1

        rec = {"match_id": int(mid), "event_id": r.id, "team_id": team, "rival_id": rival,
               "side": side, "end_x": None if np.isnan(ex) else _r1(ex),
               "end_y": None if np.isnan(ey) else _r1(ey),
               "short": short, "fc": fc, "xg": round(sxg, 3), "goal": goal, "shots": nsh,
               "has360": False, "att": [], "def": [], "gk": None}
        frame = ff.get(r.id)
        if frame:
            rec["has360"] = True
            for p in frame:
                x, y = p["location"][:2]
                if mirror:
                    y = 80.0 - y
                if p.get("keeper") and not p.get("teammate"):
                    rec["gk"] = [_r1(x), _r1(y)]
                if x < FT_X or p.get("actor"):
                    continue
                if p.get("teammate"):
                    if not p.get("keeper"):
                        rec["att"].append([_r1(x), _r1(y)])
                else:
                    rec["def"].append([_r1(x), _r1(y)])  # incluye portero rival
        out.append(rec)
    return out


def _kmeans(points: list, per_corner_counts: list[int], lo: int, hi: int) -> list:
    from sklearn.cluster import KMeans
    if not points or not per_corner_counts:
        return []
    k = int(np.clip(round(float(np.mean(per_corner_counts))), lo, hi))
    P = np.asarray(points, dtype=float)
    if len(P) < k:
        return []
    km = KMeans(n_clusters=k, n_init=10, random_state=0).fit(P)
    w = np.bincount(km.labels_, minlength=k) / len(P)
    cs = [[_r1(c[0]), _r1(c[1]), round(float(wi), 3)] for c, wi in zip(km.cluster_centers_, w)]
    return sorted(cs, key=lambda c: -c[2])


def summarize(recs: list[dict], cap: int, att_rng=(3, 8), def_rng=(4, 10)) -> dict:
    ent = [[r["end_x"], r["end_y"], r["fc"], r["xg"], r["goal"], r["short"]]
           for r in recs if r["end_x"] is not None and r["end_y"] is not None]
    if len(ent) > cap:
        ent = random.Random(0).sample(ent, cap)
    w360 = [r for r in recs if r["has360"]]
    att_pts = [p for r in w360 for p in r["att"]]
    def_pts = [p for r in w360 for p in r["def"] if not (r["gk"] and p == r["gk"])]
    att_n = [sum(1 for p in r["att"] if p[0] >= BOX_X) for r in w360]
    def_n = [sum(1 for p in r["def"] if p[0] >= BOX_X) for r in w360]
    gks = [r["gk"] for r in w360 if r["gk"]]
    return {
        "n": len(recs),
        "partidos": len({r["match_id"] for r in recs}),
        "entregas": ent,
        "atacantes": _kmeans(att_pts, att_n, *att_rng),
        "defensores": _kmeans(def_pts, def_n, *def_rng),
        "portero": [_r1(np.mean([g[0] for g in gks])), _r1(np.mean([g[1] for g in gks]))] if gks else None,
        "n360": len(w360),
    }


def main(workers: int = 8):
    m = pd.read_parquet(DATA / "processed" / "matches.parquet")
    mids = [int(x) for x in m.match_id if (DATA / "events" / f"{int(x)}.json.gz").exists()]
    allrecs: list[dict] = []
    with ProcessPoolExecutor(workers) as ex:
        for k, recs in enumerate(ex.map(extract_match, mids, chunksize=8)):
            allrecs.extend(recs)
            if (k + 1) % 200 == 0:
                print(f"  {k + 1}/{len(mids)} partidos, {len(allrecs)} córners", flush=True)
    print(f"{len(allrecs)} córners en {len(mids)} partidos")

    df = pd.DataFrame({"i": range(len(allrecs)),
                       "match_id": [r["match_id"] for r in allrecs],
                       "team_id": [r["team_id"] for r in allrecs]})
    coach_side = pd.concat([
        m[["match_id", "home_id", "home_coach_id"]].rename(columns={"home_id": "coach_team", "home_coach_id": "coach_id"}),
        m[["match_id", "away_id", "away_coach_id"]].rename(columns={"away_id": "coach_team", "away_coach_id": "coach_id"}),
    ]).dropna(subset=["coach_id"])
    coach_side["coach_id"] = coach_side.coach_id.astype(int)
    coach_side["match_id"] = coach_side.match_id.astype(int)
    j = df.merge(coach_side, on="match_id")
    j["favor"] = j.team_id == j.coach_team

    dts = json.load(open(ROOT / "artifacts" / "global.json"))["dts"]
    OUT.mkdir(parents=True, exist_ok=True)
    for d in dts:
        cid = int(d["id"])
        s = j[j.coach_id == cid]
        fav = [allrecs[i] for i in s[s.favor].i]
        con = [allrecs[i] for i in s[~s.favor].i]
        res = {"favor": summarize(fav, MAX_ENT_DT), "contra": summarize(con, MAX_ENT_DT)}
        # partidos = partidos dirigidos con datos, no sólo con córner
        npart = int(coach_side[(coach_side.coach_id == cid) & coach_side.match_id.isin(mids)].match_id.nunique())
        res["favor"]["partidos"] = res["contra"]["partidos"] = npart
        with open(OUT / f"corners_{cid}.json", "w") as fh:
            json.dump(res, fh, separators=(",", ":"))
    liga = {"favor": summarize(allrecs, MAX_ENT_LIGA)}
    with open(OUT / "corners_liga.json", "w") as fh:
        json.dump(liga, fh, separators=(",", ":"))
    print(f"escritos {len(dts)} DTs + liga en {OUT}")


if __name__ == "__main__":
    main()
