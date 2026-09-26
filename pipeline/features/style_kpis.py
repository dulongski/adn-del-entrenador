"""Vector de estilo. Cada KPI es un cociente num/den de contadores por (stint, equipo), así
cualquier nivel de agregación (stint, segmento, partido, temporada, entrenador) se calcula
igual: sum(num)/sum(den). Esto garantiza coherencia interna entre todas las vistas."""
from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.framework import CFG, is_progressive

# nombre: (numerador, denominador, escala, etiqueta, familia, descripción)
KPIS = {
    # --- Construcción
    "posesion": ("pass_own", "pass_all", 100, "Posesión (% de pases)", "Construcción", "Pases propios / pases totales del stint."),
    "salida_corta": ("gk_short", "gk_pass", 100, "Salida corta del portero (%)", "Construcción", "Pases del portero < 35 yd / pases del portero."),
    "pase_largo": ("long_pass", "op_pass", 100, "Pases largos (%)", "Construcción", "Pases en juego abierto >= 35 yd / pases en juego abierto."),
    "construccion_exito": ("own3_prog", "own3_poss", 100, "Construcción exitosa (%)", "Construcción", "Posesiones iniciadas en tercio propio que llegan a campo rival."),
    "pases_por_posesion": ("pass_own", "n_poss", 1, "Pases por posesión", "Construcción", "Pases propios / posesiones propias."),
    "tempo": ("pass_own", "own_poss_sec", 60, "Tempo (pases por min de posesión)", "Construcción", "Pases por minuto con el balón."),
    # --- Progresión
    "verticalidad": ("poss_progress", "poss_path", 100, "Verticalidad (%)", "Progresión", "Avance neto hacia portería / distancia recorrida por el balón."),
    "progresivos": ("prog", "own_pc", 100, "Acciones progresivas por 100", "Progresión", "Pases+conducciones progresivas por cada 100 pases+conducciones."),
    "conduccion_prog": ("prog_carry", "prog", 100, "Progresión por conducción (%)", "Progresión", "Conducciones progresivas / acciones progresivas."),
    "progresion_banda": ("prog_wide", "prog", 100, "Progresión por banda (%)", "Progresión", "Acciones progresivas que terminan en carriles exteriores."),
    "cambios_orientacion": ("switches", "pass_own", 100, "Cambios de orientación por 100 pases", "Progresión", "Pases marcados como switch."),
    "entradas_ultimo_tercio": ("f3_entries", "n_poss", 100, "Entradas al último tercio por 100 posesiones", "Progresión", "Pases/conducciones completados que cruzan x=80."),
    # --- Generación de ocasiones
    "xg_90": ("npxg", "dur", 5400, "xG a favor por 90 (sin penales)", "Ocasiones", "Suma de xG StatsBomb sin penales, por 90 min."),
    "xg_por_tiro": ("npxg", "np_shots", 1, "xG por tiro", "Ocasiones", "Calidad media de tiro."),
    "tiros_90": ("np_shots", "dur", 5400, "Tiros por 90", "Ocasiones", "Tiros sin penales por 90."),
    "llegada_area": ("box_poss", "n_poss", 100, "Posesiones que llegan al área (%)", "Ocasiones", "Posesiones con acción/pase completado en el área rival."),
    "centros": ("crosses", "f3_entries", 100, "Centros por 100 entradas al último tercio", "Ocasiones", "Dependencia del centro."),
    "obv_90": ("obv", "dur", 5400, "OBV por 90", "Ocasiones", "On-Ball Value neto generado por acciones propias."),
    # --- Presión y defensa
    "ppda": ("opp_pass_ppda", "def_ppda", 1, "PPDA", "Presión", "Pases rivales en su 60% / acciones defensivas propias ahí. Menor = más presión."),
    "altura_presion": ("press_x", "press_n", 1, "Altura media de presión (x)", "Presión", "x medio de eventos Pressure."),
    "presion_alta": ("press_high", "press_n", 100, "Presiones en tercio rival (%)", "Presión", "Presiones con x >= 80."),
    "intensidad_presion": ("press_n", "opp_poss_sec", 60, "Presiones por min de posesión rival", "Presión", "Volumen de presión normalizado por tiempo sin balón."),
    "contrapresion": ("loss_cp", "loss_open", 100, "Contrapresión tras pérdida (%)", "Presión", "Pérdidas en juego seguidas de presión propia en <= 5 s."),
    "recuperaciones_altas_90": ("rec_high", "dur", 5400, "Recuperaciones en campo rival por 90", "Presión", "Recuperaciones/intercepciones/entradas ganadas con x >= 60."),
    "altura_defensiva": ("def_x", "def_n", 1, "Altura de acciones defensivas (x)", "Organización defensiva", "x medio de entradas, intercepciones, recuperaciones, bloqueos, despejes y faltas."),
    "linea_360": ("line_sum", "line_n", 1, "Altura de línea defensiva 360 (yd)", "Organización defensiva", "Media de los 4 jugadores de campo más retrasados (freeze-frames 360)."),
    "compacidad_360": ("comp_sum", "comp_n", 1, "Longitud del bloque 360 (yd)", "Organización defensiva", "Distancia entre el jugador más adelantado y el más retrasado (360). Menor = más compacto."),
    "posesion_rival_dur": ("opp_poss_sec", "opp_n_poss", 1, "Duración media de posesión rival (s)", "Organización defensiva", "Cuánto tarda en recuperar."),
    "xg_contra_90": ("npxg_against", "dur", 5400, "xG en contra por 90", "Organización defensiva", "xG sin penales concedido."),
    # --- Transiciones
    "contraataque": ("fast", "rec_poss", 100, "Transiciones rápidas (%)", "Transiciones", "Posesiones tras recuperación que llegan al último tercio en <= 10 s."),
    "xg_transicion": ("xg_fast", "npxg", 100, "xG de transiciones rápidas (%)", "Transiciones", "Parte del xG que nace de transiciones rápidas."),
    "transicion_def": ("fb_against", "loss_open", 100, "Transiciones rápidas concedidas (%)", "Transiciones", "Pérdidas en juego tras las que el rival llega a nuestro último tercio en <= 10 s."),
    "field_tilt": ("f3_pass_own", "f3_pass_all", 100, "Field tilt (%)", "Dominio", "Pases propios en último tercio / pases totales en último tercio."),
    "xg_balon_parado_90": ("xg_sp", "dur", 5400, "xG de balón parado por 90", "Balón parado", "xG de posesiones iniciadas en córner, tiro libre o saque de banda."),
}

