import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { Pitch, Sfx, Type, clamp, ease } from './kit'
import { C, DROP, MONO, bar } from './theme'

/* ============================================================ antes del drop: una sola hoja que se desplaza de lado
   hoja -1: «¿Qué es un director técnico?» · hojas 0–6: un DT y su idea (la última, el equipo) · hoja 7: la pregunta */

type Slot = { src: string; video?: boolean; name: string; idea: string; z?: number; origin?: string; ss?: number }
/* citas reales, verificadas (fuente en public/coaches/citas.json); las que vienen del inglés van traducidas.
   Cada DT es un clip mudo de ~5 s (public/clips/c-*.mp4; fuentes en public/clips/coaches-creditos.json); z y origin recortan los logotipos de la transmisión. */
const SLOTS: Slot[] = [
  { src: 'clips/c-klopp.mp4', video: true, name: 'JÜRGEN KLOPP', idea: '«Ningún creador de juego del mundo es tan bueno como una buena contrapresión.»', z: 1.15, origin: '30% 90%' },
  { src: 'clips/c-simeone.mp4', video: true, name: 'DIEGO «CHOLO» SIMEONE', idea: '«…también hay que valorar un sistema defensivo fuerte y sin vergüenza.»', z: 1.7, origin: '64% 20%', ss: 1.0 },
  { src: 'clips/c-domenech.mp4', video: true, name: 'RAYMOND DOMENECH', idea: '«Cuando tengo un Leo en la defensa, siempre tengo la pistola lista.»', z: 1.22, origin: '50% 0%' },
  { src: 'clips/c-piojo.mp4', video: true, name: 'MIGUEL «PIOJO» HERRERA', idea: '«La idea es ganar, salir a buscar el partido.»', z: 1.18, origin: '40% 55%' },
  { src: 'clips/c-mourinho.mp4', video: true, name: 'JOSÉ MOURINHO', idea: '«El fútbol es meter el balón en la red del rival y evitar que lo metan en la tuya.»', z: 1.4, origin: '85% 0%' },
  { src: 'clips/c-vasco.mp4', video: true, name: 'JAVIER «VASCO» AGUIRRE', idea: '«El que cometa menos errores, saldrá adelante.»', z: 1.75, origin: '73% 33%' },
  { src: 'clips/c-pep.mp4', video: true, name: 'PEP GUARDIOLA', idea: 'Pero en el campo,\nel técnico no está solo.', z: 1.0, origin: '40% 40%' },
]
const LEAD = 24                                                      // 0.8 s de calma al inicio antes de que arranque el título y la voz
const M0 = bar(-10.5) + LEAD, QA0 = bar(-1.25), S = (QA0 - M0) / 7           // ~4.2 s por hoja; la pregunta llega en QA0
const arrive = (k: number) => (k < 0 ? 0 : k >= SLOTS.length ? QA0 : M0 + k * S)
/* voz de Pep (public/pep/pep.wav): cada frase se corta de su audio y cae cuando aparece lo que nombra.
   0 «¿Qué es… un director técnico?» · 1 «¿Es la presión intensa?» (Klopp) · 2 «¿El orden defensivo?» (Simeone) · 3 «¿La superstición?» (Domenech)
   4 «¿La actitud… quizás?» (Piojo) · 5 «¿El pragmatismo? Je, je…» (Mourinho) · 6 «¿O el realismo?» (Vasco) · 7 «Pero en el campo… el técnico no está solo.» */
const VOICE: [number, number][] = [[0.14, 2.2], [2.94, 3.98], [4.64, 5.56], [6.18, 7.04], [7.68, 9.14], [9.6, 11.12], [11.9, 12.66], [13.96, 16.24]]
function Voice({ at, line, vol = 1 }: { at: number; line: number; vol?: number }) {
  const src = line === 0 ? 'pep/pep-first.wav' : 'pep/pep.wav'               // la primera frase suena más fuerte
  const [a, b] = VOICE[line], from = Math.round((a - 0.1) * 30), to = Math.round((b + 0.12) * 30)
  return <Sequence from={Math.round(at) - 3} durationInFrames={to - from}><Audio src={staticFile(src)} startFrom={from} endAt={to} volume={vol} /></Sequence>
}
const MOVE = 26                                                  // fotogramas de cada desplazamiento

