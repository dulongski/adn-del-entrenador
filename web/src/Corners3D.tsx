import { useEffect, useMemo, useRef, useState } from 'react'
import { clubColor, dataUrl, fmt, getJSON, pct, type Any } from './lib'

/* Córners en 3D (datos: pipeline/corners.py, todos los córners normalizados como si se cobraran
   desde la misma esquina, atacando hacia x=120):
   - Barras sobre el último tercio: ALTURA = volumen de envíos que caen en esa zona,
     COLOR = xG medio que generan los córners enviados ahí.
   - Jugadores: posiciones típicas (k-means sobre los fotogramas 360) de atacantes y defensores.
   - Simulador: re-juega uno de sus córners reales (muestreo con reemplazo): el balón vuela en
     arco a la zona de envío; si su equipo toca primero y hubo remate, es gol con probabilidad xG. */

type V3 = [number, number, number]
type Side = 'favor' | 'contra'
const X0 = 94, X1 = 120, CELL = 2
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Escala secuencial de xG (amarillo pálido → rojo oscuro), legible en ambos temas. */
function xgColor(t: number, shade = 1) {
  const s = [[255, 237, 160], [254, 178, 76], [240, 59, 32], [150, 0, 38]]
  const u = clamp(t, 0, 1) * (s.length - 1), i = Math.min(s.length - 2, Math.floor(u)), f = u - i
  const c = s[i].map((v, k) => v + (s[i + 1][k] - v) * f).map(v => Math.round(v * shade))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

type Sim = { e: number[]; t0: number; goal: boolean; txt: string }

export default function Corners3D({ art, media }: { art: Any; media: Any }) {
  const [data, setData] = useState<Any>(null)
  const [liga, setLiga] = useState<Any>(null)
  const [side, setSide] = useState<Side>('favor')
  const [showPlayers, setShowPlayers] = useState(true)
  const [rot, setRot] = useState({ yaw: 1.25, pitch: 0.82 })
  const [sim, setSim] = useState<Sim | null>(null)
  const [batch, setBatch] = useState<Any>(null)
  const [err, setErr] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [, force] = useState(0)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const club = media?.dts?.[art.id]?.club ?? art.etapas?.at(-1)?.club
  const tc = clubColor(club, media)

  useEffect(() => {
    setData(null); setErr(null)
    getJSON(dataUrl(`corners_${art.id}.json`)).then(setData).catch(() => setErr('Aún no hay datos de córners 3D para este DT.'))
    getJSON(dataUrl('corners_liga.json')).then(setLiga).catch(() => {})
  }, [art.id])
  const D = data?.[side]

  // rejilla de zonas: conteo de envíos suavizado (kernel gaussiano, σ≈1 celda) y xG medio con
  // encogimiento hacia su media global (k=4 envíos), para que una celda con 1 envío no se pinte roja por azar
  const grid = useMemo(() => {
    if (!D) return null
    const nx = Math.ceil((X1 - X0) / CELL), ny = Math.ceil(80 / CELL)
    const z = () => Array.from({ length: nx }, () => new Array(ny).fill(0))
    const cnt0 = z(), xg0 = z(), cnt = z(), xgs = z()
    let tot = 0, totX = 0
    for (const [ex, ey, , g, , sh] of D.entregas as number[][]) {
      if (sh || ex < X0) continue
      const i = clamp(Math.floor((ex - X0) / CELL), 0, nx - 1), j = clamp(Math.floor(ey / CELL), 0, ny - 1)
      cnt0[i][j]++; xg0[i][j] += g; tot++; totX += g
    }
    const K = [[1, 0.6, 0.14], [0.6, 0.36, 0.08], [0.14, 0.08, 0.02]]
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      if (!cnt0[i][j]) continue
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
        const ii = i + a, jj = j + b
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue
        const w = K[Math.abs(a)][Math.abs(b)]
        cnt[ii][jj] += w * cnt0[i][j]; xgs[ii][jj] += w * xg0[i][j]
      }
    }
    const prior = tot ? totX / tot : 0.03, k = 4
    let maxC = 0
    cnt.forEach(r => r.forEach(c => { maxC = Math.max(maxC, c) }))
    const xg = z()
    let maxX = 0.001
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      xg[i][j] = (xgs[i][j] + k * prior) / (cnt[i][j] + k)
      if (cnt[i][j] < 0.04 * maxC) cnt[i][j] = 0
      else maxX = Math.max(maxX, xg[i][j])
    }
    return { nx, ny, cnt, xg, maxC, maxX: Math.min(Math.max(maxX, 0.06), 0.2), tot }
  }, [D])

  // estadísticas de 1,000 córners re-jugados (muestreo con reemplazo de sus córners reales)
  const runBatch = () => {
    if (!D) return
    const E: number[][] = D.entregas
    let goles = 0, remates = 0, xg = 0, primero = 0, cortos = 0
    for (let k = 0; k < 1000; k++) {
      const e = E[Math.floor(Math.random() * E.length)]
      xg += e[3]; if (e[3] > 0) remates++; if (e[2] === 1) primero++; if (e[5] === 1) cortos++
      if (Math.random() < e[3]) goles++
    }
    setBatch({ goles, remates, xg, primero, cortos })
  }
  const runOne = () => {
    if (!D) return
    const E: number[][] = D.entregas
    const e = E[Math.floor(Math.random() * E.length)]
    const goal = e[3] > 0 && Math.random() < e[3]
    const txt = e[5] ? 'Córner en corto' : e[3] > 0 ? (goal ? '¡GOL!' : `Remate sin gol · xG ${fmt(e[3], 2)}`) : e[2] === 1 ? 'Primer contacto propio, sin remate' : 'Despeja el rival'
    setSim({ e, t0: performance.now(), goal, txt })
  }

  // animación sólo mientras hay un córner en vuelo
  useEffect(() => {
    if (!sim) return
    let raf = 0
    const tick = () => { force(v => v + 1); if (performance.now() - sim.t0 < 3200) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [sim])

  // ------------------------------------------------------------ dibujo
  useEffect(() => {
    const c = canvas.current
    if (!c || !grid || !D) return
    const W = c.clientWidth, H = c.clientHeight, dpr = window.devicePixelRatio || 1
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const css = (n: string, d: string) => { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d } catch { return d } }
    g.fillStyle = css('--surface', '#18211c'); g.fillRect(0, 0, W, H)
    // cámara: centro de la escena en el área; yaw alrededor del eje vertical, pitch = inclinación
    const C: V3 = [107, 40, 0]
    const cy = Math.cos(rot.yaw), sy = Math.sin(rot.yaw), cp = Math.cos(rot.pitch), sp = Math.sin(rot.pitch)
    const R = ([x, y, z]: V3) => {
      const dx = x - C[0], dy = y - C[1], dz = z - C[2]
      const rx = dx * cy - dy * sy, ry = dx * sy + dy * cy       // giro horizontal
      const vy = ry * cp - dz * sp, depth = ry * sp + dz * cp    // inclinación
      const f = 90 / (90 + vy)
      return { x: rx * f, y: -depth * f, d: vy }
    }
    // encuadre automático: la escena (último cuarto de cancha + portería) siempre cabe en el lienzo
    const box: V3[] = [[X0 + 4, 0, 0], [121, 0, 0], [121, 70, 0], [X0 + 4, 70, 0], [120, 36, 2.7], [120, 44, 2.7], [112, 40, 13]]
    const bb = box.map(R), mx = Math.min(...bb.map(p => p.x)), Mx = Math.max(...bb.map(p => p.x)), my = Math.min(...bb.map(p => p.y)), My = Math.max(...bb.map(p => p.y))
    const S = Math.min((W - 24) / (Mx - mx), (H - 36) / (My - my)), ox = W / 2 - S * (mx + Mx) / 2, oy = H / 2 - S * (my + My) / 2 + 6
    const P = (v: V3) => { const r = R(v); return { x: ox + r.x * S, y: oy + r.y * S, d: r.d } }
    const line = (a: V3, b: V3, col: string, w = 1) => { const A = P(a), B = P(b); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke() }
    const poly = (pts: V3[], fill: string, stroke?: string) => { const q = pts.map(P); g.beginPath(); q.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 0.6; g.stroke() } }
    // piso y líneas
    const pitch = css('--pitch', '#1d2922'), pl = css('--pitch-line', '#3b4b42')
    poly([[X0, 0, 0], [120, 0, 0], [120, 80, 0], [X0, 80, 0]], pitch)
    ;[[[102, 18], [120, 18]], [[102, 18], [102, 62]], [[102, 62], [120, 62]], [[114, 30], [120, 30]], [[114, 30], [114, 50]], [[114, 50], [120, 50]], [[120, 0], [120, 80]], [[X0, 0], [120, 0]], [[X0, 80], [120, 80]]]
      .forEach(([a, b]) => line([a[0], a[1], 0], [b[0], b[1], 0], pl, 1.2))
    // barras (ordenadas de atrás hacia adelante)
    const hmax = 13
    const bars: { i: number; j: number; d: number }[] = []
    for (let i = 0; i < grid.nx; i++) for (let j = 0; j < grid.ny; j++) if (grid.cnt[i][j]) bars.push({ i, j, d: P([X0 + (i + 0.5) * CELL, (j + 0.5) * CELL, 0]).d })
    bars.sort((a, b) => b.d - a.d)
    for (const { i, j } of bars) {
      const c = grid.cnt[i][j], h = (c / grid.maxC) * hmax, t = grid.xg[i][j] / grid.maxX
      const x0 = X0 + i * CELL + 0.12, x1 = x0 + CELL - 0.24, y0 = j * CELL + 0.12, y1 = y0 + CELL - 0.24
      const top: V3[] = [[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]]
      const sides: V3[][] = [
        [[x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]], [[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]],
        [[x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h]], [[x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h]],
      ]
      sides.map(f => ({ f, d: f.reduce((s, v) => s + P(v).d, 0) / 4 })).sort((a, b) => b.d - a.d).forEach(({ f }, k) => poly(f, xgColor(t, k < 2 ? 0.62 : 0.8)))
      poly(top, xgColor(t, 1), 'rgba(0,0,0,.25)')
    }
    // portería
    const gl = '#f2f2f2'
    line([120, 36, 0], [120, 36, 2.67], gl, 2.2); line([120, 44, 0], [120, 44, 2.67], gl, 2.2); line([120, 36, 2.67], [120, 44, 2.67], gl, 2.2)
    line([120, 36, 2.67], [122.5, 36, 0], 'rgba(255,255,255,.35)', 1); line([120, 44, 2.67], [122.5, 44, 0], 'rgba(255,255,255,.35)', 1)
    // jugadores: posiciones típicas (360)
    if (showPlayers) {
      const attC = side === 'favor' ? tc : '#f2f2f2', defC = side === 'favor' ? '#f2f2f2' : tc
      const man = (x: number, y: number, col: string, w: number) => {
        const base = P([x, y, 0]), head = P([x, y, 2.6 + 1.2 * w])
        g.strokeStyle = col; g.lineWidth = Math.max(2.5, S * 0.28); g.lineCap = 'round'; g.beginPath(); g.moveTo(base.x, base.y); g.lineTo(head.x, head.y); g.stroke()
        g.beginPath(); g.arc(head.x, head.y, S * (0.6 + 0.6 * w), 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke()
      }
      const ppl = [...(D.defensores || []).map((p: number[]) => ({ p, col: defC })), ...(D.atacantes || []).map((p: number[]) => ({ p, col: attC }))]
        .sort((a: Any, b: Any) => P([b.p[0], b.p[1], 0]).d - P([a.p[0], a.p[1], 0]).d)
      ppl.filter(({ p }: Any) => p[0] >= X0 - 1).forEach(({ p, col }: Any) => man(p[0], p[1], col, p[2] ?? 0.3))
      if (D.portero) man(D.portero[0], D.portero[1], side === 'favor' ? '#9aa39e' : tc, 0.5)
      man(120.5, 0.5, attC, 0.4) // cobrador
    }
    // córner simulado: arco del balón y remate
    if (sim) {
      const tt = (performance.now() - sim.t0) / 1000
      const [ex, ey, fc, xg, , short] = sim.e
      const start: V3 = [120, 0.8, 0], land: V3 = [ex, ey, 0]
      const peak = short ? 0.6 : 6.5
      const fly = clamp(tt / 1.1, 0, 1)
      const arc = (u: number): V3 => [start[0] + (land[0] - start[0]) * u, start[1] + (land[1] - start[1]) * u, 4 * peak * u * (1 - u) + (short ? 0 : 0.3)]
      g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; g.beginPath()
      for (let k = 0; k <= 30; k++) { const q = P(arc((k / 30) * fly)); if (k) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y) }
      g.stroke(); g.setLineDash([])
      let ball = arc(fly)
      if (fly >= 1 && xg > 0 && fc === 1 && !short) {
        const u = clamp((tt - 1.25) / 0.35, 0, 1)
        const goalPt: V3 = sim.goal ? [120, 40 + ((sim.e[1] * 7) % 6) - 3, 1.2] : [120, 40 + (ey < 40 ? -7 : 7), 3.2]
        if (u > 0) { ball = [land[0] + (goalPt[0] - land[0]) * u, land[1] + (goalPt[1] - land[1]) * u, 1.4 + (goalPt[2] - 1.4) * u]; line([land[0], land[1], 1.4], ball, '#ffffff', 2.5) }
      }
      const sh = P([ball[0], ball[1], 0]), b = P(ball)
      g.beginPath(); g.ellipse(sh.x, sh.y, 4, 2, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fill()
      g.beginPath(); g.arc(b.x, b.y, 5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1; g.stroke()
    }
  })

  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; (e.target as Element).setPointerCapture?.(e.pointerId) }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    setRot(r => ({ yaw: r.yaw + dx * 0.008, pitch: clamp(r.pitch - dy * 0.006, 0.35, 1.45) }))
  }
  const onUp = () => { drag.current = null }

  if (err) return <div className="card note">{err}</div>
  if (!D || !grid) return <div className="card note">Cargando córners…</div>
  const L = liga?.favor
  const avg = (E: number[][], k: number, f = (v: number) => v) => E.length ? E.reduce((s, e) => s + f(e[k]), 0) / E.length : 0
  const xgPer = avg(D.entregas, 3), fcOwn = avg(D.entregas.filter((e: number[]) => e[2] >= 0), 2), rem = avg(D.entregas, 3, v => (v > 0 ? 1 : 0))
  const simDone = sim && performance.now() - sim.t0 > 1500
  return (
    <div className="c3d">
      <div className="c3d-ctrl">
        <div className="seg sm" role="group" aria-label="Córners a favor o en contra">
          <button aria-pressed={side === 'favor'} onClick={() => { setSide('favor'); setSim(null); setBatch(null) }}>A favor</button>
          <button aria-pressed={side === 'contra'} onClick={() => { setSide('contra'); setSim(null); setBatch(null) }}>En contra</button>
        </div>
        <label className="smap-activos" htmlFor="c3d-players"><input id="c3d-players" type="checkbox" checked={showPlayers} onChange={e => setShowPlayers(e.target.checked)} /> Jugadores (360)</label>
        <button className="btn" onClick={runOne}>▶ Simular un córner</button>
        <button className="btn ghost" onClick={runBatch}>Simular 1,000</button>
      </div>
      <div className="c3d-main">
        <div className="c3d-stage">
          <canvas ref={canvas} className="c3d-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            aria-label={`Córners ${side === 'favor' ? 'a favor' : 'en contra'} en 3D: altura = volumen de envíos, color = xG`} />
          {simDone && <div key={sim!.t0} className={`c3d-result${sim!.goal ? ' gol' : ''}`}>{sim!.txt}</div>}
          <div className="c3d-hint note">Arrastra para girar</div>
        </div>
        <aside className="c3d-side">
          <div className="h3">{side === 'favor' ? 'Sus córners' : 'Córners del rival contra su equipo'}</div>
          <div className="c3d-kpis">
            <div><span className="note">Córners</span><b>{D.n}</b><span className="note">{fmt(D.n / Math.max(1, D.partidos), 1)} por partido</span></div>
            <div><span className="note">xG por córner</span><b>{fmt(xgPer, 3)}</b><span className="note">liga {fmt(L ? avg(L.entregas, 3) : NaN, 3)}</span></div>
            <div><span className="note">Terminan en remate</span><b>{pct(100 * rem)}</b><span className="note">liga {pct(L ? 100 * avg(L.entregas, 3, v => (v > 0 ? 1 : 0)) : NaN)}</span></div>
            <div><span className="note">{side === 'favor' ? 'Primer contacto propio' : 'Primer contacto del rival'}</span><b>{pct(100 * fcOwn)}</b></div>
          </div>
          {batch && (
            <div className="c3d-batch">
              <div className="h3">1,000 córners re-jugados</div>
              <div><b>{batch.goles}</b> goles · <b>{batch.remates}</b> remates · xG total <b>{fmt(batch.xg, 1)}</b></div>
              <div className="note">Uno de cada {batch.goles ? Math.round(1000 / batch.goles) : '—'} córners termina en gol · {batch.cortos} en corto</div>
            </div>
          )}
          <div className="c3d-legend">
            <div className="note">Color = xG medio de los córners enviados a esa zona</div>
            <div className="c3d-scale"><span>0</span><i style={{ background: `linear-gradient(90deg, ${xgColor(0)}, ${xgColor(0.33)}, ${xgColor(0.66)}, ${xgColor(1)})` }} /><span>{fmt(grid.maxX, 2)}+</span></div>
            <div className="note">Altura = volumen de envíos que caen ahí ({grid.tot} envíos al área, sin contar cortos)</div>
            {showPlayers && <div className="c3d-dots"><span><i style={{ background: side === 'favor' ? tc : '#f2f2f2' }} />Atacan</span><span><i style={{ background: side === 'favor' ? '#f2f2f2' : tc }} />Defienden</span></div>}
            <div className="note">Posiciones típicas en el momento del envío (fotogramas 360, {D.n360} córners). Todos los córners se muestran como cobrados desde la misma esquina.</div>
          </div>
        </aside>
      </div>
    </div>
  )
}
