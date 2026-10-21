"""Trasplante de estilo: estudio de eventos alrededor de los cambios de entrenador.

Pregunta: cuando llega un DT nuevo a un club, ¿el equipo se mueve hacia el estilo que ese DT
mostró en OTROS clubes? ¿Cuánto y en cuántos partidos?

Diseño (cada pieza responde a una amenaza concreta):
  1. Evento e = primer partido del DT nuevo n en el club c (antes dirigía o). Se exigen >= MIN_PRE
     partidos de o antes y >= MIN_POST de n después, y >= MIN_OTHER partidos de n en otros clubes.
  2. Huella fuera de muestra: se reajusta la descomposición SIN la etapa de n en c (como la prueba de
     transferencia). Así α_n sale sólo de sus otros clubes: nada de lo que pasa después del cambio
     entra en la predicción (sin circularidad).
  3. Dirección predicha d = α_n − α_o (34 indicadores, en σ). Puntaje por partido:
        s_t = (V_t − V̄_pre) · d / (d · d)
     0 = el equipo sigue como con o; 1 = se movió exactamente lo que predice el cambio de DT.
     V_t: vector de estilo del partido. Dos versiones: «crudo» (lo que se ve) y «sin plantilla»
     (V − aporte de jugadores, rival y contexto según el ajuste fuera de muestra): esta última
     descuenta fichajes y rotación, la amenaza principal.
  4. Placebo de DT (inferencia por permutación): se reemplaza α_n por la huella de otro DT al azar
     (misma α_o). Conserva el componente «alejarse del DT anterior» y la regresión a la media; lo
     único que cambia es la parte específica del DT nuevo. p = rango del efecto real en esa nula.
  5. Placebo de tiempo: fechas falsas a mitad de etapas largas sin cambio (mismo DT) con la
     dirección de un DT al azar: sin cambio real, el puntaje no debe saltar.
  6. Tendencia previa: pendiente de s_t antes del cambio ≈ 0 (supuesto de tendencias paralelas).
  7. Intervalos: bootstrap por evento (los partidos de un mismo cambio no son independientes).
  8. Vida media: s_t ≈ A·(1 − e^(−t/τ)); τ·ln2 = partidos hasta ver la mitad del efecto final.
  9. Sensibilidad: sólo cambios a mitad de temporada (plantilla casi fija), y MIN_OTHER alternativo.

  python -m pipeline.models.transplant  ->  artifacts/transplant.json (+ web/public/data/transplant.json)
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.features.style_kpis import BASE_KPIS
from pipeline.models import decomposition as dec
from pipeline.models.transfer_test import _design_like, match_vectors
from pipeline.paths import PROC

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "artifacts"
WEB = ROOT / "web" / "public" / "data"

MIN_PRE, MIN_POST, MIN_OTHER = 6, 6, 8
WIN = 17                       # partidos a cada lado (un torneo de Liga MX)
N_PERM, N_BOOT, N_TIME = 1000, 2000, 400
RNG = np.random.default_rng(2026)


def events(seg: pd.DataFrame, min_other: int = MIN_OTHER) -> pd.DataFrame:
    g = (seg.groupby(["club_id", "match_id"])
         .agg(date=("date", "first"), coach=("coach_id", "first"), season=("season_id", "first"))
         .reset_index().sort_values(["club_id", "date"]))
    other = seg.groupby(["coach_id", "club_id"]).match_id.nunique().reset_index()
    out = []
    for c, d in g.groupby("club_id"):
        d = d.reset_index(drop=True)
        for i in range(1, len(d)):
            o, n = d.coach[i - 1], d.coach[i]
            if o == n:
                continue
            pre = int((d.coach[:i][::-1] == o).cumprod().sum())
            post = int((d.coach[i:] == n).cumprod().sum())
            n_other = int(other[(other.coach_id == n) & (other.club_id != c)].match_id.sum())
            if pre >= MIN_PRE and post >= MIN_POST and n_other >= min_other:
                pre_m = d.match_id[i - min(pre, WIN):i].tolist()
                post_m = d.match_id[i:i + min(post, WIN)].tolist()
                # cambio a mitad de temporada: los partidos previos y posteriores de la ventana son de la misma temporada
                mid = bool(d.season[i - min(pre, WIN)] == d.season[min(i + min(post, WIN) - 1, len(d) - 1)])
                out.append(dict(club_id=int(c), date=str(d.date[i])[:10], old=int(o), new=int(n), pre=pre, post=post,
                                new_other=n_other, mid=mid, pre_m=pre_m, post_m=post_m))
    return pd.DataFrame(out)


def _vectors(seg_sub: pd.DataFrame, F: dec.Fit, kpis) -> dict[str, pd.DataFrame]:
    Fx = dec.Fit(_design_like(seg_sub.reset_index(drop=True), F), F.coef, F.stats, F.lam)
    s = seg_sub.reset_index(drop=True)
    raw = match_vectors(s, Fx, adjust=False)[kpis]
    # «sin plantilla»: se quitan jugadores, rival y contexto (no el club: es fijo dentro del evento)
    Z, W, _ = dec.targets(s, F.stats)
    Z = Z[kpis]
    comps = dec.components(Fx, s)
    for b in ["player", "opp", "ctx"]:
        Z = Z - comps[b][kpis].values
    W = W[kpis]
    keys = s[["match_id", "team_id"]]
    num = (Z.fillna(0) * W).groupby([keys.match_id, keys.team_id]).sum()
    den = W.groupby([keys.match_id, keys.team_id]).sum()
    adj = (num / den.replace(0, np.nan)).fillna(0.0)
    return {"crudo": raw, "sin_plantilla": adj}


def score(V: pd.DataFrame, club: int, pre_m, post_m, d: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Puntaje s_t por partido (pre en orden cronológico, post desde el primer partido)."""
    Vc = V.xs(club, level="team_id")
    pre = Vc.reindex(pre_m).dropna().values
    post = Vc.reindex(post_m).dropna().values
    base = pre.mean(0)
    dd = float(d @ d) or 1e-9
    return (pre - base) @ d / dd, (post - base) @ d / dd


