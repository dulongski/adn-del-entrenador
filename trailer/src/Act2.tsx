import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import data from './data.json'
import { Browser, Cursor, Helix, Pitch, Sfx, Shot, Type, Wordmark, clamp, ease } from './kit'
import { C, MONO, SANS } from './theme'

const ALMADA = 2947
const DOT = 100                                   // la campana: el punto de Almada cae aquí

/* ============================================================ 5 · la campana: Nº 1 de 76 */
export function Campana() {
  const f = useCurrentFrame(), { fps, durationInFrames: D } = useVideoConfig()
  const K = (data.dist as any).conduccion_prog as { a: Record<string, number> }
  const vals = Object.entries(K.a).map(([id, v]) => ({ id: Number(id), v }))
  const W = 1040, X0 = 760, mid = 600
  const lo = Math.min(...vals.map(o => o.v)) - 0.12, hi = Math.max(...vals.map(o => o.v)) + 0.12
  const X = (v: number) => X0 + ((v - lo) / (hi - lo)) * W
  const r = 12, placed: { x: number; y: number }[] = []
  const dots = [...vals].sort((a, b) => a.v - b.v).map(o => {
    const x = X(o.v); let y = mid
    for (let k = 0; k < 40; k++) { const off = Math.ceil(k / 2) * r * 1.9 * (k % 2 ? -1 : 1); y = mid + off; if (!placed.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < (2 * r) ** 2 * 0.95)) break }
    placed.push({ x, y }); return { ...o, x, y }
  })
  const A = dots.find(o => o.id === ALMADA)!
  const drop = spring({ frame: f - DOT, fps, config: { damping: 12, mass: 0.8 } })
  const lab = interpolate(f, [DOT + 10, DOT + 22], [0, 1], clamp)
  const enter = interpolate(f, [0, 12], [0, 1], { ...clamp, easing: ease }), exit = interpolate(f, [D - 12, D], [0, 1], { ...clamp, easing: ease })
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - exit), filter: `blur(${(1 - enter + exit) * 8}px)` }}>
      <div style={{ position: 'absolute', left: 120, top: 250, fontFamily: MONO, fontSize: 18, color: C.rose, letterSpacing: '.12em' }}>02 — SU SELLO</div>
      <div style={{ position: 'absolute', left: 120, top: 300, width: 560 }}>
        <Type text={'Quitamos lo que\npone su plantilla.'} start={6} size={72} weight={700} cps={28} until={DOT} />
        <div style={{ height: 30 }} />
        <Type text="Queda su sello." start={66} size={72} weight={700} color={C.mintDeep} cps={22} />
      </div>
      <div style={{ position: 'absolute', left: X0, top: mid + 210, fontFamily: SANS, fontWeight: 600, fontSize: 28, color: C.ink2, opacity: enter }}>Avanzar con el balón en los pies · 76 DTs de Liga MX</div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <line x1={X0} x2={X0 + W} y1={mid} y2={mid} stroke={C.grid2} strokeWidth={2} />
        {dots.filter(d => d.id !== ALMADA).map((d, i) => {
          const s = spring({ frame: f - 6 - i * 0.5, fps, config: { damping: 14, mass: 0.6 } })
          return <circle key={d.id} cx={d.x} cy={d.y - (1 - s) * 240} r={r - 1} fill={C.ink} opacity={0.14 + 0.18 * s} />
        })}
        {f > DOT - 2 && <g>
          <line x1={A.x} x2={A.x} y1={A.y - 150} y2={A.y - (1 - drop) * 420 - r - 8} stroke={C.rose} strokeWidth={3} opacity={drop} />
          <circle cx={A.x} cy={A.y - (1 - drop) * 420} r={r + 9} fill={C.rose} stroke={C.paper} strokeWidth={5} />
        </g>}
        <g fontFamily={MONO} fontSize={18} fill={C.ink2} opacity={enter}>
          <text x={X0} y={mid + 170}>← menos</text><text x={X0 + W} y={mid + 170} textAnchor="end">más →</text>
        </g>
      </svg>
      <div style={{ position: 'absolute', left: A.x - 460, top: A.y - 290, width: 440, textAlign: 'right', opacity: lab, lineHeight: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 22, color: C.rose, letterSpacing: '.1em' }}>GUILLERMO ALMADA</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 96, color: C.ink, letterSpacing: '-.03em' }}>Nº 1 de 76</div>
      </div>
      <Sfx at={DOT} src="tick" vol={0.5} dur={4} />
    </AbsoluteFill>
  )
}

