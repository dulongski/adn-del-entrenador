"""Formas del equipo por fase (para el partido animado): posición media de cada titular del DT en
  - ataque organizado: sus acciones con balón (pase/conducción) pasados 8 s de iniciada la posesión
  - transición ofensiva: acciones con balón en los primeros 10 s de una posesión que nace de recuperación
  - defensa organizada: acciones defensivas sin contrapresión (presión, duelo, intercepción, recuperación…)
  - transición defensiva: presiones/duelos de contrapresión (≤5 s tras perder, flag StatsBomb)
Coordenadas en el marco propio (ataca hacia x=120). Escribe web/public/data/formas.json.

  python -m pipeline.shapes
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
PROC = ROOT / "data" / "processed"
OUT = ROOT / "web" / "public" / "data" / "formas.json"
MIN_N = 12
DEF = {"Pressure", "Duel", "Interception", "Ball Recovery", "Block", "Clearance", "Foul Committed"}


def main():
    glob = json.load(open(ART / "global.json"))
    M = pd.read_parquet(PROC / "matches.parquet")
    A = pd.read_parquet(PROC / "actions.parquet", columns=["t", "team_id", "player_id", "type", "x", "y", "poss", "counterpress", "match_id"])
    P = pd.read_parquet(PROC / "possessions.parquet", columns=["match_id", "poss", "team_id", "t0", "recovery_start", "set_piece"])
    A = A.merge(P.rename(columns={"team_id": "poss_team"}), on=["match_id", "poss"], how="left")
    A["dt"] = A.t - A.t0
    onball = A.type.isin(["Pass", "Carry"]) & (A.team_id == A.poss_team)
    A["fase"] = np.select([
        onball & A.recovery_start.fillna(False) & (A.dt <= 10),
        onball & ~A.set_piece.fillna(False) & (A.dt > 8),
        A.type.isin(DEF) & A.counterpress.fillna(False),
        A.type.isin(DEF) & ~A.counterpress.fillna(False),
    ], ["trans_of", "ataque", "trans_def", "defensa"], "")
    A = A[A.fase != ""]
    out = {}
    for d in glob["dts"]:
        cid = d["id"]
        art = json.load(open(ART / f"dt_{cid}.json"))
        mm = M[(M.home_coach_id == cid) | (M.away_coach_id == cid)]
        team = pd.Series(np.where(mm.home_coach_id == cid, mm.home_id, mm.away_id), index=mm.match_id)
        js = sorted(art["jugadores"]["jugadores"], key=lambda j: -j["minutos"])
        gk = [j for j in js if j["linea"] == 0][:1]
        xi = gk + [j for j in js if j["linea"] != 0][:10]
        a = A[A.match_id.isin(team.index)]
        a = a[a.team_id.values == team.reindex(a.match_id).values]
        g_all = a.groupby(["player_id", "fase"]).agg(x=("x", "mean"), y=("y", "mean"), n=("x", "size")).reset_index()
        # posiciones por fase de TODOS los jugadores que dirigió (para usar el once real de cada partido)
        por_jug = {}
        for r in g_all[g_all.n >= 8].itertuples():
            por_jug.setdefault(str(int(r.player_id)), {})[r.fase] = [round(float(r.x), 1), round(float(r.y), 1)]
        g = g_all[g_all.player_id.isin([j["player_id"] for j in xi])]
        rows = []
        for j in xi:
            r = {"id": j["player_id"], "nombre": j["nombre"], "pos": j["posicion"], "linea": j["linea"]}
            for f in ["ataque", "defensa", "trans_of", "trans_def"]:
                s = g[(g.player_id == j["player_id"]) & (g.fase == f)]
                r[f] = [round(float(s.x.iloc[0]), 1), round(float(s.y.iloc[0]), 1)] if len(s) and s.n.iloc[0] >= MIN_N else None
            rows.append(r)
        # huecos: si falta una fase, se usa la más parecida disponible
        for r in rows:
            for f, alt in [("trans_of", "ataque"), ("trans_def", "defensa"), ("ataque", "defensa"), ("defensa", "ataque")]:
                if r[f] is None:
                    r[f] = r[alt]
        if r.get("linea") == 0:
            pass
        for r in rows:  # portero: siempre bajo palos si no hay datos
            if r["ataque"] is None:
                r.update(ataque=[8, 40], defensa=[5, 40], trans_of=[8, 40], trans_def=[5, 40])
        out[str(cid)] = {"xi": rows, "p": por_jug}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    ej = out[str(next(d["id"] for d in glob["dts"] if "Almada" in d["nombre"]))]["xi"]
    for r in ej:
        print(r["nombre"][:22].ljust(22), r["pos"], "ATQ", r["ataque"], "DEF", r["defensa"], "TO", r["trans_of"], "TD", r["trans_def"])
    print(OUT, f"{OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
