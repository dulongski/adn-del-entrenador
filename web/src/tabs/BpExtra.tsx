import { useEffect, useState } from 'react'
import { Pitch } from '../charts'
import { Ico } from '../icons'
import Info from '../Info'
import { dataUrl, fmt, getJSON, jugadorCorto, type Any } from '../lib'
import { L } from '../settings'
import '../styles/tl.css'
import '../styles/plan.css'

/* Balón parado, parte 2 (pipeline/bp_extra.py → bp2.json): saques de banda en zona de peligro,
   cómo marca en los córners (fotos 360) y en qué zonas sufre. */

function useBp2(id: number) {
  const [d, setD] = useState<Any>(null)
  useEffect(() => { setD(null); getJSON(dataUrl('bp2.json')).then(b => setD(b.dts?.[String(id)] ? { ...b.dts[String(id)], liga: b.liga } : false)).catch(() => setD(false)) }, [id])
  return d
}
const ZONA_EN: Record<string, string> = { 'Primer palo': 'Near post', 'Área chica': 'Six-yard box', 'Punto penal': 'Penalty spot', 'Segundo palo': 'Far post', Corto: 'Short' }
const zona = (z: string) => L(z, ZONA_EN[z] ?? z)

const kpiTile = (lbl: string, v: number | null | undefined, lv: number | null | undefined, unit: string, d = 1, good = 1, sub?: string) => {
  const diff = v != null && lv != null ? v - lv : null
  const same = diff == null || Math.abs(diff) < Math.abs(lv ?? 1) * 0.05
  return (
    <div className="tl-kpi"><span className="note">{lbl}</span>
      <b>{v == null ? '—' : `${fmt(v, d)}${unit}`}{!same && good !== 0 && <i className={(diff! > 0) === (good > 0) ? 'up' : 'dn'}>{diff! > 0 ? '▲' : '▼'}</i>}</b>
      <small>{sub ? `${sub} · ` : ''}{L('liga', 'league')} {lv == null ? '—' : `${fmt(lv, d)}${unit}`}</small></div>
  )
}

