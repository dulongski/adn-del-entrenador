import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { clamp, ease } from './kit'
import { C, MONO, TOTAL } from './theme'

/* ============================================================ dibujos de plano que no paran detrás de todo
   Cada elemento se dibuja a mano (trazo que avanza), se queda un rato y se desvanece mientras otros ya están naciendo.
   Va debajo de las escenas: no importa que queden tapados, la hoja siempre está "trabajándose". */

const mulberry = (seed: number) => () => {
  seed = (seed + 0x6D2B79F5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
type Item = { at: number; draw: number; life: number; kind: number; x: number; y: number; s: number; rot: number; seed: number }
const ITEMS: Item[] = (() => {
  const r = mulberry(11), out: Item[] = []
  let kind = 0
  for (let at = -240; at < TOTAL; at += 30 + Math.floor(r() * 26)) {
    kind = (kind + 1 + Math.floor(r() * 3)) % 8                    // recorre los tipos sin repetir el anterior
    out.push({ at, draw: 70 + r() * 60, life: 300 + r() * 220, kind, x: 140 + r() * 1640, y: 130 + r() * 820, s: 0.75 + r() * 0.8, rot: (r() - 0.5) * 36, seed: Math.floor(r() * 1e6) })
  }
  return out
})()

const P = ({ d, p, w = 1.3, c = C.ink2, dash }: { d: string; p: number; w?: number; c?: string; dash?: string }) =>
  dash ? <path d={d} fill="none" stroke={c} strokeWidth={w} strokeDasharray={dash} opacity={p > 0 ? Math.min(1, p * 3) : 0} />
    : <path d={d} fill="none" stroke={c} strokeWidth={w} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} strokeLinecap="round" />
const T = ({ x, y, p, children, c = C.ink2, anchor = 'start' }: { x: number; y: number; p: number; children: React.ReactNode; c?: string; anchor?: 'start' | 'middle' | 'end' }) =>
  <text x={x} y={y} fontFamily={MONO} fontSize={13} fill={c} textAnchor={anchor} opacity={Math.max(0, (p - 0.6) / 0.4)}>{children}</text>
const sub = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

function Shape({ it, p }: { it: Item; p: number }) {
  const r = mulberry(it.seed)
  switch (it.kind) {
    case 0: { // área grande con medidas
      const w = 403, h = 165
      return <g>
        <P d={`M 0 0 H ${w} V ${h} H 0 Z`} p={sub(p, 0, 0.5)} />
        <P d={`M 0 ${h / 2 - 90} H 55 V ${h / 2 + 90} H 0`} p={sub(p, 0.2, 0.6)} />
        <P d={`M 220 ${h} A 91 91 0 0 1 ${w} ${h}`} p={sub(p, 0.3, 0.8)} dash="5 5" />
        <circle cx={110} cy={h / 2} r={3} fill={C.ink2} opacity={sub(p, 0.5, 0.7)} />
        <P d={`M 0 ${h + 26} H ${w} M 0 ${h + 18} V ${h + 34} M ${w} ${h + 18} V ${h + 34}`} p={sub(p, 0.5, 1)} w={1} />
        <T x={w / 2} y={h + 46} p={p} anchor="middle">40.3 m</T>
        <T x={-8} y={h / 2 + 4} p={p} anchor="end">16.5</T>
      </g>
    }
    case 1: { // red de pases
      const n = 6 + Math.floor(r() * 3), pts = Array.from({ length: n }, (_, i) => [i * (380 / (n - 1)) + (r() - 0.5) * 40, 120 + (r() - 0.5) * 220] as [number, number])
      return <g>
        {pts.slice(1).map(([x, y], i) => {
          const [x0, y0] = pts[i], a = sub(p, i / n, (i + 1.2) / n), long = Math.hypot(x - x0, y - y0) > 120
          return <g key={i}>
            <P d={`M ${x0} ${y0} L ${x} ${y}`} p={a} w={long ? 1.8 : 1.2} c={i % 3 === 2 ? C.rose : C.ink2} dash={i % 2 ? '2 6' : undefined} />
            <circle cx={x} cy={y} r={6} fill="none" stroke={C.ink2} strokeWidth={1.4} opacity={a} />
          </g>
        })}
        <circle cx={pts[0][0]} cy={pts[0][1]} r={6} fill={C.ink2} opacity={sub(p, 0, 0.1)} />
        <T x={0} y={270} p={p}>SECUENCIA {String(Math.floor(r() * 90) + 10)} · {n - 1} ACCIONES</T>
      </g>
    }
    case 2: { // transportador
      const R = [60, 110, 160]
      const a = (-20 + r() * 80) * Math.PI / 180
      return <g>
        {R.map((rr, i) => <P key={i} d={`M ${-rr} 0 A ${rr} ${rr} 0 0 1 ${rr} 0`} p={sub(p, i * 0.15, 0.5 + i * 0.15)} />)}
        <P d={`M -175 0 H 175`} p={sub(p, 0, 0.4)} w={1} />
        {Array.from({ length: 19 }, (_, k) => k * 10).map(deg => {
          const t = deg * Math.PI / 180, l = deg % 30 === 0 ? 16 : 8
          return <P key={deg} d={`M ${-Math.cos(t) * 160} ${-Math.sin(t) * 160} L ${-Math.cos(t) * (160 + l)} ${-Math.sin(t) * (160 + l)}`} p={sub(p, 0.4 + deg / 400, 0.9)} w={1} />
        })}
        <P d={`M 0 0 L ${Math.cos(a) * 190} ${-Math.sin(a) * 190}`} p={sub(p, 0.5, 1)} c={C.rose} w={1.6} />
        <T x={Math.cos(a) * 200} y={-Math.sin(a) * 200} p={p} c={C.rose}>{Math.round(a * 180 / Math.PI)}°</T>
      </g>
    }
    case 3: { // cota horizontal con líneas de referencia
      const L = 260 + r() * 200
      return <g>
        <P d={`M 0 -30 V 30 M ${L} -30 V 30`} p={sub(p, 0, 0.4)} w={1} />
        <P d={`M 0 0 H ${L}`} p={sub(p, 0.2, 0.8)} w={1.4} />
        <P d={`M 0 0 l 12 -5 M 0 0 l 12 5 M ${L} 0 l -12 -5 M ${L} 0 l -12 5`} p={sub(p, 0.7, 1)} w={1.2} />
        <T x={L / 2} y={-10} p={p} anchor="middle">{(L / 3.6).toFixed(1)} m</T>
        <P d={`M 0 60 H ${L * 0.62} M 0 52 V 68 M ${L * 0.62} 52 V 68`} p={sub(p, 0.4, 1)} w={1} />
        <T x={L * 0.31} y={86} p={p} anchor="middle">{(L * 0.62 / 3.6).toFixed(1)} m</T>
      </g>
    }
    case 4: { // flecha táctica curva con cruces
      const x2 = 300 + r() * 120, y2 = -80 - r() * 120
      const d = `M 0 0 C ${x2 * 0.4} ${y2 * 0.1} ${x2 * 0.7} ${y2 * 1.1} ${x2} ${y2}`
      return <g>
        <P d={d} p={sub(p, 0, 0.8)} w={1.8} c={C.ink2} />
        <P d={`M ${x2} ${y2} l -18 2 M ${x2} ${y2} l -8 16`} p={sub(p, 0.75, 1)} w={1.8} />
        {[0.25, 0.5, 0.75].map((k, i) => <g key={i} opacity={sub(p, 0.2 + k * 0.6, 0.4 + k * 0.6)}><path d={`M ${x2 * k - 6} ${y2 * k * 0.9 - 6} l 12 12 m 0 -12 l -12 12`} stroke={C.rose} strokeWidth={1.5} fill="none" /></g>)}
        <P d={`M 0 0 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0`} p={sub(p, 0, 0.2)} />
        <T x={x2 * 0.45} y={y2 * 0.2 + 34} p={p}>{(8 + r() * 30).toFixed(1)} m/s</T>
      </g>
    }
    case 5: { // zona rayada con etiqueta
      const w = 240, h = 160
      const lines = Array.from({ length: 14 }, (_, i) => i)
      return <g>
        <P d={`M 0 0 H ${w} V ${h} H 0 Z`} p={sub(p, 0, 0.4)} w={1.5} />
        {lines.map(i => <P key={i} d={`M ${Math.max(0, i * 20 - h)} ${Math.min(h, i * 20)} L ${Math.min(w, i * 20)} ${Math.max(0, i * 20 - w)}`} p={sub(p, 0.3 + i * 0.04, 0.6 + i * 0.04)} w={0.9} />)}
        <T x={0} y={-10} p={p}>ZONA {Math.floor(r() * 18) + 1} · {w / 6 | 0}×{h / 6 | 0} m</T>
        <P d={`M ${w + 14} 0 V ${h} M ${w + 8} 0 H ${w + 20} M ${w + 8} ${h} H ${w + 20}`} p={sub(p, 0.5, 1)} w={1} />
      </g>
    }
    case 6: { // círculo central con radio acotado
      const R = 110
      return <g>
        <P d={`M ${R} 0 A ${R} ${R} 0 1 1 ${-R} 0 A ${R} ${R} 0 1 1 ${R} 0`} p={sub(p, 0, 0.7)} w={1.5} />
        <P d={`M ${-R - 70} 0 H ${R + 70} M 0 ${-R - 40} V ${R + 40}`} p={sub(p, 0.1, 0.5)} w={1} />
        <circle r={4} fill={C.ink2} opacity={sub(p, 0.4, 0.5)} />
        <P d={`M 0 0 L ${R * 0.7} ${-R * 0.7}`} p={sub(p, 0.6, 1)} c={C.rose} w={1.6} />
        <T x={R * 0.38} y={-R * 0.55} p={p} c={C.rose}>R 9.15</T>
      </g>
    }
    default: { // once con líneas entre líneas
      const rows: [number, number][] = [[0, 130], [70, 40], [70, 100], [70, 160], [70, 220], [150, 90], [150, 170], [240, 40], [240, 130], [240, 220], [330, 130]]
      return <g>
        {rows.slice(1).map(([x, y], i) => { const [x0, y0] = rows[Math.max(0, i < 4 ? 0 : i < 6 ? 1 + (i - 4) * 2 : i < 9 ? 5 + ((i - 6) % 2) : 8)]; return <P key={i} d={`M ${x0} ${y0} L ${x} ${y}`} p={sub(p, i / 12, i / 12 + 0.3)} w={0.9} dash="2 5" /> })}
        {rows.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} fill="none" stroke={C.ink2} strokeWidth={1.5} opacity={sub(p, i / 14, i / 14 + 0.12)} />)}
        <T x={0} y={290} p={p}>4-2-3-1</T>
      </g>
    }
  }
}

