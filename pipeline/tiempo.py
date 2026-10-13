"""Patrones a lo largo del tiempo (5.2): ¿mantiene su identidad torneo a torneo y de un club a otro?

Base: el estilo PROPIO de cada partido (z observado − club − jugadores − rival − contexto,
transfer_test.match_vectors) en los 34 KPI. Por torneo (Apertura jul–dic, Clausura ene–jun):
  · media y error estándar de cada rasgo;
  · estabilidad del perfil: correlación entre el perfil de cada torneo y el de TODO el resto de
    su carrera (deja-uno-fuera), comparada con lo que se parece a OTROS DTs (referencia) y con
    los demás entrenadores de la liga (percentil);
  · rasgos estables: de sus rasgos marcados (|z| >= 0.3), en cuántos torneos va para el mismo lado;
  · cambios significativos entre torneos seguidos (prueba z, control de falsos positivos de
    Benjamini–Hochberg al 10% dentro de cada DT) y entre clubes.
  · últimos 10 partidos frente a su carrera (para el tablero de seguimiento).

Salida: web/public/data/tiempo.json
Uso: .venv/bin/python -m pipeline.tiempo
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.features.style_kpis import BASE_KPIS
from pipeline.fitcache import load
from pipeline.models.transfer_test import match_vectors

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "data" / "tiempo.json"
MIN_T = 5          # partidos mínimos para contar un torneo
MARCADO = 0.3      # |z| para considerar un rasgo «marcado»


def torneo_of(d: str) -> tuple[str, str, int]:
    y, m = int(d[:4]), int(d[5:7])
    if m >= 7:
        return f"A{y % 100:02d}", f"Apertura {y}", y * 2 + 1
    return f"C{y % 100:02d}", f"Clausura {y}", y * 2


def bh(p: np.ndarray, q: float = 0.10) -> np.ndarray:
    n = len(p)
    if not n:
        return np.zeros(0, bool)
    o = np.argsort(p)
    thr = q * (np.arange(1, n + 1) / n)
    ok = p[o] <= thr
    k = np.max(np.where(ok)[0]) + 1 if ok.any() else 0
    out = np.zeros(n, bool)
    out[o[:k]] = True
    return out


def r2(v, d=2):
    return None if v is None or not np.isfinite(v) else round(float(v), d)


def main():
    from scipy.stats import norm
    C = load()
    seg, F, M = C["seg"], C["F"], C["M"]
    K = list(BASE_KPIS)
    V = match_vectors(seg, F, adjust=True)[K]
    info = seg.groupby(["match_id", "team_id"]).agg(coach_id=("coach_id", "first"), club_id=("club_id", "first"), date=("date", "first")).reindex(V.index)
    club_name = pd.concat([M[["home_id", "home"]].set_axis(["id", "n"], axis=1), M[["away_id", "away"]].set_axis(["id", "n"], axis=1)]).drop_duplicates("id").set_index("id").n
    V = V.assign(coach_id=info.coach_id.values, club=info.club_id.map(club_name).values, date=info.date.values)
    tt = V.date.map(torneo_of)
    V["tid"], V["tnom"], V["tord"] = [t[0] for t in tt], [t[1] for t in tt], [t[2] for t in tt]
    dts = [d["id"] for d in json.load(open(ROOT / "artifacts" / "global.json"))["dts"]]
    career = V.groupby("coach_id")[K].mean()
    out, stab = {"kpis": K, "dts": {}}, {}
    for c in dts:
        me = V[V.coach_id == c].sort_values("date")
        if len(me) < 5:
            continue
        g = me.groupby(["tord", "tid", "tnom", "club"])
        T = g[K].mean()
        n = g.size()
        se = g[K].std(ddof=1) / np.sqrt(n.values[:, None])
        keep = n >= MIN_T
        T, se, n = T[keep], se[keep], n[keep]
        tors = [{"id": i[1], "nombre": i[2], "club": i[3], "n": int(v)} for i, v in n.items()]
        # estabilidad del perfil (deja-uno-fuera) y referencia «otros DTs»
        rs, base = [], []
        others = career.drop(index=c, errors="ignore")
        for (ordv, tid, _nom, club), row in T.iterrows():
            rest = me[me.tid != tid][K].mean()
            if (me.tid != tid).sum() >= 8:
                rs.append(float(np.corrcoef(row.values, rest.values)[0, 1]))
                base.append(float(np.mean([np.corrcoef(row.values, o)[0, 1] for o in others.values])))
            else:
                rs.append(np.nan); base.append(np.nan)
        car = me[K].mean()
        est = []
        for k in K:
            if abs(car[k]) >= MARCADO and len(T) >= 2:
                same = (np.sign(T[k]) == np.sign(car[k])).mean()
                est.append({"kpi": k, "carrera": r2(car[k]), "mismo_lado": r2(same * 100, 0), "torneos": int(len(T))})
        est.sort(key=lambda d: -abs(d["carrera"]))
        # cambios entre torneos seguidos
        ch, ps = [], []
        rows = list(T.index)
        for i in range(1, len(rows)):
            a, b = rows[i - 1], rows[i]
            for k in K:
                d = T.loc[b, k] - T.loc[a, k]
                s = np.sqrt(se.loc[a, k] ** 2 + se.loc[b, k] ** 2)
                if not np.isfinite(s) or s == 0:
                    continue
                z = d / s
                ch.append({"kpi": k, "de": a[1], "a": b[1], "club_de": a[3], "club_a": b[3], "dif": r2(d), "z": r2(z)})
                ps.append(2 * (1 - norm.cdf(abs(z))))
        sig = bh(np.array(ps)) if ps else np.zeros(0, bool)
        cambios = sorted([x for x, s_ in zip(ch, sig) if s_], key=lambda x: -abs(x["z"]))[:8]
        # entre clubes (todo el paso por cada club)
        cl = []
        gc = me.groupby("club")
        cn = gc.size()
        clubs = [k for k in me.club.drop_duplicates() if cn.get(k, 0) >= 8]
        for i in range(1, len(clubs)):
            A_, B_ = gc.get_group(clubs[i - 1])[K], gc.get_group(clubs[i])[K]
            r = float(np.corrcoef(A_.mean().values, B_.mean().values)[0, 1])
            dif = (B_.mean() - A_.mean())
            zz = dif / np.sqrt(A_.var(ddof=1) / len(A_) + B_.var(ddof=1) / len(B_))
            top = [{"kpi": k, "dif": r2(dif[k]), "z": r2(zz[k])} for k in zz.abs().sort_values(ascending=False).index[:5] if abs(zz[k]) >= 2]
            cl.append({"de": clubs[i - 1], "a": clubs[i], "n_de": int(len(A_)), "n_a": int(len(B_)), "r": r2(r), "cambios": top})
        last = me.tail(10)
        out["dts"][str(c)] = {
            "torneos": tors,
            "m": [[r2(v) for v in row] for row in T.values], "se": [[r2(v) for v in row] for row in se.values],
            "perfil_r": [r2(v) for v in rs], "perfil_base": [r2(v) for v in base],
            "estables": est[:8], "cambios": cambios, "clubes": cl,
            "ultimos": {"n": int(len(last)), "desde": last.date.iloc[0], "hasta": last.date.iloc[-1],
                        "m": {k: r2(last[k].mean()) for k in K}, "carrera": {k: r2(car[k]) for k in K},
                        "sd": {k: r2(me[k].std(ddof=1)) for k in K}},
        }
        v = np.nanmean(rs) if np.isfinite(rs).any() else np.nan
        if np.isfinite(v):
            stab[c] = (v, np.nanmean(base))
    vals = np.array([v[0] for v in stab.values()])
    for c, d in out["dts"].items():
        s = stab.get(int(c))
        d["identidad"] = {"r": r2(s[0]) if s else None, "base": r2(s[1]) if s else None,
                          "pct": r2((vals < s[0]).mean() * 100, 0) if s else None, "n_dts": int(len(vals))}
    out["liga"] = {"r_mediana": r2(float(np.median(vals))), "r_p25": r2(float(np.percentile(vals, 25))), "r_p75": r2(float(np.percentile(vals, 75))),
                   "base_mediana": r2(float(np.median([v[1] for v in stab.values()])))}
    json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"tiempo.json: {len(out['dts'])} DTs · {OUT.stat().st_size / 1e3:.0f} KB · r mediana {out['liga']['r_mediana']} (base {out['liga']['base_mediana']})")


if __name__ == "__main__":
    main()
