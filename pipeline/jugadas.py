"""Jugadas tipo de ataque: cómo se construye y cómo termina cada jugada efectiva.

Una «jugada efectiva» es una posesión en juego abierto (sin balón parado ni penales) que termina en tiro o llega al
área rival. Cada una se clasifica en DOS ejes que no se pisan entre sí, para que ningún tipo se coma a otro
(una construcción paciente puede terminar en centro, y las dos cosas se ven):

  CÓMO SE ARMA (dónde y a qué ritmo nace; un solo tipo por jugada, en este orden de prioridad)
    recup_alta   recupera en campo rival (x >= 60) y remata o entra al área en <= 14 s
    contra       contragolpe (StatsBomb «From Counter») o ataque vertical: <= 12 s, empieza en su mitad o poco más,
                 avanza >= 35 m y no es de banda
    largo        balón largo hacia delante (>= 32 m, >= 20 m de avance) en las 3 primeras acciones, <= 20 s
    salida       nace en su propio tercio (x < 40) y avanza con pases
    medio        el resto: nace en el medio campo y se construye con pases

  CÓMO TERMINA (la última parte de la jugada; un solo tipo por jugada, en este orden de prioridad)
    centro_diag  centro o pase diagonal desde la banda hacia el área (completo o que acaba en tiro) en las últimas 4 acciones
    lejos        tiro desde fuera del área
    conduccion   una conducción o regate mete el balón al área en las últimas 3 acciones
    pase_area    el resto: pase al área por dentro (paredes, pases filtrados)

Son reglas explícitas sobre data/processed/{possessions,actions,shots}, no un modelo.

  .venv/bin/python -m pipeline.jugadas   ->  data/model_cache/jugadas_poss.parquet
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from pipeline.paths import MODEL_CACHE, PROC

ROOT = Path(__file__).resolve().parents[1]
CACHE = MODEL_CACHE / "jugadas_poss.parquet"

# (id, es, en, qué es es, qué es en)
BUILD = [
    ("recup_alta", "Recuperación alta", "High win-back",
     "Recupera el balón en campo rival y remata o entra al área en menos de 14 segundos.",
     "Wins the ball in the opponent's half and shoots or reaches the box within 14 seconds."),
    ("contra", "Contragolpe y ataque vertical", "Counter-attack and vertical play",
     "Contragolpe, o ataque directo por el centro: menos de 12 segundos y 35 m o más de avance desde su campo.",
     "A counter-attack, or a direct move through the middle: under 12 seconds and 35 m or more gained from its own half."),
    ("largo", "Balón largo", "Long ball",
     "Un pase largo hacia delante en las primeras acciones, y de ahí nace el peligro.",
     "A long forward pass in the first actions, and the danger comes from there."),
    ("salida", "Salida desde atrás", "Build-up from the back",
     "La jugada nace en su propio tercio (saque de meta, portero, recuperación atrás) y avanza con pases hasta el peligro.",
     "The move starts in its own third (goal kick, keeper, a win-back deep) and moves forward with passes until it creates danger."),
    ("medio", "Juego desde el medio campo", "Play from midfield",
     "La jugada nace en el medio campo, sin prisa y sin balón largo, y se construye con pases hasta el área.",
     "The move starts in midfield, with no hurry and no long ball, and is built with passes until the box."),
]
FINISH = [
    ("centro_diag", "Centros y pases diagonales", "Crosses and diagonal passes",
     "El peligro llega con un centro o un pase diagonal desde la banda hacia el área.",
     "The danger comes from a cross or a diagonal pass from the flank into the box."),
    ("conduccion", "Conducción al área", "Carry into the box",
     "Un jugador mete el balón al área conduciéndolo o regateando.",
     "A player takes the ball into the box by carrying or dribbling it."),
    ("pase_area", "Pase al área por dentro", "Pass into the box through the middle",
     "El balón entra al área con un pase por dentro: paredes, pases filtrados, combinaciones.",
     "The ball enters the box with a pass through the middle: one-twos, through balls, combinations."),
    ("lejos", "Remate de lejos", "Long-range shot",
     "Tiro desde fuera del área.",
     "A shot from outside the box."),
]
BUILD_IDS = [c[0] for c in BUILD]
FINISH_IDS = [c[0] for c in FINISH]
CAT_IDS = BUILD_IDS + FINISH_IDS


def classify(refresh: bool = False) -> pd.DataFrame:
    """Una fila por posesión efectiva de juego abierto, con su categoría."""
    if CACHE.exists() and not refresh:
        return pd.read_parquet(CACHE)
    P = pd.read_parquet(PROC / "possessions.parquet")
    A = pd.read_parquet(PROC / "actions.parquet")
    SH = pd.read_parquet(PROC / "shots.parquet")
    k = ["match_id", "team_id", "poss"]
    op = P[(~P.set_piece) & (P.shot | P.reach_box)].copy()
    pen = SH[SH.subtype == "Penalty"][k + ["x"]].drop_duplicates(k)  # los penales no son una jugada: fuera
    op = op.merge(pen[k].assign(_pen=1), on=k, how="left")
    op = op[op._pen.isna()].drop(columns="_pen")
    sh = SH.sort_values("t").groupby(k).tail(1)[k + ["x", "y"]].rename(columns={"x": "sx", "y": "sy"})
    op = op.merge(sh, on=k, how="left")

    Ao = A[A.type.isin(["Pass", "Carry", "Shot"])].merge(op[k], on=k).sort_values(k + ["t"])
    # últimas 4 acciones: ¿hubo centro o pase atrás desde la banda?
    tail = Ao.groupby(k).tail(4)
    p = tail[(tail.type == "Pass") & (tail.outcome.isna() | (tail.shot_assist == True))]  # noqa: E712  (completo o asistencia de tiro)
    cross = p[p.cross == True].groupby(k).size().rename("cross").reset_index()  # noqa: E712
    cb = p[(p.x >= 100) & ((p.y < 26) | (p.y > 54)) & (p.end_x < p.x - 2) & (p.end_x >= 88)].groupby(k).size().rename("cutback").reset_index()
    # balón largo en las 3 primeras acciones
    f3 = Ao.groupby(k).head(3)
    fp = f3[f3.type == "Pass"]
    L = np.hypot(fp.end_x - fp.x, fp.end_y - fp.y)
    lg = fp[(L >= 32) & ((fp.end_x - fp.x) >= 20)].groupby(k).size().rename("longball").reset_index()
    op = op.merge(cross, on=k, how="left").merge(cb, on=k, how="left").merge(lg, on=k, how="left")
    for c in ["cross", "cutback", "longball"]:
        op[c] = op[c].fillna(0) > 0

    # conducción o regate que mete el balón al área en las últimas 3 acciones
    ca = Ao.groupby(k).tail(3)
    ca = ca[ca.type.isin(["Carry", "Dribble"]) & (ca.end_x >= 102) & ca.end_y.between(18, 62) & (ca.x < 102)]
    ca = ca.groupby(k).size().rename("carbox").reset_index()
    op = op.merge(ca, on=k, how="left")
    op["carbox"] = op.carbox.fillna(0) > 0

    fwd = op.max_x - op.start_x
    outside = op.shot & ((op.sx < 102) | (op.sy < 18) | (op.sy > 62))
    op["arma"] = np.select(
        [op.recovery_start & (op.start_x >= 60) & (op.dur <= 14),
         (op.play_pattern == "From Counter") | ((op.dur <= 12) & (op.start_x <= 62) & (fwd >= 35) & (op.wide_share < 0.5)),
         op.longball & (op.dur <= 20),
         op.start_x < 40],
        ["recup_alta", "contra", "largo", "salida"], "medio")
    op["termina"] = np.select([op.cross | op.cutback, outside, op.carbox], ["centro_diag", "lejos", "conduccion"], "pase_area")
    cols = k + ["arma", "termina", "t0", "t1", "dur", "n_pass", "start_x", "max_x", "xg", "obv", "goal", "shot", "reach_box", "play_pattern", "sx", "sy"]
    out = op[cols].reset_index(drop=True)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(CACHE)
    return out


if __name__ == "__main__":
    d = classify(refresh=True)
    for b in ["arma", "termina"]:
        t = d.groupby(b).agg(n=("xg", "size"), xg=("xg", "sum"), obv=("obv", "sum"), pases=("n_pass", "median"), dur=("dur", "median"))
        t["%n"] = (100 * t.n / t.n.sum()).round(1)
        print(t.reindex(BUILD_IDS if b == "arma" else FINISH_IDS).round(2), "\n")
    print(pd.crosstab(d.arma, d.termina, normalize="index").round(2))
    print(len(d), "posesiones efectivas")
