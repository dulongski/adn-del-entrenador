import { fmt, jugadorCorto, shortName, type Any } from '../lib'
import { L, LANG } from '../settings'
import { kName } from '../tabs/resumenKit'
import { MODE_COLOR, type RD } from './data'
import { Frame, Logo, Tile } from './parts'

/* Páginas del informe para lo accionable, el tiempo, el balón parado 2 y las pruebas del método. */
const Empty = ({ rd, mode, color, title, n, total }: { rd: RD; mode: string; color: string; title: string; n: number; total: number }) => (
  <Frame rd={rd} mode={mode} color={color} title={title} n={n} total={total}><div className="rp-card" style={{ margin: 'auto', textAlign: 'center', color: 'var(--ink-3)' }}>{L('Todavía no hay datos suficientes para esta página.', 'There is not enough data for this page yet.')}</div></Frame>
)
const divColor = (v: number, sc: number) => `color-mix(in oklab, ${v >= 0 ? 'var(--div-pos)' : 'var(--div-neg)'} ${Math.round(8 + Math.min(1, Math.abs(v) / sc) * 55)}%, var(--paper))`
const tx = (a: Any, k: string) => (LANG === 'en' ? a[`${k}_en`] : a[k]) ?? a[k]
const FC: Record<string, string> = { con: 'var(--c-dt)', sin: 'var(--c-club)', trans: 'var(--c-rival)', bp: 'var(--c-ctx)', partido: 'var(--c-plantilla)' }
const ZONA_EN: Record<string, string> = { 'Primer palo': 'Near post', 'Área chica': 'Six-yard box', 'Punto penal': 'Penalty spot', 'Segundo palo': 'Far post', Corto: 'Short' }

function evLine(a: Any, glob: Any): string {
  const e = a.evidencia?.[0] ?? {}
  if (a.id === 'contexto') return `${kName(e.kpi, glob)} · ${e.nivel}: ${e.dif >= 0 ? '+' : '−'}${fmt(Math.abs(e.dif), 1)}σ ${L('frente a la liga', 'vs league')}`
  if (a.id === 'bp_vulnerable') return `${L(e.zona, ZONA_EN[e.zona] ?? e.zona)}: xG ${fmt(e.xg, 3)} · ${L('liga', 'league')} ${fmt(e.xg_liga, 3)}`
  if (a.id === 'bp_marcaje') return `${fmt(e.pegados_pct, 0)}% ${L('de defensores pegados', 'defenders tight')} · ${e.n} ${L('córners', 'corners')}`
  if (a.id === 'bp_sus_corners') return `${L(e.zona, ZONA_EN[e.zona] ?? e.zona)}: ${fmt(e.pct, 0)}% · ${L('liga', 'league')} ${fmt(e.liga, 0)}%`
  if (a.id === 'bp_banda') return `${fmt(e.al_area_pct, 0)}% ${L('al área', 'into the box')}`
  if (a.id === 'banca') return `${L('1er cambio', '1st sub')} ${fmt(e.primer_cambio, 0)}' · ${L('liga', 'league')} ${fmt(e.liga, 0)}'`
  return (a.evidencia as Any[]).map(x => `${kName(x.kpi, glob)}: ${x.sello} · ${L('liga', 'league')} ${x.liga}`).join(' · ')
}

