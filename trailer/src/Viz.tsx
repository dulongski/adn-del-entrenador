import { interpolate } from 'remotion'
import data from './data.json'
import { Sfx, clamp, ease } from './kit'
import { C, MONO, SANS } from './theme'

/* ============================================================ una visualización por pestaña, dibujada junto a la ventana de la app
   Todas reciben `t` = fotogramas desde que empieza su pestaña y se dibujan en una caja de VW × VH píxeles. Los datos salen de data.json
   (extraídos de los mismos archivos que usa la app). */

export const VW = 640, VH = 546
export const V0 = 96                                              // fotograma (de la pestaña) en que arranca cada visualización
const E = (t: number, a: number, d = 20) => interpolate(t, [a, a + d], [0, 1], { ...clamp, easing: ease })
const viz = (data as any).viz

function Cap({ t, color, text }: { t: number; color: string; text: string }) {
  const o = E(t, V0 - 14, 14), w = E(t, V0 - 14, 30)
  return (
    <>
      <div style={{ width: VW * w, height: 2, background: color }} />
      <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '.1em', color: C.ink2, marginTop: 12, opacity: o }}>{text}</div>
    </>
  )
}
const Box = ({ children }: { children: React.ReactNode }) => <div style={{ position: 'relative', width: VW, height: VH }}>{children}</div>

/* ------------------------------------------------------------ 1 · Resumen: Nº 1 de 76 */
export function VizResumen({ t, color }: { t: number; color: string }) {
  const K = ((data as any).dist.conduccion_prog as { a: Record<string, number> }).a
  const vals = Object.entries(K).map(([id, v]) => ({ id: Number(id), v }))
  const X0 = 20, W = 600, mid = 260, r = 7.5
  const lo = Math.min(...vals.map(o => o.v)) - 0.12, hi = Math.max(...vals.map(o => o.v)) + 0.12
  const X = (v: number) => X0 + ((v - lo) / (hi - lo)) * W
  const placed: { x: number; y: number }[] = []
  const dots = [...vals].sort((a, b) => a.v - b.v).map(o => {
    const x = X(o.v); let y = mid
    for (let k = 0; k < 40; k++) { const off = Math.ceil(k / 2) * r * 1.9 * (k % 2 ? -1 : 1); y = mid + off; if (!placed.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < (2 * r) ** 2 * 0.95)) break }
    placed.push({ x, y }); return { ...o, x, y }
  })
  const A = dots.find(o => o.id === 2947)!
  const drop = E(t, V0 + 62, 24), lab = E(t, V0 + 80, 14)
  return (
    <Box>
      <Cap t={t} color={color} text="PROGRESIÓN POR CONDUCCIÓN · 76 DTS DE LIGA MX" />
      <svg width={VW} height={VH} style={{ position: 'absolute', inset: 0 }}>
        <line x1={X0} x2={X0 + W} y1={mid} y2={mid} stroke={C.grid2} strokeWidth={2} opacity={E(t, V0 - 10, 20)} />
        {dots.filter(d => d.id !== 2947).map((d, i) => {
          const s = E(t, V0 + i * 0.5, 26)
          return <circle key={d.id} cx={d.x} cy={d.y - (1 - s) * 220} r={r - 1} fill={C.ink} opacity={(0.14 + 0.2 * s) * s} />
        })}
        {t > V0 + 60 && <g>
          <line x1={A.x} x2={A.x} y1={A.y - 120} y2={A.y - (1 - drop) * 300 - r - 8} stroke={C.rose} strokeWidth={3} opacity={drop} />
          <circle cx={A.x} cy={A.y - (1 - drop) * 300} r={r + 7} fill={C.rose} stroke={C.paper} strokeWidth={4} />
        </g>}
        <g fontFamily={MONO} fontSize={15} fill={C.ink2} opacity={E(t, V0 + 10, 14)}>
          <text x={X0} y={mid + 120}>← menos</text><text x={X0 + W} y={mid + 120} textAnchor="end">más →</text>
        </g>
      </svg>
      <div style={{ position: 'absolute', right: 8, top: 62, textAlign: 'right', opacity: lab, transform: `translateY(${(1 - lab) * 10}px)`, lineHeight: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 17, color: C.rose, letterSpacing: '.1em' }}>GUILLERMO ALMADA</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 84, color: C.ink, letterSpacing: '-.03em', marginTop: 6 }}>Nº 1 de 76</div>
      </div>
      <Sfx at={V0 + 62} src="thud" vol={0.45} dur={24} />
      <Sfx at={V0 + 66} src="note4" vol={0.3} dur={42} />
    </Box>
  )
}

