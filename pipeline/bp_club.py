"""Balón parado 2 POR CLUB (para el selector de club de las pestañas «Cómo defiende» y «Saques de banda»).

Agrega bp2.json con `por_club[club]` y `carrera` en cada DT:
  defensa: marcaje 360 y zonas de vulnerabilidad de los córners en contra (pipeline/marking.py),
           más un mapa de dónde caen los córners en contra (rejilla, n y xG por celda);
  banda:   saques de banda del último tercio a favor y en contra (data/processed/setpieces.parquet),
           con rejilla de dónde caen. Si la tabla procesada no está disponible, se deja lo de carrera.
Qué partido es de qué DT y club sale de los dt_<id>.json (lista `partidos`); el id de equipo de cada
club se deduce cruzando los partidos (el único id que aparece en todos los partidos de ese club).

Uso: python -m pipeline.bp_club --dts <carpeta con dt_*.json> --bp2 <bp2.json> [--setpieces <parquet>]
     [--actions <actions.parquet> --players <players.parquet>]   (para los lanzadores por club)
"""
from __future__ import annotations

import argparse
import glob
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import linear_sum_assignment
from pipeline.paths import MARK

BOX = (102.0, 18.0, 62.0)
TIGHT = 2.0
MIN_DEF = 3
ZONAS = ["Primer palo", "Área chica", "Punto penal", "Segundo palo", "Corto"]
GX, GY = 6, 8   # rejilla del último tercio: x 90..120 en 6, y 0..80 en 8 (reflejado a y<40 no: se usa todo el ancho)


def r(v, d=3):
    return None if v is None or not np.isfinite(v) else round(float(v), d)


def zone_of(x, y):
    x, y = np.asarray(x, float), np.asarray(y, float)
    out = np.full(len(x), "Otro", dtype=object)
    done = np.zeros(len(x), bool)
    rules = [("Corto", x < 102), ("Primer palo", (x >= 114) & (np.abs(y - 40) >= 4) & (np.abs(y - 40) < 10)),
             ("Área chica", (x >= 114) & (np.abs(y - 40) < 10)), ("Punto penal", (x >= 102) & (x < 114) & (np.abs(y - 40) < 10)),
             ("Segundo palo", (x >= 102) & (np.abs(y - 40) >= 10))]
    for n, m in rules:
        m = m & ~done
        out[m] = n
        done |= m
    return out


def grid(x, y, w, x0=90.0):
    x, y, w = np.asarray(x, float), np.asarray(y, float), np.asarray(w, float)
    ok = np.isfinite(x) & np.isfinite(y) & (x >= x0)
    gx = np.clip(((x[ok] - x0) / (120 - x0) * GX).astype(int), 0, GX - 1)
    gy = np.clip((y[ok] / 80 * GY).astype(int), 0, GY - 1)
    n = np.zeros((GX, GY)); s = np.zeros((GX, GY))
    np.add.at(n, (gx, gy), 1); np.add.at(s, (gx, gy), w[ok])
    return [[int(n[i, j]), r(s[i, j] / n[i, j], 4) if n[i, j] else None] for i in range(GX) for j in range(GY)]


def marking_rows(C):
    rows = []
    for rec in C.itertuples():
        inb = lambda p: p[0] >= BOX[0] and BOX[1] <= p[1] <= BOX[2]
        dfn = [p for p in (rec.dfn if rec.dfn is not None else []) if inb(p)]
        att = [p for p in (rec.att if rec.att is not None else []) if inb(p)]
        if not rec.has360 or len(dfn) < MIN_DEF:
            rows.append((np.nan, np.nan, np.nan)); continue
        peg = 0
        if att:
            D = np.hypot(np.subtract.outer([p[0] for p in dfn], [p[0] for p in att]), np.subtract.outer([p[1] for p in dfn], [p[1] for p in att]))
            ri, ci = linear_sum_assignment(D)
            peg = int((D[ri, ci] <= TIGHT).sum())
        rows.append((len(dfn), peg / len(dfn), sum(1 for p in dfn if p[0] >= 114 and 30 <= p[1] <= 50)))
    C[["def_box", "pegados", "en_chica"]] = pd.DataFrame(rows, index=C.index)
    return C


