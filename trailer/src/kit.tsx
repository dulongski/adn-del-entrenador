import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import type { ReactNode } from 'react'
import { C, DISPLAY, MONO, SANS } from './theme'

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
export const ease = Easing.bezier(0.2, 0.7, 0.2, 1)

/* ------------------------------------------------------------ plano: retícula que se dibuja sola */
export function Blueprint({ start = 0, dim = 1 }: { start?: number; dim?: number }) {
  const f = useCurrentFrame(), { width: W, height: H } = useVideoConfig()
  const minor = 24, major = 120
  const lines: { x1: number; y1: number; x2: number; y2: number; maj: boolean; i: number }[] = []
  for (let x = 0, i = 0; x <= W; x += minor, i++) lines.push({ x1: x, y1: 0, x2: x, y2: H, maj: x % major === 0, i })
  for (let y = 0, i = 0; y <= H; y += minor, i++) lines.push({ x1: 0, y1: y, x2: W, y2: y, maj: y % major === 0, i: i + 20 })
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: dim }}>
      {lines.map((l, k) => {
        const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1)
        const p = interpolate(f - start - l.i * 0.35, [0, 26], [0, 1], { ...clamp, easing: ease })
        return <line key={k} {...l} stroke={l.maj ? C.grid2 : C.grid} strokeWidth={l.maj ? 1.2 : 0.7} strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
      })}
    </svg>
  )
}