export function Banda({ art }: { art: Any }) {
  const d = useBp2(art.id)
  const [side, setSide] = useState<'favor' | 'contra'>('favor')
  if (d === false) return <div className="card note">{L('Aún no hay datos de saques de banda.', 'No throw-in data yet.')}</div>
  if (!d) return <div className="card note">{L('Cargando…', 'Loading…')}</div>
  const B = d.banda, S = B[side], LG = d.liga.banda
  const pts: number[][] = side === 'favor' ? B.puntos : B.puntos_contra
  const g = side === 'favor' ? 1 : -1
  return (
    <div className="tl">
      <div className="tl-ctrl">
        <div className="seg sm" role="group"><button aria-pressed={side === 'favor'} onClick={() => setSide('favor')}><Ico name="sword" />{L('A favor', 'Attacking')}</button><button aria-pressed={side === 'contra'} onClick={() => setSide('contra')}><Ico name="shield" />{L('En contra', 'Defending')}</button></div>
        <span className="note">{S.n} {L('saques de banda en el último tercio', 'final-third throw-ins')} · {d.partidos} {L('partidos', 'matches')}
          <Info wide><p>{L('Sólo cuentan los saques de banda en el último tercio (a 40 m o menos de la línea de fondo), que son los que pueden acabar en ocasión. «Al área»: el balón cae dentro del área. Remate y xG: tiros de su equipo en la misma jugada durante los 15 segundos siguientes.', 'Only throw-ins in the final third count (within 40 m of the byline): those are the ones that can lead to a chance. «Into the box»: the ball lands inside the box. Shot and xG: his team\'s shots in the same move within the next 15 seconds.')}</p>
            <p>{L('Todos se dibujan como si se sacaran desde la banda izquierda.', 'All are drawn as if taken from the left touchline.')}</p></Info></span>
      </div>
      <div className="tl-kpis">
        {kpiTile(L('Por partido', 'Per match'), S.por_partido, LG.por_partido, '', 1, 0)}
        {kpiTile(L('Al área', 'Into the box'), S.al_area_pct, LG.al_area_pct, '%', 0, 0, side === 'favor' && B.pct?.favor_area != null ? L(`más que el ${fmt(B.pct.favor_area, 0)}% de los DTs`, `more than ${fmt(B.pct.favor_area, 0)}% of coaches`) : undefined)}
        {kpiTile(L('Terminan en remate', 'End in a shot'), S.remate_pct, LG.remate_pct, '%', 0, g)}
        {kpiTile(L('xG por partido', 'xG per match'), S.xg_por_partido, LG.xg_por_partido, '', 3, g, `${S.goles} ${L('goles', 'goals')}`)}
        {kpiTile(L('Primer contacto en el área', 'First contact in the box'), S.area_primer_contacto_pct, LG.area_primer_contacto_pct, '%', 0, g, L('de su equipo', 'by his team'))}
      </div>
      <div className="tl-grid">
        <div className="card tl-map">
          <div className="tl-h"><b>{L('Desde dónde y hacia dónde', 'From where and to where')}</b><Info>{L('Línea: del saque al punto donde cae. Color: rosa = cae en el área, gris = no. Punto relleno = acabó en remate; anillo = gol. Se muestran los de más xG (hasta 160).', 'Line: from the throw to where the ball lands. Colour: pink = lands in the box, grey = not. Filled dot = ended in a shot; ring = goal. The highest-xG ones are shown (up to 160).')}</Info></div>
          <Pitch vertical crop={[60, 121]}>
            {pts.map((p, i) => { const [x, y, ex, ey, sh, gol, area] = p; const c = area ? 'var(--mc)' : 'var(--ink-3)'; return (
              <g key={i} opacity={area ? 0.9 : 0.35}>
                {ex != null && <line x1={x} y1={y} x2={ex} y2={ey} stroke={c} strokeWidth={area ? 0.45 : 0.3} />}
                {ex != null && <circle cx={ex} cy={ey} r={sh ? 1.1 : 0.6} fill={sh ? c : 'none'} stroke={gol ? '#fff' : c} strokeWidth={gol ? 0.6 : 0.3} />}
              </g>) })}
          </Pitch>
          <div className="tl-leg"><span><i style={{ background: 'var(--mc)' }} />{L('cae en el área', 'lands in the box')}</span><span><i style={{ background: 'var(--ink-3)' }} />{L('fuera del área', 'outside the box')}</span><span><i className="ring" />{L('gol', 'goal')}</span></div>
        </div>
        <div className="card">
          <div className="tl-h"><b>{L('Qué tanto peligro sacan', 'How much danger they create')}</b></div>
          {(['favor', 'contra'] as const).map(s => { const X = B[s]; return (
            <div key={s} className="bx-style">
              <div className="note">{s === 'favor' ? L('A favor', 'Attacking') : L('En contra', 'Defending')}</div>
              {[[L('Al área', 'Into the box'), X.al_area_pct, LG.al_area_pct, 40], [L('Remate', 'Shot'), X.remate_pct, LG.remate_pct, 25], [L('Retienen el balón', 'Keep the ball'), X.retiene_pct, LG.retiene_pct, 100]].map(([lbl, v, lv, mx]) => (
                <div key={lbl as string} className="bx-sr"><span>{lbl}</span><span className="bar" style={{ position: 'relative' }}><i style={{ width: `${Math.min(100, ((v as number) / (mx as number)) * 100)}%`, background: s === 'favor' ? 'var(--mc)' : 'var(--ink-3)' }} /><u style={{ position: 'absolute', top: -2, bottom: -2, width: 2, background: 'var(--ink)', left: `${Math.min(100, ((lv as number) / (mx as number)) * 100)}%` }} /></span><b className="mono">{fmt(v as number, 0)}%</b></div>
              ))}
            </div>) })}
          <p className="note" style={{ marginTop: 10 }}>{L('Raya negra: promedio de la liga.', 'Black tick: league average.')}</p>
          {B.lanzadores?.length > 0 && <>
            <div className="tl-h" style={{ marginTop: 14 }}><b>{L('Quién los mete al área', 'Who throws them into the box')}</b></div>
            <div className="bx-takers">{B.lanzadores.map(([id, n, c]: [number, string, number]) => <div key={id}><span>{jugadorCorto(id, n)}</span><b className="mono">{c}</b></div>)}</div>
          </>}
        </div>
      </div>
    </div>
  )
}

