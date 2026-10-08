import { useState } from 'react'
import { clubColor, fmt, type Any } from '../lib'
import Corners3D, { type Side } from '../Corners3D'
import { L } from '../settings'
import Info from '../Info'
import '../styles/bp.css'

/* Indicadores de balón parado: el lado elegido (a favor / en contra, el mismo del 3D) contra la liga.
   dir = qué es bueno para SU equipo: 1 = más es mejor, -1 = menos es mejor, 0 = estilo (sin juicio). */
type Row = { k: string; fav: string; con: string; u: string; d: number; dirF: number; dirC: number; info?: string; val?: (b: Any, s: Side) => number | null }
const ROWS: Row[] = [
  { k: 'corners_por_partido', fav: L('Córners por partido', 'Corners per match'), con: L('Córners del rival por partido', 'Opponent corners per match'), u: '', d: 1, dirF: 1, dirC: -1 },
  { k: 'corner_xg', fav: L('xG por córner', 'xG per corner'), con: L('xG por córner del rival', 'Opponent xG per corner'), u: '', d: 3, dirF: 1, dirC: -1 },
  { k: 'corner_remate_pct', fav: L('Córners que terminan en remate', 'Corners ending in a shot'), con: L('Córners rivales que terminan en remate', 'Opponent corners ending in a shot'), u: '%', d: 0, dirF: 1, dirC: -1 },
  { k: 'corner_primer_contacto_pct', fav: L('Primer contacto propio', 'First contact won'), con: L('Primer contacto del rival', 'Opponent first contact'), u: '%', d: 0, dirF: 1, dirC: -1 },
  { k: 'corner_corto_pct', fav: L('Córner en corto', 'Short corners'), con: L('Córners rivales en corto', 'Opponent short corners'), u: '%', d: 0, dirF: 0, dirC: 0 },
  { k: 'atacantes_area_360', fav: L('Atacantes en el área', 'Attackers in the box'), con: L('Atacantes rivales en el área', 'Opponent attackers in the box'), u: '', d: 1, dirF: 0, dirC: 0 },
  { k: 'defensores_area_360', fav: L('Defensores rivales en el área', 'Opponent defenders in the box'), con: L('Sus defensores en el área', 'His defenders in the box'), u: '', d: 1, dirF: 0, dirC: 0 },
  { k: 'tl_por_partido', fav: L('Tiros libres en campo rival por partido', 'Free kicks in the opponent half per match'), con: L('Tiros libres del rival en su campo por partido', 'Opponent free kicks in his half per match'), u: '', d: 1, dirF: 1, dirC: -1 },
  { k: 'tl_xg', fav: L('xG por tiro libre', 'xG per free kick'), con: L('xG por tiro libre del rival', 'Opponent xG per free kick'), u: '', d: 3, dirF: 1, dirC: -1 },
  { k: 'tl_remate_pct', fav: L('Tiros libres que terminan en remate', 'Free kicks ending in a shot'), con: L('Tiros libres rivales que terminan en remate', 'Opponent free kicks ending in a shot'), u: '%', d: 0, dirF: 1, dirC: -1 },
  { k: 'banda_peligrosa_por_partido', fav: L('Saques de banda en el último tercio por partido', 'Final-third throw-ins per match'), con: L('Saques de banda del rival en su último tercio', 'Opponent throw-ins in his final third'), u: '', d: 1, dirF: 1, dirC: -1 },
  { k: 'xg_total_por_partido', fav: L('xG de balón parado por partido', 'Set-piece xG per match'), con: L('xG de balón parado recibido por partido', 'Set-piece xG conceded per match'), u: '', d: 2, dirF: 1, dirC: -1,
    info: L('Córners, tiros libres en campo rival y saques de banda en el último tercio; cuenta sólo los remates en los 15 s siguientes al envío. Por eso es menor que «xG de jugadas que nacen de balón parado» del modelo, que sigue toda la posesión e incluye cualquier saque de banda.', 'Corners, free kicks in the opponent half and throw-ins in the final third; only shots within 15 s of the delivery count. That is why it is lower than the model\'s “xG from set-piece-started plays”, which follows the whole possession and includes every throw-in.') },
]

