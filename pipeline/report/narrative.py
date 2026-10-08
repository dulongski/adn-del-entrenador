"""Narrativa analítica en español generada SOLO a partir de los resultados del artefacto.
Cada frase cita la métrica de la que sale (trazabilidad al marco analítico)."""
from __future__ import annotations

import numpy as np

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
    ("xg_balon_parado_90", 1): ("Balón parado como arma", "Genera más xG a balón parado que el promedio."),
}

DIM_ES = {"marcador": "el marcador", "minuto": "el minuto", "localia": "la localía", "rival": "la fuerza del rival"}
VAR_ES = {"local": "jugar de local", "fuerza_rival": "la fuerza del rival", "dif_goles_media": "ir ganando",
          "rival_presion": "que el rival presione", "rival_posesion": "que el rival quiera el balón",
          "rival_verticalidad": "que el rival sea vertical"}


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
    if abs(d) < 0.15:
        return "casi igual que la liga"
    w = mas if d > 0 else menos
    return (f"un poco {w}" if abs(d) < 0.6 else w if abs(d) < 1.2 else f"mucho {w}") + " que la liga"


def build(art: dict, glob: dict) -> dict:
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
            t, d = PRINCIPIOS[key]
            used.add(t)
            txt, u = _corto(h["kpi"], glob)
            pct_ = h.get("pct")
            puesto = ""
            if pct_ is not None:
                n_mas = round((100 - pct_) / 100 * (n_dts - 1)) if h["alpha"] > 0 else round(pct_ / 100 * (n_dts - 1))
                puesto = (" Ningún otro DT lo empuja tanto en esa dirección." if n_mas == 0 else
                          f" Solo 1 de {n_dts} DTs lo empuja más en esa dirección." if n_mas == 1 else
                          f" Solo {n_mas} de {n_dts} DTs lo empujan más en esa dirección." if n_mas <= n_dts // 4 else "")
            principios.append({
                "titulo": t, "descripcion": d, "kpi": h["kpi"],
                "evidencia": f"{txt}: {_val(h['crudo'], u)} en sus partidos, {_cmp(h['crudo'], h['liga'], sd.get(h['kpi']))} ({_val(h['liga'], u)})."
                             + puesto
                             + f" Dato técnico: efecto propio {sig(h['alpha'])}" + (f" ± {h['se']:.2f}" if h.get("se") else "") + ".",
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
    rango = f"entre {temps[0]} y {temps[-1]}" if len(temps) > 1 else (f"en {temps[0]}" if temps else "")
    clubes = ", ".join(f"{e['club']} ({e['partidos']})" for e in etapas)
    p = [f"{art['partidos_total']} partidos de Liga MX {rango}. " + (f"Clubes (partidos): {clubes}." if len(etapas) > 1 else f"Todos con {etapas[0]['club']}." if etapas else "")]
    if principios:
        p.append("Lo que más lo distingue, incluso con otros jugadores: " + _lista([x["titulo"].lower() for x in principios[:3]]) + ".")
    if ident:
        conn = f1(100 * ident.get("conectividad", 0), 0)
        if ident.get("indice", 0) >= 40:
            p.append(f"El {conn}% de los minutos de sus jugadores son de futbolistas que también jugaron con otros técnicos. "
                     "Por eso se puede separar bien lo que pone él de lo que ponen ellos.")
        else:
            p.append(f"Solo el {conn}% de los minutos de sus jugadores son de futbolistas que también jugaron con otros técnicos. "
                     "Separar su estilo del de su plantilla es difícil: toma estas conclusiones con cautela.")
    secciones.append({"id": "identidad", "titulo": "Quién es", "parrafos": p})

    # ---- fases: una frase por rasgo, en palabras y con la cifra de la liga al lado
    def linea(h):
        txt, u = _corto(h["kpi"], glob)
        frase = f"{txt}: {_val(h['crudo'], u)} en sus partidos, {_cmp(h['crudo'], h['liga'], sd.get(h['kpi']))} ({_val(h['liga'], u)})."
        f = FRASES.get((h["kpi"], 1 if h["alpha"] > 0 else -1))
        if f and strength(h) >= UMBRAL_IDEA:
            frase += f" Quitando a sus jugadores, {f}."
        return frase

    def fase_par(familias):
        hs = sorted([h for h in H if h["familia"] in familias], key=strength, reverse=True)[:3]
        return [linea(h) for h in hs]
    con = fase_par({"Construcción", "Progresión", "Ocasiones"})
    arqs = sorted([a for a in art.get("arquetipos", []) if a.get("dt_pct") is not None], key=lambda a: -(a["dt_pct"] - a["liga_pct"]))
    if arqs:
        a = arqs[0]
        con.append(f"La jugada que más repite comparado con la liga: «{a['nombre']}» ({f1(a['dt_pct'], 0)}% de sus ataques; liga {f1(a['liga_pct'], 0)}%).")
    secciones.append({"id": "ofensiva", "titulo": "Con balón", "parrafos": con})
    secciones.append({"id": "defensiva", "titulo": "Sin balón y transiciones", "parrafos": fase_par({"Presión", "Organización defensiva", "Transiciones"})})

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
        p.append("Lo que más se nota y pone él: " + _lista([_min(_corto(k, glob)[0]) for k, a in sorted(dom_coach, key=lambda t: -abs(t[1]['coach']))[:4]]) + ".")
    if dom_squad:
        p.append("Lo que más se nota pero viene de sus jugadores o del club: " + _lista([_min(_corto(k, glob)[0]) for k, a in sorted(dom_squad, key=lambda t: -abs(t[1]['player'] + t[1]['club']))[:4]]) + ".")
    for t in art.get("transferencia", []):
        p.append(f"Prueba en {t['club']}: escondimos sus {t['partidos']} partidos ahí y le pedimos al modelo que adivinara quién dirigía. "
                 f"Lo puso {t['rank_ajustado']}º entre {t['n_clases']} técnicos (al azar saldría cerca del {f1(t['rank_nulo'], 0)}º).")
    secciones.append({"id": "dt_vs_plantilla", "titulo": "¿Suyo o de la plantilla?", "parrafos": p})

    # ---- consistencia y contexto
    p = []
    if idn.get("lift"):
        p.append(f"Viendo un solo partido, el modelo adivina que es él {f1(idn['lift'])} veces más seguido que al azar.")
    if idn.get("dispersion_pct") is not None:
        dp = idn["dispersion_pct"]
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
        p.append(f"{_corto(k, glob)[0]}: comparado con la liga, sube {NIVEL_ES.get(hi[0], hi[0])} y baja {NIVEL_ES.get(lo[0], lo[0])}.")
    mot = art.get("contexto", {}).get("motores", {})
    if mot.get("posesion"):
        top = mot["posesion"][0]
        p.append(f"Lo que más mueve su posesión de un partido a otro es {VAR_ES.get(top['variable'], top['variable'])}: "
                 + ("cuando pasa, tiene más el balón." if top["direccion"] > 0 else "cuando pasa, tiene menos el balón."))
    secciones.append({"id": "contexto", "titulo": "Según el partido", "parrafos": p})

    # ---- jugadores
    J = art.get("jugadores", {})
    p = []
    if J.get("formaciones"):
        fs = sorted(J["formaciones"].items(), key=lambda t: -t[1])
        tot = sum(v for _, v in fs)
        p.append("Dibujos con los que arranca: " + ", ".join(f"{'-'.join(k)} ({100 * v / tot:.0f}%)" for k, v in fs[:3]) + ".")
    if J.get("estabilidad_xi") is not None:
        p.append(f"De un partido al siguiente cambia {f1(J['estabilidad_xi'])} titulares en promedio.")
    mc, ml = J.get("minuto_cambios", {}), J.get("minuto_cambios_liga", {})
    if mc.get("1") is not None:
        p.append(f"Su primer cambio llega en el minuto {f1(mc['1'], 0)} (liga: {f1(ml.get('1'), 0)}).")
    per = J.get("cambios_por_estado", {}).get("Perdiendo", {})
    if per and sum(per.values()) > 0:
        p.append(f"Cuando va perdiendo, {100 * per.get('Más ofensivo', 0) / sum(per.values()):.0f}% de sus cambios son para atacar más (un delantero por un defensa o medio).")
    imp = art.get("impacto_cambios", [])
    if imp:
        m = max(imp, key=lambda r: abs(r["neto"]))
        p.append(f"Después de sus cambios, el dato que más se mueve es «{_min(_corto(m['kpi'], glob)[0])}»: {'sube' if m['neto'] > 0 else 'baja'} respecto a lo normal en la liga.")
    top = J.get("jugadores", [])[:5]
    if top:
        p.append("Los que más minutos juegan con él: " + _lista([f"{j['nombre']} ({j['posicion'].lower()})" for j in top]) + ".")
    secciones.append({"id": "jugadores", "titulo": "Sus jugadores", "parrafos": p})

    # ---- balón parado
    B = art.get("balon_parado", {})
    o, d, l = B.get("ofensivo", {}), B.get("defensivo", {}), B.get("liga", {})
    p = []
    if o:
        z = max(o.get("corner_zonas", {}).items(), key=lambda t: t[1], default=(None, 0))
        p.append(f"A favor: {f1(o.get('corners_por_partido'))} córners por partido y {f1(o.get('corner_corto_pct'), 0)}% en corto (liga {f1(l.get('corner_corto_pct'), 0)}%). "
                 + (f"Los manda sobre todo al {z[0].lower()} ({f1(z[1], 0)}%). " if z[0] else "")
                 + f"Remata {f1(o.get('corner_remate_pct'), 0)}% de sus córners (liga {f1(l.get('corner_remate_pct'), 0)}%).")
    if d:
        p.append(f"En contra: cada 10 córners del rival le generan {f1(10 * (d.get('corner_xg') or 0), 2)} xG (liga {f1(10 * (l.get('corner_xg') or 0), 2)}). "
                 f"Gana el primer contacto en {f1(100 - (d.get('corner_primer_contacto_pct') or 0), 0)}% de ellos.")
    secciones.append({"id": "balon_parado", "titulo": "Balón parado", "parrafos": p})

    # ---- simulación
    S = art.get("simulacion", {})
    if S.get("partidos"):
        diff = S["puntos"] - S["xpts"]
        p = [f"Sumó {S['puntos']} puntos. Por las ocasiones que generó y concedió, lo normal habría sido {f1(S['xpts'])}"
             + (": sacó justo lo que mereció." if abs(diff) < 1 else f" ({f1(abs(diff))} {'más' if diff > 0 else 'menos'} de lo esperado)."),
             "Para saberlo, rejugamos cada partido 5,000 veces con la calidad (xG) de cada ocasión."]
        secciones.append({"id": "simulacion", "titulo": "¿Merecía esos puntos?", "parrafos": p})

    # ---- resumen escaneable por sección (idea + puntos); `parrafos` queda para el texto completo y el informe Markdown
    res = _resumenes(art, glob, H, strength, principios, dom_coach, dom_squad, best)
    for s in secciones:
        idea, puntos = res.get(s["id"], (SIN_RASGOS, []))
        s["idea"] = idea
        s["puntos"] = puntos

    titular = f"{nombre}: " + (" + ".join(x["titulo"] for x in principios[:3]) if principios else "perfil en construcción")
    return {"titular": titular, "principios": principios, "secciones": secciones}


def _lista(xs):
    xs = [x for x in xs if x]
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " y " + xs[-1] if xs else ""


# =====================================================================================
# Resumen escaneable por sección: {"idea": str, "puntos": [{texto, dato, liga, efecto, nota}]}
# =====================================================================================
SIN_RASGOS = "Nada lo aleja mucho del promedio de la liga."
NOTA_DT = "lo pone él"
NOTA_PLANTILLA = "viene de la plantilla"
NOTA_AMBOS = "él y su plantilla"

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
    "xg_balon_parado_90": ("xG a balón parado", " por 90"),
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

FAM_ES = {"Construcción": "la construcción", "Progresión": "la progresión", "Ocasiones": "la finalización",
          "Presión": "la presión", "Organización defensiva": "el bloque defensivo", "Transiciones": "las transiciones",
          "Dominio": "el dominio territorial", "Balón parado": "el balón parado"}
DIM_A = {"marcador": "al marcador", "minuto": "al minuto de juego", "localia": "a la localía", "rival": "a la fuerza del rival"}
NIVEL_ES = {"Perdiendo": "cuando pierde", "Empatando": "cuando empata", "Ganando": "cuando gana",
            "0-30'": "en el 0-30'", "30-60'": "en el 30-60'", "60-75'": "en el 60-75'",
            "75'+": "desde el 75'", "Local": "de local", "Visitante": "de visitante",
            "Rival débil": "ante rivales débiles", "Rival medio": "ante rivales medios", "Rival fuerte": "ante rivales fuertes"}
# Rasgos que dicen casi lo mismo: en una idea solo entra uno por grupo
GRUPO = {"salida_corta": "largo", "pase_largo": "largo", "posesion": "balon", "pases_por_posesion": "balon",
         "ppda": "presion", "altura_presion": "presion", "presion_alta": "presion", "intensidad_presion": "presion",
         "linea_360": "altura_def", "altura_defensiva": "altura_def", "llegada_area": "llegada",
         "entradas_ultimo_tercio": "llegada", "contraataque": "contra", "xg_transicion": "contra"}
UMBRAL_IDEA = 1.5  # misma señal mínima (α/EE) que exige un «principio»


def _num(x):
    return x is not None and not (isinstance(x, float) and not np.isfinite(x))


def _r(x, d=2):
    return round(float(x), d) if _num(x) else None


def _pt(texto, dato=None, liga=None, efecto=None, nota=None, kpi=None):
    return {"texto": texto, "dato": dato, "liga": liga, "efecto": _r(efecto), "nota": nota, "kpi": kpi}


def _corto(k, glob):
    if k in CORTO:
        return CORTO[k]
    et = glob["kpis"].get(k, {}).get("etiqueta", k)
    return et.split(" (")[0], ""


def _val(x, unit):
    return None if not _num(x) else f"{f1(x)}{unit}"


def _liga(x, unit):
    # la referencia de liga solo repite unidades cortas (%, yd, s); el resto va sin unidad
    return None if not _num(x) else f"liga {f1(x)}{unit if unit in ('%', ' yd', ' s') else ''}"


def _frase(partes):
    """Une frases verbales en una oración: «a», «a y b», «a, b y c». Primera letra en mayúscula."""
    partes = [p for p in partes if p]
    if not partes:
        return None
    txt = partes[0] if len(partes) == 1 else ", ".join(partes[:-1]) + " y " + partes[-1]
    return txt[0].upper() + txt[1:] + "."


def _idea_rasgos(hs, strength, max_palabras=12):
    """Idea a partir de las frases de los rasgos con señal clara. Evita repetir el verbo
    («presiona arriba y presiona…») y corta para no pasar de ~12 palabras."""
    partes, verbos, grupos = [], set(), set()
    for h in hs:
        if strength(h) < UMBRAL_IDEA:
            continue
        f = FRASES.get((h["kpi"], 1 if h["alpha"] > 0 else -1))
        g = GRUPO.get(h["kpi"], h["kpi"])
        if not f or f.split()[0] in verbos or g in grupos:
            continue
        if partes and len(" ".join(partes + [f]).split()) > max_palabras:
            break
        partes.append(f)
        verbos.add(f.split()[0])
        grupos.add(g)
        if len(partes) == 3:
            break
    return _frase(partes) or SIN_RASGOS


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
        return NOTA_DT
    if c_ok and s_ok:
        return NOTA_AMBOS
    if s_ok:
        return NOTA_PLANTILLA
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
    idea = (f"{art.get('partidos_total')} partidos en {n_cl} clubes." if n_cl > 1 else
            f"{art.get('partidos_total')} partidos, todos con {etapas_[0]['club']}." if etapas_ else "")
    if _num(ident.get("indice")):
        idea += (" Su estilo se distingue bien del de sus jugadores." if ident["indice"] >= 40
                 else " Cuesta separar su estilo del de sus jugadores.")
    idea = idea.strip() or SIN_RASGOS
    temps = art.get("temporadas") or []
    pts = [_pt("Partidos", str(art.get("partidos_total", "—")),
               nota=(f"{temps[0]} a {temps[-1]}" if len(temps) > 1 else (temps[0] if temps else None)))]
    etapas = art.get("etapas") or []
    if etapas:
        pts.append(_pt("Clubes" if len(etapas) > 1 else "Club", " → ".join(e["club"] for e in etapas)))
    if _num(ident.get("indice")):
        pts.append(_pt("Qué tan bien se separa de su plantilla", f"{f1(ident['indice'], 0)}/100",
                       nota="se separa bien" if ident["indice"] >= 40 else "cuesta separarlos"))
    if _num(idn.get("lift")):
        l = idn["lift"]
        pts.append(_pt("Se le reconoce viendo un partido", f"{f1(l)}×", "vs. adivinar al azar",
                       nota="muy marcado" if l >= 5 else "marcado" if l >= 2 else "poco distintivo"))
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
        pts.append(_pt(txt, _val(h.get("crudo"), u), _liga(h.get("liga"), u), a["coach"], NOTA_DT, k))
    for k, a in ds[:max(0, min(2, 5 - len(pts) - n_tr))]:
        txt, u = _corto(k, glob)
        h = hmap.get(k, {})
        pts.append(_pt(txt, _val(h.get("crudo"), u), _liga(h.get("liga"), u), a["player"] + a["club"], NOTA_PLANTILLA, k))
    if trs:
        orden = {e["club"]: i for i, e in enumerate(art.get("etapas") or [])}
        t = max(trs, key=lambda t: orden.get(t["club"], -1))  # la etapa más reciente
        ok = t["rank_ajustado"] <= max(3, t["n_clases"] // 10)
        pts.append(_pt(f"¿Lo reconocen en {t['club']}?", f"{t['rank_ajustado']}º de {t['n_clases']}",
                       f"al azar ≈ {f1(t.get('rank_nulo'), 0)}º", nota="sí, su estilo viaja" if ok else "le cuesta" if t["rank_ajustado"] > t.get("rank_nulo", 0) * 0.7 else "a medias"))

    def fam_top(lst, val):
        acc = {}
        for k, a in lst:
            fam = glob["kpis"].get(k, {}).get("familia")
            if fam in FAM_ES:
                acc[fam] = acc.get(fam, 0) + abs(val(a))
        return sorted(acc, key=lambda f: -acc[f])
    fc = fam_top(dc, lambda a: a["coach"])
    fs = [f for f in fam_top(ds, lambda a: a["player"] + a["club"]) if f not in fc[:1]]
    if fc and fs:
        idea = f"Su huella se nota más en {FAM_ES[fc[0]]} que en {FAM_ES[fs[0]]}."
    elif fc:
        idea = f"Su huella se nota sobre todo en {FAM_ES[fc[0]]}."
    elif fs:
        idea = f"Lo que se ve viene más de sus jugadores, sobre todo en {FAM_ES[fs[0]]}."
    else:
        idea = SIN_RASGOS
    R["dt_vs_plantilla"] = (idea, pts)

    # ---- contexto
    pts = []
    if _num(idn.get("acierto")) and idn.get("k"):
        pts.append(_pt("Adivinan que es él viendo un partido", f"{f1(100 * idn['acierto'], 0)}%",
                       f"al azar {f1(100 / idn['k'])}%"))
    dp = idn.get("dispersion_pct")
    if _num(dp):
        pts.append(_pt("Cuánto cambia entre partidos", "poco" if dp < 40 else "mucho" if dp > 60 else "lo normal",
                       nota=f"más que {f1(dp, 0)}% de los DTs"))
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
        pts.append(_pt(f"{_corto(k, glob)[0]} {NIVEL_ES.get(nivel, nivel)}",
                       ("mucho " if abs(d) >= 1 else "") + ("más" if d > 0 else "menos"), "que la liga", efecto=d))
        seen.add(k)
        if len(seen) == 2:
            break
    mot = (art.get("contexto") or {}).get("motores", {}).get("posesion") or []
    if mot:
        m = mot[0]
        pts.append(_pt("Lo que más cambia su posesión", VAR_ES.get(m["variable"], m["variable"]),
                       nota="tiene más el balón" if m["direccion"] > 0 else "tiene menos el balón"))
    if not _num(dp):
        idea = "Sin datos suficientes para medir su consistencia."
    elif dp < 40:
        idea = "Estilo estable: cambia poco de un partido a otro."
    elif dp > 60:
        idea = f"Estilo cambiante: se adapta mucho {DIM_A[top_dim]}." if top_dim else "Estilo cambiante: varía mucho de un partido a otro."
    else:
        idea = f"Variabilidad normal; se adapta sobre todo {DIM_A[top_dim]}." if top_dim else "Variabilidad normal entre partidos."
    R["contexto"] = (idea, pts)

    # ---- jugadores
    J = art.get("jugadores") or {}
    pts, partes = [], []
    fs_ = sorted((J.get("formaciones") or {}).items(), key=lambda t: -t[1])
    if fs_:
        tot = sum(v for _, v in fs_)
        dib, share = "-".join(fs_[0][0]), fs_[0][1] / tot
        pts.append(_pt("Dibujo más usado", dib, nota=f"{100 * share:.0f}% de los partidos"))
    est = J.get("estabilidad_xi")
    if _num(est):
        pts.append(_pt("Titulares que cambia por partido", f1(est),
                       nota="rota poco" if est < 2.0 else "rota mucho" if est > 2.8 else "lo normal"))
        # umbrales ≈ percentiles 25 y 75 de los DTs de la muestra (mediana ≈ 2.4)
        partes.append("rota poco el once" if est < 2.0 else "rota mucho el once" if est > 2.8 else None)
    if fs_:
        partes.append(f"juega casi siempre en {dib}" if share >= 0.7 else f"suele jugar en {dib}" if share >= 0.5
                      else f"alterna dibujos en torno al {dib}")
    mc, ml = J.get("minuto_cambios") or {}, J.get("minuto_cambios_liga") or {}
    m1, l1 = mc.get("1"), ml.get("1")
    if _num(m1):
        dif = m1 - l1 if _num(l1) else 0
        pts.append(_pt("Su primer cambio", f"min {f1(m1, 0)}", f"liga {f1(l1, 0)}" if _num(l1) else None,
                       nota="más tarde que la liga" if dif >= 3 else "antes que la liga" if dif <= -3 else None))
        partes.append("cambia tarde" if dif >= 3 else "cambia pronto" if dif <= -3 else None)
    per = (J.get("cambios_por_estado") or {}).get("Perdiendo") or {}
    if per and sum(per.values()) > 0:
        pts.append(_pt("Cambios para atacar cuando pierde", f"{100 * per.get('Más ofensivo', 0) / sum(per.values()):.0f}%"))
    imp = art.get("impacto_cambios") or []
    if imp:
        m = max(imp, key=lambda r: abs(r["neto"]))
        incierto = _num(m.get("se")) and abs(m["neto"]) < m["se"]
        pts.append(_pt(f"Tras sus cambios: {_min(_corto(m['kpi'], glob)[0])}", "sube" if m["neto"] > 0 else "baja", efecto=m["neto"],
                       nota="no es seguro" if incierto else None))
    R["jugadores"] = (_frase(partes) or "Sin datos suficientes sobre el uso de la plantilla.", pts[:5])

    # ---- balón parado
    B = art.get("balon_parado") or {}
    o, d, l = B.get("ofensivo") or {}, B.get("defensivo") or {}, B.get("liga") or {}
    pts = []
    if o:
        pts.append(_pt("Córners por partido", _val(o.get("corners_por_partido"), ""), _liga(l.get("corners_por_partido"), "")))
        pts.append(_pt("Córners en corto", _val(o.get("corner_corto_pct"), "%"), _liga(l.get("corner_corto_pct"), "%")))
        z = max((o.get("corner_zonas") or {}).items(), key=lambda t: t[1], default=None)
        if z:
            pts.append(_pt("A dónde los manda", z[0], nota=f"{z[1]:.0f}% de sus córners"))
    # xG por córner es un número muy pequeño: se expresa cada 10 córners para leerlo con 2 decimales
    x10 = lambda v: 10 * v if _num(v) else None
    if o:
        pts.append(_pt("Peligro cada 10 córners a favor (xG)", _val(x10(o.get("corner_xg")), ""), _liga(x10(l.get("corner_xg")), "")))
    if d:
        pts.append(_pt("Peligro cada 10 córners en contra (xG)", _val(x10(d.get("corner_xg")), ""), _liga(x10(l.get("corner_xg")), "")))

    def ratio(v):
        return v / l["corner_xg"] if _num(v) and _num(l.get("corner_xg")) and l["corner_xg"] > 0 else None
    ro, rd = ratio(o.get("corner_xg")), ratio(d.get("corner_xg"))
    ata = None if ro is None else ("saca mucho peligro de sus córners" if ro > 1.15 else "saca poco peligro de sus córners" if ro < 0.85 else None)
    dfn = None if rd is None else ("concede poco en los del rival" if rd < 0.85 else "sufre en los del rival" if rd > 1.15 else None)
    if ata or dfn:
        idea = _frase([ata or "ataca los córners como la liga",
                       dfn or ("defiende como la liga" if rd is not None else None)])
    elif o or d:
        idea = "Balón parado en la media de la liga."
    else:
        idea = "Sin datos de balón parado."
    R["balon_parado"] = (idea, pts)

    # ---- simulación
    S = art.get("simulacion") or {}
    if S.get("partidos") and _num(S.get("xpts")):
        n = len(S["partidos"]) if isinstance(S["partidos"], list) else int(S["partidos"])
        diff = S["puntos"] - S["xpts"]
        pts = [_pt("Puntos sumados", str(S["puntos"]), nota=f"{n} partidos"),
               _pt("Puntos que merecía por su juego", f1(S["xpts"]), nota="lo justo" if abs(diff) < 1 else f"sumó {f1(abs(diff))} {'más' if diff >= 0 else 'menos'}")]
        if _num(S.get("dominio_medio")):
            pts.append(_pt("Su parte del xG del partido", f"{f1(S['dominio_medio'], 0)}%", "liga 50%"))
        # diferencia «real» si supera ~0.08 puntos por partido (y al menos 3 en total)
        umbral = max(3.0, 0.08 * n)
        idea = ("Sumó más de lo que generó." if diff > umbral else
                "Sumó menos de lo que generó." if diff < -umbral else "Resultados acordes a su juego.")
        R["simulacion"] = (idea, pts)
    return R
