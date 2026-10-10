"""Tiros de esquina: entregas, primer contacto, xG y posiciones 360 por DT.

Una pasada sobre todos los partidos (eventos + 360), extrae cada córner
(Pass con subtype 'Corner', period<=4) y lo normaliza a un mismo lado:
si el córner se cobró desde y>40 se refleja y -> 80 - y (end point y 360).
Las coordenadas quedan en el marco de ataque del cobrador (hacia x=120).

Salida:
  web/public/data/corners_<coach_id>.json  {"favor": {...}, "contra": {...}}
      favor/contra: n, partidos, entregas [[end_x, end_y, fc, xg, goal, short, lado(0 izq, 1 der)]],
      lados: {ambos|izq|der: {n, n360, atacantes, defensores, portero, quien}},
      quien_club (club usado para los nombres o null = toda la carrera)
      quien: nombres de SU equipo por figura (proxy, ver _names): att/def = lista alineada con
      atacantes/defensores (o null), cob = cobradores, gk = porteros;
      cada uno {n: acciones, top: [[player_id, nombre, %], ...]}.
  web/public/data/corners_liga.json        {"favor": {"n", "kpis": {ambos|izq|der: {...}}}}

Identidades: el 360 de StatsBomb no trae quién es cada punto. Como aproximación honesta,
cada jugador de su equipo que interviene en los primeros segundos del córner (despeje, duelo
aéreo, remate, recepción, presión...) se asigna al grupo k-means más cercano a la ubicación de
su primera acción. Así «quién suele estar en esa zona» = reparto de esas apariciones.
Cobrador y portero sí son identidades exactas (evento del córner / alineación).

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
SKIP_FC = ("Ball Receipt", "Pressure")
WHO_S = 8.0        # ventana para "quién aparece" tras el córner
WHO_MAXD = 9.0     # distancia máx. (yardas) de la acción al centro del grupo
WHO_MIN_CORNERS = 12  # córners mínimos en el club actual para usarlo (si no, carrera)
NO_WHO = {"Substitution", "Starting XI", "Tactical Shift", "Injury Stoppage", "Player Off",
          "Player On", "Referee Ball-Drop", "Half Start", "Half End", "Camera On", "Camera off",
          "Foul Won", "Bad Behaviour", "Own Goal For"}


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
    pids = ev.player_id.values
    ys = ev.y.values
    poscol = ev.position.values
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

        # quién aparece: primera acción de cada jugador en los primeros WHO_S segundos
        who, seen = [], set()
        for j in range(i + 1, n):
            if j in corner_pos or per[j] != r.period or tt[j] - r.t > WHO_S:
                break
            pj = pids[j]
            if pj is None or (isinstance(pj, float) and np.isnan(pj)) or np.isnan(xs[j]) or types[j] in NO_WHO:
                continue
            pj = int(pj)
            if pj in seen:
                continue
            seen.add(pj)
            own = int(tid[j]) == team
            x, y = (xs[j], ys[j]) if own else (120.0 - xs[j], 80.0 - ys[j])
            if mirror:
                y = 80.0 - y
            if x < BOX_X - 6:
                continue
            gk = 1 if poscol[j] == "Goalkeeper" else 0
            who.append([pj, int(own), _r1(x), _r1(y), gk])

        rec = {"match_id": int(mid), "event_id": r.id, "team_id": team, "rival_id": rival,
               "taker": None if r.player_id is None or (isinstance(r.player_id, float) and np.isnan(r.player_id)) else int(r.player_id),
               "who": who, "side": side, "end_x": None if np.isnan(ex) else _r1(ex),
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


def _clusters(recs: list[dict], att_rng=(3, 8), def_rng=(4, 10)) -> dict:
    w360 = [r for r in recs if r["has360"]]
    att_pts = [p for r in w360 for p in r["att"]]
    def_pts = [p for r in w360 for p in r["def"] if not (r["gk"] and p == r["gk"])]
    att_n = [sum(1 for p in r["att"] if p[0] >= BOX_X) for r in w360]
    def_n = [sum(1 for p in r["def"] if p[0] >= BOX_X) for r in w360]
    gks = [r["gk"] for r in w360 if r["gk"]]
    return {
        "n": len(recs),
        "n360": len(w360),
        "atacantes": _kmeans(att_pts, att_n, *att_rng),
        "defensores": _kmeans(def_pts, def_n, *def_rng),
        "portero": [_r1(np.mean([g[0] for g in gks])), _r1(np.mean([g[1] for g in gks]))] if gks else None,
    }


def _top(counter: dict, names: dict, k: int = 3):
    tot = sum(counter.values())
    if not tot:
        return None
    top = sorted(counter.items(), key=lambda kv: -kv[1])[:k]
    return {"n": int(tot), "top": [[int(pid), names.get(pid, str(pid)), round(100.0 * c / tot)] for pid, c in top]}


def _names(view: dict, recs: list[dict], favor: bool, names: dict) -> dict:
    """Nombres de SU equipo por figura (ver docstring del módulo).
    favor: su equipo cobra -> atacantes + cobrador; contra: su equipo defiende -> defensores + portero."""
    own_flag = 1 if favor else 0
    centers = view["atacantes"] if favor else view["defensores"]
    C = np.asarray([c[:2] for c in centers], dtype=float) if centers else np.zeros((0, 2))
    per = [dict() for _ in centers]
    gk, cob = {}, {}
    for r in recs:
        if favor and r["taker"] is not None:
            cob[r["taker"]] = cob.get(r["taker"], 0) + 1
        for pid, own, x, y, isgk in r["who"]:
            if own != own_flag or (favor and pid == r["taker"]):
                continue
            if isgk:
                if not favor:
                    gk[pid] = gk.get(pid, 0) + 1
                continue
            if not len(C):
                continue
            d = np.hypot(C[:, 0] - x, C[:, 1] - y)
            k = int(np.argmin(d))
            if d[k] <= WHO_MAXD:
                per[k][pid] = per[k].get(pid, 0) + 1
    out = {"att" if favor else "def": [_top(c, names) for c in per]}
    if favor:
        out["cob"] = _top(cob, names)
    else:
        out["gk"] = _top(gk, names, 2)
    return out


SIDE_I = {"izq": 0, "der": 1}


def summarize(recs: list[dict], cap: int, favor: bool, names: dict, name_recs: list[dict]) -> dict:
    ent = [[r["end_x"], r["end_y"], r["fc"], r["xg"], r["goal"], r["short"], SIDE_I[r["side"]]]
           for r in recs if r["end_x"] is not None and r["end_y"] is not None]
    if len(ent) > cap:
        ent = random.Random(0).sample(ent, cap)
    lados = {}
    for lado in ("ambos", "izq", "der"):
        sub = recs if lado == "ambos" else [r for r in recs if r["side"] == lado]
        nsub = name_recs if lado == "ambos" else [r for r in name_recs if r["side"] == lado]
        v = _clusters(sub)
        v["quien"] = _names(v, nsub, favor, names)
        lados[lado] = v
    return {"n": len(recs), "partidos": len({r["match_id"] for r in recs}), "entregas": ent, "lados": lados}


def _kpis(recs: list[dict]) -> dict:
    out = {}
    for lado in ("ambos", "izq", "der"):
        sub = recs if lado == "ambos" else [r for r in recs if r["side"] == lado]
        fc = [r["fc"] for r in sub if r["fc"] >= 0]
        n = max(1, len(sub))
        out[lado] = {"n": len(sub), "xg": round(sum(r["xg"] for r in sub) / n, 4),
                     "remate": round(sum(1 for r in sub if r["xg"] > 0) / n, 4),
                     "fc": round(float(np.mean(fc)), 4) if fc else None,
                     "corto": round(sum(r["short"] for r in sub) / n, 4)}
    return out


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
    pl = pd.read_parquet(DATA / "processed" / "players.parquet").dropna(subset=["player_id"])
    names = {int(a): b for a, b in zip(pl.player_id, pl.player)}  # nombre completo; la web aplica apodos
    try:
        media = json.load(open(ROOT / "web" / "src" / "boot.json"))["media"]["dts"]
    except (FileNotFoundError, KeyError):
        media = {}
    dates = dict(zip(m.match_id.astype(int), m.date.astype(str)))
    club_name = {}
    for _, row in m.iterrows():
        club_name[int(row.home_id)] = row.home
        club_name[int(row.away_id)] = row.away
    OUT.mkdir(parents=True, exist_ok=True)
    for d in dts:
        cid = int(d["id"])
        s = j[j.coach_id == cid]
        fav = [allrecs[i] for i in s[s.favor].i]
        con = [allrecs[i] for i in s[~s.favor].i]
        # club actual (media) o el de su partido más reciente
        cur = (media.get(str(cid)) or {}).get("club_id")
        if cur is None and len(s):
            last = max(s.match_id, key=lambda x: dates.get(int(x), ""))
            cur = int(s[s.match_id == last].coach_team.iloc[0])
        res = {}
        for key, recs, is_fav in (("favor", fav, True), ("contra", con, False)):
            # su equipo: cobrador en favor (team_id), rival del cobrador en contra
            own = [r for r in recs if (r["team_id"] if is_fav else r["rival_id"]) == cur] if cur is not None else []
            use_club = len(own) >= WHO_MIN_CORNERS
            res[key] = summarize(recs, MAX_ENT_DT, is_fav, names, own if use_club else recs)
            res[key]["quien_club"] = club_name.get(int(cur)) if use_club else None
        # por club: lo mismo pero sólo con los partidos de cada club que dirigió (la web lo elige con los escudos)
        res["por_club"] = {}
        for team in sorted(set(s.coach_team)):
            sc = s[s.coach_team == team]
            cn = club_name.get(int(team))
            pc: dict = {}
            for key, is_fav in (("favor", True), ("contra", False)):
                recs = [allrecs[i] for i in sc[sc.favor == is_fav].i]
                pc[key] = summarize(recs, min(MAX_ENT_DT, 700), is_fav, names, recs)
                pc[key]["quien_club"] = cn
            npc = int(coach_side[(coach_side.coach_id == cid) & (coach_side.coach_team == team) & coach_side.match_id.isin(mids)].match_id.nunique())
            pc["favor"]["partidos"] = pc["contra"]["partidos"] = npc
            if cn and npc:
                res["por_club"][cn] = pc
        # partidos = partidos dirigidos con datos, no sólo con córner
        npart = int(coach_side[(coach_side.coach_id == cid) & coach_side.match_id.isin(mids)].match_id.nunique())
        res["favor"]["partidos"] = res["contra"]["partidos"] = npart
        with open(OUT / f"corners_{cid}.json", "w") as fh:
            json.dump(res, fh, separators=(",", ":"))
    liga = {"favor": {"n": len(allrecs), "kpis": _kpis(allrecs)}}
    with open(OUT / "corners_liga.json", "w") as fh:
        json.dump(liga, fh, separators=(",", ":"))
    print(f"escritos {len(dts)} DTs + liga en {OUT}")


if __name__ == "__main__":
    main()
