import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Blueprint, Helix, PlanFrame, Type, Wordmark, clamp, ease } from './kit'
import { C, FPS, MONO, SANS } from './theme'

/* Video de demostración (entrega ISAC): intro con el logo → tu cara → la app con tu cámara en la esquina →
   tu cara → outro. Tiempos en segundos de la voz (toma 2, public/demo/voz.wav); la pantalla sale de la
   grabación del 21 oct (public/demo/pantalla.mp4), cortada a lo que dice la voz en cada momento. */

export const INTRO = Math.round(5.5 * FPS)
export const VOZ = 329.1
export const OUTRO = Math.round(6 * FPS)
export const DEMO_TOTAL = INTRO + Math.round(VOZ * FPS) + OUTRO

const PANT_DESDE = 32.0          // fin de la intro hablada
const PANT_HASTA = 307.6         // empieza «A modo de cierre»

/* [voz desde, voz hasta, pantalla desde, pantalla hasta] */
const CORTES: [number, number, number, number][] = [
  // método
  [32, 65, 2, 35],
  // mapa de estilos
  [65, 82, 88, 107],
  // Almada: perfil y resumen
  [82, 88, 124, 130], [88, 109, 132, 153],
  // ¿DT o plantilla?
  [109, 133, 190, 214],
  // cómo juega
  [133, 147, 218, 232], [147, 155, 238, 246], [155, 161, 259, 265],
  // jugadores
  [161, 177, 284, 300], [177, 188, 305, 316],
  // balón parado
  [188, 213, 322, 347],
  // laboratorio
  [213, 229, 366, 382], [229, 238, 380, 389], [238, 244, 411, 417], [244, 251, 442, 449],
  // cara a cara
  [251, 263, 462, 474], [263, 273, 496, 506], [273, 286, 510, 523],
  // Golito
  [286, 292, 564, 570], [292, 299.6, 584, 591.6], [299.6, 307.6, 618, 626],
]

/* referencias como pie de página mientras se mencionan */
const REFS: [number, number, string][] = [
  [32, 46, 'Abowd, Kramarz y Margolis (1999). High wage workers and high wage firms. Econometrica.'],
  [40, 53, 'Muehlheusser, Schneemann, Sliwka y Wallmeier (2018). The contribution of managers to organizational success: evidence from German soccer. Journal of Sports Economics.'],
  [53, 65, 'Sill (2010). Improved NBA adjusted +/- using regularization. MIT Sloan Sports Analytics Conference.'],
]

/* nombre de la sección en pantalla */
const SECCIONES: [number, string][] = [
  [32, 'Método'], [65, 'Mapa de estilos'], [82, 'Su ADN'], [109, '¿DT o plantilla?'], [133, 'Cómo juega'], [161, 'Jugadores'],
  [188, 'Balón parado'], [213, 'Laboratorio'], [251, 'Cara a cara'], [286, 'Golito, asistente con IA'],
]

const K = 1920 / 1810                         // escala de la app recortada al ancho del video
const APP_H = Math.round(877 * K)              // ≈ 930 px
const APP_TOP = Math.round((1080 - APP_H) / 2)
const MUSIC_GAIN = 0.67                        // iguala el volumen percibido al de la v1
const fr = (s: number) => Math.round(s * FPS)
const XF = 8                    // fundido entre cortes (fotogramas)

