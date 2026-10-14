import { useEffect, useMemo, useState } from 'react'
import { Pitch } from '../charts'
import { xgColor } from '../Corners3D'
import { Ico } from '../icons'
import Info from '../Info'
import { dataUrl, fmt, getJSON, jugadorCorto, type Any } from '../lib'
import { L } from '../settings'
import { CARRERA, ClubSwitch } from './JugOnce'
import '../styles/bp.css'
import '../styles/tl.css'
import '../styles/jugadores.css'
import '../styles/plan.css'

/* Balón parado, parte 2 (pipeline/bp_extra.py + bp_club.py → bp2.json): cómo defiende los córners
   (marcaje en la foto 360 y zonas donde sufre) y saques de banda en el último tercio.
   Mismo esquema que Córners y Tiros libres: club arriba (el actual por defecto), selector, mapa
   grande y una tarjeta lateral con los números frente a la liga. */

function useBp2(id: number) {
  const [d, setD] = useState<Any>(null)
  useEffect(() => { setD(null); getJSON(dataUrl('bp2.json')).then(b => setD(b.dts?.[String(id)] ? { ...b.dts[String(id)], liga: b.liga } : false)).catch(() => setD(false)) }, [id])
  return d
}

/** Club actual primero; «Toda su carrera» al final (como en Córners y Tiros libres). */
function useClub(art: Any, media: Any, d: Any) {
  const [pick, setPick] = useState<{ id: number; club: string } | null>(null)
  const clubs: string[] = useMemo(() => {
    const all = Object.keys(d?.por_club ?? {})
    const cur = media?.dts?.[art.id]?.club ?? art.etapas?.at(-1)?.club
    const first = all.includes(cur) ? cur : all[all.length - 1]
    return all.length ? [first, ...all.filter(c => c !== first)] : []
  }, [d, media, art])
  const club = pick && pick.id === art.id && (pick.club === CARRERA || clubs.includes(pick.club)) ? pick.club : clubs[0] ?? CARRERA
  const sel = club === CARRERA || !d?.por_club?.[club] ? d?.carrera : d.por_club[club]
  const set = (c: string) => setPick({ id: art.id, club: c })
  const donde = club === CARRERA ? L('en toda su carrera', 'across his career') : L(`en ${club}`, `at ${club}`)
  return { clubs, club, sel, set, donde }
}

const ARW = (v: number | null | undefined, l: number | null | undefined, dir: number) => {
  if (v == null || l == null) return null
  const rel = l ? (v - l) / Math.abs(l) : 0
  if (Math.abs(rel) < 0.04) return <span className="bp-arrow eq" title={L('Como la liga', 'In line with the league')}>≈</span>
  const up = v > l, ok = dir === 0 ? null : up ? dir > 0 : dir < 0
  return <span className={`bp-arrow ${ok == null ? 'eq' : ok ? 'up' : 'down'}`}>{up ? '▲' : '▼'}</span>
}
const Kpi = ({ k, v, l, u = '', d = 1, dir = 0, sub }: { k: string; v: number | null | undefined; l: number | null | undefined; u?: string; d?: number; dir?: number; sub?: string }) => (
  <div><span className="note">{k}</span><b>{v == null ? '—' : `${fmt(v, d)}${u}`} {ARW(v, l, dir)}</b><span className="note">{sub ?? `${L('liga', 'league')} ${l == null ? '—' : `${fmt(l, d)}${u}`}`}</span></div>
)

