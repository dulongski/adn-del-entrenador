import { useEffect, useMemo, useState } from 'react'
import { ClubLogo, CoachPhoto } from '../charts'
import { similares } from '../Compare'
import { chatBus } from '../chatBus'
import CoachPicker from '../compare/CoachPicker'
import '../styles/compare.css'
import { Ico } from '../icons'
import Info from '../Info'
import { dataUrl, fmt, getJSON, shortName, type Any } from '../lib'
import { L, LANG } from '../settings'
import { kFmt, kName } from './resumenKit'
import '../styles/tl.css'
import '../styles/plan.css'

/* Cara a cara · «¿Cómo debería jugar A contra B?». A = el DT que estás viendo; B = el rival
   (un técnico o el DT actual de un equipo). Todo sale del estilo propio (α) de los dos, de las
   claves de plan.json, de sus curvas de reacción al marcador y al minuto, y de bp2.json. */

const ap = (a: Any) => Object.fromEntries((a?.huella ?? []).map((h: Any) => [h.kpi, h.alpha])) as Record<string, number>
const sg = (v: number) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), 2)}`
const tx = (a: Any, k: string, n = '') => String((LANG === 'en' ? a[`${k}_en`] : a[k]) ?? a[k]).split('{N}').join(n)

/* Plan de partido: cruces entre un rasgo de {B} (el rival) y uno de {A} (tu DT).
   «oportunidad»: algo que {B} hace o concede y que {A} puede explotar. «riesgo»: un arma de {B} que {A} tiene que cubrir.
   B / A = [kpi, signo] del estilo propio (α). Se muestran los cruces donde el rasgo del rival es claro (≥ 0.25σ),
   ordenados por la suma rival + encaje de {A}. Los textos van con nombres; el «por qué» usa lo que se ve en sus partidos. */
type Cruce = { id: string; tipo: 'op' | 'riesgo'; fase: 'con' | 'sin' | 'trans'; B: [string, number][]; A: [string, number][]; t: [string, string]; hacer: [string, string][]; mirar: [string, string] }
const CRUCES: Cruce[] = [
  { id: 'presion_salida', tipo: 'op', fase: 'sin', B: [['salida_corta', 1], ['construccion_exito', -1]], A: [['altura_presion', 1], ['ppda', -1]],
    t: ['Presiona la salida corta de {B}', "Press {B}'s short build-up"],
    hacer: [['Salta arriba en sus saques de meta: el delantero al portero y los extremos a los centrales.', 'Jump high on their goal kicks: striker on the keeper, wingers on the centre-backs.'], ['Un mediocentro pegado a su pivote para cortar el pase por dentro.', 'One midfielder tight on their pivot to cut the inside pass.'], ['Si superan la primera línea, repliega: no persigas hacia atrás.', 'If they beat the first line, drop back: do not chase backwards.']],
    mirar: ['Cuántas de sus salidas cortas llegan a tu campo', 'How many of their short build-ups reach your half'] },
  { id: 'espalda', tipo: 'op', fase: 'con', B: [['linea_360', 1]], A: [['verticalidad', 1], ['contraataque', 1]],
    t: ['Ataca la espalda de la línea de {B}', "Attack the space behind {B}'s line"],
    hacer: [['Desmarques en diagonal de los delanteros a la espalda de sus centrales.', 'Diagonal runs from the forwards in behind their centre-backs.'], ['Pase vertical temprano al recuperar: uno o dos toques.', 'Early vertical pass after winning it: one or two touches.'], ['Extremos bien abiertos para estirar la línea antes del pase.', 'Wingers wide to stretch the line before the pass.']],
    mirar: ['Balones a la espalda y fueras de lugar en los primeros 20 minutos', 'Balls in behind and offsides in the first 20 minutes'] },
  { id: 'bloque_bajo', tipo: 'op', fase: 'con', B: [['linea_360', -1], ['posesion', -1]], A: [['posesion', 1], ['centros', 1]],
    t: ['Ten paciencia y carga el área de {B}', "Be patient and load {B}'s box"],
    hacer: [['Circula rápido de banda a banda para mover su bloque.', 'Move the ball quickly side to side to shift their block.'], ['Centros al segundo palo con la llegada de un mediocentro.', 'Crosses to the far post with a midfielder arriving.'], ['Tiro de media distancia en la segunda jugada.', 'Shoot from mid-range on the second ball.']],
    mirar: ['Llegadas al área por partido', 'Box entries per match'] },
  { id: 'entre_lineas', tipo: 'op', fase: 'con', B: [['compacidad_360', 1]], A: [['progresivos', 1], ['conduccion_prog', 1]],
    t: ['Recibe entre las líneas de {B}', "Receive between {B}'s lines"],
    hacer: [['Mediapunta y un extremo por dentro, entre su medio campo y su defensa.', 'Number 10 and one winger inside, between their midfield and defence.'], ['Pase vertical a esos jugadores en cuanto se abra el carril.', 'Vertical pass to them as soon as the lane opens.'], ['Conducción hacia el centro para atraer a sus centrales.', 'Carry towards the middle to draw their centre-backs.']],
    mirar: ['Pases que reciben entre líneas tus mediapuntas', 'Passes your 10s receive between the lines'] },
  { id: 'por_fuera', tipo: 'op', fase: 'con', B: [['compacidad_360', -1]], A: [['progresion_banda', 1], ['cambios_orientacion', 1]],
    t: ['Ataca por fuera del bloque de {B}', "Go around {B}'s block"],
    hacer: [['Lateral y extremo en amplitud total para hacer 2 contra 1 por banda.', 'Full-back and winger at full width for 2-v-1s out wide.'], ['Cambios de orientación rápidos al lado débil.', 'Quick switches to the weak side.'], ['Pase atrás raso al llegar a línea de fondo.', 'Low cut-back when reaching the byline.']],
    mirar: ['Centros y llegadas por banda', 'Crosses and wide entries'] },
  { id: 'contragolpe', tipo: 'op', fase: 'trans', B: [['transicion_def', 1]], A: [['contraataque', 1]],
    t: ['Contragolpea a {B}', 'Hit {B} on the counter'],
    hacer: [['Deja dos atacantes adelantados cuando defiendas.', 'Keep two attackers high when defending.'], ['Primer pase tras robar hacia adelante, no al lado.', 'First pass after a win-back goes forward, not sideways.'], ['Corre por el carril que deja su lateral al subir.', 'Run into the lane their full-back leaves when he goes forward.']],
    mirar: ['Contragolpes que llegan a su último tercio', 'Counters that reach their final third'] },
  { id: 'su_presion', tipo: 'riesgo', fase: 'con', B: [['ppda', -1], ['recuperaciones_altas_90', 1]], A: [['salida_corta', 1]],
    t: ['Que su presión no ahogue tu salida', "Don't let {B}'s press choke your build-up"],
    hacer: [['Plan B en saque de meta: largo a un delantero de referencia.', 'Plan B on goal kicks: long to a target forward.'], ['Un pivote extra que baje entre los centrales.', 'An extra pivot dropping between the centre-backs.'], ['Cero pases horizontales en tu propio tercio.', 'No square passes in your own third.']],
    mirar: ['Balones que pierdes en tu tercio', 'Balls lost in your own third'] },
  { id: 'sus_contras', tipo: 'riesgo', fase: 'trans', B: [['contraataque', 1]], A: [['transicion_def', 1]],
    t: ['Cuida la pérdida: {B} contragolpea', '{B} counters: protect the ball'],
    hacer: [['Deja 2+1 atrás cuando ataques: dos centrales y un pivote.', 'Keep 2+1 back when attacking: two centre-backs and a pivot.'], ['Falta táctica temprana si salen en igualdad numérica.', 'Early tactical foul if they break with equal numbers.'], ['Que no suban los dos laterales a la vez.', 'Never push both full-backs at once.']],
    mirar: ['Contragolpes rivales que llegan a tu área', 'Opponent counters that reach your box'] },
  { id: 'sus_bandas', tipo: 'riesgo', fase: 'sin', B: [['progresion_banda', 1], ['centros', 1]], A: [],
    t: ['Cierra las bandas de {B} y defiende el área', "Close {B}'s flanks and defend the box"],
    hacer: [['Doble marca en banda: lateral más extremo.', 'Double up out wide: full-back plus winger.'], ['Presión al que centra y un central siempre en el primer palo.', 'Pressure on the crosser and a centre-back always at the near post.'], ['Un jugador fijo en el segundo palo.', 'One player fixed on the far post.']],
    mirar: ['Centros que te meten al área', 'Crosses into your box'] },
  { id: 'su_directo', tipo: 'riesgo', fase: 'sin', B: [['pase_largo', 1], ['verticalidad', 1]], A: [],
    t: ['Gana el primer balón contra el juego directo de {B}', "Win the first ball against {B}'s direct play"],
    hacer: [['Tu central más fuerte por arriba en la zona de caída.', 'Your best aerial centre-back where the ball lands.'], ['Mediocampistas cerca para quedarse la segunda jugada.', 'Midfielders close by to win the second ball.'], ['La línea da un paso atrás cuando su portero va a sacar largo.', 'The line takes a step back when their keeper goes long.']],
    mirar: ['Segundas jugadas ganadas', 'Second balls won'] },
  { id: 'su_posesion', tipo: 'riesgo', fase: 'sin', B: [['posesion', 1], ['pases_por_posesion', 1]], A: [],
    t: ['Bloque medio contra la posesión de {B}', "Mid-block against {B}'s possession"],
    hacer: [['Bloque medio compacto, sin regalar espacio entre líneas.', 'A compact mid-block with no room between the lines.'], ['Salta a presionar solo con el pase atrás o al portero.', 'Only jump to press on a back pass or a pass to the keeper.'], ['Cierra los pases por dentro y deja que el balón vaya por fuera.', 'Shut the inside passes and let the ball go wide.']],
    mirar: ['Su posesión en tu mitad de cancha', 'Their possession in your half'] },
  { id: 'sus_conductores', tipo: 'riesgo', fase: 'sin', B: [['conduccion_prog', 1]], A: [],
    t: ['Corta a los conductores de {B}', "Stop {B}'s ball-carriers"],
    hacer: [['No le des metros al que conduce: temporiza y oriéntalo a banda.', 'Give the carrier no room: delay him and show him wide.'], ['El compañero de al lado cubre la espalda del que sale.', 'The nearest team-mate covers behind whoever steps out.'], ['Falta táctica en medio campo si rompe la línea.', 'Tactical foul in midfield if he breaks the line.']],
    mirar: ['Conducciones rivales que superan tu medio campo', 'Opponent carries past your midfield'] },
]
const FASE: Record<string, [string, string, string, string]> = { con: ['Cuando {A} tiene el balón', 'When {A} has the ball', 'ball', 'var(--c-dt)'], sin: ['Cuando {B} tiene el balón', 'When {B} has the ball', 'shield', 'var(--c-club)'], trans: ['Transiciones', 'Transitions', 'bolt', 'var(--c-rival)'] }

/* Reacciones al marcador / minuto: qué implica para el rival cada cambio del DT. */
const KF: Record<string, 'con' | 'sin' | 'trans' | 'peligro'> = { posesion: 'con', verticalidad: 'con', pase_largo: 'con', field_tilt: 'con', ppda: 'sin', altura_presion: 'sin', linea_360: 'sin', contraataque: 'trans', xg_90: 'peligro', xg_contra_90: 'peligro' }
const REC: Record<string, [[string, string], [string, string]]> = {
  posesion: [['busca más el balón: a {Y} le conviene bloque compacto y contragolpe', 'wants more of the ball: {Y} should sit compact and counter'], ['cede el balón: {Y} necesita un plan para atacar en estático', 'gives up the ball: {Y} needs a plan to break a set defence']],
  verticalidad: [['juega más directo: {Y} debe cuidar la profundidad y la segunda jugada', 'plays more directly: {Y} must guard depth and second balls'], ['elabora más: {Y} puede presionar su primer pase', 'builds more patiently: {Y} can press his first pass']],
  pase_largo: [['tira más balones largos: {Y} necesita centrales fuertes por arriba', 'plays more long balls: {Y} needs strong aerial centre-backs'], ['juega más corto: {Y} puede presionar tras pérdida', 'plays shorter: {Y} can press right after losing it']],
  field_tilt: [['se mete más en campo rival: {Y} debe preparar salidas rápidas', "camps more in the opponent's half: {Y} should prepare fast exits"], ['se mete menos en campo rival: {Y} puede adelantar líneas', "camps less in the opponent's half: {Y} can push up"]],
  ppda: [['presiona menos: {Y} puede salir jugando', 'presses less: {Y} can play out from the back'], ['presiona más: {Y} necesita salida larga o un pivote extra', 'presses more: {Y} should go long or add a pivot']],
  altura_presion: [['presiona más arriba: {Y} tiene espacio a la espalda de esa presión', 'presses higher: {Y} has space behind that press'], ['espera más atrás: {Y} tendrá el balón en su campo', 'waits deeper: {Y} will have the ball in its own half']],
  linea_360: [['adelanta la línea: {Y} debe buscar la espalda', 'pushes his line up: {Y} should play in behind'], ['hunde la línea: {Y} debe ir a centros y tiros de media distancia', 'drops his line: {Y} should go for crosses and mid-range shots']],
  contraataque: [['contragolpea más: {Y} debe cuidar la pérdida', 'counters more: {Y} must protect the ball'], ['contragolpea menos: {Y} puede subir a los laterales', 'counters less: {Y} can push the full-backs on']],
  xg_90: [['genera más peligro: {Y} debe reforzar el área', 'creates more danger: {Y} must reinforce the box'], ['genera menos peligro', 'creates less danger']],
  xg_contra_90: [['concede más: es el momento de {Y} para atacar', "concedes more: it is {Y}'s moment to attack"], ['concede menos: {Y} necesita paciencia', 'concedes less: {Y} needs patience']],
}
const SITS: [string, string, string, string, string][] = [
  ['marcador', 'Perdiendo', 'Cuando {X} va perdiendo', 'When {X} is losing', L('Perdiendo', 'Losing')], ['marcador', 'Empatando', 'Con el empate', 'When level', L('Empate', 'Level')], ['marcador', 'Ganando', 'Cuando {X} va ganando', 'When {X} is winning', L('Ganando', 'Winning')],
  ['minuto', "0-30'", "Del 0' al 30'", "0'–30'", "0-30'"], ['minuto', "30-60'", "Del 30' al 60'", "30'–60'", "30-60'"], ['minuto', "60-75'", "Del 60' al 75'", "60'–75'", "60-75'"], ['minuto', "75'+", "Del 75' al final", "75' to the end", "75'+"],
]
const FROWS: [string, string, string][] = [['con', 'Con el balón', 'With the ball'], ['sin', 'Sin el balón', 'Without the ball'], ['trans', 'Transiciones', 'Transitions'], ['peligro', 'Peligro', 'Danger']]

function reactions(art: Any) {
  const C = art?.contexto?.curvas ?? {}
  const cell: Record<string, Record<string, { k: string; d: number }[]>> = {}
  const all: { sit: string; k: string; d: number; n: number }[] = []
  for (const [dim, lvl] of SITS) {
    const key = `${dim}|${lvl}`
    cell[key] = {}
    for (const [k, f] of Object.entries(KF)) {
      const r = (C[dim]?.[k] ?? []).find((x: Any) => x.nivel === lvl)
      if (!r || r.dt == null || r.liga == null || r.n_dt < 40) continue
      const d = r.dt - r.liga
      ;(cell[key][f] ??= []).push({ k, d })
      all.push({ sit: key, k, d, n: r.n_dt })
    }
  }
  all.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
  const seen = new Set<string>()
  const top = all.filter(o => Math.abs(o.d) >= 0.5 && (seen.has(o.sit) ? false : (seen.add(o.sit), true))).slice(0, 5)
  return { cell, top }
}

export function Duelo({ art, glob, media, mapa }: { art: Any; glob: Any; media: Any; mapa: Any }) {
  const clubOf = (id: number) => media.dts?.[id]?.club as string | undefined
  const vig = (id: number) => !!media.dts?.[id]?.vigente
  const myClub = vig(art.id) ? clubOf(art.id) : undefined
  // DT actual de cada club (para elegir rival por equipo)
  const byClub = useMemo(() => {
    const m: Record<string, number> = {}
    for (const d of glob.dts as Any[]) if (vig(d.id) && clubOf(d.id)) m[clubOf(d.id)!] = d.id
    return m
  }, [glob, media])
  const [cal, setCal] = useState<Any[] | null>(null)
  const [pp, setPp] = useState<Any>(null)
  const [plan, setPlan] = useState<Any>(null)
  const [bp2, setBp2] = useState<Any>(null)
  useEffect(() => { getJSON(dataUrl('calendario.json')).then(setCal).catch(() => setCal([])); getJSON(dataUrl('partidos.json')).then(setPp).catch(() => setPp(false)); getJSON(dataUrl('plan.json')).then(setPlan).catch(() => setPlan(false)); getJSON(dataUrl('bp2.json')).then(setBp2).catch(() => setBp2(false)) }, [])
  const next = useMemo(() => {
    if (!myClub || !cal) return null
    const f = [...cal].sort((a, b) => a.r - b.r).find(m => m.h === myClub || m.a === myClub)
    if (!f) return null
    const rival = f.h === myClub ? f.a : f.h
    return { rival, coach: byClub[rival], jornada: f.j ?? Math.floor(f.r), local: f.h === myClub }
  }, [cal, myClub, byClub])
  const sims = useMemo(() => similares(art.id, mapa), [art.id, mapa])
  const [pick, setPick] = useState<{ a: number; b: number } | null>(() => { const r = chatBus.vsRival; chatBus.vsRival = null; return r ? { a: art.id, b: r } : null })
  const rid = pick && pick.a === art.id ? pick.b : (next?.coach ?? sims[0]?.id)
  const [B, setB] = useState<Any>(null)
  useEffect(() => { setB(null); if (rid) getJSON(dataUrl(`dt_${rid}.json`)).then(setB).catch(() => setB(false)) }, [rid])
  const [quien, setQuien] = useState<'el' | 'tu'>('el')
  const name = (_id: number, full?: string) => shortName(full ?? '')
  const sur = (full?: string) => shortName(full ?? '').split(' ').slice(1).join(' ') || shortName(full ?? '')
  const A = art
  const nA = name(A.id, A.nombre), nB = B ? name(B.id, B.nombre) : ''
  const sA = sur(A.nombre), sB = B ? sur(B.nombre) : ''
  const f = (t: string, X = sB, Y = sA) => t.split('{A}').join(sA).split('{B}').join(sB).split('{X}').join(X).split('{Y}').join(Y)
  const aA = ap(A), aB = ap(B)
  const setRival = (b: number | undefined) => { if (b && b !== A.id) setPick({ a: A.id, b }) }

  const h2h = useMemo(() => {
    if (!pp || !rid) return null
    const rows: Any[] = pp.rows.filter((r: Any[]) => (r[10] === A.id && r[11] === rid) || (r[10] === rid && r[11] === A.id))
    let w = 0, d = 0, l = 0, gf = 0, gc = 0
    const list = rows.map(r => { const home = r[10] === A.id; const f = home ? r[6] : r[7], c = home ? r[7] : r[6]; gf += f; gc += c; if (f > c) w++; else if (f === c) d++; else l++; return { fecha: r[0], h: r[4], a: r[5], hg: r[6], ag: r[7], res: f > c ? 'G' : f === c ? 'E' : 'P' } })
    return { n: rows.length, w, d, l, gf, gc, list: list.slice(-5).reverse() }
  }, [pp, rid, A.id])

  const pts = useMemo(() => new Map<number, Any>(mapa.puntos.map((p: Any) => [p.id, p])), [mapa])
  const extra = next?.coach ? [{ id: next.coach, k: L('Su próximo rival', 'Next opponent') }] : []
  const pickRow = <CoachPicker sims={sims} pts={pts} mapa={mapa} media={media} selected={rid ?? -1} onPick={id => setRival(id)} nA={nA} title={L(`¿Contra quién juega ${nA}?`, `Who does ${nA} face?`)} extra={extra} />
  if (!rid) return <div className="card note">{L('Elige un rival.', 'Pick an opponent.')}</div>
  if (B === false) return <div className="pl">{pickRow}<div className="card note">{L('No se pudo cargar a ese técnico.', 'Could not load that coach.')}</div></div>
  if (!B) return <div className="pl">{pickRow}<div className="card note">{L('Cargando…', 'Loading…')}</div></div>

  const HA = Object.fromEntries((A.huella ?? []).map((h: Any) => [h.kpi, h])) as Record<string, Any>
  const HB = Object.fromEntries((B.huella ?? []).map((h: Any) => [h.kpi, h])) as Record<string, Any>
  // fuerza de un rasgo = qué tan lejos está del DT mediano, por percentil entre los DTs (−1 a 1, con su signo).
  // Se usa el percentil y no α porque el modelo encoge a los DTs con pocos partidos: su orden sigue siendo informativo.
  const prom = (H: Record<string, Any>, ks: [string, number][]) => { const v = ks.filter(([k]) => H[k]?.pct != null).map(([k, sg_]) => ((H[k].pct - 50) / 50) * sg_); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0 }
  const cruces = CRUCES.map(c => {
    const sb = prom(HB, c.B), sa = c.A.length ? prom(HA, c.A) : 0
    // el rasgo del rival manda; el encaje de A suma (oportunidad) o, en riesgos, la debilidad de A agrava
    // y lo que se ve en sus partidos tiene que ir del mismo lado que su rasgo propio (si no, el «por qué» se contradice)
    const [k0, s0] = c.B[0], h0 = HB[k0]
    const visto = h0?.crudo != null && h0?.liga != null ? (h0.crudo - h0.liga) * s0 > 0 : false
    return { c, sb, sa, visto, score: sb + 0.6 * Math.max(sa, 0) }
  }).filter(x => x.sb >= 0.4 && x.visto)
  const ops = cruces.filter(x => x.c.tipo === 'op').sort((p, q) => q.score - p.score).slice(0, 3)
  const riesgos = cruces.filter(x => x.c.tipo === 'riesgo').sort((p, q) => q.score - p.score).slice(0, 3)
  // «lo que se ve en sus partidos»: valor observado frente a la liga
  const ev = (H: Record<string, Any>, k: string, sgn = 1) => {
    const h = H[k]; if (!h) return null
    const p = h.pct == null ? '' : sgn > 0 ? L(` · más que el ${fmt(h.pct, 0)}% de los DTs`, ` · more than ${fmt(h.pct, 0)}% of coaches`) : L(` · menos que el ${fmt(100 - h.pct, 0)}% de los DTs`, ` · less than ${fmt(100 - h.pct, 0)}% of coaches`)
    return `${kName(k, glob)}: ${kFmt(k, h.crudo)} (${L('liga', 'league')} ${kFmt(k, h.liga)})${p}`
  }
  const encaje = (x: { c: Cruce; sa: number }) => {
    if (!x.c.A.length) return null
    const k0 = x.c.A[0][0], h = HA[k0]
    const dato = h ? ` · ${kName(k0, glob)} ${kFmt(k0, h.crudo)} (${L('liga', 'league')} ${kFmt(k0, h.liga)})` : ''
    if (x.c.tipo === 'op') return x.sa >= 0.4 ? [L(`${sA} ya juega así`, `${sA} already plays this way`), 'tu', dato] : x.sa <= -0.4 ? [L(`No es costumbre de ${sA}: hay que entrenarlo`, `Not ${sA}'s habit: it needs work`), 'el', dato] : [L(`${sA} lo puede hacer`, `${sA} can do it`), 'neutro', dato]
    return x.sa >= 0.4 ? [L(`${sA} es vulnerable aquí`, `${sA} is exposed here`), 'el', dato] : [L(`${sA} lo suele cubrir`, `${sA} usually covers it`), 'tu', dato]
  }
  // balón parado: a favor (zona débil de B contra dónde manda A) y en contra (dónde manda B)
  const vul = (bp2?.dts?.[String(B.id)]?.vulnerable ?? []).filter((z: Any) => z.xg != null && z.n >= 15)
  const vz = vul.length ? vul.reduce((x: Any, y: Any) => (y.xg - y.xg_liga > x.xg - x.xg_liga ? y : x)) : null
  const myZ = A.balon_parado?.ofensivo?.corner_zonas ?? {}, lgZ = A.balon_parado?.liga?.corner_zonas ?? {}
  const markB = bp2?.dts?.[String(B.id)]?.marcaje, markA = bp2?.dts?.[String(A.id)]?.marcaje
  const bZ = B.balon_parado?.ofensivo?.corner_zonas ?? {}
  const bTop = Object.keys(bZ).length ? Object.keys(bZ).reduce((x, y) => ((bZ[y] - (lgZ[y] ?? 0)) > (bZ[x] - (lgZ[x] ?? 0)) ? y : x)) : null
  const R = reactions(quien === 'el' ? B : A)
  const bench = B.jugadores?.minuto_cambios?.['1']
  const benchL = B.jugadores?.minuto_cambios_liga?.['1']
  const quienN = quien === 'el' ? nB : nA
  const qX = quien === 'el' ? sB : sA, qY = quien === 'el' ? sA : sB
  const Tag = ({ t, c }: { t: string; c: string }) => <span className={`du-tag ${c}`}>{t}</span>
  const zEs = (z: string) => L(z, ({ 'Primer palo': 'near post', 'Área chica': 'six-yard box', 'Punto penal': 'penalty spot', 'Segundo palo': 'far post', Corto: 'short' } as Record<string, string>)[z] ?? z)

  return (
    <div className="pl">
      <div className="pl-lead">
        <h3 className="h2">{L(`Cómo debería jugar ${nA} contra ${nB}`, `How ${nA} should play against ${nB}`)}
          <Info wide><p>{L('Se cruzan los rasgos propios de los dos DTs (ya sin sus jugadores); cuenta un rasgo cuando está entre el 30% más marcado de los DTs. Arriba, dónde puede ganar y qué tiene que cubrir, con qué hacer en la cancha y qué mirar durante el partido; los números del «por qué» son lo que se ve en sus partidos frente a la liga. Abajo, balón parado y cómo cambia el rival según el marcador y el minuto. Son tendencias de su carrera, no una predicción.', 'Both coaches’ own traits are crossed (net of their players). Top: where he can win and what he must cover, with what to do on the pitch and what to watch during the match; the «why» numbers are what shows in their matches vs the league. Below: set pieces and how the opponent changes with score and minute. Career tendencies, not a prediction.')}</p></Info></h3>
        {pickRow}
      </div>

      <div className="card du-head">
        <div className="du-side"><CoachPhoto name={A.nombre} src={media.dts?.[A.id]?.foto} size={64} /><div><b>{nA}</b><small>{clubOf(A.id) && <ClubLogo club={clubOf(A.id)!} media={media} size={14} />} {clubOf(A.id)}</small></div></div>
        <div className="du-mid">
          {next && next.coach === rid && <span className="du-next"><Ico name="clock" />{L(`Próximo partido: jornada ${next.jornada}${next.local ? ', en casa' : ', de visita'}`, `Next match: matchday ${next.jornada}${next.local ? ', at home' : ', away'}`)}</span>}
          {h2h && h2h.n > 0 ? <><b className="du-rec">{h2h.w}<i>{L('G', 'W')}</i> {h2h.d}<i>{L('E', 'D')}</i> {h2h.l}<i>{L('P', 'L')}</i></b><small>{L(`${h2h.n} partidos entre ellos · goles ${h2h.gf}-${h2h.gc}`, `${h2h.n} meetings · goals ${h2h.gf}-${h2h.gc}`)}</small>
            <div className="du-last">{h2h.list.map((m: Any, i: number) => <span key={i} className={`r-${m.res}`} title={`${m.fecha} · ${m.h} ${m.hg}-${m.ag} ${m.a}`}>{m.res === 'G' ? L('G', 'W') : m.res === 'E' ? L('E', 'D') : L('P', 'L')}</span>)}</div></>
            : <small>{L('No se han enfrentado en la muestra.', 'They have not met in the sample.')}</small>}
        </div>
        <div className="du-side r"><div><b>{nB}</b><small>{clubOf(B.id)} {clubOf(B.id) && <ClubLogo club={clubOf(B.id)!} media={media} size={14} />}</small></div><CoachPhoto name={B.nombre} src={media.dts?.[B.id]?.foto} size={64} /></div>
      </div>

      {[['op', ops, L(`Dónde puede ganar ${sA}`, `Where ${sA} can win it`), L(`${ops.length === 1 ? 'La ventaja más clara' : 'Las ventajas más claras'} de ${sA} contra ${sB}: lo que ${sB} concede y ${sA} sabe explotar.`, `${sA}'s clearest edges against ${sB}: what ${sB} concedes and ${sA} can exploit.`)],
        ['riesgo', riesgos, L(`Qué tiene que cubrir ${sA}`, `What ${sA} must cover`), L(`Las armas de ${sB} que más pueden dañar a ${sA}.`, `${sB}'s weapons that can hurt ${sA} most.`)]].map(([tipo, lista, titulo, sub]: Any) => (
        <div key={tipo} className="card">
          <div className="tl-h"><b>{titulo}</b><span className="note">{sub}</span></div>
          {lista.length === 0 && <p className="note">{tipo === 'op' ? L(`${sB} no tiene una debilidad de estilo clara: el partido se gana con lo propio.`, `${sB} has no clear stylistic weakness: win it on your own terms.`) : L(`${sB} no tiene un arma de estilo clara.`, `${sB} has no clear stylistic weapon.`)}</p>}
          <div className="gp-grid">
            {lista.map((x: Any, i: number) => { const e = encaje(x); return (
              <div key={x.c.id} className={`gp-card ${tipo}`} style={{ ['--fc' as string]: FASE[x.c.fase][3] }}>
                <div className="gp-top"><span className="gp-n">{i + 1}</span><span className="pl-fase"><Ico name={FASE[x.c.fase][2]} />{f(L(FASE[x.c.fase][0], FASE[x.c.fase][1]))}</span></div>
                <b className="gp-t">{f(L(x.c.t[0], x.c.t[1]))}</b>
                <ul className="gp-do">{x.c.hacer.map((h: [string, string], j: number) => <li key={j}>{L(h[0], h[1])}</li>)}</ul>
                <div className="gp-why"><span>{L('Por qué', 'Why')}</span>{x.c.B.map(([k, sg_]: [string, number]) => ev(HB, k, sg_)).filter(Boolean).map((t: string, j: number) => <small key={j}>{sB} · {t}</small>)}</div>
                {e && <div className="gp-fit"><Tag t={e[0]} c={e[1]} /><small>{e[2] ? `${sA}${e[2]}` : ''}</small></div>}
                <div className="gp-watch"><Ico name="eye" />{L('Qué mirar en el partido: ', 'What to watch in the match: ')}{L(x.c.mirar[0], x.c.mirar[1])}</div>
              </div>) })}
          </div>
        </div>
      ))}

      {(vz || bTop) && <div className="card">
        <div className="tl-h"><b>{L('Balón parado', 'Set pieces')}</b></div>
        <div className="gp-grid">
          {vz && <div className="gp-card op" style={{ ['--fc' as string]: 'var(--c-ctx)' }}>
            <span className="pl-fase"><Ico name="flag" />{L(`Córners de ${sA}`, `${sA}'s corners`)}</span>
            <b className="gp-t">{L(`Apunta los córners al ${vz.zona.toLowerCase()}`, `Aim corners at the ${zEs(vz.zona)}`)}</b>
            <ul className="gp-do">
              <li>{L(`Rutina ensayada al ${vz.zona.toLowerCase()}, con tu mejor cabeceador atacando esa zona.`, `A rehearsed routine to the ${zEs(vz.zona)}, with your best header attacking it.`)}</li>
              {markB?.tipo === 'hombre' && <li>{L('Bloqueos y cortinas para soltarlo de su marcador: defienden al hombre.', 'Screens and blocks to free him from his marker: they man-mark.')}</li>}
              {markB?.tipo === 'zonal' && <li>{L('Carreras desde atrás a los huecos entre sus defensores: defienden en zona.', 'Late runs into the gaps between defenders: they mark zonally.')}</li>}
              {markB?.tipo === 'mixto' && <li>{L('Mezcla un bloqueo con una carrera desde atrás: su marca es mixta.', 'Mix a screen with a late run: their marking is mixed.')}</li>}
            </ul>
            <div className="gp-why"><span>{L('Por qué', 'Why')}</span><small>{sB} · {L(`concede ${fmt(vz.xg, 3)} xG por córner al ${vz.zona.toLowerCase()} (liga ${fmt(vz.xg_liga, 3)})`, `concedes ${fmt(vz.xg, 3)} xG per corner at the ${zEs(vz.zona)} (league ${fmt(vz.xg_liga, 3)})`)}</small><small>{sA} · {L(`manda ahí el ${fmt(myZ[vz.zona] ?? 0, 0)}% de sus córners (liga ${fmt(lgZ[vz.zona] ?? 0, 0)}%)`, `sends ${fmt(myZ[vz.zona] ?? 0, 0)}% of his corners there (league ${fmt(lgZ[vz.zona] ?? 0, 0)}%)`)}</small></div>
          </div>}
          {bTop && <div className="gp-card riesgo" style={{ ['--fc' as string]: 'var(--c-ctx)' }}>
            <span className="pl-fase"><Ico name="shield" />{L(`Córners de ${sB}`, `${sB}'s corners`)}</span>
            <b className="gp-t">{L(`En sus córners, cubre el ${bTop.toLowerCase()}`, `On their corners, cover the ${zEs(bTop)}`)}</b>
            <ul className="gp-do"><li>{L(`Tu mejor defensor aéreo fijo en el ${bTop.toLowerCase()}.`, `Your best aerial defender fixed on the ${zEs(bTop)}.`)}</li>
              {markA?.tipo === 'hombre' && <li>{L(`${sA} marca al hombre: ojo con sus bloqueos, cambia de marca si hace falta.`, `${sA} man-marks: watch their screens and switch markers if needed.`)}</li>}
              {markA?.tipo === 'zonal' && <li>{L(`${sA} marca en zona: alguien tiene que salir al que llega desde atrás.`, `${sA} marks zonally: someone must pick up the late runner.`)}</li>}</ul>
            <div className="gp-why"><span>{L('Por qué', 'Why')}</span><small>{sB} · {L(`manda el ${fmt(bZ[bTop], 0)}% de sus córners al ${bTop.toLowerCase()} (liga ${fmt(lgZ[bTop] ?? 0, 0)}%)`, `sends ${fmt(bZ[bTop], 0)}% of corners to the ${zEs(bTop)} (league ${fmt(lgZ[bTop] ?? 0, 0)}%)`)}</small></div>
          </div>}
        </div>
      </div>}

      <div className="card">
        <div className="tl-h"><b>{L(`Momentos del partido: cómo cambia ${quienN} según el marcador y el minuto`, `Match moments: how ${quienN} changes with score and minute`)}</b>
          <Info wide>{L('Cada celda: el rasgo de esa faceta que más se separa del promedio de la liga en esa misma situación (en desviaciones típicas), ya sin el efecto de sus jugadores. Presión: ▲ = presiona más. Color: verde = bueno para él (más xG a favor, menos en contra), rojo = malo; en el resto, verde = más que la liga. Sólo situaciones con 40 tramos o más. Debajo, los momentos en que más cambia y qué hacer.', 'Each cell: the trait in that facet that moves furthest from the league average in that same situation (in standard deviations), net of his players. Pressing: ▲ = presses more. Colour: green = good for him (more xG for, less against), red = bad; elsewhere, green = more than the league. Only situations with 40+ spells. Below, the moments he changes most and what to do.')}</Info>
          <span style={{ marginLeft: 'auto' }}><div className="seg sm" role="group"><button aria-pressed={quien === 'el'} onClick={() => setQuien('el')}>{sB}</button><button aria-pressed={quien === 'tu'} onClick={() => setQuien('tu')}>{sA}</button></div></span></div>
        {Object.values(R.cell).some(c => Object.keys(c).length) && <div className="ti-heat">
          <table className="ti-tbl du-tbl">
            <thead><tr><th className="l" />{SITS.map(([dim, lvl, , , sh]) => <th key={dim + lvl} className={lvl === "0-30'" ? 'sep' : ''}>{sh}</th>)}</tr></thead>
            <tbody>{FROWS.map(([f, es, en]) => (
              <tr key={f}><td className="l">{L(es, en)}</td>
                {SITS.map(([dim, lvl]) => {
                  const xs = [...(R.cell[`${dim}|${lvl}`]?.[f] ?? [])].sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
                  const best = xs[0]
                  const v = best ? (best.k === 'ppda' ? -best.d : best.d) : null
                  const good = best ? (best.k === 'xg_contra_90' ? -1 : 1) * (v ?? 0) : 0
                  return <td key={dim + lvl} className={lvl === "0-30'" ? 'sep' : ''} style={{ background: v == null ? 'transparent' : `color-mix(in oklab, ${good >= 0 ? 'var(--div-pos)' : 'var(--div-neg)'} ${Math.round(8 + Math.min(1, Math.abs(v) / 1.2) * 52)}%, var(--surface))` }} title={best ? `${kName(best.k, glob)} ${sg(best.d)}σ` : ''}>{best ? <><small>{best.k === 'ppda' ? L('Presión', 'Pressing') : kName(best.k, glob)}</small>{v! >= 0 ? '▲' : '▼'}{fmt(Math.abs(v!), 1)}</> : '—'}</td>
                })}
              </tr>))}</tbody>
          </table>
        </div>}
        {quien === 'el' && bench != null && <p className="note">{L(`${nB} hace su primer cambio hacia el ${fmt(bench, 0)}' (liga ${fmt(benchL, 0)}').`, `${nB} makes his first sub around ${fmt(bench, 0)}' (league ${fmt(benchL, 0)}').`)}</p>}
        <div className="du-moments">
          {R.top.map((o, i) => {
            const s = SITS.find(x => `${x[0]}|${x[1]}` === o.sit)!
            const up = o.d >= 0
            const r = REC[o.k]?.[up ? 0 : 1]
            const txt = r ? f(L(r[0], r[1]), qX, qY) : kName(o.k, glob)
            return <div key={i} className="du-mo"><span className="du-mi">{i + 1}</span><span><b>{f(L(s[2], s[3]), qX, qY)}</b>{`, ${qX} `}{txt} <em className={up ? 'up' : 'dn'}>{kName(o.k, glob)} {sg(o.d)}σ</em></span></div>
          })}
          {R.top.length === 0 && <p className="note">{L('No cambia de forma clara según el marcador ni el minuto.', 'He does not change clearly with score or minute.')}</p>}
        </div>
      </div>
    </div>
  )
}
