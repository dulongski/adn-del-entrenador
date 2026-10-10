import { useEffect, useMemo, useState } from 'react'
import { Pitch } from '../charts'
import { xgColor } from '../Corners3D'
import { Ico } from '../icons'
import { clubColor, dataUrl, fmt, getJSON, jugadorCorto, type Any } from '../lib'
import { L } from '../settings'
import Info from '../Info'
import { Seg } from './common'
import { CARRERA, ClubSwitch } from './JugOnce'
import '../styles/bp.css'
import '../styles/tl.css'
import '../styles/jugadores.css'

/* Tiros libres (pipeline/freekicks.py, dentro de corners_<id>.json bajo «tl»). Coordenadas StatsBomb: ataca hacia x = 120, y 0 = banda izquierda.
   Cada tiro libre es: tiro directo, centro al área (pase con centro, o alto que cae en el área) o pase corto / en juego (el resto). */
type Side = 'favor' | 'contra'
const RES_ES = ['Gol', 'Atajado', 'Atajado al poste', 'Desviado tras atajada', 'Poste', 'Afuera', 'Muy desviado', 'Bloqueado']
const RES_EN = ['Goal', 'Saved', 'Saved onto the post', 'Saved off target', 'Post', 'Off target', 'Wayward', 'Blocked']
const inBox = (x: number, y: number) => x >= 102 && y >= 18 && y <= 62
type K = 'tiro' | 'centro' | 'corto'
const KC: Record<K, string> = { tiro: '#f2b51b', centro: '#38bdf8', corto: '#9aa39e' }
const KN: Record<K, [string, string]> = { tiro: ['Tiro directo', 'Direct shot'], centro: ['Centro al área', 'Cross into the box'], corto: ['Pase corto o en juego', 'Short / in play'] }
const XMIN = 72    // por debajo de esta línea son reanudaciones lejos del área, no jugadas de balón parado
const dist = (x: number, y: number) => Math.hypot(120 - x, 40 - y) * 0.9144     // metros al centro del arco
type Row = { club: number; k: K; min: number; st: number; x: number; y: number; ex?: number; ey?: number; ez?: number; xg: number; gol: boolean; res?: number; jug: number; post?: number; cen?: boolean }

