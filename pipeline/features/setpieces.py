"""Balón parado (5.4). Ofensivo: entrega, zonas de envío, primer contacto, remates, gente en
el área (360). Defensivo: lo mismo desde el lado del rival contra el equipo del DT."""
from __future__ import annotations

import numpy as np
import pandas as pd

ZONES = [  # zonas de destino del envío (coordenadas de ataque hacia x=120)
    ("Corto", lambda x, y: x < 102),
    ("Primer palo", lambda x, y: (x >= 102) & (np.abs(y - 40) >= 4) & (np.abs(y - 40) < 10) & (x >= 114)),
    ("Área chica", lambda x, y: (x >= 114) & (np.abs(y - 40) < 10)),
    ("Punto penal", lambda x, y: (x >= 102) & (x < 114) & (np.abs(y - 40) < 10)),
    ("Segundo palo", lambda x, y: (x >= 102) & (np.abs(y - 40) >= 10)),
]


def zone_of(x, y):
    out = np.full(len(x), "Otro", dtype=object)
    done = np.zeros(len(x), bool)
    for n, f in ZONES:
        m = f(x, y) & ~done
        out[m] = n
        done |= m
    return out


def _summary(d: pd.DataFrame, n_matches: int) -> dict:
    if d.empty:
        return {}
    c = d[d.type == "Corner"]
    fk = d[d.type == "Free Kick"]
    th = d[d.type == "Throw-in"]
    cz = pd.Series(zone_of(c.end_x.values, c.end_y.values)) if len(c) else pd.Series(dtype=object)
    tech = c.technique.fillna("Recto").value_counts(normalize=True).to_dict() if len(c) else {}
    return {
        "corners_por_partido": len(c) / n_matches,
        "corner_corto_pct": float(c.short.mean() * 100) if len(c) else None,
        "corner_tecnica": {k: float(v * 100) for k, v in tech.items()},
        "corner_zonas": {k: float(v * 100) for k, v in cz.value_counts(normalize=True).items()},
        "corner_primer_contacto_pct": float(c.first_contact_own.dropna().astype(float).mean() * 100) if len(c) else None,
        "corner_remate_pct": float(c.shot.mean() * 100) if len(c) else None,
        "corner_xg": float(c.xg.mean()) if len(c) else None,
        "corner_goles": int(c.goal.sum()),
        "atacantes_area_360": float(c.att_in_box.mean()) if c.att_in_box.notna().any() else None,
        "defensores_area_360": float(c.def_in_box.mean()) if c.def_in_box.notna().any() else None,
        "tl_por_partido": len(fk) / n_matches, "tl_xg": float(fk.xg.mean()) if len(fk) else None,
        "tl_remate_pct": float(fk.shot.mean() * 100) if len(fk) else None,
        "banda_peligrosa_por_partido": len(th) / n_matches, "banda_xg": float(th.xg.mean()) if len(th) else None,
        "banda_larga_pct": float((~th.short).mean() * 100) if len(th) else None,
        "xg_total_por_partido": float(d.xg.sum() / n_matches),
        "goles": int(d.goal.sum()),
        "envios": [[round(float(a), 1), round(float(b), 1), int(s)] for a, b, s in zip(c.end_x, c.end_y, c.shot) if a == a][:400],
        "remates": [[round(float(a), 1), round(float(b), 1), round(float(x), 3)] for a, b, x in zip(d.shot_x, d.shot_y, d.xg) if a == a][:300],
    }


def coach_setpieces(sp: pd.DataFrame, my: pd.DataFrame) -> dict:
    """my: partidos del DT con columnas match_id, team_id (su equipo)."""
    n = my.match_id.nunique()
    k = sp.merge(my[["match_id", "team_id"]], on="match_id", suffixes=("", "_dt"))
    att = k[k.team_id == k.team_id_dt]
    dfn = k[k.team_id != k.team_id_dt]
    league_n = sp.match_id.nunique() * 2
    lg = _summary(sp, league_n)
    lg.pop("envios", None); lg.pop("remates", None)
    return {"ofensivo": _summary(att, n), "defensivo": _summary(dfn, n), "liga": lg}