/* ------------------------------------------------------------ 2 · ¿DT o plantilla?: quién pone cada rasgo */
export function VizAtrib({ t, color }: { t: number; color: string }) {
  const rows = viz.atrib as { label: string; dt: number; jug: number; club: number; rival: number; ctx: number }[]
  const segs: [keyof (typeof rows)[0], string, string][] = [['dt', color, 'DT'], ['jug', C.ink, 'JUGADORES'], ['club', C.mintDeep, 'CLUB'], ['rival', C.ink3, 'RIVAL'], ['ctx', C.grid2, 'CONTEXTO']]
  return (
    <Box>
      <Cap t={t} color={color} text="QUIÉN PONE CADA RASGO · SU PARTE VS. LA DE SU PLANTILLA" />
      <div style={{ display: 'flex', gap: 16, marginTop: 14, fontFamily: MONO, fontSize: 12, letterSpacing: '.08em', color: C.ink2, opacity: E(t, V0 - 6, 14) }}>
        {segs.map(([, c, n]) => <span key={n}><span style={{ color: c }}>■</span> {n}</span>)}
      </div>
      {rows.map((r, i) => {
        const a = V0 + i * 12, w = E(t, a, 34), y = 96 + i * 74
        let x = 0
        return (
          <div key={r.label} style={{ position: 'absolute', left: 0, top: y, width: VW }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', opacity: E(t, a - 4, 12) }}>
              <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 20, color: C.ink }}>{r.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 17, color, fontWeight: 500, opacity: E(t, a + 30, 12) }}>{Math.round(r.dt * 100)}% DT</span>
            </div>
            <div style={{ position: 'relative', height: 22, marginTop: 8, borderRadius: 3, overflow: 'hidden', background: `${C.grid}` }}>
              {segs.map(([k, c]) => {
                const wpx = (r[k] as number) * VW * w, left = x; x += wpx
                return <div key={k} style={{ position: 'absolute', left, top: 0, width: wpx, height: '100%', background: c }} />
              })}
            </div>
            <Sfx at={a + 4} src={`pop${i}`} vol={0.2} dur={16} />
          </div>
        )
      })}
    </Box>
  )
}

