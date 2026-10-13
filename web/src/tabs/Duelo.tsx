import { useEffect, useMemo, useState } from 'react'
import { ClubLogo, CoachPhoto } from '../charts'
import { similares } from '../Compare'
import { chatBus } from '../chatBus'
import { Ico } from '../icons'
import Info from '../Info'
import { dataUrl, fmt, getJSON, nombreDT, shortName, type Any } from '../lib'
import { L, LANG } from '../settings'
import { kName } from './resumenKit'
import '../styles/tl.css'
import '../styles/plan.css'

/* Cara a cara · «¿Cómo debería jugar A contra B?». A = el DT que estás viendo; B = el rival
   (un técnico o el DT actual de un equipo). Todo sale del estilo propio (α) de los dos, de las
   claves de plan.json, de sus curvas de reacción al marcador y al minuto, y de bp2.json. */

const ap = (a: Any) => Object.fromEntries((a?.huella ?? []).map((h: Any) => [h.kpi, h.alpha])) as Record<string, number>
const sg = (v: number) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), 2)}`
const tx = (a: Any, k: string) => (LANG === 'en' ? a[`${k}_en`] : a[k]) ?? a[k]

/* Qué tiene que hacer el rival para aplicar cada clave de plan.py: [kpi, signo] de SU estilo. */
const NEED: Record<string, [string, number][]> = {
  salida_corta_debil: [['altura_presion', 1], ['ppda', -1]], salida_corta_buena: [['compacidad_360', -1]], sale_largo: [['linea_360', 1]],
  cambios_frente: [['compacidad_360', -1]], posesion: [['contraataque', 1], ['posesion', -1]], presiona_alto: [['pase_largo', 1], ['verticalidad', 1]],
  linea_alta: [['verticalidad', 1], ['contraataque', 1]], linea_baja: [['posesion', 1], ['centros', 1]], bloque_largo: [['progresivos', 1], ['conduccion_prog', 1]],
  bloque_corto: [['progresion_banda', 1], ['cambios_orientacion', 1]], contrapresion: [['verticalidad', 1], ['pase_largo', 1]], concede_contras: [['contraataque', 1]],
  contragolpea: [['transicion_def', -1], ['contrapresion', 1]], recupera_rapido: [['tempo', 1]],
}
function fitOf(id: string, al: Record<string, number>) {
  const need = NEED[id]
  if (!need) return null
  const parts = need.filter(([k]) => al[k] != null).map(([k, s]) => ({ k, v: al[k] * s }))
  if (!parts.length) return null
  const score = parts.reduce((a, p) => a + p.v, 0) / parts.length
  return { score, parts, tipo: score >= 0.2 ? 'si' : score <= -0.2 ? 'no' : 'neutro' }
}

/* Duelos directos entre un rasgo de quien ataca y uno de quien defiende. Textos desde el punto de vista de A. */
type Caso = 'ambos' | 'ataque' | 'defensa' | 'ninguno'
type Duel = { id: string; fase: 'con' | 'sin' | 'trans'; t: [string, string]; att: 'A' | 'B'; x: [string, number]; y: [string, number]; txt: Record<Caso, [string, string]> }
const DUELS: Duel[] = [
  { id: 'salida', fase: 'con', t: ['Tu salida corta contra su presión', 'Your short build-up vs his press'], att: 'A', x: ['salida_corta', 1], y: ['ppda', -1], txt: {
    ambos: ['Duelo clave: sales corto y él presiona alto. Prepara el plan B (saque largo o un pivote extra).', 'Key duel: you build short and he presses high. Have a plan B ready (long goal kick or an extra pivot).'],
    ataque: ['Puedes salir corto con calma: él no presiona tanto.', 'You can build short calmly: he does not press that much.'],
    defensa: ['Él presiona alto y tú sueles salir largo: gana la segunda jugada.', 'He presses high and you usually go long: win the second ball.'],
    ninguno: ['Ni sales corto ni él presiona arriba: la salida no decide este partido.', 'You do not build short and he does not press high: build-up will not decide this one.'] } },
  { id: 'profundidad', fase: 'con', t: ['Tu juego directo contra su línea', 'Your direct play vs his line'], att: 'A', x: ['verticalidad', 1], y: ['linea_360', 1], txt: {
    ambos: ['Él adelanta la línea y tú juegas directo: la espalda de su defensa es tu partido.', 'He pushes his line up and you play direct: the space behind his defence is your game.'],
    ataque: ['Juegas directo, pero él defiende cerca de su área: el espacio estará delante, no detrás.', 'You play direct, but he defends near his box: the space will be in front, not behind.'],
    defensa: ['Él adelanta la línea; aunque no es tu costumbre, los balones a la espalda pagan.', 'He pushes his line up; even if it is not your habit, balls in behind pay off.'],
    ninguno: ['Ni juegas tan directo ni él adelanta la línea: será un partido de posesión.', 'You are not that direct and he does not push up: expect a possession game.'] } },
  { id: 'bandas', fase: 'con', t: ['Tu ataque por fuera contra su bloque', 'Your wide attack vs his block'], att: 'A', x: ['progresion_banda', 1], y: ['compacidad_360', -1], txt: {
    ambos: ['Su bloque es compacto por dentro y tú atacas por fuera: tu camino natural es el bueno.', 'His block is compact inside and you attack wide: your natural route is the right one.'],
    ataque: ['Atacas por fuera contra un bloque que no siempre cierra: usa la amplitud.', 'You attack wide against a block that does not always close: use the width.'],
    defensa: ['Su bloque es compacto: tendrás que abrir el campo más de lo que sueles.', 'His block is compact: you will need to stretch the pitch more than usual.'],
    ninguno: ['El partido no se decide por las bandas: busca dentro.', 'The game will not be decided on the wings: look inside.'] } },
  { id: 'contras', fase: 'trans', t: ['Tus contragolpes contra su pérdida', 'Your counters vs his ball losses'], att: 'A', x: ['contraataque', 1], y: ['transicion_def', 1], txt: {
    ambos: ['Tú contragolpeas y a él le llegan rápido tras perder: es tu arma principal.', 'You counter and teams get at him fast after he loses it: it is your main weapon.'],
    ataque: ['Contragolpeas mucho, pero él se protege bien tras perder: elige bien cuándo salir.', 'You counter a lot, but he protects well after losing it: pick your moments.'],
    defensa: ['A él le llegan rápido tras perder: aunque no es tu fuerte, ten dos listos para correr.', 'Teams get at him fast after he loses it: even if it is not your strength, keep two ready to run.'],
    ninguno: ['Las transiciones no serán decisivas: ataque posicional.', 'Transitions will not be decisive: positional attack.'] } },
  { id: 'posesion', fase: 'sin', t: ['Su posesión contra tu presión', 'His possession vs your press'], att: 'B', x: ['posesion', 1], y: ['ppda', -1], txt: {
    ambos: ['Él quiere el balón y tú presionas: el partido se decide en su salida.', 'He wants the ball and you press: the game is decided in his build-up.'],
    ataque: ['Él tendrá el balón y tú no presionas alto: bloque compacto y a la contra.', 'He will have the ball and you do not press high: compact block and counter.'],
    defensa: ['Tú presionas y él no elabora tanto: le vas a robar arriba.', 'You press and he does not build that patiently: you will win it high.'],
    ninguno: ['Nadie domina el balón ni la presión: partido abierto.', 'Neither side dominates the ball or the press: an open game.'] } },
  { id: 'sus_contras', fase: 'trans', t: ['Sus contragolpes contra tu pérdida', 'His counters vs your ball losses'], att: 'B', x: ['contraataque', 1], y: ['transicion_def', 1], txt: {
    ambos: ['Peligro: él contragolpea y a ti te llegan rápido tras perder. Deja 2+1 atrás cuando ataques.', 'Danger: he counters and teams get at you fast after you lose it. Keep 2+1 back when attacking.'],
    ataque: ['Él contragolpea, pero tú te proteges bien tras perder: mantén ese equilibrio.', 'He counters, but you protect well after losing it: keep that balance.'],
    defensa: ['A ti te llegan rápido tras perder, aunque él no vive del contragolpe.', 'Teams get at you fast after you lose it, though he does not live off counters.'],
    ninguno: ['Sus contras no son su arma principal ni tu punto débil.', 'His counters are neither his main weapon nor your weak spot.'] } },
]
const FASE: Record<string, [string, string, string, string]> = { con: ['Cuando tú tienes el balón', 'When you have the ball', 'ball', 'var(--c-dt)'], sin: ['Cuando él tiene el balón', 'When he has the ball', 'shield', 'var(--c-club)'], trans: ['Transiciones', 'Transitions', 'bolt', 'var(--c-rival)'] }

/* Reacciones al marcador / minuto: qué implica para el rival cada cambio del DT. */
const KF: Record<string, 'con' | 'sin' | 'trans' | 'peligro'> = { posesion: 'con', verticalidad: 'con', pase_largo: 'con', field_tilt: 'con', ppda: 'sin', altura_presion: 'sin', linea_360: 'sin', contraataque: 'trans', xg_90: 'peligro', xg_contra_90: 'peligro' }
const REC: Record<string, [[string, string], [string, string]]> = {
  posesion: [['busca más el balón: bloque compacto y a la contra', 'wants more of the ball: compact block and counter'], ['te cede el balón: ten un plan para atacar en estático', 'gives you the ball: have a plan to break a set defence']],
  verticalidad: [['juega más directo: defiende la profundidad y la segunda jugada', 'plays more directly: defend depth and second balls'], ['elabora más: presiona su primer pase', 'builds more patiently: press his first pass']],
  pase_largo: [['tira más balones largos: centrales fuertes por arriba', 'plays more long balls: strong aerial centre-backs'], ['juega más corto: presión tras pérdida', 'plays shorter: press right after losing it']],
  field_tilt: [['se mete más en tu campo: prepara salidas rápidas', 'camps more in your half: prepare fast exits'], ['se mete menos en tu campo: puedes adelantar líneas', 'camps less in your half: you can push up']],
  ppda: [['presiona menos: sal jugando', 'presses less: play out from the back'], ['presiona más: salida larga o con pivote extra', 'presses more: go long or add a pivot']],
  altura_presion: [['presiona más arriba: hay espacio a la espalda de su presión', 'presses higher: there is space behind his press'], ['espera más atrás: tendrás el balón en tu campo', 'waits deeper: you will have the ball in your half']],
  linea_360: [['adelanta la línea: balones a la espalda', 'pushes his line up: balls in behind'], ['hunde la línea: centros y tiros de media distancia', 'drops his line: crosses and mid-range shots']],
  contraataque: [['contragolpea más: cuida la pérdida', 'counters more: protect against losing it'], ['contragolpea menos: puedes subir a los laterales', 'counters less: you can push your full-backs on']],
  xg_90: [['genera más peligro: refuerza el área', 'creates more danger: reinforce the box'], ['genera menos peligro', 'creates less danger']],
  xg_contra_90: [['concede más: es el momento de atacarlo', 'concedes more: it is the moment to attack him'], ['concede menos: ten paciencia', 'concedes less: be patient']],
}
const SITS: [string, string, string, string, string][] = [
  ['marcador', 'Perdiendo', 'Cuando él va perdiendo', 'When he is losing', L('Perdiendo', 'Losing')], ['marcador', 'Empatando', 'Con el empate', 'When level', L('Empate', 'Level')], ['marcador', 'Ganando', 'Cuando él va ganando', 'When he is winning', L('Ganando', 'Winning')],
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
  const name = (id: number, full?: string) => { const n = nombreDT(id, full); return n ? n.apellidos.split(' ')[0] : shortName(full ?? '') }
  const A = art
  const nA = name(A.id, A.nombre), nB = B ? name(B.id, B.nombre) : ''
  const aA = ap(A), aB = ap(B)
  const setRival = (b: number | undefined) => { if (b && b !== A.id) setPick({ a: A.id, b }) }

  const h2h = useMemo(() => {
    if (!pp || !rid) return null
    const rows: Any[] = pp.rows.filter((r: Any[]) => (r[10] === A.id && r[11] === rid) || (r[10] === rid && r[11] === A.id))
    let w = 0, d = 0, l = 0, gf = 0, gc = 0
    const list = rows.map(r => { const home = r[10] === A.id; const f = home ? r[6] : r[7], c = home ? r[7] : r[6]; gf += f; gc += c; if (f > c) w++; else if (f === c) d++; else l++; return { fecha: r[0], h: r[4], a: r[5], hg: r[6], ag: r[7], res: f > c ? 'G' : f === c ? 'E' : 'P' } })
    return { n: rows.length, w, d, l, gf, gc, list: list.slice(-5).reverse() }
  }, [pp, rid, A.id])

  const pickRow = (
    <div className="du-pick">
      <span className="note">{L('Rival:', 'Opponent:')}</span>
      <div className="du-clubs">{Object.entries(byClub).filter(([c]) => c !== myClub).sort((a, b) => a[0].localeCompare(b[0])).map(([c, id]) => (
        <button key={c} className={id === rid ? 'on' : ''} title={`${c} · ${glob.dts.find((d: Any) => d.id === id)?.nombre ?? ''}`} onClick={() => setRival(id)}><ClubLogo club={c} media={media} size={22} /></button>))}</div>
      <select value={rid ?? ''} onChange={e => setRival(Number(e.target.value))} aria-label={L('Elegir técnico rival', 'Pick the opposing coach')}>
        {[...(glob.dts as Any[])].filter(d => d.id !== A.id).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(d => <option key={d.id} value={d.id}>{d.nombre}{clubOf(d.id) ? ` · ${clubOf(d.id)}` : ''}</option>)}
      </select>
    </div>
  )
  if (!rid) return <div className="card note">{L('Elige un rival.', 'Pick an opponent.')}</div>
  if (B === false) return <div className="pl">{pickRow}<div className="card note">{L('No se pudo cargar a ese técnico.', 'Could not load that coach.')}</div></div>
  if (!B) return <div className="pl">{pickRow}<div className="card note">{L('Cargando…', 'Loading…')}</div></div>

  const pB = plan?.dts?.[String(B.id)], pA = plan?.dts?.[String(A.id)]
  const tusClaves = (pB?.acciones ?? []).map((a: Any) => ({ a, f: fitOf(a.id, aA) }))
  const susClaves = (pA?.acciones ?? []).map((a: Any) => ({ a, f: fitOf(a.id, aB) }))
  const duels = DUELS.map(d => {
    const att = d.att === 'A' ? aA : aB, def = d.att === 'A' ? aB : aA
    const x = (att[d.x[0]] ?? 0) * d.x[1], y = (def[d.y[0]] ?? 0) * d.y[1]
    const caso: Caso = x >= 0.25 && y >= 0.25 ? 'ambos' : x >= 0.25 ? 'ataque' : y >= 0.25 ? 'defensa' : 'ninguno'
    // ¿a quién favorece? A ataca: ataque = A; defensa = B. B ataca: al revés. ambos = choque.
    const fav = caso === 'ambos' ? 'choque' : caso === 'ninguno' ? 'neutro' : (caso === 'ataque') === (d.att === 'A') ? 'tu' : 'el'
    return { d, x, y, caso, fav }
  })
  // balón parado: su zona más débil frente a dónde mandas tus córners
  const vul = (bp2?.dts?.[String(B.id)]?.vulnerable ?? []).filter((z: Any) => z.xg != null && z.n >= 15)
  const vz = vul.length ? vul.reduce((a: Any, b: Any) => (b.xg - b.xg_liga > a.xg - a.xg_liga ? b : a)) : null
  const myZ = A.balon_parado?.ofensivo?.corner_zonas ?? {}, lgZ = A.balon_parado?.liga?.corner_zonas ?? {}
  const markB = bp2?.dts?.[String(B.id)]?.marcaje
  const R = reactions(quien === 'el' ? B : A)
  const bench = B.jugadores?.minuto_cambios?.['1']
  const benchL = B.jugadores?.minuto_cambios_liga?.['1']
  const quienN = quien === 'el' ? nB : nA
  const FavTag = ({ f }: { f: string }) => <span className={`du-tag ${f}`}>{f === 'tu' ? L('a tu favor', 'in your favour') : f === 'el' ? L('a su favor', 'in his favour') : f === 'choque' ? L('choque', 'clash') : L('parejo', 'even')}</span>
  const FitTag = ({ f, mine }: { f: Any; mine: boolean }) => !f ? <span className="du-tag neutro">{L('depende de cómo lo prepares', 'depends on your preparation')}</span>
    : <span className={`du-tag ${f.tipo === 'si' ? (mine ? 'tu' : 'el') : f.tipo === 'no' ? (mine ? 'el' : 'tu') : 'neutro'}`}>{f.tipo === 'si' ? (mine ? L('ya lo haces', 'you already do it') : L('él lo hace', 'he does it')) : f.tipo === 'no' ? (mine ? L('va contra tu estilo', 'goes against your style') : L('no es lo suyo', 'not his thing')) : L('ni sí ni no', 'neither')}</span>
  const zEs = (z: string) => L(z, ({ 'Primer palo': 'near post', 'Área chica': 'six-yard box', 'Punto penal': 'penalty spot', 'Segundo palo': 'far post', Corto: 'short' } as Record<string, string>)[z] ?? z)

  return (
    <div className="pl">
      <div className="pl-lead">
        <h3 className="h2">{L(`Cómo debería jugar ${nA} contra ${nB}`, `How ${nA} should play against ${nB}`)}
          <Info wide><p>{L('Se cruzan los dos sellos (estilo con jugadores, club y rival promedio): las claves para jugarle a cada uno, si el otro ya juega así, los duelos directos por fase y cómo reacciona el rival según el marcador y el minuto. Son tendencias de toda su carrera, no una predicción del partido.', 'The two imprints are crossed (style with average players, club and opponent): the keys to play each of them, whether the other already plays that way, the direct duels by phase and how the opponent reacts by score and minute. They are career-long tendencies, not a match prediction.')}</p></Info></h3>
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

      <div className="tl-grid">
        <div className="card">
          <div className="tl-h"><b>{L(`Las claves para jugarle a ${nB}, y si tú ya juegas así`, `The keys to play ${nB}, and whether you already play that way`)}</b></div>
          {tusClaves.length === 0 && <p className="note">{L('Su estilo no tiene rasgos lo bastante claros.', 'His style has no clear enough traits.')}</p>}
          {tusClaves.map(({ a, f }: Any) => (
            <div key={a.id} className="du-key"><span className="du-kt"><b>{tx(a, 'titulo')}</b><small>{tx(a, 'texto')}</small></span>
              <span className="du-kf"><FitTag f={f} mine />{f && <small>{f.parts.map((p: Any) => `${kName(p.k, glob)} ${sg(p.v)}σ`).join(' · ')}</small>}</span></div>
          ))}
        </div>
        <div className="card">
          <div className="tl-h"><b>{L(`Lo que más te duele a ti, y si ${nB} lo hace`, `What hurts you most, and whether ${nB} does it`)}</b></div>
          {susClaves.length === 0 && <p className="note">{L('Tu estilo no tiene rasgos lo bastante claros.', 'Your style has no clear enough traits.')}</p>}
          {susClaves.map(({ a, f }: Any) => (
            <div key={a.id} className="du-key"><span className="du-kt"><b>{tx(a, 'titulo')}</b><small>{tx(a, 'texto')}</small></span>
              <span className="du-kf"><FitTag f={f} mine={false} />{f && <small>{f.parts.map((p: Any) => `${kName(p.k, glob)} ${sg(p.v)}σ`).join(' · ')}</small>}</span></div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="tl-h"><b>{L('Duelos por fase', 'Duels by phase')}</b><Info>{L('Cada duelo cruza un rasgo de quien ataca con uno de quien defiende (estilo propio, en desviaciones típicas frente al DT promedio). Cuenta como claro desde 0.25.', 'Each duel crosses a trait of the attacker with one of the defender (own style, in standard deviations vs the average coach). It counts as clear from 0.25.')}</Info></div>
        <div className="du-duels">
          {duels.map(({ d, x, y, caso, fav }) => (
            <div key={d.id} className="du-duel" style={{ ['--fc' as string]: FASE[d.fase][3] }}>
              <span className="pl-fase"><Ico name={FASE[d.fase][2]} />{L(FASE[d.fase][0], FASE[d.fase][1])}</span>
              <b className="du-dt">{L(d.t[0], d.t[1])}</b>
              <div className="du-vs"><span>{d.att === 'A' ? nA : nB} · {kName(d.x[0], glob)} <em>{sg(x)}</em></span><span>{d.att === 'A' ? nB : nA} · {d.y[0] === 'ppda' ? L('Presión', 'Pressing') : kName(d.y[0], glob)} <em>{sg(y)}</em></span></div>
              <p>{L(d.txt[caso][0], d.txt[caso][1])}</p>
              <FavTag f={fav} />
            </div>
          ))}
          {vz && <div className="du-duel" style={{ ['--fc' as string]: 'var(--c-ctx)' }}>
            <span className="pl-fase"><Ico name="flag" />{L('A balón parado', 'At set pieces')}</span>
            <b className="du-dt">{L('Tus córners contra su zona débil', 'Your corners vs his weak zone')}</b>
            <div className="du-vs"><span>{nB} · {zEs(vz.zona)}: xG {fmt(vz.xg, 3)} <em>{L('liga', 'lg')} {fmt(vz.xg_liga, 3)}</em></span><span>{nA} · {L('mandas ahí el', 'you send there')} <em>{fmt(myZ[vz.zona] ?? 0, 0)}%</em> ({L('liga', 'lg')} {fmt(lgZ[vz.zona] ?? 0, 0)}%)</span></div>
            <p>{(myZ[vz.zona] ?? 0) >= (lgZ[vz.zona] ?? 0) + 3 ? L('Ya cargas esa zona más que la liga: insiste ahí.', 'You already load that zone more than the league: keep at it.') : L('Casi no mandas ahí: vale la pena preparar una jugada a esa zona.', 'You rarely go there: it is worth preparing a routine to that zone.')}{markB?.tipo ? ` ${L(`Él marca ${markB.tipo === 'hombre' ? 'al hombre: usa bloqueos' : markB.tipo === 'zonal' ? 'en zona: ataca los huecos con carreras desde atrás' : 'mixto'}.`, `He marks ${markB.tipo === 'hombre' ? 'man-to-man: use screens' : markB.tipo === 'zonal' ? 'zonally: attack the gaps with late runs' : 'mixed'}.`)}` : ''}</p>
            <FavTag f={(myZ[vz.zona] ?? 0) >= (lgZ[vz.zona] ?? 0) + 3 ? 'tu' : 'neutro'} />
          </div>}
        </div>
      </div>

      <div className="card">
        <div className="tl-h"><b>{L(`Cómo cambia ${quienN} según el marcador y el minuto`, `How ${quienN} changes with score and minute`)}</b>
          <Info wide>{L('Cada celda: el rasgo de esa faceta que más se separa del promedio de la liga en esa misma situación (en desviaciones típicas), ya sin el efecto de sus jugadores. Presión: ▲ = presiona más. Sólo situaciones con 40 tramos o más. Debajo, los momentos en que más cambia y qué hacer.', 'Each cell: the trait in that facet that moves furthest from the league average in that same situation (in standard deviations), net of his players. Pressing: ▲ = presses more. Only situations with 40+ spells. Below, the moments he changes most and what to do.')}</Info>
          <span style={{ marginLeft: 'auto' }}><div className="seg sm" role="group"><button aria-pressed={quien === 'el'} onClick={() => setQuien('el')}>{nB}</button><button aria-pressed={quien === 'tu'} onClick={() => setQuien('tu')}>{nA}</button></div></span></div>
        {Object.values(R.cell).some(c => Object.keys(c).length) && <div className="ti-heat">
          <table className="ti-tbl du-tbl">
            <thead><tr><th className="l" />{SITS.map(([dim, lvl, , , sh]) => <th key={dim + lvl} className={lvl === "0-30'" ? 'sep' : ''}>{sh}</th>)}</tr></thead>
            <tbody>{FROWS.map(([f, es, en]) => (
              <tr key={f}><td className="l">{L(es, en)}</td>
                {SITS.map(([dim, lvl]) => {
                  const xs = [...(R.cell[`${dim}|${lvl}`]?.[f] ?? [])].sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
                  const best = xs[0]
                  const v = best ? (best.k === 'ppda' ? -best.d : best.d) : null
                  return <td key={dim + lvl} className={lvl === "0-30'" ? 'sep' : ''} style={{ background: v == null ? 'transparent' : `color-mix(in oklab, ${v >= 0 ? 'var(--div-pos)' : 'var(--div-neg)'} ${Math.round(8 + Math.min(1, Math.abs(v) / 1.2) * 52)}%, var(--surface))` }} title={best ? `${kName(best.k, glob)} ${sg(best.d)}σ` : ''}>{best ? <><small>{best.k === 'ppda' ? L('Presión', 'Pressing') : kName(best.k, glob)}</small>{v! >= 0 ? '▲' : '▼'}{fmt(Math.abs(v!), 1)}</> : '—'}</td>
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
            const txt = r ? (quien === 'el' ? L(r[0], r[1]) : L(r[0], r[1]).split(':')[0]) : kName(o.k, glob)
            return <div key={i} className="du-mo"><span className="du-mi">{i + 1}</span><span><b>{quien === 'el' ? L(s[2], s[3]) : L(s[2], s[3]).replace(L('él va', 'he is'), L('vas', 'you are'))}</b>{quien === 'el' ? `, ${nB} ` : ', '}{txt} <em className={up ? 'up' : 'dn'}>{kName(o.k, glob)} {sg(o.d)}σ</em></span></div>
          })}
          {R.top.length === 0 && <p className="note">{L('No cambia de forma clara según el marcador ni el minuto.', 'He does not change clearly with score or minute.')}</p>}
        </div>
      </div>
    </div>
  )
}
