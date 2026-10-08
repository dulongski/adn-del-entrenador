import { useEffect, useMemo, useState } from 'react'
import { clubColor, dataUrl, fmt, getJSON, jugadorCorto, sig, type Any } from '../lib'
import { ClubLogo, DotCI, HeatGrid, Pitch, pitchXY, useTip } from '../charts'
import { apellidoCorto, PlayAnim } from '../PlayAnim'
import { parseShots, ShotExplorer } from '../ShotExplorer'
import '../styles/juego.css'
import { FAM_ORDER, Seg, type P } from './common'

export function Fases({ art, glob, media }: P) {
  const cur = media?.dts?.[art.id]?.club ?? art.etapas?.at(-1)?.club
  const tc = clubColor(cur, media)
  const [map, setMap] = useState('presion')
  const [mode, setMode] = useState<'div' | 'seq'>('div')
  const [J, setJ] = useState<Any>(null)
  const [club, setClub] = useState<string | null>(null)
  useEffect(() => {
    setJ(null); setClub(null)
    getJSON(dataUrl(`juego_${art.id}.json`)).then(setJ).catch(() => setJ(false))
  }, [art.id])
  const clubes: Any[] = J?.clubes || []
  const club_ = club && clubes.some(c => c.club === club) ? club : (clubes.find(c => c.club === cur)?.club ?? clubes.at(-1)?.club ?? cur)
  const cc = clubColor(club_, media)
  const allShots = useMemo(() => parseShots(J), [J])
  const shots = useMemo(() => allShots.filter(s => s.club === club_), [allShots, club_])
  const net = J?.redes?.[club_]
  const hu = art.huella.filter((h: Any) => !h.kpi.startsWith('arq_'))
  const M = art.mapas
  const mapLabels: Record<string, string> = { presion: 'Presiones', recuperaciones: 'Recuperaciones', progresion: 'Destino de las acciones que hacen avanzar' }
  const total = clubes.reduce((a, c) => a + c.partidos, 0)
  return (
    <div>
      <h3 className="h2">Jugadas tipo</h3>
      <p className="lede">Cada posesión de sus equipos cae en uno de 8 tipos de jugada según dónde empieza, cuánto avanza, cuánto dura y cuánto peligro genera. Elige un tipo para ver, paso a paso, jugadas reales de sus equipos.</p>
      <Archetypes art={art} J={J || null} media={media} />

      <h3 className="h2">Dónde ocurre</h3>
      <div className="jg-grid">
        <div className="card jg-heat">
          <div className="h3">Mapa de calor</div>
          <div className="jg-heat-in">
            <div className="jg-ctrl">
              <span className="jg-ctrl-label">Qué mostrar</span>
              <Seg opts={[['presion', 'Presión'], ['recuperaciones', 'Recuperaciones'], ['progresion', 'Progresión']]} v={map} set={setMap} />
              <span className="jg-ctrl-label">Cómo</span>
              <Seg opts={[['div', 'Diferencia vs liga'], ['seq', 'Volumen del DT']]} v={mode} set={s => setMode(s as Any)} />
              <div className="note">{mapLabels[map]} por partido{mode === 'div' ? ', comparado con el promedio de la liga' : ''}. Todos sus partidos{total ? ` (${total})` : ''}, en todos sus clubes.</div>
            </div>
            <div className="jg-grow">
              <HeatGrid grid={mode === 'div' ? M[map].dif : M[map].dt} mode={mode} label={mapLabels[map]} unit={mode === 'div' ? 'vs liga, por partido' : 'por partido'} color={tc} vertical />
            </div>
          </div>
          <div className="note jg-card-foot">Su equipo ataca hacia arriba. Es lo que pasó en sus partidos: incluye lo que ponen sus jugadores.</div>
        </div>
        <div className="jg-clubs" role="group" aria-label="Club para la red de pases y los tiros">
          <span className="jg-clubs-label">Red y tiros con</span>
          {clubes.length ? clubes.map(c => (
            <button key={c.club} className="jg-chip" aria-pressed={c.club === club_} onClick={() => setClub(c.club)} style={{ ['--hue' as Any]: clubColor(c.club, media) }}>
              <ClubLogo club={c.club} media={media} size={22} />{c.club}<span className="note">{c.partidos} PJ</span>
              {c.club === cur && <span className="badge-live">actual</span>}
            </button>
          )) : <span className="note">{J === false ? 'Sin datos por club.' : 'Cargando…'}</span>}
        </div>
        <div className="card jg-net">
          <div className="h3">Red de pases · {club_}</div>
          <div className="jg-grow">{net ? <PassNet net={net} J={J} color={cc} /> : <div className="note">{J === false ? 'Sin datos.' : 'Cargando…'}</div>}</div>
          {net && <div className="note jg-card-foot">Los 11 con más minutos en {club_} ({net.partidos} partidos). Ataca hacia arriba. Cada punto es la posición media de sus pases (más grande = más pases); las líneas unen parejas con al menos un pase por partido.</div>}
        </div>
        <div className="card jg-shots">
          <div className="h3">Tiros · {club_}</div>
          {J ? <ShotExplorer shots={shots} color={cc} media={media} /> : <div className="note">{J === false ? 'Sin datos.' : 'Cargando…'}</div>}
        </div>
      </div>

      <h3 className="h2">Huella de estilo</h3>
      <p className="lede">Efecto propio del DT en cada indicador, ya descontados plantilla, club, rival y contexto. El punto relleno indica que el efecto supera dos veces su error (bootstrap por partido); la barra es el intervalo del 95%.</p>
      <div className="grid2">
        {FAM_ORDER.map(f => {
          const rs = hu.filter((h: Any) => h.familia === f)
          return rs.length ? (
            <div key={f} className="card">
              <div className="h3">{f}</div>
              {rs.map((h: Any) => (
                <div key={h.kpi} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) 1.3fr 90px', gap: 10, alignItems: 'center', padding: '3px 0' }}>
                  <span style={{ fontSize: 13, lineHeight: 1.2 }} title={glob.kpis[h.kpi].descripcion}>{h.etiqueta}</span>
                  <DotCI v={h.alpha} se={h.se} pctl={h.pct} />
                  <span className="mono" style={{ fontSize: 12, textAlign: 'right' }}>{fmt(h.crudo)} <span style={{ color: 'var(--ink-3)' }}>/ {fmt(h.liga)}</span></span>
                </div>
              ))}
              <div className="note" style={{ marginTop: 4 }}>Eje: −2.5σ … +2.5σ · derecha: DT / liga (crudo)</div>
            </div>
          ) : null
        })}
      </div>
    </div>
  )
}

