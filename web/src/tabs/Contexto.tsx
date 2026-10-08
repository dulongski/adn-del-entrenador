import { useState } from 'react'
import { sig, type Any } from '../lib'
import { Legend, MiniLines, useTip } from '../charts'
import { KEY, Seg, type P } from './common'

export function Contexto({ art, glob }: P) {
  const [dim, setDim] = useState('marcador')
  const C = art.contexto
  const [k, setK] = useState('posesion')
  const evo: Any[] = C.evolucion
  return (
    <div>
      <h3 className="h2">Cómo se adapta</h3>
      <p className="lede">Cómo cambia su juego cuando va perdiendo, empatando o ganando, según el minuto, si juega en casa o la fuerza del rival. Ya quitamos lo que ponen sus jugadores. La línea punteada es lo que hace la liga en esa misma situación: si la suya se separa, esa reacción es suya.</p>
      <Seg opts={[['marcador', 'Marcador'], ['minuto', 'Minuto'], ['localia', 'Localía'], ['rival', 'Fuerza del rival']]} v={dim} set={setDim} />
      <Legend items={[{ key: 'd', label: art.nombre.split(' ')[0] + ' ' + (art.nombre.split(' ').slice(-2, -1)[0] || ''), color: 'var(--c-dt)' }, { key: 'l', label: 'Liga', color: 'var(--ink-3)' }]} />
      <div className="grid3">
        {KEY.map(kk => C.curvas[dim]?.[kk] ? (
          <div key={kk} className="card">
            <div className="h3">{glob.kpis[kk].etiqueta}</div>
            <MiniLines rows={C.curvas[dim][kk]} xKey="nivel" series={[{ key: 'dt', label: 'DT', color: 'var(--c-dt)' }, { key: 'liga', label: 'Liga', color: 'var(--ink-3)', dash: '4 3' }]} />
          </div>
        ) : null)}
      </div>

      <h3 className="h2">Qué le hace cambiar de un partido a otro</h3>
      <p className="lede">Qué es lo que más cambia su forma de jugar de un partido a otro: jugar en casa, la fuerza del rival, el marcador o <b>cómo juega el rival</b> (si presiona, si tiene el balón, si es directo).</p>
      <Seg opts={KEY.filter(x => C.motores?.[x]).slice(0, 8).map(x => [x, glob.kpis[x].etiqueta] as [string, string])} v={k} set={setK} />
      {C.motores?.[k] ? <Drivers rows={C.motores[k]} /> : <div className="note">Hacen falta al menos 15 partidos.</div>}

      <h3 className="h2">Evolución en el tiempo</h3>
      <Seg opts={KEY.slice(0, 6).map(x => [x, glob.kpis[x].etiqueta] as [string, string])} v={k} set={setK} />
      <Evolution rows={evo} k={k} />
    </div>
  )
}

const VAR_ES: Record<string, string> = { local: 'Juega de local', fuerza_rival: 'Fuerza del rival', dif_goles_media: 'Diferencia de goles', rival_presion: 'Presión del rival', rival_posesion: 'Posesión del rival', rival_verticalidad: 'Verticalidad del rival' }
function Drivers({ rows }: { rows: Any[] }) {
  const max = Math.max(...rows.map(r => r.importancia), 1e-6)
  return (
    <div className="card">
      {rows.map(r => (
        <div key={r.variable} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 190px', gap: 10, alignItems: 'center', margin: '6px 0' }}>
          <span style={{ fontSize: 14 }}>{VAR_ES[r.variable] || r.variable}</span>
          <svg viewBox="0 0 200 12" preserveAspectRatio="none" style={{ width: '100%', height: 12 }}><rect x={0} y={1} width={r.importancia / max * 200} height={10} rx={3} fill="var(--c-dt)" /></svg>
          <span className="note">{Math.abs(r.direccion) < 0.2 ? 'depende del caso' : r.direccion > 0 ? 'cuanto más, más sube' : 'cuanto más, más baja'}</span>
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
        <text x={P.l - 6} y={y(0) + 4} fontSize={11} textAnchor="end" fill="var(--ink-3)">liga</text>
        {clubChanges.map(i => <g key={i}><line x1={x(i)} x2={x(i)} y1={P.t} y2={H - P.b} stroke="var(--ink)" strokeDasharray="4 3" /><text x={x(i) + 4} y={P.t + 10} fontSize={11} fill="var(--ink)">cambio de club</text></g>)}
        {rows.map((r, i) => <circle key={i} cx={x(i)} cy={y(r[k])} r={3} fill="var(--c-dt)" opacity={0.35} onMouseMove={e => tip.show(e, <>{r.date}<br />ajustado {sig(r[k])} · crudo {sig(r[`${k}_crudo`])}</>)} onMouseLeave={tip.hide} />)}
        <polyline points={rows.map((r, i) => `${x(i)},${y(r[`${k}_movil`])}`).join(' ')} fill="none" stroke="var(--c-dt)" strokeWidth={2.5} strokeLinejoin="round" />
        <text x={P.l} y={H - 6} fontSize={11} fill="var(--ink-3)">{rows[0].date}</text>
        <text x={W - P.r} y={H - 6} fontSize={11} textAnchor="end" fill="var(--ink-3)">{rows.at(-1).date}</text>
      </svg>
      <div className="note">Cada punto es un partido (sin el efecto de sus jugadores). La línea es el promedio de los últimos 5.</div>
      {tip.el}
    </div>
  )
}

/* ================================================================ JUGADORES */
