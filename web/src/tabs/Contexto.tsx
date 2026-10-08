import { useState } from 'react'
import { sig, type Any } from '../lib'
import { Legend, MiniLines, useTip } from '../charts'
import { KEY, Seg, type P } from './common'
import { L } from '../settings'
import { kpiLabel, td } from '../i18n/data'

export function Contexto({ art, glob }: P) {
  const [dim, setDim] = useState('marcador')
  const C = art.contexto
  const [k, setK] = useState('posesion')
  const evo: Any[] = C.evolucion
  return (
    <div>
      <h3 className="h2">{L('Cómo se adapta', 'How he adapts')}</h3>
      <p className="lede">{L('Cómo cambia su juego cuando va perdiendo, empatando o ganando, según el minuto, si juega en casa o la fuerza del rival. Ya quitamos lo que ponen sus jugadores. La línea punteada es lo que hace la liga en esa misma situación: si la suya se separa, esa reacción es suya.', 'How his game changes when he is losing, drawing or winning, by minute, home or away, and by the strength of the opponent. What his players bring is already taken out. The dotted line is what the league does in the same situation: where his line pulls away, that reaction is his.')}</p>
      <Seg opts={[['marcador', L('Marcador', 'Scoreline')], ['minuto', L('Minuto', 'Minute')], ['localia', L('Localía', 'Home/away')], ['rival', L('Fuerza del rival', 'Opponent strength')]]} v={dim} set={setDim} />
      <Legend items={[{ key: 'd', label: art.nombre.split(' ')[0] + ' ' + (art.nombre.split(' ').slice(-2, -1)[0] || ''), color: 'var(--c-dt)' }, { key: 'l', label: L('Liga', 'League'), color: 'var(--ink-3)' }]} />
      <div className="grid3">
        {KEY.map(kk => C.curvas[dim]?.[kk] ? (
          <div key={kk} className="card">
            <div className="h3">{kpiLabel(kk, glob.kpis[kk].etiqueta)}</div>
            <MiniLines rows={C.curvas[dim][kk].map((r: Any) => ({ ...r, nivel: td(r.nivel) }))} xKey="nivel" series={[{ key: 'dt', label: L('DT', 'Coach'), color: 'var(--c-dt)' }, { key: 'liga', label: L('Liga', 'League'), color: 'var(--ink-3)', dash: '4 3' }]} />
          </div>
        ) : null)}
      </div>

      <h3 className="h2">{L('Qué le hace cambiar de un partido a otro', 'What changes his approach from match to match')}</h3>
      <p className="lede">{L('Qué es lo que más cambia su forma de jugar de un partido a otro: jugar en casa, la fuerza del rival, el marcador o ', 'What shifts his style most from one match to the next: playing at home, the opponent\'s strength, the scoreline or ')}<b>{L('cómo juega el rival', 'how the opponent plays')}</b>{L(' (si presiona, si tiene el balón, si es directo).', ' (whether they press, keep the ball or go direct).')}</p>
      <Seg opts={KEY.filter(x => C.motores?.[x]).slice(0, 8).map(x => [x, kpiLabel(x, glob.kpis[x].etiqueta)] as [string, string])} v={k} set={setK} />
      {C.motores?.[k] ? <Drivers rows={C.motores[k]} /> : <div className="note">{L('Hacen falta al menos 15 partidos.', 'Needs at least 15 matches.')}</div>}

      <h3 className="h2">{L('Evolución en el tiempo', 'Over time')}</h3>
      <Seg opts={KEY.slice(0, 6).map(x => [x, kpiLabel(x, glob.kpis[x].etiqueta)] as [string, string])} v={k} set={setK} />
      <Evolution rows={evo} k={k} />
    </div>
  )
}

const VAR_ES: Record<string, string> = { local: L('Juega de local', 'Playing at home'), fuerza_rival: L('Fuerza del rival', 'Opponent strength'), dif_goles_media: L('Diferencia de goles', 'Goal difference'), rival_presion: L('Presión del rival', 'Opponent pressing'), rival_posesion: L('Posesión del rival', 'Opponent possession'), rival_verticalidad: L('Verticalidad del rival', 'Opponent directness') }
function Drivers({ rows }: { rows: Any[] }) {
  const max = Math.max(...rows.map(r => r.importancia), 1e-6)
  return (
    <div className="card">
      {rows.map(r => (
        <div key={r.variable} className="ctx-drv">
          <span style={{ fontSize: 14 }}>{VAR_ES[r.variable] || r.variable}</span>
          <svg viewBox="0 0 200 12" preserveAspectRatio="none" style={{ width: '100%', height: 12 }}><rect x={0} y={1} width={r.importancia / max * 200} height={10} rx={3} fill="var(--c-dt)" /></svg>
          <span className="note">{Math.abs(r.direccion) < 0.2 ? L('depende del caso', 'it depends') : r.direccion > 0 ? L('cuanto más, más sube', 'the more, the higher') : L('cuanto más, más baja', 'the more, the lower')}</span>
        </div>
      ))}
    </div>
  )
}

function Evolution({ rows, k }: { rows: Any[]; k: string }) {
  const tip = useTip()
  if (!rows?.length) return null
  const W = 900, H = 200, P = { l: 40, r: 10, t: 10, b: 24 }
  const vals = rows.flatMap(r => [r[k], r[`${k}_movil`]]).filter(v => v != null)
  const lo = Math.min(-1, ...vals), hi = Math.max(1, ...vals)
  const x = (i: number) => P.l + i / Math.max(rows.length - 1, 1) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b)
  const clubChanges = rows.map((r, i) => (i > 0 && r.club_id !== rows[i - 1].club_id ? i : null)).filter(v => v !== null) as number[]
  return (
    <div className="card tbl-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 560 }}>
        <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="var(--ink-3)" strokeDasharray="2 3" />
        <text x={P.l - 6} y={y(0) + 4} fontSize={11} textAnchor="end" fill="var(--ink-3)">{L('liga', 'league')}</text>
        {clubChanges.map(i => <g key={i}><line x1={x(i)} x2={x(i)} y1={P.t} y2={H - P.b} stroke="var(--ink)" strokeDasharray="4 3" /><text x={x(i) + 4} y={P.t + 10} fontSize={11} fill="var(--ink)">{L('cambio de club', 'club change')}</text></g>)}
        {rows.map((r, i) => <circle key={i} cx={x(i)} cy={y(r[k])} r={3} fill="var(--c-dt)" opacity={0.35} onMouseMove={e => tip.show(e, <>{r.date}<br />{L('ajustado', 'adjusted')} {sig(r[k])} · {L('crudo', 'raw')} {sig(r[`${k}_crudo`])}</>)} onMouseLeave={tip.hide} />)}
        <polyline points={rows.map((r, i) => `${x(i)},${y(r[`${k}_movil`])}`).join(' ')} fill="none" stroke="var(--c-dt)" strokeWidth={2.5} strokeLinejoin="round" />
        <text x={P.l} y={H - 6} fontSize={11} fill="var(--ink-3)">{rows[0].date}</text>
        <text x={W - P.r} y={H - 6} fontSize={11} textAnchor="end" fill="var(--ink-3)">{rows.at(-1).date}</text>
      </svg>
      <div className="note">{L('Cada punto es un partido (sin el efecto de sus jugadores). La línea es el promedio de los últimos 5.', 'Each dot is a match (with his players\' effect removed). The line is the 5-match rolling average.')}</div>
      {tip.el}
    </div>
  )
}

/* ================================================================ JUGADORES */