def run(log=print) -> dict:
    kpis = list(BASE_KPIS)
    M = pd.read_parquet(PROC / "matches.parquet")
    S = pd.read_parquet(PROC / "stints.parquet")
    seg = dec.build_segments(S, M)
    E = events(seg)
    cn = pd.concat([M[["home_coach_id", "home_coach"]].set_axis(["id", "n"], axis=1), M[["away_coach_id", "away_coach"]].set_axis(["id", "n"], axis=1)]).dropna().drop_duplicates("id").set_index("id").n
    kn = pd.concat([M[["home_id", "home"]].set_axis(["id", "n"], axis=1), M[["away_id", "away"]].set_axis(["id", "n"], axis=1)]).drop_duplicates("id").set_index("id").n
    log(f"eventos utilizables: {len(E)} (a mitad de temporada: {int(E.mid.sum())})")
    F_all = dec.fit(seg, kpis=kpis)
    coach_ids = [c[1] for c in F_all.coef.index if c[0] == "coach"]

    per_event = []
    for e in E.itertuples():
        hold = (seg.coach_id == e.new) & (seg.club_id == e.club_id)
        F = dec.fit(seg[~hold], kpis=kpis)                         # α_n sólo de sus otros clubes
        A = {c[1]: F.coef.loc[c, kpis].values for c in F.coef.index if c[0] == "coach"}
        if e.new not in A or e.old not in A:
            continue
        d = A[e.new] - A[e.old]
        sub = seg[seg.match_id.isin(e.pre_m + e.post_m)]
        Vs = _vectors(sub, F, kpis)
        rec = dict(club_id=e.club_id, date=e.date, old=e.old, new=e.new, mid=e.mid, new_other=e.new_other,
                   d_norm=float(np.linalg.norm(d)), old_n=str(cn.get(e.old, "")), new_n=str(cn.get(e.new, "")), club_n=str(kn.get(e.club_id, "")))
        # dirección placebo: el DT nuevo sustituido por otros DTs con huella (misma α_o)
        others = [c for c in A if c not in (e.new, e.old)]
        perm = RNG.choice(others, size=N_PERM, replace=True)
        rec["a_new"], rec["a_old"] = A[e.new].tolist(), A[e.old].tolist()
        rec["perm_alpha"] = np.stack([A[c] for c in perm]).astype(np.float32)
        for k, V in Vs.items():
            pre_s, post_s = score(V, e.club_id, e.pre_m, e.post_m, d)
            Vc0 = V.xs(e.club_id, level="team_id")
            rec[f"delta_{k}"] = (Vc0.reindex(e.post_m).dropna().values.mean(0) - Vc0.reindex(e.pre_m).dropna().values.mean(0)).tolist()
            rec[f"pre_{k}"], rec[f"post_{k}"] = pre_s.tolist(), post_s.tolist()
            # efecto placebo por permutación (media post del puntaje con la dirección de otro DT)
            Vc = V.xs(e.club_id, level="team_id")
            pre_v, post_v = Vc.reindex(e.pre_m).dropna().values, Vc.reindex(e.post_m).dropna().values
            base = pre_v.mean(0)
            Dp = np.stack([A[c] - A[e.old] for c in perm])          # N_PERM × K
            num = (post_v - base) @ Dp.T                              # n_post × N_PERM
            rec[f"perm_{k}"] = (num.mean(0) / np.einsum("ij,ij->i", Dp, Dp)).tolist()
        per_event.append(rec)
        log(f"  {e.date} club {e.club_id}: {e.old}→{e.new}  post medio crudo={np.mean(rec['post_crudo']):+.2f} "
            f"sin plantilla={np.mean(rec['post_sin_plantilla']):+.2f}")

    # placebo de tiempo: fechas falsas dentro de etapas largas del mismo DT
    time_pl = time_placebo(seg, F_all, kpis, coach_ids)
    return {"eventos": per_event, "placebo_tiempo": time_pl, "params": dict(MIN_PRE=MIN_PRE, MIN_POST=MIN_POST,
            MIN_OTHER=MIN_OTHER, WIN=WIN, N_PERM=N_PERM, N_BOOT=N_BOOT)}


