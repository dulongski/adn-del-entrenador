"""Reporte de entrega en formato de láminas horizontales (16:9): primero qué hace Coach DNA, después Almada como ejemplo.

Reusa los datos y las gráficas de build.py (sólo resultados agregados, nunca datos crudos) y escribe un HTML autocontenido
que se navega con flechas, clic o deslizando.

  python docs/reporte/slides.py   ->  docs/reporte/coach-dna-reporte.html  (+ publicar.html sin <head>)
"""
from __future__ import annotations

import base64
import json

import build as B
from build import (APP_URL, D, G, PLAN, TIEMPO, VALID, COMP, N, boot, esc, kpi_tile, legend,
                   chart_reparto, chart_familias, chart_etapas, chart_huella, chart_reparto_rasgos, chart_heat,
                   chart_dumbbell, chart_tiempo, chart_puntos, chart_cambios, chart_formaciones, chart_corner_zonas,
                   chart_corner_envios, chart_tablero, chart_reconoce, chart_mapa)

OUT = B.OUT
SLIDES: list[str] = []


def slide(id_, part, eyebrow, title, body, lede="", cls=""):
    """Una lámina: encabezado fijo arriba (etiqueta, título, «en esta lámina…»), cuerpo flexible y pie con logos."""
    head = f'<p class="eyebrow"><span>{esc(part)}</span>{esc(eyebrow)}</p>' if eyebrow else ""
    title = title or ""
    h = f'<h2>{esc(title)}</h2>' if title else ""
    ld = f'<p class="lede">{esc(lede)}</p>' if lede else ""
    SLIDES.append(f'<section class="slide {cls}" id="{id_}" aria-label="{esc(title or eyebrow or "Cierre")}"><header>{head}{h}{ld}</header>'
                  f'<div class="body">{body}</div></section>')


def fig(cap, chart, extra="", cls=""):
    c = f"<figcaption>{esc(cap)}</figcaption>" if cap else ""
    return f'<figure class="fig {cls}">{c}<div class="plot">{chart}</div>{extra}</figure>'


