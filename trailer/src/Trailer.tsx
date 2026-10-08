import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import data from './data.json'
import { BODY, C, DISPLAY, FAM } from './theme'

const ALMADA = 2947
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/* ------------------------------------------------------------ piezas */
function Word({ children, delay, color = C.ink, size = 150, under }: { children: string; delay: number; color?: string; size?: number; under?: string }) {
  const f = useCurrentFrame(), { fps } = useVideoConfig()
  const s = spring({ frame: f - delay, fps, config: { damping: 200, mass: 0.6 } })
  const u = spring({ frame: f - delay - 8, fps, config: { damping: 200 } })
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', padding: '0.16em 0.04em 0', marginRight: '0.18em', fontSize: size }}>
      <span style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 115}%)`, color, position: 'relative' }}>
        {under && <span style={{ position: 'absolute', left: '4%', right: '4%', bottom: '10%', height: '28%', background: under, transform: `scaleX(${u})`, transformOrigin: 'left', zIndex: 0 }} />}
        <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
      </span>
    </span>
  )
}

function Tag({ text, delay = 0 }: { text: string; delay?: number }) {
  const f = useCurrentFrame()
  const o = interpolate(f - delay, [0, 12], [0, 1], clamp)
  return <div style={{ position: 'absolute', top: 64, left: 80, fontFamily: BODY, fontWeight: 700, fontSize: 22, letterSpacing: '.14em', textTransform: 'uppercase', color: C.ink2, opacity: o, display: 'flex', alignItems: 'center', gap: 14 }}>
    <span style={{ width: 14, height: 14, borderRadius: 7, background: C.rose }} />{text}
  </div>
}

/* barrido de transición: un panel menta cruza la pantalla */
function Wipe({ at, color = C.mint }: { at: number; color?: string }) {
  const f = useCurrentFrame()
  const x = interpolate(f - at, [0, 10, 20], [-100, 0, 100], { ...clamp, easing: Easing.inOut(Easing.cubic) })
  if (f < at || f > at + 20) return null
  return <AbsoluteFill style={{ background: color, transform: `translateX(${x}%)` }} />
}

/* ------------------------------------------------------------ 1. pregunta */
function Pregunta() {
  const f = useCurrentFrame()
  const swap = 62
  const out = interpolate(f, [swap - 6, swap], [1, 0], clamp)
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: DISPLAY, fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.92, justifyContent: 'center', padding: '0 140px' }}>
      <Tag text="ADN del Entrenador · Liga MX" />
      {f < swap ? (
        <div style={{ opacity: out }}>
          <div><Word delay={4}>¿Cuánto</Word> <Word delay={8}>del</Word> <Word delay={12}>estilo</Word></div>
          <div><Word delay={18}>es</Word> <Word delay={22}>del</Word> <Word delay={26} color={C.rose}>DT…</Word></div>
        </div>
      ) : (
        <div>
          <div><Word delay={swap + 2}>…y</Word> <Word delay={swap + 6}>cuánto</Word> <Word delay={swap + 10}>de</Word> <Word delay={swap + 14}>sus</Word></div>
          <div><Word delay={swap + 20} under={C.mint}>jugadores?</Word></div>
        </div>
      )}
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------ 2. mapa de estilos */
type P = (typeof data.puntos)[number]
function Mapa() {
  const f = useCurrentFrame(), { fps, width, height } = useVideoConfig()
  const P: P[] = data.puntos
  const xs = P.map(p => p.x), ys = P.map(p => p.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  // compresión suave de extremos (como en la app) para que nadie quede pegado al borde
  const sx = (v: number) => Math.asinh((v - (x0 + x1) / 2) / ((x1 - x0) / 5)), sy = (v: number) => Math.asinh((v - (y0 + y1) / 2) / ((y1 - y0) / 5))
  const mx = Math.max(...P.map(p => Math.abs(sx(p.x)))), my = Math.max(...P.map(p => Math.abs(sy(p.y))))
  const pos = (p: P) => ({ x: width / 2 + (sx(p.x) / mx) * 760, y: height / 2 + 30 - (sy(p.y) / my) * 380 })
  const focus = 95                                   // fotograma en que se resalta a Almada
  const z = spring({ frame: f - focus, fps, config: { damping: 200, mass: 1.4 } })
  const A = pos(P.find(p => p.id === ALMADA)!)
  const k = 1 + z * 0.9
  const TX = width * 0.4, TY = height * 0.52
  const tx = (TX - width / 2 - (A.x - width / 2) * k) * z, ty = (TY - height / 2 - (A.y - height / 2) * k) * z
  const cam = `translate(${tx}px, ${ty}px) scale(${k})`
  const AS = { x: width / 2 + (A.x - width / 2) * k + tx, y: height / 2 + (A.y - height / 2) * k + ty }
  const groups = data.grupos.map(g => {
    const ps = P.filter(p => p.g === g.id).map(pos)
    return { ...g, x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length }
  })
  const capO = interpolate(f, [20, 34], [0, 1], clamp)
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: cam, transformOrigin: `${width / 2}px ${height / 2}px` }}>
        {groups.map(g => {
          const o = interpolate(f, [30, 60], [0, 0.55], clamp) * (1 - z * 0.5)
          return <div key={g.id} style={{ position: 'absolute', left: g.x - 360, top: g.y - 300, width: 720, height: 600, borderRadius: '50%', opacity: o,
            background: `radial-gradient(closest-side, ${FAM[g.id % 4]}66, ${FAM[g.id % 4]}22 60%, transparent)` }} />
        })}
        {P.map((p, i) => {
          const t = pos(p)
          const s = spring({ frame: f - 4 - (i % 25) * 1.2, fps, config: { damping: 18, mass: 0.7 } })
          const ang = i * 2.399, r0 = 40 + (i % 7) * 12
          const x = width / 2 + Math.cos(ang) * r0 + (t.x - width / 2 - Math.cos(ang) * r0) * s
          const y = height / 2 + Math.sin(ang) * r0 + (t.y - height / 2 - Math.sin(ang) * r0) * s
          const isA = p.id === ALMADA
          const R = isA ? 44 + 18 * z : 30
          const dim = isA ? 1 : 1 - z * 0.75
          return (
            <div key={p.id} style={{ position: 'absolute', left: x - R, top: y - R, width: R * 2, height: R * 2, borderRadius: '50%', overflow: 'hidden', opacity: dim * Math.min(1, s * 1.4),
              boxShadow: `0 0 0 ${isA ? 5 : 3}px ${isA && z > 0.05 ? C.rose : FAM[p.g % 4]}, 0 6px 16px rgba(16,32,26,.18)`, background: C.white, filter: isA ? 'none' : `grayscale(${z})` }}>
              {p.foto && <Img src={staticFile(p.foto)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }} />}
            </div>
          )
        })}
      </AbsoluteFill>
      {z > 0.02 && (
        <div style={{ position: 'absolute', left: AS.x + 120, top: AS.y - 110, opacity: z, fontFamily: DISPLAY, fontWeight: 900, textTransform: 'uppercase', color: C.ink, lineHeight: 0.88 }}>
          <div style={{ fontSize: 34, color: C.rose, letterSpacing: '.08em', marginBottom: 8 }}>América · 167 partidos</div>
          <div style={{ fontSize: 120 }}>Guillermo<br />Almada</div>
        </div>
      )}
      <div style={{ position: 'absolute', right: 80, top: 56, textAlign: 'right', opacity: capO * (1 - z), fontFamily: BODY, fontSize: 30, color: C.ink, maxWidth: 640, lineHeight: 1.25, background: `${C.paper}E6`, padding: '10px 0 10px 20px' }}>
        <b style={{ fontFamily: DISPLAY, fontSize: 72, textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>76 entrenadores</b>
        Cerca = ideas de juego parecidas, ya descontada su plantilla.
      </div>
      <Tag text="Mapa de estilos" />
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------ 3. la campana */
function Campana() {
  const f = useCurrentFrame(), { fps } = useVideoConfig()
  const K = data.dist.conduccion_prog as { a: Record<string, number>; etiqueta: string }
  const vals = Object.entries(K.a).map(([id, v]) => ({ id: Number(id), v }))
  const W = 1080, X0 = 720, mid = 640
  const lo = Math.min(...vals.map(o => o.v)) - 0.15, hi = Math.max(...vals.map(o => o.v)) + 0.15
  const X = (v: number) => X0 + ((v - lo) / (hi - lo)) * W
  // enjambre determinista
  const r = 13, placed: { x: number; y: number }[] = []
  const dots = [...vals].sort((a, b) => a.v - b.v).map(o => {
    const x = X(o.v); let y = mid
    for (let k = 0; k < 40; k++) { const off = Math.ceil(k / 2) * r * 1.9 * (k % 2 ? -1 : 1); y = mid + off; if (!placed.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < (2 * r) ** 2 * 0.95)) break }
    placed.push({ x, y }); return { ...o, x, y }
  })
  const bellO = interpolate(f, [8, 30], [0, 1], clamp)
  const aDrop = spring({ frame: f - 62, fps, config: { damping: 12, mass: 0.8 } })
  const head = (d: number) => spring({ frame: f - d, fps, config: { damping: 200 } })
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Tag text="Su sello" />
      <div style={{ position: 'absolute', left: 80, top: 0, bottom: 0, width: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 900, textTransform: 'uppercase', color: C.ink, fontSize: 132, lineHeight: 0.9 }}>
        <div style={{ transform: `translateY(${(1 - head(4)) * 40}px)`, opacity: head(4) }}>Su sello,</div>
        <div style={{ transform: `translateY(${(1 - head(12)) * 40}px)`, opacity: head(12), color: C.mintDeep }}>sin su</div>
        <div style={{ transform: `translateY(${(1 - head(20)) * 40}px)`, opacity: head(20), color: C.mintDeep }}>plantilla.</div>
      </div>
      <div style={{ position: 'absolute', left: X0, top: 360, fontFamily: BODY, fontWeight: 700, fontSize: 30, color: C.ink2, opacity: bellO }}>Avanzar con el balón en los pies · 76 DTs de Liga MX</div>
      <div style={{ position: 'absolute', left: X0, top: 800, width: W, display: 'flex', justifyContent: 'space-between', fontFamily: BODY, fontSize: 24, color: C.ink2, opacity: bellO }}><span>← menos</span><span>más →</span></div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <line x1={X0} x2={X0 + W} y1={mid} y2={mid} stroke={C.line} strokeWidth={2} opacity={bellO} />
        {dots.filter(d => d.id !== ALMADA).map((d, i) => {
          const s = spring({ frame: f - 10 - i * 0.55, fps, config: { damping: 14, mass: 0.6 } })
          return <circle key={d.id} cx={d.x} cy={d.y - (1 - s) * 260} r={r - 1} fill={C.ink} opacity={0.18 + 0.2 * s} />
        })}
        {(() => {
          const d = dots.find(o => o.id === ALMADA)!
          const y = d.y - (1 - aDrop) * 420
          return f > 58 && <g>
            <line x1={d.x} x2={d.x} y1={y - 120} y2={y - r - 6} stroke={C.rose} strokeWidth={4} opacity={aDrop} />
            <circle cx={d.x} cy={y} r={r + 9} fill={C.rose} stroke={C.paper} strokeWidth={5} />
          </g>
        })()}
      </svg>
      {(() => {
        const d = dots.find(o => o.id === ALMADA)!
        const o = interpolate(f, [70, 82], [0, 1], clamp)
        return <div style={{ position: 'absolute', left: d.x - 420, top: d.y - 230, width: 420, textAlign: 'right', opacity: o, fontFamily: DISPLAY, fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.9 }}>
          <div style={{ fontSize: 40, color: C.rose }}>Almada</div>
          <div style={{ fontSize: 76, color: C.ink }}>Nº 1 de 76</div>
        </div>
      })()}
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------ montaje */
export const Trailer = () => (
  <AbsoluteFill style={{ background: C.paper }}>
    <Sequence durationInFrames={120}><Pregunta /></Sequence>
    <Sequence from={120} durationInFrames={180}><Mapa /></Sequence>
    <Sequence from={300} durationInFrames={150}><Campana /></Sequence>
    <Wipe at={112} />
    <Wipe at={292} color={C.rose} />
  </AbsoluteFill>
)