/** Rejilla de 6×8 del último tercio: [n, xg medio] por celda (x0 → 120 en 6, y 0 → 80 en 8). */
function GridMap({ cells, x0, crop }: { cells: [number, number | null][]; x0: number; crop: [number, number] }) {
  const GX = 6, GY = 8, dx = (120 - x0) / GX, dy = 80 / GY
  const maxN = Math.max(1, ...cells.map(c => c[0]))
  const tot = cells.reduce((a, c) => a + c[0], 0) || 1
  return (
    <Pitch vertical crop={crop}>
      {cells.map(([n, xg], k) => {
        if (n < 2) return null
        const i = Math.floor(k / GY), j = k % GY
        return (
          <circle key={k} cx={x0 + (i + 0.5) * dx} cy={(j + 0.5) * dy} r={0.9 + 3.4 * Math.sqrt(n / maxN)} fill={xgColor((xg ?? 0) / 0.08)} fillOpacity={0.9} stroke="rgba(0,0,0,.35)" strokeWidth={0.25}>
            <title>{`${n} (${fmt((100 * n) / tot, 0)}%) · xG ${fmt(xg ?? 0, 3)}`}</title>
          </circle>
        )
      })}
    </Pitch>
  )
}
const MapKey = () => (
  <div className="c3d-2d-key">
    <span className="c3d-2d-sz"><i style={{ width: 6, height: 6 }} /><i style={{ width: 10, height: 10 }} /><i style={{ width: 15, height: 15 }} />{L('tamaño: cuántos caen ahí', 'size: how many land there')}</span>
    <span className="c3d-key-row c3d-key-scale"><span>xG</span><i style={{ background: `linear-gradient(90deg, ${xgColor(0)}, ${xgColor(0.33)}, ${xgColor(0.66)}, ${xgColor(1)})` }} /><span>0.08+</span></span>
  </div>
)

const ZONA_EN: Record<string, string> = { 'Primer palo': 'Near post', 'Área chica': 'Six-yard box', 'Punto penal': 'Penalty spot', 'Segundo palo': 'Far post', Corto: 'Short' }
const TIPO: Record<string, [string, string, string, string]> = {
  zonal: ['Marca en zona', 'Zonal marking', 'Sus defensores cuidan espacios más que rivales.', 'His defenders guard spaces rather than opponents.'],
  mixto: ['Marca mixta', 'Mixed marking', 'Combina defensores en zona con marcas al hombre.', 'He mixes zonal defenders with man markers.'],
  hombre: ['Marca al hombre', 'Man marking', 'Sus defensores se pegan a un rival más que la mayoría.', 'His defenders stick to an opponent more than most.'],
}

