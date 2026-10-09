"""Datos extra para la pestaña «Jugadores» de la web: por DT y por club (más «toda su carrera»):
dibujos iniciales usados, el once típico del dibujo más usado (quién arrancó más veces en cada puesto),
rotación del once, cambios de dibujo por partido y minutos/titularidades de cada jugador en ese club.
Sólo lee data/processed/*.parquet y artifacts/global.json (no ajusta ningún modelo).

  python -m pipeline.jugadores_extra   ->  web/public/data/jugadores_<id>.json
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.features.players import POS_ES

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
OUT = ROOT / "web" / "public" / "data"


def resumen(mm: pd.DataFrame, lu: pd.DataFrame, st: pd.DataFrame, names: dict) -> dict:
    """mm: partidos (match_id, team_id, date) de una selección; lu/st ya filtrados a esos partidos."""
    xi = lu[(lu.period == 1) & (lu.ts == 0)]
    form_by_match = xi.drop_duplicates("match_id").set_index("match_id").formation.astype(str)
    forms = form_by_match.value_counts()
    top = forms.index[0] if len(forms) else None
    # once típico de un dibujo: el conjunto de 11 puestos más frecuente con ese dibujo y, por puesto, quién arrancó más
    def once_de(fm) -> list:
        once = []
        mids = form_by_match[form_by_match == fm].index
        x = xi[xi.match_id.isin(mids)]
        sets = x.groupby("match_id").position.apply(lambda s: tuple(sorted(s)))
        slots = list(Counter(sets[sets.map(len) == 11]).most_common(1)[0][0]) if (sets.map(len) == 11).any() else sorted(x.position.unique())[:11]
        cnt = x[x.position.isin(slots)].groupby(["position", "player_id"]).size().sort_values(ascending=False)
        used, done = set(), {}
        for (ps, pid), n in cnt.items():  # greedy: el par (puesto, jugador) más repetido primero
            if ps in done and len(done[ps]) >= slots.count(ps):
                continue
            if pid in used:
                continue
            done.setdefault(ps, []).append((int(pid), int(n)))
            used.add(pid)
        for ps in dict.fromkeys(slots):
            for pid, n in done.get(ps, []):
                once.append({"pos": ps, "posicion": POS_ES.get(ps, ps), "id": pid, "nombre": names.get(pid, str(pid)), "tit": n})
        return once
    once = once_de(top) if top is not None else []
    por_dibujo = {str(f): {"partidos": int(n), "once": once if f == top else once_de(f)} for f, n in forms.items()}
    # rotación: titulares distintos entre partidos consecutivos
    xis = xi.groupby("match_id").player_id.apply(set).reindex(mm.sort_values("date").match_id).dropna()
    changes = [len(a - b) for a, b in zip(xis.values[1:], xis.values[:-1])]
    shifts = lu.drop_duplicates(["match_id", "period", "ts"]).groupby("match_id").size() - 1
    # jugadores: minutos (stints), titularidades y puesto más habitual
    ex = st[["dur", "players"]].explode("players").dropna()
    mins = ex.groupby("players").dur.sum() / 60
    starts = xi.groupby("player_id").match_id.nunique()
    pos = lu.groupby("player_id").position.agg(lambda s: s.value_counts().index[0])
    jug = [[int(p), round(float(m)), int(starts.get(p, 0)), POS_ES.get(pos.get(p), pos.get(p))]
           for p, m in mins.sort_values(ascending=False).items() if m >= 90]
    return {
        "partidos": int(mm.match_id.nunique()),
        "formaciones": {str(k): int(v) for k, v in forms.items()},
        "dibujo": top, "partidos_dibujo": int(forms.iloc[0]) if len(forms) else 0,
        "once": once,
        "once_por_dibujo": por_dibujo,
        "rotacion": round(float(np.mean(changes)), 2) if changes else None,
        "cambios_dibujo": round(float(shifts.mean()), 2) if len(shifts) else None,
        "jugadores": jug,
    }


def main():
    glob = json.load(open(ROOT / "artifacts" / "global.json"))
    M = pd.read_parquet(PROC / "matches.parquet")
    L = pd.read_parquet(PROC / "lineups.parquet")
    S = pd.read_parquet(PROC / "stints.parquet", columns=["match_id", "team_id", "dur", "players"])
    names = pd.read_parquet(PROC / "players.parquet").dropna(subset=["player_id"]).drop_duplicates("player_id")
    names = dict(zip(names.player_id.astype(int), names.player))
    total, outs = 0, []
    for d in glob["dts"]:
        cid = d["id"]
        home = M[M.home_coach_id == cid].assign(team_id=lambda x: x.home_id, club=lambda x: x.home)
        away = M[M.away_coach_id == cid].assign(team_id=lambda x: x.away_id, club=lambda x: x.away)
        mm = pd.concat([home, away])[["match_id", "team_id", "club", "date"]].sort_values("date")
        key = mm[["match_id", "team_id"]]
        lu = L.merge(key, on=["match_id", "team_id"])
        st = S.merge(key, on=["match_id", "team_id"])
        # clubes en orden cronológico inverso (el más reciente primero)
        clubs = mm.groupby("club").date.max().sort_values(ascending=False).index.tolist()
        out = {"id": cid, "clubes": clubs, "por_club": {}, "carrera": resumen(mm, lu, st, names)}
        for c in clubs:
            ids = mm[mm.club == c].match_id
            out["por_club"][c] = resumen(mm[mm.club == c], lu[lu.match_id.isin(ids)], st[st.match_id.isin(ids)], names)
        outs.append(out)
    # referencia: mediana entre DTs (toda su carrera) para dar contexto a rotación y cambios de dibujo
    ref = {k: round(float(np.nanmedian([o["carrera"][k] for o in outs if o["carrera"][k] is not None])), 2) for k in ("rotacion", "cambios_dibujo")}
    for out in outs:
        out["mediana_dts"] = ref
        f = OUT / f"jugadores_{out['id']}.json"
        json.dump(out, open(f, "w"), ensure_ascii=False, separators=(",", ":"))
        total += f.stat().st_size
    print(f"jugadores_*.json: {len(outs)} archivos, {total / 1024:.0f} KB en total; medianas {ref}")


if __name__ == "__main__":
    main()
