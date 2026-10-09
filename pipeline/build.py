"""Orquestador: tablas procesadas -> modelos -> artefactos JSON por DT (artifacts/).

  python -m pipeline.build                 # todos los DTs con >= MIN_MATCHES partidos
  python -m pipeline.build --coach Almada  # sólo DTs cuyo nombre contenga 'Almada'
  python -m pipeline.build --fast          # sin bootstrap ni prueba de transferencia (debug)

Sólo resultados agregados salen a artifacts/ (los datos crudos se quedan en data/)."""
from __future__ import annotations

import argparse
import json
import pickle
import time
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline import sb_client as sb
from pipeline.features import players as pl
from pipeline.features import setpieces as spc
from pipeline.features.style_kpis import BASE_KPIS, COUNTERS, FAMILIES, KPIS, register_kpi
from pipeline.framework import CFG
from pipeline.models import archetypes as arq
from pipeline.models import context as ctxm
from pipeline.models import decomposition as dec
from pipeline.models import simulation as sim
from pipeline.models import transfer_test as tt
from pipeline.report import narrative

ROOT = Path(__file__).resolve().parents[1]
PROC = sb.DATA / "processed"
CACHE = sb.DATA / "model_cache"
ART = ROOT / "artifacts"
MIN_MATCHES = 10


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-")


def jsonable(o):
    if isinstance(o, dict):
        return {str(k): jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [jsonable(v) for v in o]
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if not np.isfinite(o) else round(float(o), 4)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, pd.Timestamp):
        return o.isoformat()
    return o


def load():
    T = {k: pd.read_parquet(PROC / f"{k}.parquet") for k in
         ["matches", "stints", "possessions", "shots", "subs", "lineups", "players", "setpieces"]}
    T["actions"] = pd.read_parquet(PROC / "actions.parquet")
    return T


# ---------------------------------------------------------------- mapas
def grid_counts(df, nx=12, ny=8, xcol="x", ycol="y"):
    gx = np.clip((df[xcol] / 120 * nx).astype(int), 0, nx - 1)
    gy = np.clip((df[ycol] / 80 * ny).astype(int), 0, ny - 1)
    g = np.zeros((nx, ny))
    np.add.at(g, (gx.values, gy.values), 1)
    return g


def coach_maps(A: pd.DataFrame, my: pd.DataFrame, league_grids: dict):
    k = A.merge(my[["match_id", "team_id"]], on=["match_id", "team_id"])
    n = max(my.match_id.nunique(), 1)
    sel = {
        "presion": k[k.type == "Pressure"],
        "recuperaciones": k[k.type.isin(["Ball Recovery", "Interception"])],
        "progresion": k[k.prog].rename(columns={"end_x": "ex", "end_y": "ey"}),
    }
    out = {}
    for name, d in sel.items():
        if name == "progresion":
            g = grid_counts(d, xcol="ex", ycol="ey") / n
        else:
            g = grid_counts(d) / n
        out[name] = {"dt": g.round(3).tolist(), "liga": (league_grids[name]).round(3).tolist(),
                     "dif": (g - league_grids[name]).round(3).tolist()}
    return out


def league_grids(A: pd.DataFrame, n_team_matches: int):
    return {
        "presion": grid_counts(A[A.type == "Pressure"]) / n_team_matches,
        "recuperaciones": grid_counts(A[A.type.isin(["Ball Recovery", "Interception"])]) / n_team_matches,
        "progresion": grid_counts(A[A.prog], xcol="end_x", ycol="end_y") / n_team_matches,
    }


def pass_network(A: pd.DataFrame, my: pd.DataFrame, stints: pd.DataFrame, names: pd.Series, top: int = 11):
    k = A.merge(my[["match_id", "team_id"]], on=["match_id", "team_id"])
    st = stints.merge(my[["match_id", "team_id"]], on=["match_id", "team_id"])
    ex = st[["dur", "players"]].explode("players").dropna()
    mins = ex.groupby("players").dur.sum().sort_values(ascending=False) / 60
    core = [int(p) for p in mins.index[:top]]
    p = k[(k.type == "Pass") & k.outcome.isna() & k.player_id.isin(core)]
    nodes = []
    for pid in core:
        d = p[p.player_id == pid]
        if len(d) == 0:
            continue
        nodes.append({"id": pid, "nombre": names.get(pid, str(pid)), "x": float(d.x.mean()), "y": float(d.y.mean()),
                      "pases": float(len(d) / max(mins[pid] / 90, 1)), "minutos": float(mins[pid])})
    e = p[p.recipient_id.isin(core)].groupby(["player_id", "recipient_id"]).size().reset_index(name="n")
    n = max(my.match_id.nunique(), 1)
    edges = [{"a": int(r.player_id), "b": int(r.recipient_id), "n": float(r.n / n)} for r in e.itertuples() if r.n / n >= 1.0]
    return {"nodos": nodes, "aristas": edges}


