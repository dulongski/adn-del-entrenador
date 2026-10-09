/* Método: nota técnica con forma de artículo. Texto bilingüe con L(); números de boot.json
   (global + mapa) y de whatif.json (validación de «Llévalo a otro club»). */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import boot from '../boot.json'
import Info from '../Info'
import { dataUrl, fmt, getJSON, type Any } from '../lib'
import { L, LOCALE } from '../settings'
import { archLabel, famLabel, kpiDesc, kpiLabel, mapLabel } from '../i18n/data'
import {
  ArchBars, C, ConfoundFig, EventCurve, EventDots, Fig, TransplantForest, IdentHist, IdentPanels, IdentWeights, LambdaBars, LevelCompare,
  MapMini, MobilityNet, PitchGeometry, ShareLegend, SumSketch, SynthBars, TransferHist, VarianceChart, blockName,
} from '../metodo/figs'
import '../styles/metodo.css'

const SECS = [
  ['mt-abstract', L('Resumen', 'Abstract')],
  ['mt-s1', L('La pregunta', 'The question')],
  ['mt-s2', L('La idea', 'The idea')],
  ['mt-s3', L('El modelo', 'The model')],
  ['mt-s4', L('Qué medimos', 'What we measure')],
  ['mt-s5', L('Validación', 'Validation')],
  ['mt-s6', L('Otros modelos', 'Other models')],
  ['mt-s7', L('Límites', 'Limitations')],
  ['mt-refs', L('Referencias', 'References')],
] as const

const pct = (x: number, d = 0) => `${fmt(100 * x, d)}%`
const n = (x: number) => x.toLocaleString(LOCALE)

function Sec({ id, num, title, children, accent }: { id: string; num?: number; title: string; children: ReactNode; accent?: string }) {
  return (
    <section id={id} className="mt-sec" style={accent ? { ['--acc' as string]: accent } : undefined}>
      <h2 className="mt-h2">{num != null && <span className="mt-num">{num}</span>}{title}</h2>
      {children}
    </section>
  )
}

/** Nombre de indicador con su «i» pegada a la última palabra (no se queda sola en otra línea). */
function KpiName({ name, desc }: { name: string; desc: string }) {
  const i = name.lastIndexOf(' ')
  return <span>{i > 0 ? name.slice(0, i + 1) : ''}<span className="mt-nowrap">{i > 0 ? name.slice(i + 1) : name} <Info>{desc}</Info></span></span>
}

/** Un término de la ecuación, coloreado con su componente. */
function Term({ k, sym, sub, on, set }: { k: string; sym: ReactNode; sub?: ReactNode; on: string | null; set: (k: string | null) => void }) {
  const col = k === 'z' ? 'var(--ink)' : C[k as keyof typeof C]
  return (
    <span className={`mt-term${on === k ? ' on' : ''}${on && on !== k ? ' dim' : ''}`} style={{ ['--tc' as string]: col }}
      onMouseEnter={() => set(k)} onMouseLeave={() => set(null)}>
      <span className="mt-term-sym">{sym}{sub && <sub>{sub}</sub>}</span>
      <span className="mt-term-lab">{k === 'z' ? L('estilo', 'style') : blockName(k).toLowerCase()}</span>
    </span>
  )
}

