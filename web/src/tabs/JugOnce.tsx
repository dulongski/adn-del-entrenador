import { ClubLogo, Pitch, pitchXY, PosTag } from '../charts'
import { clubColor, fmt, jugadorCorto, posTag, type Any } from '../lib'
import { L } from '../settings'
import { posLabel } from '../i18n/data'

/* Once típico sobre una cancha vertical + selector de club. Datos: web/public/data/jugadores_<id>.json
   (pipeline/jugadores_extra.py). Coordenadas StatsBomb: x hacia el arco rival (0-120), y 0 = banda izquierda. */

export const CARRERA = '__carrera__'

/** "4231" -> "4-2-3-1" */
export const dibujo = (f?: string | null) => (f ? f.split('').join('-') : '—')

const XY: Record<string, [number, number]> = {
  'Goalkeeper': [7, 40],
  'Left Back': [30, 9], 'Right Back': [30, 71], 'Center Back': [22, 40], 'Left Center Back': [23, 27], 'Right Center Back': [23, 53],
  'Left Wing Back': [45, 7], 'Right Wing Back': [45, 73],
  'Center Defensive Midfield': [41, 40], 'Left Defensive Midfield': [43, 28], 'Right Defensive Midfield': [43, 52],
  'Center Midfield': [57, 40], 'Left Center Midfield': [58, 27], 'Right Center Midfield': [58, 53],
  'Left Midfield': [62, 9], 'Right Midfield': [62, 71],
  'Center Attacking Midfield': [76, 40], 'Left Attacking Midfield': [77, 21], 'Right Attacking Midfield': [77, 59],
  'Left Wing': [88, 11], 'Right Wing': [88, 69],
  'Center Forward': [101, 40], 'Left Center Forward': [99, 29], 'Right Center Forward': [99, 51], 'Secondary Striker': [91, 40],
}
const GROUP_COLOR: Record<string, string> = { por: '#2a78d6', def: '#eda100', med: '#0a8a0a', del: '#d03b3b', none: 'var(--ink-3)' }

function coords(once: Any[]) {
  const set = new Set(once.map(o => o.pos))
  return once.map(o => {
    let [x, y] = XY[o.pos] ?? [60, 40]
    // línea de tres centrales: abrir a los laterales del central
    if (set.has('Center Back') && (o.pos === 'Left Center Back' || o.pos === 'Right Center Back')) y = o.pos === 'Left Center Back' ? 20 : 60
    // doble pivote con mediocentro delante: el central sube un poco
    if (o.pos === 'Center Midfield' && (set.has('Left Defensive Midfield') || set.has('Center Defensive Midfield'))) x = 60
    return { ...o, x, y }
  })
}

export function OncePitch({ sel, club, media }: { sel: Any; club: string | null; media: Any }) {
  const pts = coords(sel.once ?? [])
  const maxTit = Math.max(1, ...pts.map(p => p.tit))
  return (
    <div className="jg-pitch">
      <Pitch vertical labels={
        <g>
          {pts.map(p => {
            const [sx, sy] = pitchXY(p.x, p.y, true)
            const g = posTag(p.posicion).group
            const nm = jugadorCorto(p.id, p.nombre)
            return (
              <g key={p.id}>
                <title>{L(`${p.nombre} · ${p.posicion} · titular ${p.tit} de ${sel.partidos_dibujo} veces con este dibujo`, `${p.nombre} · ${posLabel(p.posicion)} · started ${p.tit} of ${sel.partidos_dibujo} times in this formation`)}</title>
                <circle cx={sx} cy={sy} r={4.1} fill={GROUP_COLOR[g]} stroke="var(--surface)" strokeWidth={0.7} opacity={0.55 + 0.45 * p.tit / maxTit} />
                <text x={sx} y={sy + 1.2} fontSize={2.9} fontWeight={800} textAnchor="middle" fill={g === 'def' ? '#1b1400' : '#fff'} style={{ fontFamily: 'var(--display)' }}>{posTag(p.posicion).abbr}</text>
                <text x={sx} y={sy + 7.6} fontSize={3.2} fontWeight={700} textAnchor="middle" fill="#fff" stroke="rgba(0,0,0,.55)" strokeWidth={0.8} paintOrder="stroke">{nm.length > 16 ? nm.split(' ').slice(-1)[0] : nm}</text>
              </g>
            )
          })}
        </g>
      } />
      <div className="jg-pitch-cap">
        {club ? <ClubLogo club={club} media={media} size={22} /> : null}
        <span><b>{dibujo(sel.dibujo)}</b> · {L('el once que más se repitió con ese dibujo', 'his most repeated XI in that formation')}</span>
      </div>
    </div>
  )
}