# ---------------------------------------------------------------- principal
def main(coach_filter=None, fast=False, n_boot=30, solo_extra=False):
    """solo_extra=True: NO reescribe los 74 perfiles ni global.json; aplica el MISMO ajuste (mismos datos y λ
    → mismos coeficientes) para generar el perfil de los DTs actuales con 5–9 partidos y los agrega."""
    ART.mkdir(exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    log("cargando tablas")
    T = load()
    M, S, P = T["matches"], T["stints"], T["possessions"]
    names = T["players"].set_index("player_id").player

    # --- arquetipos -> KPIs adicionales (misma semántica num/den por stint)
    log("arquetipos de posesión")
    gmm, scaler, labels, cent, arq_names = arq.fit(P)
    P["arq"] = labels.values
    st_t0 = S[S.home == 1].groupby("match_id").t0.apply(np.sort)
    P["stint"] = [int(np.searchsorted(st_t0[m], t, side="right") - 1) if m in st_t0.index else 0 for m, t in zip(P.match_id, P.t0)]
    P["stint"] = P.stint.clip(lower=0)
    arq_cnt = P[P.arq >= 0].pivot_table(index=["match_id", "stint", "team_id"], columns="arq", values="poss", aggfunc="count", fill_value=0)
    arq_cnt.columns = [f"arq_{c}" for c in arq_cnt.columns]
    arq_cnt["n_poss_op"] = arq_cnt.sum(1)
    S = S.merge(arq_cnt.reset_index(), on=["match_id", "stint", "team_id"], how="left")
    for c in list(arq_cnt.columns):
        S[c] = S[c].fillna(0)
    for k, v in arq_names.items():
        register_kpi(f"arq_{k}", f"arq_{k}", "n_poss_op", 100, v["nombre"], "Arquetipos", f"% de posesiones en juego del arquetipo '{v['nombre']}'.")

    # --- segmentos y descomposición
    log("segmentos")
    seg = dec.build_segments(S, M)
    log(f"  {len(seg)} filas segmento-equipo, {seg.coach_id.nunique()} DTs, {seg.match_id.nunique()} partidos")
    D = dec.build_design(seg)
    log(f"  diseño {D.X.shape}")
    F = dec.fit(seg, design=D)
    Z, W, _ = dec.targets(seg, F.stats)
    shares = dec.variance_shares_grouped(F, seg)
    shares_seg = dec.variance_shares(F, seg)
    alpha = dec.coach_table(F)
    ident = dec.identifiability(seg)
    se = None
    if not fast:
        log("bootstrap")
        se = dec.bootstrap_coach(seg, D, F.lam, n_boot=n_boot)
    comps = dec.components(F, seg)

    coach_names = pd.concat([M[["home_coach_id", "home_coach"]].set_axis(["id", "n"], axis=1),
                             M[["away_coach_id", "away_coach"]].set_axis(["id", "n"], axis=1)]).dropna().drop_duplicates("id").set_index("id").n
    club_names = pd.concat([M[["home_id", "home"]].set_axis(["id", "n"], axis=1), M[["away_id", "away"]].set_axis(["id", "n"], axis=1)]).drop_duplicates("id").set_index("id").n
    n_matches = seg.groupby("coach_id").match_id.nunique()
    eligible = n_matches[n_matches >= MIN_MATCHES].index
    # DTs actuales (dirigen hoy un club de la temporada vigente) con 5–9 partidos: perfil preliminar
    temporada = M.season.max()
    ult = pd.concat([M[["date", "season", "home_id", "home_coach_id"]].set_axis(["date", "season", "club", "cid"], axis=1),
                     M[["date", "season", "away_id", "away_coach_id"]].set_axis(["date", "season", "club", "cid"], axis=1)])
    actuales = set(ult[ult.season == temporada].sort_values("date").groupby("club").tail(1).cid.dropna().astype(int))
    extras = [c for c in n_matches.index if c in actuales and 5 <= n_matches[c] < MIN_MATCHES]
    alpha_e = alpha.loc[alpha.index.isin(eligible)]

    # --- consistencia e identidad
    log("identidad y dispersión")
    idn = tt.identity_strength(seg, F)
    disp = ctxm.dispersion(seg, F)
    transfer = pd.DataFrame()
    tpath = CACHE / "transfer.parquet"
    if not fast and not solo_extra:
        log("prueba de transferencia (movers)")
        transfer = tt.run(seg, F.lam, log=log)
        transfer.to_parquet(tpath)
    elif tpath.exists():
        transfer = pd.read_parquet(tpath)

    # --- perfiles α para contexto (estilo del rival)
    coach_profiles = alpha

    # --- roles espaciales (NMF)
    log("roles NMF")
    A = T["actions"]
    from pipeline.framework import is_progressive
    A["prog"] = is_progressive(A.assign(subtype=A.subtype, outcome=A.outcome))
    roles_W, role_names = pl.fit_roles(A)
    n_tm = M.shape[0] * 2
    LG = league_grids(A, n_tm)

    # --- artefacto global
    kdefs = {k: {"etiqueta": v[3], "familia": v[4], "descripcion": v[5], "num": v[0], "den": v[1], "escala": v[2],
                 "media": F.stats[k]["mean"], "sd": F.stats[k]["sd"]} for k, v in KPIS.items()}
    coaches_list = []
    for c in list(eligible) + extras:
        sp_ = seg[seg.coach_id == c].groupby("club_id").agg(p=("match_id", "nunique"), d0=("date", "min"), d1=("date", "max")).reset_index().sort_values("d0")
        coaches_list.append({"id": int(c), "nombre": coach_names.get(c, str(c)), "slug": slug(coach_names.get(c, str(c))),
                             "partidos": int(n_matches[c]),
                             "clubes": [{"club": club_names.get(r.club_id), "partidos": int(r.p), "desde": r.d0, "hasta": r.d1} for r in sp_.itertuples()],
                             "identificabilidad": float(ident.loc[c, "indice"]), **({"preliminar": True} if c in extras else {})})
    coaches_list.sort(key=lambda d: (-len(d["clubes"]), -d["identificabilidad"]))
    tr_rows = []
    for r in transfer.itertuples() if len(transfer) else []:
        tr_rows.append({"coach_id": int(r.coach_id), "dt": coach_names.get(r.coach_id), "club": club_names.get(r.club_id),
                        "partidos": int(r.partidos), "n_clases": int(r.n_clases),
                        "rank_crudo": int(r.rank_crudo), "rank_ajustado": int(r.rank_ajustado),
                        "rank_nulo": float(r.rank_nulo_ajustado),
                        "prob_crudo": float(r.prob_crudo), "prob_ajustado": float(r.prob_ajustado),
                        "top5_crudo": [(coach_names.get(a, str(a)), b) for a, b in r.top5_crudo],
                        "top5_ajustado": [(coach_names.get(a, str(a)), b) for a, b in r.top5_ajustado]})
    glob = {
        "generado": time.strftime("%Y-%m-%d %H:%M"),
        "muestra": {"partidos": int(seg.match_id.nunique()), "segmentos": int(len(seg)), "dts": int(seg.coach_id.nunique()),
                    "jugadores_modelados": int(sum(1 for c in D.cols if c[0] == "player")),
                    "temporadas": sorted(M.season.unique().tolist())},
        "kpis": kdefs, "familias": FAMILIES + ["Arquetipos"],
        "varianza": {k: shares.loc[k].to_dict() for k in shares.index},
        "varianza_media": shares.loc[BASE_KPIS].mean().to_dict(),
        "varianza_segmento": {k: shares_seg.loc[k].to_dict() for k in shares_seg.index},
        "transferencia": tr_rows,
        "transferencia_resumen": tt.summary(transfer) if len(transfer) else {},
        "arquetipos": arq_names,
        "roles": role_names,
        "dts": coaches_list,
        "framework": CFG(),
        "lambda": F.lam,
    }
    if solo_extra:
        # no se toca nada de lo publicado: sólo se agregan los DTs preliminares a la lista existente
        old = json.load(open(ART / "global.json"))
        # verificación: el ajuste es el mismo (coeficientes idénticos para un DT ya publicado)
        ref = json.load(open(ART / f"dt_{old['dts'][0]['id']}.json"))
        dif = max(abs(h["alpha"] - float(alpha.loc[old["dts"][0]["id"], h["kpi"]])) for h in ref["huella"])
        log(f"  verificación mismo ajuste: max |Δα| = {dif:.2e}")
        assert dif <= 5.1e-5, "el ajuste no coincide con el publicado"  # los perfiles guardan α redondeado a 4 decimales
        have = {d["id"] for d in old["dts"]}
        old["dts"] += [jsonable(d) for d in coaches_list if d["id"] in extras and d["id"] not in have]
        glob = old
    json.dump(jsonable(glob), open(ART / "global.json", "w"), ensure_ascii=False)
    log("global.json listo")

    # --- artefactos por DT
    targets_ = extras if solo_extra else [c for c in list(eligible) + extras if coach_filter is None or coach_filter.lower() in str(coach_names.get(c, "")).lower()]
    pct = alpha_e.rank(pct=True) * 100
    for c in extras:  # percentil de los preliminares medido contra los DTs con perfil completo
        pct.loc[c] = [(alpha_e[k] < alpha.loc[c, k]).mean() * 100 for k in pct.columns]
    for c in targets_:
        t0 = time.time()
        name = coach_names.get(c, str(c))
        mask = (seg.coach_id == c)
        att = dec.attribution(F, seg, mask)
        mym = M[(M.home_coach_id == c) | (M.away_coach_id == c)].copy()
        mym["local"] = mym.home_coach_id == c
        mym["team_id"] = np.where(mym.local, mym.home_id, mym.away_id)
        mym["opp_id"] = np.where(mym.local, mym.away_id, mym.home_id)
        mym["gf"] = np.where(mym.local, mym.home_score, mym.away_score)
        mym["gc"] = np.where(mym.local, mym.away_score, mym.home_score)
        mym["rival"] = np.where(mym.local, mym.away, mym.home)
        mym["club"] = np.where(mym.local, mym.home, mym.away)
        mym = mym.sort_values("date")
        # huella
        raw = dec.kpis_from_counters(seg.loc[mask, COUNTERS].sum().to_frame().T).iloc[0]
        huella = []
        for k in KPIS:
            a = float(alpha.loc[c, k])
            huella.append({"kpi": k, "etiqueta": KPIS[k][3], "familia": KPIS[k][4], "alpha": a,
                           "se": float(se.loc[c, k]) if se is not None else None,
                           "pct": float(pct.loc[c, k]) if c in pct.index else None,
                           "crudo": float(raw[k]) if pd.notna(raw[k]) else None,
                           "liga": F.stats[k]["mean"], "ajustado_valor": F.stats[k]["mean"] + a * F.stats[k]["sd"],
                           "z_crudo": float(att.loc[k, "observado"]) if k in att.index else None})
        atrib = [{"kpi": k, **{kk: float(v) for kk, v in att.loc[k].items()}} for k in att.index]
        my_team = mym[["match_id", "team_id"]]
        # contexto
        curves = ctxm.reaction_curves(seg, F, c)
        drv = ctxm.drivers(seg, F, c, coach_profiles)
        evo = ctxm.evolution(seg, F, c)
        # jugadores
        jug = pl.coach_players(c, M, S, T["subs"], T["lineups"], T["players"], seg, F, roles_W, role_names, None)
        imp = pl.substitution_impact(S, T["subs"], c, F.stats, ctxm.KEY_KPIS)
        # balón parado, simulación, mapas
        bp = spc.coach_setpieces(T["setpieces"], my_team)
        simu = sim.coach_simulation(T["shots"], mym)
        maps = coach_maps(A, my_team, LG)
        shots = T["shots"].merge(my_team, on=["match_id", "team_id"])
        maps["tiros"] = [[round(float(x), 1), round(float(y), 1), round(float(g), 3), int(o == "Goal")] for x, y, g, o in zip(shots.x, shots.y, shots.xg, shots.outcome) if x == x][:1500]
        maps["red_pases"] = pass_network(A, my_team, S, names)
        # arquetipos
        arqs = []
        for k, v in arq_names.items():
            kk = f"arq_{k}"
            arqs.append({"id": k, "nombre": v["nombre"], "dt_pct": float(raw[kk]) if pd.notna(raw[kk]) else None,
                         "liga_pct": F.stats[kk]["mean"], "alpha": float(alpha.loc[c, kk]), **v})
        # ejemplos de posesiones por arquetipo (secuencias de acciones para dibujar)
        ejemplos = {}
        Pm = P.merge(my_team, on=["match_id", "team_id"])
        for k in arq_names:
            ex = Pm[(Pm.arq == k)].sort_values("obv", ascending=False).head(3)
            seqs = []
            for r in ex.itertuples():
                a = A[(A.match_id == r.match_id) & (A.poss == r.poss) & (A.team_id == r.team_id) & A.type.isin(["Pass", "Carry", "Shot"])]
                seqs.append([[a_.type, round(float(a_.x), 1), round(float(a_.y), 1),
                              round(float(a_.end_x), 1) if a_.end_x == a_.end_x else None,
                              round(float(a_.end_y), 1) if a_.end_y == a_.end_y else None] for a_ in a.itertuples()][:40])
            ejemplos[k] = seqs
        tr = [r for r in tr_rows if r["coach_id"] == int(c)]
        art = {
            "id": int(c), "nombre": name, "slug": slug(name),
            "etapas": next((d["clubes"] for d in coaches_list if d["id"] == int(c)), []),
            "partidos_total": int(n_matches[c]),
            "temporadas": sorted(mym.season.unique().tolist()),
            "identificabilidad": ident.loc[c].to_dict(),
            "huella": huella, "atribucion": atrib,
            "identidad": {**(idn.loc[c].to_dict() if c in idn.index else {}), "k": idn.attrs.get("k"),
                          "dispersion": float(disp.get(c, np.nan)), "dispersion_pct": float((disp < disp.get(c, np.nan)).mean() * 100) if c in disp.index else None},
            "transferencia": tr,
            "arquetipos": arqs, "arquetipos_ejemplos": ejemplos,
            "mapas": maps,
            "contexto": {"curvas": curves, "motores": drv, "evolucion": evo},
            "jugadores": jug, "impacto_cambios": imp,
            "balon_parado": bp, "simulacion": simu,
            "partidos": [{"match_id": int(r.match_id), "fecha": r.date, "club": r.club, "rival": r.rival, "local": bool(r.local),
                          "gf": int(r.gf), "gc": int(r.gc), "temporada": r.season} for r in mym.itertuples()],
        }
        art["narrativa"] = narrative.build(art, glob)
        art["narrativa_en"] = narrative.build(art, glob, "en")
        json.dump(jsonable(art), open(ART / f"dt_{int(c)}.json", "w"), ensure_ascii=False)
        log(f"  {name}: {time.time() - t0:.1f}s")
    from pipeline.models import stylemap
    stylemap.main()  # mapa de estilos (PCA + familias) para la portada
    if not solo_extra:
        from pipeline import whatif
        whatif.main()  # datos del simulador «¿Y si…?» (web/public/data/whatif.json)
    from pipeline import shapes
    shapes.main()  # formas por fase para el partido animado
    from pipeline import corners
    corners.main()  # córners 3D: envíos + posiciones 360 (web/public/data/corners_*.json)
    from pipeline import export_static
    export_static.main()  # datos para la web estática (web/src/boot.json + web/public/data)
    from pipeline import sim_extra
    sim_extra.main()  # goleador de cada tiro en sim_*.json (export_static los reescribe)
    from pipeline import dist
    dist.main()  # distribuciones entre DTs (campanas) para la web
    from pipeline import partidos_index
    partidos_index.main()  # resultados compactos para el asistente de IA
    from pipeline import jugadas_extra, juego_extra
    jugadas_extra.main()   # jugadas tipo, formaciones y bloque defensivo 360 (web/public/data/jugadas_*.json); 360 incremental
    juego_extra.main()     # tiros por club (web/public/data/juego_*.json)
    if not solo_extra:
        from pipeline.models import transplant
        transplant.main()  # estudio de eventos «trasplante de estilo» (Método 5.5)
    log("listo")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--coach")
    ap.add_argument("--fast", action="store_true")
    ap.add_argument("--boot", type=int, default=30)
    ap.add_argument("--solo-extra", action="store_true", help="sólo agrega los DTs actuales con 5–9 partidos, sin tocar lo demás")
    a = ap.parse_args()
    main(a.coach, a.fast, a.boot, a.solo_extra)
