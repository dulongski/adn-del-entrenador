import { useEffect, useMemo, useState } from 'react'
import { ClubLogo } from '../charts'
import { Ico, type IconName } from '../icons'
import Info from '../Info'
import { dataUrl, fmt, real, getJSON, jugadorCorto, shortName, type Any } from '../lib'
import { L, LANG } from '../settings'
import { kName } from './resumenKit'
import '../styles/tl.css'
import '../styles/plan.css'

/* Accionable (pipeline/plan.py → plan.json): cómo jugarle, qué plantilla le conviene y un tablero
   para vigilar si sigue siendo él. Todo sale de su sello (α), ya sin el efecto de sus jugadores. */

const faseTxt = (f: string, n: string) => f === 'con' ? L(`Cuando ${n} tiene el balón`, `When ${n} has the ball`) : f === 'sin' ? L(`Cuando su rival tiene el balón`, `When his opponent has the ball`) : f === 'trans' ? L('En las transiciones', 'In transitions') : f === 'bp' ? L('A balón parado', 'At set pieces') : L('Durante el partido', 'During the match')

export function usePlan(id: number) {
  const [d, setD] = useState<Any>(null)
  useEffect(() => { setD(null); getJSON(dataUrl('plan.json')).then(p => setD(p.dts?.[String(id)] ? { ...p.dts[String(id)], meta: p } : false)).catch(() => setD(false)) }, [id])
  return d
}

const ORDEN = ['con', 'sin', 'trans', 'bp', 'partido']
const FASE_IC: Record<string, IconName> = { con: 'ball', sin: 'shield', trans: 'bolt', bp: 'flag', partido: 'clock' }
const FASE_C: Record<string, string> = { con: 'var(--c-dt)', sin: 'var(--c-club)', trans: 'var(--c-rival)', bp: 'var(--c-ctx)', partido: 'var(--c-plantilla)' }
const tx = (a: Any, k: 'titulo' | 'texto', n = '') => String((LANG === 'en' ? a[`${k}_en`] : a[k]) ?? a[k]).split('{N}').join(n)
export const surname = (full: string) => shortName(full).split(' ').slice(1).join(' ') || shortName(full)
const ZONA_EN: Record<string, string> = { 'Primer palo': 'Near post', 'Área chica': 'Six-yard box', 'Punto penal': 'Penalty spot', 'Segundo palo': 'Far post', Corto: 'Short' }
const zona = (z: string) => L(z, ZONA_EN[z] ?? z)
const pctTxt = (p?: number | null) => (p == null ? '' : p >= 50 ? L(`más alto que el ${fmt(p, 0)}% de los DTs`, `higher than ${fmt(p, 0)}% of coaches`) : L(`más bajo que el ${fmt(100 - p, 0)}% de los DTs`, `lower than ${fmt(100 - p, 0)}% of coaches`))

function Evidence({ a, glob }: { a: Any; glob: Any }) {
  const ev: Any[] = a.evidencia ?? []
  if (a.id === 'contexto') {
    const e = ev[0]
    return <div className="pl-ev"><span><b>{kName(e.kpi, glob)}</b> · {e.nivel}</span><em className={e.dif >= 0 ? 'up' : 'dn'}>{real(e.kpi, e.dif)} {L('frente a la liga', 'vs the league')}</em></div>
  }
  if (a.id === 'bp_vulnerable') { const e = ev[0]; return <div className="pl-ev"><span><b>{zona(e.zona)}</b> · {e.n} {L('córners en contra', 'corners against')}</span><em>xG {fmt(e.xg, 3)} · {L('liga', 'league')} {fmt(e.xg_liga, 3)}</em></div> }
  if (a.id === 'bp_marcaje') { const e = ev[0]; return <div className="pl-ev"><span><b>{fmt(e.pegados_pct, 0)}%</b> {L('de sus defensores pegados a un rival', 'of his defenders tight to an opponent')}</span><em>{e.n} {L('córners con 360', 'corners with 360')}</em></div> }
  if (a.id === 'bp_sus_corners') { const e = ev[0]; return <div className="pl-ev"><span><b>{zona(e.zona)}</b></span><em>{fmt(e.pct, 0)}% · {L('liga', 'league')} {fmt(e.liga, 0)}%</em></div> }
  if (a.id === 'bp_banda') { const e = ev[0]; return <div className="pl-ev"><span><b>{fmt(e.al_area_pct, 0)}%</b> {L('al área', 'into the box')}</span><em>{pctTxt(e.pct)}</em></div> }
  if (a.id === 'banca') { const e = ev[0]; return <div className="pl-ev"><span>{L('Primer cambio', 'First sub')} <b>{fmt(e.primer_cambio, 0)}'</b> · {L('liga', 'league')} {fmt(e.liga, 0)}'</span><em>{fmt(e.ofensivos_perdiendo, 0)}% {L('ofensivos si pierde', 'attacking when losing')}</em></div> }
  return (
    <>{ev.map(e => (
      <div key={e.kpi} className="pl-ev">
        <span><b>{kName(e.kpi, glob)}</b> · {L('su sello', 'his imprint')} <b>{e.sello}</b> · {L('liga', 'league')} {e.liga}</span>
        <em>{pctTxt(e.pct)}</em>
      </div>
    ))}</>
  )
}