/* ------------------------------------------------------------ 3 · Cómo juega: una jugada trazada pase por pase */
export function VizPlay({ t, color }: { t: number; color: string }) {
  const J = (data as any).jugada as { partido: string; fecha: string; min: number; xg: number; goleador: string; acc: [string, number, number, number, number, string][] }
  const w = VW, s = w / 105, y0 = 78, h = 68 * s
  const P = (x: number, y: number): [number, number] => [x * (105 / 120) * s, y0 + y * (68 / 80) * s]
  const T0 = V0 + 16, step = 10
  const line = (d: string, a: number, dur = 26) => <path d={d} fill="none" stroke={C.ink2} strokeWidth={1.8} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - E(t, a, dur)} />
  const X = (m: number) => m * s, Y = (m: number) => y0 + m * s
  const box = (x0: number, dir: 1 | -1, dep: number, wid: number) => `M ${X(x0)} ${Y(34 - wid / 2)} H ${X(x0 + dir * dep)} V ${Y(34 + wid / 2)} H ${X(x0)}`
  let ball: [number, number] = P(J.acc[0][1], J.acc[0][2])
  const segs = J.acc.map((a, i) => {
    const p = E(t, T0 + i * step, step - 1)
    const [x1, y1] = P(a[1], a[2]), [x2, y2] = P(a[3], a[4])
    if (p > 0) ball = [x1 + (x2 - x1) * p, y1 + (y2 - y1) * p]
    return { a, p, x1, y1, x2, y2, i, m: Math.hypot((a[3] - a[1]) * 105 / 120, (a[4] - a[2]) * 68 / 80) }
  })
  const done = T0 + J.acc.length * step
  const goal = E(t, done, 14)
  const names = new Map<string, [number, number]>()
  segs.forEach(sg => { if (sg.p > 0 && !names.has(sg.a[5])) names.set(sg.a[5], [sg.x1, sg.y1]) })
  return (
    <Box>
      <Cap t={t} color={color} text={`${J.partido.toUpperCase()} · ${J.fecha.toUpperCase()} · MIN ${J.min}′`} />
      <svg width={VW} height={VH} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {line(`M ${X(0)} ${Y(0)} H ${X(105)} V ${Y(68)} H ${X(0)} Z`, V0 - 10, 40)}
        {line(`M ${X(52.5)} ${Y(0)} V ${Y(68)}`, V0 + 6, 20)}
        {line(`M ${X(52.5) + 9.15 * s} ${Y(34)} A ${9.15 * s} ${9.15 * s} 0 1 1 ${X(52.5) - 9.15 * s} ${Y(34)} A ${9.15 * s} ${9.15 * s} 0 1 1 ${X(52.5) + 9.15 * s} ${Y(34)}`, V0 + 8, 30)}
        {line(box(0, 1, 16.5, 40.3), V0 + 4, 24)}{line(box(105, -1, 16.5, 40.3), V0 + 6, 24)}
        {line(box(0, 1, 5.5, 18.3), V0 + 10, 16)}{line(box(105, -1, 5.5, 18.3), V0 + 12, 16)}
        {segs.map(sg => sg.p > 0 && (
          <g key={sg.i}>
            <line x1={sg.x1} y1={sg.y1} x2={sg.x1 + (sg.x2 - sg.x1) * sg.p} y2={sg.y1 + (sg.y2 - sg.y1) * sg.p}
              stroke={sg.a[0] === 'Shot' ? C.rose : C.ink} strokeWidth={sg.a[0] === 'Shot' ? 3.5 : 2.6} strokeDasharray={sg.a[0] === 'Carry' ? '2 7' : undefined} strokeLinecap="round" />
            {sg.m > 15 && sg.p >= 1 && sg.a[0] !== 'Shot' && (
              <text x={(sg.x1 + sg.x2) / 2} y={(sg.y1 + sg.y2) / 2 - 12} textAnchor="middle" fontFamily={MONO} fontSize={14} fill={sg.a[0] === 'Carry' ? C.rose : C.ink2}>
                {sg.a[0] === 'Carry' ? `conducción ${Math.round(sg.m)} m` : `${Math.round(sg.m)} m`}
              </text>
            )}
          </g>
        ))}
        {[...names.entries()].map(([n, [x, y]]) => (
          <g key={n}>
            <circle cx={x} cy={y} r={8} fill={C.mint} stroke={C.ink} strokeWidth={1.8} />
            <text x={x} y={y < y0 + 30 * s * 0.45 ? y - 15 : y + 26} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={15} fill={C.ink}>{n}</text>
          </g>
        ))}
        <circle cx={ball[0]} cy={ball[1]} r={6} fill={C.white} stroke={C.ink} strokeWidth={2} />
        {goal > 0 && <circle cx={P(120, 40)[0]} cy={P(120, 40)[1]} r={14 + goal * 90} fill="none" stroke={C.rose} strokeWidth={2.5} opacity={1 - goal} />}
      </svg>
      <div style={{ position: 'absolute', left: 0, top: y0 + h + 14, display: 'flex', alignItems: 'baseline', gap: 16, opacity: goal }}>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: C.rose, letterSpacing: '-.03em' }}>Gol.</span>
        <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink2 }}>{J.goleador.toUpperCase()} · xG {J.xg.toFixed(2)}</span>
      </div>
      {J.acc.map((_, i) => <Sfx key={i} at={T0 + i * step} src={`note${[0, 2, 4, 5, 4, 2, 5, 6, 7][i % 9]}`} vol={0.2} dur={30} />)}
      <Sfx at={done} src="shutter-slr" vol={0.6} dur={12} />
    </Box>
  )
}

