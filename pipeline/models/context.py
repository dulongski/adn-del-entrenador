"""Consistencia y ajustes por contexto (5.2).

1) Curvas de reacción: estilo AJUSTADO (z − club − jugadores − rival) del DT por estado del
   marcador, tramo de minutos, localía y fuerza del rival, comparado con la curva de la liga.
   La diferencia es el ajuste propio del DT.
2) Motores de variación partido a partido: LightGBM poco profundo + SHAP sobre los partidos
   del DT, con el contexto y el ESTILO DEL RIVAL como variables explicativas.
3) Evolución: KPIs ajustados por partido en el tiempo (media móvil)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.framework import CFG
from pipeline.models import decomposition as dec

C = CFG()
_E = C["contexto"]["minute_buckets"]
MIN_LABELS = [f"{a}-{b}'" for a, b in zip(_E[:-2], _E[1:-1])] + [f"{_E[-2]}'+"]

KEY_KPIS = ["posesion", "verticalidad", "ppda", "altura_presion", "linea_360", "contraataque",
            "xg_90", "xg_contra_90", "pase_largo", "field_tilt"]


def adjusted_segments(seg: pd.DataFrame, F: dec.Fit, keep_coach: bool = True) -> tuple[pd.DataFrame, pd.DataFrame]:
    Z, W, _ = dec.targets(seg, F.stats)
    comps = dec.components(F, seg)
    A = Z - comps["club"][Z.columns].values - comps["player"][Z.columns].values - comps["opp"][Z.columns].values
    return A, W


def opp_strength(seg: pd.DataFrame) -> pd.Series:
    """Fuerza del rival: diferencia de xG por 90 del rival en esa temporada (todos sus partidos)."""
    t = seg.groupby(["team_id", "season_id"]).agg(xg=("npxg", "sum"), xga=("npxg_against", "sum"), dur=("dur", "sum"))
    t["xgd90"] = (t.xg - t.xga) / t.dur * 5400
    return seg.set_index(["opp_id", "season_id"]).index.map(t.xgd90.to_dict().get)


def context_bins(seg: pd.DataFrame) -> pd.DataFrame:
    b = pd.DataFrame(index=seg.index)
    gd = seg.goal_diff
    b["marcador"] = np.select([gd < -0.5, gd > 0.5], ["Perdiendo", "Ganando"], "Empatando")
    tm = seg.w_tmid / 60
    # grupos de 15 minutos del marco (config/framework.yaml → contexto.minute_buckets)
    edges = [-1] + list(C["contexto"]["minute_buckets"][1:])
    b["minuto"] = pd.cut(tm, edges, labels=MIN_LABELS).astype(str)
    b["localia"] = np.where(seg.home == 1, "Local", "Visitante")
    osd = pd.Series(opp_strength(seg), index=seg.index).astype(float)
    q = osd.quantile([1 / 3, 2 / 3]).values
    b["rival"] = np.select([osd <= q[0], osd >= q[1]], ["Rival débil", "Rival fuerte"], "Rival medio")
    return b


def reaction_curves(seg: pd.DataFrame, F: dec.Fit, coach_id: int, kpis=KEY_KPIS) -> dict:
    A, W = adjusted_segments(seg, F)
    B = context_bins(seg)
    me = seg.coach_id == coach_id
    out = {}
    for dim in ["marcador", "minuto", "localia", "rival"]:
        out[dim] = {}
        for k in kpis:
            rows = []
            for lvl, idx in B.groupby(dim).groups.items():
                idx = pd.Index(idx)
                def wmean(mask):
                    m = mask.reindex(idx).fillna(False).values & A.loc[idx, k].notna().values
                    w = W.loc[idx, k].values[m]
                    return (float(np.average(A.loc[idx, k].values[m], weights=w)), float(w.sum()), int(m.sum())) if w.sum() > 0 else (None, 0.0, 0)
                c, cw, cn = wmean(me)
                l, lw, ln = wmean(~me)
                rows.append({"nivel": lvl, "dt": c, "liga": l, "n_dt": cn})
            order = {"marcador": ["Perdiendo", "Empatando", "Ganando"], "minuto": MIN_LABELS,
                     "localia": ["Local", "Visitante"], "rival": ["Rival débil", "Rival medio", "Rival fuerte"]}[dim]
            rows.sort(key=lambda r: order.index(r["nivel"]) if r["nivel"] in order else 99)
            out[dim][k] = rows
    return out


def drivers(seg: pd.DataFrame, F: dec.Fit, coach_id: int, coach_profiles: pd.DataFrame, kpis=KEY_KPIS) -> dict:
    """SHAP sobre un GBM poco profundo a nivel partido: qué explica que el DT cambie su estilo."""
    import lightgbm as lgb
    import shap
    from pipeline.models.transfer_test import match_vectors
    me = seg[seg.coach_id == coach_id]
    if me.match_id.nunique() < 15:
        return {}
    V = match_vectors(me, F, adjust=True)
    ctx = me.groupby(["match_id", "team_id"]).agg(
        local=("home", "first"), rival_id=("opp_id", "first"), season_id=("season_id", "first"),
        dif_goles=("goal_diff", "mean")).reindex(V.index)
    osd = pd.Series(opp_strength(seg), index=seg.index)
    os_ = osd[me.index].groupby([me.match_id, me.team_id]).first().reindex(V.index)
    # estilo del rival: perfil de su DT en esa temporada (α del DT rival)
    opp_coach = seg.groupby(["match_id", "team_id"]).coach_id.first()
    rc = [opp_coach.get((m, o)) for (m, _t), o in zip(V.index, ctx.rival_id)]
    X = pd.DataFrame({
        "local": ctx.local.values,
        "fuerza_rival": os_.values,
        "dif_goles_media": ctx.dif_goles.values,
        "rival_presion": [coach_profiles.loc[c, "ppda"] * -1 if c in coach_profiles.index else np.nan for c in rc],
        "rival_posesion": [coach_profiles.loc[c, "posesion"] if c in coach_profiles.index else np.nan for c in rc],
        "rival_verticalidad": [coach_profiles.loc[c, "verticalidad"] if c in coach_profiles.index else np.nan for c in rc],
    }, index=V.index)
    out = {}
    for k in kpis:
        y = V[k].values
        m = lgb.LGBMRegressor(n_estimators=150, learning_rate=0.05, num_leaves=4, min_child_samples=8,
                              subsample=0.8, subsample_freq=1, colsample_bytree=0.8, verbose=-1, random_state=0)
        m.fit(X, y)
        sv = shap.TreeExplainer(m).shap_values(X)
        imp = np.abs(sv).mean(0)
        feats = []
        for j, f in enumerate(X.columns):
            x = X[f].values
            ok = ~np.isnan(x)
            direction = float(np.corrcoef(x[ok], sv[ok, j])[0, 1]) if ok.sum() > 3 and np.std(x[ok]) > 0 and np.std(sv[ok, j]) > 0 else 0.0
            feats.append({"variable": f, "importancia": float(imp[j]), "direccion": direction,
                          "puntos": [[float(a), float(b)] for a, b in zip(x[ok][:200], sv[ok, j][:200])]})
        feats.sort(key=lambda d: -d["importancia"])
        out[k] = feats
    return out


def evolution(seg: pd.DataFrame, F: dec.Fit, coach_id: int, kpis=KEY_KPIS, window: int = 5) -> list[dict]:
    from pipeline.models.transfer_test import match_vectors
    me = seg[seg.coach_id == coach_id]
    V = match_vectors(me, F, adjust=True)
    Vr = match_vectors(me, F, adjust=False)
    info = me.groupby(["match_id", "team_id"]).agg(date=("date", "first"), club_id=("club_id", "first")).reindex(V.index)
    V = V.assign(date=info.date.values, club_id=info.club_id.values).sort_values("date")
    Vr = Vr.reindex(V.index)
    rows = []
    roll = V[kpis].rolling(window, min_periods=1).mean()
    for i, (idx, r) in enumerate(V.iterrows()):
        rows.append({"match_id": int(idx[0]), "date": r.date, "club_id": int(r.club_id),
                     **{f"{k}": float(r[k]) for k in kpis}, **{f"{k}_movil": float(roll.loc[idx, k]) for k in kpis},
                     **{f"{k}_crudo": float(Vr.loc[idx, k]) for k in kpis}})
    return rows


def dispersion(seg: pd.DataFrame, F: dec.Fit) -> pd.Series:
    """Variabilidad partido a partido del estilo ajustado (distancia media al centroide del DT)."""
    from pipeline.models.transfer_test import match_vectors
    V = match_vectors(seg, F, adjust=True)
    y = seg.groupby(["match_id", "team_id"]).coach_id.first().reindex(V.index)
    cols = [c for c in V.columns if not c.startswith("arq_")]
    d = {}
    for c, g in V[cols].groupby(y.values):
        if len(g) >= 8:
            d[c] = float(np.sqrt(((g - g.mean()) ** 2).sum(1)).mean())
    return pd.Series(d)
