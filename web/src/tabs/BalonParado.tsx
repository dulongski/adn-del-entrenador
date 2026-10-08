import { useState } from 'react'
import { clubColor, fmt, type Any } from '../lib'
import Corners3D, { type Side } from '../Corners3D'
import '../styles/bp.css'

/* Indicadores de balón parado: el lado elegido (a favor / en contra, el mismo del 3D) contra la liga.
   dir = qué es bueno para SU equipo: 1 = más es mejor, -1 = menos es mejor, 0 = estilo (sin juicio). */
type Row = { k: string; fav: string; con: string; u: string; d: number; dirF: number; dirC: number; val?: (b: Any, s: Side) => number | null }
const ROWS: Row[] = [
  { k: 'corners_por_partido', fav: 'Córners por partido', con: 'Córners del rival por partido', u: '', d: 1, dirF: 1, dirC: -1 },
  { k: 'corner_xg', fav: 'xG por córner', con: 'xG por córner del rival', u: '', d: 3, dirF: 1, dirC: -1 },
  { k: 'corner_remate_pct', fav: 'Córners que terminan en remate', con: 'Córners rivales que terminan en remate', u: '%', d: 0, dirF: 1, dirC: -1 },
  { k: 'corner_primer_contacto_pct', fav: 'Primer contacto propio', con: 'Primer contacto del rival', u: '%', d: 0, dirF: 1, dirC: -1 },
  { k: 'corner_corto_pct', fav: 'Córner en corto', con: 'Córners rivales en corto', u: '%', d: 0, dirF: 0, dirC: 0 },
  { k: 'atacantes_area_360', fav: 'Atacantes en el área', con: 'Atacantes rivales en el área', u: '', d: 1, dirF: 0, dirC: 0 },
  { k: 'defensores_area_360', fav: 'Defensores rivales en el área', con: 'Sus defensores en el área', u: '', d: 1, dirF: 0, dirC: 0 },
  { k: 'tl_por_partido', fav: 'Tiros libres en campo rival por partido', con: 'Tiros libres del rival en su campo por partido', u: '', d: 1, dirF: 1, dirC: -1 },
  { k: 'tl_xg', fav: 'xG por tiro libre', con: 'xG por tiro libre del rival', u: '', d: 3, dirF: 1, dirC: -1 },
  { k: 'tl_remate_pct', fav: 'Tiros libres que terminan en remate', con: 'Tiros libres rivales que terminan en remate', u: '%', d: 0, dirF: 1, dirC: -1 },
  { k: 'banda_peligrosa_por_partido', fav: 'Saques de banda en el último tercio por partido', con: 'Saques de banda del rival en su último tercio', u: '', d: 1, dirF: 1, dirC: -1 },
  { k: 'xg_total_por_partido', fav: 'xG de balón parado por partido', con: 'xG de balón parado recibido por partido', u: '', d: 2, dirF: 1, dirC: -1 },
]

function Card({ r, side, v, l, color }: { r: Row; side: Side; v: number | null; l: number | null; color: string }) {
  const dir = side === 'favor' ? r.dirF : r.dirC
  const has = v != null && l != null && Number.isFinite(v) && Number.isFinite(l)
  const diff = has ? v! - l! : 0
  const same = !has || Math.abs(diff) < Math.max(Math.abs(l!) * 0.03, 1e-9)
  const up = diff > 0
  const cls = same ? 'eq' : dir === 0 ? 'eq' : (up ? dir > 0 : dir < 0) ? 'up' : 'down'
  const dd = r.u === '%' ? 1 : r.d
  const chipTxt = same ? '≈ liga' : `${up ? '▲' : '▼'} ${fmt(Math.abs(diff), dd)}${r.u === '%' ? ' pts' : ''}`
  const title = same ? 'Como la liga' : `${up ? 'Más' : 'Menos'} que la liga${dir === 0 ? ' (cuestión de estilo)' : cls === 'up' ? ', bueno para su equipo' : ', malo para su equipo'}`
  const max = has ? Math.max(v!, l!) * 1.35 || 1 : 1
  return (
    <div className="bp-card">
      <div className="bp-card-l">{side === 'favor' ? r.fav : r.con}</div>
      <div className="bp-card-v"><b>{fmt(v, r.d)}{r.u}</b>{has && <span className={`bp-chip ${cls}`} title={title}>{chipTxt}</span>}</div>
      {has && <div className="bp-meter" aria-hidden="true"><i style={{ width: `${(100 * v!) / max}%`, background: color }} /><s style={{ left: `${(100 * l!) / max}%` }} /></div>}
      <div className="bp-card-liga"><span>liga {fmt(l, r.d)}{r.u}</span>{dir === 0 && <span>estilo</span>}</div>
    </div>
  )
}

export function BalonParado({ art, media }: { art: Any; media?: Any }) {
  const [side, setSide] = useState<Side>('favor')
  const B = art.balon_parado
  const o = B.ofensivo || {}, d = B.defensivo || {}, l = B.liga || {}
  const S = side === 'favor' ? o : d
  const club = media?.dts?.[art.id]?.club ?? art.etapas?.at(-1)?.club
  const color = clubColor(club, media)
  return (
    <div>
      <h3 className="h2">Balón parado</h3>
      <Corners3D art={art} media={media} side={side} onSide={setSide} />
      <section className="bp-ind">
        <div className="bp-ind-head">
          <div className="h3">{side === 'favor' ? 'Todo su balón parado a favor' : 'Todo el balón parado que recibe'} · contra la liga</div>
          <div className="seg sm" role="group" aria-label="Indicadores a favor o en contra">
            <button aria-pressed={side === 'favor'} onClick={() => setSide('favor')}>A favor</button>
            <button aria-pressed={side === 'contra'} onClick={() => setSide('contra')}>En contra</button>
          </div>
        </div>
        <div className="bp-grid">
          {ROWS.map(r => <Card key={r.k} r={r} side={side} v={S[r.k] ?? null} l={l[r.k] ?? null} color={color} />)}
        </div>
        <div className="note">
          Flecha <span className="bp-arrow up">verde</span>: mejor que la liga para su equipo. <span className="bp-arrow down">Roja</span>: peor. Gris: cuestión de estilo o casi igual a la liga.
          {' '}Jugadores en el área: promedio en los fotogramas 360. Goles de balón parado a favor / en contra: {o.goles ?? 0} / {d.goles ?? 0}.
        </div>
      </section>
    </div>
  )
}
