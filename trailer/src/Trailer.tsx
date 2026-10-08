import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Blueprint, Browser, Callout, Cursor, Helix, PlanFrame, Pitch, Shot, Type, Wordmark, clamp, ease } from './kit'
import { C, DROP, FPS, MONO, MUSIC_START_S, beat } from './theme'

/* ============================================================ 1 · intro sobre la parte tranquila de la canción */
function Intro() {
  const f = useCurrentFrame()
  const out1 = interpolate(f, [222, 236], [1, 0], clamp)
  const pitchO = interpolate(f, [330, 352], [1, 0.25], clamp)
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: pitchO }}>
        <Pitch x={1010} y={300} w={760} start={70} />
      </svg>
      <div style={{ position: 'absolute', left: 140, top: 330, width: 820, opacity: out1 }}>
        <Type text="Cada entrenador tiene una idea de juego." start={24} size={64} />
        <div style={{ height: 26 }} />
        <Type text="Pero en la cancha nunca juega solo." start={118} size={64} color={C.ink2} />
      </div>
      <div style={{ position: 'absolute', left: 140, top: 380, width: 900 }}>
        <Type text={'¿Cuánto del estilo\nes suyo?'} start={240} size={118} cps={20} weight={700} />
      </div>
      <div style={{ position: 'absolute', left: 140, top: 250, fontFamily: MONO, fontSize: 18, color: C.rose, letterSpacing: '.12em', opacity: interpolate(f, [236, 248], [0, 1], clamp) }}>
        01 — LA PREGUNTA
      </div>
    </AbsoluteFill>
  )
}

/* ============================================================ 2 · logo en el drop */
function Logo() {
  const f = useCurrentFrame(), { fps } = useVideoConfig()
  const pulse = interpolate(f, [0, 22], [0, 1], { ...clamp, easing: ease })
  const s = spring({ frame: f, fps, config: { damping: 200 } })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', width: 1400 * pulse, height: 1400 * pulse, borderRadius: '50%', border: `1.5px solid ${C.rose}`, opacity: 1 - pulse }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 34, transform: `scale(${0.94 + 0.06 * s})` }}>
        <Helix h={190} start={0} />
        <Wordmark start={4} size={180} />
      </div>
      <div style={{ position: 'absolute', top: 690 }}>
        <Type text="El estilo del DT, separado de su plantilla." start={26} size={30} font={MONO} weight={400} color={C.ink2} cps={40} />
      </div>
    </AbsoluteFill>
  )
}

/* ============================================================ 3 · la app: buscar, abrir, entrar */
const WIN = { x: 220, y: 112, w: 1480 }                 // ventana; la página de 1920 px se ve a 1600 px
const K = WIN.w / 1920
const toScreen = (cx: number, cy: number): [number, number] => [WIN.x + cx * K, WIN.y + 40 + cy * K]

