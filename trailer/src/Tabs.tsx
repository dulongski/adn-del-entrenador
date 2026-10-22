import { AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Browser, Cursor, Sfx, Shot, clamp, ease } from './kit'
import { C, DISPLAY, MONO, SANS, TABS, TAB_DURS, inkOn } from './theme'
import { VIZ, V0, VH, VW } from './Viz'

/* ============================================================ montaje de pestañas: cada modo de la app con su color
   clic en la pestaña → anillo que crece con el nombre en contorno → relleno de color con letras del color contrario
   → el color se disuelve despacio y deja ver la app (ventana) junto a una visualización de lo que hay en esa pestaña.
   Todo suave: cada paso dura entre 1 y 1.3 s y arranca antes de que termine el anterior. */

const slow = Easing.bezier(0.65, 0, 0.35, 1)                      // entrada y salida lentas
const WW = 900, WK = WW / 1920, WY = 300                          // ventana de la app: 900 px de ancho, sobre la hoja
const NAV = 91
/* las pestañas pares llevan la ventana a la izquierda y la visualización a la derecha; las impares, al revés */
const side = (i: number) => (i % 2 === 0 ? { wx: 150, vx: 1130 } : { wx: 870, vx: 150 })
export const pillAt = (i: number, tabX: number): [number, number] => [side(i).wx + tabX * WK, WY + 40 + 30 * WK]
const PLAN: Record<string, { s: number; z?: number }> = {
  resumen: { s: 520 }, dt: { s: 700 }, fases: { s: 900 }, jugadores: { s: 520 },
  bp: { s: 0, z: 1.08 }, sim: { s: 200, z: 1.05 }, vs: { s: 520 }, metodo: { s: 420 },
}

/** Ventana de la app + visualización. `t` puede pasar de la duración de la pestaña (queda congelada en su estado final). */
function Layout({ i, t }: { i: number; t: number }) {
  const T = TABS[i], P = PLAN[T.k], { wx, vx } = side(i), Viz = VIZ[T.k]
  const appear = interpolate(t, [58, 100], [0, 1], { ...clamp, easing: slow })
  const vizIn = interpolate(t, [V0 - 22, V0 + 2], [0, 1], { ...clamp, easing: ease })
  const scroll = interpolate(t, [V0 + 4, V0 + 70], [0, -P.s * WK], { ...clamp, easing: slow })
  const zoom = interpolate(t, [V0, V0 + 80], [1.0, P.z ?? 1.0], { ...clamp, easing: slow })
  const tint = interpolate(t, [66, 150], [0.8, 0], { ...clamp, easing: slow })
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 150, top: 132, opacity: appear, transform: `translateY(${(1 - appear) * 16}px)` }}>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '.14em', color: T.color }}>● {String(i + 1).padStart(2, '0')} / {String(TABS.length).padStart(2, '0')} · {T.name.toUpperCase()}</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 48, letterSpacing: '-.03em', color: C.ink, marginTop: 10 }}>{T.q}</div>
      </div>
      <div style={{ position: 'absolute', left: wx, top: WY + (1 - appear) * 36, opacity: appear, transformOrigin: '50% 45%', transform: `scale(${zoom})` }}>
        <Browser w={WW} url={`coachdna.app/#2947/${T.k}`}>
          <div style={{ position: 'absolute', inset: 0, transform: `translateY(${scroll}px)` }}><Shot src={`app/tab-${T.k}.png`} w={WW} /></div>
          {/* la barra de pestañas de la app es fija: se queda arriba aunque la página baje */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: WW, height: NAV * WK, overflow: 'hidden', background: C.paper, boxShadow: scroll < -2 ? '0 6px 14px rgba(16,32,26,.1)' : undefined }}><Shot src={`app/tab-${T.k}.png`} w={WW} /></div>
          <div style={{ position: 'absolute', inset: 0, background: T.color, opacity: tint, mixBlendMode: 'multiply' }} />
          <div style={{ position: 'absolute', inset: 0, background: T.color, opacity: tint * 0.45 }} />
        </Browser>
      </div>
      <div style={{ position: 'absolute', left: vx, top: WY, opacity: vizIn, transform: `translateY(${(1 - vizIn) * 24}px)`, width: VW, height: VH }}>
        <Viz t={t} color={T.color} />
      </div>
    </AbsoluteFill>
  )
}