export function Backdrop({ level = 1 }: { level?: number }) {
  const f = useCurrentFrame()
  if (level < 0.02) return null
  // líneas largas de construcción que cruzan toda la hoja y se dibujan despacio, una tras otra
  const long = [0, 1, 2].map(i => {
    const period = 420, ph = ((f + i * 140) % period) / period
    const a = [[-100, 780, 2000, 120], [300, -80, 1500, 1160], [-100, 300, 2020, 880]][i]
    const p = interpolate(ph, [0, 0.55], [0, 1], { ...clamp, easing: ease }), fade = interpolate(ph, [0.7, 1], [1, 0], clamp)
    return <line key={i} x1={a[0]} y1={a[1]} x2={a[0] + (a[2] - a[0]) * p} y2={a[1] + (a[3] - a[1]) * p} stroke={C.ink2} strokeWidth={0.9} strokeDasharray="14 6 2 6" opacity={0.3 * fade} />
  })
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: level }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {long}
        {ITEMS.filter(it => f >= it.at && f <= it.at + it.life).map(it => {
          const p = interpolate(f, [it.at, it.at + it.draw], [0, 1], { ...clamp, easing: ease })
          const fade = interpolate(f, [it.at + it.life - 70, it.at + it.life], [1, 0], clamp)
          return <g key={it.at} transform={`translate(${it.x} ${it.y}) rotate(${it.rot}) scale(${it.s})`} opacity={0.42 * fade}><Shape it={it} p={p} /></g>
        })}
      </svg>
    </AbsoluteFill>
  )
}