COUNTERS = sorted({v[0] for v in KPIS.values()} | {v[1] for v in KPIS.values()})
BASE_KPIS = list(KPIS)


def register_kpi(name, num, den, scale, label, family, desc):
    """Registra un KPI derivado (p.ej. frecuencia de un arquetipo) con la misma semántica num/den."""
    KPIS[name] = (num, den, scale, label, family, desc)
    for c in (num, den):
        if c not in COUNTERS:
            COUNTERS.append(c)

FAMILIES = ["Construcción", "Progresión", "Ocasiones", "Presión", "Organización defensiva", "Transiciones", "Dominio", "Balón parado"]


def kpis_from_counters(df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    for k, (n, d, sc, *_rest) in KPIS.items():
        den = df[d].astype(float)
        out[k] = np.where(den > 0, df[n] / den.replace(0, np.nan) * sc, np.nan)
    return out


def aggregate(df: pd.DataFrame, by) -> pd.DataFrame:
    """Agrega contadores y recalcula KPIs (ratio de sumas)."""
    g = df.groupby(by)[COUNTERS].sum(min_count=1)
    return kpis_from_counters(g)


def match_counters(ev: pd.DataFrame, P: pd.DataFrame, st: pd.DataFrame, s360: pd.DataFrame,
                   home_id: int, away_id: int) -> pd.DataFrame:
    """Contadores por (stint, equipo) para un partido."""
    C = CFG()
    ev = ev.copy()
    ev["stint"] = np.searchsorted(st.t0.values, ev.t.values, side="right") - 1
    ev["stint"] = ev.stint.clip(lower=0)
    P = P.copy()
    P["stint"] = (np.searchsorted(st.t0.values, P.t0.values, side="right") - 1).clip(min=0)
    ev["prog"] = is_progressive(ev)
    f3 = C["pitch"]["final_third_min_x"]
    wl = C["pitch"]["wide_lane"]
    is_pass = ev.type == "Pass"
    pass_ok = is_pass & ev.outcome.isna()
    carry = ev.type == "Carry"
    shot = (ev.type == "Shot") & (ev.subtype != "Penalty")
    gk = is_pass & ((ev.position == "Goalkeeper") | (ev.subtype == "Goal Kick"))
    op = is_pass & ev.subtype.isna()
    defa = ((ev.type == "Duel") & (ev.subtype == "Tackle")) | (ev.type == "Interception") | (ev.type == "Foul Committed")
    defall = ((ev.type == "Duel") & (ev.subtype == "Tackle")) | ev.type.isin(["Interception", "Ball Recovery", "Block", "Clearance", "Foul Committed"])
    rec = ((ev.type == "Ball Recovery") & (ev.outcome == "Success")) | \
          ((ev.type == "Interception") & ev.outcome.isin(["Won", "Success", "Success In Play", "Success Out"])) | \
          ((ev.type == "Duel") & (ev.subtype == "Tackle") & ev.outcome.isin(["Won", "Success", "Success In Play", "Success Out"]))
    press = ev.type == "Pressure"
    entry = (pass_ok | carry) & (ev.x < f3) & (ev.end_x >= f3)
    sp_poss = set(P.loc[P.set_piece, "poss"]) if len(P) else set()
    fast_poss = set(P.loc[P.fast_break, "poss"]) if len(P) else set()

    rows = []
    teams = (home_id, away_id)
    for s in st.itertuples():
        es = ev[ev.stint == s.stint]
        Ps = P[P.stint == s.stint] if len(P) else P
        for tid in teams:
            oid = away_id if tid == home_id else home_id
            me, op_ = es[es.team_id == tid], es[es.team_id == oid]
            mP = Ps[Ps.team_id == tid] if len(Ps) else Ps
            oP = Ps[Ps.team_id == oid] if len(Ps) else Ps
            m_pass, m_ok = is_pass[me.index], pass_ok[me.index]
            m_prog = me.prog
            m_shot = shot[me.index]
            o_shot = shot[op_.index]
            m_press = me[press[me.index]]
            m_def = me[defall[me.index]]
            s360_me = s360[s360.atk_team_id == oid] if len(s360) else s360
            s360_me = s360_me[s360_me.id.isin(es.id)] if len(s360_me) else s360_me
            # contrapresión: presión propia <= 5 s tras pérdida en juego
            losses = mP[mP.lost_open] if len(mP) else mP
            pt = np.sort(m_press.t.values)
            cpw = C["presion"]["counterpress_window_s"]
            loss_cp = 0
            for t1 in (losses.t1.values if len(losses) else []):
                i = np.searchsorted(pt, t1, side="right")
                if i < len(pt) and pt[i] - t1 <= cpw:
                    loss_cp += 1
            poss_prog = (mP.max_x - mP.start_x).clip(lower=0) if len(mP) else pd.Series(dtype=float)
            own3 = mP[(mP.start_x < C["pitch"]["own_third_max_x"]) & ~mP.set_piece] if len(mP) else mP
            prog_ev = me[m_prog]
            rows.append({
                "stint": s.stint, "team_id": tid, "opp_id": oid, "dur": s.dur,
                "pass_own": int(m_pass.sum()), "pass_all": int(is_pass[es.index].sum()),
                "gk_pass": int(gk[me.index].sum()), "gk_short": int((gk[me.index] & (me.length < C["pase_largo"]["min_length"])).sum()),
                "op_pass": int(op[me.index].sum()), "long_pass": int((op[me.index] & (me.length >= C["pase_largo"]["min_length"])).sum()),
                "own3_poss": len(own3), "own3_prog": int((own3.max_x >= C["pitch"]["opp_half_min_x"]).sum()) if len(own3) else 0,
                "n_poss": len(mP), "own_poss_sec": float(mP.dur.sum()) if len(mP) else 0.0,
                "opp_n_poss": len(oP), "opp_poss_sec": float(oP.dur.sum()) if len(oP) else 0.0,
                "poss_progress": float(poss_prog.sum()), "poss_path": float(mP.path.sum()) if len(mP) else 0.0,
                "prog": int(m_prog.sum()), "prog_carry": int((prog_ev.type == "Carry").sum()),
                "prog_wide": int(((prog_ev.end_y < wl["y_low"]) | (prog_ev.end_y > wl["y_high"])).sum()),
                "own_pc": int((m_pass | carry[me.index]).sum()),
                "switches": int(me.switch.sum()), "f3_entries": int(entry[me.index].sum()),
                "npxg": float(me.loc[m_shot, "xg"].sum()), "np_shots": int(m_shot.sum()),
                "npxg_against": float(op_.loc[o_shot, "xg"].sum()),
                "box_poss": int(mP.reach_box.sum()) if len(mP) else 0,
                "crosses": int((me.cross & op[me.index]).sum()),
                "obv": float(me.obv.fillna(0).sum()),
                "opp_pass_ppda": int((is_pass[op_.index] & (op_.x < 120 - C["ppda"]["zone_min_x"])).sum()),
                "def_ppda": int((defa[me.index] & (me.x >= C["ppda"]["zone_min_x"])).sum()),
                "press_n": len(m_press), "press_x": float(m_press.x.sum()),
                "press_high": int((m_press.x >= C["presion"]["high_min_x"]).sum()),
                "loss_open": len(losses), "loss_cp": loss_cp,
                "rec_high": int((rec[me.index] & (me.x >= C["recuperacion_alta"]["min_x"])).sum()),
                "def_n": len(m_def), "def_x": float(m_def.x.sum()),
                "line_sum": float(s360_me.line_h.sum()) if len(s360_me) else 0.0, "line_n": len(s360_me),
                "comp_sum": float(s360_me.compact.dropna().sum()) if len(s360_me) else 0.0,
                "comp_n": int(s360_me.compact.notna().sum()) if len(s360_me) else 0,
                "rec_poss": int(mP.recovery_start.sum()) if len(mP) else 0,
                "fast": int(mP.fast_break.sum()) if len(mP) else 0,
                "xg_fast": float(me.loc[m_shot & me.poss.isin(fast_poss), "xg"].sum()),
                "fb_against": int(losses.next_fast_break_against.sum()) if len(losses) else 0,
                "f3_pass_own": int((m_pass & (me.x >= f3)).sum()),
                "f3_pass_all": int((is_pass[es.index] & ((es.team_id == tid) & (es.x >= f3) | (es.team_id == oid) & (es.x >= f3))).sum()),
                "xg_sp": float(me.loc[m_shot & me.poss.isin(sp_poss), "xg"].sum()),
            })
    return pd.DataFrame(rows)
