import { useEffect, useMemo, useState } from 'react'
import { fmt, jugadorCorto, type Any } from './lib'
import { ClubLogo, Pitch, useTip } from './charts'
import { fecha, RES_ES } from './PlayAnim'
import './styles/juego.css'

const CUERPO_ES: Record<string, string> = { 'Right Foot': 'pierna derecha', 'Left Foot': 'pierna izquierda', Head: 'cabeza', Other: 'otra parte' }
const TIPO_ES: Record<string, string> = { Penalty: 'penal', 'Free Kick': 'tiro libre directo', Corner: 'córner directo' }

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
      <div>{fecha(s.p[0])} · {s.p[2] ? 'local' : 'visita'} · terminó {s.p[3]}-{s.p[4]}</div>
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
  const gx = (y: number) => 10 + (y - (G.y0 - 3)) / 14 * 100
  const gy = (z: number) => 40 - z * 100 / 14
  const onFrame = (s: Shot) => s.ez != null && s.ey != null && s.ex != null && s.ex >= 117 && ['Goal', 'Saved', 'Saved to Post', 'Post', 'Off T', 'Saved Off Target'].includes(s.res)
  return (
    <div className="st">
      <div className="st-top">
        <div className="seg sm" role="group">
          <button aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos ({shots.length})</button>
          <button aria-pressed={filtro === 'goles'} onClick={() => setFiltro('goles')}>Goles ({goles})</button>
        </div>
        {ranked.length > 0 && (
          <div className="carousel sm">
            <button onClick={() => setK((k - 1 + ranked.length) % ranked.length)} aria-label="Tiro anterior">‹</button>
            <span className="mono">{k + 1}/{ranked.length}</span>
            <button onClick={() => setK((k + 1) % ranked.length)} aria-label="Tiro siguiente">›</button>
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
          <svg className="st-goal" viewBox="0 0 120 44" role="img" aria-label="Dónde terminó el tiro en la portería">
            <line x1={0} x2={120} y1={40} y2={40} stroke="var(--rule)" strokeWidth={0.8} />
            <rect x={gx(G.y0)} y={gy(G.h)} width={gx(G.y1) - gx(G.y0)} height={gy(0) - gy(G.h)} fill="color-mix(in oklab, var(--pitch) 70%, transparent)" />
            <path d={`M${gx(G.y0)} ${gy(0)} V${gy(G.h)} H${gx(G.y1)} V${gy(0)}`} fill="none" stroke="var(--ink)" strokeWidth={1.2} strokeLinejoin="round" />
            {filtro === 'goles' && list.filter(onFrame).map(s => s.i !== sel.i && (
              <circle key={s.i} cx={gx(Math.max(G.y0 - 3, Math.min(G.y1 + 3, s.ey!)))} cy={gy(Math.min(4.4, s.ez!))} r={0.9} fill={s.gol ? color : 'none'} stroke={color} strokeWidth={0.4} opacity={0.4} />
            ))}
            {onFrame(sel) ? (
              <circle cx={gx(Math.max(G.y0 - 3, Math.min(G.y1 + 3, sel.ey!)))} cy={gy(Math.min(4.4, sel.ez!))} r={2.1} fill={sel.gol ? color : 'var(--surface)'} stroke="var(--ink)" strokeWidth={0.7} />
            ) : (
              <text x={60} y={22} fontSize={6} textAnchor="middle" fill="var(--ink-3)">{sel.res === 'Blocked' ? 'bloqueado antes de llegar' : 'lejos de la portería'}</text>
            )}
          </svg>
          <div className="st-info">
            <div className="st-who"><b>{sel.jugador}</b><span className={`st-res${sel.gol ? ' gol' : ''}`} style={sel.gol ? { background: color } : undefined}>{RES_ES[sel.res] ?? sel.res}</span></div>
            <div className="st-row"><ClubLogo club={sel.p[1]} media={media} size={16} /><span>vs {sel.p[1]}</span></div>
            <div className="note">{fecha(sel.p[0])} · min {sel.min + 1}' · {sel.gp != null ? `iban ${sel.gp}-${sel.gr}` : ''} · terminó {sel.p[3]}-{sel.p[4]}</div>
            <div className="note">xG {fmt(sel.xg, 2)}{sel.cuerpo ? ` · ${CUERPO_ES[sel.cuerpo]}` : ''}{TIPO_ES[sel.tipo] ? ` · ${TIPO_ES[sel.tipo]}` : ''}</div>
          </div>
        </div>
      ) : <div className="note">Sin tiros en este club.</div>}
      <div className="note st-foot">{fmt(goles, 0)} goles con {fmt(xg, 1)} xG. Tamaño = xG; relleno = gol. ‹ › recorre de la ocasión más clara a la menos clara.</div>
      {tip.el}
    </div>
  )
}
