"""Procesa cada partido del caché en tablas compactas (data/processed/*.parquet).

Tablas:
  matches      1 fila por partido (equipos, DTs, marcador, temporada)
  stints       contadores de estilo por (partido, stint, equipo) + jugadores en cancha + contexto
  possessions  1 fila por posesión (para arquetipos y visualizaciones)
  setpieces    jugadas a balón parado (córners, tiros libres, saques de banda peligrosos)
  subs         sustituciones con contexto
  lineups      alineaciones iniciales con posición y formación
  shots        tiros (para mapas y simulación)
  actions      acciones espaciales compactas (para mapas de calor/NMF)
"""
from __future__ import annotations

import gzip
import json
import sys
import traceback
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline import sb_client as sb
from pipeline.features.style_kpis import match_counters
from pipeline.framework import (CFG, build_possessions, build_stints, flatten_events, formations,
                                starting_xis, summarize_360)

OUT = sb.DATA / "processed"
SEASON_NAME = {108: "2021/22", 235: "2022/23", 281: "2023/24", 317: "2024/25", 318: "2025/26", 351: "2026/27"}


def _load(kind, mid):
    f = sb.DATA / kind / f"{mid}.json.gz"
    if not f.exists():
        return None
    with gzip.open(f, "rt") as fh:
        return json.load(fh)


def match_meta(m: dict) -> dict:
    def mgr(side):
        ms = m[side].get("managers") or []
        return (ms[0]["id"], ms[0]["name"]) if ms else (None, None)
    hm, am = mgr("home_team"), mgr("away_team")
    return {
        "match_id": m["match_id"], "date": m["match_date"], "season_id": m["season"]["season_id"],
        "season": SEASON_NAME.get(m["season"]["season_id"], m["season"]["season_name"]),
        "week": m.get("match_week"), "stage": (m.get("competition_stage") or {}).get("name"),
        "home_id": m["home_team"]["home_team_id"], "home": m["home_team"]["home_team_name"],
        "away_id": m["away_team"]["away_team_id"], "away": m["away_team"]["away_team_name"],
        "home_coach_id": hm[0], "home_coach": hm[1], "away_coach_id": am[0], "away_coach": am[1],
        "home_score": m.get("home_score"), "away_score": m.get("away_score"),
        "has_360": m.get("match_status_360") == "available",
    }


def _setpieces(ev: pd.DataFrame, P: pd.DataFrame, frames: list | None, mid: int) -> list[dict]:
    C = CFG()["balon_parado"]
    box = CFG()["pitch"]["box"]
    fr = {f["event_uuid"]: f for f in frames} if frames else {}
    rows = []
    sp = ev[(ev.type == "Pass") & ev.subtype.isin(["Corner", "Free Kick", "Throw-in"])]
    for r in sp.itertuples():
        if r.subtype == "Throw-in" and r.x < C["throw_in_danger_min_x"]:
            continue
        if r.subtype == "Free Kick" and r.x < 60:
            continue
        win = ev[(ev.t > r.t) & (ev.t <= r.t + C["window_s"]) & (ev.poss == r.poss)]
        # primer contacto: primera acción (de cualquier equipo) tras el envío
        fc = ev[(ev.index > r.Index) & ~ev.type.isin(["Ball Receipt*", "Pressure", "Duel"]) & ev.x.notna()].head(1)
        fc_team = fc.team_id.iloc[0] if len(fc) else None
        shots = win[(win.type == "Shot") & (win.team_id == r.team_id)]
        f = fr.get(r.id)
        att_box = def_box = np.nan
        if f:
            inbox = [p for p in f["freeze_frame"] if box["x_min"] <= p["location"][0] and box["y_min"] <= p["location"][1] <= box["y_max"]]
            att_box = sum(1 for p in inbox if p["teammate"] and not p["actor"])
            def_box = sum(1 for p in inbox if not p["teammate"] and not p["keeper"])
        side = "izq" if r.y < 40 else "der"
        rows.append({
            "match_id": mid, "team_id": r.team_id, "type": r.subtype, "t": r.t, "minute": r.minute, "x": r.x, "y": r.y,
            "end_x": r.end_x, "end_y": r.end_y, "side": side, "height": r.height, "technique": r.technique,
            "body_part": r.body_part, "short": bool(r.length < 15) if r.length == r.length else False,
            "complete": r.outcome is None or (isinstance(r.outcome, float) and np.isnan(r.outcome)),
            "first_contact_own": fc_team == r.team_id if fc_team is not None else None,
            "fc_x": fc.x.iloc[0] if len(fc) else np.nan, "fc_y": fc.y.iloc[0] if len(fc) else np.nan,
            "shot": len(shots) > 0, "xg": float(shots.xg.sum()), "goal": bool((shots.outcome == "Goal").any()),
            "shot_x": shots.x.iloc[0] if len(shots) else np.nan, "shot_y": shots.y.iloc[0] if len(shots) else np.nan,
            "att_in_box": att_box, "def_in_box": def_box,
        })
    return rows