/* ============================================================ 6 · la jugada, trazada como plano */
export function Jugada() {
  const f = useCurrentFrame(), { durationInFrames: D } = useVideoConfig()
  const J = (data as any).jugada as { partido: string; fecha: string; min: number; xg: number; goleador: string; acc: [string, number, number, number, number, string][] }
  const PX = 330, PY = 260, PW = 1100, s = PW / 105               // cancha 105×68 m
  const P = (x: number, y: number): [number, number] => [PX + x * (105 / 120) * s, PY + y * (68 / 80) * s]
  const T0 = 50, step = 19                                        // la jugada arranca a los 50 fotogramas
  const enter = interpolate(f, [0, 12], [0, 1], { ...clamp, easing: ease }), exit = interpolate(f, [D - 12, D], [0, 1], { ...clamp, easing: ease })
  let ball: [number, number] = P(J.acc[0][1], J.acc[0][2])
  const segs = J.acc.map((a, i) => {
    const p = interpolate(f, [T0 + i * step, T0 + (i + 1) * step - 2], [0, 1], { ...clamp, easing: ease })
    const [x1, y1] = P(a[1], a[2]), [x2, y2] = P(a[3], a[4])
    if (p > 0) ball = [x1 + (x2 - x1) * p, y1 + (y2 - y1) * p]
    const m = Math.hypot((a[3] - a[1]) * 105 / 120, (a[4] - a[2]) * 68 / 80)
    return { a, p, x1, y1, x2, y2, m, i }
  })
  const goal = f >= T0 + J.acc.length * step
  const gO = interpolate(f, [T0 + J.acc.length * step, T0 + J.acc.length * step + 8], [0, 1], clamp)
  const names = new Map<string, [number, number, number]>()
  segs.forEach(sg => { if (sg.p > 0 && !names.has(sg.a[5])) names.set(sg.a[5], [sg.x1, sg.y1, sg.i]) })
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - exit), filter: `blur(${(1 - enter + exit) * 8}px)` }}>
      <div style={{ position: 'absolute', left: 330, top: 96, fontFamily: MONO, fontSize: 18, color: C.rose, letterSpacing: '.12em' }}>03 — UNA JUGADA SUYA</div>
      <div style={{ position: 'absolute', left: 330, top: 132 }}><Type text="Del portero al gol, trazada desde los datos." start={4} size={52} weight={700} cps={28} until={D - 20} /></div>
      <div style={{ position: 'absolute', right: 1920 - PX - PW, top: 220, fontFamily: MONO, fontSize: 18, color: C.ink2, textAlign: 'right' }}>{J.partido.toUpperCase()} · {J.fecha.toUpperCase()} · MIN {J.min}′</div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <Pitch x={PX} y={PY} w={PW} start={0} color={C.ink2} minimal />
        {segs.map(sg => sg.p > 0 && (
          <g key={sg.i}>
            <line x1={sg.x1} y1={sg.y1} x2={sg.x1 + (sg.x2 - sg.x1) * sg.p} y2={sg.y1 + (sg.y2 - sg.y1) * sg.p}
              stroke={sg.a[0] === 'Shot' ? C.rose : C.ink} strokeWidth={sg.a[0] === 'Pass' ? 3 : 3.5} strokeDasharray={sg.a[0] === 'Carry' ? '2 9' : undefined} strokeLinecap="round" />
            {sg.m > 15 && sg.p >= 1 && (
              <text x={(sg.x1 + sg.x2) / 2} y={(sg.y1 + sg.y2) / 2 - 18} textAnchor="middle" fontFamily={MONO} fontSize={20} fill={sg.a[0] === 'Carry' ? C.rose : C.ink2}>
                {sg.a[0] === 'Carry' ? `conducción · ${Math.round(sg.m)} m` : sg.a[0] === 'Shot' ? '' : `${Math.round(sg.m)} m`}
              </text>
            )}
          </g>
        ))}
        {[...names.entries()].map(([n, [x, y]]) => (
          <g key={n}>
            <circle cx={x} cy={y} r={11} fill={C.mint} stroke={C.ink} strokeWidth={2} />
            <text x={x} y={y < PY + 34 * s ? y - 24 : y + 38} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={20} fill={C.ink}>{n}</text>
          </g>
        ))}
        <circle cx={ball[0]} cy={ball[1]} r={8} fill={C.white} stroke={C.ink} strokeWidth={2.5} />
        {goal && <circle cx={P(120, 40)[0]} cy={P(120, 40)[1]} r={20 + gO * 140} fill="none" stroke={C.rose} strokeWidth={3} opacity={1 - gO} />}
      </svg>
      {goal && <div style={{ position: 'absolute', left: PX + PW + 50, top: PY + 250, opacity: gO, lineHeight: 1 }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 92, color: C.rose, letterSpacing: '-.03em' }}>Gol.</div>
        <div style={{ fontFamily: MONO, fontSize: 18, color: C.ink2, marginTop: 12, lineHeight: 1.4 }}>{J.goleador.toUpperCase()}<br />xG {J.xg.toFixed(2)}</div>
      </div>}
      {J.acc.map((_, i) => <Sfx key={i} at={T0 + i * step} src="tick" vol={0.22} dur={3} />)}
      <Sfx at={T0 + J.acc.length * step} src="shutter" vol={0.4} dur={10} />
    </AbsoluteFill>
  )
}

