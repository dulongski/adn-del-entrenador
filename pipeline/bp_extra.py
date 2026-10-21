"""Balón parado, parte 2 (5.4): saques de banda en zona de peligro, marcaje en córners (360)
y zonas de vulnerabilidad. Todo se mide contra la liga y contra los demás DTs.

  Saque de banda «peligroso»: en el último tercio (x >= 80, framework.yaml). Se reflejan para
  que todos se saquen desde la banda izquierda (y < 40).
  Marcaje (fotos 360 del momento del córner, pipeline/marking.py): cada defensor dentro del área
  se empareja 1-a-1 con el atacante más cercano (asignación húngara); si están a <= 2 yardas
  (1.8 m) cuenta como «pegado». % pegados alto = marca al hombre; bajo = zonal.
  Vulnerabilidad: córners en contra por zona de envío: % del total, quién gana el primer
  contacto y xG concedido por córner, frente a la liga.

Salida: web/public/data/bp2.json  {"liga": {...}, "dts": {id: {...}}}
Uso: .venv/bin/python -m pipeline.bp_extra
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import linear_sum_assignment

from pipeline import sb_client as sb
from pipeline.features.setpieces import zone_of
from pipeline.paths import MARK

ROOT = Path(__file__).resolve().parents[1]
PROC = sb.DATA / "processed"
OUT = ROOT / "web" / "public" / "data" / "bp2.json"
BOX = (102.0, 18.0, 62.0)
TIGHT = 2.0          # yardas: «pegado» a su atacante
MIN_DEF = 3          # mínimo de defensores visibles en el área para medir el marcaje
ZONAS = ["Primer palo", "Área chica", "Punto penal", "Segundo palo", "Corto"]


def r(v, d=3):
    return None if v is None or not np.isfinite(v) else round(float(v), d)


def coach_matches(M: pd.DataFrame) -> pd.DataFrame:
    h = M[["match_id", "home_id", "away_id", "home_coach_id", "date"]].set_axis(["match_id", "team_id", "opp_id", "coach_id", "date"], axis=1)
    a = M[["match_id", "away_id", "home_id", "away_coach_id", "date"]].set_axis(["match_id", "team_id", "opp_id", "coach_id", "date"], axis=1)
    out = pd.concat([h, a]).dropna(subset=["coach_id"])
    out["coach_id"] = out.coach_id.astype(int)
    return out


# ---------------------------------------------------------------- saques de banda
def throwins(sp: pd.DataFrame, A: pd.DataFrame, names: pd.Series):
    th = sp[sp.type == "Throw-in"].copy()
    flip = th.y > 40
    th.loc[flip, "y"] = 80 - th.loc[flip, "y"]
    th.loc[flip, "end_y"] = 80 - th.loc[flip, "end_y"]
    th["al_area"] = (th.end_x >= BOX[0]) & th.end_y.between(BOX[1], BOX[2])
    th["largo"] = ~th.short
    tk = A[(A.subtype == "Throw-in")][["match_id", "team_id", "t", "player_id"]]
    th = th.merge(tk, on=["match_id", "team_id", "t"], how="left")
    th["player"] = th.player_id.map(names)
    return th


def throw_summary(d: pd.DataFrame, n: int) -> dict:
    if not len(d) or not n:
        return {}
    a = d[d.al_area]
    return {"n": int(len(d)), "por_partido": r(len(d) / n, 2),
            "al_area_pct": r(d.al_area.mean() * 100, 1), "retiene_pct": r(d.complete.mean() * 100, 1),
            "remate_pct": r(d.shot.mean() * 100, 1), "xg_por_saque": r(d.xg.mean(), 4),
            "xg_por_partido": r(d.xg.sum() / n, 3), "goles": int(d.goal.sum()),
            "area_primer_contacto_pct": r(a.first_contact_own.dropna().astype(float).mean() * 100, 1) if len(a) else None,
            "area_remate_pct": r(a.shot.mean() * 100, 1) if len(a) else None}


def throw_points(d: pd.DataFrame, cap: int = 160):
    d = d.sort_values("xg", ascending=False)
    return [[r(x, 1), r(y, 1), r(ex, 1), r(ey, 1), int(s), int(g), int(b)] for x, y, ex, ey, s, g, b in
            zip(d.x, d.y, d.end_x, d.end_y, d.shot, d.goal, d.al_area)][:cap]


def takers(d: pd.DataFrame, k: int = 3):
    a = d[d.al_area & d.player_id.notna()]
    if not len(a):
        return []
    c = a.groupby(["player_id", "player"]).size().sort_values(ascending=False).head(k)
    return [[int(p), n, int(v)] for (p, n), v in c.items()]


# ---------------------------------------------------------------- marcaje 360
def marking_table(M: pd.DataFrame) -> pd.DataFrame | None:
    parts = sorted(MARK.glob("part_*.parquet"))
    if not parts:
        return None
    C = pd.concat([pd.read_parquet(p) for p in parts], ignore_index=True).drop_duplicates(["match_id", "team_id", "period", "minute", "second"]).rename(columns={"def": "dfn"})
    side = M.set_index("match_id")
    home = C.match_id.map(side.home_id)
    C["def_team"] = np.where(C.team_id == home, C.match_id.map(side.away_id), home)
    C["def_coach"] = np.where(C.team_id == home, C.match_id.map(side.away_coach_id), C.match_id.map(side.home_coach_id))
    rows = []
    for rec in C.itertuples():
        inb = lambda p: p[0] >= BOX[0] and BOX[1] <= p[1] <= BOX[2]
        dfn = [p for p in (rec.dfn if rec.dfn is not None else []) if inb(p)]
        att = [p for p in (rec.att if rec.att is not None else []) if inb(p)]
        if not rec.has360 or len(dfn) < MIN_DEF:
            rows.append((np.nan, np.nan, np.nan, np.nan))
            continue
        pegados = 0
        if att:
            Dm = np.hypot(np.subtract.outer([p[0] for p in dfn], [p[0] for p in att]), np.subtract.outer([p[1] for p in dfn], [p[1] for p in att]))
            ri, ci = linear_sum_assignment(Dm)
            pegados = int((Dm[ri, ci] <= TIGHT).sum())
        chica = sum(1 for p in dfn if p[0] >= 114 and 30 <= p[1] <= 50)
        rows.append((len(dfn), pegados / len(dfn), chica, len(att)))
    C[["def_box", "pegados", "en_chica", "att_box"]] = pd.DataFrame(rows, index=C.index)
    return C


def marking_summary(c: pd.DataFrame, lg_cut) -> dict:
    m = c[c.pegados.notna()]
    if len(m) < 15:
        return {"n": int(len(m))}
    p = float(m.pegados.mean())
    tipo = "hombre" if p >= lg_cut[1] else "zonal" if p <= lg_cut[0] else "mixto"
    # ¿marca distinto cuando hay muchos atacantes? reparto por nº de atacantes en el área
    return {"n": int(len(m)), "pegados_pct": r(p * 100, 1), "tipo": tipo,
            "defensores_area": r(m.def_box.mean(), 2), "en_area_chica": r(m.en_chica.mean(), 2),
            "atacantes_area": r(m.att_box.mean(), 2),
            "xg_concedido": r(m.xg.mean(), 4), "remate_pct": r(m.shot.mean() * 100, 1)}


# ---------------------------------------------------------------- vulnerabilidad
def vulnerable(c: pd.DataFrame, lg: pd.DataFrame) -> list[dict]:
    out = []
    zc, zl = zone_of(c.end_x.values, c.end_y.values), zone_of(lg.end_x.values, lg.end_y.values)
    for z in ZONAS:
        a, b = c[zc == z], lg[zl == z]
        if not len(b):
            continue
        out.append({"zona": z, "n": int(len(a)), "pct": r(len(a) / max(len(c), 1) * 100, 1), "pct_liga": r(len(b) / len(lg) * 100, 1),
                    "rival_gana_pct": r(a.first_contact_own.dropna().astype(float).mean() * 100, 1) if len(a) >= 5 else None,
                    "rival_gana_liga": r(b.first_contact_own.dropna().astype(float).mean() * 100, 1),
                    "xg": r(a.xg.mean(), 4) if len(a) >= 10 else None, "xg_liga": r(b.xg.mean(), 4)})
    return out


def pct_rank(vals: dict, v):
    xs = np.array([x for x in vals.values() if x is not None and np.isfinite(x)])
    return None if v is None or not len(xs) else r((xs < v).mean() * 100, 0)


def main():
    M = pd.read_parquet(PROC / "matches.parquet")
    sp = pd.read_parquet(PROC / "setpieces.parquet")
    A = pd.read_parquet(PROC / "actions.parquet", columns=["match_id", "team_id", "player_id", "subtype", "t"])
    names = pd.read_parquet(PROC / "players.parquet").set_index("player_id").player
    cm = coach_matches(M)
    dts = [d["id"] for d in json.load(open(ROOT / "artifacts" / "global.json"))["dts"]]
    th = throwins(sp, A, names)
    n_tm = len(M) * 2
    liga = {"banda": throw_summary(th, n_tm)}
    corners = sp[sp.type == "Corner"]
    C = marking_table(M)
    lg_cut = None
    if C is not None:
        tm = C[C.pegados.notna()].groupby(["def_team", "match_id"]).pegados.mean()
        per_coach = C[C.pegados.notna()].groupby("def_coach").pegados.agg(["mean", "size"])
        per_coach = per_coach[per_coach["size"] >= 15]["mean"]
        lg_cut = (float(per_coach.quantile(1 / 3)), float(per_coach.quantile(2 / 3)))
        m = C[C.pegados.notna()]
        terc = pd.qcut(m.pegados, 3, labels=["zonal", "mixto", "hombre"], duplicates="drop")
        liga["marcaje"] = {"n": int(len(m)), "pegados_pct": r(m.pegados.mean() * 100, 1), "cortes": [r(lg_cut[0] * 100, 1), r(lg_cut[1] * 100, 1)],
                           "defensores_area": r(m.def_box.mean(), 2), "en_area_chica": r(m.en_chica.mean(), 2),
                           "xg_concedido": r(m.xg.mean(), 4), "remate_pct": r(m.shot.mean() * 100, 1),
                           "xg_por_estilo": {k: r(v, 4) for k, v in m.groupby(terc, observed=True).xg.mean().items()},
                           "remate_por_estilo": {k: r(v * 100, 1) for k, v in m.groupby(terc, observed=True).shot.mean().items()}}
    out = {"liga": liga, "dts": {}}
    vals = {"favor_xg": {}, "contra_xg": {}, "favor_area": {}, "pegados": {}}
    for c in dts:
        my = cm[cm.coach_id == c]
        n = my.match_id.nunique()
        if not n:
            continue
        k = th.merge(my[["match_id", "team_id"]].rename(columns={"team_id": "dt_team"}), on="match_id")
        fav, con = k[k.team_id == k.dt_team], k[k.team_id != k.dt_team]
        kc = corners.merge(my[["match_id", "team_id"]].rename(columns={"team_id": "dt_team"}), on="match_id")
        con_c = kc[kc.team_id != kc.dt_team]
        d = {"partidos": int(n),
             "banda": {"favor": throw_summary(fav, n), "contra": throw_summary(con, n),
                       "puntos": throw_points(fav), "puntos_contra": throw_points(con, 100), "lanzadores": takers(fav)},
             "vulnerable": vulnerable(con_c, corners)}
        if C is not None:
            mc = C[(C.def_coach == c)]
            d["marcaje"] = marking_summary(mc, lg_cut)
            if d["marcaje"].get("pegados_pct") is not None:
                vals["pegados"][c] = d["marcaje"]["pegados_pct"]
        vals["favor_xg"][c] = d["banda"]["favor"].get("xg_por_partido")
        vals["contra_xg"][c] = d["banda"]["contra"].get("xg_por_partido")
        vals["favor_area"][c] = d["banda"]["favor"].get("al_area_pct")
        out["dts"][str(c)] = d
    for c, d in out["dts"].items():  # percentiles entre DTs
        c = int(c)
        d["banda"]["pct"] = {"favor_xg": pct_rank(vals["favor_xg"], vals["favor_xg"].get(c)),
                             "contra_xg": pct_rank(vals["contra_xg"], vals["contra_xg"].get(c)),
                             "favor_area": pct_rank(vals["favor_area"], vals["favor_area"].get(c))}
        if "marcaje" in d and c in vals["pegados"]:
            d["marcaje"]["pct"] = pct_rank(vals["pegados"], vals["pegados"][c])
    json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"bp2.json: {len(out['dts'])} DTs, {OUT.stat().st_size / 1e3:.0f} KB", "· marcaje" if C is not None else "· sin marcaje aún")


if __name__ == "__main__":
    main()