export function PlanJuego({ art, glob }: { art: Any; glob: Any }) {
  const d = usePlan(art.id)
  if (d === false) return <div className="card note">{L('Aún no hay plan para este DT.', 'No plan for this coach yet.')}</div>
  if (!d) return <div className="card note">{L('Cargando…', 'Loading…')}</div>
  const acc: Any[] = d.acciones
  const maxF = Math.max(...acc.map(a => a.fuerza ?? 0), 1)
  // por situación de juego, en el orden en que se prepara un partido; numeradas en ese mismo orden
  const orden = ORDEN.flatMap(fa => acc.filter(a => a.fase === fa))
  return (
    <div className="pl">
      <div className="pl-lead">
        <h3 className="h2">{L(`Cómo jugarle a ${shortName(art.nombre)}`, `How to play against ${shortName(art.nombre)}`)}</h3>
<div className="tab-sub"><p>{L('Cada clave sale de una regla escrita de antemano: si un rasgo de su sello es claro (al menos 0.25 desviaciones típicas y 1.64 veces su error estándar), la regla propone qué hacer en contra. Su sello es su estilo con jugadores, club y rival promedio, así que no depende de quién tenga hoy en la plantilla.', 'Each key comes from a rule written in advance: if a trait of his imprint is clear (at least 0.25 standard deviations and 1.64 times its standard error), the rule proposes what to do against it. His imprint is his style with average players, club and opponent, so it does not depend on who is in the squad today.')}</p>
            <p>{L(`Se muestran todas las que activa, agrupadas por situación de juego y, dentro de cada una, de la más clara a la menos clara (la barra de la esquina). Este DT activó ${d.todas} reglas. A balón parado se usan sus córners en contra (360) y sus saques; en el partido, cómo reacciona al marcador y cuándo mueve el banco.`, `All the rules he triggers are shown, grouped by game phase and, within each, from clearest to least clear (the bar in the corner). This coach triggered ${d.todas} rules. At set pieces we use his corners against (360) and his throw-ins; in-game, how he reacts to the score and when he goes to the bench.`)}</p></div>
        <p className="note">{L(`Recomendaciones para el técnico que enfrente a ${shortName(art.nombre)}. Cada clave lleva la evidencia que la sostiene.`, `Recommendations for the coach facing ${shortName(art.nombre)}. Every key carries the evidence behind it.`)}</p>
      </div>
      {ORDEN.filter(fa => acc.some(a => a.fase === fa)).map(fa => (
        <section key={fa} className="pl-sec" style={{ ['--fc' as string]: FASE_C[fa] }}>
          <h4 className="pl-sech"><Ico name={FASE_IC[fa] ?? 'target'} />{faseTxt(fa, surname(art.nombre))}</h4>
          <div className="pl-grid">
            {acc.filter(a => a.fase === fa).map(a => { const i = orden.indexOf(a); return (
              <article key={a.id} className="card pl-card" style={{ ['--fc' as string]: FASE_C[a.fase], ['--i' as string]: i }}>
                <div className="pl-top"><span className="pl-n">{i + 1}</span>
                  <span className="pl-str" title={L('Qué tan clara es la evidencia', 'How clear the evidence is')}><i style={{ width: `${(100 * (a.fuerza ?? 0)) / maxF}%` }} /></span></div>
                <h4 className="pl-t">{tx(a, 'titulo', surname(art.nombre))}</h4>
                <p className="pl-p">{tx(a, 'texto', surname(art.nombre))}</p>
                <div className="pl-evs"><Evidence a={a} glob={glob} /></div>
              </article>) })}
          </div>
        </section>
      ))}
      {acc.length < 4 && <p className="note">{L('Pocas claves: su estilo está cerca del promedio de la liga en casi todo, o tiene pocos partidos para afirmarlo.', 'Few keys: his style is close to the league average in almost everything, or he has too few matches to say more.')}</p>}
    </div>
  )
}

