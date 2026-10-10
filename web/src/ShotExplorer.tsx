import Info from './Info'
import { Ico } from './icons'
import { useEffect, useMemo, useState } from 'react'
import { fmt, jugadorCorto, type Any } from './lib'
import { ClubLogo, Pitch, useTip } from './charts'
import { fecha, RES_ES } from './PlayAnim'
import './styles/juego.css'
import { L } from './settings'

const CUERPO_ES: Record<string, string> = { 'Right Foot': L('pierna derecha', 'right foot'), 'Left Foot': L('pierna izquierda', 'left foot'), Head: L('cabeza', 'header'), Other: L('otra parte', 'other') }
const TIPO_ES: Record<string, string> = { Penalty: L('penal', 'penalty'), 'Free Kick': L('tiro libre directo', 'direct free kick'), Corner: L('córner directo', 'direct from a corner') }

export type Shot = {
  i: number; x: number; y: number; ex: number | null; ey: number | null; ez: number | null; xg: number; res: string; cuerpo: string | null; tipo: string
  min: number; p: Any[]; club: string; jugador: string; gp: number | null; gr: number | null; gol: boolean
}

export function parseShots(J: Any): Shot[] {
  if (!J) return []
  return J.tiros.map((r: Any[], i: number) => {
    const p = J.partidos[r[10]]
    const j = r[11] != null ? J.jugadores[r[11]] : null
    const res = J.res[r[6]] ?? ''
    return {
      i, x: r[0], y: r[1], ex: r[2], ey: r[3], ez: r[4], xg: r[5], res, cuerpo: J.cuerpo[r[7]] ?? null, tipo: J.tipo[r[8]] ?? 'Open Play',
      min: r[9], p, club: J.clubes[p[5]]?.club, jugador: j ? jugadorCorto(j[0], j[1]) : '—', gp: r[12], gr: r[13], gol: res === 'Goal',
    }
  })
}

function ShotTip({ s, media }: { s: Shot; media: Any }) {
  return (
    <div className="st-tip">
      <div><b>{s.jugador}</b> · min {s.min + 1}'</div>
      <div className="st-tip-row"><ClubLogo club={s.p[1]} media={media} size={16} /><span>vs {s.p[1]}</span></div>
      <div>{fecha(s.p[0])} · {s.p[2] ? L('local', 'home') : L('visita', 'away')} · {L('terminó', 'final')} {s.p[3]}-{s.p[4]}</div>
      <div><b>{RES_ES[s.res] ?? s.res}</b> · xG {fmt(s.xg, 2)}{s.cuerpo ? ` · ${CUERPO_ES[s.cuerpo]}` : ''}{TIPO_ES[s.tipo] ? ` · ${TIPO_ES[s.tipo]}` : ''}</div>
    </div>
  )
}

/** Mapa de tiros con selección: ‹ › recorre las ocasiones de mayor xG (o sólo los goles), dibuja la trayectoria
 *  hasta donde terminó y una vista de la portería. Media cancha vertical, ataque hacia arriba. */