function App() {
  const f = useCurrentFrame(), { fps } = useVideoConfig()
  const o = (a: number) => a - beat(6)                  // fotograma global → local de esta secuencia
  const rise = spring({ frame: f, fps, config: { damping: 200, mass: 0.9 } })
  // tecleo "almada": se revela la captura real letra por letra
  const typed = Math.max(0, Math.min(6, Math.floor((f - o(536)) / 5)))
  const reveal = typed / 6
  const dropdown = f >= o(beat(14))
  const hub = f >= o(beat(18))
  // cámara: acercamiento al resultado, corte al menú del DT y acercamiento a la tarjeta
  const zIn = interpolate(f, [o(beat(16)) + 4, o(beat(18))], [0, 1], { ...clamp, easing: ease })
  const zOut = interpolate(f, [o(beat(18)), o(beat(18)) + 22], [1, 0], { ...clamp, easing: ease })
  const zCard = interpolate(f, [o(beat(22)) + 3, o(beat(26))], [0, 1], { ...clamp, easing: ease })
  const [rx, ry] = toScreen(830, 100), [cx, cy] = toScreen(1214, 259)
  const k = hub ? 1 + zOut * 1.6 + zCard * 2.2 : 1 + zIn * 2.6
  const [fx, fy] = hub ? [cx, cy] : [rx, ry]
  const fade = interpolate(f, [o(beat(25)), o(beat(26))], [1, 0], clamp)
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: `${fx}px ${fy}px`, transform: `scale(${k})` }}>
        <div style={{ position: 'absolute', left: WIN.x, top: WIN.y + (1 - rise) * 700, opacity: rise }}>
          <Browser w={WIN.w} url={hub ? 'coachdna.app/#2947' : 'coachdna.app'}>
            {!hub ? (
              <>
                <Shot src="app/map.png" w={WIN.w} />
                {f >= o(530) && (() => {
                  // caja de búsqueda real (con "almada") + un parche vacío de la misma caja que tapa las letras aún no tecleadas
                  const TX0 = 723, TX1 = 794, BL = 712, BR = 1236, BT = 22, BB = 64, H = WIN.w * 0.5625
                  const px = TX0 + (TX1 - TX0) * reveal
                  return <>
                    <div style={{ position: 'absolute', inset: 0, clipPath: `inset(${BT * K}px ${WIN.w - BR * K}px ${H - BB * K}px ${BL * K}px)` }}><Shot src="app/map-search.png" w={WIN.w} /></div>
                    {reveal < 1 && <div style={{ position: 'absolute', left: px * K, top: (BT + 7) * K, width: (TX1 + 4 - px) * K, height: (BB - BT - 14) * K, overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: -1000 * K, top: -(BT + 7) * K }}><Shot src="app/map-search.png" w={WIN.w} /></div>
                    </div>}
                  </>
                })()}
                {dropdown && <div style={{ position: 'absolute', inset: 0, opacity: interpolate(f, [o(beat(14)), o(beat(14)) + 6], [0, 1], clamp) }}><Shot src="app/map-search.png" w={WIN.w} /></div>}
              </>
            ) : <Shot src="app/hub-cards.png" w={WIN.w} />}
          </Browser>
        </div>
        <Cursor
          keys={hub
            ? [[o(beat(18)) + 18, 1500, 900], [o(beat(21)), cx, cy], [o(beat(26)), cx, cy]]
            : [[o(500), 1700, 1000], [o(528), ...toScreen(760, 44)], [o(beat(14)) + 4, ...toScreen(760, 44)], [o(beat(16)) - 2, rx, ry], [o(beat(18)), rx, ry]]}
          clicks={hub ? [o(beat(22))] : [o(532), o(beat(16))]}
        />
      </div>
      {!hub && f < o(beat(14)) && <>
        <Callout x={WIN.x + 330} y={WIN.y + 330} dx={-150} dy={-(WIN.y + 330 - 66)} label="76 DTS · LIGA MX 2021–27" start={30} />
        <Callout x={WIN.x + WIN.w - 22} y={WIN.y + 420} dx={-20} dy={-(WIN.y + 420 - 66)} label="DOS EJES · 48% DE LA VARIACIÓN" start={44} />
        <Callout x={WIN.x + 640} y={WIN.y + 64} dx={60} dy={-(WIN.y + 64 - 66)} label="BUSCA POR DT O CLUB" start={o(520)} />
      </>}
    </AbsoluteFill>
  )
}

/* ============================================================ montaje */
export const Trailer = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Audio src={staticFile('music/minimal-electronica.mp3')} startFrom={Math.round(MUSIC_START_S * FPS)}
        volume={v => interpolate(v, [0, 20, 760, 780], [0, 0.9, 0.9, 0], clamp)} />
      <Blueprint start={0} dim={f > DROP && f < beat(6) ? 0.6 : 1} />
      <Sequence durationInFrames={DROP}><Intro /></Sequence>
      <Sequence from={DROP} durationInFrames={beat(6) - DROP}><Logo /></Sequence>
      <Sequence from={beat(6)}><App /></Sequence>
      <PlanFrame sheet={f < DROP ? '01 / 06' : f < beat(6) ? '02 / 06' : '03 / 06'} start={0} />
    </AbsoluteFill>
  )
}
