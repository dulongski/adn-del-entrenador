import { useState } from 'react'
import { clubColor, fmt, jugadorCorto, sig, type Any } from '../lib'
import { DotCI, HeatGrid, Pitch, pitchXY, useTip } from '../charts'
import { FAM_ORDER, Seg, type P } from './common'

export function Fases({ art, glob, media }: P) {
  const tc = clubColor(media?.dts?.[art.id]?.club ?? art.etapas?.at(-1)?.club, media)
  const [map, setMap] = useState('presion')
  const [mode, setMode] = useState<'div' | 'seq'>('div')
  const hu = art.huella.filter((h: Any) => !h.kpi.startsWith('arq_'))
  const M = art.mapas
  const mapLabels: Record<string, string> = { presion: 'Presiones', recuperaciones: 'Recuperaciones', progresion: 'Destino de acciones progresivas' }
  return (
    <div>
      <h3 className="h2">Jugadas tipo</h3>
      <p className="lede">Cada posesión en juego se clasifica en uno de 8 arquetipos (mezcla gaussiana sobre inicio, avance, duración, pases, verticalidad y peligro). Barra: % de sus posesiones; línea negra: promedio de la liga. Elige una jugada para ver ejemplos reales.</p>
      <Archetypes art={art} />

      <h3 className="h2">Dónde ocurre</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Seg opts={[['presion', 'Presión'], ['recuperaciones', 'Recuperaciones'], ['progresion', 'Progresión']]} v={map} set={setMap} />
        <Seg opts={[['div', 'Diferencia vs liga'], ['seq', 'Volumen del DT']]} v={mode} set={s => setMode(s as Any)} />
      </div>
      <div className="grid3">
        <div className="card">
          <div className="h3">{mapLabels[map]} por partido</div>
          <HeatGrid grid={mode === 'div' ? M[map].dif : M[map].dt} mode={mode} label={mapLabels[map]} unit={mode === 'div' ? 'vs liga, por partido' : 'por partido'} color={tc} vertical />
          <div className="note">Su equipo ataca siempre hacia arriba. Crudo: incluye el efecto de la plantilla.</div>
        </div>
        <div className="card">
          <div className="h3">Red de pases (11 con más minutos)</div>
          <PassNet net={M.red_pases} art={art} color={tc} />
        </div>
        <div className="card"><div className="h3">Tiros ({M.tiros.length})</div><ShotMap shots={M.tiros} color={tc} /></div>
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

/** Etiqueta mínima para la red de pases: apodo de una palabra o apellido (con partículas: «de la Rosa»). */
function apellidoCorto(n: string) {
  const t = n.trim().split(/\s+/)
  if (t.length <= 1) return n
  let i = t.length - 1
  while (i > 1 && /^(de|del|la|las|los|da|do|dos|van|von|di)$/i.test(t[i - 1])) i--
  return t.slice(i).join(' ')
}

function PassNet({ net, art, color }: { net: Any; art: Any; color: string }) {
  const tip = useTip()
  // un solo portero: el de más minutos (la red usa los 11 con más minutos y a veces entran dos)
  const linea = Object.fromEntries((art.jugadores?.jugadores || []).map((j: Any) => [j.player_id, j.linea]))
  const gks = net.nodos.filter((n: Any) => linea[n.id] === 0).sort((a: Any, b: Any) => b.minutos - a.minutos)
  const drop = new Set(gks.slice(1).map((n: Any) => n.id))
  const nodos = net.nodos.filter((n: Any) => !drop.has(n.id))
  const aristas = net.aristas.filter((e: Any) => !drop.has(e.a) && !drop.has(e.b))
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
            onMouseMove={e => tip.show(e, <><b>{n.nombre}</b><br />{fmt(n.pases)} pases completados / 90 · {fmt(n.minutos, 0)} min</>)} onMouseLeave={tip.hide} />
        ))}
      </Pitch>
      <div className="note">Ataca hacia arriba. Nodo: posición media de sus pases (tamaño = pases por 90); grosor: pases entre la pareja por partido (≥1).</div>
      {tip.el}
    </>
  )
}

function ShotMap({ shots, color }: { shots: number[][]; color: string }) {
  const tip = useTip()
  return (
    <>
      <Pitch half vertical>
        {shots.map(([x, y, xg, g], i) => (
          <circle key={i} cx={x} cy={y} r={0.35 + 1.9 * Math.sqrt(xg)} fill={g ? color : 'none'} stroke={color} strokeWidth={0.22} opacity={g ? 0.95 : 0.55}
            onMouseMove={e => tip.show(e, <>xG {fmt(xg, 2)}{g ? ' · gol' : ''}</>)} onMouseLeave={tip.hide} />
        ))}
      </Pitch>
      <div className="note">Tamaño ∝ xG · relleno = gol.</div>
      {tip.el}
    </>
  )
}

function Archetypes({ art }: { art: Any }) {
  const arqs = [...art.arquetipos].sort((a: Any, b: Any) => (b.dt_pct ?? 0) - (a.dt_pct ?? 0))
  const [sel, setSel] = useState<number>(arqs[0]?.id)
  const [k, setK] = useState(0)
  const ex: Any[] = art.arquetipos_ejemplos[sel] || []
  const cur = arqs.find((a: Any) => a.id === sel)
  const max = Math.max(...arqs.map((a: Any) => Math.max(a.dt_pct ?? 0, a.liga_pct ?? 0)), 1)
  const pick = (id: number) => { setSel(id); setK(0) }
  const seq: Any[] = ex[k] || []
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
        <div className="note" style={{ marginTop: 6 }}>Barra azul: sus partidos · línea negra: liga</div>
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
        <Pitch>
          <defs><marker id="ar" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6z" fill="var(--c-dt)" /></marker></defs>
          {seq.map(([t, x, y, ex_, ey]: Any, i: number) => ex_ == null ? (t === 'Shot' ? <circle key={i} cx={x} cy={y} r={1.6} fill="var(--c-plantilla)" /> : null) : (
            <g key={i}>
              <line x1={x} y1={y} x2={ex_} y2={ey} stroke="var(--c-dt)" strokeWidth={t === 'Carry' ? 0.55 : 0.9}
                strokeDasharray={t === 'Carry' ? '1.4 1' : undefined} markerEnd={t === 'Shot' ? undefined : 'url(#ar)'} />
              {i === 0 && <circle cx={x} cy={y} r={1.3} fill="var(--c-dt)" />}
              {t === 'Shot' && <circle cx={x} cy={y} r={1.6} fill="var(--c-plantilla)" />}
            </g>
          ))}
        </Pitch>
        <div className="note">{ex.length ? <>Posesión real de mayor OBV del arquetipo. Punto azul = inicio; línea continua = pase; discontinua = conducción; punto naranja = tiro. Ataque hacia la derecha.</> : 'Sin ejemplos para este arquetipo.'}</div>
      </div>
    </div>
  )
}

/* ================================================================ CONTEXTO */