/* ------------------------------------------------------------ 4 · Jugadores: su once más repetido */
export function VizOnce({ t, color }: { t: number; color: string }) {
  const once = viz.once as [string, string][]
  // el orden de `once` es: portero, lateral izq., central izq., central der., lateral der., pivote izq., pivote der., extremo izq., mediapunta, extremo der., delantero
  const pos: [number, number][] = [[6, 34], [26, 10], [23, 26], [23, 42], [26, 58], [42, 25], [42, 43], [64, 10], [64, 34], [64, 58], [86, 34]]
  const s = VW / 105, y0 = 78
  const X = (m: number) => m * s, Y = (m: number) => y0 + m * s
  const line = (d: string, a: number, dur = 26) => <path d={d} fill="none" stroke={C.ink2} strokeWidth={1.6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - E(t, a, dur)} opacity={0.7} />
  const box = (x0: number, dir: 1 | -1, dep: number, wid: number) => `M ${X(x0)} ${Y(34 - wid / 2)} H ${X(x0 + dir * dep)} V ${Y(34 + wid / 2)} H ${X(x0)}`
  return (
    <Box>
      <Cap t={t} color={color} text="SU ONCE MÁS REPETIDO EN AMÉRICA · 4-2-3-1" />
      <svg width={VW} height={VH} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {line(`M ${X(0)} ${Y(0)} H ${X(105)} V ${Y(68)} H ${X(0)} Z`, V0 - 10, 40)}
        {line(`M ${X(52.5)} ${Y(0)} V ${Y(68)}`, V0 + 4, 20)}
        {line(box(0, 1, 16.5, 40.3), V0 + 4, 24)}{line(box(105, -1, 16.5, 40.3), V0 + 6, 24)}
        {pos.map(([mx, my], i) => {
          const a = V0 + 14 + i * 7, o = E(t, a, 12), x = X(mx), y = Y(my)
          return (
            <g key={i} opacity={o} transform={`translate(${x} ${y + (1 - o) * -18})`}>
              <circle r={12 + (1 - o) * 8} fill={color} stroke={C.ink} strokeWidth={2} />
              <text y={32} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={16} fill={C.ink}>{once[i][1]}</text>
            </g>
          )
        })}
      </svg>
      <div style={{ position: 'absolute', left: 0, top: y0 + 68 * s + 16, fontFamily: SANS, fontWeight: 700, fontSize: 44, color: C.ink, letterSpacing: '-.03em', opacity: E(t, V0 + 96, 16) }}>
        4-2-3-1 <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 400, color: C.ink2, letterSpacing: 0 }}>· ONCE TIPO, SEGÚN SUS TITULARES</span>
      </div>
      {pos.map((_, i) => <Sfx key={i} at={V0 + 14 + i * 7} src={`pop${i % 8}`} vol={0.2} dur={14} />)}
    </Box>
  )
}

