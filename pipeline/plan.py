"""Accionable: qué hacer con el ADN de un DT (criterio «Accionabilidad»).

1) Cómo jugarle: reglas explícitas que traducen su sello (α con su error estándar), sus
   reacciones al marcador y su balón parado en recomendaciones para el rival. Cada regla cita
   el indicador, su valor con jugadores promedio, el de la liga y su percentil entre DTs, y sólo
   se dispara si el rasgo es claro (|α| >= 0.25 y |α|/EE >= 1.64). Se eligen las 6 más fuertes,
   como máximo 2 por fase.
2) Qué plantilla le conviene: los jugadores que, YA descontado su DT, empujan al equipo en la
   misma dirección de sus 3 rasgos más marcados (efecto β del modelo, con >= 900 minutos y
   activos en la última temporada). Lista de la liga y, de su plantilla actual, quién suma y
   quién va en contra.
3) Tablero de seguimiento: sus 6 rasgos más marcados (y confiables) con la banda esperada para
   un promedio de 10 partidos y el valor de los últimos 10; más puntos y xG frente a su carrera.

Salida: web/public/data/plan.json
Uso: .venv/bin/python -m pipeline.plan  (después de pipeline.tiempo, pipeline.bp_extra y pipeline.validation)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline import sb_client as sb
from pipeline.features.style_kpis import BASE_KPIS
from pipeline.fitcache import load

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
PUB = ROOT / "web" / "public" / "data"
OUT = PUB / "plan.json"
CLARO, T_MIN = 0.25, 1.64
YD = 0.9144


def r(v, d=2):
    return None if v is None or not np.isfinite(v) else round(float(v), d)


def unit(label: str) -> str:
    m = re.search(r"\(([^)]*)\)\s*$", label)
    u = m.group(1) if m else ""
    return "%" if u.startswith("%") else u


def fmt(k: str, v: float | None, glob: dict) -> str:
    if v is None:
        return "—"
    u = unit(glob["kpis"][k]["etiqueta"])
    if u == "%":
        return f"{v:.0f}%"
    if u in ("yd", "x"):
        return f"{v * YD:.1f} m"
    if u == "s":
        return f"{v:.1f} s"
    if k in ("xg_90", "xg_contra_90", "xg_por_tiro", "obv_90", "xg_balon_parado_90"):
        return f"{v:.2f}"
    return f"{v:.1f}"


# ------------------------------------------------------------------ reglas «cómo jugarle»
# fase: «con» = cuando él tiene el balón (cómo defenderlo) · «sin» = cuando tú tienes el balón
# (cómo atacarlo) · «trans» = transiciones. Cada regla: (id, fase, [(kpi, signo)], es(t,d), en(t,d))
# El primer kpi decide la fuerza; los demás tienen que acompañar (mismo signo, no hace falta que sean claros).
RULES = [
    ("salida_corta_debil", "con", [("salida_corta", +1), ("construccion_exito", -1)],
     ("Presiona su salida desde el portero", "Sale corto desde atrás, pero esas jugadas pocas veces llegan a tu campo: presión alta y emparejada sobre centrales y pivote."),
     ("Press his build-up from the keeper", "He builds short from the back, but few of those moves reach your half: press high and man-to-man on centre-backs and pivot.")),
    ("salida_corta_buena", "con", [("salida_corta", +1), ("construccion_exito", +1)],
     ("No regales la presión alta", "Su salida corta funciona: si presionas uno a uno te supera. Bloque medio que cierre los pases por dentro y salta sólo con el pase atrás."),
     ("Don't gift him a high press", "His short build-up works: a man-to-man press gets beaten. Use a mid-block that shuts inside passes and jump only on back passes.")),
    ("sale_largo", "con", [("salida_corta", -1)],
     ("Gana el primer balón y la segunda jugada", "Su portero saca largo más que casi todos: pon a tu mejor cabeceador en la zona de caída y adelanta la línea para quedarte el rebote."),
     ("Win the first ball and the second ball", "His keeper goes long more than almost anyone: put your best header where it lands and push your line up to win the knock-down.")),
    ("bandas", "con", [("progresion_banda", +1)],
     ("Cierra las bandas", "Avanza por fuera más que la mayoría: dobla marca en las bandas (lateral + extremo) y obliga a que el balón vuelva por dentro."),
     ("Close the flanks", "He progresses down the wings more than most: double up out wide (full-back + winger) and force the ball back inside.")),
    ("centros", "con", [("centros", +1)],
     ("Defiende el área por arriba", "Centra más que la mayoría: centrales fuertes en el juego aéreo, presión al que centra y alguien siempre en el segundo palo."),
     ("Defend the box in the air", "He crosses more than most: strong aerial centre-backs, pressure on the crosser and someone always on the far post.")),
    ("conduce", "con", [("conduccion_prog", +1)],
     ("Corta a sus conductores", "Avanza conduciendo más que la mayoría: no le des metros al que lleva el balón, temporiza y cubre la espalda del que sale."),
     ("Stop his ball-carriers", "He carries the ball forward more than most: don't give the carrier space, delay him and cover behind whoever steps out.")),
    ("cambios_frente", "con", [("cambios_orientacion", +1)],
     ("Bascula rápido al lado débil", "Cambia de frente más que la mayoría para atacar el lado débil: tu extremo del lado contrario tiene que cerrar y el bloque moverse junto."),
     ("Shift quickly to the weak side", "He switches play more than most to hit the weak side: your far-side winger must tuck in and the block move as one.")),
    ("posesion", "con", [("posesion", +1)],
     ("Déjale el balón y espera el error", "Quiere tener la pelota: un bloque medio compacto y salidas rápidas tras robar rinden más que discutirle la posesión."),
     ("Let him have the ball and wait", "He wants the ball: a compact mid-block and fast breaks after winning it pay more than fighting for possession.")),
    ("tiro_lejano", "con", [("xg_por_tiro", -1), ("tiros_90", +1)],
     ("Concede tiros lejanos, protege el área", "Remata mucho pero desde lejos (poco xG por tiro): no rompas el bloque por salir a cada tiro; lo peligroso es lo que entra al área."),
     ("Concede long shots, protect the box", "He shoots a lot but from distance (low xG per shot): don't break your block to close every shot; the danger is what gets into the box.")),
    ("presiona_alto", "sin", [("ppda", -1), ("recuperaciones_altas_90", +1)],
     ("Supera su presión con juego directo", "Presiona y roba arriba: sal en largo o con un pivote extra, evita pases horizontales en tu tercio y busca la espalda de su presión."),
     ("Beat his press with direct play", "He presses and wins it high: play long or add an extra pivot, avoid square passes in your third and target the space behind the press.")),
    ("linea_alta", "sin", [("linea_360", +1)],
     ("Ataca la espalda de su defensa", "Defiende con la línea adelantada: balones a la espalda de los centrales y carreras en diagonal de tus delanteros."),
     ("Attack the space behind his line", "He defends with a high line: balls in behind the centre-backs and diagonal runs from your forwards.")),
    ("linea_baja", "sin", [("linea_360", -1)],
     ("Ten paciencia frente a su bloque bajo", "Se repliega cerca de su área: tendrás el balón; mueve rápido de lado a lado, centra al segundo palo y prueba de media distancia."),
     ("Be patient against his low block", "He sits deep near his box: you'll have the ball; move it side to side quickly, cross to the far post and shoot from mid-range.")),
    ("bloque_largo", "sin", [("compacidad_360", +1)],
     ("Juega entre sus líneas", "Su bloque es largo (mucha distancia entre la primera y la última línea): tu mediapunta tiene espacio para recibir de espaldas y girar."),
     ("Play between his lines", "His block is stretched (big gap between first and last line): your number 10 has room to receive and turn.")),
    ("bloque_corto", "sin", [("compacidad_360", -1)],
     ("Juega por fuera de su bloque", "Su bloque es muy compacto: por dentro no hay sitio; ataca con amplitud y cambios de orientación."),
     ("Go around his block", "His block is very compact: there's no room inside; attack with width and switches of play.")),
    ("contrapresion", "trans", [("contrapresion", +1)],
     ("Sal rápido tras robar", "Contrapresiona en cuanto pierde: tu primer pase tras recuperar tiene que ser vertical o largo, no al lado."),
     ("Get out fast after winning it", "He counter-presses as soon as he loses it: your first pass after a win-back must go forward or long, not sideways.")),
    ("concede_contras", "trans", [("transicion_def", +1)],
     ("Contragolpéalo", "Le llegan rápido tras perder el balón: ten dos atacantes listos para correr en cuanto recuperes."),
     ("Hit him on the counter", "Teams get at him quickly after he loses the ball: keep two attackers ready to run as soon as you win it.")),
    ("contragolpea", "trans", [("contraataque", +1)],
     ("Cuida la pérdida", "Es peligroso al contragolpe: no pierdas el balón en salida y deja siempre 2+1 atrás cuando ataques."),
     ("Protect against his counters", "He's dangerous on the break: don't lose it playing out and always keep 2+1 back when you attack.")),
    ("recupera_rapido", "sin", [("posesion_rival_dur", -1)],
     ("Mueve el balón rápido", "Te quita el balón rápido: menos toques, apoyos cerca y no conducir en zonas con mucha gente."),
     ("Move the ball quickly", "He wins the ball back fast: fewer touches, close support and no dribbling in crowded areas.")),
]
FASES = {"con": ("Cuando él tiene el balón", "When he has the ball"), "sin": ("Cuando tú tienes el balón", "When you have the ball"),
         "trans": ("En las transiciones", "In transitions"), "bp": ("A balón parado", "At set pieces"), "partido": ("Durante el partido", "During the match")}

# frases para las reacciones al marcador: qué implica para el rival que el DT haga más/menos X
CTX_TXT = {
    "altura_presion": (("presiona más arriba", "presses higher"), ("presiona más abajo", "presses lower")),
    "linea_360": (("adelanta la línea", "pushes his line up"), ("hunde la línea", "drops his line")),
    "posesion": (("busca más el balón", "seeks more of the ball"), ("cede el balón", "gives up the ball")),
    "contraataque": (("contragolpea más", "counters more"), ("contragolpea menos", "counters less")),
    "ppda": (("presiona menos", "presses less"), ("presiona más", "presses more")),  # PPDA alto = menos presión
    "verticalidad": (("juega más directo", "plays more directly"), ("juega más elaborado", "plays more patiently")),
    "field_tilt": (("se mete más en tu campo", "camps more in your half"), ("se mete menos en tu campo", "camps less in your half")),
    "pase_largo": (("juega más largo", "plays longer"), ("juega más corto", "plays shorter")),
}
ZONA_EN = {"Primer palo": "near post", "Área chica": "six-yard box", "Punto penal": "penalty spot", "Segundo palo": "far post", "Corto": "short"}


def kpi_ev(k, h, glob):
    return {"kpi": k, "etiqueta": glob["kpis"][k]["etiqueta"], "sello": fmt(k, h["ajustado_valor"], glob), "liga": fmt(k, h["liga"], glob),
            "pct": r(h["pct"], 0), "alpha": r(h["alpha"]), "se": r(h["se"])}


def acciones(art, glob, rel):
    H = {h["kpi"]: h for h in art["huella"]}
    out = []
    for rid, fase, conds, es, en in RULES:
        k0, s0 = conds[0]
        h0 = H.get(k0)
        if not h0 or h0["se"] is None:
            continue
        a, se = h0["alpha"] * s0, h0["se"]
        if a < CLARO or a / se < T_MIN:
            continue
        if any(H[k]["alpha"] * s < 0 for k, s in conds[1:] if k in H):
            continue
        f = min(a / se, 6) * (0.6 + 0.4 * rel.get(k0, 0.6))  # rasgos poco confiables pesan menos
        out.append({"id": rid, "fase": fase, "titulo": es[0], "texto": es[1], "titulo_en": en[0], "texto_en": en[1],
                    "evidencia": [kpi_ev(k, H[k], glob) for k, _ in conds if k in H], "fuerza": r(f)})
    return out


def contexto(art, glob):
    best = None
    for dim in ("marcador", "minuto"):
        for k, rows in art["contexto"]["curvas"].get(dim, {}).items():
            if k not in CTX_TXT:
                continue
            for row in rows:
                if row["dt"] is None or row["liga"] is None or row["n_dt"] < 80:
                    continue
                d = row["dt"] - row["liga"]
                if best is None or abs(d) > abs(best[3]):
                    best = (dim, k, row["nivel"], d, row["n_dt"])
    if not best or abs(best[3]) < 0.6:
        return []
    dim, k, nivel, d, n = best
    (up_es, up_en), (dn_es, dn_en) = CTX_TXT[k]
    es_v, en_v = (up_es, up_en) if d > 0 else (dn_es, dn_en)
    cuando = {"Perdiendo": ("Cuando va perdiendo", "When he is losing"), "Empatando": ("Con el empate", "When level"), "Ganando": ("Cuando va ganando", "When he is winning")}
    w = cuando.get(nivel, (f"En el tramo {nivel}", f"In the {nivel} spell"))
    return [{"id": "contexto", "fase": "partido",
             "titulo": f"{w[0]}, {es_v}", "titulo_en": f"{w[1]}, {en_v}",
             "texto": f"Frente a lo que hace la liga en la misma situación, {es_v} ({'+' if d > 0 else '−'}{abs(d):.1f} desviaciones típicas, {n} tramos). Prepara ese escenario: es cuando más cambia.",
             "texto_en": f"Compared with what the league does in the same situation, he {en_v} ({'+' if d > 0 else '−'}{abs(d):.1f} standard deviations, {n} spells). Prepare for that scenario: it's when he changes most.",
             "evidencia": [{"kpi": k, "etiqueta": glob["kpis"][k]["etiqueta"], "nivel": nivel, "dif": r(d)}], "fuerza": r(min(abs(d) * 2.5, 6))}]


def balon_parado(c, art, bp2):
    out = []
    d = bp2["dts"].get(str(c), {})
    vul = [z for z in d.get("vulnerable", []) if z.get("xg") is not None and z["n"] >= 15 and z["xg_liga"]]
    if vul:
        z = max(vul, key=lambda z: z["xg"] - z["xg_liga"])
        if z["xg"] > z["xg_liga"] * 1.25:
            out.append({"id": "bp_vulnerable", "fase": "bp", "titulo": f"Cárgale los córners al {z['zona'].lower()}",
                        "titulo_en": f"Aim your corners at the {ZONA_EN.get(z['zona'], z['zona'])}",
                        "texto": f"Es donde más sufre: concede {z['xg']:.3f} xG por córner que cae ahí (liga {z['xg_liga']:.3f})" + (f", y el rival gana ahí el primer contacto el {z['rival_gana_pct']:.0f}% de las veces (liga {z['rival_gana_liga']:.0f}%)." if (z['rival_gana_pct'] or 0) > (z['rival_gana_liga'] or 0) + 3 else "."),
                        "texto_en": f"It's where he suffers most: {z['xg']:.3f} xG conceded per corner landing there (league {z['xg_liga']:.3f})" + (f", and the opponent wins the first contact there {z['rival_gana_pct']:.0f}% of the time (league {z['rival_gana_liga']:.0f}%)." if (z['rival_gana_pct'] or 0) > (z['rival_gana_liga'] or 0) + 3 else "."),
                        "evidencia": [{"zona": z["zona"], "xg": z["xg"], "xg_liga": z["xg_liga"], "n": z["n"]}], "fuerza": r(min((z["xg"] / z["xg_liga"] - 1) * 4, 5))})
    m = d.get("marcaje", {})
    if m.get("tipo") in ("zonal", "hombre"):
        if m["tipo"] == "zonal":
            t = ("Ataca los huecos de su marca zonal", "Defiende los córners en zona: carreras desde atrás hacia los espacios entre sus defensores y bloqueos sobre el portero.",
                 "Attack the gaps in his zonal marking", "He defends corners zonally: late runs into the gaps between defenders and screens on the keeper.")
        else:
            t = ("Libera a tu cabeceador con bloqueos", "Defiende los córners al hombre: cortinas y bloqueos legales para soltar a tu mejor rematador de su marcador.",
                 "Free your header with screens", "He man-marks on corners: legal screens and blocks to free your best header from his marker.")
        out.append({"id": "bp_marcaje", "fase": "bp", "titulo": t[0], "texto": t[1], "titulo_en": t[2], "texto_en": t[3],
                    "evidencia": [{"pegados_pct": m.get("pegados_pct"), "pct": m.get("pct"), "n": m.get("n")}], "fuerza": r(1.2 + abs((m.get("pct") or 50) - 50) / 20)})
    of = art["balon_parado"]["ofensivo"].get("corner_zonas", {})
    lg = art["balon_parado"]["liga"].get("corner_zonas", {})
    if of and lg:
        z = max(of, key=lambda k: of[k] - lg.get(k, 0))
        if of[z] - lg.get(z, 0) >= 8:
            out.append({"id": "bp_sus_corners", "fase": "bp", "titulo": f"En sus córners, vigila el {z.lower()}", "titulo_en": f"On his corners, guard the {ZONA_EN.get(z, z)}",
                        "texto": f"Manda el {of[z]:.0f}% de sus córners ahí (liga {lg[z]:.0f}%): tu mejor defensor aéreo tiene que estar en esa zona.",
                        "texto_en": f"He sends {of[z]:.0f}% of his corners there (league {lg[z]:.0f}%): your best aerial defender must be in that zone.",
                        "evidencia": [{"zona": z, "pct": r(of[z], 1), "liga": r(lg[z], 1)}], "fuerza": r(min((of[z] - lg[z]) / 6, 5))})
    b = d.get("banda", {})
    if b.get("favor", {}).get("al_area_pct") and (b.get("pct", {}).get("favor_area") or 0) >= 80:
        f = b["favor"]
        out.append({"id": "bp_banda", "fase": "bp", "titulo": "Ojo con sus saques de banda al área", "titulo_en": "Watch his long throws into the box",
                    "texto": f"El {f['al_area_pct']:.0f}% de sus saques de banda en el último tercio cae en el área (liga {bp2['liga']['banda']['al_area_pct']:.0f}%): trátalos como un córner.",
                    "texto_en": f"{f['al_area_pct']:.0f}% of his final-third throw-ins land in the box (league {bp2['liga']['banda']['al_area_pct']:.0f}%): defend them like a corner.",
                    "evidencia": [{"al_area_pct": f["al_area_pct"], "pct": b["pct"]["favor_area"]}], "fuerza": r(2 + (b["pct"]["favor_area"] - 80) / 10)})
    return out


def cambios(art, of_liga: float = 30.0):
    J = art["jugadores"]
    mc, ml = J.get("minuto_cambios", {}), J.get("minuto_cambios_liga", {})
    if "1" not in mc or "1" not in ml:
        return []
    d = mc["1"] - ml["1"]
    est = J.get("cambios_por_estado", {}).get("Perdiendo", {})
    tot = sum(est.values()) or 1
    of = est.get("Más ofensivo", 0) / tot * 100
    if abs(d) < 4 and of - of_liga < 10:
        return []
    if abs(d) >= 4:
        es = (f"Mueve el banco {'pronto' if d < 0 else 'tarde'}", f"Su primer cambio llega al {mc['1']:.0f}' (liga {ml['1']:.0f}'): {'ten tu respuesta lista desde el descanso' if d < 0 else 'tu banco puede adelantarse a sus ajustes'}.")
        en = (f"He goes to the bench {'early' if d < 0 else 'late'}", f"His first sub comes at {mc['1']:.0f}' (league {ml['1']:.0f}'): {'have your answer ready from half-time' if d < 0 else 'your bench can get ahead of his changes'}.")
    else:
        es = ("Si va perdiendo, mete delanteros", f"Cuando pierde, el {of:.0f}% de sus cambios son más ofensivos (DT típico {of_liga:.0f}%): espera más gente arriba y deja espacio a la espalda para contragolpear.")
        en = ("When losing, he adds attackers", f"When behind, {of:.0f}% of his subs are more attacking (typical coach {of_liga:.0f}%): expect more bodies up front and leave room to counter.")
    return [{"id": "banca", "fase": "partido", "titulo": es[0], "texto": es[1], "titulo_en": en[0], "texto_en": en[1],
             "evidencia": [{"primer_cambio": mc["1"], "liga": ml["1"], "ofensivos_perdiendo": r(of, 0)}], "fuerza": r(min(abs(d) / 2, 4) + (of - of_liga) / 20)}]


def elegir(pool, n=6, por_fase=2):
    pool = sorted(pool, key=lambda x: -(x["fuerza"] or 0))
    out, cnt = [], {}
    for p in pool:
        if cnt.get(p["fase"], 0) >= por_fase:
            continue
        out.append(p)
        cnt[p["fase"]] = cnt.get(p["fase"], 0) + 1
        if len(out) >= n:
            break
    return out


# ------------------------------------------------------------------ plantilla a la medida
POS = {"Goalkeeper": "POR", "Center Back": "DFC", "Left Center Back": "DFC", "Right Center Back": "DFC",
       "Left Back": "LAT", "Right Back": "LAT", "Left Wing Back": "LAT", "Right Wing Back": "LAT",
       "Center Defensive Midfield": "MC", "Left Defensive Midfield": "MC", "Right Defensive Midfield": "MC",
       "Center Midfield": "MC", "Left Center Midfield": "MC", "Right Center Midfield": "MC",
       "Center Attacking Midfield": "MP", "Left Attacking Midfield": "MP", "Right Attacking Midfield": "MP",
       "Left Midfield": "EXT", "Right Midfield": "EXT", "Left Wing": "EXT", "Right Wing": "EXT",
       "Center Forward": "DC", "Left Center Forward": "DC", "Right Center Forward": "DC"}
POS_TXT = {"POR": ("Portero", "Goalkeeper"), "DFC": ("Central", "Centre-back"), "LAT": ("Lateral", "Full-back"), "MC": ("Medio", "Midfielder"),
           "MP": ("Mediapunta", "Attacking mid"), "EXT": ("Extremo", "Winger"), "DC": ("Delantero", "Forward")}


def player_table(seg, F, M):
    P = sb.DATA / "processed"
    names = pd.read_parquet(P / "players.parquet").set_index("player_id").player
    L = pd.read_parquet(P / "lineups.parquet")
    pos = L.groupby("player_id").position.agg(lambda s: s.value_counts().index[0]).map(POS)
    last = L.merge(M[["match_id", "date", "season", "home_id", "away_id", "home", "away"]], on="match_id").sort_values("date").groupby("player_id").tail(1)
    last["club"] = np.where(last.team_id == last.home_id, last.home, last.away)
    ex = seg[["dur", "exposure"]].copy()
    ex["exposure"] = ex.exposure.map(lambda d: list((d or {}).items()))
    ex = ex.explode("exposure").dropna(subset=["exposure"])
    ex["p"] = ex.exposure.map(lambda t: t[0]).astype(int)
    ex["m"] = ex.exposure.map(lambda t: t[1]) * ex.dur / 60
    mins = ex.groupby("p").m.sum()
    idx = [c for c in F.coef.index if c[0] == "player" and c[1] != -1]
    B = F.coef.loc[idx, list(BASE_KPIS)].copy()
    B.index = [int(c[1]) for c in idx]
    T = pd.DataFrame({"nombre": names.reindex(B.index).values, "pos": pos.reindex(B.index).values,
                      "club": last.set_index("player_id").club.reindex(B.index).values,
                      "temporada": last.set_index("player_id").season.reindex(B.index).values,
                      "min": mins.reindex(B.index).fillna(0).values}, index=B.index)
    return T, B


def fichajes(c, art, glob, T, B, rel, season, club):
    H = sorted([h for h in art["huella"] if h["kpi"] in B.columns and h["se"] and abs(h["alpha"]) >= CLARO and abs(h["alpha"]) / h["se"] >= 2],
               key=lambda h: -abs(h["alpha"]) * (0.5 + 0.5 * rel.get(h["kpi"], 0.6)))
    fams, rasgos = set(), []
    for h in H:
        if h["familia"] in fams:
            continue
        rasgos.append(h)
        fams.add(h["familia"])
        if len(rasgos) == 3:
            break
    if not rasgos:
        return None
    sd = B.std()
    score = sum(np.sign(h["alpha"]) * B[h["kpi"]] / sd[h["kpi"]] * abs(h["alpha"]) for h in rasgos) / sum(abs(h["alpha"]) for h in rasgos)
    ok = (T["min"] >= 900) & (T.pos != "POR")
    act = ok & (T.temporada == season)

    def row(p):
        return {"id": int(p), "nombre": T.at[p, "nombre"], "pos": T.at[p, "pos"], "club": T.at[p, "club"], "min": int(T.at[p, "min"]),
                "score": r(score[p]), "aporta": [{"kpi": h["kpi"], "z": r(np.sign(h["alpha"]) * B.at[p, h["kpi"]] / sd[h["kpi"]])} for h in rasgos]}
    liga = [row(p) for p in score[act & (T.club != club)].sort_values(ascending=False).index[:8]]
    mine = score[ok & (T.club == club) & (T.temporada == season)].sort_values(ascending=False)
    return {"rasgos": [{"kpi": h["kpi"], "etiqueta": glob["kpis"][h["kpi"]]["etiqueta"], "alpha": r(h["alpha"]), "pct": r(h["pct"], 0)} for h in rasgos],
            "liga": liga, "club": club, "suman": [row(p) for p in mine.index[:3]], "restan": [row(p) for p in mine.index[::-1][:3] if mine[p] < 0]}


def tablero(c, art, glob, tiempo, rel):
    t = tiempo["dts"].get(str(c))
    if not t:
        return None
    u = t["ultimos"]
    H = {h["kpi"]: h for h in art["huella"]}
    cand = sorted([k for k in u["carrera"] if u["carrera"][k] is not None and rel.get(k, 0.6) >= 0.5],
                  key=lambda k: -abs(u["carrera"][k]))[:6]
    rows = []
    for k in cand:
        car, sdp, last = u["carrera"][k], u["sd"][k] or 1, u["m"][k]
        half = 1.64 * sdp / np.sqrt(max(u["n"], 1))
        est = "en_linea" if last is not None and abs(last - car) <= half else ("arriba" if last > car else "abajo")
        rows.append({"kpi": k, "etiqueta": glob["kpis"][k]["etiqueta"], "carrera": r(car), "banda": [r(car - half), r(car + half)], "ultimos": r(last), "estado": est,
                     "confiabilidad": r(rel.get(k), 2), "sello": fmt(k, H[k]["ajustado_valor"], glob) if k in H else None})
    S = art.get("simulacion", {}).get("partidos", [])
    S = sorted(S, key=lambda p: p["date"])
    res = None
    if len(S) >= 12:
        L, A = S[-10:], S
        m = lambda xs, f: float(np.mean([f(p) for p in xs]))
        res = {"pts": [r(m(L, lambda p: p["puntos"])), r(m(A, lambda p: p["puntos"]))], "xpts": [r(m(L, lambda p: p["xpts"])), r(m(A, lambda p: p["xpts"]))],
               "xgd": [r(m(L, lambda p: p["xg"] - p["xg_rival"])), r(m(A, lambda p: p["xg"] - p["xg_rival"]))]}
    return {"n": u["n"], "desde": u["desde"], "hasta": u["hasta"], "rasgos": rows, "resultados": res}


def main():
    C = load()
    seg, F, M = C["seg"], C["F"], C["M"]
    glob = json.load(open(ART / "global.json"))
    bp2 = json.load(open(PUB / "bp2.json"))
    tiempo = json.load(open(PUB / "tiempo.json"))
    val = json.load(open(PUB / "validacion.json")) if (PUB / "validacion.json").exists() else {}
    rel = {k: v["confiabilidad"] for k, v in val.get("confiabilidad", {}).items() if v.get("confiabilidad") is not None}
    T, B = player_table(seg, F, M)
    season = M.season.max()
    out = {"fases": {k: {"es": v[0], "en": v[1]} for k, v in FASES.items()}, "pos": {k: {"es": v[0], "en": v[1]} for k, v in POS_TXT.items()}, "dts": {}}
    arts = {d["id"]: json.load(open(ART / f"dt_{d['id']}.json")) for d in glob["dts"]}
    ofs = []
    for a in arts.values():
        e = a["jugadores"].get("cambios_por_estado", {}).get("Perdiendo", {})
        if sum(e.values()) >= 20:
            ofs.append(e.get("Más ofensivo", 0) / sum(e.values()) * 100)
    of_liga = float(np.median(ofs)) if ofs else 30.0
    for d in glob["dts"]:
        c = d["id"]
        art = arts[c]
        club = (d["clubes"][-1]["club"] if d.get("clubes") else None)
        pool = acciones(art, glob, rel) + contexto(art, glob) + balon_parado(c, art, bp2) + cambios(art, of_liga)
        out["dts"][str(c)] = {"acciones": sorted(pool, key=lambda x: -(x["fuerza"] or 0)), "todas": len(pool),
                              "fichajes": fichajes(c, art, glob, T, B, rel, season, club),
                              "tablero": tablero(c, art, glob, tiempo, rel)}
    from pipeline.plan_textos import apply
    out = apply(out)  # textos en tercera persona con {N} (sin «tú/él»)
    json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    n = [len(v["acciones"]) for v in out["dts"].values()]
    print(f"plan.json: {len(out['dts'])} DTs · acciones por DT min {min(n)} / mediana {int(np.median(n))} · {OUT.stat().st_size / 1e3:.0f} KB")


if __name__ == "__main__":
    main()