def build():
    M = G["muestra"]
    v = G["varianza_media"]
    H = {h["kpi"]: h for h in D["huella"]}
    A = {a["kpi"]: a for a in D["atribucion"]}
    S = D["simulacion"]
    bp_o, bp_d, bp_l = D["balon_parado"]["ofensivo"], D["balon_parado"]["defensivo"], D["balon_parado"]["liga"]
    tr_am = [x for x in D["transferencia"] if x["club"] == "América"][0]
    TR = G["transferencia_resumen"]
    sint = VALID["sintetico"]["realista"]
    ident = TIEMPO["dts"][B.DT_ID]["identidad"]
    tab = PLAN["tablero"]
    res10 = tab["resultados"]
    fich = PLAN["fichajes"]
    names = boot["nombres"]
    corto = lambda pid, full: names.get(str(pid), {}).get("corto", full)
    sal = A["salida_corta"]
    jug = D["jugadores"]
    jx = json.loads((B.DATA / f"jugadores_{B.DT_ID}.json").read_text())

    # ================================================================ PARTE 1: QUÉ HACEMOS
    SLIDES.append(f'''<section class="slide cover" id="inicio" aria-label="Portada">
  <div class="cover-band"></div>
  <p class="kicker">Hackathon Club América · ISAC 2026</p>
  <h1>Coach <span>DNA</span></h1>
  <p class="cover-q">Qué parte del estilo de un equipo es del entrenador y qué parte es de su plantilla, contado con datos y con un ejemplo: Guillermo Almada.</p>
  <div class="tiles">
    {kpi_tile(f'{M["partidos"]:,}', "partidos de Liga MX", "2021/22 a 2026/27")}
    {kpi_tile(f'{M["segmentos"]:,}', "tramos de partido", "sin cambios ni goles")}
    {kpi_tile(str(M["dts"]), "entrenadores", f'{M["jugadores_modelados"]} jugadores')}
    {kpi_tile("34", "indicadores de estilo", "con y sin balón")}
  </div>
  <p class="byline">Sebastian Dulong Salazar · octubre 2026 · <a href="{APP_URL}">Abrir la app</a></p>
</section>''')

    slide("problema", "Coach DNA", "El problema", "El estilo de un equipo mezcla al DT con sus jugadores", f'''
<div class="split">
  <div class="prose big">
    <p>Cuando un equipo presiona arriba, ¿es por la idea del entrenador o porque tiene delanteros rápidos? Un perfil de equipo normal no lo puede decir: suma todo junto.</p>
    <p>Si un DT llega a un club con jugadores que ya presionaban, el dato lo hace ver más presionante de lo que es. Si llega a un club sin esos jugadores, lo hace ver menos.</p>
  </div>
  <div class="stack">
    <div class="card"><p class="eyebrow-s">Lo que se ve</p><h4>El dato crudo</h4><p>Lo que hizo el equipo en sus partidos, comparado con la liga.</p></div>
    <div class="card hl"><p class="eyebrow-s">Lo que pone el DT</p><h4>La huella propia</h4><p>Lo que queda al quitar a los jugadores, al club, al rival y al contexto. Es lo que el DT se lleva a cualquier club.</p></div>
  </div>
</div>''', "En esta lámina planteamos la pregunta de fondo: cuánto de lo que vemos en un equipo lo decidió el entrenador.")

    preguntas = [("¿Cómo ataca y cómo defiende?", "Construcción, progresión, ocasiones, presión, organización y transiciones."),
                 ("¿Cambia según el partido?", "Rival, marcador, minuto y localía, contra la liga en la misma situación."),
                 ("¿Es constante en el tiempo?", "Sus rasgos torneo por torneo y de club en club."),
                 ("¿Cómo usa a sus jugadores?", "Dibujos, roles, rotación, cambios y su impacto."),
                 ("¿Qué hace a balón parado?", "Córners, tiros libres y saques en zona de peligro; marcaje y zonas débiles."),
                 ("¿Qué parte es suya?", "Separa al DT de su plantilla, club, rival y contexto."),
                 ("¿Lo merecía?", "Rejugamos cada partido con el xG de cada ocasión."),
                 ("¿Qué hago con esto?", "Seguimiento, fichajes y cómo jugarle.")]
    grid = "".join(f'<div class="card q{" hl" if i == 5 else ""}"><h4>{esc(a)}</h4><p>{esc(b)}</p></div>' for i, (a, b) in enumerate(preguntas))
    slide("responde", "Coach DNA", "Qué responde", "Ocho preguntas sobre cualquier entrenador, con evidencia", f'<div class="grid4">{grid}</div>',
          "En esta lámina están las preguntas que contesta Coach DNA. Todas se responden con los mismos datos y las mismas definiciones.")

    objetos = [("Posesión", "Posesión de StatsBomb en la que el equipo toca el balón al menos una vez."),
               ("Secuencia ofensiva", "Posesión que llega al último tercio rival (x ≥ 80 de 120)."),
               ("Acción progresiva", "Pase completado o conducción que gana al menos 25% de la distancia al arco."),
               ("Transición", "Posesión que empieza al recuperar; es rápida si llega al último tercio en 10 s."),
               ("Fase de presión", "Presiones encadenadas a 5 s o menos; alta si es en el tercio rival."),
               ("Línea defensiva (360)", "Altura media de los cuatro jugadores de campo más retrasados en cada foto 360."),
               ("Balón parado", "Córner, tiro libre en campo rival o saque en el último tercio, y la jugada que sigue."),
               ("Tramo", "Pedazo de partido sin cambios de jugadores ni de marcador, de 5 minutos o más.")]
    tb = "".join(f"<tr><th>{esc(a)}</th><td>{esc(b)}</td></tr>" for a, b in objetos)
    slide("marco", "Coach DNA", "Marco analítico", "Primero definimos cada objeto; todo lo demás sale de ahí", f'''
<div class="split wide-l">
  <table class="defs"><tbody>{tb}</tbody></table>
  <div class="stack">
    <div class="card"><h4>Supuestos</h4><ul><li>Cancha de 120 × 80; se ataca hacia la derecha.</li><li>Con pocos datos, la huella de un DT se acerca a cero.</li><li>El rival se mide por su propio estilo.</li></ul></div>
    <div class="card"><h4>Qué queda fuera</h4><ul><li>No hay tracking: el 360 es una foto por evento.</li><li>Antes de 2024 hay menos partidos con 360.</li><li>Entrenamientos, lesiones y vestidor.</li></ul></div>
  </div>
</div>''', "En esta lámina están las definiciones y los supuestos. Las 34 métricas, las gráficas y el modelo usan estos mismos objetos, así que no se contradicen.")

    slide("metodo", "Coach DNA", "Cómo separamos al DT", "Un método de economía laboral, aplicado al estilo de juego", f'''
<div class="steps">
  <div class="step"><span>1</span><h4>Partimos cada partido en tramos</h4><p>Pedazos de partido en los que no cambian los 22 jugadores ni el marcador.</p></div>
  <div class="step"><span>2</span><h4>Repartimos cada rasgo en piezas</h4><p>DT, club, jugadores en cancha, rival y contexto. Lo permiten los DTs que cambian de club y los jugadores que pasan por varios DTs.</p></div>
  <div class="step"><span>3</span><h4>Estimamos con estadística bayesiana</h4><p>Cada pieza empieza en cero y sólo se aleja si los datos lo justifican.</p></div>
</div>
<div class="grid3">
  <div class="card paper"><p class="eyebrow-s">La base</p><h4>Abowd, Kramarz y Margolis (1999), <i>Econometrica</i></h4><p>Separan cuánto gana un trabajador por mérito propio y cuánto por su empresa, siguiendo a quienes cambian de empleo.</p></div>
  <div class="card paper"><p class="eyebrow-s">El puente al futbol</p><h4>Muehlheusser et al. (2018), <i>J. of Sports Economics</i></h4><p>La misma idea con los entrenadores de la Bundesliga, para sus <b>resultados</b>. Nosotros la llevamos al <b>estilo</b>.</p></div>
  <div class="card paper"><p class="eyebrow-s">Jugadores en cancha</p><h4>Sill (2010), MIT Sloan Sports Analytics</h4><p>Del básquetbol: medir a cada jugador según quién está en la cancha, con un ajuste bayesiano.</p></div>
</div>''', "En esta lámina explicamos la idea sin fórmulas y los tres trabajos en los que nos basamos.")

    slide("liga", "Coach DNA", "Lo que encontramos en la liga", "El DT explica cerca del 14% de las diferencias de estilo", f'''
{fig("Qué explica que dos equipos jueguen distinto", chart_reparto(), f'<p class="note">Promedio de 34 indicadores. «Sin explicar» incluye el contexto, que en promedio aporta {v["ctx"] * 100:.0f}%.</p>', "flat")}
{fig("Parte de cada fase del juego que explica el DT: decide sobre todo el cómo; el xG y el OBV dependen más de los jugadores", chart_familias(), "", "grow")}''', "En esta lámina vemos el resultado para toda la liga. También podemos ver en qué fases pesa más el entrenador.")

    slide("confianza", "Coach DNA", "¿Podemos confiar?", "Tres pruebas de que el modelo sí separa al DT", f'''
<div class="grid3">
  <div class="card big-n"><b>{TR["ajustado"]["top10"] * 100:.0f}%</b><h4>Su estilo viaja</h4><p>En {TR["etapas"]} cambios de club, escondimos los partidos del club nuevo: el DT real queda entre los 10 primeros de 70 el {TR["ajustado"]["top10"] * 100:.0f}% de las veces. Al azar, {TR["azar"]["top10"] * 100:.0f}%.</p></div>
  <div class="card big-n"><b>{sint["modelo"]["media"]:.2f}</b><h4>Recupera lo que sembramos</h4><p>En datos simulados con un estilo de DT conocido, el modelo lo recupera con correlación {sint["modelo"]["media"]:.2f}. Un perfil de equipo normal, {sint["ingenuo"]["media"]:.2f}.</p></div>
  <div class="card big-n"><b>0</b><h4>No inventa estilos</h4><p>Si en la simulación no hay efecto de DT, el modelo devuelve casi cero. Un último ajuste aprovecha que los rasgos van juntos para afinar a los DTs con pocos partidos.</p></div>
</div>
{fig(f"Ejemplo: escondimos los {tr_am['partidos']} partidos de Almada en América. ¿En qué lugar lo pone el modelo entre 70 técnicos?", chart_reconoce(), "", "flat")}''', "En esta lámina resumimos cómo probamos el método antes de usarlo.")

    vistas = [("Resumen", "Su ADN en ideas, con número y percentil"), ("¿DT o plantilla?", "Qué parte de cada rasgo es suya"),
              ("Cómo juega", "Zonas, según el partido y en el tiempo"), ("Jugadores", "Dibujo, cambios y fichajes a su medida"),
              ("Balón parado", "Córners en 2D y 3D, tiros libres, saques y marcaje"), ("Laboratorio", "Rejugar partidos, llevarlo a otro club, simular el torneo"),
              ("Cara a cara", "Comparar, cómo jugarle y plan contra un rival"), ("Método", "El modelo, sus supuestos y sus pruebas")]
    vg = "".join(f'<div class="card v"><h4>{esc(a)}</h4><p>{esc(b)}</p></div>' for a, b in vistas)
    slide("app", "Coach DNA", "La herramienta", "Una app con ocho vistas para cualquiera de los 76 DTs", f'''
<div class="grid4">{vg}</div>
<p class="cta-row"><a class="cta" href="{APP_URL}">Abrir Coach DNA</a><span>También: mapa de estilos de la liga, asistente con IA (Golito) e informe PDF de cada vista.</span></p>''',
          "En esta lámina está lo que hay en la app. Todo sale del mismo modelo, así que un número de una vista coincide con el de otra.")

    # ================================================================ PARTE 2: ALMADA
    SLIDES.append(f'''<section class="slide divider" id="almada" aria-label="El ejemplo: Guillermo Almada">
  <p class="kicker">El ejemplo</p>
  <h1>Guillermo<br>Almada</h1>
  <p class="cover-q">Así se ve todo lo anterior aplicado a un entrenador: {D["partidos_total"]} partidos con Santos Laguna, Pachuca y América.</p>
</section>''')

    slide("quien", "Almada", "Quién es", "Tres clubes, una misma idea", f'''
{fig("", chart_etapas())}
<div class="split wide-r">
  <div class="prose">
    <p>Que haya cambiado de club es lo que permite separar su estilo del de sus jugadores. Además, el {D["identificabilidad"]["conectividad"] * 100:.0f}% de los minutos de sus jugadores son de futbolistas que también jugaron con otros técnicos.</p>
    <p>Su índice de separación es <b>{D["identificabilidad"]["indice"]:.0f} de 100</b>. Los DTs más parecidos a Almada son Gago, Demichelis y Mohamed.</p>
  </div>
  {fig("Mapa de estilos propios de los DTs de la liga", chart_mapa(), legend([("Almada", "dot-dt"), ("Su familia: presión alta y defensa adelantada", "dot-near"), ("Otros DTs", "dot-map")]))}
</div>''', "En esta lámina presentamos a Almada: por qué clubes pasó y dónde cae en el mapa de estilos de la liga.")

    pr = D["narrativa"]["principios"]
    ph = "".join(f'<div class="princ"><h4>{esc(p["titulo"])}</h4><p>{esc(p["descripcion"])}</p><p class="ev">{esc(p["evidencia"].split(" Dato técnico")[0])}</p></div>' for p in pr)
    slide("adn", "Almada", "Su ADN", "Seis rasgos que Almada lleva a cualquier club", f'<div class="grid3 princs">{ph}</div>',
          "En esta lámina están las ideas que más lo distinguen, cada una con su número contra la liga y su lugar entre los DTs.")

    slide("huella", "Almada", "Su huella propia", "Lo que queda de Almada al quitar a sus jugadores", fig("", chart_huella(), '<p class="note">Efecto propio en desviaciones típicas entre DTs. La línea fina es el margen de error al 95%.</p>'),
          "En esta lámina vemos todos sus rasgos marcados, ya sin el efecto de su plantilla, del club y de los rivales.")

    spec = [("salida_corta", -1, "Saca largo desde el portero"), ("ppda", -1, "Presiona (PPDA bajo)"), ("recuperaciones_altas_90", 1, "Roba en campo rival"),
            ("conduccion_prog", 1, "Avanza conduciendo"), ("altura_presion", 1, "Presiona muy arriba"), ("tiros_90", 1, "Tira mucho"),
            ("xg_balon_parado_90", 1, "Genera xG a balón parado")]
    slide("suyo", "Almada", "¿Suyo o de la plantilla?", "Su presión es suya; sus tiros y su balón parado vienen de sus jugadores", f'''
{fig("", chart_reparto_rasgos(spec), legend([(n, f"f-{c}") for _, n, c in COMP] + [("Sin explicar", "f-rs")]), "grow")}
<div class="grid2">
    <div class="card hl"><h4>Lo pone Almada</h4><p>La presión, el robo alto, sacar largo y avanzar conduciendo. De su salida larga, el {sal["coach"] / sal["observado"] * 100:.0f}% es suyo.</p></div>
    <div class="card hl2"><h4>Lo ponen sus jugadores</h4><p>La altura de la presión, el volumen de tiros y el xG a balón parado. Si cambian los jugadores, eso no viaja con Almada.</p></div>
</div>''', "En esta lámina repartimos cada rasgo entre las piezas del modelo. La raya negra es lo que se ve en sus partidos.")

    slide("con", "Almada", "Con balón", "Sale en largo y rompe líneas conduciendo", f'''
<div class="split wide-r">
  <div class="stack">
    <div class="tiles two">
      {kpi_tile(f'{H["salida_corta"]["crudo"]:.0f}%', "salida corta del portero", f'liga {H["salida_corta"]["liga"]:.0f}%')}
      {kpi_tile(f'{H["conduccion_prog"]["crudo"]:.0f}%', "progresión en conducción", f'liga {H["conduccion_prog"]["liga"]:.0f}%')}
      {kpi_tile(f'{H["progresivos"]["crudo"]:.1f}', "acciones progresivas por 100", f'liga {H["progresivos"]["liga"]:.1f}')}
      {kpi_tile(f'{H["field_tilt"]["crudo"]:.0f}%', "field tilt", f'liga {H["field_tilt"]["liga"]:.0f}%')}
      {kpi_tile(f'{H["xg_90"]["crudo"]:.2f}', "xG por 90", f'liga {H["xg_90"]["liga"]:.2f}')}
      {kpi_tile(f'{H["obv_90"]["crudo"]:.2f}', "OBV por 90", f'liga {H["obv_90"]["liga"]:.2f}')}
    </div>
    <p class="note">Tira mucho ({H["tiros_90"]["crudo"]:.1f} por 90) pero desde lejos: {H["xg_por_tiro"]["crudo"]:.2f} xG por tiro (liga {H["xg_por_tiro"]["liga"]:.2f}).</p>
  </div>
  {fig("Dónde progresa más que la liga (por partido)", chart_heat("progresion", "Progresión frente a la liga"), legend([("Más que la liga", "f-dt"), ("Menos", "f-neg")]), "pitchfig")}
</div>''', "En esta lámina vemos cómo sale desde atrás, cómo avanza y cómo genera ocasiones, con xG, OBV, acciones progresivas y field tilt.")

    slide("sin", "Almada", "Sin balón", "Recupera rápido y lejos de su arco", f'''
<div class="tiles four">
  {kpi_tile(f'{H["ppda"]["crudo"]:.1f}', "PPDA", f'liga {H["ppda"]["liga"]:.1f}')}
  {kpi_tile(f'{H["posesion_rival_dur"]["crudo"]:.1f} s', "dura la posesión rival", f'liga {H["posesion_rival_dur"]["liga"]:.1f} s')}
  {kpi_tile(f'{H["recuperaciones_altas_90"]["crudo"]:.1f}', "robos en campo rival por 90", f'liga {H["recuperaciones_altas_90"]["liga"]:.1f}')}
  {kpi_tile(f'{H["contraataque"]["crudo"]:.0f}%', "robos que acaban en contragolpe", f'liga {H["contraataque"]["liga"]:.0f}%')}
</div>
<div class="split even">
  {fig("Dónde recupera más que la liga", chart_heat("recuperaciones", "Recuperaciones frente a la liga"), "", "pitchfig")}
  {fig("Dónde presiona más que la liga", chart_heat("presion", "Presión frente a la liga"), legend([("Más que la liga", "f-dt"), ("Menos", "f-neg")]), "pitchfig")}
</div>''', "En esta lámina vemos cuánto y dónde presiona, dónde recupera y qué pasa justo después de robar.")

    slide("contexto", "Almada", "Según el partido", "Cuando gana, la liga suelta la presión; Almada no", f'''
<div class="grid3">
  {chart_dumbbell("Intensidad de presión según el marcador", "ppda", "marcador", -1)}
  {chart_dumbbell("Contragolpes según el minuto", "contraataque", "minuto", 1)}
  {chart_dumbbell("Intensidad de presión en casa y fuera", "ppda", "localia", -1)}
</div>
{legend([(N, "dot-dt"), ("Liga en la misma situación", "dot-liga")])}
<p class="note">Cero es el nivel habitual del equipo. Entre el 60 y el 75 su equipo contragolpea {D["contexto"]["curvas"]["minuto"]["contraataque"][2]["dt"]:+.1f} σ sobre lo normal. Viendo un solo partido, el modelo reconoce a Almada {D["identidad"]["lift"]:.0f} veces más seguido que al azar.</p>''',
          "En esta lámina comparamos cómo cambia su equipo según el marcador, el minuto y la localía, contra un equipo promedio en la misma situación.")

    slide("tiempo", "Almada", "A lo largo del tiempo", "Nueve torneos, la misma huella", f'''
{fig("", chart_tiempo(), legend([("En la dirección de su estilo", "f-dt"), ("En contra", "f-neg")]))}
<p class="note">Su perfil de un torneo se parece al de los demás con correlación {ident["r"]:.2f}: más estable que el {ident["pct"]:.0f}% de los DTs. En América, más acciones progresivas y una recuperación todavía más rápida.</p>''',
          "En esta lámina seguimos sus rasgos torneo por torneo, de Santos a América.")

    slide("jugadores", "Almada", "Sus jugadores", "4-2-3-1, mucha rotación y cambios que cierran el partido", f'''
<div class="split even">
  {fig("Dibujo con el que arranca", chart_formaciones())}
  <div class="tiles three">
    {kpi_tile(f'{jug["estabilidad_xi"]:.1f}', "titulares que cambia por partido", f'mediana DTs {jx["mediana_dts"]["rotacion"]:.1f}')}
    {kpi_tile(f"min {jug['minuto_cambios']['1']:.0f}", "su primer cambio", f"liga min {jug['minuto_cambios_liga']['1']:.0f}")}
    {kpi_tile(f'{D["impacto_cambios"][7]["neto"]:+.1f} σ', "xG en contra tras sus cambios", "baja más que con la liga")}
  </div>
</div>
{fig("Para qué usa sus cambios según el marcador", chart_cambios(), legend([("Más ofensivo", "f-dt"), ("Misma línea", "f-rs"), ("Más defensivo", "f-neg")]))}''',
          "En esta lámina vemos con qué dibujo arranca, cuánto rota y cuándo y para qué hace sus cambios.")

    slide("bp", "Almada", "Balón parado", "Córners al segundo palo y marcaje al hombre", f'''
<div class="split three-col">
  {fig("A dónde manda sus córners", chart_corner_zonas(), legend([(N, "f-dt"), ("Liga", "f-rs")]))}
  {fig("Dónde caen (grande: acabó en remate)", chart_corner_envios(), "", "pitchfig")}
  <div class="stack">
    <div class="tiles two">
      {kpi_tile(f'{bp_o["corners_por_partido"]:.1f}', "córners por partido", f'liga {bp_l["corners_por_partido"]:.1f}')}
      {kpi_tile(f'{bp_o["corner_corto_pct"]:.0f}%', "en corto", f'liga {bp_l["corner_corto_pct"]:.0f}%')}
    </div>
    <div class="card hl"><h4>En defensa</h4><p>Marca al hombre más que 99 de cada 100 DTs. Su punto débil es el área chica: concede 0.052 xG por córner que cae ahí (liga 0.035).</p></div>
  </div>
</div>''', "En esta lámina está su balón parado, a favor y en contra: a dónde manda los córners, cuánto peligro generan y cómo defiende.")

    slide("puntos", "Almada", "¿Merecía esos puntos?", f'{S["puntos"]} puntos reales, {S["xpts"]:.0f} merecidos: sus resultados se explican por su juego', f'''
{fig("Puntos acumulados: reales contra merecidos por el xG de cada ocasión", chart_puntos(), legend([("Puntos reales", "ln-dt-sw"), ("Merecidos por xG", "ln-liga-sw")]))}
<p class="note">Rejugamos cada partido 5,000 veces con la calidad de cada ocasión de los dos equipos. La simulación sirve para explicar, no para pronosticar. En sus últimos {tab["n"]} partidos con América: {res10["pts"][0]:.1f} puntos por partido, {res10["xpts"][0]:.2f} merecidos.</p>''',
          "En esta lámina usamos la simulación para separar mérito de suerte en sus resultados.")

    lig = "".join(f'<tr><th>{esc(corto(p["id"], p["nombre"]))}</th><td>{esc(p["pos"])}</td><td>{esc(p["club"])}</td><td class="num">{p["score"]:.1f}</td></tr>' for p in fich["liga"][:5])
    sum_ = ", ".join(corto(p["id"], p["nombre"]) for p in fich["suman"][:3])
    slide("america", "Almada", "Qué hacer: América", "Vigilar seis rasgos y fichar para el estilo", f'''
{fig(f"Seguimiento: últimos {tab['n']} partidos contra su rango normal (σ frente a la liga)", chart_tablero(), legend([("Últimos 10", "dot-dt"), ("Su nivel de carrera", "total-sw"), ("Rango normal", "f-band")]), "grow")}
<div class="grid2">
    <div class="card"><h4>Fichajes a la medida (jugadores de la liga que empujan su estilo)</h4><table class="list"><tbody>{lig}</tbody></table></div>
    <div class="card hl"><h4>En la plantilla</h4><p>Los que más suman a su idea: {esc(sum_)}. Hoy los seis rasgos están en su rango normal: el equipo ya juega como Almada.</p></div>
</div>''', "En esta lámina pasamos a las decisiones de su club: qué vigilar cada semana y qué perfiles fichar.")

    fases = json.loads((B.DATA / "plan.json").read_text())["fases"]
    cols = ""
    for f in ["con", "sin", "trans", "bp", "partido"]:
        items = [a for a in PLAN["acciones"] if a["fase"] == f]
        if items:
            lis = "".join(f'<li>{esc(a["titulo"].replace("{N}", N))}</li>' for a in items)
            cols += f'<div class="card plan"><h4>{esc(fases[f]["es"].replace("{N}", N))}</h4><ul>{lis}</ul></div>'
    slide("rival", "Almada", "Qué hacer: el rival", "Cómo jugarle a Almada", f'<div class="grid5">{cols}</div>'
          f'<p class="note">Cada recomendación sale de un rasgo propio de Almada que destaca contra la liga; en la app cada una trae el dato que la respalda y qué mirar durante el partido.</p>',
          "En esta lámina está el plan para un equipo que enfrente a Almada, ordenado por situación de juego.")

    slide("cierre", "", "", "", f'''
<div class="closing">
  <h1>Coach <span>DNA</span></h1>
  <p class="cover-q">Qué parte del estilo es del DT y qué parte de sus jugadores, para cualquier técnico de la liga, convertido en seguimiento, fichajes y un plan de partido.</p>
  <p class="cta-row"><a class="cta" href="{APP_URL}">Abrir la app</a></p>
  <div class="split even small">
    <div class="card"><h4>Límites</h4><ul><li>Es una descomposición estadística, no un experimento.</li><li>Sus 11 partidos en América se leen junto con su carrera.</li><li>xG y OBV son de StatsBomb.</li><li>Mostramos resultados agregados, nunca los datos.</li></ul></div>
    <div class="card"><h4>Referencias</h4><ul><li>Abowd, Kramarz y Margolis (1999), <i>Econometrica</i>.</li><li>Muehlheusser, Schneemann, Sliwka y Wallmeier (2018), <i>J. of Sports Economics</i>.</li><li>Fernández-Navarro et al. (2016), <i>J. of Sports Sciences</i>.</li><li>Sill (2010), MIT Sloan Sports Analytics Conference.</li></ul></div>
  </div>
</div>''', cls="end")