function PassNet({ net, J, color }: { net: Any; J: Any; color: string }) {
  const tip = useTip()
  const nodos = net.nodos.map((n: Any) => ({ ...n, nombre: J.jugadores[n.j]?.[1] ?? String(n.id) }))
  const aristas = net.aristas
  const byId = Object.fromEntries(nodos.map((n: Any) => [n.id, n]))
  const maxE = Math.max(...aristas.map((e: Any) => e.n), 1)
  const maxP = Math.max(...nodos.map((n: Any) => n.pases), 1)
  // etiquetas: ancho real del texto (canvas) y la primera posición libre alrededor del nodo
  // (abajo, arriba, derecha, izquierda, diagonales); si ninguna está libre, abajo con línea guía
  const FS = 2.7
  const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
  if (ctx) ctx.font = '600 100px "Source Sans 3", system-ui, sans-serif'
  const textW = (t: string) => (ctx ? ctx.measureText(t).width / 100 * FS : t.length * FS * 0.55)
  type Box = { x0: number; y0: number; x1: number; y1: number }
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
  const nodeBoxes: Box[] = nodos.map((n: Any) => { const [x, y] = pitchXY(n.x, n.y, true); const r = 1.8 + 2.2 * n.pases / maxP; return { x0: x - r, y0: y - r, x1: x + r, y1: y + r } })
  const placed: Box[] = []
  const labels: { id: number; x: number; y: number; t: string; lx?: number; ly?: number; anchor: 'middle' | 'start' | 'end' }[] = []
  ;[...nodos].sort((a: Any, b: Any) => b.pases - a.pases).forEach((n: Any) => {
    const [cx, cy] = pitchXY(n.x, n.y, true)
    const r = 1.8 + 2.2 * n.pases / maxP
    const t = apellidoCorto(jugadorCorto(n.id, n.nombre))
    const w = textW(t), h = FS * 1.05
    const cands: [number, number, 'middle' | 'start' | 'end'][] = [
      [cx, cy + r + h * 0.95, 'middle'], [cx, cy - r - 0.6, 'middle'], [cx + r + 0.8, cy + h * 0.35, 'start'], [cx - r - 0.8, cy + h * 0.35, 'end'],
      [cx + r * 0.7, cy + r + h * 0.95, 'start'], [cx - r * 0.7, cy + r + h * 0.95, 'end'], [cx + r * 0.7, cy - r - 0.6, 'start'], [cx - r * 0.7, cy - r - 0.6, 'end'],
    ]
    const boxOf = ([x, y, an]: [number, number, 'middle' | 'start' | 'end']): Box => {
      const x0 = an === 'middle' ? x - w / 2 : an === 'start' ? x : x - w
      return { x0: x0 - 0.3, y0: y - h * 0.8, x1: x0 + w + 0.3, y1: y + h * 0.25 }
    }
    const inside = (b: Box) => b.x0 >= -1 && b.x1 <= 81 && b.y0 >= -1 && b.y1 <= 121
    let pick = cands.find(c => { const b = boxOf(c); return inside(b) && !placed.some(o => hit(o, b)) && !nodeBoxes.some(o => hit(o, b)) })
    let lead = false
    if (!pick) { // bajar hasta encontrar hueco, con línea guía al nodo
      let yy = cy + r + h
      while (yy < 118 && placed.some(o => hit(o, boxOf([cx, yy, 'middle'])))) yy += h * 1.05
      pick = [cx, yy, 'middle']; lead = true
    }
    placed.push(boxOf(pick))
    labels.push({ id: n.id, x: pick[0], y: pick[1], t, anchor: pick[2], ...(lead ? { lx: cx, ly: cy + r } : {}) })
  })
  return (
    <>
      <Pitch vertical labels={labels.map(l => <g key={l.id} pointerEvents="none">
        {l.lx != null && <line x1={l.lx} y1={l.ly} x2={l.x} y2={l.y - FS * 0.8} stroke="var(--ink-3)" strokeWidth={0.2} />}
        <text x={l.x} y={l.y} fontSize={FS} fontWeight={600} textAnchor={l.anchor} fill="var(--ink)" style={{ paintOrder: 'stroke', stroke: 'var(--pitch)', strokeWidth: 0.7 }}>{l.t}</text>
      </g>)}>
        {aristas.map((e: Any, i: number) => byId[e.a] && byId[e.b] ? (
          <line key={i} x1={byId[e.a].x} y1={byId[e.a].y} x2={byId[e.b].x} y2={byId[e.b].y} stroke={color} strokeOpacity={0.3 + 0.6 * e.n / maxE} strokeWidth={0.3 + 1.6 * e.n / maxE} strokeLinecap="round" />
        ) : null)}
        {nodos.map((n: Any) => (
          <circle key={n.id} cx={n.x} cy={n.y} r={1.8 + 2.2 * n.pases / maxP} fill={color} stroke="var(--surface)" strokeWidth={0.6}
            onMouseMove={e => tip.show(e, <><b>{n.nombre}</b><br />{fmt(n.pases)} pases completados por 90 min · {fmt(n.minutos, 0)} min jugados</>)} onMouseLeave={tip.hide} />
        ))}
      </Pitch>
      {tip.el}
    </>
  )
}