def time_placebo(seg, F, kpis, coach_ids) -> list[float]:
    """Etapas de >= 2·WIN partidos con el mismo DT: se corta en un punto al azar y se mide el
    'efecto' con la dirección de un DT al azar. Sin cambio real debe dar ≈ 0."""
    g = (seg.groupby(["club_id", "match_id"]).agg(date=("date", "first"), coach=("coach_id", "first"))
         .reset_index().sort_values(["club_id", "date"]))
    A = {c[1]: F.coef.loc[c, kpis].values for c in F.coef.index if c[0] == "coach"}
    V = match_vectors(seg, F, adjust=False)[kpis]
    out = []
    for (c, k), d in g.groupby(["club_id", (g.coach != g.coach.shift()).cumsum()]):
        d = d.reset_index(drop=True)
        coach = d.coach[0]
        if len(d) < 2 * MIN_PRE + 4 or coach not in A:
            continue
        for _ in range(max(1, N_TIME // 60)):
            i = int(RNG.integers(MIN_PRE, len(d) - MIN_POST))
            pre_m = d.match_id[max(0, i - WIN):i].tolist(); post_m = d.match_id[i:i + WIN].tolist()
            other = RNG.choice([x for x in A if x != coach])
            dd = A[other] - A[coach]
            _, post = score(V, c, pre_m, post_m, dd)
            out.append(float(post.mean()))
    return out


# ---------------------------------------------------------------- resumen estadístico
def _curve(evs, key, side):
    L = WIN
    M = np.full((len(evs), L), np.nan)
    for i, e in enumerate(evs):
        v = e[f"{side}_{key}"]
        if side == "pre":
            v = v[-L:]; M[i, L - len(v):] = v
        else:
            v = v[:L]; M[i, :len(v)] = v
    return M


def _halflife(t, y):
    from scipy.optimize import curve_fit
    try:
        (A, tau), _ = curve_fit(lambda x, A, tau: A * (1 - np.exp(-x / tau)), t, y, p0=[max(y.max(), .1), 3], bounds=([0, .05], [5, 60]), maxfev=5000)
        return float(A), float(tau * np.log(2))
    except Exception:
        return float("nan"), float("nan")


def _ols(Y, Xn, Xo, kk):
    # Δ_ek = μ_k + b·α_new,ek + c·α_old,ek  (efecto fijo por indicador vía desmedia por k)
    def dm(a):
        return a - np.bincount(kk, a, minlength=kk.max() + 1)[kk] / np.bincount(kk)[kk]
    X = np.column_stack([dm(Xn), dm(Xo)])
    return np.linalg.lstsq(X, dm(Y), rcond=None)[0]


def transplant_coef(evs, key) -> dict:
    """Coeficiente de trasplante b: cuánto del perfil del DT nuevo (estimado en otros clubes) aparece
    en el cambio de estilo del equipo, controlando por el perfil del DT anterior. b = 0 sin trasplante.
    Inferencia: bootstrap por evento y permutación (α_new de un DT al azar)."""
    K = len(evs[0]["a_new"])
    D = np.stack([e[f"delta_{key}"] for e in evs]); An = np.stack([e["a_new"] for e in evs]); Ao = np.stack([e["a_old"] for e in evs])
    kk = np.tile(np.arange(K), len(evs))
    b, c = _ols(D.ravel(), An.ravel(), Ao.ravel(), kk)
    B = RNG.integers(0, len(evs), size=(N_BOOT, len(evs)))
    bb = np.array([_ols(D[i].ravel(), An[i].ravel(), Ao[i].ravel(), kk)[0] for i in B])
    P = np.stack([e["perm_alpha"] for e in evs])                               # eventos × N_PERM × K
    pb = np.array([_ols(D.ravel(), P[:, j].ravel(), Ao.ravel(), kk)[0] for j in range(P.shape[1])])
    return {"b": float(b), "c": float(c), "ic95": [float(np.percentile(bb, 2.5)), float(np.percentile(bb, 97.5))],
            "p_permutacion": float((1 + (pb >= b).sum()) / (1 + len(pb))),
            "nula_media": float(pb.mean()), "nula_p95": float(np.percentile(pb, 95))}


def _loco(evs, eff, spec) -> dict:
    clubs = sorted({e["club_id"] for e in evs})
    m = [eff[[e["club_id"] != c for e in evs]].mean() for c in clubs]
    ms = [spec[[e["club_id"] != c for e in evs]].mean() for c in clubs]
    return {"efecto_min": float(min(m)), "efecto_max": float(max(m)), "especifico_min": float(min(ms)), "especifico_max": float(max(ms)), "n_clubes": len(clubs)}


def summarize(R: dict) -> dict:
    evs = R["eventos"]
    out = {"n_eventos": len(evs), "n_mitad_temporada": int(sum(e["mid"] for e in evs)), "params": R["params"]}
    t = np.arange(1, WIN + 1)
    for key in ["crudo", "sin_plantilla"]:
        for subset, sel in [("todos", evs), ("mitad_temporada", [e for e in evs if e["mid"]])]:
            if len(sel) < 5:
                continue
            Pre, Post = _curve(sel, key, "pre"), _curve(sel, key, "post")
            eff = np.array([np.mean(e[f"post_{key}"]) for e in sel])          # efecto por evento
            pre_mean = np.array([np.mean(e[f"pre_{key}"]) for e in sel])
            perm = np.array([e[f"perm_{key}"] for e in sel])                   # eventos × N_PERM
            null = perm.mean(0)                                                # efecto medio bajo la nula
            obs = float(eff.mean())
            # bootstrap por evento
            B = RNG.integers(0, len(sel), size=(N_BOOT, len(sel)))
            boot = eff[B].mean(1)
            spec_b = boot - perm.mean(1)[B].mean(1)                            # efecto real − nula, mismo remuestreo
            post_curve = np.nanmean(Post, 0)
            bc = np.stack([np.nanmean(Post[b], 0) for b in B[:500]])
            pc = np.stack([np.nanmean(Pre[b], 0) for b in B[:500]])
            # tendencia previa: pendiente de la curva pre
            tt = np.arange(-WIN, 0)
            pre_curve = np.nanmean(Pre, 0)
            ok = ~np.isnan(pre_curve)
            slope = float(np.polyfit(tt[ok], pre_curve[ok], 1)[0]) if ok.sum() > 3 else float("nan")
            slopes = []
            for b in pc:
                m = ~np.isnan(b)
                if m.sum() > 3:
                    slopes.append(np.polyfit(tt[m], b[m], 1)[0])
            A, hl = _halflife(t[~np.isnan(post_curve)], post_curve[~np.isnan(post_curve)])
            hls = []
            for b in bc[:300]:
                m = ~np.isnan(b)
                hls.append(_halflife(t[m], b[m])[1])
            hls = np.array([h for h in hls if np.isfinite(h)])
            out[f"{key}_{subset}"] = {
                "n": len(sel),
                "efecto": obs, "ic95": [float(np.percentile(boot, 2.5)), float(np.percentile(boot, 97.5))],
                "p_permutacion": float((1 + (null >= obs).sum()) / (1 + len(null))),
                "nula_media": float(null.mean()), "nula_p95": float(np.percentile(null, 95)),
                "especifico": obs - float(null.mean()),
                "especifico_ic95": [float(np.percentile(spec_b, 2.5)), float(np.percentile(spec_b, 97.5))],
                "eventos_positivos": int((eff > 0).sum()),
                "eventos_sobre_su_nula": int(sum(eff[i] > np.percentile(perm[i], 50) for i in range(len(sel)))),
                "pre_media": float(pre_mean.mean()),
                "pendiente_pre": slope, "pendiente_pre_ic95": [float(np.percentile(slopes, 2.5)), float(np.percentile(slopes, 97.5))] if slopes else None,
                "asintota": A, "vida_media": hl,
                "vida_media_ic95": [float(np.percentile(hls, 2.5)), float(np.percentile(hls, 97.5))] if len(hls) > 20 else None,
                "curva_pre": [None if np.isnan(x) else float(x) for x in pre_curve],
                "curva_post": [None if np.isnan(x) else float(x) for x in post_curve],
                "curva_post_lo": [float(x) for x in np.nanpercentile(bc, 2.5, 0)],
                "curva_post_hi": [float(x) for x in np.nanpercentile(bc, 97.5, 0)],
                "curva_pre_lo": [float(x) for x in np.nanpercentile(pc, 2.5, 0)],
                "curva_pre_hi": [float(x) for x in np.nanpercentile(pc, 97.5, 0)],
                "nula_hist": np.histogram(null, bins=30)[0].tolist(), "nula_bins": np.histogram(null, bins=30)[1].tolist(),
            }
    for key in ["crudo", "sin_plantilla"]:
        out[f"coef_{key}"] = transplant_coef(evs, key)
    # sensibilidad: más partidos en otros clubes (huella más precisa) y sin cada club (influencia)
    eff = np.array([np.mean(e["post_sin_plantilla"]) for e in evs])
    null = np.array([e["perm_sin_plantilla"] for e in evs])
    spec = eff - null.mean(1)                                                  # efecto específico por evento
    strict = np.array([e["new_other"] >= 15 for e in evs])
    out["sensibilidad"] = {
        "otros15": {"n": int(strict.sum()), "efecto": float(eff[strict].mean()), "especifico": float(spec[strict].mean()),
                    "p_permutacion": float((1 + (null[strict].mean(0) >= eff[strict].mean()).sum()) / (1 + null.shape[1]))},
        "sin_un_club": _loco(evs, eff, spec),
    }
    tp = np.array(R["placebo_tiempo"])
    if len(tp):
        bm = tp[RNG.integers(0, len(tp), size=(N_BOOT, len(tp)))].mean(1)
        out["placebo_tiempo"] = {"n": int(len(tp)), "media": float(tp.mean()),
                                 "media_ic95": [float(np.percentile(bm, 2.5)), float(np.percentile(bm, 97.5))],
                                 "p05_p95": [float(np.percentile(tp, 5)), float(np.percentile(tp, 95))],
                                 "hist": np.histogram(tp, bins=30, range=(-4, 4))[0].tolist()}
    out["eventos"] = [{k: e[k] for k in ("club_id", "date", "old", "new", "mid", "new_other", "old_n", "new_n", "club_n")} |
                      {"efecto_crudo": float(np.mean(e["post_crudo"])), "efecto_sin_plantilla": float(np.mean(e["post_sin_plantilla"])),
                       "post_sin_plantilla": [float(x) for x in e["post_sin_plantilla"]],
                       "pre_sin_plantilla": [float(x) for x in e["pre_sin_plantilla"]],
                       "p_evento": float((1 + (np.array(e["perm_sin_plantilla"]) >= np.mean(e["post_sin_plantilla"])).sum()) / (1 + len(e["perm_sin_plantilla"])))}
                      for e in evs]
    return out


def main():
    R = run()
    out = summarize(R)
    ART.mkdir(exist_ok=True)
    json.dump(out, open(ART / "transplant.json", "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(out, open(WEB / "transplant.json", "w"), ensure_ascii=False, separators=(",", ":"))
    for k in ["crudo_todos", "sin_plantilla_todos", "sin_plantilla_mitad_temporada"]:
        if k in out:
            r = out[k]
            print(f"{k}: efecto {r['efecto']:+.3f} IC95 [{r['ic95'][0]:+.3f},{r['ic95'][1]:+.3f}] p_perm={r['p_permutacion']:.4f} "
                  f"nula={r['nula_media']:+.3f} pendiente_pre={r['pendiente_pre']:+.4f} vida_media={r['vida_media']:.1f} n={r['n']}")
    for k in ["coef_crudo", "coef_sin_plantilla"]:
        print(k, out[k])
    print("sensibilidad:", out["sensibilidad"])
    if "placebo_tiempo" in out:
        print("placebo tiempo:", {k: v for k, v in out["placebo_tiempo"].items() if k != "hist"})


if __name__ == "__main__":
    main()