/* ------------------------------------------------------------ 5 · Balón parado: a dónde manda sus córners */
export function VizBP({ t, color }: { t: number; color: string }) {
  const bp = viz.bp as { of: Record<string, number>; liga: Record<string, number>; corto: number[]; cpp: number[]; pc: number[] }
  const s = 10, ox = 205, oy = 96
  const X = (m: number) => ox + m * s, Y = (m: number) => oy + m * s
  /* [zona, metros laterales, metros de fondo, dónde va la etiqueta] */
  const zones: [string, number, number, 'above' | 'right' | 'below' | 'top'][] = [['Segundo palo', -8.5, 8, 'above'], ['Área chica', -0.5, 2.4, 'top'], ['Primer palo', 7.2, 6.2, 'right'], ['Punto penal', 0.5, 12.2, 'below'], ['Corto', 27, 4.2, 'below']]
  const line = (d: string, a: number, dur = 26) => <path d={d} fill="none" stroke={C.ink2} strokeWidth={1.8} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - E(t, a, dur)} />
  return (
    <Box>
      <Cap t={t} color={color} text="A DÓNDE MANDA SUS CÓRNERS · % DE ENVÍOS" />
      <svg width={VW} height={VH} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {line(`M ${X(-20.5)} ${Y(0)} H ${X(34)} V ${Y(29)}`, V0 - 10, 40)}
        {line(`M ${X(-20.15)} ${Y(0)} V ${Y(16.5)} H ${X(20.15)} V ${Y(0)}`, V0, 30)}
        {line(`M ${X(-9.16)} ${Y(0)} V ${Y(5.5)} H ${X(9.16)} V ${Y(0)}`, V0 + 6, 22)}
        <rect x={X(-3.66)} y={Y(0) - 8} width={7.32 * s} height={8} fill="none" stroke={C.ink} strokeWidth={2} opacity={E(t, V0 + 10, 10)} />
        <circle cx={X(0)} cy={Y(11)} r={3} fill={C.ink2} opacity={E(t, V0 + 12, 10)} />
        <g opacity={E(t, V0 + 6, 12)}><line x1={X(34)} y1={Y(0)} x2={X(34)} y2={Y(0) - 28} stroke={C.ink} strokeWidth={2} /><path d={`M ${X(34)} ${Y(0) - 28} l -16 6 l 16 6 z`} fill={color} /></g>
        {zones.map(([n, mx, my, where], i) => {
          const a = V0 + 22 + i * 14, g = E(t, a, 26), pc = bp.of[n] ?? 0, lg = bp.liga[n] ?? 0
          const r = Math.sqrt(pc) * 5.4, rl = Math.sqrt(lg) * 5.4, cx = X(mx), cy = Y(my), R = Math.max(r, rl)
          const lab = { above: [cx, cy - R - 26, 'middle'], below: [cx, cy + R + 20, 'middle'], right: [cx + R + 10, cy - 2, 'start'], top: [cx, Y(0) - 44, 'middle'] }[where] as [number, number, 'middle' | 'start']
          return (
            <g key={n}>
              <circle cx={cx} cy={cy} r={r * g} fill={color} fillOpacity={0.5} stroke={color} strokeWidth={2} />
              <circle cx={cx} cy={cy} r={rl * g} fill="none" stroke={C.ink} strokeWidth={1.6} strokeDasharray="4 4" />
              <g opacity={E(t, a + 14, 12)} fontFamily={MONO} fontSize={14} fill={C.ink}>
                <text x={lab[0]} y={lab[1]} textAnchor={lab[2]} fontWeight={500}>{n.toUpperCase()}</text>
                <text x={lab[0]} y={lab[1] + 17} textAnchor={lab[2]} fill={C.ink2}>{Math.round(pc)}% · liga {Math.round(lg)}%</text>
              </g>
            </g>
          )
        })}
      </svg>
      <div style={{ position: 'absolute', left: 0, top: 352, fontFamily: MONO, fontSize: 13, color: C.ink2, opacity: E(t, V0 + 20, 14) }}>● ALMADA · ◌ PROMEDIO DE LA LIGA</div>
      <div style={{ position: 'absolute', left: 0, top: 410, display: 'flex', gap: 34, opacity: E(t, V0 + 96, 16) }}>
        {[[`${bp.cpp[0].toFixed(1)}`, 'córners por partido', `liga ${bp.cpp[1].toFixed(1)}`], [`${Math.round(bp.corto[0])}%`, 'en corto', `liga ${Math.round(bp.corto[1])}%`], [`${Math.round(bp.pc[0])}%`, 'primer contacto propio', `liga ${Math.round(bp.pc[1])}%`]].map(([v, l, g]) => (
          <div key={l}><div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: C.ink, letterSpacing: '-.03em', lineHeight: 1 }}>{v}</div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: C.ink2, marginTop: 6 }}>{l.toUpperCase()}</div><div style={{ fontFamily: MONO, fontSize: 13, color }}>{g.toUpperCase()}</div></div>
        ))}
      </div>
      {zones.map((_, i) => <Sfx key={i} at={V0 + 22 + i * 14} src={`pop${[1, 3, 5, 2, 6][i]}`} vol={0.22} dur={16} />)}
    </Box>
  )
}