/* Zonas del área en el marco de ataque del cobrador (pipeline/features/setpieces.ZONES). */
const ZPOLY: Record<string, [number, number, number, number][]> = {
  'Corto': [[90, 0, 102, 80]],
  'Segundo palo': [[102, 0, 120, 30], [102, 50, 120, 80]],
  'Punto penal': [[102, 30, 114, 50]],
  'Primer palo': [[114, 30, 120, 36], [114, 44, 120, 50]],
  'Área chica': [[114, 36, 120, 44]],
}
export function BpDefensa({ art }: { art: Any }) {
  const d = useBp2(art.id)
  if (d === false) return <div className="card note">{L('Aún no hay datos.', 'No data yet.')}</div>
  if (!d) return <div className="card note">{L('Cargando…', 'Loading…')}</div>
  const M = d.marcaje ?? {}, LM = d.liga.marcaje
  const V: Any[] = d.vulnerable ?? []
  const lo = 25, hi = 65
  const X = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100
  const ratio = (z: Any) => (z.xg != null && z.xg_liga ? z.xg / z.xg_liga : null)
  const zc = (z: Any) => { const r = ratio(z); if (r == null) return 'var(--surface-2)'; const t = Math.max(-1, Math.min(1, (r - 1) / 0.6)); return `color-mix(in oklab, ${t >= 0 ? 'var(--div-neg)' : 'var(--div-pos)'} ${Math.round(15 + Math.abs(t) * 60)}%, var(--surface))` }
  const tipo: Record<string, [string, string]> = { zonal: ['Marca en zona', 'Zonal marking'], mixto: ['Marca mixta', 'Mixed marking'], hombre: ['Marca al hombre', 'Man marking'] }
  const est = LM?.xg_por_estilo ?? {}, rem = LM?.remate_por_estilo ?? {}
  const mxs = Math.max(...Object.values(est as Record<string, number>), 0.001)
  return (
    <div className="tl">
      <div className="tl-grid">
        <div className="card">
          <div className="tl-h"><b>{L('Cómo marca en los córners en contra', 'How he marks on corners against')}</b>
            <Info wide><p>{L('En la foto 360 del momento del saque se toman los defensores dentro del área (sin el portero) y se emparejan uno a uno con el atacante más cercano. Si están a 1.8 m o menos, ese defensor está «pegado» a su hombre. Mucho pegado = marca al hombre; poco = zonal (defienden espacios). En medio, mixta.', 'In the 360 snapshot at the moment of the kick, the defenders inside the box (excluding the keeper) are paired one-to-one with the nearest attacker. Within 1.8 m, that defender is «tight» to his man. Lots of tight = man marking; little = zonal (they defend space). In between, mixed.')}</p>
              <p>{L('Los cortes son los tercios de los DTs de la liga. La foto es del instante del saque: no ve los bloqueos ni las carreras que vienen después.', 'The cut-offs are the league coaches\' thirds. The snapshot is from the instant of the kick: it does not see the screens or runs that come afterwards.')}</p></Info></div>
          {M.pegados_pct == null ? <p className="note">{L(`Pocos córners en contra con foto 360 (${M.n ?? 0}) para medir su marcaje.`, `Too few corners against with a 360 snapshot (${M.n ?? 0}) to measure his marking.`)}</p> : <>
            <div className="ti-club"><b className="r">{L(tipo[M.tipo][0], tipo[M.tipo][1])}</b><span className="note">{L(`${fmt(M.pegados_pct, 0)}% de sus defensores pegados a un rival · ${M.n} córners`, `${fmt(M.pegados_pct, 0)}% of his defenders tight to an opponent · ${M.n} corners`)}</span></div>
            <div className="bx-gauge">
              <span className="z zo" style={{ left: 0, width: `${X(LM.cortes[0])}%` }}>{L('Zonal', 'Zonal')}</span>
              <span className="z mi" style={{ left: `${X(LM.cortes[0])}%`, width: `${X(LM.cortes[1]) - X(LM.cortes[0])}%` }}>{L('Mixta', 'Mixed')}</span>
              <span className="z ho" style={{ left: `${X(LM.cortes[1])}%`, width: `${100 - X(LM.cortes[1])}%` }}>{L('Al hombre', 'Man')}</span>
              <span className="me" style={{ left: `${X(M.pegados_pct)}%` }}><span>{fmt(M.pegados_pct, 0)}%</span></span>
              {[30, 40, 50, 60].map(v => <span key={v} className="tick" style={{ left: `${X(v)}%` }}>{v}%</span>)}
            </div>
            <div className="tl-kpis">
              {kpiTile(L('Defensores en el área', 'Defenders in the box'), M.defensores_area, LM.defensores_area, '', 1, 0)}
              {kpiTile(L('En el área chica', 'In the six-yard box'), M.en_area_chica, LM.en_area_chica, '', 1, 0)}
              {kpiTile(L('Córners que acaban en remate', 'Corners ending in a shot'), M.remate_pct, LM?.remate_pct ?? null, '%', 0, -1)}
              {kpiTile(L('xG concedido por córner', 'xG conceded per corner'), M.xg_concedido, LM?.xg_concedido ?? null, '', 3, -1)}
            </div>
          </>}
          {LM && <>
            <div className="tl-h" style={{ marginTop: 14 }}><b>{L('En la liga, ¿qué marcaje concede menos?', 'Across the league, which marking concedes less?')}</b><Info>{L('Todos los córners de la liga con foto 360, repartidos en tercios según cuántos defensores estaban pegados a su rival. Es una descripción, no una causa: los equipos que marcan al hombre pueden ser distintos en otras cosas.', 'All league corners with a 360 snapshot, split into thirds by how many defenders were tight to their man. It describes, it does not prove cause: man-marking teams may differ in other ways.')}</Info></div>
            <div className="bx-style">{(['zonal', 'mixto', 'hombre'] as const).map(s => est[s] != null && (
              <div key={s} className="bx-sr"><span>{L(tipo[s][0], tipo[s][1])}</span><span className="bar"><i style={{ width: `${(est[s] / mxs) * 100}%`, background: s === M.tipo ? 'var(--mc)' : 'var(--ink-3)' }} /></span><b className="mono">{fmt(est[s], 3)}</b></div>))}</div>
            <p className="note">{L(`xG concedido por córner · remate en el ${fmt(rem.zonal, 0)}% (zonal), ${fmt(rem.mixto, 0)}% (mixta) y ${fmt(rem.hombre, 0)}% (al hombre).`, `xG conceded per corner · shot in ${fmt(rem.zonal, 0)}% (zonal), ${fmt(rem.mixto, 0)}% (mixed) and ${fmt(rem.hombre, 0)}% (man).`)}</p>
          </>}
        </div>
        <div className="card bx-box">
          <div className="tl-h"><b>{L('Dónde sufre: zonas de vulnerabilidad', 'Where he suffers: vulnerable zones')}</b><Info>{L('Córners en contra según dónde cae el envío. Color: xG que concede por córner en esa zona frente a la liga (rojo = concede más). Abajo, qué parte de los córners cae ahí y quién gana el primer contacto.', 'Corners against by where the delivery lands. Colour: xG conceded per corner in that zone versus the league (red = concedes more). Below, what share of corners lands there and who wins the first contact.')}</Info></div>
          <Pitch vertical crop={[88, 121]}>
            {V.map(z => (ZPOLY[z.zona] ?? []).map(([x0, y0, x1, y1], i) => <rect key={z.zona + i} x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={zc(z)} fillOpacity={0.85} stroke="var(--pitch-line)" strokeWidth={0.3} />))}
          </Pitch>
          <div className="bx-zt h" style={{ marginTop: 10 }}><span>{L('Zona', 'Zone')}</span><span>{L('Córners', 'Corners')}</span><span>{L('Gana el rival', 'Rival wins')}</span><span>xG</span></div>
          {V.map(z => (
            <div key={z.zona} className="bx-zt"><span><i style={{ background: zc(z) }} />{zona(z.zona)}</span><span><b>{fmt(z.pct, 0)}%</b><br /><small>{L('liga', 'lg')} {fmt(z.pct_liga, 0)}%</small></span>
              <span><b>{z.rival_gana_pct == null ? '—' : `${fmt(z.rival_gana_pct, 0)}%`}</b><br /><small>{L('liga', 'lg')} {fmt(z.rival_gana_liga, 0)}%</small></span>
              <span><b>{z.xg == null ? '—' : fmt(z.xg, 3)}</b><br /><small>{L('liga', 'lg')} {fmt(z.xg_liga, 3)}</small></span></div>
          ))}
        </div>
      </div>
    </div>
  )
}