export function BpDefensa({ art, media }: { art: Any; media?: Any }) {
  const d = useBp2(art.id)
  const { clubs, club, sel, set, donde } = useClub(art, media, d)
  if (d === false) return <div className="card note">{L('Aún no hay datos.', 'No data yet.')}</div>
  if (!d) return <div className="card note">{L('Cargando…', 'Loading…')}</div>
  const D = sel?.defensa
  if (!D) return <div className="card note">{L('Aún no hay datos por club para este DT.', 'No per-club data for this coach yet.')}</div>
  const LM = d.liga.marcaje ?? {}, cuts = d.liga.cortes_marcaje ?? LM.cortes
  const zonas: Any[] = D.zonas ?? []
  const maxShare = Math.max(1, ...zonas.map(z => z.pct ?? 0))
  const t = D.tipo ? TIPO[D.tipo] : null
  const est = LM.xg_por_estilo ?? {}
  const lo = 25, hi = 65, X = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100
  return (
    <div className="c3d">
      {clubs.length > 0 && <ClubSwitch clubes={clubs} value={club} set={set} media={media} partidos={Object.fromEntries(clubs.map(c => [c, d.por_club[c].partidos]))} carrera={d.carrera?.partidos ?? 0} />}
      <div className="c3d-ctrl"><span className="note">{L(`${D.n} córners en contra ${donde} · ${D.n360} con foto 360`, `${D.n} corners against ${donde} · ${D.n360} with a 360 snapshot`)}
        <Info wide><p>{L('Mapa: dónde cae cada córner del rival (todos llevados al mismo lado). Tamaño = cuántos caen ahí; color = xG medio de esas jugadas.', 'Map: where each opponent corner lands (all brought to the same side). Size = how many land there; colour = average xG of those plays.')}</p>
          <p>{L('Marcaje: en la foto 360 del momento del saque, cada defensor dentro del área (sin el portero) se empareja uno a uno con el atacante más cercano; a 1.8 m o menos está «pegado». Los cortes zonal / mixta / al hombre son los tercios de los DTs de la liga. La foto no ve los bloqueos ni las carreras posteriores.', 'Marking: in the 360 snapshot at the moment of the kick, each defender inside the box (excluding the keeper) is paired one-to-one with the nearest attacker; within 1.8 m he is «tight». The zonal / mixed / man cut-offs are the league coaches\' thirds. The snapshot does not see screens or later runs.')}</p></Info></span></div>
      <div className="c3d-main">
        <div className="c3d-stage c3d-2d">
          <GridMap cells={D.mapa} x0={90} crop={[86, 121]} />
          <MapKey />
          <div className="c3d-zones">
            <div className="c3d-zones-h">{L('Dónde sufre', 'Where he suffers')}<span className="note">{L('% de los córners en contra · quién gana el primer contacto · xG concedido', '% of corners against · who wins the first contact · xG conceded')}</span></div>
            {zonas.map(z => (
              <div key={z.zona} className="c3d-zone bx-zone">
                <span className="c3d-zone-n">{L(z.zona, ZONA_EN[z.zona] ?? z.zona)}</span>
                <span className="c3d-zone-bar"><i style={{ width: `${(100 * (z.pct ?? 0)) / maxShare}%`, background: xgColor((z.xg ?? z.xg_liga ?? 0) / 0.08) }} /></span>
                <b>{fmt(z.pct, 0)}%</b>
                <small>{z.rival_gana_pct == null ? '—' : L(`rival gana ${fmt(z.rival_gana_pct, 0)}%`, `rival wins ${fmt(z.rival_gana_pct, 0)}%`)}</small>
                <small className={z.xg != null && z.xg_liga && z.xg > z.xg_liga * 1.15 ? 'bx-bad' : ''}>{z.xg == null ? L('pocos', 'few') : `xG ${fmt(z.xg, 3)}`} · {L('liga', 'lg')} {fmt(z.xg_liga, 3)}</small>
              </div>
            ))}
          </div>
        </div>
        <aside className="c3d-side">
          <div>
            <div className="h3">{L('Cómo marca', 'How he marks')}</div>
            <div className="note">{L(`Córners del rival ${donde} · comparado con la liga`, `Opponent corners ${donde} · compared with the league`)}</div>
          </div>
          {t ? <div className="bx-type"><b>{L(t[0], t[1])}</b><span className="note">{L(t[2], t[3])}</span>
            {cuts && <div className="bx-scale" aria-hidden>
              <i className="zo" style={{ width: `${X(cuts[0])}%` }} /><i className="mi" style={{ left: `${X(cuts[0])}%`, width: `${X(cuts[1]) - X(cuts[0])}%` }} /><i className="ho" style={{ left: `${X(cuts[1])}%`, right: 0 }} />
              <b style={{ left: `${X(D.pegados_pct)}%` }} />
            </div>}
            <div className="bx-scale-l note"><span>{L('zonal', 'zonal')}</span><span>{L('mixta', 'mixed')}</span><span>{L('al hombre', 'man')}</span></div>
          </div> : <p className="note">{L('Pocos córners con foto 360 para clasificar su marcaje.', 'Too few corners with a 360 snapshot to classify his marking.')}</p>}
          <div className="c3d-kpis">
            <Kpi k={L('Defensores pegados a un rival', 'Defenders tight to a man')} v={D.pegados_pct} l={LM.pegados_pct} u="%" d={0} />
            <Kpi k={L('Defensores en el área', 'Defenders in the box')} v={D.defensores_area} l={LM.defensores_area} />
            <Kpi k={L('xG concedido por córner', 'xG conceded per corner')} v={D.xg_concedido} l={LM.xg_concedido} d={3} dir={-1} />
            <Kpi k={L('Acaban en remate', 'End in a shot')} v={D.remate_pct} l={LM.remate_pct} u="%" d={0} dir={-1} />
          </div>
          {est.zonal != null && <div className="c3d-who">
            <div className="note">{L('En la liga, xG concedido por córner según el marcaje', 'Across the league, xG conceded per corner by marking')}</div>
            {(['zonal', 'mixto', 'hombre'] as const).map(s => (
              <div key={s} className="c3d-who-row"><span>{L(TIPO[s][0], TIPO[s][1])}</span><span className="c3d-tip-bar"><i style={{ width: `${(100 * est[s]) / Math.max(est.zonal, est.mixto, est.hombre)}%`, background: s === D.tipo ? 'var(--mc)' : 'var(--ink-3)' }} /></span><b>{fmt(est[s], 3)}</b></div>
            ))}
            <div className="note">{L('Casi iguales: ningún marcaje es mejor por sí solo.', 'Almost equal: no marking scheme is better on its own.')}</div>
          </div>}
        </aside>
      </div>
    </div>
  )
}

