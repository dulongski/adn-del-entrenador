"""Narrativa analítica generada SOLO a partir de los resultados del artefacto, en español (por defecto)
o en inglés (`build(art, glob, "en")`, misma estructura, mismos ids y claves de KPI).
Cada frase cita la métrica de la que sale (trazabilidad al marco analítico)."""
from __future__ import annotations

import numpy as np

# idioma activo durante un build(); T(es, en) devuelve el texto del idioma en curso
_EN = False


def T(es, en):
    return en if _EN else es


def _tr(d_en, es):
    """Traduce una cadena de datos con un mapa EN (si no hay traducción, se queda en español)."""
    return d_en.get(es, es) if _EN else es


PRINCIPIOS = {
    ("posesion", 1): ("Protagonismo con balón", "El equipo quiere la pelota y la conserva más que el promedio."),
    ("posesion", -1): ("Cede la iniciativa", "El equipo acepta tener menos balón y compite sin él."),
    ("salida_corta", 1): ("Salida limpia desde el portero", "El portero inicia en corto para atraer la presión."),
    ("salida_corta", -1): ("Saque largo del portero", "Evita el riesgo en salida y juega largo desde atrás."),
    ("pase_largo", 1): ("Juego directo", "Busca superar líneas con envíos largos."),
    ("pase_largo", -1): ("Asociación corta", "Evita el pelotazo; progresa con pases cortos."),
    ("verticalidad", 1): ("Verticalidad", "Cada posesión busca avanzar hacia portería con pocos rodeos."),
    ("verticalidad", -1): ("Paciencia con balón", "Circula y horizontaliza antes de acelerar."),
    ("tempo", 1): ("Circulación a ritmo alto", "Mueve la pelota rápido durante la posesión."),
    ("progresion_banda", 1): ("Progresión por fuera", "Las bandas son la vía principal para avanzar."),
    ("progresion_banda", -1): ("Progresión por dentro", "Prefiere avanzar por carriles interiores."),
    ("conduccion_prog", 1): ("Progresión en conducción", "Rompe líneas conduciendo, no sólo pasando."),
    ("centros", 1): ("Ataque de centros", "El centro al área es un recurso central de su ataque."),
    ("centros", -1): ("Evita el centro", "Llega al área por combinación más que por centro."),
    ("cambios_orientacion", 1): ("Cambios de orientación", "Busca el lado débil con cambios de juego."),
    ("llegada_area", 1): ("Llegada al área", "Una proporción alta de posesiones pisa el área rival."),
    ("xg_90", 1): ("Volumen ofensivo", "Genera más xG que el promedio."),
    ("xg_por_tiro", 1): ("Selección de tiro", "Tira desde posiciones de mayor calidad."),
    ("ppda", -1): ("Presión intensa", "Deja muy pocos pases al rival antes de intentar recuperar."),
    ("ppda", 1): ("Bloque que espera", "Permite circular al rival y defiende en su campo."),
    ("altura_presion", 1): ("Presión adelantada", "Sus presiones ocurren lejos de su portería."),
    ("altura_presion", -1): ("Presión en campo propio", "Presiona cerca de su área, no arriba."),
    ("presion_alta", 1): ("Presión en tercio rival", "Una parte alta de sus presiones es en el último tercio."),
    ("contrapresion", 1): ("Contrapresión tras pérdida", "Tras perder la pelota presiona de inmediato."),
    ("contrapresion", -1): ("Repliegue tras pérdida", "Tras perder la pelota prioriza reorganizarse."),
    ("recuperaciones_altas_90", 1): ("Roba en campo rival", "Recupera muchos balones en campo contrario."),
    ("linea_360", 1): ("Línea defensiva alta", "Su última línea defiende lejos de su portería (360)."),
    ("linea_360", -1): ("Línea defensiva baja", "Su última línea defiende cerca de su área (360)."),
    ("compacidad_360", -1): ("Bloque compacto", "Poca distancia entre líneas (360)."),
    ("altura_defensiva", 1): ("Defensa adelantada", "Sus acciones defensivas ocurren arriba."),
    ("altura_defensiva", -1): ("Defensa en campo propio", "Sus acciones defensivas ocurren cerca de su área."),
    ("contraataque", 1): ("Transición ofensiva rápida", "Tras recuperar, ataca rápido el último tercio."),
    ("contraataque", -1): ("Pausa tras recuperar", "Tras recuperar, asegura la posesión antes de atacar."),
    ("transicion_def", -1): ("Protección ante la contra", "Concede pocas transiciones rápidas tras perder."),
    ("xg_contra_90", -1): ("Solidez defensiva", "Concede poco xG."),
    ("field_tilt", 1): ("Dominio territorial", "Juega mucho más en el último tercio rival que el rival en el suyo."),
    ("xg_balon_parado_90", 1): ("Balón parado como arma", "Sus jugadas que nacen de balón parado generan más xG que el promedio."),
}
PRINCIPIOS_EN = {
    ("posesion", 1): ("Takes charge on the ball", "The team wants the ball and keeps it more than the league average."),
    ("posesion", -1): ("Cedes the initiative", "The team is happy with less of the ball and competes without it."),
    ("salida_corta", 1): ("Clean build-up from the keeper", "The keeper starts play short to draw the press."),
    ("salida_corta", -1): ("Long goal kicks", "Avoids risk at the back and plays long from the goalkeeper."),
    ("pase_largo", 1): ("Direct play", "Looks to bypass lines with long balls."),
    ("pase_largo", -1): ("Short combinations", "Avoids the hopeful long ball; moves up the pitch with short passes."),
    ("verticalidad", 1): ("Directness", "Every possession looks to head straight for goal."),
    ("verticalidad", -1): ("Patience on the ball", "Moves it side to side before speeding up."),
    ("tempo", 1): ("High-tempo circulation", "Moves the ball quickly in possession."),
    ("progresion_banda", 1): ("Progression down the flanks", "The flanks are the main route forward."),
    ("progresion_banda", -1): ("Progression through the middle", "Prefers to advance through the inside channels."),
    ("conduccion_prog", 1): ("Progression by carrying", "Breaks lines by running with the ball, not just passing."),
    ("centros", 1): ("Crossing attack", "The cross into the box is a key weapon in attack."),
    ("centros", -1): ("Avoids crossing", "Gets into the box through combinations rather than crosses."),
    ("cambios_orientacion", 1): ("Switches of play", "Looks for the weak side with switches."),
    ("llegada_area", 1): ("Getting into the box", "A high share of possessions reach the opposition box."),
    ("xg_90", 1): ("Attacking volume", "Generates more xG than the league average."),
    ("xg_por_tiro", 1): ("Shot selection", "Shoots from higher-quality positions."),
    ("ppda", -1): ("Intense pressing", "Allows the opponent very few passes before trying to win the ball back."),
    ("ppda", 1): ("Waiting block", "Lets the opponent keep the ball and defends in its own half."),
    ("altura_presion", 1): ("Front-foot pressing", "Its pressing happens far from its own goal."),
    ("altura_presion", -1): ("Presses in his own half", "Presses near its own box, not high up the pitch."),
    ("presion_alta", 1): ("Presses in the final third", "A large share of its pressures come in the attacking third."),
    ("contrapresion", 1): ("Counter-press after losing it", "Presses straight away after losing the ball."),
    ("contrapresion", -1): ("Drops off after losing it", "After losing the ball, getting back into shape comes first."),
    ("recuperaciones_altas_90", 1): ("Wins it in the opponent's half", "Wins lots of balls back in the opponent's half."),
    ("linea_360", 1): ("High defensive line", "The back line defends far from its own goal (360)."),
    ("linea_360", -1): ("Low defensive line", "The back line defends close to its own box (360)."),
    ("compacidad_360", -1): ("Compact block", "Little space between the lines (360)."),
    ("altura_defensiva", 1): ("High defense", "Its defensive actions happen high up the pitch."),
    ("altura_defensiva", -1): ("Defends in his own half", "Its defensive actions happen close to its own box."),
    ("contraataque", 1): ("Fast attacking transitions", "After winning the ball, attacks the final third quickly."),
    ("contraataque", -1): ("Calm after regains", "After winning the ball, secures possession before attacking."),
    ("transicion_def", -1): ("Guards against the counter", "Concedes few fast transitions after losing the ball."),
    ("xg_contra_90", -1): ("Defensive solidity", "Concedes little xG."),
    ("field_tilt", 1): ("Territorial control", "Spends far more time in the opponent's final third than the opponent does in its own."),
    ("xg_balon_parado_90", 1): ("Set pieces as a weapon", "Plays that start from set pieces generate more xG than the league average."),
}

