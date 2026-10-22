import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import { CropMarks } from './Act1'
import { Sfx, Type, clamp, ease } from './kit'
import { C, MONO, SANS } from './theme'

const slow = Easing.bezier(0.65, 0, 0.35, 1)

/* ============================================================ Golito: el asistente con IA de la app
   El video es una captura real del chat (public/clips/golito.mp4): se abre, se escribe la pregunta, las herramientas de la app
   traen el ranking de los 76 DTs y la respuesta aparece. Tiempos de salida (s del clip): panel 1.0 · teclas 1.8–3.8 · enviar 3.85 · tarjeta 4.2 · texto 4.6–7. */
export function Golito() {
  const f = useCurrentFrame(), { durationInFrames: D } = useVideoConfig()
  const V = 20                                                     // el clip arranca en este fotograma de la escena
  const inn = interpolate(f, [0, 30], [0, 1], { ...clamp, easing: slow })
  const out = interpolate(f, [D - 22, D], [0, 1], { ...clamp, easing: slow })
  const box = { x: 1130, y: 150, w: 540, h: 793 }                  // 1080×1586 del clip, escalado a 0.5
  const bullets = ['RANKINGS DE LOS 76 DTS', 'RESULTADOS DE PARTIDOS', 'COMPARA DTS Y TE LLEVA A LA VISTA']
  return (
    <AbsoluteFill style={{ opacity: 1 - out, filter: `blur(${out * 8}px)` }}>
      <div style={{ position: 'absolute', left: 170, top: 230, fontFamily: MONO, fontSize: 18, letterSpacing: '.14em', color: C.rose, opacity: inn }}>07 — IA INTEGRADA</div>
      <div style={{ position: 'absolute', left: 170, top: 270 }}>
        <Type text={'¿Prefieres\npreguntar?'} start={16} size={118} weight={700} cps={16} until={150} />
      </div>
      <div style={{ position: 'absolute', left: 170, top: 640, width: 780 }}>
        <Type text="Golito, el asistente con IA, responde con los datos de la app." start={96} size={30} weight={400} font={MONO} color={C.ink2} cps={38} vol={0.2} until={D - 30} />
        <div style={{ marginTop: 34, display: 'grid', gap: 12 }}>
          {bullets.map((b, i) => (
            <div key={b} style={{ fontFamily: MONO, fontSize: 19, letterSpacing: '.1em', color: C.ink, opacity: interpolate(f, [170 + i * 16, 184 + i * 16], [0, 1], clamp), transform: `translateX(${interpolate(f, [170 + i * 16, 184 + i * 16], [-14, 0], { ...clamp, easing: ease })}px)` }}>
              <span style={{ color: C.mintDeep }}>●</span> {b}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: inn, transform: `translateY(${(1 - inn) * 26}px)` }}>
        <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, overflow: 'hidden', background: C.paper, boxShadow: '0 30px 80px rgba(16,32,26,.22)' }}>
          <Sequence from={V} layout="none"><OffthreadVideo src={staticFile('clips/golito.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Sequence>
        </div>
        <CropMarks x={box.x} y={box.y} w={box.w} h={box.h} o={1} />
        <div style={{ position: 'absolute', left: box.x, top: box.y + box.h + 16, width: box.w, fontFamily: MONO, fontSize: 14, color: C.ink3, display: 'flex', justifyContent: 'space-between' }}>
          <span>FIG. 09</span><span>GOLITO · ASISTENTE CON IA</span>
        </div>
      </div>
      {/* sonido: clic en el botón, el panel se abre, teclas mientras escribe, enviar, la tarjeta con los datos y la respuesta */}
      <Sfx at={V + 9} src="click" vol={0.55} dur={6} />
      <Sfx at={V + 28} src="rise" vol={0.14} dur={22} /><Sfx at={V + 30} src="note0" vol={0.3} dur={42} />
      {Array.from({ length: 46 }, (_, i) => <Sfx key={i} at={V + 54 + i * 1.3} src={`kb${(i * 5) % 14}`} vol={0.3} dur={4} />)}
      <Sfx at={V + 115} src="click" vol={0.5} dur={6} />
      <Sfx at={V + 126} src="thud" vol={0.5} dur={24} /><Sfx at={V + 127} src="note4" vol={0.3} dur={42} />
      <Sfx at={V + 139} src="pop2" vol={0.2} dur={14} /><Sfx at={V + 150} src="pop4" vol={0.2} dur={14} /><Sfx at={V + 161} src="pop6" vol={0.2} dur={14} />
      <Sfx at={V + 205} src="note2" vol={0.28} dur={42} /><Sfx at={V + 207} src="note6" vol={0.24} dur={42} />
    </AbsoluteFill>
  )
}