JS = r"""
(() => {
  const S = [...document.querySelectorAll('.slide')], n = S.length;
  const cnt = document.getElementById('cnt'), bar = document.getElementById('bar');
  document.documentElement.classList.add('js');
  let i = 0;
  const fit = () => { const sc = Math.min(innerWidth / 1600, (innerHeight - 52) / 900); document.documentElement.style.setProperty('--s', Math.max(sc, 0.2)); };
  const go = k => {
    i = Math.max(0, Math.min(n - 1, k));
    S.forEach((s, j) => { s.classList.toggle('on', j === i); s.setAttribute('aria-hidden', j === i ? 'false' : 'true'); });
    cnt.textContent = (i + 1) + ' / ' + n; bar.style.width = ((i + 1) / n * 100) + '%';
    try { history.replaceState(null, '', '#' + S[i].id); } catch (e) {}
  };
  addEventListener('resize', fit); fit();
  addEventListener('keydown', e => {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(i + 1); }
    if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(i - 1); }
    if (e.key === 'Home') go(0); if (e.key === 'End') go(n - 1);
  });
  document.getElementById('prev').onclick = () => go(i - 1);
  document.getElementById('next').onclick = () => go(i + 1);
  document.getElementById('toc').onchange = e => go(+e.target.value);
  let x0 = null;
  addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1)); x0 = null; });
  const h = location.hash.slice(1), k = S.findIndex(s => s.id === h);
  go(k >= 0 ? k : 0);
})();
"""


