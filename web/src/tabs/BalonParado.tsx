import { fmt, type Any } from '../lib'
import Corners3D from '../Corners3D'

export function BalonParado({ art, media }: { art: Any; media?: Any }) {
  const B = art.balon_parado
  const o = B.ofensivo || {}, d = B.defensivo || {}, l = B.liga || {}
  const rows: [string, string, number | null, number | null, number | null, number?][] = [
    ['Córners por partido', '', o.corners_por_partido, d.corners_por_partido, l.corners_por_partido],
    ['Córner en corto', '%', o.corner_corto_pct, d.corner_corto_pct, l.corner_corto_pct, 0],
    ['Primer contacto propio', '%', o.corner_primer_contacto_pct, d.corner_primer_contacto_pct != null ? 100 - d.corner_primer_contacto_pct : null, l.corner_primer_contacto_pct, 0],
    ['Córners que terminan en remate', '%', o.corner_remate_pct, d.corner_remate_pct, l.corner_remate_pct, 0],
    ['xG por córner', '', o.corner_xg, d.corner_xg, l.corner_xg, 3],
    ['Atacantes en el área (360)', '', o.atacantes_area_360, d.atacantes_area_360, l.atacantes_area_360],
    ['Defensores en el área (360)', '', o.defensores_area_360, d.defensores_area_360, l.defensores_area_360],
    ['Tiros libres en campo rival / partido', '', o.tl_por_partido, d.tl_por_partido, l.tl_por_partido],
    ['xG por tiro libre', '', o.tl_xg, d.tl_xg, l.tl_xg, 3],
    ['Saques de banda en último tercio / partido', '', o.banda_peligrosa_por_partido, d.banda_peligrosa_por_partido, l.banda_peligrosa_por_partido],
    ['xG de balón parado por partido', '', o.xg_total_por_partido, d.xg_total_por_partido, l.xg_total_por_partido, 2],
  ]
  return (
    <div>
      <h3 className="h2">Balón parado</h3>
      <p className="lede">Córners en 3D: cada barra es una zona del área; su <b>altura</b> dice cuántos envíos caen ahí y su <b>color</b>, cuánto xG generan. Los muñecos marcan dónde se paran atacantes y defensores al momento del envío (fotogramas 360). Puedes re-jugar sus córners reales.</p>
      <Corners3D art={art} media={media} />
      <div className="card tbl-wrap" style={{ marginTop: 20 }}>
        <table className="t"><thead><tr><th>Indicador</th><th style={{ textAlign: 'right' }}>A favor</th><th style={{ textAlign: 'right' }}>En contra</th><th style={{ textAlign: 'right' }}>Liga</th></tr></thead>
          <tbody>{rows.map(([n, u, a, b, c, dd]) => <tr key={n}><td>{n}</td><td className="num">{fmt(a, dd ?? 1)}{u}</td><td className="num">{fmt(b, dd ?? 1)}{u}</td><td className="num">{fmt(c, dd ?? 1)}{u}</td></tr>)}</tbody></table>
        <div className="note">«Primer contacto propio» en contra = % de córners rivales en los que su equipo toca primero. Los goles a favor/en contra son {o.goles ?? 0}/{d.goles ?? 0}.</div>
      </div>
    </div>
  )
}

/* ================================================================ SIMULADOR */