export function Metodo({ glob }: { glob: Any }) {
  const mapa: Any = (boot as Any).mapa
  const F = glob.framework, M = glob.muestra, lam = glob.lambda as Record<string, number>
  const V = glob.varianza_media, R = glob.transferencia_resumen, TR = glob.transferencia as Any[]
  const K = TR[0]?.n_clases ?? 70
  const nKpi = Object.keys(glob.kpis).length
  const nBase = Object.keys(glob.kpis).filter(k => !k.startsWith('arq_')).length
  const seasons: string[] = M.temporadas
  const movers = (glob.dts as Any[]).filter(d => d.clubes.length > 1).length
  const idx = (glob.dts as Any[]).map(d => d.identificabilidad).sort((a, b) => a - b)
  const idxMed = idx.length ? idx[Math.floor(idx.length / 2)] : 0
  const pSign = R.ajustado.p_signo < 0.001 ? 'p < 0.001' : `p = ${fmt(R.ajustado.p_signo, 3)}`
  const byCoach = useMemo(() => Object.entries(glob.varianza as Record<string, Any>).sort((a, b) => b[1].coach - a[1].coach), [glob])
  const kl = (k: string) => kpiLabel(k, glob.kpis[k]?.etiqueta ?? k)
  const top = byCoach.filter(([k]) => !k.startsWith('arq_')).slice(0, 2)
  const low = byCoach.filter(([k]) => !k.startsWith('arq_')).slice(-2)

  // validación de «Llévalo a otro club» (archivo aparte; se carga al abrir la pestaña)
  const [wv, setWv] = useState<Any>(null)
  useEffect(() => { getJSON(dataUrl('whatif.json')).then(d => setWv(d.validacion), () => setWv(false)) }, [])
  // estudio de eventos «trasplante de estilo» (pipeline/models/transplant.py)
  const [tp, setTp] = useState<Any>(null)
  useEffect(() => { getJSON(dataUrl('transplant.json')).then(setTp, () => setTp(false)) }, [])
  const shortNames = useMemo(() => Object.fromEntries(Object.entries((boot as Any).nombres as Record<string, Any>).map(([k, v]) => [k, v.corto])), [])

  // índice con seguimiento de sección
  const [active, setActive] = useState<string>(SECS[0][0])
    useEffect(() => {
    const els = SECS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(es => {
      const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setActive(vis[0].target.id)
    }, { rootMargin: '-120px 0px -65% 0px' })
    els.forEach(e => io.observe(e))
    return () => io.disconnect()
  }, [])
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const [hov, setHov] = useState<string | null>(null)
  const fams: string[] = glob.familias
  const kp = Object.entries(glob.kpis as Record<string, Any>)

  const terms: { k: string; name: string; plain: string; tech: ReactNode }[] = [
    {
      k: 'z', name: L('Lo que queremos explicar', 'What we want to explain'),
      plain: L('El valor de un indicador k (por ejemplo, la PPDA) para un equipo durante un tramo s del partido.', 'The value of one indicator k (for example, PPDA) for one team during one segment s of a match.'),
      tech: <>{L('Estandarizado: z = (x − media de la liga) / σ, donde σ es la desviación típica ', 'Standardized: z = (x − league mean) / σ, where σ is the standard deviation ')}<b>{L('entre equipos-temporada', 'across team-seasons')}</b>{L('. Así, +1 equivale a una diferencia típica entre dos equipos de la liga. Los extremos se recortan a los percentiles 1 y 99.', '. So +1 equals a typical difference between two teams in the league. Extremes are clipped at the 1st and 99th percentiles.')}</>,
    },
    {
      k: 'coach', name: L('La huella del entrenador', "The coach's fingerprint"),
      plain: L('Un número por entrenador y por indicador. Vale lo mismo en todos sus partidos, dirija al club que dirija. Es lo que el resto de la app llama «estilo propio».', 'One number per coach and indicator. It takes the same value in all his matches, whichever club he is at. It is what the rest of the app calls his "own style".'),
      tech: <>{L('Efecto fijo: una variable 0/1 por entrenador. ', 'Fixed effect: one 0/1 variable per coach. ')}<b className="mono">λ = {fmt(lam.coach, 0)}</b>. {L('Error estándar por bootstrap de partidos (30 réplicas).', 'Standard error from a match bootstrap (30 replicates).')}</>,
    },
    {
      k: 'player', name: L('Los jugadores en cancha', 'The players on the pitch'),
      plain: L('Lo que aporta cada futbolista que estaba en cancha. Un lateral que sube mucho mueve la progresión por banda con cualquier entrenador.', 'What each player on the pitch contributes. A full-back who gets forward a lot pushes wide progression up under any coach.'),
      tech: <>{L('Un coeficiente β por jugador con ≥ 270 min; e es la fracción del tramo que estuvo en cancha. El resto se agrupa en «otros». Es la lógica del plus-minus ajustado (Macdonald, 2012). ', 'One coefficient β per player with ≥ 270 min; e is the share of the segment he was on the pitch. The rest are pooled as "others". This is the adjusted plus-minus logic (Macdonald, 2012). ')}<b className="mono">λ = {fmt(lam.player, 0)}</b>{L(`, la más fuerte: son ${n(M.jugadores_modelados)} jugadores y muchos juegan siempre juntos.`, `, the strongest: there are ${n(M.jugadores_modelados)} players and many always play together.`)}</>,
    },
    {
      k: 'club', name: L('Lo que es del club', 'What belongs to the club'),
      plain: L('Lo que el club pone sin importar quién lo dirija: estadio, altura, clima, forma de fichar, cultura.', 'What the club brings regardless of who manages it: stadium, altitude, climate, recruitment, culture.'),
      tech: <>{L('Efecto fijo por club. ', 'Club fixed effect. ')}<b className="mono">λ = {fmt(lam.club, 0)}</b>. {L('Se separa de α porque los clubes cambian de entrenador y los entrenadores de club.', 'It separates from α because clubs change coaches and coaches change clubs.')}</>,
    },
    {
      k: 'opp', name: L('El rival', 'The opponent'),
      plain: L('Lo que cambia por el rival. Contra un equipo que sale jugando desde atrás, cualquiera presiona distinto.', 'What changes because of the opponent. Against a team that builds from the back, anyone presses differently.'),
      tech: <>{L('Efecto fijo por rival y temporada (el rival de 2022 no es el de 2025). ', 'Opponent-by-season fixed effect (an opponent in 2022 is not the same team in 2025). ')}<b className="mono">λ = {fmt(lam.opp, 0)}</b>.</>,
    },
    {
      k: 'ctx', name: L('El momento del partido', 'The match situation'),
      plain: L('Local o visitante, ir ganando o perdiendo, jugar con uno más o uno menos, el minuto.', 'Home or away, winning or losing, playing with a man more or less, the minute.'),
      tech: <>{L('Seis variables: localía, fracción del tramo perdiendo, fracción ganando, diferencia de jugadores (acotada a ±2), minuto y minuto². ', 'Six variables: home, share of the segment spent losing, share spent winning, player difference (capped at ±2), minute and minute². ')}<b className="mono">λ = {fmt(lam.ctx, 0)}</b>{L(': casi sin encoger, porque están bien medidas.', ': barely shrunk, because they are measured precisely.')}</>,
    },
    {
      k: 'residual', name: L('Lo que no explicamos', 'What we do not explain'),
      plain: L('Todo lo demás: la suerte, el plan de ese día, el árbitro, lo que los datos no ven.', "Everything else: luck, that day's game plan, the referee, what the data cannot see."),
      tech: L('Error del tramo. En un solo tramo es grande (Figura 6); al juntar una temporada se promedia y casi desaparece.', 'Segment-level error. It is large for a single segment (Figure 6); over a season it averages out and mostly disappears.'),
    },
  ]

  const objects: [string, string][] = [
    [L('Posesión', 'Possession'), L(`Una posesión de StatsBomb en la que el equipo hace al menos ${F.posesion.min_own_ball_actions} acción con balón (pase, conducción, tiro o regate).`, `A StatsBomb possession in which the team makes at least ${F.posesion.min_own_ball_actions} on-ball action (pass, carry, shot or dribble).`)],
    [L('Acción progresiva', 'Progressive action'), L(`Pase completado o conducción de ≥ ${F.pase_progresivo.min_carry_length} yd que acerca el balón al arco al menos un ${100 * F.pase_progresivo.min_gain_ratio}% y termina en x ≥ ${F.pase_progresivo.min_end_x}.`, `A completed pass or a carry of ≥ ${F.pase_progresivo.min_carry_length} yd that brings the ball at least ${100 * F.pase_progresivo.min_gain_ratio}% closer to goal and ends at x ≥ ${F.pase_progresivo.min_end_x}.`)],
    [L('Transición', 'Transition'), L(`Posesión en juego abierto que empieza al recuperar el balón. Es rápida si llega al último tercio en ≤ ${F.transicion.window_s} s.`, `An open-play possession that starts with a regain. It is fast if it reaches the final third within ≤ ${F.transicion.window_s} s.`)],
    [L('Fase de presión', 'Pressing phase'), L(`Cadena de eventos Pressure del mismo equipo separados por ≤ ${F.presion.chain_gap_s} s. Alta si x ≥ ${F.presion.high_min_x}. Contrapresión: presión en los ${F.presion.counterpress_window_s} s siguientes a perder el balón.`, `A chain of the same team's Pressure events ≤ ${F.presion.chain_gap_s} s apart. High if x ≥ ${F.presion.high_min_x}. Counter-press: a pressure within ${F.presion.counterpress_window_s} s of losing the ball.`)],
    [L('Línea defensiva (360)', 'Defensive line (360)'), L(`Con el balón en poder del rival, distancia media a nuestra portería de los ${F.bloque_360.n_defenders} jugadores de campo más retrasados del freeze-frame (mínimo ${F.bloque_360.min_visible_defenders} visibles).`, `With the opponent on the ball, mean distance to our goal of the ${F.bloque_360.n_defenders} deepest outfield players in the freeze-frame (at least ${F.bloque_360.min_visible_defenders} visible).`)],
    [L('Balón parado', 'Set piece'), L(`Córner, tiro libre en campo rival o saque de banda con x ≥ ${F.balon_parado.throw_in_danger_min_x}. Dura hasta ${F.balon_parado.window_s} s o hasta que acaba la posesión.`, `Corner, free kick in the opponent's half, or throw-in at x ≥ ${F.balon_parado.throw_in_danger_min_x}. Lasts up to ${F.balon_parado.window_s} s or until the possession ends.`)],
    [L('Stint', 'Stint'), L('Intervalo del partido sin cambios en los 22 jugadores en cancha ni en el marcador.', 'A stretch of the match with no change in the 22 players on the pitch or in the score.')],
    [L('Tramo (segmento)', 'Segment'), L(`Stints consecutivos unidos hasta sumar ≥ ${F.stint.min_duration_s / 60} min. Es la fila del modelo: ${n(M.segmentos)} tramos-equipo.`, `Consecutive stints joined until they add up to ≥ ${F.stint.min_duration_s / 60} min. It is the model's row: ${n(M.segmentos)} team-segments.`)],
  ]

  const others: { t: string; acc: string; what: string; how: ReactNode; key: string[]; fig?: ReactNode }[] = [
    {
      t: L('Jugadas tipo', 'Signature plays'), acc: 'var(--c-dt)',
      what: L('Dice cómo crea peligro un equipo y con qué frecuencia usa cada camino. Sólo cuentan jugadas efectivas: posesiones en juego abierto que terminan en tiro o llegan al área (sin balón parado ni penales).', 'Tells how a team creates danger and how often it uses each route. Only effective moves count: open-play possessions that end in a shot or reach the box (no set pieces or penalties).'),
      how: L('Cada jugada se clasifica en dos ejes que no se pisan, un solo tipo por eje. Cómo se arma, por prioridad: recuperación en campo rival con remate en ≤ 14 s; contragolpe o ataque vertical (≤ 12 s, avanza ≥ 35 m, no de banda); balón largo (≥ 32 m hacia delante en las 3 primeras acciones); salida desde atrás (nace en su tercio); el resto, juego desde el medio campo. Cómo termina, por prioridad: centro o pase diagonal desde la banda; remate desde fuera del área; conducción o regate que mete el balón al área; el resto, pase al área por dentro. Se reporta el % de las jugadas efectivas de cada tipo frente a la liga y el percentil entre las estancias de ≥ 5 partidos. No es un modelo y no entra a la descomposición.', 'Each move is classified on two axes that do not overlap, one type per axis. How it is built, by priority: a win-back in the opponent half with a shot within ≤ 14 s; a counter-attack or vertical move (≤ 12 s, ≥ 35 m gained, not down the flank); a long ball (≥ 32 m forward in the first 3 actions); a build-up from the back (starts in its own third); otherwise, play from midfield. How it ends, by priority: a cross or diagonal pass from the flank; a shot from outside the box; a carry or dribble into the box; otherwise, a pass into the box through the middle. We report the % of effective moves of each type against the league and the percentile among spells of ≥ 5 matches. It is not a model and does not enter the decomposition.'),
      key: [L('5 + 4 tipos', '5 + 4 types'), L('2 ejes', '2 axes'), L('reglas', 'rules')],
    },
    {
      t: L('Bloque defensivo (360)', 'Defensive block (360)'), acc: 'var(--c-rival)',
      what: L('Muestra dónde se para un equipo cuando el rival tiene el balón, en cuatro situaciones: el rival sale desde su portería, está en el medio campo, ataca en nuestro tercio o contragolpea.', 'Shows where a team stands when the opponent has the ball, in four situations: the opponent builds from its own box, is in midfield, attacks in our third or counter-attacks.'),
      how: L('Cada evento del rival en juego abierto trae una foto 360 de dónde están los jugadores. Se miran los jugadores de campo del equipo que defiende, vistos desde su propia portería. La línea más adelantada y la gente cerca del balón se calculan con ≥ 6 jugadores visibles; la línea defensiva y el centro con ≥ 9; el ancho de la zaga y la forma del bloque sólo con los 10 y con la cámara viendo todo el ancho de la cancha (si no, los jugadores de banda quedan fuera de cuadro y el bloque sale angosto), por huecos (línea y puesto de izquierda a derecha) según la formación más usada del DT, porque el 360 no identifica jugadores. Distancias en metros reales (105 × 68). Mediana por partido, promedio ponderado por cuadros y percentil contra las demás estancias (≥ 5 partidos, ≥ 150 cuadros).', 'Every open-play opponent event comes with a 360 snapshot of where the players are. We look at the defending team\'s outfield players, seen from its own goal. The highest line and the players near the ball use ≥ 6 visible players; the defensive line and centre use ≥ 9; back-line width and the shape of the block use only frames with all 10 and the camera seeing the full width of the pitch (otherwise wide players fall out of frame and the block comes out narrow), by slot (line and left-to-right position) according to the coach\'s most used formation, because 360 data does not identify players. Distances in real metres (105 × 68). Median per match, frame-weighted average, and percentile against other spells (≥ 5 matches, ≥ 150 frames).'),
      key: ['360', L('4 situaciones', '4 situations'), L('mediana por partido', 'per-match median')],
    },
    {
      t: L('Formaciones', 'Formations'), acc: 'var(--c-plantilla)',
      what: L('Los once con más minutos de un club: la alineación típica, dónde se paran con el balón y dónde defienden.', 'The eleven players with the most minutes at a club: the typical line-up, where they stand with the ball and where they defend.'),
      how: L('Alineación: un once real (el partido que más se parece a los 11 con más minutos) sobre el dibujo estándar de su formación: no es una medición. Con balón y sin balón: forma medida con el 360 (los 10 jugadores de campo a la vista y cámara de banda a banda), ordenada en huecos por línea y de izquierda a derecha. Quién ocupa cada hueco sale del actor de cada evento (el único jugador con identidad en el 360): se asigna maximizando cuántas veces estuvo ahí; en promedio uno ve al jugador en su hueco ~35% de las veces (los vecinos de línea se intercambian), mucho más a nivel de línea.', 'Line-up: a real XI (the match closest to the 11 players with the most minutes) on the standard drawing of its formation: not a measurement. With and without the ball: shape measured with 360 data (all 10 outfield players in view and the camera touchline to touchline), sorted into slots by line and left to right. Who owns each slot comes from the actor of each event (the only player with an identity in 360 data), assigned to maximise how often he was there; on average a player is seen in his slot ~35% of the time (line neighbours swap), much more at line level.'),
      key: [L('3 vistas', '3 views'), '11 + GK'],
    },
    {
      t: L('Simulador de liga', 'League simulator'), acc: 'var(--c-ctx)',
      what: L('Juega el resto del torneo (o uno nuevo) con un DT en el club que elijas y su estilo editable; muestra cada partido minuto a minuto o miles de torneos de golpe.', 'Plays the rest of the tournament (or a new one) with a coach at the club you choose and his editable style; shows each match minute by minute or thousands of tournaments at once.'),
      how: L('Cada equipo: xG a favor y en contra del modelo «Llévalo a otro club» (DT + club + plantilla). Si cambias el estilo del DT, un puente ridge a nivel equipo-partido (R² de validación cruzada ≈ 0.30; es una asociación, no una causa) traduce el cambio en σ a xG. Goles de un partido: Poisson con λ = goles medios de la liga × ataque propio × defensa rival (local y visita por separado), repartidos por minuto con el patrón real de la liga, con autor según el xG por 90 de cada jugador; amarillas y rojas con sus tasas por jugador (una roja baja la tasa propia y sube la del rival). Calendario oficial del Apertura 2026; liguilla de 8 sin play-in, series de ida y vuelta (empate global: mejor ubicado; final con tiempos extra y penales). No hay sustituciones ni lesiones.', 'Each team: expected xG for and against from the "Move him to another club" model (coach + club + squad). If you change the coach\'s style, a team-match ridge bridge (cross-validated R² ≈ 0.30; an association, not a cause) turns the σ change into xG. Goals in a match: Poisson with λ = league mean goals × own attack × opposing defence (home and away separately), spread over minutes with the league\'s real pattern, scored by players in proportion to their xG per 90; yellow and red cards use per-player rates (a red lowers the side\'s rate and raises the rival\'s). Official Apertura 2026 schedule; top-8 playoffs with no play-in, two-leg ties (aggregate draw: better seed; final with extra time and penalties). No substitutions or injuries.'),
      key: ['Poisson', L('3,000 torneos', '3,000 tournaments'), 'R² ≈ 0.30'],
    },
    {
      t: L('Tipos de posesión', 'Possession types'), acc: 'var(--c-club)',
      what: L('Agrupa todas las posesiones en juego abierto en ocho tipos reconocibles. La frecuencia de cada tipo entra al modelo central como un indicador más.', 'Groups every open-play possession into eight recognizable types. The frequency of each type enters the main model as one more indicator.'),
      how: L('Mezcla gaussiana de covarianza completa sobre seis descriptores de cada posesión: dónde empieza, avance máximo, duración (log), pases (log), verticalidad y peligro. K se eligió en el codo del BIC entre 4 y 12.', 'A full-covariance Gaussian mixture on six descriptors of each possession: start, furthest point reached, duration (log), passes (log), directness and danger. K was chosen at the BIC elbow between 4 and 12.'),
      key: ['K = 8', 'GMM', 'BIC'],
      fig: <ArchBars arq={glob.arquetipos} label={archLabel} />,
    },
    {
      t: L('Mapa de estilos', 'Style map'), acc: 'var(--c-dt)',
      what: L('La portada. Ubica a cada entrenador según su huella propia (los α), así que dos puntos cercanos son dos entrenadores con ideas parecidas, ya descontadas sus plantillas.', 'The home page. It places each coach by his own fingerprint (the α values), so two nearby points are two coaches with similar ideas, with their squads already discounted.'),
      how: L(`PCA sobre los ${mapa.kpis.length} α estandarizados entre entrenadores. Los dos primeros ejes explican el ${pct(mapa.varianza_total)} de la variación y los tres primeros el ${pct(mapa.varianza_total_3d)}. Las familias salen de k-means en el plano, con K entre 4 y 6 elegido por silueta.`, `PCA on the ${mapa.kpis.length} α values standardized across coaches. The first two axes explain ${pct(mapa.varianza_total)} of the variation and the first three ${pct(mapa.varianza_total_3d)}. Families come from k-means on the plane, with K between 4 and 6 chosen by silhouette.`),
      key: [`K = ${mapa.k}`, `${L('silueta', 'silhouette')} ${fmt(mapa.silueta, 2)}`, 'PCA + k-means'],
      fig: <MapMini mapa={mapa} label={mapLabel} />,
    },
    {
      t: L('Contexto y motores', 'Context and drivers'), acc: 'var(--c-ctx)',
      what: L('Explica por qué un entrenador cambia de un partido a otro: si juega de visitante, contra un rival fuerte, perdiendo, o contra un entrenador que presiona.', 'Explains why a coach changes from one match to the next: playing away, against a strong opponent, while losing, or against a coach who presses.'),
      how: L('Curvas de estilo ajustado por marcador, minuto, localía y fuerza del rival frente a la liga en la misma situación. Además, un LightGBM poco profundo por entrenador cuyas variables son localía, fuerza del rival, diferencia de goles y el estilo del entrenador rival; SHAP reparte cada predicción entre esas variables.', 'Adjusted-style curves by score, minute, venue and opponent strength, against the league in the same situation. Also a shallow LightGBM per coach whose features are venue, opponent strength, goal difference and the opposing coach\'s style; SHAP splits each prediction among those features.'),
      key: [L('150 árboles', '150 trees'), L('4 hojas', '4 leaves'), 'lr 0.05', 'SHAP'],
    },
    {
      t: L('Rejugar partidos', 'Match replays'), acc: 'var(--c-rival)',
      what: L('Dice si el marcador fue justo con lo que pasó en la cancha. Sirve para explicar un resultado, no para predecir el siguiente.', 'Tells whether the scoreline was fair to what happened on the pitch. It explains a result; it does not predict the next one.'),
      how: L('Monte Carlo por posesión: cada posesión con tiros acaba en gol con probabilidad 1 − Π(1 − xG), con un máximo de un gol por posesión. De ahí salen la probabilidad de ganar, empatar y perder, los puntos esperados (xPts) y los marcadores más probables.', 'Possession-level Monte Carlo: each possession with shots ends in a goal with probability 1 − Π(1 − xG), at most one goal per possession. That gives win, draw and loss probabilities, expected points (xPts) and the most likely scores.'),
      key: [L('50,000 rejugadas', '50,000 replays'), 'xG StatsBomb'],
    },
    {
      t: L('Llévalo a otro club', 'Take him to another club'), acc: 'var(--c-plantilla)',
      what: L('Predice cómo jugaría un entrenador con otra plantilla y otro club, sumando las piezas del modelo central.', 'Predicts how a coach would play with another squad at another club by adding up the pieces of the main model.'),
      how: <>{L('Predicción aditiva: base + α del entrenador + φ del club + Σβ de los once titulares, en un contexto neutro. ', 'Additive prediction: baseline + coach α + club φ + Σβ of the starting eleven, in a neutral context. ')}
        {wv ? L(`En etapas reales reproduce el estilo observado con r = ${fmt(wv.dentro_muestra.correlacion_media, 2)}. En ${wv.fuera_muestra.n_mandatos} etapas que el modelo no vio, r = ${fmt(wv.fuera_muestra.correlacion_media, 2)}; sin el término del entrenador baja a ${fmt(wv.fuera_muestra.sin_dt.correlacion_media, 2)}.`,
          `On real spells it reproduces the observed style with r = ${fmt(wv.dentro_muestra.correlacion_media, 2)}. On ${wv.fuera_muestra.n_mandatos} spells the model never saw, r = ${fmt(wv.fuera_muestra.correlacion_media, 2)}; without the coach term it drops to ${fmt(wv.fuera_muestra.sin_dt.correlacion_media, 2)}.`)
          : wv === false ? '' : L('Cargando la validación…', 'Loading validation…')}</>,
      key: wv ? [`r ${L('dentro', 'in-sample')} ${fmt(wv.dentro_muestra.correlacion_media, 2)}`, `r ${L('fuera', 'out-of-sample')} ${fmt(wv.fuera_muestra.correlacion_media, 2)}`] : [L('aditivo', 'additive')],
    },
    {
      t: L('Roles de jugador', 'Player roles'), acc: 'var(--c-club)',
      what: L('Describe dónde actúa cada jugador y qué indicador mueve cuando está en cancha, ya descontado su entrenador.', 'Describes where each player acts and which indicator he moves when on the pitch, with his coach already discounted.'),
      how: L('Factorización no negativa (NMF) de mapas de calor de acciones de 12 × 8 celdas, como en los player vectors de Decroos y Davis (2019). La huella del jugador son sus β del modelo central.', 'Non-negative matrix factorization (NMF) of 12 × 8 action heatmaps, as in the player vectors of Decroos and Davis (2019). The player fingerprint is his β from the main model.'),
      key: ['NMF k = 10', '12 × 8'],
    },
  ]

  const refs: { id: string; t: ReactNode; url: string }[] = [
    { id: 'akm', t: <>Abowd, J. M., Kramarz, F. {L('y', '&')} Margolis, D. N. (1999). High wage workers and high wage firms. <i>Econometrica</i>, 67(2), 251–333.</>, url: 'https://www.econometricsociety.org/publications/econometrica/1999/03/01/high-wage-workers-and-high-wage-firms' },
    { id: 'agsu', t: <>Andrews, M. J., Gill, L., Schank, T. {L('y', '&')} Upward, R. (2008). High wage workers and low wage firms: negative assortative matching or limited mobility bias? <i>Journal of the Royal Statistical Society: Series A</i>, 171(3), 673–697.</>, url: 'https://ideas.repec.org/a/bla/jorssa/v171y2008i3p673-697.html' },
    { id: 'bs', t: <>Bertrand, M. {L('y', '&')} Schoar, A. (2003). Managing with style: The effect of managers on firm policies. <i>The Quarterly Journal of Economics</i>, 118(4), 1169–1208.</>, url: 'https://web.mit.edu/aschoar/www/ceostyle.pdf' },
    { id: 'bkg', t: <>Bridgewater, S., Kahn, L. M. {L('y', '&')} Goodall, A. H. (2011). Substitution and complementarity between managers and subordinates: Evidence from British football. <i>Labour Economics</i>, 18(3), 275–286.</>, url: 'https://doi.org/10.1016/j.labeco.2010.10.001' },
    { id: 'ddg', t: <>Dawson, P., Dobson, S. {L('y', '&')} Gerrard, B. (2000). Estimating coaching efficiency in professional team sports: Evidence from English association football. <i>Scottish Journal of Political Economy</i>, 47(4), 399–421.</>, url: 'https://ideas.repec.org/a/bla/scotjp/v47y2000i4p399-421.html' },
    { id: 'dd', t: <>Decroos, T. {L('y', '&')} Davis, J. (2019). Player vectors: Characterizing soccer players' playing style from match event streams. <i>ECML PKDD 2019</i>, 569–584.</>, url: 'https://doi.org/10.1007/978-3-030-46133-1_34' },
    { id: 'fn', t: <>Fernández-Navarro, J., Fradua, L., Zubillaga, A., Ford, P. R. {L('y', '&')} McRobert, A. P. (2016). Attacking and defensive styles of play in soccer: analysis of Spanish and English elite teams. <i>Journal of Sports Sciences</i>, 34(24), 2195–2204.</>, url: 'https://irep.ntu.ac.uk/id/eprint/40699' },
    { id: 'hk', t: <>Hoerl, A. E. {L('y', '&')} Kennard, R. W. (1970). Ridge regression: Biased estimation for nonorthogonal problems. <i>Technometrics</i>, 12(1), 55–67.</>, url: 'https://doi.org/10.1080/00401706.1970.10488634' },
    { id: 'll', t: <>Lundberg, S. M. {L('y', '&')} Lee, S.-I. (2017). A unified approach to interpreting model predictions. <i>Advances in Neural Information Processing Systems 30</i> (NeurIPS).</>, url: 'https://arxiv.org/abs/1705.07874' },
    { id: 'mac', t: <>Macdonald, B. (2012). Adjusted plus-minus for NHL players using ridge regression with goals, shots, Fenwick, and Corsi. <i>Journal of Quantitative Analysis in Sports</i>, 8(3).</>, url: 'https://doi.org/10.1515/1559-0410.1447' },
    { id: 'mssw', t: <>Muehlheusser, G., Schneemann, S., Sliwka, D. {L('y', '&')} Wallmeier, N. (2018). The contribution of managers to organizational success: Evidence from German soccer. <i>Journal of Sports Economics</i>, 19(6), 786–819.</>, url: 'https://ideas.repec.org/p/iza/izadps/dp8560.html' },
    { id: 'pst', t: <>Peeters, T., Szymanski, S. {L('y', '&')} Terviö, M. (2022). The survival of mediocre superstars in the labor market. <i>The Journal of Law, Economics, and Organization</i>, 38(3), 840–888.</>, url: 'https://tinbergen.nl/discussion-paper/4071/17-116-vii-the-survival-of-mediocre-superstars-in-the-labor-market' },
    { id: 'vov', t: <>van Ours, J. C. {L('y', '&')} van Tuijl, M. A. (2016). In-season head-coach dismissals and the performance of professional football teams. <i>Economic Inquiry</i>, 54(1), 591–604.</>, url: 'https://ideas.repec.org/p/cpr/ceprdp/10191.html' },
  ]

  return (
    <div className="mt">
      <nav className="mt-toc" aria-label={L('Contenido', 'Contents')}>
        <div className="mt-toc-h">{L('Contenido', 'Contents')}</div>
        {SECS.map(([id, t], i) => (
          <button key={id} aria-current={active === id} onClick={() => go(id)}>
            <span className="mono">{i === 0 || i === SECS.length - 1 ? '·' : i}</span>{t}
          </button>
        ))}
      </nav>

      <article className="mt-paper">
        {/* ------------------------------------------------------------ cabecera */}
        <header className="mt-head">
          <div className="mt-eyebrow">{L('Nota metodológica', 'Methods note')} · Coach DNA · ISAC 2026</div>
          <h1 className="mt-title">{L('Cómo separamos al entrenador de su plantilla', 'How we separate the coach from his squad')}</h1>
          <p className="mt-byline">{L(`Liga MX, temporadas ${seasons[0]} a ${seasons[seasons.length - 1]}. Datos de eventos y 360 de StatsBomb.`, `Liga MX, seasons ${seasons[0]} to ${seasons[seasons.length - 1]}. StatsBomb event and 360 data.`)}</p>
          <dl className="mt-facts">
            {[[n(M.partidos), L('partidos', 'matches')], [n(M.segmentos), L('tramos-equipo', 'team-segments')], [n(M.dts), L('entrenadores', 'coaches')], [n(M.jugadores_modelados), L('jugadores modelados', 'players modelled')], [nKpi, L('indicadores', 'indicators')], [seasons.length, L('temporadas', 'seasons')]].map(([v, l]) => (
              <div key={String(l)}><dt>{l}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </header>

        {/* ------------------------------------------------------------ resumen */}
        <section id="mt-abstract" className="mt-abstract">
          <div className="mt-abstract-txt">
          <div className="mt-abstract-k">{L('Resumen', 'Abstract')}</div>
          <p>
            <b>{L('Pregunta. ', 'Question. ')}</b>{L('¿Qué parte del estilo de juego de un equipo pone el entrenador y qué parte ponen sus jugadores? ', "How much of a team's playing style comes from its coach and how much from its players? ")}
            <b>{L('Método. ', 'Method. ')}</b>{L(`Escribimos cada uno de ${nKpi} indicadores de estilo, medido en ${n(M.segmentos)} tramos de partido, como la suma de seis aportes: entrenador, jugadores en cancha, club, rival, contexto y ruido. Es una regresión de efectos fijos del tipo que la economía usa para separar a un directivo de su empresa, estimada con penalización ridge.`, `We write each of ${nKpi} style indicators, measured over ${n(M.segmentos)} match segments, as the sum of six contributions: coach, players on the pitch, club, opponent, context and noise. It is a fixed-effects regression of the kind economists use to separate a manager from his firm, estimated with a ridge penalty.`)}{' '}
            <b>{L('Resultado. ', 'Result. ')}</b>{L(`Entre equipos-temporada, el entrenador explica en promedio el ${pct(V.coach)} de las diferencias de estilo y los jugadores el ${pct(V.player)}. Cuando ocultamos la etapa de un entrenador en un club y le pedimos al modelo que lo reconozca solo por cómo jugó su equipo, el entrenador verdadero queda en la mitad superior de ${K} candidatos en ${R.ajustado.mitad_superior} de ${R.etapas} etapas (por azar serían ${R.etapas / 2}; ${pSign}).`, `Across team-seasons, the coach explains on average ${pct(V.coach)} of the differences in style and the players ${pct(V.player)}. When we hide a coach's spell at one club and ask the model to recognize him only from how his team played, the true coach lands in the top half of ${K} candidates in ${R.ajustado.mitad_superior} of ${R.etapas} spells (chance would give ${R.etapas / 2}; ${pSign}).`)}
            {tp && <>{' '}{L(`Y en ${tp.n_eventos} cambios de entrenador, el equipo se mueve hacia la huella que el entrante mostró en otros clubes, más de lo que lo haría con un entrenador cualquiera (p = ${fmt(tp.sin_plantilla_todos.p_permutacion, 3)}, sección 5.5).`, `And across ${tp.n_eventos} coaching changes, the team moves toward the fingerprint the incoming coach showed at other clubs, more than it would with an arbitrary coach (p = ${fmt(tp.sin_plantilla_todos.p_permutacion, 3)}, section 5.5).`)}</>}
          </p>
          <p className="mt-kw"><b>{L('Palabras clave', 'Keywords')}:</b> {L('efectos fijos, modelo AKM, regresión ridge, estilo de juego, efecto del entrenador, Liga MX', 'fixed effects, AKM model, ridge regression, playing style, coach effect, Liga MX')}</p>
          </div>
          <dl className="mt-keys">
            <div style={{ ['--acc' as string]: 'var(--c-dt)' }}><dt>{L('de las diferencias de estilo entre equipos se debe al entrenador', 'of the style differences between teams is due to the coach')}</dt><dd>{pct(V.coach)}</dd></div>
            <div style={{ ['--acc' as string]: 'var(--c-plantilla)' }}><dt>{L('etapas ocultas en las que el modelo pone al entrenador verdadero en la mitad superior', 'hidden spells where the model ranks the true coach in the top half')}</dt><dd>{R.ajustado.mitad_superior}/{R.etapas}</dd></div>
            <div style={{ ['--acc' as string]: 'var(--c-club)' }}><dt>{L('correlación con el efecto verdadero en una liga simulada con confusión', 'correlation with the true effect in a simulated league with confounding')}</dt><dd>0.95</dd></div>
          </dl>
        </section>

        {/* ------------------------------------------------------------ 1 */}
        <Sec id="mt-s1" num={1} title={L('La pregunta y por qué es difícil', 'The question and why it is hard')} accent="var(--c-dt)">
          <div className="mt-two">
            <div className="mt-prose">
              <p>{L('Cuando un equipo presiona alto, la explicación más rápida es que su entrenador lo pide. Pero ese equipo también tiene jugadores rápidos o lentos, un estadio, una directiva que ficha de cierta manera, y cada semana enfrenta a un rival distinto con un marcador distinto. Todo eso deja huella en los mismos números.', 'When a team presses high, the quickest explanation is that its coach asks for it. But that team also has fast or slow players, a stadium, a board that signs players in a certain way, and every week it faces a different opponent with a different scoreline. All of that leaves a mark on the same numbers.')}</p>
              <p>{L('El problema de fondo es que el entrenador y su plantilla siempre aparecen juntos. Cada partido del entrenador es también un partido de sus jugadores, así que el promedio de sus partidos no puede decir de quién es el estilo. Además, los entrenadores piden fichajes que encajan con su idea, de modo que entrenador y plantilla empujan en la misma dirección.', 'The underlying problem is that the coach and his squad always appear together. Every match the coach plays is also a match his players play, so the average of his matches cannot tell whose style it is. On top of that, coaches ask for signings that fit their idea, so coach and squad push in the same direction.')}</p>
              <p>{L('En estadística esto se llama ', 'In statistics this is called ')}<b>{L('confusión', 'confounding')}</b>{L(': dos causas que se mueven juntas y que, mirando solo el resultado, no se pueden distinguir. Un perfil de estilo que no la resuelva le atribuye al entrenador lo que hacen sus jugadores.', ': two causes that move together and cannot be told apart by looking only at the outcome. A style profile that does not deal with it credits the coach with what his players do.')}</p>
            </div>
            <Fig n={1} title={L('Cinco cosas mueven el estilo que vemos. Entrenador y plantilla llegan siempre juntos, y el club influye en los dos.', 'Five things move the style we observe. Coach and squad always arrive together, and the club shapes both.')} note={L('Esquema.', 'Sketch.')}>
              <ConfoundFig />
            </Fig>
          </div>
        </Sec>

        {/* ------------------------------------------------------------ 2 */}
        <Sec id="mt-s2" num={2} title={L('La idea: aprender de los cambios de equipo', 'The idea: learning from moves between teams')} accent="var(--c-club)">
          <div className="mt-two">
            <div className="mt-prose">
              <p>{L('La economía tiene el mismo problema con las empresas. ¿Una empresa invierte mucho porque su director es agresivo o porque la empresa es así? ', 'Economics has the same problem with firms. Does a firm invest heavily because its CEO is aggressive, or because that is how the firm is? ')}<b>Bertrand {L('y', 'and')} Schoar (2003)</b>{L(' lo resolvieron siguiendo a directivos que cambiaron de empresa: si un director lleva la misma política a su nueva empresa, esa política es suya. A esa parte que viaja con la persona la llamaron ', ' answered it by following executives who changed firms: if a manager takes the same policy to his new firm, the policy is his. They called the part that travels with the person ')}<i>{L('estilo', 'style')}</i>.</p>
              <p>{L('La herramienta formal es de ', 'The formal tool comes from ')}<b>Abowd, Kramarz {L('y', 'and')} Margolis (1999)</b>{L(', que separaron el salario de cada trabajador en lo que se debe a la persona y lo que se debe a la empresa, aprovechando a quienes cambian de trabajo. Se le conoce como modelo AKM.', ', who split each worker\'s wage into what is due to the person and what is due to the firm, using the people who change jobs. It is known as the AKM model.')}</p>
              <p>{L('En el fútbol, ', 'In football, ')}<b>Muehlheusser {L('et al.', 'et al.')} (2018)</b>{L(' aplicaron AKM a la Bundesliga: los entrenadores alemanes cambian a menudo de club, y eso permite medir cuántos puntos aporta cada uno aparte de la calidad de su club. También encontraron que el entrenador cambia el estilo de juego. ', ' applied AKM to the Bundesliga: German coaches change clubs often, which makes it possible to measure how many points each one adds beyond the quality of his club. They also found that the coach changes the playing style. ')}<b>Peeters, Szymanski {L('y', 'and')} Terviö (2022)</b>{L(' usaron la misma lógica con cuatro décadas de entrenadores en Inglaterra. Antes, ', ' used the same logic with four decades of coaches in England. Earlier, ')}<b>Dawson, Dobson {L('y', 'and')} Gerrard (2000)</b>{L(' habían medido la eficiencia de los entrenadores con fronteras de producción, y ', ' had measured coaching efficiency with production frontiers, and ')}<b>Bridgewater, Kahn {L('y', 'and')} Goodall (2011)</b>{L(' mostraron que lo que aporta un entrenador depende del talento de su plantilla.', ' showed that what a coach adds depends on the talent of his squad.')}</p>
              <p>{L('Estos trabajos miden ', 'These studies measure ')}<b>{L('resultados', 'results')}</b>{L('. Nosotros usamos la misma idea para medir ', '. We use the same idea to measure ')}<b>{L('estilo', 'style')}</b>{L(', y le añadimos los jugadores en cancha para aprovechar también la rotación.', ', and add the players on the pitch so that rotation is used too.')}</p>
            </div>
            <div>
            <Fig n={2} title={L(`Red de movilidad de la muestra. Cada línea une a un entrenador con un club que dirigió; el grosor crece con los partidos. ${movers} de ${glob.dts.length} entrenadores con perfil dirigieron más de un club, y esas líneas conectan casi todos los clubes en una sola red.`, `Mobility network of the sample. Each line joins a coach to a club he managed; thickness grows with matches. ${movers} of ${glob.dts.length} profiled coaches managed more than one club, and those lines tie almost every club into a single network.`)} note={L('Pasa el cursor por un punto para ver el nombre.', 'Hover a dot to see the name.')}>
              <MobilityNet dts={glob.dts} />
            </Fig>
            <div className="mt-prose mt-after-fig">
              <h3 className="mt-h3">{L('Por qué importa la red', 'Why the network matters')}</h3>
              <p>{L('Un entrenador que dirigió dos clubes enlaza esos dos clubes. Si otro entrenador pasó por uno de ellos y por un tercero, el tercero queda enlazado también. Mientras más conectada la red, más comparaciones hay entre entrenadores que nunca coincidieron en un mismo club.', 'A coach who managed two clubs links those two clubs. If another coach passed through one of them and a third, the third is linked too. The more connected the network, the more comparisons exist between coaches who never shared a club.')}</p>
              <p>{L('Los puntos grises son entrenadores con un solo club. Para ellos solo quedan dos fuentes: jugadores que también jugaron con otros entrenadores, y la rotación. Por eso su huella es menos segura, y la app lo avisa con el índice de identificabilidad (sección 5.4).', 'Grey dots are coaches with a single club. For them only two sources remain: players who also played under other coaches, and rotation. That is why their fingerprint is less certain, and the app flags it with the identifiability index (section 5.4).')}</p>
            </div>
            </div>
          </div>
          <aside className="mt-callout mt-callout-wide" style={{ ['--acc' as string]: 'var(--c-club)' }}>
              <div className="mt-callout-k">{L('Qué significa «identificar»', 'What "identification" means')}</div>
              <p>{L('Un efecto está identificado cuando los datos traen suficientes comparaciones para separarlo de los demás. Si un entrenador hubiera dirigido siempre al mismo club con los mismos once jugadores, ningún método podría decir qué parte es suya: los datos serían idénticos con cualquier reparto.', 'An effect is identified when the data contain enough comparisons to separate it from the others. If a coach had always managed the same club with the same eleven players, no method could say which part is his: the data would look identical under any split.')}</p>
              <p>{L('Lo que lo hace posible son los cambios. Hay tres tipos, y el modelo usa los tres a la vez:', 'What makes it possible is change. There are three kinds, and the model uses all three at once:')}</p>
            </aside>
          <IdentPanels />
        </Sec>

        {/* ------------------------------------------------------------ 3 */}
        <Sec id="mt-s3" num={3} title={L('El modelo, término por término', 'The model, term by term')} accent="var(--c-plantilla)">
          <div className="mt-two">
            <div className="mt-prose">
              <h3 className="mt-h3">{L('Qué es una regresión, en una frase', 'What a regression is, in one sentence')}</h3>
              <p>{L('Una regresión reparte un número entre sus posibles causas. Supongamos que en un tramo de partido un equipo dio el 58% de los pases. Suponemos que ese 58% se arma sumando piezas: algo por el entrenador, algo por los jugadores que estaban en cancha, algo por el club, algo por el rival, algo por el marcador y el minuto, y un resto que no explicamos.', 'A regression splits a number among its possible causes. Say that in one stretch of a match a team made 58% of the passes. We assume that 58% is built by adding pieces: something from the coach, something from the players on the pitch, something from the club, something from the opponent, something from the score and the minute, and a remainder we cannot explain.')}</p>
              <p>{L(`El modelo no conoce el tamaño de cada pieza. Busca los tamaños que, a la vez, reproducen mejor los ${n(M.segmentos)} tramos observados. Como el mismo entrenador aparece con distintos jugadores y los mismos jugadores con distintos entrenadores, hay un solo reparto que encaja con todos los tramos al mismo tiempo.`, `The model does not know the size of each piece. It looks for the sizes that, all at once, best reproduce the ${n(M.segmentos)} observed segments. Because the same coach appears with different players and the same players with different coaches, only one split fits all segments at the same time.`)}</p>
            </div>
            <Fig n={3} title={L('Lo que hace el modelo: el valor observado en un tramo es la media de la liga más una pieza por cada causa. La regresión estima el tamaño de cada pieza.', 'What the model does: the value observed in a segment is the league average plus one piece per cause. The regression estimates the size of each piece.')} note={L('Esquema, sin datos.', 'Sketch, no data.')}>
              <SumSketch />
            </Fig>
          </div>

          <div className="mt-eq-wrap">
            <div className="mt-eq" aria-label={L('Ecuación del modelo', 'Model equation')}>
              <Term k="z" sym="z" sub="k,s" on={hov} set={setHov} />
              <span className="mt-op">=</span>
              <Term k="coach" sym="α" sub={L('DT', 'coach')} on={hov} set={setHov} />
              <span className="mt-op">+</span>
              <Term k="player" sym={<>Σ<sub className="mt-sub-j">j</sub> β<sub>j</sub>·e<sub>j,s</sub></>} on={hov} set={setHov} />
              <span className="mt-op">+</span>
              <Term k="club" sym="φ" sub="club" on={hov} set={setHov} />
              <span className="mt-op">+</span>
              <Term k="opp" sym="γ" sub={L('rival×temp', 'opp×season')} on={hov} set={setHov} />
              <span className="mt-op">+</span>
              <Term k="ctx" sym={<>δ·c<sub>s</sub></>} on={hov} set={setHov} />
              <span className="mt-op">+</span>
              <Term k="residual" sym="ε" sub="k,s" on={hov} set={setHov} />
            </div>
            <div className="mt-eq-note">{L(`Una ecuación por indicador k (${nKpi} en total) y una fila por tramo s y equipo. Pasa el cursor por un término o por una tarjeta.`, `One equation per indicator k (${nKpi} in all) and one row per segment s and team. Hover a term or a card.`)}</div>
          </div>
          <div className="mt-terms">
            {terms.map(t => {
              const col = t.k === 'z' ? 'var(--ink)' : C[t.k as keyof typeof C]
              return (
                <div key={t.k} className={`mt-tcard${hov === t.k ? ' on' : ''}`} style={{ ['--tc' as string]: col }} onMouseEnter={() => setHov(t.k)} onMouseLeave={() => setHov(null)}>
                  <div className="mt-tcard-k">{t.k === 'z' ? L('estilo', 'style') : blockName(t.k)}</div>
                  <div className="mt-tcard-t">{t.name}</div>
                  <p>{t.plain}</p>
                  <p className="mt-tech">{t.tech}</p>
                </div>
              )
            })}
          </div>

          <h3 className="mt-h3 mt-h3-gap">{L('Cómo se estima', 'How it is estimated')}</h3>
          <div className="mt-two mt-two-est">
            <ol className="mt-steps">
              <li><b>{L('La fila es el tramo.', 'The row is the segment.')}</b> {L(`Un stint es un intervalo sin cambios de jugadores ni de marcador. Los stints se unen hasta sumar al menos ${F.stint.min_duration_s / 60} minutos. Así cada fila tiene una alineación fija y un marcador fijo, y los cambios del entrenador abren filas nuevas.`, `A stint is a stretch with no change of players or score. Stints are joined until they add up to at least ${F.stint.min_duration_s / 60} minutes. Each row therefore has a fixed line-up and a fixed score, and the coach's substitutions open new rows.`)}</li>
              <li><b>{L('Los tramos con más acciones pesan más.', 'Segments with more actions weigh more.')}</b> {L('Peso w = d / (d + mediana de d), donde d es el denominador del indicador (por ejemplo, los pases del tramo para la posesión). Crece con la información y tiene techo, para que un tramo largo no domine.', 'Weight w = d / (d + median of d), where d is the indicator\'s denominator (for example, the passes in the segment for possession). It grows with information and has a ceiling, so a long segment does not dominate.')}</li>
              <li><b>{L('Ridge: encoger hacia la media.', 'Ridge: shrink toward the average.')}</b> {L('Sin freno, un entrenador con diez partidos podría recibir un efecto enorme por pura suerte. La penalización ridge (Hoerl y Kennard, 1970) hace que cada pieza arranque en cero, que es la media de la liga, y solo se aleje si muchos tramos lo piden. Se minimiza', 'Left unchecked, a coach with ten matches could get a huge effect by pure luck. The ridge penalty (Hoerl and Kennard, 1970) makes every piece start at zero, the league average, and move away only when many segments call for it. We minimize')}
                <span className="mt-math">Σ<sub>s</sub> w<sub>s</sub>(z<sub>s</sub> − ẑ<sub>s</sub>)² + Σ<sub>b</sub> λ<sub>b</sub>‖θ<sub>b</sub>‖²</span>
                {L('con una λ por bloque. Una λ más grande exige más evidencia.', 'with one λ per block. A larger λ demands more evidence.')}</li>
            </ol>
            <div>
            <ol className="mt-steps" style={{ counterReset: 'st 3' }}>
              <li><b>{L('Las λ se eligen por validación cruzada.', 'The λ values are chosen by cross-validation.')}</b> {L('Tres pliegues agrupados por partido (un partido nunca está a la vez en entrenamiento y prueba), sobre 8 indicadores y una rejilla de valores. El error es casi plano cerca del óptimo. Las λ elegidas encogen más a los jugadores que al entrenador; en la parte que los datos no logran separar, eso le da la señal a la plantilla. Es una elección conservadora: al entrenador solo se le atribuye lo que los datos respaldan.', 'Three folds grouped by match (a match is never in training and test at once), on 8 indicators and a grid of values. The error is nearly flat near the optimum. The chosen λ values shrink players more than the coach; in the part the data cannot separate, that hands the signal to the squad. It is a conservative choice: the coach is only credited with what the data support.')}</li>
              <li><b>{L('Incertidumbre por bootstrap.', 'Uncertainty by bootstrap.')}</b> {L('Se remuestrean partidos completos 30 veces y se reajusta todo. La dispersión de α entre réplicas da su error estándar y su intervalo de confianza del 95%. Se remuestrea por partido, y no por tramo, porque los tramos de un mismo partido se parecen entre sí.', 'Whole matches are resampled 30 times and everything is refit. The spread of α across replicates gives its standard error and 95% confidence interval. We resample matches rather than segments because segments of the same match resemble each other.')}</li>
            </ol>
              <Fig n={4} title={L('Penalización ridge por bloque, elegida por validación cruzada (escala logarítmica). Más larga = más evidencia exigida antes de alejarse de la media.', 'Ridge penalty by block, chosen by cross-validation (log scale). Longer = more evidence required before moving away from the average.')}>
                <LambdaBars lam={lam} />
              </Fig>
            </div>
          </div>
        </Sec>

        {/* ------------------------------------------------------------ 4 */}
        <Sec id="mt-s4" num={4} title={L('Qué medimos', 'What we measure')} accent="var(--c-rival)">
          <div className="mt-two">
            <div>
              <div className="mt-prose">
                <p>{L('Todas las definiciones y umbrales viven en un solo archivo (', 'Every definition and threshold lives in a single file (')}<code>config/framework.yaml</code>{L('). Cada indicador, gráfico y modelo de la app sale de esos mismos objetos. Las coordenadas son las de StatsBomb: una cancha de 120 × 80 yardas en la que el equipo que actúa ataca siempre hacia la derecha.', '). Every indicator, chart and model in the app is built from those same objects. Coordinates are StatsBomb\'s: a 120 × 80 yard pitch on which the acting team always attacks to the right.')}</p>
                <p>{L('Cada indicador es un cociente entre dos contadores por stint, un numerador y un denominador. Para pasar a partido, temporada o entrenador se suman numeradores y denominadores por separado (Σnum / Σden) en vez de promediar cocientes. Por eso un mismo número coincide en el informe, en los gráficos y en el modelo.', 'Every indicator is a ratio of two per-stint counters, a numerator and a denominator. To move to match, season or coach level, numerators and denominators are summed separately (Σnum / Σden) instead of averaging ratios. That is why a number matches across the report, the charts and the model.')}</p>
              </div>
              <div className="mt-objs">
                {objects.map(([t, d]) => <div key={t} className="mt-obj"><div className="mt-obj-t">{t}</div><p>{d}</p></div>)}
              </div>
            </div>
            <Fig n={5} title={L('Los umbrales del marco sobre la cancha. Las líneas verticales son los cortes que usan los indicadores; el área sombreada a la derecha es el último tercio.', 'The framework thresholds on the pitch. Vertical lines are the cut-offs the indicators use; the shaded area on the right is the final third.')}>
              <PitchGeometry F={F} />
            </Fig>
          </div>

          <h3 className="mt-h3 mt-h3-gap">{L(`Los ${nKpi} indicadores`, `The ${nKpi} indicators`)} <Info wide>{L(`Las familias siguen las fases del juego y el catálogo de estilos de Fernández-Navarro et al. (2016). Los ${nKpi - nBase} indicadores de «Jugadas tipo» son la frecuencia de cada tipo de posesión (sección 6). Junto a cada indicador va su media en la liga ± la desviación típica entre equipos-temporada, que es la unidad σ de toda la app.`, `Families follow the phases of play and the style catalogue of Fernández-Navarro et al. (2016). The ${nKpi - nBase} "Possession types" indicators are the frequency of each possession type (section 6). Next to each indicator is its league mean ± the standard deviation across team-seasons, which is the σ unit used throughout the app.`)}</Info></h3>
          <p className="mt-lede">{L('Pasa el cursor por la «i» para ver cómo se calcula cada uno. A la derecha: media de la liga ± una σ entre equipos.', 'Hover the "i" to see how each one is computed. On the right: league mean ± one σ between teams.')}</p>
          <div className="mt-fams">
            {fams.map((f, fi) => {
              const ks = kp.filter(([, v]) => v.familia === f)
              if (!ks.length) return null
              const accs = ['var(--c-dt)', 'var(--c-club)', 'var(--c-ctx)', 'var(--c-plantilla)', 'var(--c-dt)', 'var(--c-rival)', 'var(--c-club)', 'var(--c-ctx)', 'var(--c-plantilla)']
              return (
                <div key={f} className="mt-fam" style={{ ['--acc' as string]: accs[fi % accs.length] }}>
                  <div className="mt-fam-h">{f === 'Arquetipos' ? L('Tipos de posesión', 'Possession types') : famLabel(f)} <span className="mono">{ks.length}</span></div>
                  {ks.map(([k, v]) => (
                    <div key={k} className="mt-kpi">
                      <KpiName name={f === 'Arquetipos' ? archLabel(glob.arquetipos?.[k.replace('arq_', '')]?.nombre ?? v.etiqueta) : kpiLabel(k, v.etiqueta)} desc={kpiDesc(k, v.descripcion)} />
                      {f !== 'Arquetipos' && <span className="mono mt-kpi-v">{fmt(v.media, v.media < 2 ? 2 : 1)} <small>± {fmt(v.sd, v.sd < 1 ? 2 : 1)}</small></span>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </Sec>

        {/* ------------------------------------------------------------ 5 */}
        <Sec id="mt-s5" num={5} title={L('Resultados que validan el método', 'Results that validate the method')} accent="var(--c-ctx)">
          <h3 className="mt-h3"><span className="mt-subnum">5.1</span>{L('¿Cuánto del estilo es del entrenador?', 'How much of style belongs to the coach?')}</h3>
          <div className="mt-two mt-two-var">
            <div className="mt-prose">
              <p>{L('Para cada indicador promediamos tanto lo observado como cada pieza del modelo por equipo y temporada, y medimos qué parte de las diferencias entre equipos sigue a cada pieza:', 'For each indicator we average both the observed value and each model piece by team and season, and measure which share of the differences between teams follows each piece:')}</p>
              <span className="mt-math mt-math-c">{L('parte', 'share')}<sub>b</sub> = cov({L('pieza', 'piece')}<sub>b</sub>, {L('observado', 'observed')}) / var({L('observado', 'observed')})</span>
              <p>{L('Las partes suman 100%. Una parte puede salir negativa si esa pieza empuja en contra de las demás. Ocurre con el contexto en la posesión: los equipos que más tienen el balón pasan más tiempo ganando, y quien va ganando suele cederlo.', 'The shares add up to 100%. A share can be negative when that piece pushes against the others. It happens with context in possession: the teams that keep the ball most spend more time winning, and teams that are winning tend to give the ball up.')}</p>
            </div>
            <div className="mt-prose">
              <p>{L(`En promedio, el entrenador explica el ${pct(V.coach)}, los jugadores el ${pct(V.player)}, el club el ${pct(V.club)} y el rival el ${pct(V.opp)}. El entrenador pesa más en cómo se mueve el balón (${kl(top[0][0]).toLowerCase()}: ${pct(top[0][1].coach)}; ${kl(top[1][0]).toLowerCase()}: ${pct(top[1][1].coach)}) y menos en el peligro que se genera (${kl(low[1][0])}: ${pct(low[1][1].coach)}; ${kl(low[0][0])}: ${pct(low[0][1].coach)}), que depende más de la calidad de los jugadores.`, `On average, the coach explains ${pct(V.coach)}, the players ${pct(V.player)}, the club ${pct(V.club)} and the opponent ${pct(V.opp)}. The coach weighs most on how the ball moves (${kl(top[0][0]).toLowerCase()}: ${pct(top[0][1].coach)}; ${kl(top[1][0]).toLowerCase()}: ${pct(top[1][1].coach)}) and least on the danger created (${kl(low[1][0])}: ${pct(low[1][1].coach)}; ${kl(low[0][0])}: ${pct(low[0][1].coach)}), which depends more on player quality.`)}</p>
              <p>{L('Un 15% puede parecer poco. Es la parte que viaja con el entrenador a cualquier club y la que se estima con más cautela, porque el ridge la encoge. Los jugadores explican más porque son once, cambian de un equipo a otro y cada uno trae lo suyo.', 'Fifteen per cent may look small. It is the part that travels with the coach to any club and the one estimated most cautiously, because ridge shrinks it. Players explain more because there are eleven of them, they differ a lot between teams and each brings his own traits.').replace('15%', pct(V.coach)).replace('Fifteen per cent', pct(V.coach))}</p>
              <Fig n={6} title={L('El nivel importa. En un solo tramo casi todo es ruido; al juntar una temporada el ruido se cancela y aparecen el entrenador, los jugadores y el club. Promedio de los indicadores.', 'Level matters. In a single segment almost everything is noise; over a season the noise cancels out and the coach, the players and the club appear. Average across indicators.')}>
                <LevelCompare glob={glob} />
              </Fig>
            </div>

          </div>
          <Fig n={7} className="mt-fig-var mt-fig-wide" title={L('Reparto de las diferencias de estilo entre equipos-temporada, por indicador, ordenado por la parte del entrenador (columna derecha).', 'Split of the style differences between team-seasons, by indicator, sorted by the coach share (right column).')} note={L('Pasa el cursor por una fila para ver los números.', 'Hover a row to see the numbers.')}>
              <ShareLegend />
              <VarianceChart glob={glob} />
            </Fig>

          <h3 className="mt-h3 mt-h3-gap"><span className="mt-subnum">5.2</span>{L('Prueba de transferencia: ¿lo reconocemos en otro club?', 'Transfer test: can we recognize him at another club?')}</h3>
          <div className="mt-two">
            <div className="mt-prose">
              <p>{L('Si el estilo es del entrenador, debería reconocerse cuando dirige a otra plantilla. Lo probamos con cada entrenador que dirigió al menos dos clubes con 8 partidos o más en cada uno:', 'If the style belongs to the coach, it should be recognizable when he manages another squad. We tested it on every coach who managed at least two clubs with 8 or more matches at each:')}</p>
              <ol className="mt-steps mt-steps-tight">
                <li>{L('Quitamos de la muestra todos sus partidos en uno de esos clubes.', 'We remove all his matches at one of those clubs from the sample.')}</li>
                <li>{L('Reajustamos el modelo completo sin esos partidos, para que no se filtre información.', 'We refit the full model without those matches, so no information leaks.')}</li>
                <li>{L(`Calculamos el estilo medio de los partidos ocultos, sin club, jugadores, rival ni contexto, y lo comparamos (correlación) con el perfil de cada uno de los ${K} entrenadores candidatos. El perfil del entrenador oculto sale solo de sus otros clubes.`, `We compute the average style of the hidden matches, net of club, players, opponent and context, and compare it (correlation) with the profile of each of the ${K} candidate coaches. The hidden coach's profile comes only from his other clubs.`)}</li>
                <li>{L('Anotamos en qué puesto queda el entrenador verdadero. Por azar, el puesto esperado es la mitad de la lista.', 'We record where the true coach ranks. By chance, the expected rank is the middle of the list.')}</li>
              </ol>
              <div className="mt-stats">
                <div><b>{fmt(R.ajustado.mediana, 1)}</b><span>{L('puesto mediano', 'median rank')}</span><em>{L('azar', 'chance')} {fmt(R.azar.mediana, 1)}</em></div>
                <div><b>{pct(R.ajustado.top5)}</b><span>{L('en el top 5', 'in the top 5')}</span><em>{L('azar', 'chance')} {pct(R.azar.top5)}</em></div>
                <div><b>{R.ajustado.mitad_superior}/{R.etapas}</b><span>{L('en la mitad superior', 'in the top half')}</span><em>{pSign}, {L('prueba de signo', 'sign test')}</em></div>
              </div>
            </div>
            <div>
            <Fig n={8} title={L(`Puesto del entrenador verdadero en las ${R.etapas} etapas ocultas. Barras: estilo ajustado. Línea gris: estilo crudo. Línea discontinua: lo esperado por azar.`, `Rank of the true coach in the ${R.etapas} hidden spells. Bars: adjusted style. Grey line: raw style. Dashed line: what chance would give.`)}>
              <TransferHist tr={TR} res={R} />
            </Fig>
              <p className="mt-after-fig">{L(`Con el estilo crudo, sin descontar club ni plantilla, el puesto mediano es ${fmt(R.crudo.mediana, 1)} y quedan ${R.crudo.mitad_superior} etapas en la mitad superior. El ajuste mejora el puesto en ${R.ajustado_mejor_que_crudo} de ${R.etapas} etapas y lo deja igual en ${R.ajustado_igual}: quitar la plantilla y el club hace más reconocible al entrenador.`, `With raw style, without removing club or squad, the median rank is ${fmt(R.crudo.mediana, 1)} and ${R.crudo.mitad_superior} spells land in the top half. The adjustment improves the rank in ${R.ajustado_mejor_que_crudo} of ${R.etapas} spells and leaves it unchanged in ${R.ajustado_igual}: removing squad and club makes the coach easier to recognize.`)}</p>
            </div>
          </div>

          <div className="mt-two mt-h3-gap">
            <div>
              <h3 className="mt-h3"><span className="mt-subnum">5.3</span>{L('Prueba con datos simulados', 'Check on simulated data')}</h3>
              <div className="mt-prose">
                <p>{L('En datos reales no conocemos la respuesta correcta. Por eso simulamos una liga de 10 clubes y 4 temporadas en la que sí la conocemos, y en la que cada entrenador ficha jugadores a su imagen: el estilo de los fichajes tiene correlación 0.8 con el del entrenador. Es justo la confusión de la sección 1.', 'In real data we do not know the right answer. So we simulated a league of 10 clubs and 4 seasons where we do know it, and where every coach signs players in his own image: the style of the signings has a 0.8 correlation with the coach\'s. That is exactly the confounding of section 1.')}</p>
                <p>{L('El modelo recupera los efectos verdaderos con correlación 0.95. Su error es menos de la mitad del que comete el promedio simple de los partidos de cada entrenador, que le atribuye lo que ficha.', 'The model recovers the true effects with a 0.95 correlation. Its error is less than half that of the simple average of each coach\'s matches, which credits him with whoever he signs.')}</p>
              </div>
              <Fig n={9} title={L('Error al recuperar el efecto del entrenador en la liga simulada (tests/test_decomposition.py).', 'Error recovering the coach effect in the simulated league (tests/test_decomposition.py).')}>
                <SynthBars />
              </Fig>
            </div>
            <div>
              <h3 className="mt-h3"><span className="mt-subnum">5.4</span>{L('Índice de identificabilidad', 'Identifiability index')}</h3>
              <div className="mt-prose">
                <p>{L('No todos los entrenadores se separan igual de bien de su plantilla. El índice (0 a 100) resume cuántas comparaciones útiles tiene cada uno, con tres partes que corresponden a las tres fuentes de la sección 2:', 'Not every coach separates equally well from his squad. The index (0 to 100) sums up how many useful comparisons each one has, with three parts that match the three sources in section 2:')}</p>
              </div>
              <IdentWeights />
              <Fig n={10} title={L(`Distribución del índice. La mediana es ${fmt(idxMed, 0)}. Con un índice bajo, el ridge acerca la huella a la media de la liga y la app lo indica.`, `Distribution of the index. The median is ${fmt(idxMed, 0)}. With a low index, ridge pulls the fingerprint toward the league average and the app flags it.`)}>
                <IdentHist dts={glob.dts} />
              </Fig>
            </div>
          </div>

          {tp && (() => {
            const S = tp.sin_plantilla_todos, Cr = tp.crudo_todos, Mi = tp.sin_plantilla_mitad_temporada, B = tp.coef_sin_plantilla, P = tp.placebo_tiempo
            const pp = (p: number) => p < 0.001 ? 'p < 0.001' : `p = ${fmt(p, 3)}`
            const ci = (a: number[], d = 2) => `[${fmt(a[0], d)}, ${fmt(a[1], d)}]`
            return (<>
              <h3 className="mt-h3 mt-h3-gap" id="mt-s5-5"><span className="mt-subnum">5.5</span>{L('Trasplante de estilo: ¿el equipo se va hacia el estilo del entrenador nuevo?', "Style transplant: does the team move toward the new coach's style?")}</h3>
              <div className="mt-two">
                <div className="mt-prose">
                  <p>{L('La crítica clásica al plus-minus ajustado en futbol es que hay pocos cambios: tres o cinco por partido, casi siempre en los mismos minutos, así que es difícil separar a un jugador de los que juegan con él. Las pruebas 5.1 a 5.4 se apoyan en otra fuente, los entrenadores que cambian de club. Esta prueba usa el experimento más limpio que ofrece la liga: el día que un club cambia de entrenador, cambia todo el cuerpo técnico y la plantilla es casi la misma.', 'The classic criticism of adjusted plus-minus in football is that there are few substitutions: three to five per match, almost always at the same minutes, so it is hard to separate a player from the players around him. Tests 5.1 to 5.4 rest on a different source, coaches who move between clubs. This test uses the cleanest experiment the league offers: on the day a club changes coach, the whole staff changes while the squad stays almost the same.')}</p>
                  <p>{L('Si la huella del entrenador es real, la que estimamos en sus otros clubes debería predecir hacia dónde se mueve su equipo nuevo. Lo medimos así:', 'If the coach fingerprint is real, the one estimated at his other clubs should predict where his new team moves. We measure it like this:')}</p>
                  <ol className="mt-steps mt-steps-tight">
                    <li>{L(`Eventos: cada cambio de entrenador con al menos ${tp.params.MIN_PRE} partidos del saliente antes, ${tp.params.MIN_POST} del entrante después, y ${tp.params.MIN_OTHER} o más partidos del entrante en otros clubes. Quedan ${tp.n_eventos} cambios; ${tp.n_mitad_temporada} ocurren a mitad de torneo.`, `Events: every coaching change with at least ${tp.params.MIN_PRE} matches of the outgoing coach before, ${tp.params.MIN_POST} of the incoming one after, and ${tp.params.MIN_OTHER} or more matches of the incoming coach at other clubs. That leaves ${tp.n_eventos} changes; ${tp.n_mitad_temporada} happen mid-tournament.`)}</li>
                    <li>{L('Fuera de muestra: para cada cambio reajustamos el modelo sin los partidos del entrante en ese club. Su huella sale solo de sus otros clubes, y nada de lo que pasa después del cambio entra en la predicción.', "Out of sample: for each change we refit the model without the incoming coach's matches at that club. His fingerprint comes only from his other clubs, and nothing that happens after the change enters the prediction.")}</li>
                    <li>{L('Dirección predicha: d = α', 'Predicted direction: d = α')}<sub>{L('nuevo', 'new')}</sub> − α<sub>{L('anterior', 'old')}</sub>{L(`, en los ${nBase} indicadores. Cada partido recibe un puntaje`, ` across the ${nBase} indicators. Each match gets a score`)} <span className="mono">s<sub>t</sub> = (V<sub>t</sub> − V̄<sub>{L('antes', 'pre')}</sub>) · d / (d · d)</span>{L(': 0 si el equipo sigue jugando como antes, 1 si se movió justo lo que predice el cambio de entrenador. Como el ridge encoge las huellas, valores arriba de 1 son normales.', ': 0 if the team still plays as before, 1 if it moved exactly as the coaching change predicts. Since ridge shrinks fingerprints, values above 1 are normal.')}</li>
                    <li>{L('V', 'V')}<sub>t</sub>{L(' es el estilo del partido sin el aporte de jugadores, rival y contexto. Así, los fichajes y la rotación que llegan con el entrenador no cuentan a su favor.', ' is the match style net of players, opponent and context. That way the signings and rotation that come with the coach do not count in his favour.')}</li>
                  </ol>
                  <div className="mt-stats">
                    <div><b>{fmt(S.especifico, 2)}</b><span>{L('efecto propio del entrenador nuevo', "effect specific to the new coach")}</span><em>IC95 {ci(S.especifico_ic95)}</em></div>
                    <div><b>{pp(S.p_permutacion).replace('p ', '').replace('= ', '')}</b><span>{L('p de permutación', 'permutation p')}</span><em>{L(`${tp.params.N_PERM} entrenadores placebo`, `${tp.params.N_PERM} placebo coaches`)}</em></div>
                    <div><b>{fmt(S.vida_media, 1)}</b><span>{L('partidos de vida media: el cambio es inmediato', 'matches of half-life: the change is immediate')}</span><em>{S.vida_media_ic95 ? `IC95 ${ci(S.vida_media_ic95, 1)}` : ''}</em></div>
                  </div>
                </div>
                <div>
                  <Fig n={11} title={L(`Puntaje medio s por partido alrededor de los ${tp.n_eventos} cambios de entrenador. Línea gruesa: estilo sin plantilla, rival ni contexto, con IC95 por bootstrap de eventos. Gris fino: estilo crudo. Discontinua: lo que se esperaría con un entrenador cualquiera en lugar del que llegó.`, `Mean score s per match around the ${tp.n_eventos} coaching changes. Thick line: style net of squad, opponent and context, with 95% CI from an event bootstrap. Thin grey: raw style. Dashed: what we would expect from an arbitrary coach instead of the one who arrived.`)}>
                    <EventCurve T={tp} />
                  </Fig>
                  <p className="mt-after-fig">{L(`El cambio aparece desde el primer partido (vida media de ${fmt(S.vida_media, 1)} partidos) y después se mantiene. Antes del cambio la curva es plana (pendiente ${fmt(S.pendiente_pre, 3)} por partido, IC95 ${ci(S.pendiente_pre_ic95, 3)}): los equipos no venían moviéndose ya en esa dirección.`, `The change shows up from the first match (half-life of ${fmt(S.vida_media, 1)} matches) and then it holds. Before the change the curve is flat (slope ${fmt(S.pendiente_pre, 3)} per match, 95% CI ${ci(S.pendiente_pre_ic95, 3)}): teams were not already drifting in that direction.`)}</p>
                  <Fig n={12} title={L(`Efecto en cada uno de los ${tp.n_eventos} cambios. Relleno: el entrenador verdadero supera al 90% de sus placebos en ese cambio. Discontinua: placebo medio.`, `Effect in each of the ${tp.n_eventos} changes. Filled: the true coach beats 90% of his placebos in that change. Dashed: mean placebo.`)} note={L('Pasa el cursor por un punto para ver el cambio.', 'Hover a dot to see the change.')}>
                    <EventDots T={tp} names={shortNames} />
                  </Fig>
                </div>
              </div>

              <div className="mt-h3-gap">
                  <h3 className="mt-h3">{L('Cómo descartamos las explicaciones alternativas', 'How we rule out the alternatives')}</h3>
                  <Fig n={13} className="mt-fig-forest" title={L('El mismo efecto bajo cada variante del diseño, con su IC95 por bootstrap de eventos. Los dos placebos de abajo deberían quedar lejos del efecto real.', 'The same effect under each design variant, with its 95% CI from an event bootstrap. The two placebos at the bottom should sit far from the real effect.')}>
                    <TransplantForest T={tp} />
                  </Fig>
              <div className="mt-two mt-two-var">
                <div className="mt-prose">
                  <p><b>{L('Cualquier cambio mueve al equipo. ', 'Any change moves the team. ')}</b>{L(`Un club que despide a su entrenador se aleja de lo que hacía, y la regresión a la media empuja en el mismo sentido (van Ours y van Tuijl, 2016, lo muestran para los resultados). Por eso la comparación no es contra 0: repetimos el cálculo ${tp.params.N_PERM} veces con la huella de otro entrenador al azar en lugar del que llegó, dejando igual al saliente. Ese placebo da ${fmt(S.nula_media, 2)}; el entrenador verdadero da ${fmt(S.efecto, 2)} (IC95 ${ci(S.ic95)}). Lo que pone el entrenador nuevo es la diferencia, ${fmt(S.especifico, 2)}, y ${S.p_permutacion * (tp.params.N_PERM + 1) <= 1.01 ? `ninguno de los ${tp.params.N_PERM} placebos llega tan alto` : `solo el ${fmt(100 * S.p_permutacion, 1)}% de los placebos llega tan alto`}.`, `A club that sacks its coach moves away from what it did, and regression to the mean pushes the same way (van Ours and van Tuijl, 2016, show this for results). So the comparison is not against 0: we repeat the calculation ${tp.params.N_PERM} times with the fingerprint of a random other coach in place of the one who arrived, keeping the outgoing one. That placebo gives ${fmt(S.nula_media, 2)}; the true coach gives ${fmt(S.efecto, 2)} (95% CI ${ci(S.ic95)}). What the new coach brings is the difference, ${fmt(S.especifico, 2)}, and ${S.p_permutacion * (tp.params.N_PERM + 1) <= 1.01 ? `none of the ${tp.params.N_PERM} placebos reaches that high` : `only ${fmt(100 * S.p_permutacion, 1)}% of placebos reach that high`}.`)}</p>
                  <p><b>{L('Sin cambio no hay salto. ', 'No change, no jump. ')}</b>{L(`Ponemos ${P.n} fechas falsas a mitad de etapas largas de un mismo entrenador. El puntaje medio es ${fmt(P.media, 2)} (IC95 ${ci(P.media_ic95)}): sin cambio real, nada se mueve.`, `We place ${P.n} fake dates in the middle of long spells under one coach. The mean score is ${fmt(P.media, 2)} (95% CI ${ci(P.media_ic95)}): with no real change, nothing moves.`)}</p>
                </div>
                <div className="mt-prose">
                  <p><b>{L('Una regresión directa. ', 'A direct regression. ')}</b>{L('Juntando eventos e indicadores, estimamos Δ = b·α', 'Pooling events and indicators, we estimate Δ = b·α')}<sub>{L('nuevo', 'new')}</sub> + c·α<sub>{L('anterior', 'old')}</sub>{L(`, con efecto fijo por indicador, donde Δ es el cambio de estilo del equipo. Sin trasplante, b = 0. Sale b = ${fmt(B.b, 2)} (IC95 ${ci(B.ic95)}, ${pp(B.p_permutacion)} por permutación) y c = ${fmt(B.c, 2)}: el equipo gana la huella del que llega y pierde la del que se va.`, `, with a fixed effect per indicator, where Δ is the change in the team's style. With no transplant, b = 0. We get b = ${fmt(B.b, 2)} (95% CI ${ci(B.ic95)}, ${pp(B.p_permutacion)} by permutation) and c = ${fmt(B.c, 2)}: the team gains the fingerprint of the coach who arrives and loses that of the one who leaves.`)}</p>
                  <p><b>{L('Fichajes y plantilla. ', 'Signings and squad. ')}</b>{L(`Con el estilo crudo el efecto es ${fmt(Cr.efecto, 2)}; sin plantilla, ${fmt(S.efecto, 2)}. Casi todo sobrevive al quitar a los jugadores. ${Mi ? `Solo con los ${Mi.n} cambios a mitad de torneo, cuando no hay ventana de fichajes, sale ${fmt(Mi.efecto, 2)} (${pp(Mi.p_permutacion)}).` : ''}`, `With raw style the effect is ${fmt(Cr.efecto, 2)}; net of squad, ${fmt(S.efecto, 2)}. Almost all of it survives removing the players. ${Mi ? `Using only the ${Mi.n} mid-tournament changes, when there is no transfer window, it is ${fmt(Mi.efecto, 2)} (${pp(Mi.p_permutacion)}).` : ''}`)}</p>
                  <p><b>{L('Ningún club lo sostiene solo. ', 'No single club drives it. ')}</b>{L(`Quitando un club a la vez, el efecto queda entre ${fmt(tp.sensibilidad.sin_un_club.efecto_min, 2)} y ${fmt(tp.sensibilidad.sin_un_club.efecto_max, 2)}. Con entrantes de huella más sólida (≥ 15 partidos en otros clubes, ${tp.sensibilidad.otros15.n} cambios) da ${fmt(tp.sensibilidad.otros15.efecto, 2)}.`, `Dropping one club at a time, the effect stays between ${fmt(tp.sensibilidad.sin_un_club.efecto_min, 2)} and ${fmt(tp.sensibilidad.sin_un_club.efecto_max, 2)}. With incoming coaches whose fingerprint is better estimated (≥ 15 matches elsewhere, ${tp.sensibilidad.otros15.n} changes) it is ${fmt(tp.sensibilidad.otros15.efecto, 2)}.`)}</p>
                </div>
              </div>
              </div>
            </>)
          })()}
        </Sec>

        {/* ------------------------------------------------------------ 6 */}
        <Sec id="mt-s6" num={6} title={L('Otros modelos de la app', 'Other models in the app')} accent="var(--c-club)">
          <p className="mt-lede">{L('El modelo central da la huella de cada entrenador. Estos otros modelos y reglas la describen, la ponen en contexto o la usan para predecir. Cada uno, con su parámetro clave.', 'The main model gives each coach\'s fingerprint. These other models and rules describe it, put it in context or use it to predict. Each one with its key parameter.')}</p>
          <div className="mt-models">
            {others.map(o => (
              <div key={o.t} className="mt-model" style={{ ['--acc' as string]: o.acc }}>
                <div className="mt-model-t">{o.t}</div>
                <div className="mt-chips">{o.key.map(k => <span key={k} className="mono">{k}</span>)}</div>
                <p><b>{L('Para qué: ', 'What for: ')}</b>{o.what}</p>
                <p className="mt-tech"><b>{L('Cómo: ', 'How: ')}</b>{o.how}</p>
                {o.fig}
              </div>
            ))}
          </div>
        </Sec>

        {/* ------------------------------------------------------------ 7 */}
        <Sec id="mt-s7" num={7} title={L('Límites y supuestos', 'Limitations and assumptions')} accent="var(--ink-3)">
          <ul className="mt-limits">
            <li><b>{L('Pocos cambios, estimación débil.', 'Few moves, weak estimates.')}</b> {L('Con poca movilidad, los efectos fijos se estiman con ruido y pueden absorber parte de la plantilla o del club (Andrews et al., 2008). El ridge y el índice de identificabilidad lo mitigan; no lo eliminan.', 'With little mobility, fixed effects are noisy and can soak up part of the squad or the club (Andrews et al., 2008). Ridge and the identifiability index mitigate this; they do not remove it.')}</li>
            <li><b>{L('Los cambios no son al azar.', 'Moves are not random.')}</b> {L('Como en AKM, suponemos que un entrenador no llega a un club por algo que el modelo no ve y que también cambia el estilo. Si un club cambia de entrenador y de directiva a la vez, parte de lo segundo puede atribuirse al primero.', 'As in AKM, we assume a coach does not arrive at a club because of something the model cannot see that also changes style. If a club changes coach and board at the same time, part of the latter may be credited to the former.')}</li>
            <li><b>{L('Modelo aditivo.', 'Additive model.')}</b> {L('No captura interacciones entre entrenador y jugador, como un sistema montado para un delantero concreto. Bridgewater et al. (2011) muestran que en los resultados esas interacciones existen.', 'It does not capture coach × player interactions, such as a system built around one striker. Bridgewater et al. (2011) show that such interactions exist for results.')}</li>
            <li><b>{L('El ridge tiene una postura.', 'Ridge takes a stance.')}</b> {L('En la parte que los datos no separan, reparte según las λ, que favorecen a la plantilla. La parte del entrenador es, por diseño, una cota prudente.', 'In the part the data cannot separate, it splits according to the λ values, which favour the squad. The coach share is, by design, a cautious estimate.')}</li>
            <li><b>{L('Eventos, no tracking.', 'Events, not tracking.')}</b> {L('El 360 es una foto por evento, con parte de la cancha fuera de cuadro, y no existe en todos los partidos. No hay distancias recorridas ni la forma del bloque en todo momento.', '360 data is one snapshot per event, with part of the pitch out of frame, and it is not available for every match. There are no running distances or block shape at every moment.')}</li>
            <li><b>{L('Quién es el entrenador.', 'Who the coach is.')}</b> {L('Es el que registra StatsBomb en cada partido. No se modelan el cuerpo técnico ni los interinatos de un partido.', 'The one StatsBomb records for each match. The coaching staff and one-match caretakers are not modelled.')}</li>
            <li><b>{L('Una sola liga.', 'One league.')}</b> {L(`Liga MX de ${seasons[0]} a ${seasons[seasons.length - 1]}; la última temporada está en curso. Los resultados no se han probado en otras ligas.`, `Liga MX from ${seasons[0]} to ${seasons[seasons.length - 1]}; the last season is in progress. The results have not been tested in other leagues.`)}</li>
          </ul>
        </Sec>

        {/* ------------------------------------------------------------ refs */}
        <section id="mt-refs" className="mt-sec">
          <h2 className="mt-h2">{L('Referencias', 'References')}</h2>
          <ol className="mt-refs">
            {refs.map(r => <li key={r.id}>{r.t} <a href={r.url} target="_blank" rel="noreferrer">{L('enlace', 'link')} ↗</a></li>)}
          </ol>
          <p className="mt-repro">{L('Código: el modelo central está en ', 'Code: the main model is in ')}<code>pipeline/models/decomposition.py</code>{L(', la prueba de transferencia en ', ', the transfer test in ')}<code>pipeline/models/transfer_test.py</code>{L(', el trasplante de estilo en ', ', the style transplant in ')}<code>pipeline/models/transplant.py</code>{L(' y la prueba sintética en ', ' and the synthetic check in ')}<code>tests/test_decomposition.py</code>.</p>
        </section>
      </article>
    </div>
  )
}