export function Fichajes({ art, glob, media }: { art: Any; glob: Any; media: Any }) {
  const d = usePlan(art.id)
  if (d === false) return <div className="card note">{L('Aún no hay datos.', 'No data yet.')}</div>
  if (!d) return <div className="card note">{L('Cargando…', 'Loading…')}</div>
  const f = d.fichajes
  if (!f) return <div className="card note">{L('Su sello no tiene rasgos lo bastante claros para buscar jugadores a su medida.', 'His imprint has no traits clear enough to look for players that fit him.')}</div>
  const pos = (p: string) => L(d.meta.pos[p]?.es ?? p, d.meta.pos[p]?.en ?? p)
  const max = Math.max(...f.liga.map((p: Any) => p.score), 1)
  const Row = ({ p, sign = 1 }: { p: Any; sign?: number }) => (
    <div className="pl-pr">
      <span className="pl-pn"><b>{jugadorCorto(p.id, p.nombre)}</b><small>{pos(p.pos)} · {fmt(p.min, 0)} min</small></span>
      <span className="pl-pc">{p.club && <ClubLogo club={p.club} media={media} size={16} />}<small>{p.club}</small></span>
      <span className="pl-pz">{p.aporta.map((z: Any) => <i key={z.kpi} className={z.z >= 0 ? 'up' : 'dn'} title={kName(z.kpi, glob)}>{z.z >= 0 ? '+' : '−'}{Math.abs(z.z).toFixed(1)}</i>)}</span>
      <span className="pl-ps"><i style={{ width: `${Math.min(100, (100 * Math.abs(p.score)) / max)}%`, background: sign > 0 ? 'var(--div-pos)' : 'var(--div-neg)' }} /></span>
    </div>
  )
  return (
    <div className="pl">
      <div className="pl-lead">
        <h3 className="h2">{L('Qué jugadores le convienen', 'Which players suit him')}</h3>
<div className="tab-sub"><p>{L('El modelo estima, para cada jugador con al menos 900 minutos, cómo cambia el estilo del equipo cuando está en la cancha, ya descontado el entrenador, el club y el rival. Aquí se suman esos efectos sobre los tres rasgos más claros de su sello: los primeros de la lista empujan al equipo en la misma dirección que su estilo.', 'For each player with at least 900 minutes, the model estimates how the team style changes when he is on the pitch, net of coach, club and opponent. Here those effects are summed over the three clearest traits of his imprint: the top of the list pushes the team the same way he does.')}</p>
            <p>{L('Son efectos encogidos por el ridge y medidos con los compañeros que tuvo cada jugador: sirven para hacer una lista corta, no para decidir un fichaje solos.', 'They are ridge-shrunk effects measured with each player\'s team-mates: use them to build a shortlist, not to decide a signing on their own.')}</p></div>
        <div className="pl-rasgos">{f.rasgos.map((r: Any) => <span key={r.kpi} className={`chip ${r.alpha >= 0 ? 'up' : 'down'}`}>{r.alpha >= 0 ? '▲' : '▼'} {kName(r.kpi, glob)} <small>{pctTxt(r.pct)}</small></span>)}</div>
      </div>
      <div className="tl-grid pl-two">
        <div className="card">
          <div className="tl-h"><b>{L('En la liga, los que más empujan en su dirección', 'Around the league, those who push most his way')}</b></div>
          <div className="pl-ph"><span>{L('Jugador', 'Player')}</span><span>{L('Club', 'Club')}</span><span>{L('Por rasgo', 'By trait')}</span><span>{L('Encaje', 'Fit')}</span></div>
          {f.liga.map((p: Any) => <Row key={p.id} p={p} />)}
          <p className="note pl-foot">{L('Por rasgo, en este orden: ', 'By trait, in this order: ')}{f.rasgos.map((r: Any) => kName(r.kpi, glob)).join(' · ')}. {L('Cuánto mueve al equipo en cada uno, frente a los demás jugadores (+ = a favor de su estilo).', 'How much he moves the team on each, versus other players (+ = towards his style).')}</p>
        </div>
        <div className="card">
          <div className="tl-h"><b>{L(`En su plantilla de hoy (${f.club})`, `In his current squad (${f.club})`)}</b>{f.club && <ClubLogo club={f.club} media={media} size={18} />}</div>
          <div className="pl-sub up">{L('Le suman', 'Fit his style')}</div>
          {f.suman.map((p: Any) => <Row key={p.id} p={p} />)}
          {f.restan.length > 0 && <><div className="pl-sub dn">{L('Van en contra de su estilo', 'Pull against his style')}</div>{f.restan.map((p: Any) => <Row key={p.id} p={p} sign={-1} />)}</>}
          {f.restan.length === 0 && <p className="note">{L('Nadie de su plantilla con minutos va claramente en contra de su estilo.', 'No one in his squad with minutes clearly pulls against his style.')}</p>}
        </div>
      </div>
      <PlayerFit f={f} glob={glob} media={media} />
    </div>
  )
}

