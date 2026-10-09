"""Cómo defiende un equipo, a partir de los cuadros 360 (freeze frames) de StatsBomb.

Para cada evento del RIVAL con balón en juego abierto (pase, conducción, recepción, regate o tiro) se mira dónde
están los jugadores de campo del equipo que defiende, vistos desde su propia portería (ataca hacia x = 120):
x' = (120 − x)·105/120, y' = (80 − y)·68/80 (metros reales). Se separa por la situación del rival:

  atras   el rival tiene el balón en su tercio (x_rival < 40): ¿qué tan arriba presiona el equipo?
  medio   el rival en el medio campo (40 ≤ x < 80): bloque medio
  bajo    el rival en el último tercio, el nuestro (x ≥ 80): bloque bajo
  contra  el rival contragolpea (play_pattern «From Counter», en cualquier zona)

El 360 sólo muestra la parte de la cancha que ve la cámara (en promedio 7–8 de los 10 jugadores de campo), por eso
la línea más adelantada y la gente cerca del balón se calculan con >= 6 jugadores visibles, la línea defensiva y el centro
con >= 9; el ancho de la zaga y la forma del bloque (posición media de cada hueco) sólo con los 10 y con la cámara
viendo todo el ancho de la cancha. Los cuadros no traen identidad de jugador: la forma se arma por hueco (línea, puesto
de izquierda a derecha) según la formación más usada del DT en ese club.

  .venv/bin/python -m pipeline.def360   ->  data/model_cache/def360_match.parquet
"""
from __future__ import annotations

import gzip
import json
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PROC = DATA / "processed"
OUT = DATA / "model_cache" / "def360_match.parquet"

SITS = ["atras", "medio", "bajo", "contra"]
KX, KY = 105 / 120, 68 / 80      # StatsBomb usa una cancha de 120 × 80 unidades: aquí todo se pasa a metros reales (105 × 68)
FULL_W = 0.95 * 68               # la cámara «ve» todo el ancho si su zona visible cubre >= 95% de la cancha a lo ancho
EV_OK = {"Pass", "Carry", "Ball Receipt*", "Dribble", "Shot"}
SET_PATTERNS = {"From Corner", "From Free Kick", "From Throw In"}
DEF_SIZES = [4, 3, 3]


def _sizes(form: str | None) -> list[int]:
    try:
        s = [int(c) for c in str(form)]
        return s if sum(s) == 10 else DEF_SIZES
    except Exception:
        return DEF_SIZES


def _slots(pts: np.ndarray, sizes: list[int]) -> np.ndarray:
    """10 jugadores -> 10 huecos ordenados por línea (de atrás hacia delante) y de izquierda a derecha."""
    pts = pts[np.argsort(pts[:, 0])]
    out, i = [], 0
    for n in sizes:
        g = pts[i:i + n]
        out.append(g[np.argsort(g[:, 1])])
        i += n
    return np.vstack(out)