/* ============================================================ 7 · recorrido por la app (capturas de página completa, desplazamiento real) */
const WX = 220, WY = 150, WW = 1480, K = WW / 1920
export function Tour() {
  const f = useCurrentFrame(), { durationInFrames: D, fps } = useVideoConfig()
  const half = Math.round(D / 2)
  const rise = spring({ frame: f, fps, config: { damping: 200 } })
  const second = f >= half
  const local = second ? f - half : f
  // balón parado: se queda en el 3D y luego baja a las tarjetas · cara a cara: clic en el gemelo y baja a los rasgos
  const scroll = second ? interpolate(local, [70, half - 20], [0, -430], { ...clamp, easing: ease }) : interpolate(local, [96, half - 18], [0, -400], { ...clamp, easing: ease })
  const zoom = second ? 1 : interpolate(local, [10, 90], [1, 1.04], { ...clamp, easing: ease })
  const xf = interpolate(f, [half - 6, half + 6], [0, 1], clamp)
  const exit = interpolate(f, [D - 12, D], [0, 1], { ...clamp, easing: ease })
  const P = (x: number, y: number) => [WX + x * K, WY + 40 + y * K] as [number, number]
  const cap = (txt: string, a: number, b: number) => (
    <div style={{ position: 'absolute', left: WX, top: 62, fontFamily: SANS, fontWeight: 700, fontSize: 44, color: C.ink, letterSpacing: '-.02em',
      opacity: interpolate(f, [a, a + 10, b - 10, b], [0, 1, 1, 0], clamp), transform: `translateY(${interpolate(f, [a, a + 10], [10, 0], clamp)}px)` }}>{txt}</div>
  )
  return (
    <AbsoluteFill style={{ opacity: 1 - exit, filter: `blur(${exit * 8}px)` }}>
      <div style={{ position: 'absolute', left: WX, top: 34, fontFamily: MONO, fontSize: 18, color: C.rose, letterSpacing: '.12em' }}>04 — TODO, EN UN LUGAR</div>
      {cap('Sus córners en 3D, con xG por zona.', 8, half)}
      {cap('Su gemelo de estilo: Demichelis, +0.68 de parecido.', half + 4, D)}
      <div style={{ position: 'absolute', left: WX, top: WY + (1 - rise) * 600, transformOrigin: '50% 40%', transform: `scale(${zoom})` }}>
        <Browser w={WW} url={second ? 'coachdna.app/#2947/vs' : 'coachdna.app/#2947/bp'}>
          <div style={{ position: 'absolute', inset: 0, transform: `translateY(${scroll}px)`, opacity: second ? xf : 1 }}>
            <Shot src={second ? 'app/vs-full.png' : 'app/bp-full.png'} w={WW} />
          </div>
        </Browser>
      </div>
      <Cursor keys={[[0, 1600, 1000], [30, ...P(1484, 29)], [52, ...P(1484, 29)], [80, ...P(820, 560)], [half - 20, ...P(900, 520)], [half - 8, ...P(1700, 29)], [half + 16, ...P(1700, 29)], [half + 40, ...P(1428, 194)], [D, ...P(1300, 600)]]}
        clicks={[36, half - 8, half + 44]} />
      <Sfx at={half - 6} src="whoosh" vol={0.3} />
    </AbsoluteFill>
  )
}