def main():
    build()
    toc = "".join(f'<option value="{k}">{k + 1}. {esc(s.split("aria-label=")[1].split(chr(34))[1])}</option>' for k, s in enumerate(SLIDES))
    logos = '<i class="logo logo-isac" role="img" aria-label="ISAC"></i><i class="logo logo-am" role="img" aria-label="Club América"></i>'
    slides = [s.replace("</section>", f'<footer class="sfoot">{logos}<span class="pg">{k + 1}</span></footer></section>', 1) if k else
              s.replace("</section>", f'<footer class="sfoot">{logos}</footer></section>', 1) for k, s in enumerate(SLIDES)]
    nav = (f'<nav class="ctrl" aria-label="Navegación"><button id="prev" type="button" aria-label="Lámina anterior">←</button>'
           f'<label class="sr" for="toc">Ir a</label><select id="toc">{toc}</select><span id="cnt"></span>'
           f'<button id="next" type="button" aria-label="Lámina siguiente">→</button><i class="prog"><i id="bar"></i></i></nav>')
    body = f'<main class="deck">{"".join(slides)}</main>{nav}<script>{JS}</script>'
    uri = lambda p, m: f"url(data:{m};base64,{base64.b64encode(p.read_bytes()).decode()})"
    css = (OUT / "slides.css").read_text() + ":root{--logo-isac:" + uri(OUT / "logos/isac.svg", "image/svg+xml") + ";--logo-am:" + uri(OUT / "logos/america.png", "image/png") + "}"
    head = ('<title>Coach DNA: Almada</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
            '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            '<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800;900&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">\n'
            f"<style>{css}</style>\n")
    (OUT / "coach-dna-reporte.html").write_text('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
                                                 + head + "</head><body>" + body + "</body></html>")
    (OUT / "publicar.html").write_text(head + body)
    print("ok", len(SLIDES), "láminas", len(body) // 1024, "KB")


if __name__ == "__main__":
    main()