const ORIG: [string, string][] = [['A 30–40 m de la línea de fondo', '30–40 m from the byline'], ['A 20–30 m', '20–30 m'], ['A 10–20 m', '10–20 m'], ['A menos de 10 m', 'Under 10 m']]
export function Banda({ art, media }: { art: Any; media?: Any }) {
  const d = useBp2(art.id)
  const [side, setSide] = useState<'favor' | 'contra'>('favor')
  const C = useClub(art, media, d)
  if (d === false) return <div className="card note">{L('Aún no hay datos de saques de banda.', 'No throw-in data yet.')}</div>
  if (!d) return <div className="card note">{L('Cargando…', 'Loading…')}</div>
  const perClub = !!C.sel?.banda
  const B = perClub ? C.sel.banda : d.banda
  const S = B[side] ?? {}, LG = d.liga.banda
  const WHO: [number, string, number][] = (perClub && S.lanzadores ? S.lanzadores : d.banda.lanzadores) || []
  const donde = perClub ? C.donde : L('en toda su carrera', 'across his career')
  const g = side === 'favor' ? 1 : -1
  const pts: number[][] = side === 'favor' ? d.banda.puntos : d.banda.puntos_contra
  const orig: number[] = S.origen ?? []
  const totO = orig.reduce((a, b) => a + b, 0) || 1
  return (
    <div className="c3d">
      {perClub && C.clubs.length > 0 && <ClubSwitch clubes={C.clubs} value={C.club} set={C.set} media={media} partidos={Object.fromEntries(C.clubs.map(c => [c, d.por_club[c].partidos]))} carrera={d.carrera?.partidos ?? 0} />}
      <div className="c3d-ctrl">
        <div className="seg sm" role="group"><button aria-pressed={side === 'favor'} onClick={() => setSide('favor')}><Ico name="sword" />{L('A favor', 'Attacking')}</button><button aria-pressed={side === 'contra'} onClick={() => setSide('contra')}><Ico name="shield" />{L('En contra', 'Defending')}</button></div>
        <span className="note">{S.n ?? 0} {L('saques de banda en el último tercio', 'final-third throw-ins')} {donde}
          <Info wide><p>{L('Sólo los saques de banda en el último tercio (a 40 m o menos de la línea de fondo), que son los que pueden acabar en ocasión. «Al área»: el balón cae dentro del área. Remate y xG: tiros de su equipo en la misma jugada durante los 15 segundos siguientes.', 'Only final-third throw-ins (within 40 m of the byline): those are the ones that can lead to a chance. «Into the box»: the ball lands inside the box. Shot and xG: his team\'s shots in the same move within the next 15 seconds.')}</p>
            <p>{perClub ? L('Mapa: dónde cae el balón; tamaño = cuántos, color = xG medio de esas jugadas.', 'Map: where the ball lands; size = how many, colour = average xG of those plays.') : L('Mapa: los saques con más xG de su carrera (hasta 160), del saque a donde cae.', 'Map: his highest-xG throw-ins (up to 160), from the throw to where it lands.')}</p></Info></span>
      </div>
      <div className="c3d-main">
        <div className="c3d-stage c3d-2d">
          {perClub && S.mapa ? <><GridMap cells={S.mapa} x0={80} crop={[76, 121]} /><MapKey /></> : (
            <Pitch vertical crop={[76, 121]}>
              {pts.map((p, i) => { const [x, y, ex, ey, sh, gol, area] = p; return ex == null ? null : (
                <g key={i}>
                  <line x1={x} y1={y} x2={x} y2={y + 1.4} stroke="var(--ink-3)" strokeWidth={0.5} opacity={0.6} />
                  <circle cx={ex} cy={ey} r={sh ? 1.3 : 0.8} fill={sh ? xgColor(0.55) : 'var(--ink-3)'} fillOpacity={area ? 0.95 : 0.45} stroke={gol ? '#fff' : 'rgba(0,0,0,.35)'} strokeWidth={gol ? 0.6 : 0.2} />
                </g>) })}
            </Pitch>
          )}
          {!(perClub && S.mapa) && <div className="c3d-2d-key"><span><i className="bx-dot" style={{ background: xgColor(0.55) }} />{L('acabó en remate', 'ended in a shot')}</span><span><i className="bx-dot" style={{ background: 'var(--ink-3)' }} />{L('sin remate', 'no shot')}</span><span><i className="bx-dot ring" />{L('gol', 'goal')}</span><span className="note">{L('Los 160 con más peligro de su carrera; rayita = desde dónde se sacó.', 'His 160 most dangerous ones; tick = where it was taken from.')}</span></div>}
          {orig.length > 0 && <div className="c3d-zones">
            <div className="c3d-zones-h">{L('Desde dónde los saca', 'Where he takes them from')}<span className="note">{L('% de sus saques en el último tercio', '% of his final-third throw-ins')}</span></div>
            {orig.map((n, i) => (
              <div key={i} className="c3d-zone"><span className="c3d-zone-n">{L(ORIG[i][0], ORIG[i][1])}</span><span className="c3d-zone-bar"><i style={{ width: `${(100 * n) / Math.max(...orig, 1)}%`, background: 'var(--mc)' }} /></span><b>{fmt((100 * n) / totO, 0)}%</b><small>{n}</small></div>
            ))}
          </div>}
        </div>
        <aside className="c3d-side">
          <div>
            <div className="h3">{side === 'favor' ? L('Sus saques de banda', 'His throw-ins') : L('Saques del rival contra su equipo', 'Opponent throw-ins against his team')}</div>
            <div className="note">{donde} · {L('comparado con la liga', 'compared with the league')}</div>
          </div>
          <div className="c3d-kpis">
            <Kpi k={L('Por partido', 'Per match')} v={S.por_partido} l={LG.por_partido} />
            <Kpi k={L('Caen en el área', 'Land in the box')} v={S.al_area_pct} l={LG.al_area_pct} u="%" d={0} />
            <Kpi k={L('Acaban en remate', 'End in a shot')} v={S.remate_pct} l={LG.remate_pct} u="%" d={0} dir={g} />
            <Kpi k={L('xG por partido', 'xG per match')} v={S.xg_por_partido} l={LG.xg_por_partido} d={3} dir={g} sub={`${S.goles ?? 0} ${L('goles', 'goals')} · ${L('liga', 'league')} ${fmt(LG.xg_por_partido, 3)}`} />
            <Kpi k={side === 'favor' ? L('Primer contacto en el área', 'First contact in the box') : L('Primer contacto del rival', 'Opponent first contact')} v={S.area_primer_contacto_pct} l={LG.area_primer_contacto_pct} u="%" d={0} dir={g} />
            <Kpi k={L('Retienen el balón', 'Keep the ball')} v={S.retiene_pct} l={LG.retiene_pct} u="%" d={0} dir={g} />
          </div>
          {side === 'favor' && WHO.length > 0 && <div className="c3d-who">
            <div className="note">{perClub && S.lanzadores ? L(`Quién los mete al área ${C.donde}`, `Who throws them into the box ${C.donde}`) : L('Quién los mete al área (toda su carrera)', 'Who throws them into the box (whole career)')}</div>
            {WHO.map(([id, n, c]: [number, string, number]) => (
              <div key={id} className="c3d-who-row"><span>{jugadorCorto(id, n)}</span><span className="c3d-tip-bar"><i style={{ width: `${(100 * c) / WHO[0][2]}%`, background: 'var(--mc)' }} /></span><b>{c}</b></div>
            ))}
          </div>}
        </aside>
      </div>
    </div>
  )
}
