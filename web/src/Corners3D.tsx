/* ================================================================ CÓRNERS 3D */
import { useEffect, useMemo, useRef, useState } from 'react'
import { clubColor, dataUrl, fmt, getJSON, jugadorCorto, pct, type Any } from './lib'
import { L } from './settings'
import Info from './Info'
import { Pitch, pitchXY, useTip } from './charts'
import './styles/bp.css'

/* Córners en 3D (datos: pipeline/corners.py, todos los córners normalizados como si se cobraran
   desde la esquina y≈0, atacando hacia x=120; los de la derecha se vuelven a reflejar al dibujar):
   - Barras sobre el último tercio: ALTURA = volumen de envíos que caen en esa zona,
     COLOR = xG medio que generan los córners enviados ahí.
   - Jugadores: posiciones típicas (k-means sobre los fotogramas 360) de atacantes y defensores.
     Al pasar el cursor sobre uno de SU equipo: quién suele aparecer en esa zona (proxy por eventos).
   - Simulador: re-juega uno de sus córners reales: el balón sale de los pies del cobrador en
     arco a la zona de envío; si su equipo toca primero y hubo remate, es gol con probabilidad xG. */

type V3 = [number, number, number]
export type Side = 'favor' | 'contra'
type Lado = 'ambos' | 'izq' | 'der'
type Kind = 'att' | 'def' | 'cob' | 'gk'
type Fig = { x: number; y: number; bx: number; by: number; r: number; kind: Kind; i: number }
type Hover = { kind: Kind; i: number; x: number; y: number }
const X0 = 94, X1 = 120, CELL = 2
const BALL: V3 = [119.3, 0.75, 0.22], TAKER: [number, number] = [119.0, -0.9]
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Escala secuencial de xG (amarillo pálido → rojo oscuro), legible en ambos temas. */
function xgColor(t: number, shade = 1) {
  const s = [[255, 237, 160], [254, 178, 76], [240, 59, 32], [150, 0, 38]]
  const u = clamp(t, 0, 1) * (s.length - 1), i = Math.min(s.length - 2, Math.floor(u)), f = u - i
  const c = s[i].map((v, k) => v + (s[i + 1][k] - v) * f).map(v => Math.round(v * shade))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
const cssVar = (n: string, d: string) => { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d } catch { return d } }
/** clubColor puede devolver var(--x): el canvas necesita el color real. */
const solid = (c: string) => { const m = /^var\((--[\w-]+)\)$/.exec(c); return m ? cssVar(m[1], '#3987e5') : c }
function luminance(c: string) {
  const h = /^#([0-9a-f]{6})$/i.exec(c)
  if (!h) return 0.4
  const n = parseInt(h[1], 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

type Sim = { e: number[]; t0: number; goal: boolean; txt: string }


/* ------------------------------------------------------------ mapa 2D de zonas de envío
   Cada círculo es una zona (4 × 6.7 unidades del último tercio): su TAMAÑO es cuántos envíos caen ahí y su RELLENO el xG medio de esos córners
   (con encogimiento hacia el promedio del DT: k = 3 envíos, para que una zona con 2 envíos no se pinte roja por azar). Mismos datos que el 3D. */
function Map2D({ E, V, side, lado, tc, rivalC, gkRival, showPlayers, Q, maxXref }: { E: number[][]; V: Any; side: Side; lado: Lado; tc: string; rivalC: string; gkRival: string; showPlayers: boolean; Q: Any; maxXref: number }) {
  const tip = useTip()
  const CX = 4, CYN = 12, flip = lado === 'der'
  const fy = (y: number) => (flip ? 80 - y : y)
  const cells = useMemo(() => {
    const m = new Map<string, { i: number; j: number; n: number; xg: number; sh: number; fc: number }>()
    let tot = 0, totX = 0
    for (const [ex, ey, fc, g, , short] of E) {
      if (short || ex < X0) continue
      const i = Math.min(Math.floor((ex - 92) / CX), 6), j = clamp(Math.floor(ey / (80 / CYN)), 0, CYN - 1)
      const k = `${i}:${j}`, c = m.get(k) ?? { i, j, n: 0, xg: 0, sh: 0, fc: 0 }
      c.n++; c.xg += g; c.sh += g > 0 ? 1 : 0; c.fc += fc === 1 ? 1 : 0; m.set(k, c); tot++; totX += g
    }
    const prior = tot ? totX / tot : 0.03
    const arr = [...m.values()].filter(c => c.n >= 2).map(c => ({ ...c, v: (c.xg + 3 * prior) / (c.n + 3) }))
    return { arr, maxN: Math.max(1, ...arr.map(c => c.n)), tot, prior }
  }, [E])
  const maxX = Math.min(Math.max(maxXref, 0.06), 0.2)
  // a dónde van los envíos: reparto por zona del área (coordenadas normalizadas: córner en y≈0, primer palo = lado del córner)
  const zonas = useMemo(() => {
    const Z = [['corto', L('Cortos', 'Short'), L('Córner en corto', 'Short corner')], ['primer', L('Primer palo', 'Near post'), L('Cae del lado del córner, cerca del palo', 'Lands on the corner side, near the post')], ['centro', L('Centro del área chica', 'Central 6-yard box'), L('Frente al arco, entre los dos palos', 'In front of goal, between the posts')], ['segundo', L('Segundo palo', 'Far post'), L('Al lado contrario al córner', 'Opposite side to the corner')], ['penal', L('Punto penal', 'Penalty spot'), L('Frontal, a la altura del punto penal', 'Central, around the penalty spot')], ['fuera', L('Fuera del área', 'Outside the box'), L('Borde del área o más lejos', 'Edge of the box or beyond')]] as const
    const acc: Record<string, { n: number; xg: number; sh: number }> = Object.fromEntries(Z.map(z => [z[0], { n: 0, xg: 0, sh: 0 }]))
    for (const [ex, ey, , g, , short] of E) {
      let k: string
      if (short) k = 'corto'
      else if (ex < 102 || ey < 18 || ey > 62) k = 'fuera'
      else if (ex < 110 && ey >= 30 && ey <= 50) k = 'penal'
      else k = ey < 36 ? 'primer' : ey <= 44 ? 'centro' : 'segundo'
      const a = acc[k]; a.n++; a.xg += g; a.sh += g > 0 ? 1 : 0
    }
    const tot = E.length || 1
    return Z.map(z => ({ id: z[0], nombre: z[1], desc: z[2], ...acc[z[0]], share: acc[z[0]].n / tot })).filter(z => z.id === 'corto' ? z.n > 0 : true).sort((a, b) => (a.id === 'fuera') - (b.id === 'fuera') || b.share - a.share)
  }, [E])
  const ownAtt = side === 'favor'
  // los jugadores llevan colores fijos (azul cielo = su equipo, blanco = rival): el color del club chocaría con la escala amarillo→rojo del xG
  const MINE = '#38bdf8', RIVAL = '#f4f4f5'
  const attC = ownAtt ? MINE : RIVAL, defC = ownAtt ? RIVAL : MINE
  const rr = (n: number) => 0.9 + 2.4 * Math.sqrt(n / cells.maxN)
  const who = (kind: 'att' | 'def', i: number) => Q?.[kind]?.[i]
  const dots = showPlayers ? [
    ...(V.defensores || []).map((p: number[], i: number) => ({ p, col: defC, own: !ownAtt, kind: 'def' as const, i })),
    ...(V.atacantes || []).map((p: number[], i: number) => ({ p, col: attC, own: ownAtt, kind: 'att' as const, i })),
  ].filter(d => d.p[0] >= 92) : []
  const [lx, ly] = pitchXY(119.5, 1, true)
  return (
    <div className="c3d-2d">
      <Pitch vertical crop={[88, 121]} labels={<text x={lx} y={ly} fontSize={2.6} fill="var(--ink-3)">{L('portería ↑', 'goal ↑')}</text>}>
        {cells.arr.map(c => {
          const cx = 92 + (c.i + 0.5) * CX, cy = fy((c.j + 0.5) * (80 / CYN)), t = c.v / maxX
          return (
            <circle key={`${c.i}:${c.j}`} cx={cx} cy={cy} r={rr(c.n)} fill={xgColor(t)} fillOpacity={0.92} stroke="rgba(0,0,0,.35)" strokeWidth={0.25}
              onMouseMove={e => tip.show(e, <><b>{c.n}</b> {L('envíos', 'deliveries')} ({fmt((100 * c.n) / Math.max(cells.tot, 1), 0)}%)<br />xG {L('medio', 'avg')} <b>{fmt(c.xg / c.n, 3)}</b><br />{L('terminan en remate', 'end in a shot')} {fmt((100 * c.sh) / c.n, 0)}%<br />{L('primer contacto propio', 'own first contact')} {fmt((100 * c.fc) / c.n, 0)}%</>)} onMouseLeave={tip.hide} />
          )
        })}
        {dots.map(d => {
          const op = 0.62 + 0.38 * Math.min(1, (d.p[2] ?? 0.2) / 0.3)
          return (
            <g key={d.kind + d.i} opacity={op}
              onMouseMove={e => { const q = d.own ? who(d.kind, d.i) : null; tip.show(e, <>{d.own ? (d.kind === 'def' ? L('Defensor de su equipo', 'His defender') : L('Atacante de su equipo', 'His attacker')) : L('Posición típica del rival', 'Typical opponent position')}{q?.top?.length ? <><br />{q.top.map(([id, nom, p]: [number, string, number]) => <span key={id}>{jugadorCorto(id, nom)} {p}%<br /></span>)}</> : null}</>) }} onMouseLeave={tip.hide}>
              <circle cx={d.p[0]} cy={fy(d.p[1])} r={1.55} fill="#0b1018" opacity={0.85} />
              <circle cx={d.p[0]} cy={fy(d.p[1])} r={1.05} fill={d.col} />
            </g>
          )
        })}
        {showPlayers && V.portero && <g><circle cx={V.portero[0]} cy={fy(V.portero[1])} r={1.9} fill="#0b1018" opacity={0.85} /><circle cx={V.portero[0]} cy={fy(V.portero[1])} r={1.45} fill={ownAtt ? '#9ca3af' : MINE} /><text x={V.portero[0]} y={fy(V.portero[1]) + 0.75} fontSize={1.9} fontWeight={800} textAnchor="middle" fill="#0b1018" transform={`rotate(90 ${V.portero[0]} ${fy(V.portero[1])})`}>P</text></g>}
        {/* cobrador y bandera */}
        <circle cx={119.4} cy={fy(0.6)} r={0.9} fill="#fff" stroke="#111" strokeWidth={0.3} />
      </Pitch>
      <div className="c3d-zones">
        <div className="c3d-zones-h">{L('A dónde manda los envíos', 'Where the deliveries go')}<span className="note">{L('% de sus córners · xG medio de cada zona', '% of his corners · average xG of each zone')}</span></div>
        {zonas.map(z => (
          <div key={z.id} className="c3d-zone" title={z.desc}>
            <span className="c3d-zone-n">{z.nombre}</span>
            <span className="c3d-zone-bar"><i style={{ width: `${Math.min(100, z.share * 100 / Math.max(...zonas.map(q => q.share), 0.01))}%`, background: xgColor(z.n ? z.xg / z.n / maxX : 0) }} /></span>
            <b>{fmt(z.share * 100, 0)}%</b>
            <small>{z.n ? `xG ${fmt(z.xg / z.n, 3)}` : '—'}</small>
          </div>
        ))}
      </div>
      <div className="c3d-2d-key" aria-hidden="true">
        <div className="c3d-key-row"><span className="c3d-2d-sz"><i style={{ width: 8, height: 8 }} /><i style={{ width: 14, height: 14 }} /><i style={{ width: 22, height: 22 }} /></span>{L('Tamaño: cuántos envíos caen ahí', 'Size: how many deliveries land there')}</div>
        <div className="c3d-key-row c3d-key-scale"><span>xG</span><i style={{ background: `linear-gradient(90deg, ${xgColor(0)}, ${xgColor(0.33)}, ${xgColor(0.66)}, ${xgColor(1)})` }} /><span>{fmt(maxX, 2)}+</span></div>
        {showPlayers && <div className="c3d-key-row c3d-key-dots">
          <span><i style={{ background: MINE }} />{side === 'favor' ? L('Su equipo ataca', 'His team attacks') : L('Su equipo defiende', 'His team defends')}</span>
          <span><i style={{ background: RIVAL }} />{L('Rival', 'Opponent')}</span>
        </div>}
      </div>
      {tip.el}
    </div>
  )
}

export default function Corners3D({ art, media, side, onSide }: { art: Any; media: Any; side: Side; onSide: (s: Side) => void }) {
  const [data, setData] = useState<Any>(null)
  const [liga, setLiga] = useState<Any>(null)
  const [lado, setLado] = useState<Lado>('ambos')
  const [showPlayers, setShowPlayers] = useState(true)
  const [vista, setVista] = useState<'2d' | '3d'>('2d')
  const [rot, setRot] = useState({ yaw: 1.25, pitch: 0.82 })
  const [sim, setSim] = useState<Sim | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const figs = useRef<Fig[]>([])
  const [, force] = useState(0)
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null)
  const club = media?.dts?.[art.id]?.club ?? art.etapas?.at(-1)?.club
  const tc = solid(clubColor(club, media))
  const rivalC = luminance(tc) > 0.8 ? '#e0605a' : '#f2f2f2'
  const gkRival = '#9aa39e'

  useEffect(() => {
    setData(null); setErr(null)
    getJSON(dataUrl(`corners_${art.id}.json`)).then(setData).catch(() => setErr(L('Aún no hay datos de córners 3D para este DT.', 'No 3D corner data for this coach yet.')))
    getJSON(dataUrl('corners_liga.json')).then(setLiga).catch(() => {})
  }, [art.id])
  useEffect(() => { setSim(null); setHover(null) }, [side, lado, art.id])
  const D = data?.[side]
  const V = D?.lados?.[lado]
  // con la cámara por defecto el córner y≈0 cae a la derecha de la imagen: se refleja para que
  // «izquierda» (y ambos, normalizados a la izquierda) se vean desde la izquierda del atacante
  const mirror = lado !== 'der'
  const E: number[][] = useMemo(() => {
    if (!D) return []
    return lado === 'ambos' ? D.entregas : D.entregas.filter((e: number[]) => e[6] === (lado === 'izq' ? 0 : 1))
  }, [D, lado])

  // rejilla de zonas: conteo de envíos suavizado (kernel gaussiano, σ≈1 celda) y xG medio con
  // encogimiento hacia su media global (k=4 envíos), para que una celda con 1 envío no se pinte roja por azar
  const grid = useMemo(() => {
    if (!D) return null
    const nx = Math.ceil((X1 - X0) / CELL), ny = Math.ceil(80 / CELL)
    const z = () => Array.from({ length: nx }, () => new Array(ny).fill(0))
    const cnt0 = z(), xg0 = z(), cnt = z(), xgs = z()
    let tot = 0, totX = 0
    for (const [ex, ey, , g, , sh] of E) {
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
  }, [D, E])

  const runOne = () => {
    if (!E.length) return
    const e = E[Math.floor(Math.random() * E.length)]
    const goal = e[3] > 0 && Math.random() < e[3]
    const txt = e[5] ? L('Córner en corto', 'Short corner') : e[3] > 0 ? (goal ? L('¡GOL!', 'GOAL!') : `${L('Remate sin gol', 'Shot, no goal')} · xG ${fmt(e[3], 2)}`) : e[2] === 1 ? L('Primer contacto propio, sin remate', 'First contact won, no shot') : L('Despeja el rival', 'Cleared by the opponent')
    setHover(null)
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

  // redibujar al cambiar el tamaño del lienzo o el tema (claro/oscuro)
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const redraw = () => force(v => v + 1)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null
    ro?.observe(c)
    const mo = new MutationObserver(redraw)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    mq?.addEventListener?.('change', redraw)
    return () => { ro?.disconnect(); mo.disconnect(); mq?.removeEventListener?.('change', redraw) }
  }, [D])

  // ------------------------------------------------------------ dibujo
  useEffect(() => {
    const c = canvas.current
    if (!c || !grid || !V) return
    const W = c.clientWidth, H = c.clientHeight, dpr = window.devicePixelRatio || 1
    if (!W || !H) return
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = cssVar('--surface', '#18211c'); g.fillRect(0, 0, W, H)
    // cámara: centro de la escena en el área; yaw alrededor del eje vertical, pitch = inclinación.
    // Reflejo horizontal de la imagen (equivale a reflejar cancha y cámara): la bandera queda en el
    // lado correcto y izquierda/derecha se ven como espejo una de otra.
    const C: V3 = [107, 40, 0]
    const cy = Math.cos(rot.yaw), sy = Math.sin(rot.yaw), cp = Math.cos(rot.pitch), sp = Math.sin(rot.pitch)
    const R = ([x, y, z]: V3) => {
      const dx = x - C[0], dy = y - C[1], dz = z - C[2]
      const rx = dx * cy - dy * sy, ry = dx * sy + dy * cy       // giro horizontal
      const vy = ry * cp - dz * sp, depth = ry * sp + dz * cp    // inclinación
      const f = 90 / (90 + vy)
      return { x: (mirror ? -rx : rx) * f, y: -depth * f, d: vy }
    }
    // encuadre automático: la escena (último cuarto de cancha + portería + bandera) siempre cabe en el lienzo
    // en pantallas angostas se encuadra más cerca (área + esquina) para que se lea mejor
    const narrow = W < 520, yFar = narrow ? 64 : 70, xNear = narrow ? 100 : X0 + 1
    const box: V3[] = [[xNear, 0, 0], [121, -1, 0], [121, yFar, 0], [xNear + 3, yFar, 0], [120, 36, 2.7], [120, 44, 2.7], [112, 40, 13], [120, 0, 3.6], [118.5, -2, 4.4], [121.5, -1.5, 0]]
    const bb = box.map(R), mx = Math.min(...bb.map(p => p.x)), Mx = Math.max(...bb.map(p => p.x)), my = Math.min(...bb.map(p => p.y)), My = Math.max(...bb.map(p => p.y))
    const S = Math.min((W - 40) / (Mx - mx), (H - 40) / (My - my)), ox = W / 2 - S * (mx + Mx) / 2, oy = H / 2 - S * (my + My) / 2 + 6
    const P = (v: V3) => { const r = R(v); return { x: ox + r.x * S, y: oy + r.y * S, d: r.d } }
    const line = (a: V3, b: V3, col: string, w = 1) => { const A = P(a), B = P(b); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke() }
    const poly = (pts: V3[], fill: string, stroke?: string) => { const q = pts.map(P); g.beginPath(); q.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 0.6; g.stroke() } }
    // piso y líneas
    const pitch = cssVar('--pitch', '#1d2922'), pl = cssVar('--pitch-line', '#3b4b42')
    poly([[X0, 0, 0], [120, 0, 0], [120, 80, 0], [X0, 80, 0]], pitch)
    ;[[[102, 18], [120, 18]], [[102, 18], [102, 62]], [[102, 62], [120, 62]], [[114, 30], [120, 30]], [[114, 30], [114, 50]], [[114, 50], [120, 50]], [[120, 0], [120, 80]], [[X0, 0], [120, 0]], [[X0, 80], [120, 80]]]
      .forEach(([a, b]) => line([a[0], a[1], 0], [b[0], b[1], 0], pl, 1.2))
    // arco de esquina
    g.strokeStyle = pl; g.lineWidth = 1.2; g.beginPath()
    for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI / 2, q = P([120 - Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0]); if (k) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y) }
    g.stroke()
    // barras (ordenadas de atrás hacia adelante)
    const hmax = 13
    const bars: { i: number; j: number; d: number }[] = []
    for (let i = 0; i < grid.nx; i++) for (let j = 0; j < grid.ny; j++) if (grid.cnt[i][j]) bars.push({ i, j, d: P([X0 + (i + 0.5) * CELL, (j + 0.5) * CELL, 0]).d })
    bars.sort((a, b) => b.d - a.d)
    for (const { i, j } of bars) {
      const cn = grid.cnt[i][j], h = (cn / grid.maxC) * hmax, t = grid.xg[i][j] / grid.maxX
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
    // bandera de córner
    line([120, 0, 0], [120, 0, 3.3], '#e9e9e9', 1.6)
    poly([[120, 0, 3.3], [120, 0, 2.45], [118.7, -0.25, 2.95]], '#f2b51b', 'rgba(0,0,0,.35)')

    // jugadores: posiciones típicas (360) + cobrador junto al balón
    const ownKind: Kind = side === 'favor' ? 'att' : 'def'
    const out: Fig[] = []
    const man = (x: number, y: number, col: string, w: number, kind?: Kind, i = 0) => {
      const base = P([x, y, 0]), head = P([x, y, 2.6 + 1.2 * w]), r = S * (0.6 + 0.6 * w)
      const hov = hover && kind && hover.kind === kind && hover.i === i
      g.strokeStyle = col; g.lineWidth = Math.max(2.5, S * 0.28); g.lineCap = 'round'; g.beginPath(); g.moveTo(base.x, base.y); g.lineTo(head.x, head.y); g.stroke()
      g.beginPath(); g.arc(head.x, head.y, r, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke()
      if (hov) { g.beginPath(); g.arc(head.x, head.y, r + 4, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = cssVar('--ink', '#eef3ef'); g.stroke() }
      if (kind) out.push({ x: head.x, y: head.y, bx: base.x, by: base.y, r, kind, i })
    }
    if (showPlayers) {
      const attC = side === 'favor' ? tc : rivalC, defC = side === 'favor' ? rivalC : tc
      const ppl = [
        ...(V.defensores || []).map((p: number[], i: number) => ({ p, col: defC, kind: ownKind === 'def' ? 'def' : undefined, i })),
        ...(V.atacantes || []).map((p: number[], i: number) => ({ p, col: attC, kind: ownKind === 'att' ? 'att' : undefined, i })),
      ]
      if (V.portero) ppl.push({ p: [V.portero[0], V.portero[1], 0.5], col: side === 'favor' ? gkRival : tc, kind: side === 'contra' ? 'gk' : undefined, i: 0 })
      ppl.push({ p: [TAKER[0], TAKER[1], 0.4], col: attC, kind: side === 'favor' ? 'cob' : undefined, i: 0 })
      ppl.filter(({ p }: Any) => p[0] >= X0 - 1)
        .sort((a: Any, b: Any) => P([b.p[0], b.p[1], 0]).d - P([a.p[0], a.p[1], 0]).d)
        .forEach(({ p, col, kind, i }: Any) => man(p[0], p[1], col, p[2] ?? 0.3, kind, i))
    }
    figs.current = out

    // balón: en los pies del cobrador; en la simulación vuela en arco a la zona de envío y remata
    let ball: V3 = BALL
    if (sim) {
      const tt = (performance.now() - sim.t0) / 1000
      const [ex, ey, fc, xg, , short] = sim.e
      const land: V3 = [ex, ey, 0]
      const peak = short ? 0.6 : 6.5
      const wait = 0.35, fly = clamp((tt - wait) / 1.1, 0, 1)
      const arc = (u: number): V3 => [BALL[0] + (land[0] - BALL[0]) * u, BALL[1] + (land[1] - BALL[1]) * u, BALL[2] + 4 * peak * u * (1 - u) + (short ? 0 : 0.3 * u)]
      if (fly > 0) {
        g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; g.beginPath()
        for (let k = 0; k <= 30; k++) { const q = P(arc((k / 30) * fly)); if (k) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y) }
        g.stroke(); g.setLineDash([])
      }
      ball = arc(fly)
      if (fly >= 1 && xg > 0 && fc === 1 && !short) {
        const u = clamp((tt - wait - 1.25) / 0.35, 0, 1)
        const goalPt: V3 = sim.goal ? [120, 40 + ((sim.e[1] * 7) % 6) - 3, 1.2] : [120, 40 + (ey < 40 ? -7 : 7), 3.2]
        if (u > 0) { ball = [land[0] + (goalPt[0] - land[0]) * u, land[1] + (goalPt[1] - land[1]) * u, 1.4 + (goalPt[2] - 1.4) * u]; line([land[0], land[1], 1.4], ball, '#ffffff', 2.5) }
      }
    }
    const sh = P([ball[0], ball[1], 0]), b = P(ball), br = clamp(S * 0.42, 3, 6)
    g.beginPath(); g.ellipse(sh.x, sh.y, br * 0.9, br * 0.45, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fill()
    g.beginPath(); g.arc(b.x, b.y, br, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1; g.stroke()
  })

  // hit-test de figuras de su equipo (cabeza o cuerpo)
  const pick = (e: React.PointerEvent): Hover | null => {
    const c = canvas.current
    if (!c) return null
    const rc = c.getBoundingClientRect(), px = e.clientX - rc.left, py = e.clientY - rc.top
    let best: Fig | null = null, bd = Infinity
    for (const f of figs.current) {
      const vx = f.x - f.bx, vy = f.y - f.by, L2 = vx * vx + vy * vy || 1
      const u = clamp(((px - f.bx) * vx + (py - f.by) * vy) / L2, 0, 1)
      const d = Math.hypot(px - (f.bx + u * vx), py - (f.by + u * vy))
      if (d < Math.max(10, f.r + 5) && d < bd) { bd = d; best = f }
    }
    return best ? { kind: best.kind, i: best.i, x: best.x, y: best.y } : null
  }
  const sameHover = (a: Hover | null, b: Hover | null) => (a?.kind === b?.kind && a?.i === b?.i)
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, moved: 0 }; (e.target as Element).setPointerCapture?.(e.pointerId) }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) {
      if (e.pointerType === 'mouse') { const h = pick(e); setHover(o => (sameHover(o, h) ? o : h)) }
      return
    }
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY, moved: drag.current.moved + Math.abs(dx) + Math.abs(dy) }
    if (drag.current.moved > 4) setHover(null)
    setRot(r => ({ yaw: r.yaw + (mirror ? -dx : dx) * 0.008, pitch: clamp(r.pitch - dy * 0.006, 0.35, 1.45) }))
  }
  const onUp = (e: React.PointerEvent) => {
    const moved = drag.current?.moved ?? 99
    drag.current = null
    if (moved < 5) { const h = pick(e); setHover(o => (sameHover(o, h) && e.pointerType !== 'mouse' ? null : h)) }
  }

  if (err) return <div className="card note">{err}</div>
  if (!D || !grid || !V) return <div className="card note">{L('Cargando córners…', 'Loading corners…')}</div>
  const LK = liga?.favor?.kpis?.[lado]
  const avg = (A: number[][], k: number, f = (v: number) => v) => A.length ? A.reduce((s, e) => s + f(e[k]), 0) / A.length : NaN
  const xgPer = avg(E, 3), fcOwn = avg(E.filter(e => e[2] >= 0), 2), rem = avg(E, 3, v => (v > 0 ? 1 : 0))
  const simDone = sim && performance.now() - sim.t0 > 1850
  const Q = V.quien || {}
  const quienClub: string | null = D.quien_club ?? null
  const donde = quienClub ? L(`en ${quienClub}`, `at ${quienClub}`) : L('en toda su carrera', 'across his whole career')
  const good = side === 'favor' ? 1 : -1
  const nCorners = lado === 'ambos' ? D.n : V.n
  const ladoTxt = lado === 'izq' ? L('desde la izquierda', 'from the left') : lado === 'der' ? L('desde la derecha', 'from the right') : ''

  // tooltip
  let tip: { title: string; info: Any; foot: string } | null = null
  if (hover) {
    if (hover.kind === 'cob') tip = { title: L('Cobrador', 'Corner taker'), info: Q.cob, foot: L(`Quién cobra sus córners ${ladoTxt ? ladoTxt + ' ' : ''}${donde}.`, `Who takes his corners ${ladoTxt ? ladoTxt + ' ' : ''}${donde}.`) }
    else if (hover.kind === 'gk') tip = { title: L('Su portero', 'His goalkeeper'), info: Q.gk, foot: L(`Porteros que intervienen en córners rivales ${donde}.`, `Goalkeepers involved in opponent corners ${donde}.`) }
    else tip = {
      title: hover.kind === 'att' ? L('Atacante de su equipo', 'His attacker') : L('Defensor de su equipo', 'His defender'),
      info: Q[hover.kind]?.[hover.i],
      foot: L(`Quién suele aparecer en esta zona: primera acción de cada jugador tras el córner, ${donde}.`, `Who usually turns up in this zone: each player's first action after the corner, ${donde}.`),
    }
  }
  const stageW = canvas.current?.clientWidth ?? 600
  const tipLeft = hover ? clamp(hover.x + 14, 8, Math.max(8, stageW - 258)) : 0
  const tipTop = hover ? Math.max(8, hover.y - 20) : 0
  const DIF = (v: number, l: number | undefined | null, dir: number) => {
    if (l == null || !Number.isFinite(v)) return null
    const rel = l ? (v - l) / Math.abs(l) : 0
    if (Math.abs(rel) < 0.03) return <span className="bp-arrow eq" title={L('Como la liga', 'In line with the league')}>≈</span>
    const up = v > l, ok = dir === 0 ? null : (up ? dir > 0 : dir < 0)
    return <span className={`bp-arrow ${ok == null ? 'eq' : ok ? 'up' : 'down'}`} title={up ? L('Más que la liga', 'Above the league') : L('Menos que la liga', 'Below the league')}>{up ? '▲' : '▼'}</span>
  }

  return (
    <div className="c3d">
      <div className="c3d-ctrl">
        <div className="seg sm" role="group" aria-label={L('Córners a favor o en contra', 'Attacking or defending corners')}>
          <button aria-pressed={side === 'favor'} onClick={() => onSide('favor')}>{L('A favor', 'Attacking')}</button>
          <button aria-pressed={side === 'contra'} onClick={() => onSide('contra')}>{L('En contra', 'Defending')}</button>
        </div>
        <div className="seg sm" role="group" aria-label={L('Lado desde el que se cobra el córner', 'Side the corner is taken from')}>
          <button aria-pressed={lado === 'ambos'} onClick={() => setLado('ambos')}>{L('Ambos', 'Both')}</button>
          <button aria-pressed={lado === 'izq'} onClick={() => setLado('izq')}>{L('Desde la izquierda', 'From the left')}</button>
          <button aria-pressed={lado === 'der'} onClick={() => setLado('der')}>{L('Desde la derecha', 'From the right')}</button>
        </div>
        <div className="seg sm" role="group" aria-label={L('Vista 2D o 3D', '2D or 3D view')}>
          <button aria-pressed={vista === '2d'} onClick={() => setVista('2d')}>2D</button>
          <button aria-pressed={vista === '3d'} onClick={() => setVista('3d')}>3D</button>
        </div>
        <label className="smap-activos" htmlFor="c3d-players"><input id="c3d-players" type="checkbox" checked={showPlayers} onChange={e => setShowPlayers(e.target.checked)} /> {L('Jugadores (360)', 'Players (360)')}</label>
        {vista === '3d' && <button className="btn c3d-play" onClick={runOne}>▶ {L('Simular un córner', 'Simulate a corner')}</button>}
      </div>
      <div className="c3d-main">
        <div className="c3d-stage">
          {vista === '2d' ? (
            <Map2D E={E} V={V} side={side} lado={lado} tc={tc} rivalC={rivalC} gkRival={gkRival} showPlayers={showPlayers} Q={V.quien || {}} maxXref={grid.maxX} />
          ) : (<>
          <div className="c3d-sizer" />
          <canvas ref={canvas} className={`c3d-canvas${hover ? ' hot' : ''}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
            onPointerCancel={() => { drag.current = null }} onPointerLeave={e => { if (e.pointerType === 'mouse' && !drag.current) setHover(null) }}
            aria-label={L(`Córners ${side === 'favor' ? 'a favor' : 'en contra'} ${ladoTxt} en 3D: altura = volumen de envíos, color = xG`, `${side === 'favor' ? 'Attacking' : 'Defending'} corners ${ladoTxt} in 3D: height = delivery volume, colour = xG`)} />
          <div className="c3d-key" aria-hidden="true">
            <div className="c3d-key-row"><span className="c3d-key-bars"><i style={{ height: 6 }} /><i style={{ height: 11 }} /><i style={{ height: 16 }} /></span>{L('Altura: cuántos envíos caen ahí', 'Height: how many deliveries land there')}</div>
            <div className="c3d-key-row c3d-key-scale"><span>xG</span><i style={{ background: `linear-gradient(90deg, ${xgColor(0)}, ${xgColor(0.33)}, ${xgColor(0.66)}, ${xgColor(1)})` }} /><span>{fmt(grid.maxX, 2)}+</span></div>
            {showPlayers && <div className="c3d-key-row c3d-key-dots">
              <span><i style={{ background: tc }} />{L('Su equipo', 'His team')}</span>
              <span><i style={{ background: rivalC }} />{L('Rival', 'Opponent')}</span>
              {side === 'favor' && <span><i style={{ background: gkRival }} />{L('Portero rival', 'Opposing GK')}</span>}
            </div>}
          </div>
          {tip && (
            <div className="c3d-tip" style={{ left: tipLeft, top: tipTop }} role="status">
              <div className="c3d-tip-h">{tip.title}</div>
              {tip.info?.top?.length ? (
                <ul>{tip.info.top.map(([id, nom, p]: [number, string, number]) => (
                  <li key={id}><span className="c3d-tip-n">{jugadorCorto(id, nom)}</span><span className="c3d-tip-bar"><i style={{ width: `${p}%`, background: tc }} /></span><b>{p}%</b></li>
                ))}</ul>
              ) : <div className="c3d-tip-empty">{L('Sin acciones registradas en esta zona.', 'No recorded actions in this zone.')}</div>}
              <div className="c3d-tip-f">{tip.foot}{tip.info?.n ? ` ${tip.info.n} ${tip.info.n === 1 ? L('acción', 'action') : hover?.kind === 'cob' ? L('córners', 'corners') : L('acciones', 'actions')}.` : ''}{tip.info?.n != null && tip.info.n < 5 && hover?.kind !== 'cob' ? L(' Pocos datos.', ' Small sample.') : ''}</div>
            </div>
          )}
          {simDone && <div key={sim!.t0} className={`c3d-result${sim!.goal ? ' gol' : ''}`}>{sim!.txt}</div>}
          <div className="c3d-hint note">{L('Arrastra para girar · pasa el cursor sobre su equipo', 'Drag to rotate · hover over his team')}</div>
          </>)}
        </div>
        <aside className="c3d-side">
          <div>
            <div className="h3">{side === 'favor' ? L('Sus córners', 'His corners') : L('Córners del rival contra su equipo', 'Opponent corners against his team')}
              <Info wide>
                <p>{L('Pasa el cursor (o toca) sobre un jugador de su equipo para ver quién suele ocupar esa zona.', 'Hover over (or tap) one of his players to see who usually fills that zone.')}</p>
                <p>{grid.tot} {L('envíos al área (sin contar cortos). Jugadores: posición típica al momento del envío en', 'deliveries into the box (short corners excluded). Players: typical position at the moment of delivery across')} {V.n360} {L('córners con fotograma 360.', 'corners with a 360 freeze frame.')}
                {lado === 'ambos' ? L(' Todos se muestran como cobrados desde la izquierda.', ' All shown as if taken from the left.') : ''}</p>
              </Info>
            </div>
            <div className="note">{ladoTxt ? L(`Sólo los cobrados ${ladoTxt}`, `Only those taken ${ladoTxt}`) : L('Izquierda y derecha juntos', 'Left and right combined')} · {L('comparado con la liga', 'compared with the league')}</div>
          </div>
          <div className="c3d-kpis">
            <div><span className="note">{L('Córners', 'Corners')}</span><b>{nCorners}</b><span className="note">{fmt(nCorners / Math.max(1, D.partidos), 1)} {L('por partido', 'per match')}</span></div>
            <div><span className="note">{L('xG por córner', 'xG per corner')}</span><b>{fmt(xgPer, 3)} {DIF(xgPer, LK?.xg, good)}</b><span className="note">{L('liga', 'league')} {fmt(LK?.xg ?? NaN, 3)}</span></div>
            <div><span className="note">{L('Terminan en remate', 'End in a shot')}</span><b>{pct(100 * rem)} {DIF(rem, LK?.remate, good)}</b><span className="note">{L('liga', 'league')} {pct(LK ? 100 * LK.remate : null)}</span></div>
            <div><span className="note">{side === 'favor' ? L('Primer contacto propio', 'First contact won') : L('Primer contacto del rival', 'Opponent first contact')}</span><b>{pct(100 * fcOwn)} {DIF(fcOwn, LK?.fc, good)}</b><span className="note">{L('liga', 'league')} {pct(LK?.fc != null ? 100 * LK.fc : null)}</span></div>
          </div>
          {side === 'favor' && Q.cob?.top?.length > 0 && (
            <div className="c3d-who">
              <div className="note">{L('Quién los cobra', 'Who takes them')} {donde}</div>
              {Q.cob.top.map(([id, nom, p]: [number, string, number]) => (
                <div key={id} className="c3d-who-row"><span>{jugadorCorto(id, nom)}</span><span className="c3d-tip-bar"><i style={{ width: `${p}%`, background: tc }} /></span><b>{p}%</b></div>
              ))}
            </div>
          )}
          {side === 'contra' && Q.gk?.top?.length > 0 && (
            <div className="c3d-who">
              <div className="note">{L('Su portero en estos córners', 'His goalkeeper on these corners')} {donde}</div>
              {Q.gk.top.map(([id, nom, p]: [number, string, number]) => (
                <div key={id} className="c3d-who-row"><span>{jugadorCorto(id, nom)}</span><span className="c3d-tip-bar"><i style={{ width: `${p}%`, background: tc }} /></span><b>{p}%</b></div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