def _match(args):
    mid, sizes_by_team, act_by_team = args
    p360, pev = DATA / "360" / f"{mid}.json.gz", DATA / "events" / f"{mid}.json.gz"
    if not (p360.exists() and pev.exists()):
        return []
    ev = {e["id"]: e for e in json.load(gzip.open(pev, "rt"))}
    frames = json.load(gzip.open(p360, "rt"))
    teams = sorted({e["team"]["id"] for e in ev.values() if "team" in e})
    if len(teams) != 2:
        return []
    acc: dict = {}
    for fr in frames:
        e = ev.get(fr["event_uuid"])
        if e is None or e["type"]["name"] not in EV_OK or e.get("period", 1) >= 5 or "location" not in e:
            continue
        pp = e.get("play_pattern", {}).get("name", "")
        if pp in SET_PATTERNS or pp in ("From Kick Off",):
            continue
        att = e["team"]["id"]
        d = teams[1] if att == teams[0] else teams[0]
        ex, ey = e["location"][0], e["location"][1]
        sit = "contra" if pp == "From Counter" else ("atras" if ex < 40 else "medio" if ex < 80 else "bajo")
        ours = np.array([p["location"] for p in fr["freeze_frame"] if not p["teammate"] and not p["keeper"]], dtype=float)
        va = np.asarray(fr["visible_area"], dtype=float).reshape(-1, 2) if fr.get("visible_area") else None
        full_w = bool(va is not None and len(va) and (va[:, 1].max() - va[:, 1].min()) * KY >= FULL_W)
        a = acc.setdefault((d, sit), {"n": 0, "n6": 0, "n9": 0, "n9w": 0, "back": [], "front": [], "wid": [], "cent": [], "near": [], "bx": [], "by": [], "slots": np.zeros((10, 2)), "n10": 0})
        a["n"] += 1
        if len(ours) < 6:
            continue
        xs = (120 - ours[:, 0]) * KX
        ys = (80 - ours[:, 1]) * KY
        o = np.argsort(xs)
        bx, by = (120 - ex) * KX, (80 - ey) * KY
        # con >= 6 visibles: línea más adelantada y gente cerca del balón (los lejanos no entran a la cámara y no cambian estas dos)
        a["n6"] += 1
        a["front"].append(xs[o[-3:]].mean())
        a["near"].append(int((np.hypot(xs - bx, ys - by) <= 15).sum()))   # 15 m reales
        a["bx"].append(bx)
        a["by"].append(by)
        if len(ours) < 9:
            continue
        # con >= 9 visibles: línea defensiva, ancho y centroide
        a["n9"] += 1
        a["back"].append(xs[o[:4]].mean())
        a["cent"].append(xs.mean())
        # lo lateral (ancho y huecos) sólo con la cámara viendo todo el ancho: si no, los extremos quedan fuera de cuadro y el bloque sale más angosto
        if full_w:
            a["n9w"] += 1
            a["wid"].append(ys[o[:4]].max() - ys[o[:4]].min())
        # los huecos sólo cuentan si ese día el equipo jugó la formación habitual del DT (si no, «hueco 4» no es el mismo puesto)
        if len(ours) == 10 and full_w and act_by_team.get(d) == sizes_by_team.get(d, DEF_SIZES):
            a["slots"] += _slots(np.column_stack([xs, ys]), sizes_by_team.get(d, DEF_SIZES))
            a["n10"] += 1
    rows = []
    for (d, sit), a in acc.items():
        if a["n6"] == 0:
            continue
        m = lambda v: float(np.median(v)) if len(v) else float("nan")  # noqa: E731
        r = {"match_id": mid, "team_id": d, "sit": sit, "n": a["n"], "n6": a["n6"], "n9": a["n9"], "n9w": a["n9w"], "n10": a["n10"],
             "back": m(a["back"]), "front": m(a["front"]), "wid": m(a["wid"]), "cent": m(a["cent"]), "near": m(a["near"]), "bx": m(a["bx"]), "by": m(a["by"])}
        for i in range(10):
            r[f"sx{i}"] = float(a["slots"][i, 0])
            r[f"sy{i}"] = float(a["slots"][i, 1])
        rows.append(r)
    return rows


def modal_sizes() -> dict:
    """(match_id) -> {team_id: tamaños de línea} con la formación más usada del DT de ese equipo."""
    M = pd.read_parquet(PROC / "matches.parquet")
    LU = pd.read_parquet(PROC / "lineups.parquet", columns=["match_id", "team_id", "period", "formation"])
    first = LU[LU.period == 1].drop_duplicates(["match_id", "team_id"])[["match_id", "team_id", "formation"]]
    rows = []
    for m in M.itertuples():
        rows.append((m.match_id, m.home_id, m.home_coach_id))
        rows.append((m.match_id, m.away_id, m.away_coach_id))
    R = pd.DataFrame(rows, columns=["match_id", "team_id", "coach"]).merge(first, on=["match_id", "team_id"], how="left")
    mode = R.dropna(subset=["formation"]).groupby(["coach", "team_id"]).formation.agg(lambda s: s.value_counts().index[0]).rename("modal")
    R = R.merge(mode.reset_index(), on=["coach", "team_id"], how="left")
    R["sizes"] = [_sizes(m if isinstance(m, str) else f) for m, f in zip(R.modal, R.formation)]
    out: dict = {}
    for r in R.itertuples():
        out.setdefault(int(r.match_id), {})[int(r.team_id)] = r.sizes
    return out


def actual_sizes() -> dict:
    """(match_id) -> {team_id: tamaños de línea} con la formación que de verdad jugó ese equipo en ese partido (inicio del partido)."""
    LU = pd.read_parquet(PROC / "lineups.parquet", columns=["match_id", "team_id", "period", "ts", "formation"])
    first = LU[LU.period == 1].sort_values("ts").drop_duplicates(["match_id", "team_id"])
    out: dict = {}
    for r in first.itertuples():
        out.setdefault(int(r.match_id), {})[int(r.team_id)] = _sizes(r.formation)
    return out


def run(refresh: bool = False) -> pd.DataFrame:
    """Incremental: sólo procesa los partidos 360 que aún no están en la caché (refresh=True los rehace todos)."""
    old = None
    if OUT.exists() and not refresh:
        old = pd.read_parquet(OUT)
    sizes = modal_sizes()
    act = actual_sizes()
    mids = sorted(int(p.name.split(".")[0]) for p in (DATA / "360").glob("*.json.gz"))
    if old is not None:
        done = set(old.match_id.unique())
        mids = [m for m in mids if m not in done]
        if not mids:
            return old
    rows = []
    with ProcessPoolExecutor() as ex:
        for i, r in enumerate(ex.map(_match, [(m, sizes.get(m, {}), act.get(m, {})) for m in mids], chunksize=4)):
            rows += r
            if i % 200 == 0:
                print(f"{i}/{len(mids)}", flush=True)
    df = pd.DataFrame(rows)
    if old is not None:
        df = pd.concat([old, df], ignore_index=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUT)
    return df


