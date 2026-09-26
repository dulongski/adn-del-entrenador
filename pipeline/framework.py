"""Objetos del marco analítico (sección 5.6).

Todo lo que se mide en el proyecto se deriva de los objetos definidos aquí:
  - Evento aplanado (con tiempo transcurrido continuo `t`)
  - Posesión            -> build_possessions
  - Stint / Segmento    -> build_stints
  - Acción progresiva   -> is_progressive
  - Fase de presión     -> press_phases
  - Resumen 360 (línea) -> summarize_360
Los umbrales viven en config/framework.yaml.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]


@lru_cache
def CFG() -> dict:
    return yaml.safe_load(open(ROOT / "config" / "framework.yaml"))


def _g(d, *keys):
    for k in keys:
        if d is None:
            return None
        d = d.get(k) if isinstance(d, dict) else None
    return d


def _ts(s: str) -> float:
    h, m, sec = s.split(":")
    return int(h) * 3600 + int(m) * 60 + float(sec)


BALL_ACTIONS = {"Pass", "Carry", "Shot", "Dribble"}
DEF_ACTIONS = {"Duel", "Interception", "Ball Recovery", "Block", "Clearance", "Foul Committed", "Pressure"}


# ---------------------------------------------------------------- eventos
def flatten_events(raw: list[dict]) -> pd.DataFrame:
    rows = []
    for e in raw:
        t = e["type"]["name"]
        loc = e.get("location") or [np.nan, np.nan]
        r = {
            "id": e["id"], "index": e["index"], "period": e["period"], "ts": _ts(e["timestamp"]),
            "minute": e["minute"], "type": t,
            "team_id": e["team"]["id"], "team": e["team"]["name"],
            "poss": e["possession"], "poss_team_id": e["possession_team"]["id"],
            "play_pattern": e["play_pattern"]["name"],
            "player_id": _g(e, "player", "id"), "player": _g(e, "player", "name"),
            "position": _g(e, "position", "name"),
            "x": loc[0], "y": loc[1], "end_x": np.nan, "end_y": np.nan,
            "under_pressure": bool(e.get("under_pressure", False)),
            "counterpress": bool(e.get("counterpress", False)),
            "obv": e.get("obv_total_net"),
            "sub": None, "outcome": None, "subtype": None, "length": np.nan,
            "height": None, "cross": False, "switch": False, "through": False, "cutback": False,
            "shot_assist": False, "xg": np.nan, "card": None, "recipient_id": None,
            "technique": None, "body_part": None, "aerial_won": False,
        }
        if t == "Pass":
            p = e["pass"]
            end = p.get("end_location") or [np.nan, np.nan]
            r.update(end_x=end[0], end_y=end[1], length=p.get("length"),
                     outcome=_g(p, "outcome", "name"), subtype=_g(p, "type", "name"),
                     height=_g(p, "height", "name"), cross=bool(p.get("cross")),
                     switch=bool(p.get("switch")), through=bool(p.get("through_ball")) or _g(p, "technique", "name") == "Through Ball",
                     cutback=bool(p.get("cut_back")),
                     shot_assist=bool(p.get("shot_assist") or p.get("goal_assist")),
                     recipient_id=_g(p, "recipient", "id"), technique=_g(p, "technique", "name"),
                     body_part=_g(p, "body_part", "name"))
        elif t == "Carry":
            end = _g(e, "carry", "end_location") or [np.nan, np.nan]
            r.update(end_x=end[0], end_y=end[1])
        elif t == "Shot":
            s = e["shot"]
            end = s.get("end_location") or [np.nan, np.nan]
            r.update(end_x=end[0], end_y=end[1], xg=s.get("statsbomb_xg"),
                     outcome=_g(s, "outcome", "name"), subtype=_g(s, "type", "name"),
                     body_part=_g(s, "body_part", "name"), technique=_g(s, "technique", "name"))
        elif t == "Duel":
            r.update(subtype=_g(e, "duel", "type", "name"), outcome=_g(e, "duel", "outcome", "name"))
        elif t == "Interception":
            r.update(outcome=_g(e, "interception", "outcome", "name"))
        elif t == "Ball Recovery":
            r.update(outcome="Failed" if _g(e, "ball_recovery", "recovery_failure") else "Success")
        elif t == "Dribble":
            r.update(outcome=_g(e, "dribble", "outcome", "name"))
        elif t == "Foul Committed":
            r.update(card=_g(e, "foul_committed", "card", "name"))
        elif t == "Bad Behaviour":
            r.update(card=_g(e, "bad_behaviour", "card", "name"))
        elif t == "Substitution":
            r.update(sub=_g(e, "substitution", "replacement", "id"), outcome=_g(e, "substitution", "outcome", "name"))
        elif t == "Goal Keeper":
            r.update(subtype=_g(e, "goalkeeper", "type", "name"), outcome=_g(e, "goalkeeper", "outcome", "name"))
        elif t == "Clearance":
            r.update(aerial_won=bool(_g(e, "clearance", "aerial_won")))
        elif t == "Miscontrol":
            r.update(aerial_won=bool(_g(e, "miscontrol", "aerial_won")))
        rows.append(r)
    ev = pd.DataFrame(rows)
    ev = ev[ev.period <= 4].copy()
    plen = ev.groupby("period").ts.max()
    off = plen.cumsum().shift(fill_value=0)
    ev["t"] = ev.ts + ev.period.map(off)
    ev = ev.sort_values(["t", "index"]).reset_index(drop=True)
    for c in ["x", "y", "end_x", "end_y", "length", "xg", "obv"]:
        ev[c] = pd.to_numeric(ev[c], errors="coerce")
    return ev


def starting_xis(raw: list[dict]) -> dict[int, dict]:
    out = {}
    for e in raw:
        if e["type"]["name"] == "Starting XI":
            out[e["team"]["id"]] = {
                "formation": e["tactics"]["formation"],
                "players": {p["player"]["id"]: p["position"]["name"] for p in e["tactics"]["lineup"]},
            }
    return out


def formations(raw: list[dict]) -> list[dict]:
    """Formación declarada (Starting XI + Tactical Shift) con tiempo de inicio."""
    out = []
    for e in raw:
        if e["type"]["name"] in ("Starting XI", "Tactical Shift") and e["period"] <= 4:
            out.append({"team_id": e["team"]["id"], "period": e["period"], "ts": _ts(e["timestamp"]),
                        "formation": str(e["tactics"]["formation"]),
                        "lineup": [(p["player"]["id"], p["position"]["name"]) for p in e["tactics"]["lineup"]]})
    return out


# ---------------------------------------------------------------- acción progresiva
def is_progressive(ev: pd.DataFrame) -> pd.Series:
    c = CFG()["pase_progresivo"]
    gx, gy = 120.0, 40.0
    d0 = np.hypot(gx - ev.x, gy - ev.y)
    d1 = np.hypot(gx - ev.end_x, gy - ev.end_y)
    ok_pass = (ev.type == "Pass") & ev.outcome.isna() & ~ev.subtype.isin(["Corner", "Free Kick", "Throw-in", "Goal Kick", "Kick Off"])
    ok_carry = (ev.type == "Carry") & (np.hypot(ev.end_x - ev.x, ev.end_y - ev.y) >= c["min_carry_length"])
    return (ok_pass | ok_carry) & (d1 <= (1 - c["min_gain_ratio"]) * d0) & (ev.end_x >= c["min_end_x"])


# ---------------------------------------------------------------- stints
def build_stints(ev: pd.DataFrame, xis: dict, home_id: int, away_id: int) -> pd.DataFrame:
    """Stint = intervalo sin cambios en los 22 jugadores en cancha ni en el marcador."""
    on = {tid: set(xis[tid]["players"]) for tid in (home_id, away_id) if tid in xis}
    score = {home_id: 0, away_id: 0}
    t_end = float(ev.t.max())
    changes = []
    for r in ev.itertuples():
        ch = False
        if r.type == "Substitution" and r.sub is not None and r.team_id in on:
            on[r.team_id].discard(r.player_id)
            on[r.team_id].add(int(r.sub))
            ch = True
        elif r.card in ("Red Card", "Second Yellow") and r.team_id in on and r.player_id is not None:
            on[r.team_id].discard(r.player_id)
            ch = True
        elif r.type == "Shot" and r.outcome == "Goal":
            score[r.team_id] += 1
            ch = True
        elif r.type == "Own Goal For":
            score[r.team_id] += 1
            ch = True
        if ch:
            changes.append((r.t, {k: frozenset(v) for k, v in on.items()}, dict(score)))
    # colapsar cambios en el mismo instante
    bounds = [(0.0, {k: frozenset(v) for k, v in {tid: set(xis[tid]["players"]) for tid in on}.items()}, {home_id: 0, away_id: 0})]
    for t, o, s in changes:
        if abs(t - bounds[-1][0]) < 1e-6:
            bounds[-1] = (bounds[-1][0], o, s)
        else:
            bounds.append((t, o, s))
    rows = []
    for i, (t0, o, s) in enumerate(bounds):
        t1 = bounds[i + 1][0] if i + 1 < len(bounds) else t_end
        if t1 - t0 <= 0:
            continue
        rows.append({"t0": t0, "t1": t1, "dur": t1 - t0,
                     "home_players": tuple(sorted(o.get(home_id, ()))),
                     "away_players": tuple(sorted(o.get(away_id, ()))),
                     "home_goals": s[home_id], "away_goals": s[away_id]})
    st = pd.DataFrame(rows)
    st["stint"] = np.arange(len(st))
    return st


def segments_from_stints(st: pd.DataFrame, min_dur: float | None = None) -> pd.Series:
    """Segmento de modelado: stints consecutivos fusionados hasta durar >= min_duration_s.
    Devuelve el id de segmento para cada stint."""
    min_dur = min_dur or CFG()["stint"]["min_duration_s"]
    seg, acc, cur = [], 0.0, 0
    for d in st.dur:
        seg.append(cur)
        acc += d
        if acc >= min_dur:
            cur += 1
            acc = 0.0
    seg = np.array(seg)
    # el último segmento corto se une al anterior
    if acc > 0 and cur > 0 and (seg == cur).any():
        seg[seg == cur] = cur - 1
    return pd.Series(seg, index=st.index)


def assign_stint(ev: pd.DataFrame, st: pd.DataFrame) -> pd.Series:
    return pd.Series(np.searchsorted(st.t0.values, ev.t.values, side="right") - 1, index=ev.index).clip(lower=0)


# ---------------------------------------------------------------- posesiones
SET_PIECE_PATTERNS = {"From Corner", "From Free Kick", "From Throw In"}


def build_possessions(ev: pd.DataFrame) -> pd.DataFrame:
    """Posesión = id StatsBomb con al menos una acción propia con balón del possession_team."""
    fcfg = CFG()["pitch"]
    box = fcfg["box"]
    win = CFG()["transicion"]["window_s"]
    own = ev[(ev.team_id == ev.poss_team_id)]
    ball = own[own.type.isin(BALL_ACTIONS)]
    valid = ball.groupby("poss").size()
    valid = set(valid[valid >= CFG()["posesion"]["min_own_ball_actions"]].index)
    rows = []
    prog = is_progressive(ev)
    for pid, g in own.groupby("poss", sort=True):
        if pid not in valid:
            continue
        gb = g[g.type.isin(BALL_ACTIONS)]
        first = g.iloc[0]
        completed = (gb.type == "Carry") | ((gb.type == "Pass") & gb.outcome.isna())
        ex = np.where(completed, gb.end_x, gb.x)
        ey = np.where(completed, gb.end_y, gb.y)
        xs = np.concatenate([gb.x.values, ex])
        max_x = np.nanmax(xs) if len(xs) else first.x
        # tiempo hasta el último tercio
        reach = gb[(np.maximum(gb.x.fillna(0), np.where(completed, gb.end_x, 0)) >= fcfg["final_third_min_x"])]
        t_f3 = (reach.t.iloc[0] - first.t) if len(reach) else np.nan
        in_box = ((ex >= box["x_min"]) & (ey >= box["y_min"]) & (ey <= box["y_max"])).any() | \
                 ((gb.x >= box["x_min"]) & (gb.y >= box["y_min"]) & (gb.y <= box["y_max"])).any()
        seglen = np.hypot(gb.end_x - gb.x, gb.end_y - gb.y).where(completed, 0).fillna(0)
        shots = g[g.type == "Shot"]
        np_shots = shots[shots.subtype != "Penalty"]
        wide = ((gb.y < fcfg["wide_lane"]["y_low"]) | (gb.y > fcfg["wide_lane"]["y_high"])).mean()
        rows.append({
            "poss": pid, "team_id": first.team_id, "t0": first.t, "t1": g.t.iloc[-1],
            "dur": g.t.iloc[-1] - first.t, "play_pattern": first.play_pattern,
            "start_type": first.type, "start_x": first.x, "start_y": first.y,
            "end_x": gb.end_x.iloc[-1] if completed.iloc[-1] else gb.x.iloc[-1], "max_x": max_x,
            "n_pass": int((gb.type == "Pass").sum()), "n_pass_ok": int(((gb.type == "Pass") & gb.outcome.isna()).sum()),
            "n_carry": int((gb.type == "Carry").sum()), "n_prog": int(prog.loc[gb.index].sum()),
            "path": float(seglen.sum()), "wide_share": float(wide),
            "reach_f3": bool(max_x >= fcfg["final_third_min_x"]), "t_to_f3": t_f3,
            "reach_box": bool(in_box), "shot": len(np_shots) > 0,
            "xg": float(np_shots.xg.sum()), "goal": bool((shots.outcome == "Goal").any()),
            "obv": float(g.obv.fillna(0).sum()),
            "set_piece": first.play_pattern in SET_PIECE_PATTERNS,
            "gk_start": first.play_pattern in ("From Goal Kick", "From Keeper"),
        })
    P = pd.DataFrame(rows)
    if P.empty:
        return P
    P = P.sort_values("t0").reset_index(drop=True)
    # Transición ofensiva: posesión en juego abierto que sigue a una posesión rival (recuperación)
    P["recovery_start"] = P.play_pattern.isin(["Regular Play", "From Counter"]) & (P.team_id.shift(1) != P.team_id) & P.index.to_series().gt(0)
    P["fast_break"] = P.recovery_start & (P.t_to_f3 <= win)
    # cómo termina: pérdida en juego (la siguiente posesión es del rival en juego abierto)
    nxt_team = P.team_id.shift(-1)
    nxt_pat = P.play_pattern.shift(-1)
    P["lost_open"] = (nxt_team != P.team_id) & nxt_pat.isin(["Regular Play", "From Counter"])
    P["next_fast_break_against"] = P.lost_open & P.fast_break.shift(-1, fill_value=False)
    return P


# ---------------------------------------------------------------- presión
def press_phases(ev: pd.DataFrame) -> pd.DataFrame:
    gap = CFG()["presion"]["chain_gap_s"]
    pr = ev[ev.type == "Pressure"].sort_values("t")
    out = []
    for tid, g in pr.groupby("team_id"):
        ph = (g.t.diff() > gap).cumsum()
        for k, h in g.groupby(ph):
            out.append({"team_id": tid, "t0": h.t.iloc[0], "t1": h.t.iloc[-1],
                        "n": len(h), "x": h.x.mean(), "counterpress": bool(h.counterpress.any())})
    return pd.DataFrame(out)


# ---------------------------------------------------------------- 360
def summarize_360(frames: list[dict] | None, ev: pd.DataFrame) -> pd.DataFrame:
    """Por evento con 360 de la fase de posesión rival: altura de línea y compacidad del
    equipo que defiende (en SU sistema de coordenadas)."""
    if not frames:
        return pd.DataFrame(columns=["id", "def_team_id", "line_h", "compact", "n_def"])
    c = CFG()["bloque_360"]
    meta = ev.set_index("id")[["team_id", "poss_team_id", "type"]]
    rows = []
    for f in frames:
        eid = f["event_uuid"]
        if eid not in meta.index:
            continue
        m = meta.loc[eid]
        if m.team_id != m.poss_team_id or m.type not in ("Pass", "Carry", "Ball Receipt*"):
            continue
        xs = [120 - p["location"][0] for p in f["freeze_frame"] if not p["teammate"] and not p["keeper"]]
        if len(xs) < c["min_visible_defenders"]:
            continue
        xs.sort()
        rows.append({"id": eid, "def_team_id": None, "line_h": float(np.mean(xs[: c["n_defenders"]])),
                     "compact": float(xs[-1] - xs[0]) if len(xs) >= 6 else np.nan, "n_def": len(xs),
                     "atk_team_id": int(m.team_id)})
    return pd.DataFrame(rows)