function Logo({ sub, sub2 }: { sub: string; sub2?: string }) {
  const f = useCurrentFrame(), { fps } = useVideoConfig()
  const pulse = interpolate(f, [8, 32], [0, 1], { ...clamp, easing: ease })
  const s = spring({ frame: f - 8, fps, config: { damping: 200 } })
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Blueprint start={0} />
      <PlanFrame sheet="DEMO" start={0} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'absolute', width: 1400 * pulse, height: 1400 * pulse, borderRadius: '50%', border: `1.5px solid ${C.rose}`, opacity: 1 - pulse }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 34, transform: `scale(${0.94 + 0.06 * s})` }}>
          <Helix h={190} start={8} />
          <Wordmark start={12} size={180} />
        </div>
        <div style={{ position: 'absolute', top: 690, display: 'grid', justifyItems: 'center', gap: 14 }}>
          <Type text={sub} start={34} size={30} font={MONO} weight={400} color={C.ink2} cps={40} caret={false} />
          {sub2 && <Type text={sub2} start={34 + Math.ceil((sub.length / 40) * FPS) + 6} size={24} font={MONO} weight={400} color={C.ink3} cps={40} />}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function Cara({ desde }: { desde: number }) {
  /* tu cámara a pantalla completa; desde = segundo de la voz en que empieza esta secuencia */
  return <OffthreadVideo src={staticFile('demo/cara.mp4')} startFrom={fr(desde)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
}

function Pantalla() {
  /* la app, cortada según CORTES, con fundidos cortos entre cortes */
  const f = useCurrentFrame()
  const v = PANT_DESDE + f / FPS
  return (
    <AbsoluteFill style={{ background: '#121a16' }}>
      {CORTES.map(([a, b, s0, s1], i) => {
        const from = fr(a - PANT_DESDE), dur = fr(b - a)
        const rate = (s1 - s0) / (b - a)
        const o = interpolate(f, [from - XF, from, from + dur, from + dur + XF], [0, 1, 1, 0], clamp)
        if (o <= 0) return null
        return (
          <Sequence key={i} from={from - XF} durationInFrames={dur + 2 * XF}>
            <AbsoluteFill style={{ opacity: i === 0 ? 1 : o }}>
              {/* sólo la app: en la grabación (1920×1098) ocupa x 55–1865, y 148–1025; se escala al ancho completo */}
              <div style={{ position: 'absolute', left: 0, top: APP_TOP, width: 1920, height: APP_H, overflow: 'hidden' }}>
                <OffthreadVideo src={staticFile('demo/pantalla.mp4')} startFrom={Math.max(0, fr(s0) - Math.round(XF * rate))} playbackRate={rate} muted
                  style={{ position: 'absolute', left: -55 * K, top: -148 * K, width: 1920 * K, height: 1098 * K }} />
              </div>
            </AbsoluteFill>
          </Sequence>
        )
      })}
      <Seccion v={v} />
      <Refs v={v} />
    </AbsoluteFill>
  )
}

function Seccion({ v }: { v: number }) {
  const f = useCurrentFrame()
  const cur = [...SECCIONES].reverse().find(([t]) => v >= t)
  if (!cur) return null
  const t0 = fr(cur[0] - PANT_DESDE)
  const o = interpolate(f, [t0, t0 + 10, t0 + fr(3.2), t0 + fr(3.6)], [0, 1, 1, 0], clamp)
  return (
    <div style={{ position: 'absolute', right: 48, top: 40, opacity: o, transform: `translateY(${(1 - o) * -8}px)`, display: 'flex', alignItems: 'center', gap: 12,
      background: C.paper, color: C.ink, padding: '10px 18px 10px 14px', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,.25)', fontFamily: SANS, fontWeight: 600, fontSize: 26 }}>
      <span style={{ width: 10, height: 26, background: C.rose, borderRadius: 3 }} />{cur[1]}
    </div>
  )
}

function Refs({ v }: { v: number }) {
  const f = useCurrentFrame()
  const act = REFS.map((r, i) => ({ r, i })).filter(({ r }) => v >= r[0] - 0.3 && v < r[1] + 0.3)
  if (!act.length) return null
  return (
    <div style={{ position: 'absolute', left: 470, right: 48, bottom: 40, display: 'grid', gap: 8 }}>
      {act.map(({ r: [a, b, txt], i }) => {
        const o = interpolate(f, [fr(a - PANT_DESDE), fr(a - PANT_DESDE) + 10, fr(b - PANT_DESDE) - 8, fr(b - PANT_DESDE) + 4], [0, 1, 1, 0], clamp)
        return (
          <div key={i} style={{ opacity: o, background: 'rgba(244,240,230,.96)', color: C.ink, borderLeft: `5px solid ${C.rose}`, borderRadius: 8, padding: '10px 16px',
            fontFamily: MONO, fontSize: 19, lineHeight: 1.35, boxShadow: '0 6px 24px rgba(0,0,0,.22)' }}>
            <b style={{ color: C.rose, marginRight: 10 }}>{i + 1}</b>{txt}
          </div>
        )
      })}
    </div>
  )
}

function Pip() {
  /* tu cámara en la esquina inferior izquierda */
  const f = useCurrentFrame(), { fps } = useVideoConfig()
  const s = spring({ frame: f, fps, config: { damping: 200 } })
  const out = interpolate(f, [fr(PANT_HASTA - PANT_DESDE) - 10, fr(PANT_HASTA - PANT_DESDE)], [1, 0], clamp)
  return (
    <div style={{ position: 'absolute', left: 40, bottom: 40, width: 400, height: 225, borderRadius: 18, overflow: 'hidden', border: `4px solid ${C.paper}`,
      boxShadow: '0 12px 40px rgba(0,0,0,.35)', transform: `scale(${0.85 + 0.15 * s})`, transformOrigin: 'bottom left', opacity: s * out }}>
      <OffthreadVideo src={staticFile('demo/cara.mp4')} startFrom={fr(PANT_DESDE)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )
}

export function Demo() {
  const f = useCurrentFrame()
  const V0 = INTRO                                   // la voz empieza al terminar la intro
  const vol = (fr_: number) => {
    // música: presente en intro y outro, muy baja bajo la voz
    const vStart = V0, vEnd = V0 + fr(VOZ)
    if (fr_ < vStart - 20) return 0.32
    if (fr_ < vStart + 10) return interpolate(fr_, [vStart - 20, vStart + 10], [0.32, 0.055], clamp)
    if (fr_ < vEnd - 10) return 0.055
    return interpolate(fr_, [vEnd - 10, vEnd + 25, DEMO_TOTAL - 20, DEMO_TOTAL], [0.055, 0.32, 0.32, 0], clamp)
  }
  const fade = (a: number, b: number) => interpolate(f, [a, a + 12, b - 12, b], [0, 1, 1, 0], clamp)
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* música: Minimal Tech (Paulyudin, Pixabay), en bucle; suena 3.5 dB más fuerte que el piano de la v1 */}
      <Audio src={staticFile('music/minimal-tech.mp3')} volume={(x: number) => vol(x) * MUSIC_GAIN} loop />
      <Sequence from={V0}><Audio src={staticFile('demo/voz.wav')} /></Sequence>
      <Sequence from={0} durationInFrames={20}><Audio src={staticFile('sfx/rise.wav')} volume={0.35} /></Sequence>
      <Sequence from={DEMO_TOTAL - OUTRO - 6} durationInFrames={20}><Audio src={staticFile('sfx/rise.wav')} volume={0.3} /></Sequence>

      <Sequence from={0} durationInFrames={INTRO + 12}>
        <AbsoluteFill style={{ opacity: interpolate(f, [INTRO - 2, INTRO + 12], [1, 0], clamp) }}>
          <Logo sub="Hackathon ISAC 2026 · Club América" sub2="Sebastian Dulong Salazar" />
        </AbsoluteFill>
      </Sequence>

      {/* tu cara: presentación */}
      <Sequence from={V0} durationInFrames={fr(PANT_DESDE) + 12}>
        <AbsoluteFill style={{ opacity: fade(V0 - 12, V0 + fr(PANT_DESDE) + 12) }}><Cara desde={0} /></AbsoluteFill>
      </Sequence>

      {/* la app + tu cámara en la esquina */}
      <Sequence from={V0 + fr(PANT_DESDE)} durationInFrames={fr(PANT_HASTA - PANT_DESDE) + 12}>
        <AbsoluteFill style={{ opacity: interpolate(f - V0 - fr(PANT_DESDE), [0, 12, fr(PANT_HASTA - PANT_DESDE), fr(PANT_HASTA - PANT_DESDE) + 12], [0, 1, 1, 0], clamp) }}>
          <Pantalla />
          <Pip />
        </AbsoluteFill>
      </Sequence>

      {/* tu cara: cierre */}
      <Sequence from={V0 + fr(PANT_HASTA)} durationInFrames={fr(VOZ - PANT_HASTA) + 12}>
        <AbsoluteFill style={{ opacity: fade(V0 + fr(PANT_HASTA), V0 + fr(VOZ) + 12) }}><Cara desde={PANT_HASTA} /></AbsoluteFill>
      </Sequence>

      {/* outro */}
      <Sequence from={DEMO_TOTAL - OUTRO}>
        <AbsoluteFill style={{ opacity: interpolate(f, [DEMO_TOTAL - OUTRO, DEMO_TOTAL - OUTRO + 14], [0, 1], clamp) }}>
          <Logo sub="El estilo del DT, separado de su plantilla." sub2="Sebastian Dulong Salazar · ISAC 2026" />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  )
}
