import { fmt, jugadorCorto, type Any } from '../lib'
import { L } from '../settings'
import { posLabel } from '../i18n/data'
import { apellido, signed } from '../compare/util'
import { similares } from '../Compare'
import { kName } from '../tabs/resumenKit'
import { dibujo, FormList, OncePitch } from '../tabs/JugOnce'
import { MinutosCambios, TipoCambios } from '../tabs/JugCambiosViz'
import { MODE_COLOR, type RD } from './data'
import { Bar, Frame, Img, Tile } from './parts'

const Empty = ({ rd, mode, color, title, n, total }: { rd: RD; mode: string; color: string; title: string; n: number; total: number }) => (
  <Frame rd={rd} mode={mode} color={color} title={title} n={n} total={total}><div className="rp-card" style={{ margin: 'auto', textAlign: 'center', color: 'var(--ink-3)' }}>{L('Todavía no hay datos suficientes para esta página.', 'There is not enough data for this page yet.')}</div></Frame>
)

/* ------------------------------------------------------------ jugadores */
export function Jugadores({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const { X, art, media, club } = rd
  const mode = L('Jugadores', 'Players')
  const key = X?.por_club?.[club] ? club : X?.clubes?.at(-1)
  const sel = key ? X.por_club[key] : null
  if (!sel) return <Empty rd={rd} mode={mode} color={MODE_COLOR.jugadores} title={L('Su once y sus cambios', 'His XI and subs')} n={n} total={total} />
  const J = art.jugadores
  const byId: Record<number, Any> = Object.fromEntries((J.jugadores as Any[]).map(j => [j.player_id, j]))
  const rows: Any[] = (sel.jugadores as Any[]).slice(0, 8).map(([id, min, tit, pos]) => ({ id, min, tit, pos, nm: jugadorCorto(id, byId[id]?.nombre ?? '') }))
  const color = 'var(--c-dt)'
  return (
    <Frame rd={rd} mode={mode} color={MODE_COLOR.jugadores} n={n} total={total} title={L(`Su once y sus cambios · ${key}`, `His XI and subs · ${key}`)}
      sub={L(`Cómo para al equipo desde el arranque, cuánto toca el once y cuándo mete los cambios (toda su carrera). Dibujo más usado: ${dibujo(sel.dibujo)}.`, `How he lines the team up, how much he rotates and when he makes subs (whole career). Most used formation: ${dibujo(sel.dibujo)}.`)}>
      <div className="rp-jr">
        <div className="rp-card rp-jr-p"><div className="rp-pitchbox"><OncePitch sel={sel} club={key} media={media} /></div></div>
        <div className="rp-jr-m">
          <div className="rp-tiles">
            <Tile k={L('Dibujo inicial', 'Starting shape')} v={dibujo(sel.dibujo)} s={L(`${sel.partidos_dibujo} de ${sel.partidos} partidos`, `${sel.partidos_dibujo} of ${sel.partidos} matches`)} />
            <Tile k={L('Rotación', 'Rotation')} v={fmt(sel.rotacion)} s={L(`titulares que cambia · típico ${fmt(X.mediana_dts.rotacion)}`, `starters changed · typical ${fmt(X.mediana_dts.rotacion)}`)} />
            <Tile k={L('Cambios de dibujo', 'Shape changes')} v={fmt(sel.cambios_dibujo)} s={L(`por partido · típico ${fmt(X.mediana_dts.cambios_dibujo)}`, `per match · typical ${fmt(X.mediana_dts.cambios_dibujo)}`)} />
          </div>
          <div className="rp-card"><h4>{L('Dibujos que usó', 'Formations used')}</h4><FormList forms={sel.formaciones} total={sel.partidos} color={color} value={sel.dibujo} /></div>
          <div className="rp-card rp-grow">
            <h4>{L('Quién más juega', 'Who plays most')}</h4>
            {rows.slice(0, 8).map(r => <div key={r.id} className="rp-pl"><b>{r.nm}</b><span>{posLabel(r.pos)}</span><i>{fmt(r.min, 0)}′</i><em>{r.tit} {L('tit.', 'st.')}</em></div>)}
          </div>
        </div>
        <div className="rp-jr-m">
          <div className="rp-card"><h4>{L('Minuto de cada cambio', 'Minute of each sub')}</h4><MinutosCambios mc={J.minuto_cambios} ml={J.minuto_cambios_liga} /></div>
          <div className="rp-card rp-grow"><h4>{L('Tipo de cambio según el marcador', 'Type of sub by scoreline')}</h4><TipoCambios data={J.cambios_por_estado} /></div>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------ balón parado */
const TEC: Record<string, [string, string]> = { Inswinging: ['Hacia adentro', 'Inswinging'], Outswinging: ['Hacia afuera', 'Outswinging'], Recto: ['Recto', 'Straight'] }
const ZONAS: [string, string, string][] = [['Segundo palo', 'Segundo palo', 'Far post'], ['Punto penal', 'Punto penal', 'Penalty spot'], ['Primer palo', 'Primer palo', 'Near post'], ['Área chica', 'Área chica', 'Six-yard box'], ['Corto', 'Corto', 'Short']]
export function BalonParado({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const bp = rd.art.balon_parado, o = bp?.ofensivo, d = bp?.defensivo, lg = bp?.liga
  const mode = L('Balón parado', 'Set pieces')
  if (!o || !lg) return <Empty rd={rd} mode={mode} color={MODE_COLOR.bp} title={L('Balón parado', 'Set pieces')} n={n} total={total} />
  const env: number[][] = (rd.C?.favor?.entregas ?? []).filter((e: number[]) => e[0] >= 96)
  const tl: number[][] = (rd.C?.tl?.favor?.tiros ?? []).filter((e: number[]) => e[2] >= 72)
  const mx = Math.max(...ZONAS.map(z => Math.max(o.corner_zonas?.[z[0]] ?? 0, lg.corner_zonas?.[z[0]] ?? 0)), 1)
  const row = (k: string, v: number | undefined, l: number | undefined, f: (x: number) => string) => (
    <div className="rp-bpr"><span>{k}</span><b>{v != null ? f(v) : '—'}</b><small>{L('liga', 'league')} {l != null ? f(l) : '—'}</small></div>
  )
  const dev: { t: string; w: number }[] = []
  for (const z of ZONAS) { const v = o.corner_zonas?.[z[0]], l2 = lg.corner_zonas?.[z[0]]; if (v != null && l2) dev.push({ w: Math.abs(v - l2), t: L(`${z[1]}: ${fmt(v, 0)}% de sus córners (liga ${fmt(l2, 0)}%)`, `${z[2]}: ${fmt(v, 0)}% of his corners (league ${fmt(l2, 0)}%)`) }) }
  const cmp: [string, number | undefined, number | undefined, string, string][] = [['Córners cortos', o.corner_corto_pct, lg.corner_corto_pct, 'córners cortos', 'short corners'], ['Primer contacto', o.corner_primer_contacto_pct, lg.corner_primer_contacto_pct, 'primer contacto ganado', 'first contacts won'], ['Remate', o.corner_remate_pct, lg.corner_remate_pct, 'córners con remate', 'corners ending in a shot']]
  for (const [, v, l2, es, en] of cmp) if (v != null && l2) dev.push({ w: Math.abs(v - l2), t: L(`${fmt(v, 0)}% ${es} (liga ${fmt(l2, 0)}%)`, `${fmt(v, 0)}% ${en} (league ${fmt(l2, 0)}%)`) })
  const insights = dev.sort((x, y) => y.w - x.w).slice(0, 3).map(x => x.t)
  const pct = (x: number) => `${fmt(x, 0)}%`, d1 = (x: number) => fmt(x, 1), d3 = (x: number) => fmt(x, 3)
  return (
    <Frame rd={rd} mode={mode} color={MODE_COLOR.bp} n={n} total={total} title={L('Balón parado: córners y tiros libres', 'Set pieces: corners and free kicks')}
      sub={L(`Cada punto es un córner a favor (hacia la portería de arriba): tamaño = peligro (xG), contorno = gol. Los números se comparan con el promedio de la liga.`, `Each dot is an attacking corner (towards the top goal): size = danger (xG), ring = goal. Numbers are compared with the league average.`)}>
      <div className="rp-bp">
        <div className="rp-card rp-bp-p">
          <h4>{L('A dónde manda los córners', 'Where his corners go')}</h4>
          <svg viewBox="-1 -1 82 46" className="rp-halfp">
            <rect x="0" y="0" width="80" height="44" rx="1" fill="color-mix(in oklab, var(--mc) 8%, var(--paper))" stroke="var(--rule)" />
            <rect x="18" y="0" width="44" height="18" fill="none" stroke="var(--ink-3)" strokeOpacity=".45" strokeWidth=".4" /><rect x="30" y="0" width="20" height="6" fill="none" stroke="var(--ink-3)" strokeOpacity=".45" strokeWidth=".4" />
            <path d="M33 18 A9 9 0 0 0 47 18" fill="none" stroke="var(--ink-3)" strokeOpacity=".45" strokeWidth=".4" /><circle cx="40" cy="12" r=".6" fill="var(--ink-3)" opacity=".6" />
            {env.map((e, i) => <circle key={i} cx={e[1]} cy={120 - e[0]} r={e[4] ? 1.5 : 0.6 + Math.min(1.1, (e[3] ?? 0) * 6)} fill="var(--mc)" fillOpacity={e[4] ? 0.95 : 0.3} stroke={e[4] ? 'var(--ink)' : 'none'} strokeWidth={0.4} />)}
          </svg>
          <h4 style={{ marginTop: 12 }}>{L('Desde dónde cobra sus tiros libres', 'Where his free kicks are taken')}</h4>
          <svg viewBox="-1 -1 82 50" className="rp-halfp">
            <rect x="0" y="0" width="80" height="48" rx="1" fill="color-mix(in oklab, var(--mc) 8%, var(--paper))" stroke="var(--rule)" />
            <rect x="18" y="0" width="44" height="18" fill="none" stroke="var(--ink-3)" strokeOpacity=".45" strokeWidth=".4" /><rect x="30" y="0" width="20" height="6" fill="none" stroke="var(--ink-3)" strokeOpacity=".45" strokeWidth=".4" />
            {tl.map((e, i) => <circle key={i} cx={e[3]} cy={120 - e[2]} r={e[7] === 0 ? 1.6 : 0.8 + Math.min(1.3, (e[6] ?? 0) * 14)} fill="var(--mc)" fillOpacity={e[7] === 0 ? 0.95 : 0.4} stroke={e[7] === 0 ? 'var(--ink)' : 'none'} strokeWidth={0.4} />)}
          </svg>
          <small className="rp-note">{o.corners_por_partido != null && L(`${fmt(o.corners_por_partido, 1)} córners por partido; ${fmt(o.corner_goles, 0)} goles de córner en su carrera.`, `${fmt(o.corners_por_partido, 1)} corners per match; ${fmt(o.corner_goles, 0)} corner goals in his career.`)}</small>
        </div>
        <div className="rp-card">
          <h4>{L('Zona del primer contacto', 'First-contact zone')}</h4>
          {ZONAS.map(z => <div key={z[0]} className="rp-jg-r" style={{ gridTemplateColumns: '110px 1fr 36px' }}><span>{L(z[1], z[2])}</span><Bar v={o.corner_zonas?.[z[0]] ?? 0} lg={lg.corner_zonas?.[z[0]]} max={mx} /><b>{fmt(o.corner_zonas?.[z[0]] ?? 0, 0)}%</b></div>)}
          <small className="rp-note">{L('Raya: liga.', 'Tick: league.')}</small>
          <h4 style={{ marginTop: 12 }}>{L('Cómo los manda', 'Delivery type')}</h4>
          {Object.entries(o.corner_tecnica ?? {}).filter(([k]) => k !== 'Straight').map(([k, v]) => <div key={k} className="rp-jg-r" style={{ gridTemplateColumns: '110px 1fr 36px' }}><span>{TEC[k] ? L(TEC[k][0], TEC[k][1]) : k}</span><Bar v={v as number} lg={lg.corner_tecnica?.[k]} max={60} /><b>{fmt(v as number, 0)}%</b></div>)}
          <h4 style={{ marginTop: 12 }}>{L('Defendiendo', 'Defending')}</h4>
          {row(L('Córners en contra / partido', 'Corners against / match'), d?.corners_por_partido, lg.corners_por_partido, d1)}
          {row(L('xG por córner concedido', 'xG per corner conceded'), d?.corner_xg, lg.corner_xg, d3)}
          {row(L('Defensores en el área', 'Defenders in the box'), d?.defensores_area_360, lg.defensores_area_360, d1)}
        </div>
        <div className="rp-card">
          <h4>{L('Atacando', 'Attacking')}</h4>
          {row(L('Córners cortos', 'Short corners'), o.corner_corto_pct, lg.corner_corto_pct, pct)}
          {row(L('Primer contacto propio', 'Wins first contact'), o.corner_primer_contacto_pct, lg.corner_primer_contacto_pct, pct)}
          {row(L('Córners con remate', 'Corners ending in a shot'), o.corner_remate_pct, lg.corner_remate_pct, pct)}
          {row(L('xG por córner', 'xG per corner'), o.corner_xg, lg.corner_xg, d3)}
          {row(L('Atacantes en el área', 'Attackers in the box'), o.atacantes_area_360, lg.atacantes_area_360, d1)}
          <h4 style={{ marginTop: 12 }}>{L('Tiros libres', 'Free kicks')}</h4>
          {row(L('Tiros libres / partido', 'Free kicks / match'), o.tl_por_partido, lg.tl_por_partido, d1)}
          {row(L('Terminan en remate', 'End in a shot'), o.tl_remate_pct, lg.tl_remate_pct, pct)}
          {row(L('xG por tiro libre', 'xG per free kick'), o.tl_xg, lg.tl_xg, d3)}
          <h4 style={{ marginTop: 12 }}>{L('Lo que más destaca', 'What stands out')}</h4>
          {insights.map((t, i) => <p key={i} className="rp-ins">{t}</p>)}
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------ laboratorio */
function Cum({ ps }: { ps: Any[] }) {
  const sr = [...ps].sort((x, y) => (x.date < y.date ? -1 : 1))
  let a = 0, b = 0
  const pts = sr.map(p => ({ r: (a += p.puntos), x: (b += p.xpts), d: p.date as string }))
  const W = 560, H = 270, l = 40, r = 54, t = 16, bt = 30
  const top = Math.max(50, Math.ceil(Math.max(a, b) / 50) * 50), step = top > 200 ? 100 : 50
  const X = (i: number) => l + (i / Math.max(1, pts.length - 1)) * (W - l - r), Y = (v: number) => H - bt - (v / top) * (H - bt - t)
  const line = (k: 'r' | 'x') => pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join(' ')
  const yt: number[] = []; for (let v = 0; v <= top; v += step) yt.push(v)
  const xt = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * (pts.length - 1)))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rp-cum">
      {yt.map(v => <g key={v}><line x1={l} x2={W - r} y1={Y(v)} y2={Y(v)} stroke="var(--rule)" /><text x={l - 6} y={Y(v) + 3.5} textAnchor="end" className="rp-tick">{v}</text></g>)}
      {xt.map(i => <text key={i} x={X(i)} y={H - bt + 15} textAnchor="middle" className="rp-tick">{pts[i].d.slice(0, 7)}</text>)}
      <path d={line('x')} fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="5 4" />
      <path d={line('r')} fill="none" stroke="var(--mc)" strokeWidth="2.6" />
      <circle cx={X(pts.length - 1)} cy={Y(a)} r="4" fill="var(--mc)" /><circle cx={X(pts.length - 1)} cy={Y(b)} r="4" fill="var(--ink-3)" />
      <text x={X(pts.length - 1) + 8} y={Y(a) + (a >= b ? -2 : 10)} className="rp-endl" fill="var(--mc)">{fmt(a, 0)}</text>
      <text x={X(pts.length - 1) + 8} y={Y(b) + (a >= b ? 10 : -2)} className="rp-endl" fill="var(--ink-2)">{fmt(b, 0)}</text>
    </svg>
  )
}
export function Lab({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const S = rd.art.simulacion
  const mode = L('Laboratorio', 'Lab')
  if (!S?.partidos?.length) return <Empty rd={rd} mode={mode} color={MODE_COLOR.lab} title={L('Laboratorio', 'Lab')} n={n} total={total} />
  const ps: Any[] = S.partidos
  const ov = S.puntos - S.xpts
  const diff = [...ps].map(p => ({ ...p, d: p.puntos - p.xpts })).sort((a, b) => b.d - a.d)
  const tot = ps.length
  const reg = (p: Any) => `${p.local ? '' : '@ '}${p.rival} ${p.gf}-${p.gc}`
  const list = (arr: Any[], up: boolean) => arr.map((p, i) => <div key={i} className="rp-pl"><b>{reg(p)}</b><span>{p.date}</span><i style={{ color: up ? 'var(--div-pos)' : 'var(--div-neg)' }}>{p.d >= 0 ? '+' : '−'}{fmt(Math.abs(p.d), 1)}</i><em>xP {fmt(p.xpts, 1)}</em></div>)
  const avg = (k: string) => ps.reduce((s, p) => s + (p[k] ?? 0), 0) / tot
  return (
    <Frame rd={rd} mode={mode} color={MODE_COLOR.lab} n={n} total={total} title={L('Lo que mereció vs lo que ganó', 'What he deserved vs what he won')}
      sub={L('Cada partido se juega 10 000 veces con los tiros reales (xG) de los dos equipos: así sale cuántos puntos «merecía». Sirve para explicar, no para predecir.', 'Each match is replayed 10,000 times from both teams\' real shots (xG): that gives the points he “deserved”. It explains, it does not predict.')}>
      <div className="rp-tiles rp-tiles4">
        <Tile k={L('Puntos reales', 'Actual points')} v={fmt(S.puntos, 0)} s={L(`en ${tot} partidos`, `in ${tot} matches`)} />
        <Tile k={L('Puntos merecidos', 'Deserved points')} v={fmt(S.xpts, 0)} s={ov >= 0 ? L(`ganó ${fmt(ov, 0)} más de lo que dio el juego`, `won ${fmt(ov, 0)} more than play suggested`) : L(`ganó ${fmt(-ov, 0)} menos de lo que dio el juego`, `won ${fmt(-ov, 0)} fewer than play suggested`)} />
        <Tile k={L('Puntos por partido', 'Points per match')} v={fmt(S.puntos / tot, 2)} s={L(`merecidos ${fmt(S.xpts / tot, 2)}`, `deserved ${fmt(S.xpts / tot, 2)}`)} />
        <Tile k={L('Dominio medio', 'Average dominance')} v={`${fmt(S.dominio_medio, 0)}%`} s={L('del peligro total del partido', 'of the total danger in the match')} />
      </div>
      <div className="rp-lab">
        <div className="rp-card">
          <h4>{L('Puntos acumulados en toda su carrera', 'Cumulative points over his career')}</h4>
          <div className="rp-leg"><span><i style={{ background: 'var(--mc)' }} />{L('Reales', 'Actual')}</span><span><i style={{ background: 'var(--ink-3)' }} />{L('Merecidos (simulación con xG)', 'Deserved (xG simulation)')}</span></div>
          <Cum ps={ps} />
          <small className="rp-note">{L(`xG medio por partido: a favor ${fmt(avg('xg'), 2)} · en contra ${fmt(avg('xg_rival'), 2)}. Cuando la línea real va arriba de la punteada, ganó más de lo que dio el juego.`, `Average xG per match: for ${fmt(avg('xg'), 2)} · against ${fmt(avg('xg_rival'), 2)}. When the solid line is above the dashed one, he won more than play suggested.`)}</small>
        </div>
        <div className="rp-lab-r">
          <div className="rp-card"><h4>{L('Ganó de más', 'Won more than deserved')}</h4>{list(diff.slice(0, 5), true)}</div>
          <div className="rp-card"><h4>{L('Merecía más', 'Deserved more')}</h4>{list(diff.slice(-5).reverse(), false)}</div>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------ cara a cara */
export function Vs({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const { mapa, media, art, glob } = rd
  const mode = L('Cara a cara', 'Head to head')
  const sims = similares(art.id, mapa)
  const me = mapa.puntos.find((p: Any) => p.id === art.id)
  const top = sims.slice(0, 6)
  const B = top[0] && mapa.puntos.find((p: Any) => p.id === top[0].id)
  if (!me || !B) return <Empty rd={rd} mode={mode} color={MODE_COLOR.vs} title={L('Cara a cara', 'Head to head')} n={n} total={total} />
  const gaps = (mapa.kpis as string[]).map(k => ({ k, a: me.alpha[k], b: B.alpha[k], d: me.alpha[k] - B.alpha[k] })).filter(o => o.a != null && o.b != null).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 8)
  const nm = (p: Any) => apellido(p.nombre)
  const M = Math.ceil(Math.max(1.5, ...gaps.flatMap(g => [Math.abs(g.a), Math.abs(g.b)])) * 2) / 2
  const P = (v: number) => ((Math.max(-M, Math.min(M, v)) + M) / (2 * M)) * 100
  const ticks: number[] = []; for (let v = -M; v <= M + 1e-9; v += 0.5) ticks.push(Math.round(v * 2) / 2)
  const same = (mapa.kpis as string[]).map(k => ({ k, a: me.alpha[k], b: B.alpha[k] })).filter(o => o.a != null && o.b != null && Math.sign(o.a) === Math.sign(o.b)).sort((x, y) => Math.min(Math.abs(y.a), Math.abs(y.b)) - Math.min(Math.abs(x.a), Math.abs(x.b))).slice(0, 4)
  return (
    <Frame rd={rd} mode={mode} color={MODE_COLOR.vs} n={n} total={total} title={L(`${nm(me)} frente a ${nm(B)}`, `${nm(me)} vs ${nm(B)}`)}
      sub={L(`Quitando lo que aportan jugadores, club y rival, ${nm(B)} es el DT de la liga más parecido a ${nm(me)} (parecido ${signed(top[0].r)} de 1). Abajo, en qué rasgos más se separan.`, `Stripping out players, club and opponent, ${nm(B)} is the closest coach in the league to ${nm(me)} (similarity ${signed(top[0].r)} out of 1). Below, the traits where they differ most.`)}>
      <div className="rp-vs">
        <div className="rp-card">
          <h4>{L('Los más parecidos', 'Most similar')}</h4>
          {top.map(s => { const p = mapa.puntos.find((q: Any) => q.id === s.id); return <div key={s.id} className="rp-sim"><Img src={media.dts?.[s.id]?.foto} size={28} round /><b>{p.nombre}</b><small>{media.dts?.[s.id]?.club ?? ''}</small><Bar v={Math.max(0, s.r)} max={1} /><i>{signed(s.r)}</i></div> })}
          <h4 style={{ marginTop: 16 }}>{L(`Lo que comparte con ${nm(B)}`, `What he shares with ${nm(B)}`)}</h4>
          {same.map(o => <div key={o.k} className="rp-pl"><b>{kName(o.k, glob)}</b><span>{o.a > 0 ? L('los dos, más que el promedio', 'both above average') : L('los dos, menos que el promedio', 'both below average')}</span><i>{signed(o.a, 1)}</i><em>{signed(o.b, 1)}</em></div>)}
        </div>
        <div className="rp-card">
          <h4><span className="rp-dot" style={{ background: 'var(--c-dt)' }} />{nm(me)} <span className="rp-dot" style={{ background: 'var(--c-rival, #e5484d)' }} />{nm(B)}</h4>
          <div className="rp-dumb head"><span /><div className="rp-dumb-t">{ticks.map(v => <em key={v} style={{ left: `${P(v)}%` }}>{v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'}</em>)}</div><span /></div>
          {gaps.map(g => (
            <div key={g.k} className="rp-dumb"><span>{kName(g.k, glob)}</span>
              <div className="rp-dumb-t">{ticks.map(v => <u key={v} style={{ left: `${P(v)}%`, opacity: v === 0 ? 1 : 0.35 }} />)}<i style={{ left: `${Math.min(P(g.a), P(g.b))}%`, width: `${Math.abs(P(g.a) - P(g.b))}%` }} /><b style={{ left: `${P(g.a)}%`, background: 'var(--c-dt)' }} /><b style={{ left: `${P(g.b)}%`, background: 'var(--c-rival, #e5484d)' }} />
                <s className={g.a >= g.b ? 'r' : 'l'} style={{ left: `${P(g.a)}%` }}>{signed(g.a, 2)}</s><s className={g.a >= g.b ? 'l' : 'r'} style={{ left: `${P(g.b)}%` }}>{signed(g.b, 2)}</s></div>
              <em>{signed(g.d, 1)}</em></div>
          ))}
          <small className="rp-note">{L('Estilo propio en desviaciones típicas respecto al promedio de DTs: 0 = promedio, +1 = claramente más que la mayoría. La cifra de la derecha es la brecha entre los dos.', 'Own style in standard deviations from the average coach: 0 = average, +1 = clearly more than most. The figure on the right is the gap between the two.')}</small>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------ método */
export function Metodo({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const { art } = rd
  const id = art.identificabilidad
  const t = (art.transferencia as Any[])?.find(x => x.coach_id === art.id) ?? art.transferencia?.[0]
  const step = (k: string, h: string, p: string) => <div className="rp-card rp-step"><i>{k}</i><h4>{h}</h4><p>{p}</p></div>
  return (
    <Frame rd={rd} mode={L('Método', 'Method')} color={MODE_COLOR.metodo} n={n} total={total} title={L('Cómo separamos al entrenador de su plantilla', 'How we separate the coach from his squad')}
      sub={L('Idea tomada de la economía laboral (Abowd, Kramarz y Margolis, 1999) y de su uso en el futbol alemán (Muehlheusser et al., 2018), aplicada al estilo de juego en vez de a los resultados.', 'An idea from labour economics (Abowd, Kramarz & Margolis, 1999) and its use in German football (Muehlheusser et al., 2018), applied to playing style instead of results.')}>
      <div className="rp-eq">z<sub>partido</sub> = <b>α<sub>DT</sub></b> + φ<sub>club</sub> + Σ β<sub>jugador</sub>·minutos + γ<sub>rival</sub> + δ·contexto + ε</div>
      <div className="rp-steps">
        {step('1', L('Medir', 'Measure'), L('34 indicadores de estilo por partido (construcción, progresión, ataque, presión, bloque defensivo, transiciones) con los eventos y los datos 360 de StatsBomb.', '34 style indicators per match (build-up, progression, attack, pressing, defensive block, transitions) from StatsBomb events and 360 data.'))}
        {step('2', L('Separar', 'Separate'), L('Una regresión ridge reparte cada indicador entre DT, club, jugadores, rival y contexto. Los DT que cambiaron de club permiten distinguir lo suyo de lo del equipo.', 'A ridge regression splits each indicator between coach, club, players, opponent and context. Coaches who changed clubs let us tell his from the team\'s.'))}
        {step('3', L('Comprobar', 'Check'), L('Prueba de transferencia: ¿se reconoce al DT por su estilo en un club distinto? Se compara contra un azar de permutaciones y se calcula cuánto se puede identificar a cada DT.', 'Transfer test: can the coach be recognised by style at a different club? Compared with a permutation null, plus how identifiable each coach is.'))}
        {step('4', L('Explicar', 'Explain'), L('Mapa de estilos (PCA + k-means), simulador de liga y de partido con xG: sirven para explicar el juego, no para predecir resultados.', 'Style map (PCA + k-means), league and match simulators with xG: they explain play, they do not predict results.'))}
      </div>
      <div className="rp-tiles rp-tiles4">
        {id && <Tile k={L('Identificabilidad', 'Identifiability')} v={`${fmt(id.indice, 0)}/100`} s={L(`${fmt(id.movilidad, 0)} clubes · ${fmt(id.partidos, 0)} partidos`, `${fmt(id.movilidad, 0)} clubs · ${fmt(id.partidos, 0)} matches`)} />}
        {t && <Tile k={L('Se le reconoce con el estilo propio', 'Recognised by own style')} v={`${fmt(t.prob_ajustado * 100, 0)}%`} s={L(`con el estilo crudo: ${fmt(t.prob_crudo * 100, 0)}%`, `with raw style: ${fmt(t.prob_crudo * 100, 0)}%`)} />}
        {t && <Tile k={L('Lugar entre los DTs', 'Rank among coaches')} v={`${t.rank_ajustado}º`} s={L(`de ${t.n_clases} · crudo ${t.rank_crudo}º`, `of ${t.n_clases} · raw ${t.rank_crudo}th`)} />}
        <Tile k={L('Limitaciones', 'Limits')} v="360" s={L('una foto por evento, no tracking; casi todos los partidos la tienen', 'one snapshot per event, not tracking; almost every match has it')} />
      </div>
      <div className="rp-defs">
        <div className="rp-card"><h4>{L('Definiciones que usa todo el informe', 'Definitions used throughout')}</h4>
          <ul>
            <li><b>{L('Jugada efectiva', 'Effective move')}</b> {L('termina en tiro o pisa el área en juego abierto.', 'ends in a shot or reaches the box in open play.')}</li>
            <li><b>{L('Posesión', 'Possession')}</b> {L('secuencia de StatsBomb con al menos un pase propio.', 'a StatsBomb sequence with at least one own pass.')}</li>
            <li><b>{L('Transición', 'Transition')}</b> {L('recuperación seguida de ataque en menos de 10 s.', 'a win-back followed by an attack within 10 s.')}</li>
            <li><b>{L('Presión alta', 'High press')}</b> {L('presiones en el tercio rival, encadenadas en menos de 5 s.', 'pressures in the opponent third, chained within 5 s.')}</li>
          </ul></div>
        <div className="rp-card"><h4>{L('Supuestos', 'Assumptions')}</h4>
          <ul>
            <li>{L('Cada indicador se estandariza contra la liga y se modela con regresión ridge.', 'Each indicator is standardised against the league and modelled with ridge regression.')}</li>
            <li>{L('El efecto del DT sólo se separa si hay jugadores y clubes que se cruzan entre técnicos.', 'The coach effect is only separable when players and clubs overlap between coaches.')}</li>
            <li>{L('xG y OBV son los de StatsBomb; no se recalibran.', 'xG and OBV are StatsBomb\'s; not recalibrated.')}</li>
          </ul></div>
        <div className="rp-card"><h4>{L('Límites', 'Limits')}</h4>
          <ul>
            <li>{L('Sin datos de tracking: los datos 360 son una foto, no una película.', 'No tracking data: 360 frames are a snapshot, not a film.')}</li>
            <li>{L('Con pocos partidos el sello es incierto: por eso cada cifra lleva su margen.', 'With few matches the imprint is uncertain, so each figure carries its margin.')}</li>
            <li>{L('Es descripción, no causalidad; el simulador explica, no pronostica.', 'It is description, not causality; the simulator explains, it does not forecast.')}</li>
          </ul></div>
      </div>
    </Frame>
  )
}