export function ClubSwitch({ clubes, value, set, media, partidos, carrera }: {
  clubes: string[]; value: string; set: (c: string) => void; media: Any; partidos: Record<string, number>; carrera: number
}) {
  return (
    <div className="jg-switch" role="group" aria-label={L('Elegir club', 'Choose club')}>
      {clubes.map(c => (
        <button key={c} aria-pressed={value === c} onClick={() => set(c)} style={{ ['--cc' as string]: clubColor(c, media) }}>
          <ClubLogo club={c} media={media} size={18} /><span>{c}</span><small>{partidos[c]} {L('p.', 'MP')}</small>
        </button>
      ))}
      {clubes.length > 1 && (
        <button aria-pressed={value === CARRERA} onClick={() => set(CARRERA)}>
          <span>{L('Toda su carrera', 'Whole career')}</span><small>{carrera} {L('p.', 'MP')}</small>
        </button>
      )}
    </div>
  )
}

export function FormList({ forms, total, color, value, onPick }: { forms: Record<string, number>; total: number; color: string; value?: string | null; onPick?: (f: string) => void }) {
  const rows = Object.entries(forms).sort((a, b) => b[1] - a[1])
  const top = rows.slice(0, 8)
  const rest = rows.slice(8).reduce((s, [, v]) => s + v, 0)
  const all = rest ? [...top, ['otros', rest] as [string, number]] : top
  const max = Math.max(...all.map(r => r[1]), 1)
  return (
    <div className="jg-forms">
      {all.map(([f, v]) => {
        const on = value === f, can = !!onPick && f !== 'otros'
        const Tag: Any = can ? 'button' : 'div'
        return (
          <Tag key={f} className={`jg-form-row${can ? ' pick' : ''}${on ? ' on' : ''}`} {...(can ? { onClick: () => onPick!(f), 'aria-pressed': on, title: L('Ver su once más probable con este dibujo', 'See his most likely XI in this formation') } : {})}>
            <span className={on ? 'jg-form-name top' : 'jg-form-name'}>{f === 'otros' ? L('Otros', 'Other') : dibujo(f)}</span>
            <span className="jg-form-bar"><i style={{ width: `${(100 * v) / max}%`, background: on ? color : 'var(--ink-3)' }} /></span>
            <span className="jg-form-val">{fmt((100 * v) / total, 0)}%<small> · {v} {L('p.', 'MP')}</small></span>
          </Tag>
        )
      })}
      {onPick && <div className="note jg-form-hint">{L('Toca un dibujo para ver su once más probable.', 'Tap a formation to see his most likely XI.')}</div>}
    </div>
  )
}

/** Lista del once típico, de atrás hacia adelante, con cuántas veces arrancó cada uno con ese dibujo. */
export function OnceList({ sel, color }: { sel: Any; color: string }) {
  const pts = coords(sel.once ?? []).sort((a, b) => a.x - b.x || a.y - b.y)
  const n = sel.partidos_dibujo || 1
  return (
    <div className="jg-xi" style={{ gridTemplateRows: `repeat(${Math.ceil(pts.length / 2)}, auto)` }}>
      {pts.map(p => (
        <div key={p.id} className="jg-xi-row" title={L(`${p.nombre}: titular ${p.tit} de ${n} partidos con ${dibujo(sel.dibujo)}`, `${p.nombre}: started ${p.tit} of ${n} matches in the ${dibujo(sel.dibujo)}`)}>
          <PosTag pos={p.posicion} />
          <span className="jg-xi-name">{jugadorCorto(p.id, p.nombre)}</span>
          <span className="jg-form-bar"><i style={{ width: `${(100 * p.tit) / n}%`, background: color }} /></span>
          <span className="jg-form-val">{p.tit}<small> {L('de', 'of')} {n}</small></span>
        </div>
      ))}
    </div>
  )
}