function Archetypes({ art, J, media }: { art: Any; J: Any; media: Any }) {
  const arqs = [...art.arquetipos].sort((a: Any, b: Any) => (b.dt_pct ?? 0) - (a.dt_pct ?? 0))
  const [sel, setSel] = useState<number>(arqs[0]?.id)
  const [k, setK] = useState(0)
  const ex: Any[] = art.arquetipos_ejemplos[sel] || []
  const cur = arqs.find((a: Any) => a.id === sel)
  const max = Math.max(...arqs.map((a: Any) => Math.max(a.dt_pct ?? 0, a.liga_pct ?? 0)), 1)
  const pick = (id: number) => { setSel(id); setK(0) }
  const seq: Any[] = ex[k] || []
  const meta = J?.ejemplos?.[sel]?.[k] ?? null
  const partido = meta && J ? J.partidos[meta.m] : null
  const club = partido ? J.clubes[partido[5]]?.club : undefined
  const color = clubColor(club ?? media?.dts?.[art.id]?.club ?? art.etapas?.at(-1)?.club, media)
  return (
    <div className="arq">
      <div className="card arq-list">
        {arqs.map((a: Any) => (
          <button key={a.id} className="arq-row" aria-pressed={a.id === sel} onClick={() => pick(a.id)}>
            <span className="arq-name">{a.nombre}</span>
            <span className="arq-bar"><span style={{ width: `${(a.dt_pct ?? 0) / max * 100}%` }} /><i style={{ left: `${(a.liga_pct ?? 0) / max * 100}%` }} /></span>
            <span className="mono arq-val">{fmt(a.dt_pct)}%</span>
          </button>
        ))}
        <div className="note" style={{ marginTop: 6 }}>Barra azul: % de sus posesiones · línea negra: promedio de la liga</div>
      </div>
      <div className="card arq-ex">
        <div className="arq-head">
          <div>
            <div className="h3" style={{ margin: 0 }}>{cur?.nombre}</div>
            <div className="note">{fmt(cur?.dt_pct)}% de sus posesiones (liga {fmt(cur?.liga_pct)}%) · efecto DT {sig(cur?.alpha)}</div>
          </div>
          {ex.length > 0 && (
            <div className="carousel">
              <button onClick={() => setK((k - 1 + ex.length) % ex.length)} aria-label="Ejemplo anterior">‹</button>
              <span className="mono">{k + 1} / {ex.length}</span>
              <button onClick={() => setK((k + 1) % ex.length)} aria-label="Ejemplo siguiente">›</button>
            </div>
          )}
        </div>
        {ex.length ? (
          <>
            <PlayAnim key={`${sel}-${k}`} seq={seq} meta={meta} jugadores={J?.jugadores} partido={partido} club={club} color={color} media={media} />
            <div className="note">Una de sus jugadas más valiosas de este tipo. Sólo aparecen los jugadores que tocan el balón. Línea continua: pase; discontinua: conducción. Ataque hacia la derecha.</div>
          </>
        ) : <div className="note">Sin ejemplos para este tipo de jugada.</div>}
      </div>
    </div>
  )
}

/* ================================================================ CONTEXTO */