/* ------------------------------------------------------------ 6 · Laboratorio: 50,000 rejugadas */
export function VizLab({ t, color }: { t: number; color: string }) {
  const L = (data as any).lab as { equipo: string; rival: string; gf: number; gc: number; grid: number[][]; modal: [number, number]; l: number }
  const END = V0 + 70
  const n = Math.round(interpolate(t, [V0, END], [0, 50000], { ...clamp, easing: ease })), fill = E(t, V0, END - V0)
  const max = Math.max(...L.grid.flat()), cell = 60, GX = 70, GY = 196
  const pct = (v: number) => (v > 0 && v < 0.01 ? (v * 100).toFixed(1) : (v * 100).toFixed(0)) + '%'
  const real = L.grid[L.gf][L.gc]
  return (
    <Box>
      <Cap t={t} color={color} text={`${L.equipo.toUpperCase()} ${L.gf}–${L.gc} ${L.rival.toUpperCase()} · SU PARTIDO, REJUGADO`} />
      <div style={{ position: 'absolute', left: 0, top: 54, fontFamily: MONO, fontSize: 56, fontWeight: 500, letterSpacing: '-.04em', color: C.ink, opacity: E(t, V0 - 8, 12) }}>{n.toLocaleString('es-MX')} <span style={{ fontSize: 20, letterSpacing: 0, color: C.ink2 }}>rejugadas</span></div>
      <svg width={VW} height={VH} style={{ position: 'absolute', inset: 0 }}>
        {L.grid.slice(0, 5).map((row, a) => row.slice(0, 5).map((v, b) => {
          const isReal = a === L.gf && b === L.gc, mod = a === L.modal[0] && b === L.modal[1]
          return <g key={`${a}${b}`}>
            <rect x={GX + b * cell} y={GY + a * cell} width={cell - 5} height={cell - 5} rx={5} fill={color} opacity={0.07 + 0.88 * (v / max) * fill} />
            {fill > 0.98 && <text x={GX + b * cell + (cell - 5) / 2} y={GY + a * cell + cell / 2 + 3} textAnchor="middle" fontFamily={MONO} fontSize={14} fill={v / max > 0.5 ? C.white : C.ink}>{pct(v)}</text>}
            {mod && t > END + 8 && <rect x={GX + b * cell - 3} y={GY + a * cell - 3} width={cell + 1} height={cell + 1} rx={7} fill="none" stroke={C.ink} strokeWidth={2.2} strokeDasharray="5 4" />}
            {isReal && t > END + 30 && <rect x={GX + b * cell - 3} y={GY + a * cell - 3} width={cell + 1} height={cell + 1} rx={7} fill="none" stroke={C.rose} strokeWidth={3.5} />}
          </g>
        }))}
        <g fontFamily={MONO} fontSize={14} fill={C.ink2}>
          {[0, 1, 2, 3, 4].map(k => <text key={`r${k}`} x={GX - 14} y={GY + k * cell + cell / 2 + 3} textAnchor="end">{k}</text>)}
          {[0, 1, 2, 3, 4].map(k => <text key={`c${k}`} x={GX + k * cell + (cell - 5) / 2} y={GY - 10} textAnchor="middle">{k}</text>)}
          <text x={GX + 2.5 * cell} y={GY - 30} textAnchor="middle">GOLES {L.rival.toUpperCase()}</text>
          <text x={GX - 46} y={GY + 2.5 * cell} textAnchor="middle" transform={`rotate(-90 ${GX - 46} ${GY + 2.5 * cell})`}>GOLES {L.equipo.toUpperCase()}</text>
          {t > END + 8 && <text x={GX + 5 * cell + 6} y={GY + L.modal[0] * cell + cell / 2 + 3} fill={C.ink}>← más probable</text>}
          {t > END + 30 && <text x={GX + 5 * cell + 6} y={GY + L.gf * cell + cell / 2 + 3} fill={C.rose}>← pasó</text>}
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 0, top: 506, fontFamily: SANS, fontWeight: 600, fontSize: 21, color: C.ink, opacity: E(t, END + 30, 14) }}>
        Lo perdía {Math.round(L.l * 100)} de cada 100 veces. <b style={{ color: C.rose }}>Ganó {L.gf}–{L.gc}.</b>
      </div>
      <Sfx at={END + 8} src="note2" vol={0.25} dur={40} /><Sfx at={END + 30} src="thud" vol={0.45} dur={24} /><Sfx at={END + 31} src="note6" vol={0.3} dur={42} />
    </Box>
  )
}