export function TirosLibres({ art, media }: { art: Any; media?: Any }) {
  const [D, setD] = useState<Any>(null)
  const [liga, setLiga] = useState<Any>(null)
  const [side, setSide] = useState<Side>('favor')
  const [filtro, setFiltro] = useState<'todos' | K>('todos')
  const [pick, setPick] = useState<{ id: number; club: string } | null>(null)
  useEffect(() => { setD(null); getJSON(dataUrl(`corners_${art.id}.json`)).then(o => setD(o.tl ?? false)).catch(() => setD(false)) }, [art.id])
  useEffect(() => { getJSON(dataUrl('corners_liga.json')).then(o => setLiga(o.tl ?? null)).catch(() => {}) }, [])
  const clubs: string[] = useMemo(() => {
    const all: string[] = (D?.clubes ?? []).map((c: Any) => c.club)
    const cur = media?.dts?.[art.id]?.club ?? art.etapas?.at(-1)?.club
    const first = all.includes(cur) ? cur : all[all.length - 1]
    return all.length ? [first, ...all.filter(c => c !== first)] : []
  }, [D, media, art])
  const sel = pick && pick.id === art.id && (pick.club === CARRERA || clubs.includes(pick.club)) ? pick.club : clubs[0]
  const cidxOf = (c: string) => (D?.clubes ?? []).findIndex((q: Any) => q.club === c)
  const club = sel === CARRERA ? media?.dts?.[art.id]?.club : sel
  const color = clubColor(club, media)
  const names: Record<number, [number, string]> = useMemo(() => (D ? Object.fromEntries((D.jugadores as [number, string][]).map(([id, n], i) => [i, [id, n] as [number, string]])) : {}), [D])

  const todos = useMemo(() => {
    if (!D) return [] as Row[]
    const S = D[side]
    const out: Row[] = []
    for (const t of S.tiros) out.push({ club: t[9], k: 'tiro', min: t[0], st: t[1], x: t[2], y: t[3], ey: t[4], ez: t[5], xg: t[6], gol: t[7] === 0, res: t[7], jug: t[8] })
    for (const p of S.pases) {
      const cross = p[6] === 1 || (p[7] === 2 && inBox(p[4], p[5]))
      out.push({ club: p[12], k: cross ? 'centro' : 'corto', min: p[0], st: p[1], x: p[2], y: p[3], ex: p[4], ey: p[5], xg: p[9], gol: p[10] === 1, jug: p[11], post: p[9], cen: p[8] === 1 })
    }
    return out
  }, [D, side])
  const ci = sel && sel !== CARRERA ? cidxOf(sel) : -1
  const delClub = useMemo(() => (ci < 0 ? todos : todos.filter(r => r.club === ci)), [todos, ci])
  const rows = useMemo(() => delClub.filter(r => r.x >= XMIN), [delClub])
  const lejos = delClub.length - rows.length
  const n = rows.length, partidos = ci >= 0 ? D?.clubes?.[ci]?.partidos ?? 1 : D?.partidos ?? 1
  const tiros = rows.filter(r => r.k === 'tiro'), cent = rows.filter(r => r.k === 'centro')

  if (D === false) return <div className="card note">{L('Aún no hay datos de tiros libres para este DT.', 'No free-kick data for this coach yet.')}</div>
  if (!D) return <div className="card note">{L('Cargando tiros libres…', 'Loading free kicks…')}</div>

  const shown = rows.filter(r => filtro === 'todos' || r.k === filtro)
  const LG = liga
  const pm = (v: number) => v / partidos
  const kpi = (lbl: string, v: string, sub: string, lv?: number | null, cur?: number, fmtF: (x: number) => string = x => fmt(x, 2), good = 1) => {
    const d = lv != null && cur != null && Number.isFinite(cur) ? cur - lv : null
    const same = d == null || Math.abs(d) < Math.abs(lv ?? 1) * 0.04
    return (
      <div className="tl-kpi"><span className="note">{lbl}</span><b>{v}{d != null && !same && good !== 0 && <i className={(d > 0) === (good > 0) ? 'up' : 'dn'}>{d > 0 ? '▲' : '▼'}</i>}</b><small>{sub}{lv != null ? ` · ${L('liga', 'league')} ${fmtF(lv)}` : ''}</small></div>
    )
  }
  const xgShot = tiros.length ? tiros.reduce((a, r) => a + r.xg, 0) / tiros.length : NaN
  const golShot = tiros.length ? tiros.filter(r => r.gol).length / tiros.length : NaN
  const aPuerta = tiros.length ? tiros.filter(r => (r.res ?? 9) <= 2).length / tiros.length : NaN
  const xgCen = cent.length ? cent.reduce((a, r) => a + (r.post ?? 0), 0) / cent.length : NaN
  const rem = cent.length ? cent.filter(r => (r.post ?? 0) > 0).length / cent.length : NaN
  const ok = cent.length ? cent.filter(r => r.cen).length / cent.length : NaN
  const dirF = side === 'favor' ? 1 : -1

  const BANDAS: [string, number, number][] = [[L('Menos de 20 m', 'Under 20 m'), 0, 20], ['20 – 30 m', 20, 30], ['30 – 40 m', 30, 40], [L('Más de 40 m', 'Over 40 m'), 40, 999]]
  const cnt = (r: Row[]) => ({ n: r.length, t: r.filter(q => q.k === 'tiro').length, c: r.filter(q => q.k === 'centro').length, s: r.filter(q => q.k === 'corto').length })
  const porDist = BANDAS.map(([lbl, a, b]) => ({ lbl, ...cnt(rows.filter(q => { const d = dist(q.x, q.y); return d >= a && d < b })) }))
  const TR: [string, number, number][] = [["0–15'", 0, 15], ["15–30'", 15, 30], ["30–45'", 30, 46], ["45–60'", 46, 60], ["60–75'", 60, 75], ["75'+", 75, 200]]
  const porMin = TR.map(([lbl, a, b]) => ({ lbl, ...cnt(rows.filter(q => q.min >= a && q.min < b)) }))
  const maxMin = Math.max(1, ...porMin.map(q => q.n))
  const ST: [string, number][] = [[L('Perdiendo', 'Losing'), -1], [L('Empatando', 'Drawing'), 0], [L('Ganando', 'Winning'), 1]]
  const porSt = ST.map(([lbl, s]) => ({ lbl, ...cnt(rows.filter(q => q.st === s)) }))
  const tk = new Map<number, { n: number; t: number; c: number; s: number; xg: number }>()
  for (const r of rows) { const a = tk.get(r.jug) ?? { n: 0, t: 0, c: 0, s: 0, xg: 0 }; a.n++; if (r.k === 'tiro') { a.t++; a.xg += r.xg } else if (r.k === 'centro') a.c++; else a.s++; tk.set(r.jug, a) }
  const takers = [...tk.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 7)
  const land = cent.filter(r => r.ex != null && r.ey != null).map(r => ({ x: r.ex!, y: r.y > 40 ? 80 - r.ey! : r.ey!, xg: r.post ?? 0 }))
  const CX = 4, CYN = 12
  const cells = (() => {
    const m = new Map<string, { i: number; j: number; n: number; xg: number }>()
    for (const q of land) { if (q.x < 92) continue; const i = Math.min(Math.floor((q.x - 92) / CX), 6), j = Math.max(0, Math.min(CYN - 1, Math.floor(q.y / (80 / CYN)))); const k = `${i}:${j}`; const c = m.get(k) ?? { i, j, n: 0, xg: 0 }; c.n++; c.xg += q.xg; m.set(k, c) }
    const tot = land.length || 1, prior = land.reduce((a, q) => a + q.xg, 0) / tot
    const arr = [...m.values()].filter(c => c.n >= 2).map(c => ({ ...c, v: (c.xg + 3 * prior) / (c.n + 3) }))
    return { arr, maxN: Math.max(1, ...arr.map(c => c.n)) }
  })()
  const zonaDe = (q: { x: number; y: number }) => (q.x < 102 || q.y < 18 || q.y > 62 ? 'fuera' : q.x < 110 && q.y >= 30 && q.y <= 50 ? 'penal' : q.y < 36 ? 'primer' : q.y <= 44 ? 'centro' : 'segundo')
  const ZN: Record<string, [string, string]> = { primer: ['Primer palo', 'Near post'], centro: ['Centro del área chica', 'Central 6-yard box'], segundo: ['Segundo palo', 'Far post'], penal: ['Punto penal', 'Penalty spot'], fuera: ['Fuera del área', 'Outside the box'] }
  const zonas = Object.keys(ZN).map(z => { const r = land.filter(q => zonaDe(q) === z); return { z, n: r.length, xg: r.length ? r.reduce((a, q) => a + q.xg, 0) / r.length : 0 } }).sort((a, b) => Number(a.z === 'fuera') - Number(b.z === 'fuera') || b.n - a.n)
  const maxXg = 0.08
  const stackOf = (b: { n: number; t: number; c: number; s: number }, min = 12) => b.n ? (['t', 'c', 's'] as const).map((k, i) => { const v = b[k], pc = (100 * v) / b.n; const kk = (['tiro', 'centro', 'corto'] as K[])[i]; return v ? <span key={k} style={{ width: `${pc}%`, background: KC[kk] }} title={`${L(KN[kk][0], KN[kk][1])}: ${v}`}>{pc >= min ? `${fmt(pc, 0)}%` : ''}</span> : null }) : <span className="tl-empty" />

  return (
    <div className="tl">
      {D.clubes?.length > 0 && <ClubSwitch clubes={clubs} value={sel ?? clubs[0]} set={c => setPick({ id: art.id, club: c })} media={media} partidos={Object.fromEntries(D.clubes.map((c: Any) => [c.club, c.partidos]))} carrera={D.partidos} />}
      <div className="tl-ctrl">
        <div className="seg sm" role="group"><button aria-pressed={side === 'favor'} onClick={() => setSide('favor')}><Ico name="sword" />{L('A favor', 'Attacking')}</button><button aria-pressed={side === 'contra'} onClick={() => setSide('contra')}><Ico name="shield" />{L('En contra', 'Defending')}</button></div>
        <span className="note">{n} {L('tiros libres en zona de ataque', 'free kicks in the attacking zone')} · {partidos} {L('partidos', 'matches')}{side === 'contra' ? ` · ${L('los que le cobran', 'those taken against him')}` : ''}<Info>{L(`Sólo cuentan los tiros libres que se cobran en el último 40% de la cancha (balón a más de 72 de 120). Los ${lejos} restantes son reanudaciones lejos del área y no se muestran.`, `Only free kicks taken in the final 40% of the pitch count (ball beyond 72 of 120). The other ${lejos} are restarts far from goal and are not shown.`)}</Info></span>
      </div>

      <div className="tl-kpis">
        {kpi(L('Tiros libres en zona de ataque por partido', 'Attacking-zone free kicks per match'), fmt(pm(n), 1), `${fmt(pm(tiros.length), 2)} ${L('directos', 'direct')} · ${fmt(pm(cent.length), 1)} ${L('centros', 'crosses')}`, LG?.por_equipo_partido?.total, pm(n), x => fmt(x, 1), 0)}
        {kpi(L('Directos a puerta', 'Direct shots on target'), tiros.length ? `${fmt(aPuerta * 100, 0)}%` : '—', `${tiros.length} ${L('tiros', 'shots')}`, LG?.a_puerta, aPuerta, x => `${fmt(x * 100, 0)}%`, dirF)}
        {kpi(L('Gol por tiro directo', 'Goal per direct shot'), tiros.length ? `${fmt(golShot * 100, 1)}%` : '—', `xG ${tiros.length ? fmt(xgShot, 3) : '—'}`, LG?.gol_tiro, golShot, x => `${fmt(x * 100, 1)}%`, dirF)}
        {kpi(L('xG por centro', 'xG per cross'), cent.length ? fmt(xgCen, 3) : '—', `${fmt(rem * 100, 0)}% ${L('acaban en remate', 'end in a shot')}`, LG?.xg_por_centro, xgCen, x => fmt(x, 3), dirF)}
      </div>

      <div className="tl-grid">
        <div className="card tl-map">
          <div className="tl-h"><b>{L('Desde dónde los tira', 'Where they are taken from')}</b>
            <Info wide><p>{L('Cada punto es un tiro libre: dónde estaba el balón. Amarillo = tiro directo, azul = centro al área, gris = pase corto o en juego. Ataca hacia arriba.', 'Each dot is a free kick: where the ball was. Yellow = direct shot, blue = cross into the box, grey = short or in-play pass. Attacking upwards.')}</p><p>{L('«Centro al área»: pase marcado como centro o pase alto que cae dentro del área.', '“Cross into the box”: a pass flagged as a cross, or a high pass landing in the box.')}</p></Info></div>
          <Seg opts={[['todos', L('Todos', 'All'), 'all'], ['tiro', L('Tiros directos', 'Direct shots'), 'chance'], ['centro', L('Centros', 'Crosses'), 'flag'], ['corto', L('Cortos', 'Short'), 'swap']]} v={filtro} set={s => setFiltro(s as Any)} />
          <Pitch vertical crop={[66, 121]}>
            {shown.map((r, i) => <circle key={i} cx={r.x} cy={r.y} r={r.k === 'tiro' ? 1.5 + 5 * Math.sqrt(r.xg) : 1.3} fill={KC[r.k]} fillOpacity={r.k === 'corto' ? 0.4 : 0.62} stroke={r.gol ? '#fff' : 'rgba(0,0,0,.45)'} strokeWidth={r.gol ? 0.6 : 0.2} />)}
          </Pitch>
          <div className="tl-leg">{(Object.keys(KC) as K[]).map(k => <span key={k}><i style={{ background: KC[k] }} />{L(KN[k][0], KN[k][1])} <b>{rows.filter(r => r.k === k).length}</b></span>)}<span><i className="ring" />{L('anillo blanco = gol', 'white ring = goal')}</span></div>
        </div>

        <div className="card tl-dist">
          <div className="tl-h"><b>{L('A qué distancia hace qué', 'What he does at each distance')}</b><Info>{L('Distancia del balón al centro del arco. Para cada franja: qué porcentaje de sus tiros libres son tiro directo, centro o pase corto.', 'Distance from the ball to the centre of goal. For each band: the share of his free kicks that are a direct shot, a cross or a short pass.')}</Info></div>
          {porDist.map(b => <div key={b.lbl} className="tl-row"><span className="tl-rl">{b.lbl}<small>{b.n} {L('tiros libres', 'free kicks')}</small></span><span className="tl-stack">{stackOf(b)}</span></div>)}
          <div className="tl-h" style={{ marginTop: 18 }}><b>{L('Según el marcador', 'By scoreline')}</b></div>
          {porSt.map(b => <div key={b.lbl} className="tl-row"><span className="tl-rl">{b.lbl}<small>{b.n}</small></span><span className="tl-stack">{stackOf(b)}</span></div>)}
          <div className="tl-leg">{(Object.keys(KC) as K[]).map(k => <span key={k}><i style={{ background: KC[k] }} />{L(KN[k][0], KN[k][1])}</span>)}</div>
        </div>
      </div>

      <div className="tl-grid">
        <div className="card tl-cen">
          <div className="tl-h"><b>{L('Dónde caen sus centros', 'Where his crosses land')}</b>
            <Info wide><p>{L(`Cada círculo es una zona del área: tamaño = cuántos centros caen ahí, color = xG medio de las jugadas que salen de esos tiros libres (los remates de esa misma posesión). Se reflejan para que el balón siempre salga del lado izquierdo. ${cent.length} centros.`, `Each circle is a zone of the box: size = how many crosses land there, colour = average xG of the moves that follow those free kicks (shots in the same possession). Mirrored so the ball always starts from the left side. ${cent.length} crosses.`)}</p></Info></div>
          {land.length < 8 ? <div className="note">{L('Pocos centros para dibujar el mapa.', 'Too few crosses to draw the map.')}</div> : (
            <Pitch vertical crop={[88, 121]}>
              {cells.arr.map(c => <circle key={`${c.i}:${c.j}`} cx={92 + (c.i + 0.5) * CX} cy={(c.j + 0.5) * (80 / CYN)} r={0.9 + 2.4 * Math.sqrt(c.n / cells.maxN)} fill={xgColor(c.v / maxXg)} fillOpacity={0.92} stroke="rgba(0,0,0,.35)" strokeWidth={0.25} />)}
            </Pitch>
          )}
          <div className="tl-zones">
            {zonas.map(z => (
              <div key={z.z} className="tl-zone"><span>{L(ZN[z.z][0], ZN[z.z][1])}</span>
                <span className="bar"><i style={{ width: `${(100 * z.n) / Math.max(...zonas.map(q => q.n), 1)}%`, background: xgColor(z.n ? z.xg / maxXg : 0) }} /></span>
                <b>{land.length ? fmt((100 * z.n) / land.length, 0) : 0}%</b><small>{z.n ? `xG ${fmt(z.xg, 3)}` : '—'}</small></div>
            ))}
            <div className="note" style={{ marginTop: 6 }}>{Number.isFinite(ok) ? fmt(ok * 100, 0) : '—'}% {L('de los centros llegan a un compañero', 'of the crosses reach a team-mate')}</div>
          </div>
        </div>

        <div className="card tl-goal">
          <div className="tl-h"><b>{L('Tiros directos: a dónde van en el arco', 'Direct shots: where they go in the goal')}</b>
            <Info wide><p>{L('Vista desde el campo, mirando al arco: cada punto es dónde cruzó (o habría cruzado) la línea de gol. Verde = gol, azul = atajado, gris = afuera o bloqueado. Los bloqueados por la barrera no llegan al arco.', 'View from the pitch looking at goal: each dot is where it crossed (or would have crossed) the goal line. Green = goal, blue = saved, grey = off target or blocked. Shots blocked by the wall do not reach the goal.')}</p></Info></div>
          {tiros.length < 5 ? <div className="note">{L('Pocos tiros directos para dibujar el arco.', 'Too few direct shots to draw the goal.')}</div> : (
            <svg viewBox="26 -6 28 14" className="tl-gsvg" role="img" aria-label={L('Destino de los tiros directos', 'Direct shot destinations')}>
              <rect x={36} y={0} width={8} height={2.67} fill="rgba(255,255,255,.04)" />
              <path d="M36 2.67V0h8v2.67" fill="none" stroke="#f2f2f2" strokeWidth={0.35} />
              <line x1={30} x2={50} y1={2.67} y2={2.67} stroke="var(--pitch-line)" strokeWidth={0.2} />
              {tiros.filter(r => r.ey != null && r.ez != null && r.res !== 7).map((r, i) => (
                <circle key={i} cx={r.ey!} cy={2.67 - Math.min(r.ez!, 4)} r={0.42} fill={r.gol ? '#3ddc97' : (r.res ?? 9) <= 2 ? '#38bdf8' : '#9aa39e'} fillOpacity={0.75} stroke="rgba(0,0,0,.5)" strokeWidth={0.1} />
              ))}
            </svg>
          )}
          <div className="tl-leg"><span><i style={{ background: '#3ddc97' }} />{L('Gol', 'Goal')}</span><span><i style={{ background: '#38bdf8' }} />{L('Atajado', 'Saved')}</span><span><i style={{ background: '#9aa39e' }} />{L('Afuera / bloqueado', 'Off target / blocked')}</span></div>
          <div className="tl-resumen">
            {RES_ES.map((nm, i) => { const c = tiros.filter(r => r.res === i).length; return c ? <span key={nm}>{L(nm, RES_EN[i])} <b>{c}</b></span> : null })}
          </div>
        </div>
      </div>

      <div className="card tl-tk">
        <div className="tl-h"><b>{L('Quién los cobra', 'Who takes them')}</b><Info>{L('Los cobradores con más tiros libres y qué hacen: tiro directo, centro o pase corto. El número de la derecha es el xG medio de sus tiros directos.', 'The takers with the most free kicks and what they do: direct shot, cross or short pass. The number on the right is the average xG of his direct shots.')}</Info></div>
        {side === 'contra' && <div className="note">{L('Son los cobradores de los rivales.', 'These are the opponents’ takers.')}</div>}
        {takers.map(([j, a]) => (
          <div key={j} className="tl-row">
            <span className="tl-rl">{jugadorCorto(names[j][0], names[j][1])}<small>{a.n} {L('tiros libres', 'free kicks')} · {fmt((100 * a.n) / Math.max(n, 1), 0)}%</small></span>
            <span className="tl-stack">{stackOf(a, 14)}</span>
            <small className="tl-xg">{a.t ? `xG ${fmt(a.xg / a.t, 3)}` : ''}</small>
          </div>
        ))}
      </div>

      <div className="card tl-min">
        <div className="tl-h"><b>{L('Cuándo los tira', 'When he takes them')}</b><Info>{L('Tiros libres por tramo del partido, con lo que hace en cada uno.', 'Free kicks by stretch of the match, with what he does in each.')}</Info></div>
        <div className="tl-bars">
          {porMin.map(b => (
            <div key={b.lbl} className="tl-bcol"><span className="tl-bn">{b.n}</span>
              <span className="tl-bstack" style={{ height: `${(100 * b.n) / maxMin}%` }}>{(['s', 'c', 't'] as const).map((k, i) => { const v = b[k]; const kk = (['corto', 'centro', 'tiro'] as K[])[i]; return v ? <i key={k} style={{ flex: v, background: KC[kk] }} title={`${L(KN[kk][0], KN[kk][1])}: ${v}`} /> : null })}</span>
              <span className="tl-bl">{b.lbl}</span></div>
          ))}
        </div>
      </div>
      <p className="note" style={{ color }}>{L('Datos StatsBomb de Liga MX 2021/22 a 2026/27. Un centro «acaba en remate» si su equipo remata en la misma posesión.', 'StatsBomb data from Liga MX 2021/22 to 2026/27. A cross “ends in a shot” if his team shoots in the same possession.')}</p>
    </div>
  )
}