/* ============================================================ 8 · laboratorio: 50,000 rejugadas */
export function Lab() {
  const f = useCurrentFrame(), { durationInFrames: D } = useVideoConfig()
  const L = (data as any).lab as { equipo: string; rival: string; fecha: string; gf: number; gc: number; grid: number[][]; modal: [number, number]; w: number; d: number; l: number }
  const END = D - 110                                              // el contador termina aquí y luego se lee la conclusión
  const n = Math.round(interpolate(f, [6, END], [0, 50000], { ...clamp, easing: ease }))
  const fill = interpolate(f, [6, END], [0, 1], { ...clamp, easing: ease })
  const max = Math.max(...L.grid.flat())
  const cell = 92, GX = 1060, GY = 250
  const enter = interpolate(f, [0, 10], [0, 1], clamp), exit = interpolate(f, [D - 10, D], [0, 1], clamp)
  const pct = (v: number) => (v > 0 && v < 0.01 ? (v * 100).toFixed(1) : (v * 100).toFixed(0)) + '%'
  const real = L.grid[L.gf]?.[L.gc] ?? 0
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - exit) }}>
      <div style={{ position: 'absolute', left: 120, top: 230, fontFamily: MONO, fontSize: 18, color: C.rose, letterSpacing: '.12em' }}>05 — LABORATORIO</div>
      <div style={{ position: 'absolute', left: 120, top: 262, fontFamily: MONO, fontSize: 16, color: C.ink2, letterSpacing: '.08em' }}>{L.equipo.toUpperCase()} {L.gf}–{L.gc} {L.rival.toUpperCase()} · {L.fecha.toUpperCase()}</div>
      <div style={{ position: 'absolute', left: 120, top: 300, width: 860, lineHeight: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 120, fontWeight: 500, color: C.ink, letterSpacing: '-.04em' }}>{n.toLocaleString('es-MX')}</div>
        <div style={{ fontFamily: SANS, fontSize: 40, fontWeight: 600, color: C.ink2, marginTop: 16 }}>rejugadas de {L.equipo} vs {L.rival}.</div>
        <div style={{ fontFamily: SANS, fontSize: 40, fontWeight: 600, color: C.ink, marginTop: 44, lineHeight: 1.25, opacity: interpolate(f, [END + 4, END + 16], [0, 1], clamp) }}>
          Lo perdía {Math.round(L.l * 100)} de cada 100 veces.<br />
          <span style={{ opacity: interpolate(f, [END + 34, END + 46], [0, 1], clamp) }}><b style={{ color: C.rose }}>Ganó {L.gf}–{L.gc}.</b> <span style={{ fontWeight: 500, color: C.ink2, fontSize: 30 }}>({Math.round(real * 1000)} de cada 1,000)</span></span>
        </div>
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {L.grid.slice(0, 5).map((row, a) => row.slice(0, 5).map((v, b) => {
          const isReal = a === L.gf && b === L.gc, mod = a === L.modal[0] && b === L.modal[1]
          return <g key={`${a}${b}`}>
            <rect x={GX + b * cell} y={GY + a * cell} width={cell - 6} height={cell - 6} rx={6} fill={C.mintDeep} opacity={0.06 + 0.9 * (v / max) * fill} />
            {fill > 0.98 && <text x={GX + b * cell + (cell - 6) / 2} y={GY + a * cell + cell / 2 + 4} textAnchor="middle" fontFamily={MONO} fontSize={17} fill={v / max > 0.5 ? C.white : C.ink}>{pct(v)}</text>}
            {isReal && f > END + 34 && <rect x={GX + b * cell - 4} y={GY + a * cell - 4} width={cell + 2} height={cell + 2} rx={8} fill="none" stroke={C.rose} strokeWidth={4} />}
            {mod && f > END + 4 && <rect x={GX + b * cell - 4} y={GY + a * cell - 4} width={cell + 2} height={cell + 2} rx={8} fill="none" stroke={C.ink} strokeWidth={2.5} strokeDasharray="6 5" />}
          </g>
        }))}
        <g fontFamily={MONO} fontSize={18} fill={C.ink2}>
          {[0, 1, 2, 3, 4].map(k => <text key={`r${k}`} x={GX - 22} y={GY + k * cell + cell / 2 + 4} textAnchor="end">{k}</text>)}
          {[0, 1, 2, 3, 4].map(k => <text key={`c${k}`} x={GX + k * cell + (cell - 6) / 2} y={GY - 16} textAnchor="middle">{k}</text>)}
          <text x={GX - 60} y={GY + 2.5 * cell} textAnchor="middle" transform={`rotate(-90 ${GX - 60} ${GY + 2.5 * cell})`}>GOLES {L.equipo.toUpperCase()}</text>
          <text x={GX + 2.5 * cell} y={GY - 50} textAnchor="middle">GOLES {L.rival.toUpperCase()}</text>
          {f > END + 4 && <text x={GX + 5 * cell + 14} y={GY + L.modal[0] * cell + cell / 2 + 4} fill={C.ink}>← lo más probable</text>}
          {f > END + 34 && <text x={GX + 5 * cell + 14} y={GY + L.gf * cell + cell / 2 + 4} fill={C.rose}>← lo que pasó</text>}
        </g>
      </svg>
      <Sfx at={END + 34} src="tick" vol={0.45} dur={4} />
    </AbsoluteFill>
  )
}