/* ------------------------------------------------------------ 7 · Cara a cara: Almada contra su gemelo */
export function VizVs({ t, color }: { t: number; color: string }) {
  const rows = viz.vs as [string, number, number][]
  const X0 = 300, W = 330, xs = (v: number) => X0 + ((v + 1) / 2) * W
  const Y = '#f2b705', Bl = '#2f5fd0'
  return (
    <Box>
      <Cap t={t} color={color} text="RASGO POR RASGO · FRENTE AL PROMEDIO DE LA LIGA" />
      <div style={{ display: 'flex', gap: 22, marginTop: 14, fontFamily: MONO, fontSize: 13, letterSpacing: '.08em', color: C.ink2, opacity: E(t, V0 - 6, 14) }}>
        <span><span style={{ color: Y }}>●</span> ALMADA</span><span><span style={{ color: Bl }}>●</span> DEMICHELIS</span>
      </div>
      <svg width={VW} height={VH} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <line x1={xs(0)} x2={xs(0)} y1={80} y2={440} stroke={C.ink3} strokeDasharray="4 5" opacity={E(t, V0, 20)} />
        {rows.map(([lab, a, b], i) => {
          const y = 120 + i * 56, p = E(t, V0 + 6 + i * 12, 30)
          return (
            <g key={lab}>
              <text x={0} y={y + 5} fontFamily={SANS} fontWeight={600} fontSize={17} fill={C.ink} opacity={E(t, V0 + i * 12, 12)}>{lab}</text>
              <line x1={xs(b)} x2={xs(b) + (xs(a) - xs(b)) * p} y1={y} y2={y} stroke={C.ink3} strokeWidth={3} />
              <circle cx={xs(b)} cy={y} r={9} fill={Bl} opacity={E(t, V0 + 6 + i * 12, 10)} />
              <circle cx={xs(b) + (xs(a) - xs(b)) * p} cy={y} r={11} fill={Y} stroke={C.paper} strokeWidth={2} opacity={E(t, V0 + 6 + i * 12, 10)} />
              <text x={xs(a) + (a > b ? 18 : -18)} y={y + 5} textAnchor={a > b ? 'start' : 'end'} fontFamily={MONO} fontSize={14} fill={C.ink2} opacity={p > 0.95 ? 1 : 0}>{a > 0 ? '+' : ''}{a.toFixed(2)}</text>
            </g>
          )
        })}
      </svg>
      <div style={{ position: 'absolute', left: 0, top: 462, display: 'flex', alignItems: 'baseline', gap: 14, opacity: E(t, V0 + 82, 16) }}>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: C.ink, letterSpacing: '-.03em' }}>+0.68</span>
        <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink2 }}>PARECIDO CON MARTÍN DEMICHELIS · SU GEMELO DE ESTILO</span>
      </div>
      {rows.map((_, i) => <Sfx key={i} at={V0 + 6 + i * 12} src={`pop${[0, 2, 4, 1, 3, 5][i]}`} vol={0.2} dur={16} />)}
    </Box>
  )
}