const EST: Record<string, [string, string, string]> = { en_linea: ['En su línea', 'On track', 'ok'], arriba: ['Por encima de lo suyo', 'Above his usual', 'hi'], abajo: ['Por debajo de lo suyo', 'Below his usual', 'lo'] }
export function Tablero({ art, glob }: { art: Any; glob: Any }) {
  const d = usePlan(art.id)
  if (d === false) return <div className="card note">{L('Aún no hay datos.', 'No data yet.')}</div>
  if (!d) return <div className="card note">{L('Cargando…', 'Loading…')}</div>
  const t = d.tablero
  if (!t) return <div className="card note">{L('Pocos partidos para armar el tablero.', 'Too few matches to build the dashboard.')}</div>
  const R = t.resultados
  const vals = t.rasgos.flatMap((r: Any) => [r.banda[0], r.banda[1], r.ultimos])
  const M = Math.max(1.5, ...vals.map((v: number) => Math.abs(v ?? 0))) * 1.08
  const X = (v: number) => ((v + M) / (2 * M)) * 100
  const tile = (k: string, a: number, b: number, d2 = 2, good = 1) => {
    const up = a - b
    return <div className="tl-kpi"><span className="note">{k}</span><b>{fmt(a, d2)}{Math.abs(up) > 0.05 && <i className={(up > 0) === (good > 0) ? 'up' : 'dn'}>{up > 0 ? '▲' : '▼'}</i>}</b><small>{L('carrera', 'career')} {fmt(b, d2)}</small></div>
  }
  return (
    <div className="pl">
      <div className="pl-lead">
        <h3 className="h2">{L(`¿${surname(art.nombre)} sigue jugando igual? Tablero de seguimiento`, `Is ${surname(art.nombre)} still playing the same way? Tracking dashboard`)}</h3>
<div className="tab-sub"><p>{L('Sus seis rasgos más marcados y confiables (la confiabilidad sale de la prueba mitad/mitad del Método). La franja es lo esperable para el promedio de 10 partidos si sigue jugando como siempre (su media de carrera ± 1.64 veces el error de un promedio de 10). El punto es lo que hizo en los últimos 10.', 'His six most distinctive and reliable traits (reliability comes from the split-half test in Method). The band is what to expect from a 10-match average if he keeps playing as always (career mean ± 1.64 times the error of a 10-match average). The dot is what he did in the last 10.')}</p>
            <p>{L('Valores frente a la liga, en la unidad de cada estadística, ya sin el efecto de jugadores, club, rival ni contexto.', 'Values versus the league, in each stat\'s unit, net of players, club, opponent and context.')}</p></div>
        <p className="note">{L(`Últimos ${t.n} partidos: del ${t.desde} al ${t.hasta}.`, `Last ${t.n} matches: ${t.desde} to ${t.hasta}.`)}</p>
      </div>
      {R && <div className="tl-kpis">{tile(L('Puntos por partido', 'Points per match'), R.pts[0], R.pts[1])}{tile(L('Puntos merecidos (xG)', 'Deserved points (xG)'), R.xpts[0], R.xpts[1])}{tile(L('Diferencia de xG por partido', 'xG difference per match'), R.xgd[0], R.xgd[1])}</div>}
      <div className="card pl-board">
        <div className="pl-axis"><span /><div>{[-1, 0, 1].map(v => <em key={v} style={{ left: `${X(v)}%` }}>{v > 0 ? L('más', 'more') : v < 0 ? L('menos', 'less') : L('liga', 'league')}</em>)}</div><span /></div>
        {t.rasgos.map((r: Any) => {
          const e = EST[r.estado] ?? EST.en_linea
          return (
            <div key={r.kpi} className="pl-br">
              <span className="pl-bl"><b>{kName(r.kpi, glob)}</b><small>{L('su sello', 'his imprint')} {r.sello} · {L('confiabilidad', 'reliability')} {fmt(r.confiabilidad, 2)}</small></span>
              <span className="pl-track">
                <u style={{ left: `${X(0)}%` }} />
                <i className="band" style={{ left: `${X(r.banda[0])}%`, width: `${X(r.banda[1]) - X(r.banda[0])}%` }} />
                <i className="car" style={{ left: `${X(r.carrera)}%` }} />
                <b className={`dot ${e[2]}`} style={{ left: `${X(r.ultimos)}%` }} title={`${L('últimos', 'last')} ${t.n}: ${fmt(r.ultimos, 2)}`} />
              </span>
              <span className={`pl-st ${e[2]}`}>{L(e[0], e[1])}</span>
            </div>
          )
        })}
        <div className="tl-leg"><span><i className="pl-lg band" />{L('lo esperable si sigue igual', 'expected if unchanged')}</span><span><i className="pl-lg car" />{L('su carrera', 'his career')}</span><span><i className="pl-lg dot" />{L(`últimos ${t.n} partidos`, `last ${t.n} matches`)}</span></div>
      </div>
    </div>
  )
}