function Card({ r, side, v, l, color }: { r: Row; side: Side; v: number | null; l: number | null; color: string }) {
  const dir = side === 'favor' ? r.dirF : r.dirC
  const has = v != null && l != null && Number.isFinite(v) && Number.isFinite(l)
  const diff = has ? v! - l! : 0
  const same = !has || Math.abs(diff) < Math.max(Math.abs(l!) * 0.03, 1e-9)
  const up = diff > 0
  const cls = same ? 'eq' : dir === 0 ? 'eq' : (up ? dir > 0 : dir < 0) ? 'up' : 'down'
  const dd = r.u === '%' ? 1 : r.d
  const chipTxt = same ? L('≈ liga', '≈ league') : `${up ? '▲' : '▼'} ${fmt(Math.abs(diff), dd)}${r.u === '%' ? ' pts' : ''}`
  const title = same ? L('Como la liga', 'In line with the league') : L(`${up ? 'Más' : 'Menos'} que la liga${dir === 0 ? ' (cuestión de estilo)' : cls === 'up' ? ', bueno para su equipo' : ', malo para su equipo'}`, `${up ? 'Above' : 'Below'} the league${dir === 0 ? ' (a matter of style)' : cls === 'up' ? ', good for his team' : ', bad for his team'}`)
  const max = has ? Math.max(v!, l!) * 1.35 || 1 : 1
  return (
    <div className="bp-card">
      <div className="bp-card-l">{side === 'favor' ? r.fav : r.con}{r.info && <Info>{r.info}</Info>}</div>
      <div className="bp-card-v"><b>{fmt(v, r.d)}{r.u}</b>{has && <span className={`bp-chip ${cls}`} title={title}>{chipTxt}</span>}</div>
      {has && <div className="bp-meter" aria-hidden="true"><i style={{ width: `${(100 * v!) / max}%`, background: color }} /><s style={{ left: `${(100 * l!) / max}%` }} /></div>}
      <div className="bp-card-liga"><span>{L('liga', 'league')} {fmt(l, r.d)}{r.u}</span>{dir === 0 && <span>{L('estilo', 'style')}</span>}</div>
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
      <h3 className="h2">{L('Balón parado', 'Set pieces')}</h3>
      <Corners3D art={art} media={media} side={side} onSide={setSide} />
      <section className="bp-ind">
        <div className="bp-ind-head">
          <div className="h3">{side === 'favor' ? L('Todo su balón parado a favor', 'All his attacking set pieces') : L('Todo el balón parado que recibe', 'All the set pieces he concedes')} · {L('contra la liga', 'vs. the league')}
            <Info wide>
              <p>{L('Flecha ', '')}<span className="bp-arrow up">{L('verde', 'Green')}</span>{L(': mejor que la liga para su equipo. ', ' arrow: better than the league for his team. ')}<span className="bp-arrow down">{L('Roja', 'Red')}</span>{L(': peor. Gris: cuestión de estilo o casi igual a la liga.', ': worse. Grey: a matter of style, or close to the league.')}</p>
              <p>{L('Jugadores en el área: promedio en los fotogramas 360.', 'Players in the box: average across 360 freeze frames.')}</p>
            </Info>
          </div>
          <div className="seg sm" role="group" aria-label={L('Indicadores a favor o en contra', 'Attacking or defending indicators')}>
            <button aria-pressed={side === 'favor'} onClick={() => setSide('favor')}>{L('A favor', 'Attacking')}</button>
            <button aria-pressed={side === 'contra'} onClick={() => setSide('contra')}>{L('En contra', 'Defending')}</button>
          </div>
        </div>
        <div className="bp-grid">
          {ROWS.map(r => <Card key={r.k} r={r} side={side} v={S[r.k] ?? null} l={l[r.k] ?? null} color={color} />)}
        </div>
        <div className="note">{L('Goles de balón parado a favor / en contra: ', 'Set-piece goals scored / conceded: ')}{o.goles ?? 0} / {d.goles ?? 0}</div>
      </section>
    </div>
  )
}