def defensa(c, lg, cuts):
    m = c[c.pegados.notna()]
    out = {"n": int(len(c)), "n360": int(len(m))}
    if len(m) >= 15:
        p = float(m.pegados.mean())
        out.update({"pegados_pct": r(p * 100, 1), "tipo": "hombre" if p >= cuts[1] else "zonal" if p <= cuts[0] else "mixto",
                    "defensores_area": r(m.def_box.mean(), 2), "en_area_chica": r(m.en_chica.mean(), 2)})
    if len(c):
        out.update({"xg_concedido": r(c.xg.mean(), 4), "remate_pct": r(c.shot.mean() * 100, 1)})
    zc, zl = zone_of(c.end_x, c.end_y), zone_of(lg.end_x, lg.end_y)
    out["zonas"] = []
    for z in ZONAS:
        a, b = c[zc == z], lg[zl == z]
        out["zonas"].append({"zona": z, "n": int(len(a)), "pct": r(len(a) / max(len(c), 1) * 100, 1), "pct_liga": r(len(b) / len(lg) * 100, 1),
                             "rival_gana_pct": r(a.fc_own.dropna().astype(float).mean() * 100, 1) if len(a) >= 5 else None,
                             "rival_gana_liga": r(b.fc_own.dropna().astype(float).mean() * 100, 1),
                             "xg": r(a.xg.mean(), 4) if len(a) >= 10 else None, "xg_liga": r(b.xg.mean(), 4)})
    out["mapa"] = grid(c.end_x, c.end_y, c.xg)
    return out


def banda(d, n, lg_rate=None):
    if not len(d) or not n:
        return {}
    a = d[d.al_area]
    return {"n": int(len(d)), "por_partido": r(len(d) / n, 2), "al_area_pct": r(d.al_area.mean() * 100, 1),
            "retiene_pct": r(d.complete.mean() * 100, 1), "remate_pct": r(d.shot.mean() * 100, 1),
            "xg_por_partido": r(d.xg.sum() / n, 3), "goles": int(d.goal.sum()),
            "area_primer_contacto_pct": r(a.first_contact_own.dropna().astype(float).mean() * 100, 1) if len(a) else None,
            "mapa": grid(d.end_x, d.end_y, d.xg, x0=80.0),
            "origen": [int(v) for v in np.histogram(d.x.clip(80, 120), bins=[80, 90, 100, 110, 120.1])[0]],
            "lanzadores": takers(d)}


def takers(d, k=3):
    """Quién los mete al área: [id, nombre, saques al área] de los k que más."""
    if "player_id" not in d:
        return []
    a = d[d.al_area & d.player_id.notna()]
    c = a.groupby(["player_id", "player"]).size().sort_values(ascending=False).head(k)
    return [[int(p), n, int(v)] for (p, n), v in c.items()]