# ---------------------------------------------------------------- con balón: forma del equipo y quién ocupa cada hueco
OWN = DATA / "model_cache" / "own360_match.parquet"


def _own(args):
    """Por (partido, equipo): posición media de cada hueco cuando el equipo tiene el balón (cuadros de SUS eventos en juego abierto con los
    10 jugadores de campo visibles y la cámara viendo todo el ancho) y, con el actor del evento (que sí trae identidad), cuántas veces
    cada jugador ocupó cada hueco. Esto reemplaza el dibujo «de manual»: la forma y el puesto salen de los datos."""
    mid, sizes_by_team, act_by_team = args
    p360, pev = DATA / "360" / f"{mid}.json.gz", DATA / "events" / f"{mid}.json.gz"
    if not (p360.exists() and pev.exists()):
        return []
    ev = {e["id"]: e for e in json.load(gzip.open(pev, "rt"))}
    acc: dict = {}
    for fr in json.load(gzip.open(p360, "rt")):
        e = ev.get(fr["event_uuid"])
        if e is None or e["type"]["name"] not in EV_OK or e.get("period", 1) >= 5 or "location" not in e or "player" not in e:
            continue
        pp = e.get("play_pattern", {}).get("name", "")
        if pp in SET_PATTERNS or pp in ("From Kick Off", "From Counter") or e["location"][0] < 60:
            continue       # ataque claro: balón en campo rival y sin contragolpe (en las transiciones el equipo está a medio camino)
        att = e["team"]["id"]
        if act_by_team.get(att) != sizes_by_team.get(att, DEF_SIZES):
            continue
        pl = [p for p in fr["freeze_frame"] if p["teammate"] and not p["keeper"]]
        if len(pl) != 10:
            continue
        va = np.asarray(fr["visible_area"], dtype=float).reshape(-1, 2) if fr.get("visible_area") else None
        if not (va is not None and len(va) and (va[:, 1].max() - va[:, 1].min()) * KY >= FULL_W):
            continue
        pts = np.array([[p["location"][0] * KX, p["location"][1] * KY] for p in pl])
        sl = _slots(pts, sizes_by_team.get(att, DEF_SIZES))
        a = acc.setdefault(att, {"n": 0, "slots": np.zeros((10, 2)), "act": {}})
        a["n"] += 1
        a["slots"] += sl
        ac = [p for p in pl if p.get("actor")]
        if ac:
            q = np.array([ac[0]["location"][0] * KX, ac[0]["location"][1] * KY])
            k = int(np.argmin(np.hypot(sl[:, 0] - q[0], sl[:, 1] - q[1])))
            d = a["act"].setdefault(int(e["player"]["id"]), {})
            d[k] = d.get(k, 0) + 1
    rows = []
    for t, a in acc.items():
        r = {"match_id": mid, "team_id": t, "n10": a["n"], "act": json.dumps(a["act"])}
        for i in range(10):
            r[f"sx{i}"] = float(a["slots"][i, 0])
            r[f"sy{i}"] = float(a["slots"][i, 1])
        rows.append(r)
    return rows


def run_own(refresh: bool = False) -> pd.DataFrame:
    old = pd.read_parquet(OWN) if OWN.exists() and not refresh else None
    sizes = modal_sizes()
    act = actual_sizes()
    mids = sorted(int(p.name.split(".")[0]) for p in (DATA / "360").glob("*.json.gz"))
    if old is not None:
        mids = [m for m in mids if m not in set(old.match_id.unique())]
        if not mids:
            return old
    rows = []
    with ProcessPoolExecutor() as ex:
        for i, r in enumerate(ex.map(_own, [(m, sizes.get(m, {}), act.get(m, {})) for m in mids], chunksize=4)):
            rows += r
            if i % 200 == 0:
                print(f"own {i}/{len(mids)}", flush=True)
    df = pd.DataFrame(rows)
    if old is not None:
        df = pd.concat([old, df], ignore_index=True)
    df.to_parquet(OWN)
    return df


if __name__ == "__main__":
    d = run(refresh=True)
    run_own(refresh=True)
    print(d.groupby("sit").agg(partidos=("match_id", "nunique"), n=("n", "sum"), n6=("n6", "sum"), n9=("n9", "sum"), n10=("n10", "sum"), back=("back", "median"), front=("front", "median"), near=("near", "median")))