/* ============================================================ 9 · cierre */
export function Cierre() {
  const f = useCurrentFrame(), { durationInFrames: D } = useVideoConfig()
  const out = interpolate(f, [D - 24, D], [1, 0], clamp)
  const lineP = interpolate(f, [30, 60], [0, 1], { ...clamp, easing: ease })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
        <Helix h={170} start={0} />
        <Wordmark start={4} size={160} />
      </div>
      <div style={{ width: 760 * lineP, height: 1.5, background: C.ink, marginTop: 34 }} />
      <div style={{ marginTop: 28 }}>
        <Type text="El estilo del DT, separado de su plantilla." start={36} size={30} font={MONO} weight={400} color={C.ink2} cps={40} vol={0.22} until={D - 30} />
      </div>
      <div style={{ position: 'absolute', bottom: 120, fontFamily: MONO, fontSize: 18, letterSpacing: '.14em', color: C.ink2, opacity: interpolate(f, [60, 72], [0, 1], clamp) }}>
        ISAC 2026 · LIGA MX · 1,780 PARTIDOS · 76 DTS
      </div>
      <Sfx at={2} src="note0" vol={0.28} dur={44} /><Sfx at={8} src="note2" vol={0.2} dur={44} />
      <Sfx at={30} src="rise" vol={0.12} dur={22} />
      <Sfx at={60} src="note4" vol={0.24} dur={44} />
    </AbsoluteFill>
  )
}