/** Tarjeta de color: anillo + nombre en contorno, relleno con letras del color contrario, disolución lenta. */
function ColorCard({ i, t, from }: { i: number; t: number; from: [number, number] }) {
  const T = TABS[i], R = Math.hypot(1920, 1080), fg = inkOn(T.color)
  const ring = interpolate(t, [0, 36], [0, R * 0.55], { ...clamp, easing: slow })
  const fill = interpolate(t, [26, 70], [0, R], { ...clamp, easing: slow })
  const draw = interpolate(t, [6, 46], [0, 1], { ...clamp, easing: slow })
  const out = interpolate(t, [78, 118], [0, 1], { ...clamp, easing: slow })
  if (t > 120) return null
  const filled = t >= 38
  return (
    <AbsoluteFill style={{ opacity: 1 - out, transform: `scale(${1 + out * 0.08})`, filter: `blur(${out * 10}px)` }}>
      <div style={{ position: 'absolute', inset: 0, background: C.paper, clipPath: `circle(${ring * 1.8}px at ${from[0]}px ${from[1]}px)`, opacity: 0.94 }} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={from[0]} cy={from[1]} r={ring * 1.8} fill="none" stroke={T.color} strokeWidth={4} opacity={1 - interpolate(t, [40, 60], [0, 1], clamp)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: T.color, clipPath: `circle(${fill}px at 960px 540px)` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: '.16em', color: filled ? fg : T.color, opacity: interpolate(t, [14, 34], [0, 1], clamp), marginBottom: 18 }}>
          {String(i + 1).padStart(2, '0')} / {String(TABS.length).padStart(2, '0')}
        </div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 210, lineHeight: 0.9, letterSpacing: '.01em',
          color: filled ? fg : 'transparent', WebkitTextStroke: filled ? '0px' : `3px ${T.color}`,
          clipPath: draw < 1 ? `inset(-45% ${(1 - draw) * 100}% -25% -3%)` : undefined }}>{T.name.toUpperCase()}</div>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, color: filled ? fg : C.ink2, marginTop: 26, opacity: interpolate(t, [36, 56], [0, 1], clamp) }}>{T.q}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function TabScene({ i, seg, prevSeg }: { i: number; seg: number; prevSeg: number }) {
  const t = useCurrentFrame()
  const from: [number, number] = i === 0 ? [960, 540] : pillAt(i - 1, TABS[i].x)
  const next = TABS[i + 1]
  return (
    <AbsoluteFill>
      {i > 0 && t < 70 && <Layout i={i - 1} t={prevSeg + t} />}
      {t >= 40 && <Layout i={i} t={t} />}
      <ColorCard i={i} t={t} from={from} />
      {/* un solo clic por cambio de pestaña: el cursor viaja hasta la pestaña siguiente en la barra de la app */}
      {next && t > seg - 56 && <Cursor keys={[[seg - 52, side(i).wx + 420, WY + 360], [seg - 10, ...pillAt(i, next.x)], [seg + 6, ...pillAt(i, next.x)]]} clicks={[]} />}
      {i > 0 && t < 22 && <div style={{ position: 'absolute', left: from[0] - 30, top: from[1] - 30, width: 60, height: 60, borderRadius: 30, border: `2.5px solid ${TABS[i].color}`, opacity: 1 - t / 22, transform: `scale(${0.3 + t / 16})` }} />}
      {next && <Sfx at={seg - 8} src="click" vol={0.55} dur={6} />}
      {/* el cursor del clic sólo vive un instante: se queda en la pestaña pulsada y se desvanece (antes se quedaba pegado sobre el título) */}
      {i > 0 && t < 26 && <div style={{ position: 'absolute', inset: 0, opacity: interpolate(t, [12, 26], [1, 0], clamp) }}><Cursor keys={[[0, ...from], [26, ...from]]} clicks={[]} /></div>}
      <Sfx at={4} src="rise" vol={0.16} dur={22} />
      <Sfx at={38} src="thud" vol={0.5} dur={24} />
      <Sfx at={40} src={`note${i}`} vol={0.32} dur={42} />
      <Sfx at={84} src={`pop${(i + 2) % 8}`} vol={0.16} dur={14} />
    </AbsoluteFill>
  )
}

export function TabMontage() {
  let at = 0
  return (
    <AbsoluteFill>
      {TABS.map((_, i) => {
        const from = at; at += TAB_DURS[i]
        return (
          <Sequence key={i} from={from} durationInFrames={TAB_DURS[i]} layout="none">
            <TabScene i={i} seg={TAB_DURS[i]} prevSeg={TAB_DURS[Math.max(0, i - 1)]} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

/* ============================================================ todo junto: mosaico de las ocho pestañas */
export function TabGrid() {
  const f = useCurrentFrame(), { durationInFrames: D } = useVideoConfig()
  const tw = 400, th = 225, gap = 28, cols = 4
  const gx = (1920 - cols * tw - (cols - 1) * gap) / 2, gy = 300
  const exit = interpolate(f, [D - 24, D], [0, 1], { ...clamp, easing: slow })
  return (
    <AbsoluteFill style={{ opacity: 1 - exit, filter: `blur(${exit * 8}px)` }}>
      <div style={{ position: 'absolute', left: gx, top: 168, fontFamily: SANS, fontWeight: 700, fontSize: 64, letterSpacing: '-.03em', color: C.ink, opacity: interpolate(f, [80, 102], [0, 1], clamp), transform: `translateY(${interpolate(f, [80, 102], [12, 0], clamp)}px)` }}>
        Ocho preguntas. Un solo DT.
      </div>
      {TABS.map((T, k) => {
        const a = 8 + k * 8
        const o = interpolate(f, [a, a + 16], [0, 1], { ...clamp, easing: slow })                 // contorno
        const img = interpolate(f, [a + 18, a + 38], [0, 1], { ...clamp, easing: slow })          // se llena con la pantalla
        const x = gx + (k % cols) * (tw + gap), y = gy + Math.floor(k / cols) * (th + 70)
        const drift = interpolate(f, [0, D], [0, -14])
        return (
          <div key={k} style={{ position: 'absolute', left: x, top: y + drift + (1 - o) * 30, width: tw, opacity: o }}>
            <div style={{ position: 'relative', width: tw, height: th, borderRadius: 10, overflow: 'hidden', border: `3px solid ${T.color}`, background: C.paper }}>
              <Img src={staticFile(`app/tab-${T.k}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: tw, opacity: img, transform: `scale(${1.08 - img * 0.08})`, transformOrigin: '50% 0' }} />
              <div style={{ position: 'absolute', inset: 0, background: T.color, opacity: (1 - img) * 0.9 + 0.08 }} />
            </div>
            <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 17, letterSpacing: '.1em', color: T.color }}><span>●</span> <span style={{ color: C.ink }}>{T.name.toUpperCase()}</span></div>
          </div>
        )
      })}
      {TABS.map((_, k) => <Sfx key={k} at={8 + k * 8} src={`pop${k}`} vol={0.3} dur={16} />)}
      <Sfx at={80} src="note4" vol={0.3} dur={42} />
    </AbsoluteFill>
  )
}