const normTxt = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Grupos de posición para filtrar (las posiciones finas vienen de las alineaciones). */
const PGR: [string, string, string, RegExp][] = [
  ['def', 'Centrales', 'Centre-backs', /^Central/], ['lat', 'Laterales', 'Full-backs', /^(Lateral|Carrilero)/],
  ['med', 'Medios', 'Midfielders', /^(Pivote|Volante|Interior)/], ['ofe', 'Mediapuntas y extremos', 'Attacking mids & wingers', /^(Mediapunta|Extremo)/],
  ['del', 'Delanteros', 'Forwards', /^Delantero/], ['por', 'Porteros', 'Goalkeepers', /^Portero/],
]
const MINS: [number, string][] = [[0, L('Cualquiera', 'Any')], [900, '900+'], [3000, '3,000+'], [6000, '6,000+']]

/** Buscador: el encaje de CUALQUIER jugador con su estilo, con la misma fórmula que la lista (plan.py · fichajes):
 *  promedio de sus efectos en los rasgos del DT, cada uno en desviaciones entre jugadores y con el signo del DT,
 *  ponderado por qué tan marcado es cada rasgo. Los efectos salen de whatif.json (coeficientes de jugador del modelo).
 *  Sin texto, lista a los que mejor encajan dentro de los filtros. */