/** Posición de la cámara (en hojas) con desplazamientos suaves que aterrizan unos fotogramas después de cada llegada. */
function camAt(f: number) {
  let c = -1
  for (let k = 0; k <= SLOTS.length; k++) c += interpolate(f, [arrive(k) - MOVE + 6, arrive(k) + 6], [0, 1], { ...clamp, easing: ease })
  return c
}

export function CropMarks({ x, y, w, h, o = 1 }: { x: number; y: number; w: number; h: number; o?: number }) {
  const L = 26, g = 10
  const c = (cx: number, cy: number, sx: number, sy: number) => (
    <g key={`${cx}${cy}`}><line x1={cx - sx * g} y1={cy} x2={cx - sx * (g + L)} y2={cy} /><line x1={cx} y1={cy - sy * g} x2={cx} y2={cy - sy * (g + L)} /></g>
  )
  return <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: o, overflow: 'visible' }}><g stroke={C.ink} strokeWidth={1.4}>
    {c(x, y, 1, 1)}{c(x + w, y, -1, 1)}{c(x, y + h, 1, -1)}{c(x + w, y + h, -1, -1)}</g></svg>
}

function Grain({ o = 0.1 }: { o?: number }) {
  const f = useCurrentFrame()
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: o, mixBlendMode: 'multiply', pointerEvents: 'none' }}>
      <filter id={`g${f % 6}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={f % 6} /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="100%" height="100%" filter={`url(#g${f % 6})`} />
    </svg>
  )
}

/** Una hoja del montaje: foto (o clip) enmarcada a un lado, idea del DT escrita a máquina del otro. */
function CoachSheet({ s, k }: { s: Slot; k: number }) {
  const f = useCurrentFrame()
  const t = f - arrive(k)
  const left = k % 2 === 0
  const box = { w: 920, h: 518 }
  const bx = left ? 200 : 1920 - 200 - box.w, by = (1080 - box.h) / 2 - 10
  const inn = interpolate(t, [-MOVE + 2, 0], [0, 1], { ...clamp, easing: ease })
  const k0 = interpolate(t, [-MOVE, S + 10], [1.02, 1.1])
  const flash = interpolate(t, [0, 1, 7], [0, 0.3, 0], clamp)
  const tx = left ? bx + box.w + 110 : 200
  const sc = (s.z ?? 1) * k0
  const quote = s.idea.startsWith('«')
  const media = (
    <Sequence from={arrive(k) - MOVE} durationInFrames={Math.round((6 - (s.ss ?? 0)) * 30) - 2} layout="none">
      <OffthreadVideo src={staticFile(s.src)} muted startFrom={Math.round((s.ss ?? 0) * 30)} style={{ width: '100%', height: '100%', objectFit: 'cover', transformOrigin: s.origin ?? '50% 50%', transform: `scale(${sc})` }} />
    </Sequence>
  )
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: bx, top: by, width: box.w, height: box.h, overflow: 'hidden', clipPath: `inset(${(1 - inn) * 50}% 0 ${(1 - inn) * 50}% 0)`, boxShadow: '0 30px 80px rgba(16,32,26,.22)' }}>
        <div style={{ position: 'absolute', inset: 0, filter: 'saturate(.9) contrast(1.04)' }}>{media}</div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, transparent 60%, rgba(8,14,11,.35))' }} />
        <Grain />
        <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flash }} />
      </div>
      <CropMarks x={bx} y={by} w={box.w} h={box.h} o={inn} />
      {/* cota del marco, como en un plano */}
      <div style={{ position: 'absolute', left: bx, top: by + box.h + 18, width: box.w, fontFamily: MONO, fontSize: 14, color: C.ink3, display: 'flex', justifyContent: 'space-between', opacity: inn }}>
        <span>FIG. {String(k + 1).padStart(2, '0')}</span><span>CLIP · {String(k + 1).padStart(2, '0')} / 07</span>
      </div>
      <div style={{ position: 'absolute', left: tx, top: 300, width: 1920 - box.w - 200 - 110 - 120 }}>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: '.1em', color: C.ink, opacity: interpolate(t, [-MOVE + 6, -6], [0, 1], clamp) }}><span style={{ color: C.rose }}>●</span> {s.name}</div>
        <div style={{ width: interpolate(t, [-6, 14], [0, 120], { ...clamp, easing: ease }), height: 1.5, background: C.ink, margin: '26px 0 30px' }} />
        <Type text={s.idea} start={arrive(k) + 12} size={quote ? (s.idea.length > 60 ? 46 : 56) : 62} weight={quote ? 600 : 700} cps={quote ? 36 : 20} vol={0.22} until={arrive(k + 1) - MOVE} />
      </div>
      <Sfx at={arrive(k)} src="shutter-slr" vol={0.9} dur={12} />
      <Sfx at={arrive(k)} src="thud" vol={0.45} dur={24} />
      <Sfx at={arrive(k) - 6} src={`note${[0, 2, 4, 1, 3, 5, 2][k]}`} vol={0.28} dur={40} />
    </AbsoluteFill>
  )
}