DIM_ES = {"marcador": "el marcador", "minuto": "el minuto", "localia": "la localía", "rival": "la fuerza del rival"}
VAR_ES = {"local": "jugar de local", "fuerza_rival": "la fuerza del rival", "dif_goles_media": "ir ganando",
          "rival_presion": "que el rival presione", "rival_posesion": "que el rival quiera el balón",
          "rival_verticalidad": "que el rival sea vertical"}
VAR_EN = {"local": "playing at home", "fuerza_rival": "the opponent's strength", "dif_goles_media": "being ahead",
          "rival_presion": "the opponent pressing", "rival_posesion": "the opponent wanting the ball",
          "rival_verticalidad": "the opponent playing direct"}

# cadenas que vienen de los datos (zonas de córner, jugadas tipo, posiciones)
ZONA_EN = {"Punto penal": "Penalty spot", "Área chica": "Six-yard box", "Segundo palo": "Far post",
           "Primer palo": "Near post", "Corto": "Short"}
ARQ_EN = {"Salida del portero sin progresar": "Keeper build-up that goes nowhere",
          "Intento vertical cortado": "Vertical attempt cut out",
          "Progresión al último tercio": "Progression into the final third",
          "Posesión iniciada en campo rival": "Possession won in the opponent's half",
          "Pérdida inmediata": "Immediate turnover",
          "Circulación sin avance": "Circulation without progress",
          "Ataque que pisa el área": "Attack that reaches the box"}
POS_EN = {"Portero": "goalkeeper", "Central": "center-back", "Central der.": "right center-back",
          "Central izq.": "left center-back", "Lateral der.": "right-back", "Lateral izq.": "left-back",
          "Carrilero der.": "right wing-back", "Carrilero izq.": "left wing-back", "Pivote": "defensive mid",
          "Pivote der.": "right defensive mid", "Pivote izq.": "left defensive mid",
          "Interior der.": "right central mid", "Interior izq.": "left central mid",
          "Volante der.": "right midfielder", "Volante izq.": "left midfielder", "Mediapunta": "attacking mid",
          "Mediapunta der.": "right attacking mid", "Mediapunta izq.": "left attacking mid",
          "Extremo der.": "right winger", "Extremo izq.": "left winger", "Delantero centro": "center forward",
          "Delantero der.": "right forward", "Delantero izq.": "left forward"}


def _arq(nombre):
    """Nombre de una jugada tipo en el idioma activo (conserva el sufijo « (2)»)."""
    if not _EN:
        return nombre
    base, suf = (nombre[:-4], nombre[-4:]) if nombre.endswith(")") and nombre[-4:-3] == " " else (nombre, "")
    return ARQ_EN.get(base, base) + suf


def _ord(n):
    """Ordinal: «3º» en español, «3rd» en inglés."""
    if not _EN:
        return f"{n}º"
    try:
        i = int(n)
    except (TypeError, ValueError):
        return str(n)
    s = "th" if 10 <= i % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(i % 10, "th")
    return f"{i}{s}"


def f1(x, d=1):
    if x is None or (isinstance(x, float) and not np.isfinite(x)):
        return "—"
    if d == 1 and abs(x) < 1 and x != 0:
        d = 2  # p.ej. xG por tiro
    return f"{x:.{d}f}"


def sig(x):
    return f"{'+' if x >= 0 else '−'}{abs(x):.2f}σ"


def _h(art, k):
    return next((h for h in art["huella"] if h["kpi"] == k), None)


def _cmp(x, ref, sd, mas="más", menos="menos"):
    """Compara un valor con la liga en palabras, usando la dispersión entre equipos (sd)."""
    if not (_num(x) and _num(ref)):
        return None
    d = (x - ref) / sd if sd else 0
    if _EN:
        if abs(d) < 0.15:
            return "about the same as the league"
        w = "higher" if d > 0 else "lower"
        return (f"slightly {w}" if abs(d) < 0.6 else w if abs(d) < 1.2 else f"much {w}") + " than the league"
    if abs(d) < 0.15:
        return "casi igual que la liga"
    w = mas if d > 0 else menos
    return (f"un poco {w}" if abs(d) < 0.6 else w if abs(d) < 1.2 else f"mucho {w}") + " que la liga"


def build(art: dict, glob: dict, lang: str = "es") -> dict:
    global _EN
    _EN = lang == "en"
    try:
        return _build(art, glob)
    finally:
        _EN = False