function PlayerFit({ f, glob, media }: { f: Any; glob: Any; media: Any }) {
  const [W, setW] = useState<Any>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [pg, setPg] = useState('')
  const [club, setClub] = useState('')
  const [minC, setMinC] = useState(900)
  const [act, setAct] = useState(true)
  useEffect(() => { getJSON(dataUrl('whatif.json')).then(setW, () => setW(false)) }, [])
  const M = useMemo(() => {
    if (!W) return null
    const idx: Record<string, number> = Object.fromEntries((W.kpis as Any[]).map((k: Any, i: number) => [k.k, i]))
    const R = (f.rasgos as Any[]).filter(r => idx[r.kpi] != null)
    const ids = Object.keys(W.players).filter(id => Array.isArray(W.players[id].b))
    const sd: Record<string, number> = {}
    for (const r of R) {
      const v = ids.map(id => W.players[id].b[idx[r.kpi]] as number), m = v.reduce((a, b) => a + b, 0) / v.length
      sd[r.kpi] = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(v.length - 1, 1)) || 1
    }
    const wsum = R.reduce((a, r) => a + Math.abs(r.alpha), 0) || 1
    const score: Record<string, number> = {}
    for (const id of ids) score[id] = R.reduce((a, r) => a + Math.sign(r.alpha) * (W.players[id].b[idx[r.kpi]] / sd[r.kpi]) * Math.abs(r.alpha), 0) / wsum
    const carrera = (id: string) => W.players[id].mc ?? W.players[id].min
    const pool = ids.filter(id => carrera(id) >= 900 && !/^Portero/.test(W.players[id].pos ?? '')).map(id => score[id]).sort((a, b) => a - b)
    const pctOf = (v: number) => Math.round((100 * pool.filter(x => x < v).length) / Math.max(pool.length, 1))
    const clubs = [...new Set(ids.map(id => W.players[id].club).filter(Boolean))].sort() as string[]
    return { idx, R, score, ids, carrera, pctOf, clubs }
  }, [W, f])
  if (W === false) return null
  const grp = PGR.find(g => g[0] === pg)
  const list = M ? M.ids.filter(id => {
    const p = W.players[id]
    if (q.trim().length >= 2 && !normTxt(p.n ?? '').includes(normTxt(q.trim()))) return false
    if (grp && !grp[3].test(p.pos ?? '')) return false
    if (club && p.club !== club) return false
    if (M.carrera(id) < minC) return false
    if (act && !(p.min > 0)) return false
    return true
  }).sort((a, b) => M.score[b] - M.score[a]).slice(0, 10) : []
  const p = sel && W?.players[sel]
  const sc = p && M ? M.score[sel!] : 0
  const pct = p && M ? M.pctOf(sc) : 0
  const verdict = pct >= 85 ? L('le encaja muy bien', 'a great fit') : pct >= 60 ? L('le encaja', 'a good fit') : pct >= 40 ? L('neutro para su estilo', 'neutral for his style') : L('va en contra de su estilo', 'pulls against his style')
  return (
    <div className="card pf">
      <div className="tl-h"><b>{L('¿Y este jugador le encajaría?', 'Would this player fit him?')}</b></div>
      <p className="note">{L(`Busca entre los ${M ? M.ids.length : '…'} jugadores con coeficiente propio en el modelo, o usa los filtros para ver a los que mejor le encajan.`, 'Search any player with his own coefficient in the model, or use the filters to see the best fits.')}</p>
      <div className="pf-bar">
        <input className="pf-q" value={q} placeholder={L('Nombre (p. ej. Henry Martín)…', 'Name (e.g. Henry Martín)…')} aria-label={L('Buscar jugador', 'Search player')}
          onChange={e => { setQ(e.target.value); setSel(null) }} />
        <select className="pf-sel" value={club} onChange={e => { setClub(e.target.value); setSel(null) }} aria-label={L('Club', 'Club')}>
          <option value="">{L('Todos los clubes', 'All clubs')}</option>
          {M?.clubs.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="pf-sel" value={minC} onChange={e => { setMinC(+e.target.value); setSel(null) }} aria-label={L('Minutos de carrera', 'Career minutes')}>
          {MINS.map(([v, t]) => <option key={v} value={v}>{L('Minutos', 'Minutes')}: {t}</option>)}
        </select>
        <label className="smap-switch pf-act"><input type="checkbox" role="switch" checked={act} onChange={e => { setAct(e.target.checked); setSel(null) }} /><i aria-hidden />{L('Jugó en 2025-27', 'Played 2025-27')}</label>
      </div>
      <div className="pf-chips" role="group" aria-label={L('Posición', 'Position')}>
        <button aria-pressed={!pg} onClick={() => { setPg(''); setSel(null) }}>{L('Todas', 'All')}</button>
        {PGR.map(([k, es, en]) => <button key={k} aria-pressed={pg === k} onClick={() => { setPg(pg === k ? '' : k); setSel(null) }}>{L(es, en)}</button>)}
      </div>
      {!p && M && (list.length > 0 ? (
        <div className="pf-hits">
          <div className="pf-hh"><span>{q.trim().length >= 2 ? L('Coincidencias, de mejor a peor encaje', 'Matches, best fit first') : L('Los que mejor le encajan con estos filtros', 'Best fits with these filters')}</span><span>{L('Encaje', 'Fit')}</span></div>
          {list.map(id => { const h = W.players[id], v = M.pctOf(M.score[id]); return (
            <button key={id} className="pf-hit" onClick={() => setSel(id)}>
              {h.club && <ClubLogo club={h.club} media={media} size={18} />}<b>{jugadorCorto(Number(id), h.n)}</b><small>{h.pos} · {h.club} · {fmt(M.carrera(id), 0)} min</small>
              <em className={v >= 60 ? 'up' : v < 40 ? 'dn' : ''}>{v}</em>
            </button>) })}
        </div>
      ) : <p className="note">{L('Nadie cumple estos filtros. Prueba quitando alguno.', 'Nobody matches these filters.')}</p>)}
      {p && M && (
        <div className="pf-res">
          <button className="pf-back" onClick={() => setSel(null)}>← {L('Volver a la lista', 'Back to the list')}</button>
          <div className="pf-top">
            {p.club && <ClubLogo club={p.club} media={media} size={30} />}
            <div><b className="pf-n">{jugadorCorto(Number(sel), p.n)}</b><small>{p.pos} · {p.club} · {fmt(M.carrera(sel!), 0)} {L('min en la muestra', 'min in the sample')}{p.mc != null ? ` (${fmt(p.min, 0)} ${L('en 2025-27', 'in 2025-27')})` : ''}</small></div>
            <div className={`pf-v ${pct >= 60 ? 'up' : pct < 40 ? 'dn' : ''}`}><b>{pct}</b><small>{L('de 100', 'of 100')}</small></div>
          </div>
          <p className="pf-say"><b>{cap1(verdict)}:</b> {L(`encaja mejor que el ${pct}% de los jugadores de campo de la liga con 900 minutos o más.`, `fits better than ${pct}% of outfield league players with 900+ minutes.`)}{M.carrera(sel!) < 900 ? L(' Ojo: tiene pocos minutos en la muestra, el dato es poco firme.', ' Careful: few minutes in the sample, the estimate is shaky.') : ''}</p>
          <div className="pf-rows">{M.R.map((r: Any) => {
            const b = p.b[M.idx[r.kpi]] as number, good = Math.sign(r.alpha) * b >= 0
            return (
              <div key={r.kpi} className="pf-row">
                <span>{kName(r.kpi, glob)} <small>{r.alpha >= 0 ? L('el DT lo sube', 'coach pushes it up') : L('el DT lo baja', 'coach pushes it down')}</small></span>
                <em className={good ? 'up' : 'dn'}>{real(r.kpi, b)} {L('cuando juega', 'when he plays')}</em>
              </div>)
          })}</div>
          <p className="note">{L('Efectos del modelo con sus compañeros de siempre, encogidos por el ridge: sirven para una lista corta, no para decidir un fichaje solos.', 'Model effects with his usual team-mates, ridge-shrunk: good for a shortlist, not to decide a signing alone.')}</p>
        </div>
      )}
    </div>
  )
}
const cap1 = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