def process_match(m: dict):
    mid = m["match_id"]
    raw = _load("events", mid)
    if not raw:
        return None
    meta = match_meta(m)
    ev = flatten_events(raw)
    xis = starting_xis(raw)
    if len(xis) < 2:
        return None
    frames = _load("360", mid) if meta["has_360"] else None
    hid, aid = meta["home_id"], meta["away_id"]
    st = build_stints(ev, xis, hid, aid)
    P = build_possessions(ev)
    s360 = summarize_360(frames, ev)
    cnt = match_counters(ev, P, st, s360, hid, aid)
    # contexto por stint y equipo
    st_idx = st.set_index("stint")
    cnt["match_id"] = mid
    cnt["home"] = (cnt.team_id == hid).astype(int)
    gf = np.where(cnt.home == 1, cnt.stint.map(st_idx.home_goals), cnt.stint.map(st_idx.away_goals))
    ga = np.where(cnt.home == 1, cnt.stint.map(st_idx.away_goals), cnt.stint.map(st_idx.home_goals))
    cnt["goal_diff"] = gf - ga
    cnt["t0"] = cnt.stint.map(st_idx.t0)
    cnt["t1"] = cnt.stint.map(st_idx.t1)
    cnt["players"] = [list(st_idx.loc[s, "home_players" if h else "away_players"]) for s, h in zip(cnt.stint, cnt.home)]
    cnt["opp_players"] = [list(st_idx.loc[s, "away_players" if h else "home_players"]) for s, h in zip(cnt.stint, cnt.home)]
    cnt["n_own"] = cnt.players.map(len)
    cnt["n_opp"] = cnt.opp_players.map(len)
    cnt["coach_id"] = np.where(cnt.home == 1, meta["home_coach_id"], meta["away_coach_id"])

    P["match_id"] = mid
    shots = ev[ev.type == "Shot"][["t", "minute", "team_id", "player_id", "player", "x", "y", "xg", "outcome", "subtype", "play_pattern", "body_part", "poss"]].copy()
    shots["match_id"] = mid
    subs = []
    for r in ev[ev.type == "Substitution"].itertuples():
        s = int(np.searchsorted(st.t0.values, r.t, side="right") - 1)
        row = st.iloc[max(s, 0)]
        gd = (row.home_goals - row.away_goals) * (1 if r.team_id == hid else -1)
        subs.append({"match_id": mid, "team_id": r.team_id, "t": r.t, "minute": r.minute, "off_id": r.player_id,
                     "off": r.player, "off_pos": r.position, "on_id": int(r.sub) if r.sub else None,
                     "reason": r.outcome, "goal_diff": gd})
    lu = []
    for f in formations(raw):
        for pid, pos in f["lineup"]:
            lu.append({"match_id": mid, "team_id": f["team_id"], "period": f["period"], "ts": f["ts"],
                       "formation": f["formation"], "player_id": pid, "position": pos})
    names = ev.dropna(subset=["player_id"]).drop_duplicates("player_id")[["player_id", "player", "team_id"]]
    acts = ev[ev.type.isin(["Pass", "Carry", "Shot", "Dribble", "Pressure", "Ball Recovery", "Interception", "Duel", "Block", "Clearance", "Foul Committed"]) & ev.x.notna()]
    acts = acts[["t", "team_id", "player_id", "type", "x", "y", "end_x", "end_y", "outcome", "subtype", "poss", "obv", "cross", "shot_assist", "recipient_id", "counterpress"]].copy()
    acts["match_id"] = mid
    acts["x"] = acts.x.astype("float32"); acts["y"] = acts.y.astype("float32")
    sp = pd.DataFrame(_setpieces(ev, P, frames, mid))
    return {"matches": pd.DataFrame([meta]), "stints": cnt, "possessions": P, "shots": shots,
            "subs": pd.DataFrame(subs), "lineups": pd.DataFrame(lu), "players": names,
            "actions": acts, "setpieces": sp}


def _safe(m):
    try:
        return process_match(m)
    except Exception:
        print("ERROR", m["match_id"], traceback.format_exc(), file=sys.stderr)
        return None


def run(limit: int | None = None, workers: int = 8):
    ms = sb.all_matches()
    ms = [m for m in ms if (sb.DATA / "events" / f"{m['match_id']}.json.gz").exists()]
    if limit:
        ms = ms[:limit]
    acc: dict[str, list] = {}
    with ProcessPoolExecutor(workers) as ex:
        for i, res in enumerate(ex.map(_safe, ms, chunksize=4)):
            if res:
                for k, v in res.items():
                    acc.setdefault(k, []).append(v)
            if i % 100 == 0:
                print(f"{i}/{len(ms)}", flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for k, v in acc.items():
        df = pd.concat([x for x in v if len(x)], ignore_index=True)
        if k == "players":
            df = df.drop_duplicates("player_id", keep="last")
        df.to_parquet(OUT / f"{k}.parquet", index=False)
        print(k, df.shape)


if __name__ == "__main__":
    run(int(sys.argv[1]) if len(sys.argv) > 1 else None)
