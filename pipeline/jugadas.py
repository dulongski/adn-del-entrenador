"""Jugadas tipo de ataque: qué mecanismo usa un equipo para crear peligro.

Una «jugada efectiva» es una posesión en juego abierto (sin balón parado) que termina en tiro o llega al
área rival. Se clasifica por la INTENCIÓN con que se creó el peligro, en este orden de prioridad:

  centros       centro o pase atrás desde la banda en las últimas acciones
  recup_alta    recupera en campo rival (x >= 60) y remata/entra al área en <= 14 s
  rapido        contragolpe (StatsBomb «From Counter») o ataque vertical por el centro: <= 12 s, empieza
                en su mitad o poco más, avanza >= 35 m y no es de banda
  largo         balón largo hacia delante (>= 32 m, >= 20 m de avance) en las 3 primeras acciones
  paciente      >= 8 pases
  lejos         tiro desde fuera del área (el resto de las jugadas con tiro lejano)
  combinacion   el resto: combinaciones cortas que llegan al área

No es un modelo: son reglas explícitas sobre data/processed/{possessions,actions,shots}. Nada de esto entra a la
descomposición (que no se reajusta).

  .venv/bin/python -m pipeline.jugadas   ->  data/model_cache/jugadas_poss.parquet
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
CACHE = ROOT / "data" / "model_cache" / "jugadas_poss.parquet"

CATS = [
    # id, es, en, qué es (es), qué es (en)
    ("centros", "Centros y pases atrás", "Crosses and cut-backs",
     "La jugada termina con un centro o un pase atrás desde la banda hacia el área.",
     "The move ends with a cross or a cut-back from the flank into the box."),
    ("recup_alta", "Recuperación alta y remate", "High win-back and finish",
     "Recupera el balón en campo rival y remata o entra al área en menos de 14 segundos.",
     "Wins the ball in the opponent's half and shoots or reaches the box within 14 seconds."),
    ("rapido", "Contragolpe y ataque vertical", "Counter-attack and vertical play",
     "Contragolpe, o ataque directo por el centro: menos de 12 segundos, avanza 35 m o más desde su campo.",
     "A counter-attack, or a direct move through the middle: under 12 seconds, covering 35 m or more from its own half."),
    ("largo", "Balón largo y segunda jugada", "Long ball and second ball",
     "Un pase largo hacia delante en las primeras acciones, y de ahí el peligro.",
     "A long forward pass in the first actions, and the danger comes from there."),
    ("paciente", "Construcción paciente", "Patient build-up",
     "Posesión de 8 pases o más que termina en peligro: la juega despacio hasta encontrar el hueco.",
     "A possession of 8 passes or more that ends in danger: it plays slowly until it finds the gap."),
    ("lejos", "Remate de media distancia", "Long-range shot",
     "Tiro desde fuera del área que no viene de una de las jugadas de arriba.",
     "A shot from outside the box that does not come from one of the moves above."),
    ("combinacion", "Combinación hasta el área", "Short combination into the box",
     "Pases cortos y conducciones que llegan al área sin centro, sin prisa y sin balón largo.",
     "Short passes and carries that reach the box with no cross, no hurry and no long ball."),
]
CAT_IDS = [c[0] for c in CATS]


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

    fwd = op.max_x - op.start_x
    outside = op.shot & ((op.sx < 102) | (op.sy < 18) | (op.sy > 62))
    cat = np.select(
        [op.cross | op.cutback,
         op.recovery_start & (op.start_x >= 60) & (op.dur <= 14),
         (op.play_pattern == "From Counter") | ((op.dur <= 12) & (op.start_x <= 62) & (fwd >= 35) & (op.wide_share < 0.5)),
         op.longball & (op.dur <= 20),
         op.n_pass >= 8,
         outside],
        ["centros", "recup_alta", "rapido", "largo", "paciente", "lejos"], "combinacion")
    op["cat"] = cat
    cols = k + ["cat", "t0", "t1", "dur", "n_pass", "start_x", "max_x", "xg", "obv", "goal", "shot", "reach_box", "play_pattern", "sx", "sy"]
    out = op[cols].reset_index(drop=True)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(CACHE)
    return out


if __name__ == "__main__":
    d = classify(refresh=True)
    t = d.groupby("cat").agg(n=("xg", "size"), tiros=("shot", "sum"), xg=("xg", "sum"), obv=("obv", "sum"), goles=("goal", "sum"), dur=("dur", "median"), pases=("n_pass", "median"))
    t["%n"] = (100 * t.n / t.n.sum()).round(1)
    t["%xg"] = (100 * t.xg / t.xg.sum()).round(1)
    print(t.reindex(CAT_IDS).round(2))
    print(len(d), "posesiones efectivas")