/* ------------------------------------------------------------ plan de partido */
export function PlanPage({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const P = rd.plan
  const mode = L('Plan de partido', 'Game plan')
  if (!P?.acciones?.length) return <Empty rd={rd} mode={mode} color={MODE_COLOR.plan} title={L('Cómo jugarle', 'How to play him')} n={n} total={total} />
  const F = P.meta.fases
  const T = P.tablero
  const first = shortName(rd.art.nombre)
  const sur = first.split(' ').slice(1).join(' ') || first
  return (
    <Frame rd={rd} mode={mode} color={MODE_COLOR.plan} n={n} total={total} title={L(`Cómo jugarle a ${first}`, `How to play ${first}`)}
      sub={L('Cada clave sale de una regla fija: sólo se activa si el rasgo de su sello es claro (|α| ≥ 0.25 y ≥ 1.64 errores estándar). Su sello no depende de la plantilla que tenga hoy.', 'Each key comes from a fixed rule: it only fires if the trait in his imprint is clear (|α| ≥ 0.25 and ≥ 1.64 standard errors). His imprint does not depend on today\'s squad.')}>
      <div className="rp-plan">
        <div className="rp-plan-g">
          {(P.acciones as Any[]).slice(0, 6).map((a, i) => (
            <div key={a.id} className="rp-card rp-pk" style={{ ['--fc' as string]: FC[a.fase] }}>
              <span className="rp-pk-f">{a.fase === 'con' ? L(`Cuando ${sur} tiene el balón`, `When ${sur} has the ball`) : a.fase === 'sin' ? L('Cuando su rival tiene el balón', 'When his opponent has the ball') : L(F[a.fase]?.es ?? a.fase, F[a.fase]?.en ?? a.fase)}</span>
              <h4><i>{i + 1}</i>{tx(a, 'titulo')}</h4>
              <p>{tx(a, 'texto')}</p>
              <small>{evLine(a, rd.glob)}</small>
            </div>
          ))}
        </div>
        {T && <div className="rp-card rp-plan-t">
          <h4>{L(`Seguimiento: últimos ${T.n} partidos`, `Tracking: last ${T.n} matches`)}</h4>
          {(T.rasgos as Any[]).map(r => {
            const M = 2.2, X = (v: number) => ((Math.max(-M, Math.min(M, v)) + M) / (2 * M)) * 100
            return (
              <div key={r.kpi} className="rp-tb">
                <span>{kName(r.kpi, rd.glob)}</span>
                <div><u style={{ left: '50%' }} /><i style={{ left: `${X(r.banda[0])}%`, width: `${X(r.banda[1]) - X(r.banda[0])}%` }} /><em style={{ left: `${X(r.carrera)}%` }} /><b className={r.estado !== 'en_linea' ? 'off' : ''} style={{ left: `${X(r.ultimos)}%` }} /></div>
                <small>{r.estado === 'en_linea' ? L('en su línea', 'on track') : r.estado === 'arriba' ? L('por encima', 'above') : L('por debajo', 'below')}</small>
              </div>
            )
          })}
          <small className="rp-note">{L('Franja: lo esperable si sigue jugando igual. Raya: su carrera. Punto: últimos partidos. Eje −2σ a +2σ.', 'Band: expected if he keeps playing the same. Tick: his career. Dot: recent matches. Axis −2σ to +2σ.')}</small>
          {T.resultados && <div className="rp-tiles" style={{ marginTop: 10 }}>
            <Tile k={L('Puntos/partido', 'Points/match')} v={fmt(T.resultados.pts[0], 2)} s={`${L('carrera', 'career')} ${fmt(T.resultados.pts[1], 2)}`} />
            <Tile k={L('Merecidos', 'Deserved')} v={fmt(T.resultados.xpts[0], 2)} s={`${L('carrera', 'career')} ${fmt(T.resultados.xpts[1], 2)}`} />
            <Tile k={L('Dif. xG', 'xG diff.')} v={fmt(T.resultados.xgd[0], 2)} s={`${L('carrera', 'career')} ${fmt(T.resultados.xgd[1], 2)}`} />
          </div>}
          {P.fichajes && <><h4 style={{ marginTop: 12 }}>{L('Jugadores que encajan con su estilo', 'Players who fit his style')}</h4>
            <p className="rp-fit">{(P.fichajes.liga as Any[]).slice(0, 5).map(p => `${jugadorCorto(p.id, p.nombre)} (${p.club})`).join(' · ')}</p></>}
        </div>}
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------ a lo largo del tiempo */
export function TiempoPage({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const T = rd.tiempo
  const mode = L('Cómo juega', 'How he plays')
  if (!T?.torneos?.length) return <Empty rd={rd} mode={mode} color={MODE_COLOR.juego} title={L('A lo largo del tiempo', 'Over time')} n={n} total={total} />
  const K: string[] = T.kpis
  const car = T.ultimos.carrera
  const rows = K.map((k, i) => ({ k, i, c: car[k] ?? 0 })).sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 10)
  const tor: Any[] = T.torneos.slice(-10)
  const off = T.torneos.length - tor.length
  const id = T.identidad
  return (
    <Frame rd={rd} mode={mode} color={MODE_COLOR.juego} n={n} total={total} title={L('¿Mantiene su identidad con el tiempo?', 'Does he keep his identity over time?')}
      sub={L('Su estilo propio (sin jugadores, club, rival ni contexto), torneo a torneo, en desviaciones típicas frente a la liga. Estabilidad: correlación de cada torneo con el resto de su carrera.', 'His own style (net of players, club, opponent and context), tournament by tournament, in standard deviations vs the league. Stability: correlation of each tournament with the rest of his career.')}>
      <div className="rp-hero">
        <div><span>{L('Estabilidad de su estilo', 'Style stability')}</span><b className="up">{fmt(id.r, 2)}</b><em>{id.pct != null ? L(`más estable que el ${fmt(id.pct, 0)}% de los DTs`, `more stable than ${fmt(id.pct, 0)}% of coaches`) : ''}</em></div>
        <div><span>{L('Parecido con otro DT', 'Similarity to another coach')}</span><b>{fmt(id.base, 2)}</b><em>{L('la referencia del azar', 'the chance baseline')}</em></div>
        <div><span>{L('Cambios claros', 'Clear changes')}</span><b>{T.cambios.length}</b><em>{L('entre torneos seguidos', 'between consecutive tournaments')}</em></div>
        <div><span>{L('De club a club', 'Club to club')}</span><b>{T.clubes.length ? fmt(T.clubes.at(-1).r, 2) : '—'}</b><em>{T.clubes.length ? `${T.clubes.at(-1).de} → ${T.clubes.at(-1).a}` : L('un solo club', 'a single club')}</em></div>
      </div>
      <div className="rp-card rp-ti">
        <div className="rp-ti-g" style={{ gridTemplateColumns: `190px 64px repeat(${tor.length}, 1fr)` }}>
          <span /><b>{L('Carrera', 'Career')}</b>{tor.map(t => <b key={t.id} className="h"><Logo rd={rd} club={t.club} size={14} />{t.id}</b>)}
          {rows.map(r => [
            <span key={r.k + 'l'} className="l">{kName(r.k, rd.glob)}</span>,
            <span key={r.k + 'c'} className="c car" style={{ background: divColor(r.c, 1.5) }}>{r.c >= 0 ? '+' : '−'}{fmt(Math.abs(r.c), 1)}</span>,
            ...tor.map((t, j) => { const v = T.m[off + j][r.i]; return <span key={r.k + t.id} className={`c${t.n < 10 ? ' weak' : ''}`} style={{ background: divColor(v ?? 0, 1.5) }}>{v == null ? '' : `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), 1)}`}</span> }),
          ])}
          <span className="l"><i>{L('Estabilidad del torneo', 'Tournament stability')}</i></span><span />
          {tor.map((t, j) => <span key={'r' + t.id} className="c st">{T.perfil_r[off + j] == null ? '—' : fmt(T.perfil_r[off + j], 2)}</span>)}
        </div>
        <small className="rp-note">{T.cambios.length === 0 ? L('Ningún cambio entre torneos supera al azar (Benjamini–Hochberg, 10%): las diferencias de la tabla son ruido de torneo.', 'No change between tournaments beats chance (Benjamini–Hochberg, 10%): the differences in the table are tournament noise.') : L(`Cambios claros: ${T.cambios.slice(0, 3).map((c: Any) => `${kName(c.kpi, rd.glob)} ${c.de}→${c.a} (${c.dif >= 0 ? '+' : '−'}${fmt(Math.abs(c.dif), 1)}σ)`).join(' · ')}`, `Clear changes: ${T.cambios.slice(0, 3).map((c: Any) => `${kName(c.kpi, rd.glob)} ${c.de}→${c.a} (${c.dif >= 0 ? '+' : '−'}${fmt(Math.abs(c.dif), 1)}σ)`).join(' · ')}`)} {L('Celdas tenues: menos de 10 partidos.', 'Faint cells: fewer than 10 matches.')}</small>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------ balón parado 2 */
const ZP: Record<string, [number, number, number, number][]> = { Corto: [[0, 18, 80, 6]], 'Segundo palo': [[18, 0, 12, 18], [50, 0, 12, 18]], 'Punto penal': [[30, 6, 20, 12]], 'Primer palo': [[30, 0, 6, 6], [44, 0, 6, 6]], 'Área chica': [[36, 0, 8, 6]] }
export function Bp2Page({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const B = rd.bp2
  const mode = L('Balón parado', 'Set pieces')
  if (!B) return <Empty rd={rd} mode={mode} color={MODE_COLOR.bp} title={L('Saques de banda y marcaje', 'Throw-ins and marking')} n={n} total={total} />
  const M = B.marcaje ?? {}, LM = B.liga.marcaje ?? {}, F = B.banda.favor, C = B.banda.contra, LB = B.liga.banda
  const V: Any[] = B.vulnerable ?? []
  const lados = rd.C?.contra?.lados?.ambos
  const col = (z: Any) => { if (z.xg == null || !z.xg_liga) return 'var(--surface-2)'; const t = Math.max(-1, Math.min(1, (z.xg / z.xg_liga - 1) / 0.6)); return `color-mix(in oklab, ${t >= 0 ? 'var(--div-neg)' : 'var(--div-pos)'} ${Math.round(15 + Math.abs(t) * 60)}%, var(--paper))` }
  const tipo: Record<string, [string, string]> = { zonal: ['Marca en zona', 'Zonal marking'], mixto: ['Marca mixta', 'Mixed marking'], hombre: ['Marca al hombre', 'Man marking'] }
  const row = (k: string, v: Any, l: Any, u = '%', d = 0) => <div className="rp-bpr"><span>{k}</span><b>{v == null ? '—' : `${fmt(v, d)}${u}`}</b><small>{L('liga', 'league')} {l == null ? '—' : `${fmt(l, d)}${u}`}</small></div>
  const rect = (z: string) => (ZP[z] ?? []).map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} />)
  return (
    <Frame rd={rd} mode={mode} color={MODE_COLOR.bp} n={n} total={total} title={L('Saques de banda, marcaje y zonas débiles', 'Throw-ins, marking and weak zones')}
      sub={L('Saques de banda en el último tercio (a 40 m o menos de la línea de fondo). Marcaje medido en la foto 360 del momento de cada córner en contra. Zonas: dónde cae el envío y cuánto xG concede ahí frente a la liga.', 'Final-third throw-ins (within 40 m of the byline). Marking measured in the 360 snapshot at the moment of each corner against. Zones: where the delivery lands and how much xG he concedes there vs the league.')}>
      <div className="rp-bp">
        <div className="rp-card">
          <h4>{L('Saques de banda a favor', 'Attacking throw-ins')}</h4>
          {row(L('Por partido', 'Per match'), F.por_partido, LB.por_partido, '', 1)}
          {row(L('Al área', 'Into the box'), F.al_area_pct, LB.al_area_pct)}
          {row(L('Terminan en remate', 'End in a shot'), F.remate_pct, LB.remate_pct)}
          {row(L('xG por partido', 'xG per match'), F.xg_por_partido, LB.xg_por_partido, '', 3)}
          {row(L('Goles', 'Goals'), F.goles, null, '', 0)}
          <h4 style={{ marginTop: 12 }}>{L('En contra', 'Against')}</h4>
          {row(L('Al área', 'Into the box'), C.al_area_pct, LB.al_area_pct)}
          {row(L('Terminan en remate', 'End in a shot'), C.remate_pct, LB.remate_pct)}
          {row(L('xG por partido', 'xG per match'), C.xg_por_partido, LB.xg_por_partido, '', 3)}
          {B.banda.lanzadores?.length > 0 && <small className="rp-note">{L('Los meten al área: ', 'Into the box by: ')}{B.banda.lanzadores.map(([id, nm, c]: Any) => `${jugadorCorto(id, nm)} (${c})`).join(' · ')}</small>}
        </div>
        <div className="rp-card">
          <h4>{L('Cómo marca en los córners en contra', 'How he marks on corners against')}</h4>
          {M.pegados_pct == null ? <p className="rp-note">{L('Pocos córners con foto 360 para medirlo.', 'Too few corners with a 360 snapshot to measure it.')}</p> : <>
            <div className="rp-mk"><b>{L(tipo[M.tipo][0], tipo[M.tipo][1])}</b><span>{fmt(M.pegados_pct, 0)}% {L('de sus defensores pegados a un rival', 'of his defenders tight to an opponent')} · {L('liga', 'league')} {fmt(LM.pegados_pct, 0)}%</span></div>
            {row(L('Defensores en el área', 'Defenders in the box'), M.defensores_area, LM.defensores_area, '', 1)}
            {row(L('En el área chica', 'In the six-yard box'), M.en_area_chica, LM.en_area_chica, '', 1)}
            {row(L('Córners con remate', 'Corners with a shot'), M.remate_pct, LM.remate_pct)}
            {row(L('xG concedido por córner', 'xG conceded per corner'), M.xg_concedido, LM.xg_concedido, '', 3)}
            <small className="rp-note">{L(`${M.n} córners. Pegado: a 1.8 m o menos de su atacante (emparejamiento uno a uno). En la liga, xG por córner: zonal ${fmt(LM.xg_por_estilo?.zonal, 3)} · mixta ${fmt(LM.xg_por_estilo?.mixto, 3)} · al hombre ${fmt(LM.xg_por_estilo?.hombre, 3)}.`, `${M.n} corners. Tight: within 1.8 m of his attacker (one-to-one pairing). League xG per corner: zonal ${fmt(LM.xg_por_estilo?.zonal, 3)} · mixed ${fmt(LM.xg_por_estilo?.mixto, 3)} · man ${fmt(LM.xg_por_estilo?.hombre, 3)}.`)}</small>
          </>}
          {lados && <><h4 style={{ marginTop: 12 }}>{L('Dónde se paran sus defensores', 'Where his defenders stand')}</h4>
            <svg viewBox="-1 -1 82 32" className="rp-halfp">
              <rect x="0" y="0" width="80" height="30" fill="color-mix(in oklab, var(--mc) 6%, var(--paper))" stroke="var(--rule)" />
              <rect x="18" y="0" width="44" height="18" fill="none" stroke="var(--ink-3)" strokeOpacity=".45" strokeWidth=".4" /><rect x="30" y="0" width="20" height="6" fill="none" stroke="var(--ink-3)" strokeOpacity=".45" strokeWidth=".4" />
              {(lados.atacantes ?? []).map((p: number[], i: number) => <circle key={'a' + i} cx={p[1]} cy={120 - p[0]} r={1 + p[2] * 5} fill="var(--ink-3)" fillOpacity=".35" />)}
              {(lados.defensores ?? []).map((p: number[], i: number) => <circle key={'d' + i} cx={p[1]} cy={120 - p[0]} r={1 + p[2] * 5} fill="var(--mc)" fillOpacity=".85" />)}
              {lados.portero && <circle cx={lados.portero[1]} cy={120 - lados.portero[0]} r={1.4} fill="var(--ink)" />}
            </svg>
            <small className="rp-note">{L('Rosa: grupos de sus defensores (tamaño = cuántas veces hay alguien ahí). Gris: atacantes rivales. Negro: su portero. Córner cobrado desde la izquierda.', 'Pink: groups of his defenders (size = how often someone stands there). Grey: opposing attackers. Black: his keeper. Corner taken from the left.')}</small></>}
        </div>
        <div className="rp-card">
          <h4>{L('Dónde sufre en los córners', 'Where he suffers on corners')}</h4>
          <svg viewBox="-1 -1 82 26" className="rp-halfp">
            <rect x="0" y="0" width="80" height="24" fill="var(--paper)" stroke="var(--rule)" />
            {V.map(z => <g key={z.zona} fill={col(z)} stroke="var(--rule)" strokeWidth=".3">{rect(z.zona)}</g>)}
            <rect x="18" y="0" width="44" height="18" fill="none" stroke="var(--ink-3)" strokeOpacity=".5" strokeWidth=".4" /><rect x="30" y="0" width="20" height="6" fill="none" stroke="var(--ink-3)" strokeOpacity=".5" strokeWidth=".4" />
          </svg>
          {V.map(z => <div key={z.zona} className="rp-bpr"><span><i className="rp-sw" style={{ background: col(z) }} />{L(z.zona, ZONA_EN[z.zona] ?? z.zona)} · {fmt(z.pct, 0)}%</span><b>{z.xg == null ? '—' : fmt(z.xg, 3)}</b><small>{L('liga', 'league')} {fmt(z.xg_liga, 3)}</small></div>)}
          <small className="rp-note">{L('xG concedido por córner que cae en cada zona. Rojo: más que la liga; verde: menos.', 'xG conceded per corner landing in each zone. Red: more than the league; green: less.')}</small>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------ pruebas del método */
export function ValPage({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const V = rd.val
  const mode = L('Método', 'Method')
  if (!V?.sintetico) return <Empty rd={rd} mode={mode} color={MODE_COLOR.metodo} title={L('¿Funciona el método?', 'Does the method work?')} n={n} total={total} />
  const S = V.sintetico, R = V.confiabilidad as Record<string, Any>, O = V.fuera_muestra, M = V.mapa, TP = V.trasplante
  const rel = Object.entries(R).sort((a, b) => b[1].confiabilidad - a[1].confiabilidad)
  const relMean = rel.reduce((a, [, r]) => a + r.confiabilidad, 0) / rel.length
  const bar = (v: number, c: string, mx = 1) => <div className="rp-bar"><i style={{ width: `${Math.max(0, Math.min(100, (v / mx) * 100))}%`, background: c }} /></div>
  const EST: [string, string, string, string][] = [['modelo', 'Nuestro modelo', 'Our model', 'var(--c-dt)'], ['sin_jug', 'DT + club, sin jugadores', 'Coach + club, no players', 'var(--c-club)'], ['ingenuo', 'Promedio de sus partidos', 'Average of his matches', 'var(--ink-3)']]
  return (
    <Frame rd={rd} mode={mode} color={MODE_COLOR.metodo} n={n} total={total} title={L('¿Funciona el método?', 'Does the method work?')}
      sub={L('Plantamos efectos conocidos sobre el diseño real de la liga (mismos DTs, clubes, rivales y jugadores en cancha) y volvemos a ajustar; repetimos el ajuste con mitades de los partidos y fuera de muestra. Nada de esto cambia el modelo publicado.', 'We plant known effects on the league\'s real design (same coaches, clubs, opponents and players on the pitch) and refit; we repeat the fit on halves of the matches and out of sample. None of this changes the published model.')}>
      <div className="rp-val">
        <div className="rp-card">
          <h4>{L('1 · ¿Recupera al DT verdadero?', '1 · Does it recover the true coach?')}</h4>
          {(['realista', 'a_medida'] as const).map(g => <div key={g} className="rp-vg"><span className="rp-vt">{g === 'realista' ? L('Liga realista', 'Realistic league') : L('Plantilla a su medida', 'Squad in his image')}</span>
            {EST.map(([k, es, en, c]) => <div key={k} className="rp-vr"><span>{L(es, en)}</span>{bar(S[g][k].media, c)}<b>{fmt(S[g][k].media, 2)}</b></div>)}</div>)}
          <div className="rp-vg"><span className="rp-vt">{L('Sin DT: estilo que se inventa (ideal 0)', 'No coach: style it invents (ideal 0)')}</span>
            {[['sd_falso', 'Nuestro modelo', 'Our model', 'var(--c-dt)'], ['sd_sin_jug', 'DT + club', 'Coach + club', 'var(--c-club)'], ['sd_ingenuo', 'Promedio', 'Average', 'var(--ink-3)']].map(([k, es, en, c]) => <div key={k} className="rp-vr"><span>{L(es, en)}</span>{bar(S.sin_dt[k].media, c, 1.2)}<b>{fmt(S.sin_dt[k].media, 2)}σ</b></div>)}</div>
          <small className="rp-note">{L(`Correlación con el efecto plantado en ${S.reps} réplicas. Acierta el signo en el ${fmt(S.signo_significativos.media * 100, 0)}% de los rasgos que marca como claros; encoge el tamaño (pendiente ${fmt(S.realista.pend.media, 2)}): «más que la liga» es fiable, la cifra es un mínimo.`, `Correlation with the planted effect over ${S.reps} replicates. Right sign on ${fmt(S.signo_significativos.media * 100, 0)}% of traits it calls clear; it shrinks the size (slope ${fmt(S.realista.pend.media, 2)}): «more than the league» is reliable, the figure is a floor.`)}</small>
        </div>
        <div className="rp-card">
          <h4>{L('2 · ¿Sale lo mismo con la otra mitad?', '2 · Same answer with the other half?')}</h4>
          <div className="rp-rel">{rel.map(([k, r]) => <div key={k} className={r.confiabilidad < 0.5 ? 'weak' : ''}><span>{kName(k, rd.glob)}</span>{bar(Math.max(0, r.confiabilidad), r.confiabilidad < 0.5 ? 'var(--c-rival)' : 'var(--c-dt)')}<b>{fmt(r.confiabilidad, 2)}</b></div>)}</div>
          <small className="rp-note">{L(`Confiabilidad mitad/mitad (Spearman–Brown), media ${fmt(relMean, 2)}. En rojo, rasgos poco fiables (< 0.5): dependen de pocos tiros o goles.`, `Split-half reliability (Spearman–Brown), mean ${fmt(relMean, 2)}. Red: unreliable traits (< 0.5): they depend on few shots or goals.`)}</small>
        </div>
        <div className="rp-val-r">
          <div className="rp-card">
            <h4>{L('3 · Fuera de muestra', '3 · Out of sample')}</h4>
            <div className="rp-vr"><span>{L('Modelo completo', 'Full model')}</span>{bar(O.media.completo, 'var(--c-dt)', 0.4)}<b>{fmt(O.media.completo * 100, 0)}%</b></div>
            <div className="rp-vr"><span>{L('Sin el DT', 'Without coach')}</span>{bar(O.media.sin_dt, 'var(--ink-3)', 0.4)}<b>{fmt(O.media.sin_dt * 100, 1)}%</b></div>
            <div className="rp-vr"><span>{L('Sin jugadores', 'Without players')}</span>{bar(O.media.sin_jugadores, 'var(--ink-3)', 0.4)}<b>{fmt(O.media.sin_jugadores * 100, 1)}%</b></div>
            <small className="rp-note">{L('R² del estilo de cada partido. El DT aporta poco a un partido suelto (casi siempre llega con el mismo club y plantilla); su peso se ve cuando cambia de equipo.', 'R² of each match\'s style. The coach adds little to a single match (he almost always comes with the same club and squad); his weight shows when he changes teams.')}</small>
          </div>
          {TP?.crudo && <div className="rp-card"><h4>{L('4 · Cambio de DT: ¿el equipo se va a su estilo?', '4 · Coach change: does the team move to his style?')}</h4>
            <div className="rp-mk"><b>{fmt(TP.crudo.especifico, 2)}</b><span>{L(`efecto propio del DT nuevo en ${TP.n_eventos} cambios, IC95 [${fmt(TP.crudo.especifico_ic95[0], 2)}, ${fmt(TP.crudo.especifico_ic95[1], 2)}], p = ${fmt(TP.crudo.p_permutacion, 3)}`, `effect specific to the new coach in ${TP.n_eventos} changes, 95% CI [${fmt(TP.crudo.especifico_ic95[0], 2)}, ${fmt(TP.crudo.especifico_ic95[1], 2)}], p = ${fmt(TP.crudo.p_permutacion, 3)}`)}</span></div></div>}
          <div className="rp-card"><h4>{L('5 · Mapa de estilos', '5 · Style map')}</h4>
            <p className="rp-note" style={{ marginTop: 0 }}>{L(`Silueta con K = ${M.k}: ${fmt(M.silueta[M.k], 2)}, igual a la del azar (${fmt(M.silueta_nula.media, 2)}). Los estilos forman un continuo: el mapa sirve para ver quién está cerca de quién; los colores son una guía, no tribus.`, `Silhouette with K = ${M.k}: ${fmt(M.silueta[M.k], 2)}, the same as chance (${fmt(M.silueta_nula.media, 2)}). Styles form a continuum: the map shows who is close to whom; the colours are a guide, not tribes.`)}</p></div>
        </div>
      </div>
    </Frame>
  )
}