export function PreDrop() {
  const f = useCurrentFrame()
  const cam = camAt(f), v = Math.abs(camAt(f + 1) - cam)
  const exit = interpolate(f, [DROP - 16, DROP], [0, 1], { ...clamp, easing: ease })
  const QA = arrive(SLOTS.length)
  const sheet = (k: number, node: React.ReactNode) => Math.abs(k - cam) < 1.1 && (
    <div key={k} style={{ position: 'absolute', inset: 0, transform: `translateX(${(k - cam) * 1920}px)` }}>{node}</div>
  )
  return (
    <AbsoluteFill style={{ opacity: 1 - exit, filter: `blur(${Math.min(10, v * 60) + exit * 10}px)`, transform: `scale(${1 + exit * 0.05})` }}>
      {sheet(-1, <AbsoluteFill>
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}><Pitch x={1040} y={330} w={720} start={20 + LEAD} /></svg>
        <div style={{ position: 'absolute', left: 160, top: 280, fontFamily: MONO, fontSize: 18, color: C.rose, letterSpacing: '.12em', opacity: interpolate(f, [8 + LEAD, 20 + LEAD], [0, 1], clamp) }}>01 — LA PREGUNTA</div>
        <div style={{ position: 'absolute', left: 160, top: 300, width: 820 }}>
          <Type text={'¿Qué es un\ndirector técnico?'} start={20 + LEAD} size={96} weight={700} cps={13} until={arrive(0) - MOVE} />
        </div>
      </AbsoluteFill>)}
      {SLOTS.map((s, k) => sheet(k, <CoachSheet s={s} k={k} />))}
      {sheet(SLOTS.length, <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 200 }}>
        <div style={{ fontFamily: MONO, fontSize: 20, color: C.rose, letterSpacing: '.12em', marginBottom: 30, opacity: interpolate(f, [QA, QA + 10], [0, 1], clamp) }}>¿DT O PLANTILLA?</div>
        <Type text={'¿Cuánto del estilo\nes suyo?'} start={QA + 8} size={140} weight={700} cps={22} />
      </AbsoluteFill>)}
      {[0, ...SLOTS.map((_, k) => k + 1)].map(k => <Sfx key={k} at={arrive(k) - MOVE + 4} src="rise" vol={0.12} dur={22} />)}
      <Sfx at={8 + LEAD} src="note0" vol={0.3} dur={40} />
      <Voice at={22 + LEAD} line={0} />
      {SLOTS.map((_, k) => <Voice key={k} at={arrive(k) + (k === 4 ? 20 : 4)} line={k + 1} />)}
      <Sfx at={QA} src="thud" vol={0.55} dur={24} />
      <Sfx at={QA + 2} src="note4" vol={0.3} dur={40} />
    </AbsoluteFill>
  )
}