/* marcas de registro en las esquinas y cajetín de plano abajo a la derecha */
export function PlanFrame({ sheet, start = 0 }: { sheet: string; start?: number }) {
  const f = useCurrentFrame(), { width: W, height: H, fps } = useVideoConfig()
  const o = interpolate(f - start, [10, 30], [0, 1], clamp)
  const mark = (x: number, y: number) => (
    <g key={`${x}${y}`} stroke={C.ink2} strokeWidth={1.4}>
      <line x1={x - 14} y1={y} x2={x + 14} y2={y} /><line x1={x} y1={y - 14} x2={x} y2={y + 14} /><circle cx={x} cy={y} r={6} fill="none" />
    </g>
  )
  const t = f / fps
  return (
    <AbsoluteFill style={{ opacity: o, pointerEvents: 'none' }}>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        {[mark(48, 48), mark(W - 48, 48), mark(48, H - 48), mark(W - 48, H - 48)]}
        <rect x={24} y={24} width={W - 48} height={H - 48} fill="none" stroke={C.grid2} strokeWidth={1.2} />
      </svg>
      <div style={{ position: 'absolute', right: 24, bottom: 24, display: 'grid', gridTemplateColumns: 'auto auto auto', fontFamily: MONO, fontSize: 13, color: C.ink2, border: `1.2px solid ${C.ink2}`, background: C.paper }}>
        {[['PROYECTO', 'COACH DNA'], ['HOJA', sheet], ['T+', `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`]].map(([k, v]) => (
          <div key={k} style={{ padding: '6px 12px', borderLeft: `1.2px solid ${C.ink2}` }}><div style={{ fontSize: 10, opacity: 0.7 }}>{k}</div>{v}</div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 72, bottom: 34, fontFamily: MONO, fontSize: 13, color: C.ink3, letterSpacing: '.08em' }}>LIGA MX · 2021–2027 · 1,780 PARTIDOS · ESC 1:105</div>
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------ máquina de escribir */
export function Type({ text, start, cps = 26, size = 72, color = C.ink, weight = 600, font = SANS, caret = true, hold = 999, style }: {
  text: string; start: number; cps?: number; size?: number; color?: string; weight?: number; font?: string; caret?: boolean; hold?: number; style?: React.CSSProperties
}) {
  const f = useCurrentFrame(), { fps } = useVideoConfig()
  const n = Math.max(0, Math.min(text.length, Math.floor(((f - start) / fps) * cps)))
  const done = n >= text.length
  const doneAt = start + (text.length / cps) * fps
  const blink = Math.floor((f - doneAt) / 15) % 2 === 0
  if (f < start) return null
  return (
    <div style={{ fontFamily: font, fontSize: size, fontWeight: weight, color, letterSpacing: '-0.025em', lineHeight: 1.08, whiteSpace: 'pre-wrap', ...style }}>
      {text.slice(0, n)}
      {caret && (!done || (blink && f < doneAt + hold)) && <span style={{ display: 'inline-block', width: '0.08em', height: '0.95em', background: C.rose, marginLeft: '0.06em', verticalAlign: '-0.12em' }} />}
    </div>
  )
}

/* ------------------------------------------------------------ cancha trazada como plano */
function useDraw(start: number, dur: number) {
  const f = useCurrentFrame()
  return interpolate(f - start, [0, dur], [0, 1], { ...clamp, easing: ease })
}
export function DrawPath({ d, start, dur = 30, color = C.ink, w = 2, dash }: { d: string; start: number; dur?: number; color?: string; w?: number; dash?: string }) {
  const p = useDraw(start, dur)
  return <path d={d} fill="none" stroke={color} strokeWidth={w} pathLength={1} strokeDasharray={dash ? undefined : 1} strokeDashoffset={dash ? undefined : 1 - p} opacity={dash ? p : 1} style={dash ? { strokeDasharray: dash } : undefined} strokeLinecap="round" />
}
/** Cota de plano: línea con topes y medida en el centro. */
export function Dim({ x1, y1, x2, y2, label, start, off = 0 }: { x1: number; y1: number; x2: number; y2: number; label: string; start: number; off?: number }) {
  const p = useDraw(start, 24)
  const vert = x1 === x2
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  return (
    <g opacity={p} stroke={C.ink2} strokeWidth={1.2}>
      <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * p} y2={y1 + (y2 - y1) * p} />
      {vert ? <><line x1={x1 - 8} x2={x1 + 8} y1={y1} y2={y1} /><line x1={x2 - 8} x2={x2 + 8} y1={y2} y2={y2} /></>
        : <><line x1={x1} x2={x1} y1={y1 - 8} y2={y1 + 8} /><line x1={x2} x2={x2} y1={y2 - 8} y2={y2 + 8} /></>}
      <text x={mx + (vert ? 16 : 0)} y={my + (vert ? 0 : -10 + off)} fontFamily={MONO} fontSize={16} fill={C.ink2} stroke="none" textAnchor={vert ? 'start' : 'middle'} dominantBaseline="middle">{label}</text>
    </g>
  )
}
export function Pitch({ x, y, w, start, color = C.ink }: { x: number; y: number; w: number; start: number; color?: string }) {
  const s = w / 105, h = 68 * s
  const X = (m: number) => x + m * s, Y = (m: number) => y + m * s
  const box = (x0: number, dir: 1 | -1, dep: number, wid: number) => `M ${X(x0)} ${Y(34 - wid / 2)} H ${X(x0 + dir * dep)} V ${Y(34 + wid / 2)} H ${X(x0)}`
  return (
    <g>
      <DrawPath d={`M ${X(0)} ${Y(0)} H ${X(105)} V ${Y(68)} H ${X(0)} Z`} start={start} dur={40} color={color} w={2.2} />
      <DrawPath d={`M ${X(52.5)} ${Y(0)} V ${Y(68)}`} start={start + 20} dur={24} color={color} />
      <DrawPath d={`M ${X(52.5) + 9.15 * s} ${Y(34)} A ${9.15 * s} ${9.15 * s} 0 1 1 ${X(52.5) - 9.15 * s} ${Y(34)} A ${9.15 * s} ${9.15 * s} 0 1 1 ${X(52.5) + 9.15 * s} ${Y(34)}`} start={start + 30} dur={30} color={color} />
      <DrawPath d={box(0, 1, 16.5, 40.3)} start={start + 36} dur={24} color={color} />
      <DrawPath d={box(105, -1, 16.5, 40.3)} start={start + 40} dur={24} color={color} />
      <DrawPath d={box(0, 1, 5.5, 18.3)} start={start + 48} dur={18} color={color} />
      <DrawPath d={box(105, -1, 5.5, 18.3)} start={start + 52} dur={18} color={color} />
      <Dim x1={X(0)} y1={Y(68) + 34} x2={X(105)} y2={Y(68) + 34} label="105 m" start={start + 50} off={34} />
      <Dim x1={X(105) + 34} y1={Y(0)} x2={X(105) + 34} y2={Y(68)} label="68 m" start={start + 56} />
      {/* círculo central acotado */}
      <DrawPath d={`M ${X(52.5)} ${Y(34)} L ${X(52.5) + 9.15 * s * 0.7} ${Y(34) - 9.15 * s * 0.7}`} start={start + 64} dur={12} color={C.rose} w={1.4} />
    </g>
  )
}

/* ------------------------------------------------------------ logo (hélice de la app) */
export function Helix({ h = 200, start, acc = C.rose }: { h?: number; start: number; acc?: string }) {
  const f = useCurrentFrame()
  const N = 60, H = 30, W = 14
  const x = (t: number, s: number) => 8 + s * (W / 2) * Math.sin(t * Math.PI * 2 + Math.PI / 2)
  const pts = (s: number) => Array.from({ length: N + 1 }, (_, i) => i / N).map(t => `${x(t, s).toFixed(2)},${(1 + t * H).toFixed(2)}`).join(' ')
  const p = interpolate(f - start, [0, 22], [0, 1], { ...clamp, easing: ease })
  const r = interpolate(f - start, [16, 30], [0, 0.45], clamp)
  return (
    <svg viewBox="0 0 16 32" style={{ height: h, width: h / 2, overflow: 'visible' }}>
      {[0.12, 0.88].map(t => <line key={t} x1={x(t, 1)} x2={x(t, -1)} y1={1 + t * H} y2={1 + t * H} stroke={C.ink} strokeWidth={1.4} strokeLinecap="round" opacity={r} />)}
      <polyline points={pts(1)} fill="none" stroke={C.ink} strokeWidth={2.4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      <polyline points={pts(-1)} fill="none" stroke={acc} strokeWidth={2.4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  )
}
export function Wordmark({ start, size = 150 }: { start: number; size?: number }) {
  const f = useCurrentFrame(), { fps } = useVideoConfig()
  const letters = 'COACH DNA'.split('')
  return (
    <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: size, lineHeight: 1, display: 'flex', letterSpacing: '.01em' }}>
      {letters.map((ch, i) => {
        const s = spring({ frame: f - start - i * 1.6, fps, config: { damping: 200, mass: 0.5 } })
        return <span key={i} style={{ display: 'inline-block', overflow: 'hidden', width: ch === ' ' ? '0.28em' : undefined }}>
          <span style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 110}%)`, color: i >= 6 ? C.rose : C.ink }}>{ch === ' ' ? ' ' : ch}</span>
        </span>
      })}
    </div>
  )
}

/* ------------------------------------------------------------ ventana de navegador + cursor */
export function Browser({ children, url = 'coachdna.app', w = 1600 }: { children: ReactNode; url?: string; w?: number }) {
  const h = w * (1080 / 1920)
  return (
    <div style={{ width: w, borderRadius: 14, overflow: 'hidden', background: C.white, boxShadow: '0 30px 80px rgba(16,32,26,.22), 0 0 0 1.2px rgba(16,32,26,.18)' }}>
      <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: '#EDE8DC', borderBottom: '1px solid #D8D1C0' }}>
        {['#EF4B5F', '#E3B04B', '#1FA97A'].map(c => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
        <span style={{ marginLeft: 18, fontFamily: MONO, fontSize: 15, color: C.ink2, background: C.paper, padding: '4px 14px', borderRadius: 6, flex: '0 1 420px' }}>{url}</span>
      </div>
      <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}
export function Shot({ src, scale = 1, x = 0, y = 0, w = 1600 }: { src: string; scale?: number; x?: number; y?: number; w?: number }) {
  return <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: w, transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${scale})` }} />
}

/** Cursor que sigue fotogramas clave [f, x, y]; los clics dejan una onda. */
export function Cursor({ keys, clicks = [] }: { keys: [number, number, number][]; clicks?: number[] }) {
  const f = useCurrentFrame()
  if (f < keys[0][0]) return null
  const fs = keys.map(k => k[0])
  const x = interpolate(f, fs, keys.map(k => k[1]), { ...clamp, easing: Easing.bezier(0.45, 0, 0.2, 1) })
  const y = interpolate(f, fs, keys.map(k => k[2]), { ...clamp, easing: Easing.bezier(0.45, 0, 0.2, 1) })
  const press = clicks.some(c => f >= c && f < c + 5)
  return (
    <>
      {clicks.map(c => {
        const t = f - c
        if (t < 0 || t > 18) return null
        const k = keys.reduce((a, b) => (Math.abs(b[0] - c) < Math.abs(a[0] - c) ? b : a))
        return <div key={c} style={{ position: 'absolute', left: k[1] - 30, top: k[2] - 30, width: 60, height: 60, borderRadius: 30, border: `2.5px solid ${C.rose}`, opacity: 1 - t / 18, transform: `scale(${0.3 + t / 14})` }} />
      })}
      <svg width={34} height={40} viewBox="0 0 17 20" style={{ position: 'absolute', left: x - 3, top: y - 2, transform: `scale(${press ? 0.86 : 1})`, transformOrigin: '3px 2px', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.3))' }}>
        <path d="M1 1 L1 16 L5 12.5 L8 19 L10.6 17.8 L7.7 11.6 L13 11.6 Z" fill={C.ink} stroke={C.white} strokeWidth={1.3} strokeLinejoin="round" />
      </svg>
    </>
  )
}

/* llamada de plano: punto + línea guía + etiqueta mono */
export function Callout({ x, y, dx, dy, label, start }: { x: number; y: number; dx: number; dy: number; label: string; start: number }) {
  const f = useCurrentFrame()
  const p = interpolate(f - start, [0, 14], [0, 1], { ...clamp, easing: ease })
  const o = interpolate(f - start, [10, 20], [0, 1], clamp)
  return (
    <>
      <svg style={{ position: 'absolute', inset: 0, overflow: 'visible' }} width={1} height={1}>
        <circle cx={x} cy={y} r={5} fill={C.rose} opacity={p} />
        <polyline points={`${x},${y} ${x + dx * p},${y + dy * p} ${x + dx * p + (dx > 0 ? 40 : -40) * p},${y + dy * p}`} fill="none" stroke={C.ink2} strokeWidth={1.3} />
      </svg>
      <div style={{ position: 'absolute', left: dx > 0 ? x + dx + 48 : undefined, right: dx > 0 ? undefined : 1920 - (x + dx - 48), top: y + dy - 11, fontFamily: MONO, fontSize: 17, color: C.ink, opacity: o, whiteSpace: 'nowrap', background: C.paper, padding: '0 6px' }}>{label}</div>
    </>
  )
}