def main(dts_dir, bp2_path, sp_path=None, actions_path=None, players_path=None):
    arts = {}
    for f in glob.glob(f"{dts_dir}/dt_*.json"):
        a = json.load(open(f))
        arts[a["id"]] = [(p["match_id"], p["club"]) for p in a["partidos"]]
    C = pd.concat([pd.read_parquet(p) for p in sorted(MARK.glob("part_*.parquet"))], ignore_index=True)
    C = C.drop_duplicates(["match_id", "team_id", "period", "minute", "second"]).rename(columns={"def": "dfn"})
    teams = C.groupby("match_id").team_id.apply(lambda s: set(s.unique()))
    # id de equipo de cada club = el que aparece en (casi) todos sus partidos
    club_tid = {}
    by_club = defaultdict(list)
    for c, ms in arts.items():
        for m, club in ms:
            by_club[club].append(m)
    for club, ms in by_club.items():
        cnt = Counter(t for m in set(ms) if m in teams.index for t in teams[m])
        if cnt:
            club_tid[club] = cnt.most_common(1)[0][0]
    print(f"{len(club_tid)} clubes con id")
    C = marking_rows(C)
    per = C[C.pegados.notna()].groupby(["match_id", "team_id"]).pegados.mean()
    sp = None
    if sp_path and Path(sp_path).exists():
        sp = pd.read_parquet(sp_path)
        sp = sp[sp.type == "Throw-in"].copy()
        sp["al_area"] = (sp.end_x >= BOX[0]) & sp.end_y.between(BOX[1], BOX[2])
        if actions_path and Path(actions_path).exists():
            A = pd.read_parquet(actions_path, columns=["match_id", "team_id", "player_id", "subtype", "t"])
            tk = A[A.subtype == "Throw-in"][["match_id", "team_id", "t", "player_id"]].drop_duplicates(["match_id", "team_id", "t"])
            sp = sp.merge(tk, on=["match_id", "team_id", "t"], how="left")
            if players_path and Path(players_path).exists():
                sp["player"] = sp.player_id.map(pd.read_parquet(players_path).drop_duplicates("player_id").set_index("player_id").player)
            else:
                sp["player"] = sp.player_id.astype("Int64").astype(str)
            print(f"lanzador identificado en {sp.player_id.notna().mean():.0%} de los saques")
    out = json.load(open(bp2_path))
    # cortes del marcaje: tercios de los DTs (igual que bp_extra)
    pegs = []
    rows_of = {}
    for c, ms in arts.items():
        rr = []
        for m, club in ms:
            t = club_tid.get(club)
            if t is None:
                continue
            rr.append((m, club, t))
        rows_of[c] = rr
        idx = [(m, t) for m, _, t in rr]
        # córners en contra = los que cobra el OTRO equipo del partido
        sub = C[C.match_id.isin([m for m, _, _ in rr])]
        sub = sub.merge(pd.DataFrame(rr, columns=["match_id", "club", "tid"]), on="match_id")
        sub = sub[sub.team_id != sub.tid]
        v = sub.pegados.dropna()
        if len(v) >= 15:
            pegs.append(v.mean())
    cuts = (float(np.quantile(pegs, 1 / 3)), float(np.quantile(pegs, 2 / 3)))
    for c, rr in rows_of.items():
        d = out["dts"].get(str(c))
        if d is None:
            continue
        mm = pd.DataFrame(rr, columns=["match_id", "club", "tid"])
        sub = C.merge(mm, on="match_id")
        con = sub[sub.team_id != sub.tid]
        pc = {}
        clubs = list(dict.fromkeys(mm.club))
        for club in clubs + [None]:
            cc = con if club is None else con[con.club == club]
            nm = int(mm.match_id.nunique() if club is None else mm[mm.club == club].match_id.nunique())
            ent = {"partidos": nm, "defensa": defensa(cc, C, cuts)}
            if sp is not None:
                kk = sp.merge(mm if club is None else mm[mm.club == club], on="match_id")
                # equipo del DT: el id del club; a favor = lo saca él
                ent["banda"] = {"favor": banda(kk[kk.team_id == kk.tid], nm), "contra": banda(kk[kk.team_id != kk.tid], nm)}
            if club is None:
                d["carrera"] = ent
            else:
                pc[club] = ent
        d["por_club"] = pc
    out["liga"]["cortes_marcaje"] = [r(cuts[0] * 100, 1), r(cuts[1] * 100, 1)]
    out["liga"]["mapa_corners"] = grid(C.end_x, C.end_y, C.xg)
    if sp is not None:
        out["liga"]["banda_mapa"] = grid(sp.end_x, sp.end_y, sp.xg, x0=80.0)
    json.dump(out, open(bp2_path, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"bp2 por club listo · {Path(bp2_path).stat().st_size / 1e3:.0f} KB · banda por club: {sp is not None}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dts", required=True)
    ap.add_argument("--bp2", required=True)
    ap.add_argument("--setpieces")
    ap.add_argument("--actions")
    ap.add_argument("--players")
    a = ap.parse_args()
    main(a.dts, a.bp2, a.setpieces, a.actions, a.players)