export function ShotExplorer({ shots, color, media }: { shots: Shot[]; color: string; media: Any }) {
  const tip = useTip()
  const [filtro, setFiltro] = useState<'todos' | 'goles'>('todos')
  const list = useMemo(() => (filtro === 'goles' ? shots.filter(s => s.gol) : shots), [shots, filtro])
  const ranked = useMemo(() => [...list].sort((a, b) => b.xg - a.xg), [list])
  const [k, setK] = useState(0)
  useEffect(() => setK(0), [shots, filtro])
  const sel = ranked[k] as Shot | undefined
  const goles = shots.filter(s => s.gol).length
  const dimNo = list.length > 400 ? 0.22 : list.length > 150 ? 0.35 : 0.5
  const xg = shots.reduce((a, s) => a + s.xg, 0)
  // la portería: y 36–44 (8 yardas), alto 2.67; vista desde el tirador (y crece hacia la derecha, como en la cancha vertical)
  const G = { y0: 36, y1: 44, h: 2.67 }
  const gx = (y: number) => (y - (G.y0 - 4.5)) / 17 * 120
  const gy = (z: number) => 52 - z * 120 / 17
  const onFrame = (s: Shot) => s.ez != null && s.ey != null && s.ex != null && s.ex >= 117 && ['Goal', 'Saved', 'Saved to Post', 'Post', 'Off T', 'Saved Off Target'].includes(s.res)
  return (
    <div className="st">
      <div className="st-top">
        <div className="seg sm" role="group">
          <button aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}><Ico name="all" />{L('Todos', 'All')} ({shots.length})</button>
          <button aria-pressed={filtro === 'goles'} onClick={() => setFiltro('goles')}><Ico name="ball" />{L('Goles', 'Goals')} ({goles})</button>
        </div>
        {ranked.length > 0 && (
          <div className="carousel sm">
            <button onClick={() => setK((k - 1 + ranked.length) % ranked.length)} aria-label={L('Tiro anterior', 'Previous shot')}>‹</button>
            <span className="mono">{k + 1}/{ranked.length}</span>
            <button onClick={() => setK((k + 1) % ranked.length)} aria-label={L('Tiro siguiente', 'Next shot')}>›</button>
          </div>
        )}
      </div>
      <Pitch half vertical>
        {list.map(s => {
          const isSel = sel?.i === s.i
          return (
            <circle key={s.i} cx={s.x} cy={s.y} r={0.45 + 1.9 * Math.sqrt(s.xg)} fill={s.gol ? color : 'none'} stroke={color}
              strokeWidth={0.24} opacity={isSel ? 1 : s.gol ? 0.7 : dimNo} style={{ cursor: 'pointer' }}
              onClick={() => setK(ranked.findIndex(r => r.i === s.i))}
              onMouseMove={e => tip.show(e, <ShotTip s={s} media={media} />)} onMouseLeave={tip.hide} />
          )
        })}
        {sel && sel.ex != null && sel.ey != null && (
          <g pointerEvents="none">
            <line x1={sel.x} y1={sel.y} x2={sel.ex} y2={sel.ey} stroke="var(--ink)" strokeWidth={0.45} strokeDasharray={sel.gol ? undefined : '1 0.7'} strokeLinecap="round" />
            <circle cx={sel.ex} cy={sel.ey} r={0.8} fill={sel.gol ? color : 'var(--ink)'} />
            <circle cx={sel.x} cy={sel.y} r={0.45 + 1.9 * Math.sqrt(sel.xg)} fill={sel.gol ? color : 'var(--surface)'} stroke="var(--ink)" strokeWidth={0.4} />
          </g>
        )}
      </Pitch>
      {sel ? (
        <div className="st-detail">
          <div className="st-info">
            <div className="st-who"><b>{sel.jugador}</b><span className={`st-res${sel.gol ? ' gol' : ''}`} style={sel.gol ? { background: color } : undefined}>{RES_ES[sel.res] ?? sel.res}</span></div>
            <div className="st-row"><ClubLogo club={sel.p[1]} media={media} size={16} /><span>vs {sel.p[1]}</span></div>
            <div className="note">{fecha(sel.p[0])} · {sel.p[2] ? L('local', 'home') : L('visita', 'away')} · min {sel.min + 1}'{sel.gp != null ? ` · ${L('iban', 'score was')} ${sel.gp}-${sel.gr}` : ''} · {L('terminó', 'final')} {sel.p[3]}-{sel.p[4]}</div>
            <div className="note">xG {fmt(sel.xg, 2)}{sel.cuerpo ? ` · ${CUERPO_ES[sel.cuerpo]}` : ''}{TIPO_ES[sel.tipo] ? ` · ${TIPO_ES[sel.tipo]}` : ''}</div>
          </div>
          <div className="st-goal-wrap">
          <svg className="st-goal" viewBox="0 19 120 37" role="img" aria-label={L('Dónde terminó el tiro en la portería', 'Where the shot ended up in the goal')}>
            <line x1={0} x2={120} y1={52} y2={52} stroke="var(--ink-3)" strokeWidth={0.6} />
            <rect x={gx(G.y0)} y={gy(G.h)} width={gx(G.y1) - gx(G.y0)} height={gy(0) - gy(G.h)} fill="color-mix(in oklab, var(--pitch) 70%, transparent)" />
            <g stroke="var(--ink-3)" strokeWidth={0.2} opacity={0.6}>
              {[1, 2, 3, 4, 5, 6, 7].map(t => <line key={`v${t}`} x1={gx(G.y0 + t)} x2={gx(G.y0 + t)} y1={gy(G.h)} y2={gy(0)} />)}
              {[0.67, 1.33, 2].map(t => <line key={`h${t}`} x1={gx(G.y0)} x2={gx(G.y1)} y1={gy(t)} y2={gy(t)} />)}
            </g>
            <path d={`M${gx(G.y0)} ${gy(0)} V${gy(G.h)} H${gx(G.y1)} V${gy(0)}`} fill="none" stroke="var(--ink)" strokeWidth={1.2} strokeLinejoin="round" />
            {list.filter(s => s.gol && onFrame(s)).map(s => s.i !== sel.i && (
              <circle key={s.i} cx={gx(Math.max(G.y0 - 4.2, Math.min(G.y1 + 4.2, s.ey!)))} cy={gy(Math.min(4.2, s.ez!))} r={1.3} fill={color} opacity={0.35} />
            ))}
            {onFrame(sel) ? (
              <circle cx={gx(Math.max(G.y0 - 4.2, Math.min(G.y1 + 4.2, sel.ey!)))} cy={gy(Math.min(4.2, sel.ez!))} r={2.6} fill={sel.gol ? color : 'var(--surface)'} stroke="var(--ink)" strokeWidth={0.7} />
            ) : (
              <text x={60} y={30} fontSize={5.5} textAnchor="middle" fill="var(--ink-3)">{sel.res === 'Blocked' ? L('bloqueado antes de llegar', 'blocked before reaching goal') : L('lejos de la portería', 'wide of the goal')}</text>
            )}
          </svg>
          </div>
        </div>
      ) : <div className="note">{L('Sin tiros en este club.', 'No shots at this club.')}</div>}
      {ranked.length > 1 && (
        <div className="st-next">
          <span className="jg-ctrl-label">{L('Siguientes en la lista', 'Next on the list')}</span>
          {[1, 2].map(d => k + d).filter(i => i < ranked.length).map(i => {
            const s = ranked[i]
            return (
              <button key={s.i} className="st-next-row" onClick={() => setK(i)}>
                <span className="mono">{fmt(s.xg, 2)}</span>
                <span className="st-next-name">{s.jugador}</span>
                <ClubLogo club={s.p[1]} media={media} size={14} />
                <span className={`st-res${s.gol ? ' gol' : ''}`} style={s.gol ? { background: color } : undefined}>{RES_ES[s.res] ?? s.res}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="note st-foot">{L(`${fmt(goles, 0)} goles con ${fmt(xg, 1)} xG (goles esperados).`, `${fmt(goles, 0)} ${goles === 1 ? 'goal' : 'goals'} from ${fmt(xg, 1)} xG (expected goals).`)} <Info wide>{L('Tamaño = xG, relleno = gol. Abajo, la portería vista desde el tirador (tenues: sus otros goles). ‹ › va de la ocasión más clara a la menos clara.', 'Size = xG, filled = goal. Below, the goal as the shooter sees it (faded: his other goals). ‹ › runs from the clearest chance to the least clear.')}</Info></div>
      {tip.el}
    </div>
  )
}