def _build(art: dict, glob: dict) -> dict:
    H = [h for h in art["huella"] if not h["kpi"].startswith("arq_")]
    n_dts = len(glob["dts"])
    sd = {k: v.get("sd") for k, v in glob["kpis"].items()}

    # señal: α/se cuando hay bootstrap; si no, |α|
    def strength(h):
        return abs(h["alpha"]) / h["se"] if h.get("se") else abs(h["alpha"]) * 3
    ranked = sorted(H, key=strength, reverse=True)
    principios = []
    used = set()
    for h in ranked:
        key = (h["kpi"], 1 if h["alpha"] > 0 else -1)
        if key in PRINCIPIOS and PRINCIPIOS[key][0] not in used and strength(h) >= 1.5:
            used.add(PRINCIPIOS[key][0])  # la selección no depende del idioma
            t, d = PRINCIPIOS_EN[key] if _EN else PRINCIPIOS[key]
            txt, u = _corto(h["kpi"], glob)
            pct_ = h.get("pct")
            puesto = ""
            if pct_ is not None:
                n_mas = round((100 - pct_) / 100 * (n_dts - 1)) if h["alpha"] > 0 else round(pct_ / 100 * (n_dts - 1))
                if _EN:
                    puesto = (" No other coach pushes it this far in that direction." if n_mas == 0 else
                              f" Only 1 of {n_dts} coaches pushes it further in that direction." if n_mas == 1 else
                              f" Only {n_mas} of {n_dts} coaches push it further in that direction." if n_mas <= n_dts // 4 else "")
                else:
                    puesto = (" Ningún otro DT lo empuja tanto en esa dirección." if n_mas == 0 else
                              f" Solo 1 de {n_dts} DTs lo empuja más en esa dirección." if n_mas == 1 else
                              f" Solo {n_mas} de {n_dts} DTs lo empujan más en esa dirección." if n_mas <= n_dts // 4 else "")
            principios.append({
                "titulo": t, "descripcion": d, "kpi": h["kpi"],
                "evidencia": f"{txt}: {_val(h['crudo'], u)} {T('en sus partidos', 'in his matches')}, {_cmp(h['crudo'], h['liga'], sd.get(h['kpi']))} ({_val(h['liga'], u)})."
                             + puesto
                             + T(" Dato técnico: efecto propio ", " Technical note: coach effect ") + sig(h['alpha']) + (f" ± {h['se']:.2f}" if h.get("se") else "") + ".",
            })
        if len(principios) >= 6:
            break

    nombre = art["nombre"]
    etapas = art["etapas"]
    secciones = []

    # ---- identidad
    idn = art.get("identidad", {})
    ident = art["identificabilidad"]
    temps = art.get("temporadas") or []
    rango = (T(f"entre {temps[0]} y {temps[-1]}", f"between {temps[0]} and {temps[-1]}") if len(temps) > 1
             else (T(f"en {temps[0]}", f"in {temps[0]}") if temps else ""))
    clubes = ", ".join(f"{e['club']} ({e['partidos']})" for e in etapas)
    p = [T(f"{art['partidos_total']} partidos de Liga MX {rango}. ", f"{art['partidos_total']} Liga MX matches {rango}. ")
         + (T(f"Clubes (partidos): {clubes}.", f"Clubs (matches): {clubes}.") if len(etapas) > 1
            else T(f"Todos con {etapas[0]['club']}.", f"All with {etapas[0]['club']}.") if etapas else "")]
    if principios:
        p.append(T("Lo que más lo distingue, incluso con otros jugadores: ", "What sets him apart most, even with different players: ")
                 + _lista([x["titulo"].lower() for x in principios[:3]]) + ".")
    if ident:
        conn = f1(100 * ident.get("conectividad", 0), 0)
        if ident.get("indice", 0) >= 40:
            p.append(T(f"El {conn}% de los minutos de sus jugadores son de futbolistas que también jugaron con otros técnicos. "
                       "Por eso se puede separar bien lo que pone él de lo que ponen ellos.",
                       f"{conn}% of his players' minutes come from footballers who also played under other coaches. "
                       "That is what lets us cleanly separate what he brings from what they bring."))
        else:
            p.append(T(f"Solo el {conn}% de los minutos de sus jugadores son de futbolistas que también jugaron con otros técnicos. "
                       "Separar su estilo del de su plantilla es difícil: toma estas conclusiones con cautela.",
                       f"Only {conn}% of his players' minutes come from footballers who also played under other coaches. "
                       "His style is hard to separate from his squad's, so take these conclusions with caution."))
    secciones.append({"id": "identidad", "titulo": T("Quién es", "Who he is"), "parrafos": p})

    # ---- fases: una frase por rasgo, en palabras y con la cifra de la liga al lado
    def linea(h):
        txt, u = _corto(h["kpi"], glob)
        frase = f"{txt}: {_val(h['crudo'], u)} {T('en sus partidos', 'in his matches')}, {_cmp(h['crudo'], h['liga'], sd.get(h['kpi']))} ({_val(h['liga'], u)})."
        key = (h["kpi"], 1 if h["alpha"] > 0 else -1)
        f = (FRASES_EN if _EN else FRASES).get(key)
        if f and strength(h) >= UMBRAL_IDEA:
            frase += T(f" Quitando a sus jugadores, {f}.", f" Even with his players factored out, his team {f}.")
        return frase

    def fase_par(familias):
        hs = sorted([h for h in H if h["familia"] in familias], key=strength, reverse=True)[:3]
        return [linea(h) for h in hs]
    con = fase_par({"Construcción", "Progresión", "Ocasiones"})
    arqs = sorted([a for a in art.get("arquetipos", []) if a.get("dt_pct") is not None], key=lambda a: -(a["dt_pct"] - a["liga_pct"]))
    if arqs:
        a = arqs[0]
        con.append(T(f"La jugada que más repite comparado con la liga: «{a['nombre']}» ({f1(a['dt_pct'], 0)}% de sus ataques; liga {f1(a['liga_pct'], 0)}%).",
                     f"The pattern he repeats most compared with the league: “{_arq(a['nombre'])}” ({f1(a['dt_pct'], 0)}% of his attacks; league {f1(a['liga_pct'], 0)}%)."))
    secciones.append({"id": "ofensiva", "titulo": T("Con balón", "In possession"), "parrafos": con})
    secciones.append({"id": "defensiva", "titulo": T("Sin balón y transiciones", "Out of possession and transitions"),
                      "parrafos": fase_par({"Presión", "Organización defensiva", "Transiciones"})})

    # ---- DT vs plantilla
    att = {a["kpi"]: a for a in art["atribucion"] if not a["kpi"].startswith("arq_")}
    dom_coach, dom_squad = [], []
    for k, a in att.items():
        if abs(a["observado"]) < 0.25:
            continue
        c, s = a["coach"], a["player"] + a["club"]
        (dom_coach if abs(c) > abs(s) else dom_squad).append((k, a))
    p = []
    if dom_coach:
        p.append(T("Lo que más se nota y pone él: ", "The most visible traits that come from him: ")
                 + _lista([_min(_corto(k, glob)[0]) for k, a in sorted(dom_coach, key=lambda t: -abs(t[1]['coach']))[:4]]) + ".")
    if dom_squad:
        p.append(T("Lo que más se nota pero viene de sus jugadores o del club: ", "The most visible traits that come from his players or the club: ")
                 + _lista([_min(_corto(k, glob)[0]) for k, a in sorted(dom_squad, key=lambda t: -abs(t[1]['player'] + t[1]['club']))[:4]]) + ".")
    for t in art.get("transferencia", []):
        p.append(T(f"Prueba en {t['club']}: escondimos sus {t['partidos']} partidos ahí y le pedimos al modelo que adivinara quién dirigía. "
                   f"Lo puso {t['rank_ajustado']}º entre {t['n_clases']} técnicos (al azar saldría cerca del {f1(t['rank_nulo'], 0)}º).",
                   f"Test at {t['club']}: we hid his {t['partidos']} matches there and asked the model to guess who was in charge. "
                   f"It ranked him {_ord(t['rank_ajustado'])} out of {t['n_clases']} coaches (a random guess would land around {_ord(f1(t['rank_nulo'], 0))})."))
    secciones.append({"id": "dt_vs_plantilla", "titulo": T("¿Suyo o de la plantilla?", "His doing or his squad's?"), "parrafos": p})

    # ---- consistencia y contexto
    p = []
    if idn.get("lift"):
        p.append(T(f"Viendo un solo partido, el modelo adivina que es él {f1(idn['lift'])} veces más seguido que al azar.",
                   f"From a single match, the model picks him out {f1(idn['lift'])} times more often than chance."))
    if idn.get("dispersion_pct") is not None:
        dp = idn["dispersion_pct"]
        if _EN:
            p.append(f"His style varies from match to match more than that of {f1(dp, 0)} in 100 coaches"
                     + (": one of the most stable." if dp < 40 else ": he adapts a lot to the opponent and the game." if dp > 60 else ", which is about normal."))
        else:
            p.append(f"Su estilo cambia de un partido a otro más que el de {f1(dp, 0)} de cada 100 DTs"
                     + (": es de los más estables." if dp < 40 else ": se adapta mucho al rival y al partido." if dp > 60 else ", algo normal."))
    curves = art.get("contexto", {}).get("curvas", {})
    best = []
    for dim, kk in curves.items():
        for k, rows in kk.items():
            vals = [(r["nivel"], r["dt"] - r["liga"]) for r in rows if r["dt"] is not None and r["liga"] is not None and r["n_dt"] >= 15]
            if len(vals) >= 2:
                spread = max(v for _, v in vals) - min(v for _, v in vals)
                hi = max(vals, key=lambda t: t[1]); lo = min(vals, key=lambda t: t[1])
                best.append((spread, dim, k, hi, lo))
    for spread, dim, k, hi, lo in sorted(best, reverse=True)[:2]:
        p.append(T(f"{_corto(k, glob)[0]}: comparado con la liga, sube {_nivel(hi[0])} y baja {_nivel(lo[0])}.",
                   f"{_corto(k, glob)[0]}: relative to the league, it goes up {_nivel(hi[0])} and down {_nivel(lo[0])}."))
    mot = art.get("contexto", {}).get("motores", {})
    if mot.get("posesion"):
        top = mot["posesion"][0]
        if _EN:
            p.append(f"What moves his possession most from one match to the next is {VAR_EN.get(top['variable'], top['variable'])}: "
                     + ("when it happens, his team has more of the ball." if top["direccion"] > 0 else "when it happens, his team has less of the ball."))
        else:
            p.append(f"Lo que más mueve su posesión de un partido a otro es {VAR_ES.get(top['variable'], top['variable'])}: "
                     + ("cuando pasa, tiene más el balón." if top["direccion"] > 0 else "cuando pasa, tiene menos el balón."))
    secciones.append({"id": "contexto", "titulo": T("Según el partido", "Match by match"), "parrafos": p})

    # ---- jugadores
    J = art.get("jugadores", {})
    p = []
    if J.get("formaciones"):
        fs = sorted(J["formaciones"].items(), key=lambda t: -t[1])
        tot = sum(v for _, v in fs)
        p.append(T("Dibujos con los que arranca: ", "Starting formations: ") + ", ".join(f"{'-'.join(k)} ({100 * v / tot:.0f}%)" for k, v in fs[:3]) + ".")
    if J.get("estabilidad_xi") is not None:
        p.append(T(f"De un partido al siguiente cambia {f1(J['estabilidad_xi'])} titulares en promedio.",
                   f"From one match to the next he changes {f1(J['estabilidad_xi'])} starters on average."))
    mc, ml = J.get("minuto_cambios", {}), J.get("minuto_cambios_liga", {})
    if mc.get("1") is not None:
        p.append(T(f"Su primer cambio llega en el minuto {f1(mc['1'], 0)} (liga: {f1(ml.get('1'), 0)}).",
                   f"His first substitution comes in minute {f1(mc['1'], 0)} (league: {f1(ml.get('1'), 0)})."))
    per = J.get("cambios_por_estado", {}).get("Perdiendo", {})
    if per and sum(per.values()) > 0:
        pc = f"{100 * per.get('Más ofensivo', 0) / sum(per.values()):.0f}"
        p.append(T(f"Cuando va perdiendo, {pc}% de sus cambios son para atacar más (un delantero por un defensa o medio).",
                   f"When behind, {pc}% of his substitutions are attacking ones (a forward on for a defender or midfielder)."))
    imp = art.get("impacto_cambios", [])
    if imp:
        m = max(imp, key=lambda r: abs(r["neto"]))
        p.append(T(f"Después de sus cambios, el dato que más se mueve es «{_min(_corto(m['kpi'], glob)[0])}»: {'sube' if m['neto'] > 0 else 'baja'} respecto a lo normal en la liga.",
                   f"After his substitutions, the stat that moves most is “{_min(_corto(m['kpi'], glob)[0])}”: it {'rises' if m['neto'] > 0 else 'drops'} compared with the league norm."))
    top = J.get("jugadores", [])[:5]
    if top:
        p.append(T("Los que más minutos juegan con él: ", "His most-used players: ")
                 + _lista([f"{j['nombre']} ({_pos(j['posicion'])})" for j in top]) + ".")
    secciones.append({"id": "jugadores", "titulo": T("Sus jugadores", "His players"), "parrafos": p})

    # ---- balón parado
    B = art.get("balon_parado", {})
    o, d, l = B.get("ofensivo", {}), B.get("defensivo", {}), B.get("liga", {})
    p = []
    if o:
        z = max(o.get("corner_zonas", {}).items(), key=lambda t: t[1], default=(None, 0))
        if _EN:
            p.append(f"Attacking: {f1(o.get('corners_por_partido'))} corners per match, {f1(o.get('corner_corto_pct'), 0)}% taken short (league {f1(l.get('corner_corto_pct'), 0)}%). "
                     + (f"Mostly aimed at the {_tr(ZONA_EN, z[0]).lower()} ({f1(z[1], 0)}%). " if z[0] else "")
                     + f"{f1(o.get('corner_remate_pct'), 0)}% of his corners end in an attempt (league {f1(l.get('corner_remate_pct'), 0)}%).")
        else:
            p.append(f"A favor: {f1(o.get('corners_por_partido'))} córners por partido y {f1(o.get('corner_corto_pct'), 0)}% en corto (liga {f1(l.get('corner_corto_pct'), 0)}%). "
                     + (f"Los manda sobre todo al {z[0].lower()} ({f1(z[1], 0)}%). " if z[0] else "")
                     + f"Remata {f1(o.get('corner_remate_pct'), 0)}% de sus córners (liga {f1(l.get('corner_remate_pct'), 0)}%).")
    if d:
        p.append(T(f"En contra: cada 10 córners del rival le generan {f1(10 * (d.get('corner_xg') or 0), 2)} xG (liga {f1(10 * (l.get('corner_xg') or 0), 2)}). "
                   f"Gana el primer contacto en {f1(100 - (d.get('corner_primer_contacto_pct') or 0), 0)}% de ellos.",
                   f"Defending: every 10 opposition corners produce {f1(10 * (d.get('corner_xg') or 0), 2)} xG against him (league {f1(10 * (l.get('corner_xg') or 0), 2)}). "
                   f"His team wins the first contact on {f1(100 - (d.get('corner_primer_contacto_pct') or 0), 0)}% of them."))
    secciones.append({"id": "balon_parado", "titulo": T("Balón parado", "Set pieces"), "parrafos": p})

    # ---- simulación
    S = art.get("simulacion", {})
    if S.get("partidos"):
        diff = S["puntos"] - S["xpts"]
        if _EN:
            p = [f"He earned {S['puntos']} points. Based on the chances his teams created and conceded, the expected haul was {f1(S['xpts'])}"
                 + (": he got exactly what he deserved." if abs(diff) < 1 else f" ({f1(abs(diff))} {'more' if diff > 0 else 'fewer'} than expected)."),
                 "To find out, we replayed every match 5,000 times using the quality (xG) of each chance."]
        else:
            p = [f"Sumó {S['puntos']} puntos. Por las ocasiones que generó y concedió, lo normal habría sido {f1(S['xpts'])}"
                 + (": sacó justo lo que mereció." if abs(diff) < 1 else f" ({f1(abs(diff))} {'más' if diff > 0 else 'menos'} de lo esperado)."),
                 "Para saberlo, rejugamos cada partido 5,000 veces con la calidad (xG) de cada ocasión."]
        secciones.append({"id": "simulacion", "titulo": T("¿Merecía esos puntos?", "Did he deserve those points?"), "parrafos": p})

    # ---- resumen escaneable por sección (idea + puntos); `parrafos` queda para el texto completo y el informe Markdown
    res = _resumenes(art, glob, H, strength, principios, dom_coach, dom_squad, best)
    for s in secciones:
        idea, puntos = res.get(s["id"], (_sin_rasgos(), []))
        s["idea"] = idea
        s["puntos"] = puntos

    titular = f"{nombre}: " + (" + ".join(x["titulo"] for x in principios[:3]) if principios else T("perfil en construcción", "profile still taking shape"))
    return {"titular": titular, "principios": principios, "secciones": secciones}


def _lista(xs):
    xs = [x for x in xs if x]
    y = T(" y ", " and ")
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + y + xs[-1] if xs else ""


# =====================================================================================
# Resumen escaneable por sección: {"idea": str, "puntos": [{texto, dato, liga, efecto, nota}]}
# =====================================================================================
SIN_RASGOS = "Nada lo aleja mucho del promedio de la liga."
NOTA_DT = "lo pone él"
NOTA_PLANTILLA = "viene de la plantilla"
NOTA_AMBOS = "él y su plantilla"
SIN_RASGOS_EN = "Nothing sets him far apart from the league average."
NOTA_DT_EN = "comes from him"
NOTA_PLANTILLA_EN = "comes from the squad"
NOTA_AMBOS_EN = "him and his squad"


def _sin_rasgos():
    return T(SIN_RASGOS, SIN_RASGOS_EN)


def _nota_dt():
    return T(NOTA_DT, NOTA_DT_EN)


def _nota_plantilla():
    return T(NOTA_PLANTILLA, NOTA_PLANTILLA_EN)


# Etiqueta corta (≤ 8 palabras) y unidad con la que se formatea el valor observado.
CORTO = {
    "posesion": ("Posesión", "%"),
    "salida_corta": ("Salida corta del portero", "%"),
    "pase_largo": ("Pases largos", "%"),
    "construccion_exito": ("Salidas desde atrás que llegan a campo rival", "%"),
    "pases_por_posesion": ("Pases por posesión", ""),
    "tempo": ("Ritmo de circulación", " pases/min"),
    "verticalidad": ("Verticalidad", "%"),
    "progresivos": ("Acciones progresivas", " por 100"),
    "conduccion_prog": ("Progresión en conducción", "%"),
    "progresion_banda": ("Progresión por banda", "%"),
    "cambios_orientacion": ("Cambios de orientación", " por 100 pases"),
    "entradas_ultimo_tercio": ("Entradas al último tercio", " por 100 posesiones"),
    "xg_90": ("xG a favor", " por 90"),
    "xg_por_tiro": ("xG por tiro", ""),
    "tiros_90": ("Tiros", " por 90"),
    "llegada_area": ("Posesiones que pisan el área", "%"),
    "centros": ("Centros", " por 100 llegadas"),
    "obv_90": ("Valor generado con balón (OBV)", " por 90"),
    "ppda": ("Pases rivales por cada robo (PPDA)", ""),
    "altura_presion": ("Altura de la presión", ""),
    "presion_alta": ("Presiones en tercio rival", "%"),
    "intensidad_presion": ("Presiones por minuto sin balón", ""),
    "contrapresion": ("Contrapresión tras pérdida", "%"),
    "recuperaciones_altas_90": ("Recuperaciones en campo rival", " por 90"),
    "altura_defensiva": ("Altura de acciones defensivas", ""),
    "linea_360": ("Altura de la línea defensiva", " yd"),
    "compacidad_360": ("Longitud del bloque", " yd"),
    "posesion_rival_dur": ("Duración de la posesión rival", " s"),
    "xg_contra_90": ("xG en contra", " por 90"),
    "contraataque": ("Transiciones rápidas", "%"),
    "xg_transicion": ("xG de transiciones rápidas", "%"),
    "transicion_def": ("Contras rápidas concedidas", "%"),
    "field_tilt": ("Dominio territorial", "%"),
    "xg_balon_parado_90": ("xG tras balón parado", " por 90"),
}
CORTO_EN = {
    "posesion": ("Possession", "%"),
    "salida_corta": ("Short GK distribution", "%"),
    "pase_largo": ("Long passes", "%"),
    "construccion_exito": ("Successful build-up", "%"),
    "pases_por_posesion": ("Passes per possession", ""),
    "tempo": ("Tempo", " passes/min"),
    "verticalidad": ("Directness", "%"),
    "progresivos": ("Progressive actions", " per 100"),
    "conduccion_prog": ("Progression by carrying", "%"),
    "progresion_banda": ("Progression down the flanks", "%"),
    "cambios_orientacion": ("Switches of play", " per 100 passes"),
    "entradas_ultimo_tercio": ("Final-third entries", " per 100 possessions"),
    "xg_90": ("xG for", " per 90"),
    "xg_por_tiro": ("xG per shot", ""),
    "tiros_90": ("Shots", " per 90"),
    "llegada_area": ("Possessions reaching the box", "%"),
    "centros": ("Crosses", " per 100 entries"),
    "obv_90": ("OBV", " per 90"),
    "ppda": ("PPDA", ""),
    "altura_presion": ("Average pressing height", ""),
    "presion_alta": ("Pressures in the final third", "%"),
    "intensidad_presion": ("Pressures per min of opponent possession", ""),
    "contrapresion": ("Counter-pressing after a loss", "%"),
    "recuperaciones_altas_90": ("Recoveries in the opponent's half", " per 90"),
    "altura_defensiva": ("Defensive action height", ""),
    "linea_360": ("Defensive line height", " yd"),
    "compacidad_360": ("Block length", " yd"),
    "posesion_rival_dur": ("Average opponent possession length", " s"),
    "xg_contra_90": ("xG against", " per 90"),
    "contraataque": ("Fast transitions", "%"),
    "xg_transicion": ("xG from fast transitions", "%"),
    "transicion_def": ("Fast transitions conceded", "%"),
    "field_tilt": ("Field tilt", "%"),
    "xg_balon_parado_90": ("xG after set pieces", " per 90"),
}

# Frase verbal (sin sujeto) para la «idea» de cada rasgo según el signo del efecto del DT.
FRASES = {
    ("posesion", 1): "quiere la pelota", ("posesion", -1): "cede la pelota al rival",
    ("salida_corta", 1): "sale en corto desde el portero", ("salida_corta", -1): "sale en largo desde el portero",
    ("pase_largo", 1): "busca el pase largo", ("pase_largo", -1): "evita el pelotazo",
    ("construccion_exito", 1): "saca el balón jugado desde atrás", ("construccion_exito", -1): "sufre para salir jugando",
    ("pases_por_posesion", 1): "encadena muchos pases", ("pases_por_posesion", -1): "hace posesiones cortas",
    ("tempo", 1): "mueve la pelota rápido", ("tempo", -1): "circula con calma",
    ("verticalidad", 1): "ataca en vertical", ("verticalidad", -1): "avanza sin prisa",
    ("progresivos", 1): "progresa a menudo", ("progresivos", -1): "arriesga poco hacia adelante",
    ("conduccion_prog", 1): "rompe líneas en conducción", ("conduccion_prog", -1): "progresa más pasando que conduciendo",
    ("progresion_banda", 1): "avanza por las bandas", ("progresion_banda", -1): "avanza por dentro",
    ("cambios_orientacion", 1): "cambia mucho de orientación", ("cambios_orientacion", -1): "rara vez cambia de banda",
    ("entradas_ultimo_tercio", 1): "pisa mucho el último tercio", ("entradas_ultimo_tercio", -1): "llega poco al último tercio",
    ("xg_90", 1): "genera muchas ocasiones", ("xg_90", -1): "genera pocas ocasiones",
    ("xg_por_tiro", 1): "tira desde buenas posiciones", ("xg_por_tiro", -1): "tira desde lejos",
    ("tiros_90", 1): "tira mucho", ("tiros_90", -1): "tira poco",
    ("llegada_area", 1): "llega mucho al área", ("llegada_area", -1): "llega poco al área",
    ("centros", 1): "vive del centro al área", ("centros", -1): "evita el centro",
    ("obv_90", 1): "genera peligro con el balón", ("obv_90", -1): "genera poco con el balón",
    ("ppda", -1): "presiona con intensidad", ("ppda", 1): "espera al rival sin presionar",
    ("altura_presion", 1): "presiona arriba", ("altura_presion", -1): "presiona en campo propio",
    ("presion_alta", 1): "presiona en el tercio rival", ("presion_alta", -1): "rara vez presiona en el tercio rival",
    ("intensidad_presion", 1): "presiona sin descanso", ("intensidad_presion", -1): "presiona poco",
    ("contrapresion", 1): "presiona justo tras perder", ("contrapresion", -1): "se repliega tras perder",
    ("recuperaciones_altas_90", 1): "recupera en campo rival", ("recuperaciones_altas_90", -1): "recupera poco en campo rival",
    ("altura_defensiva", 1): "defiende adelantado", ("altura_defensiva", -1): "defiende cerca de su área",
    ("linea_360", 1): "adelanta la línea defensiva", ("linea_360", -1): "defiende con la línea baja",
    ("compacidad_360", -1): "defiende en bloque compacto", ("compacidad_360", 1): "defiende con el bloque largo",
    ("posesion_rival_dur", -1): "recupera rápido la pelota", ("posesion_rival_dur", 1): "tarda en recuperar la pelota",
    ("xg_contra_90", -1): "concede pocas ocasiones", ("xg_contra_90", 1): "concede muchas ocasiones",
    ("contraataque", 1): "contraataca rápido", ("contraataque", -1): "pausa el juego tras robar",
    ("xg_transicion", 1): "hace daño a la contra", ("xg_transicion", -1): "saca poco de la contra",
    ("transicion_def", -1): "frena bien las contras rivales", ("transicion_def", 1): "sufre contras tras perder",
    ("field_tilt", 1): "juega en campo rival", ("field_tilt", -1): "juega lejos del área rival",
    ("xg_balon_parado_90", 1): "hace daño a balón parado", ("xg_balon_parado_90", -1): "saca poco del balón parado",
}
FRASES_EN = {
    ("posesion", 1): "wants the ball", ("posesion", -1): "hands the ball to the opponent",
    ("salida_corta", 1): "plays out short from the keeper", ("salida_corta", -1): "goes long from the keeper",
    ("pase_largo", 1): "looks for the long ball", ("pase_largo", -1): "avoids the hopeful long ball",
    ("construccion_exito", 1): "builds out cleanly from the back", ("construccion_exito", -1): "struggles to play out from the back",
    ("pases_por_posesion", 1): "strings lots of passes together", ("pases_por_posesion", -1): "keeps possessions short",
    ("tempo", 1): "moves the ball quickly", ("tempo", -1): "circulates calmly",
    ("verticalidad", 1): "attacks vertically", ("verticalidad", -1): "takes its time going forward",
    ("progresivos", 1): "moves the ball forward often", ("progresivos", -1): "takes few risks going forward",
    ("conduccion_prog", 1): "breaks lines on the carry", ("conduccion_prog", -1): "progresses more by passing than carrying",
    ("progresion_banda", 1): "advances down the flanks", ("progresion_banda", -1): "advances through the middle",
    ("cambios_orientacion", 1): "switches play a lot", ("cambios_orientacion", -1): "rarely switches flanks",
    ("entradas_ultimo_tercio", 1): "gets into the final third a lot", ("entradas_ultimo_tercio", -1): "rarely reaches the final third",
    ("xg_90", 1): "creates lots of chances", ("xg_90", -1): "creates few chances",
    ("xg_por_tiro", 1): "shoots from good positions", ("xg_por_tiro", -1): "shoots from distance",
    ("tiros_90", 1): "shoots a lot", ("tiros_90", -1): "shoots little",
    ("llegada_area", 1): "gets into the box a lot", ("llegada_area", -1): "rarely gets into the box",
    ("centros", 1): "lives off crosses into the box", ("centros", -1): "avoids crossing",
    ("obv_90", 1): "creates danger on the ball", ("obv_90", -1): "adds little on the ball",
    ("ppda", -1): "presses intensely", ("ppda", 1): "waits for the opponent instead of pressing",
    ("altura_presion", 1): "presses high", ("altura_presion", -1): "presses in its own half",
    ("presion_alta", 1): "presses in the final third", ("presion_alta", -1): "rarely presses in the final third",
    ("intensidad_presion", 1): "presses relentlessly", ("intensidad_presion", -1): "presses little",
    ("contrapresion", 1): "presses right after losing the ball", ("contrapresion", -1): "drops back after losing the ball",
    ("recuperaciones_altas_90", 1): "wins the ball back high", ("recuperaciones_altas_90", -1): "rarely wins the ball back high",
    ("altura_defensiva", 1): "defends on the front foot", ("altura_defensiva", -1): "defends close to its own box",
    ("linea_360", 1): "pushes the back line up", ("linea_360", -1): "defends with a deep line",
    ("compacidad_360", -1): "defends in a compact block", ("compacidad_360", 1): "defends with a stretched block",
    ("posesion_rival_dur", -1): "wins the ball back quickly", ("posesion_rival_dur", 1): "is slow to win the ball back",
    ("xg_contra_90", -1): "concedes few chances", ("xg_contra_90", 1): "concedes lots of chances",
    ("contraataque", 1): "counters quickly", ("contraataque", -1): "slows the game down after winning it",
    ("xg_transicion", 1): "does damage on the counter", ("xg_transicion", -1): "gets little out of the counter",
    ("transicion_def", -1): "shuts down opposing counters", ("transicion_def", 1): "gets caught on the counter after losing it",
    ("field_tilt", 1): "lives in the opponent's half", ("field_tilt", -1): "plays far from the opponent's box",
    ("xg_balon_parado_90", 1): "is dangerous from set pieces", ("xg_balon_parado_90", -1): "gets little from set pieces",
}

FAM_ES = {"Construcción": "la construcción", "Progresión": "la progresión", "Ocasiones": "la finalización",
          "Presión": "la presión", "Organización defensiva": "el bloque defensivo", "Transiciones": "las transiciones",
          "Dominio": "el dominio territorial", "Balón parado": "el balón parado"}
FAM_EN = {"Construcción": "build-up", "Progresión": "progression", "Ocasiones": "finishing",
          "Presión": "pressing", "Organización defensiva": "the defensive block", "Transiciones": "transitions",
          "Dominio": "territorial control", "Balón parado": "set pieces"}
DIM_A = {"marcador": "al marcador", "minuto": "al minuto de juego", "localia": "a la localía", "rival": "a la fuerza del rival"}
DIM_A_EN = {"marcador": "to the scoreline", "minuto": "to the game clock", "localia": "to home and away",
            "rival": "to the opponent's strength"}
NIVEL_ES = {"Perdiendo": "cuando pierde", "Empatando": "cuando empata", "Ganando": "cuando gana",
            "0-15'": "en el 0-15'", "15-30'": "en el 15-30'", "30-45'": "en el 30-45'", "45-60'": "en el 45-60'", "60-75'": "en el 60-75'",
            "75'+": "desde el 75'", "Local": "de local", "Visitante": "de visitante",
            "Rival débil": "ante rivales débiles", "Rival medio": "ante rivales medios", "Rival fuerte": "ante rivales fuertes"}
NIVEL_EN = {"Perdiendo": "when losing", "Empatando": "when level", "Ganando": "when winning",
            "0-15'": "in minutes 0-15", "15-30'": "in minutes 15-30", "30-45'": "in minutes 30-45", "45-60'": "in minutes 45-60", "60-75'": "in minutes 60-75",
            "75'+": "from the 75th minute", "Local": "at home", "Visitante": "away",
            "Rival débil": "against weaker sides", "Rival medio": "against mid-table sides", "Rival fuerte": "against stronger sides"}
# Rasgos que dicen casi lo mismo: en una idea solo entra uno por grupo
GRUPO = {"salida_corta": "largo", "pase_largo": "largo", "posesion": "balon", "pases_por_posesion": "balon",
         "ppda": "presion", "altura_presion": "presion", "presion_alta": "presion", "intensidad_presion": "presion",
         "linea_360": "altura_def", "altura_defensiva": "altura_def", "llegada_area": "llegada",
         "entradas_ultimo_tercio": "llegada", "contraataque": "contra", "xg_transicion": "contra"}
UMBRAL_IDEA = 1.5  # misma señal mínima (α/EE) que exige un «principio»


def _nivel(n):
    return (NIVEL_EN if _EN else NIVEL_ES).get(n, n)


def _pos(p):
    return POS_EN.get(p, p.lower()) if _EN else p.lower()


def _num(x):
    return x is not None and not (isinstance(x, float) and not np.isfinite(x))


def _r(x, d=2):
    return round(float(x), d) if _num(x) else None


def _pt(texto, dato=None, liga=None, efecto=None, nota=None, kpi=None):
    return {"texto": texto, "dato": dato, "liga": liga, "efecto": _r(efecto), "nota": nota, "kpi": kpi}


def _corto(k, glob):
    if k in CORTO:
        return CORTO_EN[k] if _EN else CORTO[k]
    et = glob["kpis"].get(k, {}).get("etiqueta", k)
    return _arq(et.split(" (")[0]) if k.startswith("arq_") else et.split(" (")[0], ""


def _val(x, unit):
    return None if not _num(x) else f"{f1(x)}{unit}"


def _liga(x, unit):
    # la referencia de liga solo repite unidades cortas (%, yd, s); el resto va sin unidad
    return None if not _num(x) else f"{T('liga', 'league')} {f1(x)}{unit if unit in ('%', ' yd', ' s') else ''}"


def _frase(partes):
    """Une frases verbales en una oración: «a», «a y b», «a, b y c». Primera letra en mayúscula."""
    partes = [p for p in partes if p]
    if not partes:
        return None
    txt = partes[0] if len(partes) == 1 else ", ".join(partes[:-1]) + T(" y ", " and ") + partes[-1]
    return txt[0].upper() + txt[1:] + "."


def _idea_rasgos(hs, strength, max_palabras=12):
    """Idea a partir de las frases de los rasgos con señal clara. Evita repetir el verbo
    («presiona arriba y presiona…») y corta para no pasar de ~12 palabras.
    La selección se hace siempre con las frases en español, así ambos idiomas dicen lo mismo."""
    partes, salida, verbos, grupos = [], [], set(), set()
    for h in hs:
        if strength(h) < UMBRAL_IDEA:
            continue
        key = (h["kpi"], 1 if h["alpha"] > 0 else -1)
        f = FRASES.get(key)
        g = GRUPO.get(h["kpi"], h["kpi"])
        if not f or f.split()[0] in verbos or g in grupos:
            continue
        if partes and len(" ".join(partes + [f]).split()) > max_palabras:
            break
        partes.append(f)
        salida.append(FRASES_EN.get(key, f) if _EN else f)
        verbos.add(f.split()[0])
        grupos.add(g)
        if len(partes) == 3:
            break
    return _frase(salida) or _sin_rasgos()


def _nota_atrib(a):
    """Regla simple para la nota de un rasgo, usando el prisma de atribución (σ), con
    c = efecto del DT, s = plantilla+club y o = lo observado:
    - «idea propia del DT»: c empuja hacia o y pesa al menos tanto como s;
    - «la plantilla lo potencia»: c y s empujan hacia o, pero s pesa más;
    - «lo explica la plantilla»: solo s empuja hacia o (el DT no, o en contra);
    - sin nota en otro caso (lo observado lo explican sobre todo rival/contexto)."""
    if not a or not all(_num(a.get(k)) for k in ("observado", "coach", "player", "club")):
        return None
    o, c, s = a["observado"], a["coach"], a["player"] + a["club"]
    c_ok, s_ok = np.sign(c) == np.sign(o), np.sign(s) == np.sign(o)
    if c_ok and (abs(c) >= abs(s) or not s_ok):
        return _nota_dt()
    if c_ok and s_ok:
        return T(NOTA_AMBOS, NOTA_AMBOS_EN)
    if s_ok:
        return _nota_plantilla()
    return None


def _min(t):
    """Primera letra en minúscula salvo siglas («xG», «OBV»)."""
    return t if len(t) > 1 and t[1].isupper() else t[:1].lower() + t[1:]


def _resumenes(art, glob, H, strength, principios, dom_coach, dom_squad, best):
    att = {a["kpi"]: a for a in art.get("atribucion", [])}
    hmap = {h["kpi"]: h for h in H}
    R = {}

    # ---- identidad
    idn = art.get("identidad") or {}
    ident = art.get("identificabilidad") or {}
    etapas_ = art.get("etapas") or []
    n_cl = len({e["club"] for e in etapas_})
    idea = (T(f"{art.get('partidos_total')} partidos en {n_cl} clubes.", f"{art.get('partidos_total')} matches across {n_cl} clubs.") if n_cl > 1 else
            T(f"{art.get('partidos_total')} partidos, todos con {etapas_[0]['club']}.", f"{art.get('partidos_total')} matches, all with {etapas_[0]['club']}.") if etapas_ else "")
    if _num(ident.get("indice")):
        idea += (T(" Su estilo se distingue bien del de sus jugadores.", " His style stands out clearly from his players'.") if ident["indice"] >= 40
                 else T(" Cuesta separar su estilo del de sus jugadores.", " His style is hard to tell apart from his players'."))
    idea = idea.strip() or _sin_rasgos()
    temps = art.get("temporadas") or []
    pts = [_pt(T("Partidos", "Matches"), str(art.get("partidos_total", "—")),
               nota=(T(f"{temps[0]} a {temps[-1]}", f"{temps[0]} to {temps[-1]}") if len(temps) > 1 else (temps[0] if temps else None)))]
    etapas = art.get("etapas") or []
    if etapas:
        pts.append(_pt(T("Clubes", "Clubs") if len(etapas) > 1 else "Club", " → ".join(e["club"] for e in etapas)))
    if _num(ident.get("indice")):
        pts.append(_pt(T("Qué tan bien se separa de su plantilla", "How cleanly he separates from his squad"), f"{f1(ident['indice'], 0)}/100",
                       nota=T("se separa bien", "clean separation") if ident["indice"] >= 40 else T("cuesta separarlos", "hard to separate")))
    if _num(idn.get("lift")):
        l = idn["lift"]
        pts.append(_pt(T("Se le reconoce viendo un partido", "Recognizable from a single match"), f"{f1(l)}×", T("vs. adivinar al azar", "vs. a random guess"),
                       nota=T("muy marcado", "very distinctive") if l >= 5 else T("marcado", "distinctive") if l >= 2 else T("poco distintivo", "not very distinctive")))
    R["identidad"] = (idea, pts)

    # ---- fases: 3 rasgos con más señal del DT (+1 si también supera el umbral)
    def fase(familias):
        hs = sorted([h for h in H if h["familia"] in familias], key=strength, reverse=True)
        hs = hs[:3] + [h for h in hs[3:4] if strength(h) >= UMBRAL_IDEA]
        pts = []
        for h in hs:
            txt, u = _corto(h["kpi"], glob)
            pts.append(_pt(txt, _val(h.get("crudo"), u), _liga(h.get("liga"), u), h.get("alpha"), _nota_atrib(att.get(h["kpi"])), h["kpi"]))
        return _idea_rasgos(hs, strength), pts
    R["ofensiva"] = fase({"Construcción", "Progresión", "Ocasiones"})
    R["defensiva"] = fase({"Presión", "Organización defensiva", "Transiciones"})

    # ---- DT vs plantilla
    dc = sorted(dom_coach, key=lambda t: -abs(t[1]["coach"]))
    ds = sorted(dom_squad, key=lambda t: -abs(t[1]["player"] + t[1]["club"]))
    trs = art.get("transferencia") or []
    n_tr = 1 if trs else 0
    pts = []
    for k, a in dc[:3]:
        txt, u = _corto(k, glob)
        h = hmap.get(k, {})
        pts.append(_pt(txt, _val(h.get("crudo"), u), _liga(h.get("liga"), u), a["coach"], _nota_dt(), k))
    for k, a in ds[:max(0, min(2, 5 - len(pts) - n_tr))]:
        txt, u = _corto(k, glob)
        h = hmap.get(k, {})
        pts.append(_pt(txt, _val(h.get("crudo"), u), _liga(h.get("liga"), u), a["player"] + a["club"], _nota_plantilla(), k))
    if trs:
        orden = {e["club"]: i for i, e in enumerate(art.get("etapas") or [])}
        t = max(trs, key=lambda t: orden.get(t["club"], -1))  # la etapa más reciente
        ok = t["rank_ajustado"] <= max(3, t["n_clases"] // 10)
        nota = (T("sí, su estilo viaja", "yes, his style travels") if ok
                else T("le cuesta", "not really") if t["rank_ajustado"] > t.get("rank_nulo", 0) * 0.7 else T("a medias", "partly"))
        pts.append(_pt(T(f"¿Lo reconocen en {t['club']}?", f"Recognized at {t['club']}?"),
                       T(f"{t['rank_ajustado']}º de {t['n_clases']}", f"{_ord(t['rank_ajustado'])} of {t['n_clases']}"),
                       T(f"al azar ≈ {f1(t.get('rank_nulo'), 0)}º", f"random ≈ {_ord(f1(t.get('rank_nulo'), 0))}"), nota=nota))

    def fam_top(lst, val):
        acc = {}
        for k, a in lst:
            fam = glob["kpis"].get(k, {}).get("familia")
            if fam in FAM_ES:
                acc[fam] = acc.get(fam, 0) + abs(val(a))
        return sorted(acc, key=lambda f: -acc[f])
    fc = fam_top(dc, lambda a: a["coach"])
    fs = [f for f in fam_top(ds, lambda a: a["player"] + a["club"]) if f not in fc[:1]]
    FAM = FAM_EN if _EN else FAM_ES
    if fc and fs:
        idea = T(f"Su huella se nota más en {FAM[fc[0]]} que en {FAM[fs[0]]}.", f"His imprint shows more in {FAM[fc[0]]} than in {FAM[fs[0]]}.")
    elif fc:
        idea = T(f"Su huella se nota sobre todo en {FAM[fc[0]]}.", f"His imprint shows mostly in {FAM[fc[0]]}.")
    elif fs:
        idea = T(f"Lo que se ve viene más de sus jugadores, sobre todo en {FAM[fs[0]]}.", f"What you see comes more from his players, especially in {FAM[fs[0]]}.")
    else:
        idea = _sin_rasgos()
    R["dt_vs_plantilla"] = (idea, pts)

    # ---- contexto
    pts = []
    if _num(idn.get("acierto")) and idn.get("k"):
        pts.append(_pt(T("Adivinan que es él viendo un partido", "Identified from a single match"), f"{f1(100 * idn['acierto'], 0)}%",
                       T(f"al azar {f1(100 / idn['k'])}%", f"random {f1(100 / idn['k'])}%")))
    dp = idn.get("dispersion_pct")
    if _num(dp):
        pts.append(_pt(T("Cuánto cambia entre partidos", "How much he varies between matches"),
                       T("poco", "little") if dp < 40 else T("mucho", "a lot") if dp > 60 else T("lo normal", "normal"),
                       nota=T(f"más que {f1(dp, 0)}% de los DTs", f"more than {f1(dp, 0)}% of coaches")))
    seen = set()
    top_dim = None
    for spread, dim, k, hi, lo in sorted(best, key=lambda t: -t[0]):
        if k in seen:
            continue
        top_dim = top_dim or dim
        # nivel donde más se aparta de su propia media frente a la liga (la «reacción»)
        rows = (art.get("contexto") or {}).get("curvas", {}).get(dim, {}).get(k, [])
        ds_ = [r["dt"] - r["liga"] for r in rows if r["dt"] is not None and r["liga"] is not None and r["n_dt"] >= 15]
        mu = sum(ds_) / len(ds_) if ds_ else 0
        nivel, d = max((hi, lo), key=lambda t: abs(t[1] - mu))
        if _EN:
            dato = ("much " if abs(d) >= 1 else "") + ("higher" if d > 0 else "lower")
        else:
            dato = ("mucho " if abs(d) >= 1 else "") + ("más" if d > 0 else "menos")
        pts.append(_pt(f"{_corto(k, glob)[0]} {_nivel(nivel)}", dato, T("que la liga", "than the league"), efecto=d))
        seen.add(k)
        if len(seen) == 2:
            break
    mot = (art.get("contexto") or {}).get("motores", {}).get("posesion") or []
    if mot:
        m = mot[0]
        pts.append(_pt(T("Lo que más cambia su posesión", "What moves his possession most"), (VAR_EN if _EN else VAR_ES).get(m["variable"], m["variable"]),
                       nota=T("tiene más el balón", "more of the ball") if m["direccion"] > 0 else T("tiene menos el balón", "less of the ball")))
    DIM = DIM_A_EN if _EN else DIM_A
    if not _num(dp):
        idea = T("Sin datos suficientes para medir su consistencia.", "Not enough data to measure his consistency.")
    elif dp < 40:
        idea = T("Estilo estable: cambia poco de un partido a otro.", "Stable style: changes little from match to match.")
    elif dp > 60:
        idea = (T(f"Estilo cambiante: se adapta mucho {DIM[top_dim]}.", f"Shifting style: adapts a lot {DIM[top_dim]}.") if top_dim
                else T("Estilo cambiante: varía mucho de un partido a otro.", "Shifting style: varies a lot from match to match."))
    else:
        idea = (T(f"Variabilidad normal; se adapta sobre todo {DIM[top_dim]}.", f"Normal variability; adapts mainly {DIM[top_dim]}.") if top_dim
                else T("Variabilidad normal entre partidos.", "Normal variability between matches."))
    R["contexto"] = (idea, pts)

    # ---- jugadores
    J = art.get("jugadores") or {}
    pts, partes = [], []
    fs_ = sorted((J.get("formaciones") or {}).items(), key=lambda t: -t[1])
    if fs_:
        tot = sum(v for _, v in fs_)
        dib, share = "-".join(fs_[0][0]), fs_[0][1] / tot
        pts.append(_pt(T("Dibujo más usado", "Most-used formation"), dib, nota=T(f"{100 * share:.0f}% de los partidos", f"{100 * share:.0f}% of matches")))
    est = J.get("estabilidad_xi")
    if _num(est):
        pts.append(_pt(T("Titulares que cambia por partido", "Starters changed per match"), f1(est),
                       nota=T("rota poco", "rotates little") if est < 2.0 else T("rota mucho", "rotates a lot") if est > 2.8 else T("lo normal", "normal")))
        # umbrales ≈ percentiles 25 y 75 de los DTs de la muestra (mediana ≈ 2.4)
        partes.append(T("rota poco el once", "rarely rotates his XI") if est < 2.0 else T("rota mucho el once", "rotates his XI a lot") if est > 2.8 else None)
    if fs_:
        partes.append(T(f"juega casi siempre en {dib}", f"almost always lines up in a {dib}") if share >= 0.7
                      else T(f"suele jugar en {dib}", f"usually lines up in a {dib}") if share >= 0.5
                      else T(f"alterna dibujos en torno al {dib}", f"mixes formations around a {dib}"))
    mc, ml = J.get("minuto_cambios") or {}, J.get("minuto_cambios_liga") or {}
    m1, l1 = mc.get("1"), ml.get("1")
    if _num(m1):
        dif = m1 - l1 if _num(l1) else 0
        pts.append(_pt(T("Su primer cambio", "His first substitution"), f"min {f1(m1, 0)}", f"{T('liga', 'league')} {f1(l1, 0)}" if _num(l1) else None,
                       nota=T("más tarde que la liga", "later than the league") if dif >= 3 else T("antes que la liga", "earlier than the league") if dif <= -3 else None))
        partes.append(T("cambia tarde", "makes late changes") if dif >= 3 else T("cambia pronto", "makes early changes") if dif <= -3 else None)
    per = (J.get("cambios_por_estado") or {}).get("Perdiendo") or {}
    if per and sum(per.values()) > 0:
        pts.append(_pt(T("Cambios para atacar cuando pierde", "Attacking subs when behind"), f"{100 * per.get('Más ofensivo', 0) / sum(per.values()):.0f}%"))
    imp = art.get("impacto_cambios") or []
    if imp:
        m = max(imp, key=lambda r: abs(r["neto"]))
        incierto = _num(m.get("se")) and abs(m["neto"]) < m["se"]
        pts.append(_pt(T(f"Tras sus cambios: {_min(_corto(m['kpi'], glob)[0])}", f"After his subs: {_min(_corto(m['kpi'], glob)[0])}"),
                       T("sube", "up") if m["neto"] > 0 else T("baja", "down"), efecto=m["neto"],
                       nota=T("no es seguro", "not conclusive") if incierto else None))
    R["jugadores"] = (_frase(partes) or T("Sin datos suficientes sobre el uso de la plantilla.", "Not enough data on how he uses his squad."), pts[:5])

    # ---- balón parado
    B = art.get("balon_parado") or {}
    o, d, l = B.get("ofensivo") or {}, B.get("defensivo") or {}, B.get("liga") or {}
    pts = []
    if o:
        pts.append(_pt(T("Córners por partido", "Corners per match"), _val(o.get("corners_por_partido"), ""), _liga(l.get("corners_por_partido"), "")))
        pts.append(_pt(T("Córners en corto", "Short corners"), _val(o.get("corner_corto_pct"), "%"), _liga(l.get("corner_corto_pct"), "%")))
        z = max((o.get("corner_zonas") or {}).items(), key=lambda t: t[1], default=None)
        if z:
            pts.append(_pt(T("A dónde los manda", "Where he sends them"), _tr(ZONA_EN, z[0]), nota=T(f"{z[1]:.0f}% de sus córners", f"{z[1]:.0f}% of his corners")))
    # xG por córner es un número muy pequeño: se expresa cada 10 córners para leerlo con 2 decimales
    x10 = lambda v: 10 * v if _num(v) else None
    if o:
        pts.append(_pt(T("Peligro cada 10 córners a favor (xG)", "Threat per 10 corners won (xG)"), _val(x10(o.get("corner_xg")), ""), _liga(x10(l.get("corner_xg")), "")))
    if d:
        pts.append(_pt(T("Peligro cada 10 córners en contra (xG)", "Threat per 10 corners conceded (xG)"), _val(x10(d.get("corner_xg")), ""), _liga(x10(l.get("corner_xg")), "")))

    def ratio(v):
        return v / l["corner_xg"] if _num(v) and _num(l.get("corner_xg")) and l["corner_xg"] > 0 else None
    ro, rd = ratio(o.get("corner_xg")), ratio(d.get("corner_xg"))
    ata = None if ro is None else (T("saca mucho peligro de sus córners", "creates a lot of danger from its corners") if ro > 1.15
                                   else T("saca poco peligro de sus córners", "creates little danger from its corners") if ro < 0.85 else None)
    dfn = None if rd is None else (T("concede poco en los del rival", "concedes little from the opponent's") if rd < 0.85
                                   else T("sufre en los del rival", "struggles against the opponent's") if rd > 1.15 else None)
    if ata or dfn:
        idea = _frase([ata or T("ataca los córners como la liga", "attacks corners like the league average"),
                       dfn or (T("defiende como la liga", "defends them like the league average") if rd is not None else None)])
    elif o or d:
        idea = T("Balón parado en la media de la liga.", "Set pieces in line with the league average.")
    else:
        idea = T("Sin datos de balón parado.", "No set-piece data.")
    R["balon_parado"] = (idea, pts)

    # ---- simulación
    S = art.get("simulacion") or {}
    if S.get("partidos") and _num(S.get("xpts")):
        n = len(S["partidos"]) if isinstance(S["partidos"], list) else int(S["partidos"])
        diff = S["puntos"] - S["xpts"]
        if _EN:
            nota = "about right" if abs(diff) < 1 else f"earned {f1(abs(diff))} {'more' if diff >= 0 else 'fewer'}"
        else:
            nota = "lo justo" if abs(diff) < 1 else f"sumó {f1(abs(diff))} {'más' if diff >= 0 else 'menos'}"
        pts = [_pt(T("Puntos sumados", "Points earned"), str(S["puntos"]), nota=T(f"{n} partidos", f"{n} matches")),
               _pt(T("Puntos que merecía por su juego", "Points his play deserved"), f1(S["xpts"]), nota=nota)]
        if _num(S.get("dominio_medio")):
            pts.append(_pt(T("Su parte del xG del partido", "His share of match xG"), f"{f1(S['dominio_medio'], 0)}%", T("liga 50%", "league 50%")))
        # diferencia «real» si supera ~0.08 puntos por partido (y al menos 3 en total)
        umbral = max(3.0, 0.08 * n)
        idea = (T("Sumó más de lo que generó.", "Earned more than his play generated.") if diff > umbral else
                T("Sumó menos de lo que generó.", "Earned less than his play generated.") if diff < -umbral
                else T("Resultados acordes a su juego.", "Results in line with his play."))
        R["simulacion"] = (idea, pts)
    return R