/* ------------------------------------------------------------ 8 · Método: de dónde sale el estilo que se observa */
export function VizMetodo({ t, color }: { t: number; color: string }) {
  const src = [['Entrenador', 'ideas, entrenamiento', true], ['Plantilla', 'quién está en la cancha', false], ['Club', 'estructura, cultura', false], ['Contexto', 'rival, marcador, local', false]] as const
  const bx = 0, bw = 230, bh = 66, gap = 26, y0 = 92, tx = 410, ty = y0 + 2 * (bh + gap) - 34 - 18 + 28
  const stats: [number, string][] = [[42, 'indicadores de estilo'], [24300, 'tramos de partido'], [6, 'temporadas']]
  return (
    <Box>
      <Cap t={t} color={color} text="EL MODELO · QUÉ ENTRA Y QUÉ SALE" />
      <svg width={VW} height={VH} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {src.map(([n, , hot], i) => {
          const y = y0 + i * (bh + gap), a = V0 + i * 12, p = E(t, a + 16, 26)
          const x1 = bx + bw, y1 = y + bh / 2, x2 = tx, y2 = ty + 34
          return <path key={n} d={`M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`} fill="none" stroke={hot ? C.rose : C.ink2} strokeWidth={hot ? 3 : 1.8} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
        })}
      </svg>
      {src.map(([n, d, hot], i) => {
        const y = y0 + i * (bh + gap), o = E(t, V0 + i * 12, 16)
        return (
          <div key={n} style={{ position: 'absolute', left: bx, top: y + (1 - o) * 14, width: bw, height: bh, boxSizing: 'border-box', padding: '12px 16px', opacity: o,
            border: `2px solid ${hot ? C.rose : C.ink2}`, borderRadius: 8, background: hot ? `${C.rose}14` : C.paper }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 22, color: hot ? C.rose : C.ink }}>{n}</div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: C.ink2, marginTop: 2 }}>{d}</div>
          </div>
        )
      })}
      <div style={{ position: 'absolute', left: tx, top: ty, width: 230, height: 68, boxSizing: 'border-box', padding: '12px 16px', border: `2.5px solid ${C.ink}`, borderRadius: 8, background: C.ink, opacity: E(t, V0 + 54, 16), transform: `scale(${0.94 + 0.06 * E(t, V0 + 54, 16)})` }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 22, color: C.paper }}>Estilo observado</div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: C.mint, marginTop: 2 }}>PPDA, pases, xG…</div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 440, display: 'flex', gap: 40 }}>
        {stats.map(([v, l], i) => {
          const val = Math.round(interpolate(t, [V0 + 56 + i * 6, V0 + 86 + i * 6], [0, v], { ...clamp, easing: ease }))
          return <div key={l} style={{ opacity: E(t, V0 + 54 + i * 6, 12) }}><div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: C.ink, letterSpacing: '-.03em', lineHeight: 1 }}>{val.toLocaleString('es-MX')}</div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: C.ink2, marginTop: 6 }}>{l.toUpperCase()}</div></div>
        })}
      </div>
      {src.map((_, i) => <Sfx key={i} at={V0 + i * 12} src={`pop${[0, 2, 4, 6][i]}`} vol={0.2} dur={16} />)}
      <Sfx at={V0 + 54} src="thud" vol={0.4} dur={24} /><Sfx at={V0 + 56} src="note0" vol={0.28} dur={42} />
    </Box>
  )
}

export const VIZ: Record<string, (p: { t: number; color: string }) => JSX.Element> = {
  resumen: VizResumen, dt: VizAtrib, fases: VizPlay, jugadores: VizOnce, bp: VizBP, sim: VizLab, vs: VizVs, metodo: VizMetodo,
}
