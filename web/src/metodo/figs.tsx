/* Figuras de la pestaña Método. Todas se dibujan con los tokens de color de index.css y, salvo los
   esquemas (marcados como tales), con datos reales de boot.json. */
import { useMemo, type ReactNode } from 'react'
import { useTip } from '../charts'
import { fmt, type Any } from '../lib'
import { L, LOCALE } from '../settings'
import { kpiLabel } from '../i18n/data'

export const C = {
  coach: 'var(--c-dt)', player: 'var(--c-plantilla)', club: 'var(--c-club)', opp: 'var(--c-rival)', ctx: 'var(--c-ctx)', residual: 'var(--c-resid)',
}
export const BLOCKS = ['coach', 'player', 'club', 'opp', 'ctx'] as const
export const blockName = (b: string) => ({
  coach: L('Entrenador', 'Coach'), player: L('Jugadores', 'Players'), club: 'Club', opp: L('Rival', 'Opponent'),
  ctx: L('Contexto', 'Context'), residual: L('Sin explicar', 'Unexplained'),
} as Record<string, string>)[b] ?? b

const tint = (c: string, p = 16) => `color-mix(in oklab, ${c} ${p}%, var(--surface))`

/** Marco de figura de artículo: «Figura N.» + pie. */
export function Fig({ n, title, children, note, className = '' }: { n: number; title: ReactNode; children: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <figure className={`mt-fig ${className}`}>
      <div className="mt-fig-body">{children}</div>
      <figcaption><b>{L('Figura', 'Figure')} {n}.</b> {title}{note && <span className="mt-fig-note"> {note}</span>}</figcaption>
    </figure>
  )
}

/* ------------------------------------------------------------ 1. confusión (esquema) */
function Node({ x, y, w = 150, h = 46, color, label, sub }: { x: number; y: number; w?: number; h?: number; color: string; label: string; sub?: string }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={10} fill={tint(color, 20)} stroke={color} strokeWidth={2} />
      <text x={x} y={sub ? y - 4 : y + 6} textAnchor="middle" fontSize={17} fontWeight={700} fill="var(--ink)">{label}</text>
      {sub && <text x={x} y={y + 15} textAnchor="middle" fontSize={12.5} fill="var(--ink-2)">{sub}</text>}
    </g>
  )
}
export function ConfoundFig() {
  const ah = (id: string, c: string) => (
    <marker id={id} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill={c} />
    </marker>
  )
  return (
    <svg viewBox="0 0 600 350" className="mt-svg" role="img" aria-label={L('Diagrama de causas del estilo observado', 'Diagram of the causes of observed style')}>
      <defs>{ah('mt-a-ink', 'var(--ink-3)')}{ah('mt-a-dt', 'var(--c-dt)')}</defs>
      {[[200, 80, 372, 158], [200, 175, 372, 175], [200, 270, 372, 192]].map(([x1, y1, x2, y2], i) => (
        <path key={i} d={`M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`} fill="none" stroke="var(--ink-3)" strokeWidth={2.2} markerEnd="url(#mt-a-ink)" />
      ))}
      <path d="M485 64 L485 132" stroke="var(--ink-3)" strokeWidth={2.2} markerEnd="url(#mt-a-ink)" />
      <path d="M485 284 L485 218" stroke="var(--ink-3)" strokeWidth={2.2} markerEnd="url(#mt-a-ink)" />
      <path d="M38 98 C 12 115, 12 140, 38 157" fill="none" stroke="var(--c-dt)" strokeWidth={2.6} strokeDasharray="6 4" markerEnd="url(#mt-a-dt)" markerStart="url(#mt-a-dt)" />
      <path d="M38 252 C 18 235, 18 215, 38 198" fill="none" stroke="var(--ink-3)" strokeWidth={1.8} strokeDasharray="3 4" markerEnd="url(#mt-a-ink)" />
      <Node x={115} y={80} w={170} h={54} color="var(--c-dt)" label={L('Entrenador', 'Coach')} sub={L('ideas, entrenamiento', 'ideas, training')} />
      <Node x={115} y={175} w={170} h={54} color="var(--c-plantilla)" label={L('Plantilla', 'Squad')} sub={L('quién está en cancha', 'who is on the pitch')} />
      <Node x={115} y={270} w={170} h={54} color="var(--c-club)" label="Club" sub={L('estadio, altura, directiva', 'stadium, altitude, board')} />
      <Node x={485} y={38} w={150} h={46} color="var(--c-rival)" label={L('Rival', 'Opponent')} />
      <Node x={485} y={310} w={210} h={54} color="var(--c-ctx)" label={L('Contexto', 'Context')} sub={L('marcador, minuto, localía', 'score, minute, venue')} />
      <rect x={375} y={138} width={220} height={74} rx={12} fill="var(--ink)" />
      <text x={485} y={170} textAnchor="middle" fontSize={18} fontWeight={800} fill="var(--bg)">{L('Estilo observado', 'Observed style')}</text>
      <text x={485} y={192} textAnchor="middle" fontSize={13} fill="var(--bg)" opacity={0.8}>{L('PPDA, posesión, verticalidad…', 'PPDA, possession, directness…')}</text>
      
    </svg>
  )
}

/* ------------------------------------------------------------ 2. tres fuentes de identificación (esquema) */
function Dot({ x, y, c, r = 7, label }: { x: number; y: number; c: string; r?: number; label?: string }) {
  return <g><circle cx={x} cy={y} r={r} fill={c} />{label && <text x={x} y={y + 3.6} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="var(--bg)">{label}</text>}</g>
}
export function IdentPanels() {
  const box = (x: number, label: string) => (
    <g>
      <rect x={x} y={26} width={120} height={84} rx={9} fill={tint('var(--c-club)', 12)} stroke="var(--c-club)" strokeWidth={1.5} />
      <text x={x + 60} y={17} textAnchor="middle" fontSize={13.5} fill="var(--ink-2)">{label}</text>
    </g>
  )
  const arrow = <path d="M136 68 L154 68" stroke="var(--ink-3)" strokeWidth={2} markerEnd="url(#mt-a-ink2)" />
  const defs = <defs><marker id="mt-a-ink2" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)" /></marker></defs>
  const sq = (x: number, y: number, k: number) => [0, 1, 2, 3].map(i => <rect key={i} x={x + i * 18} y={y} width={12} height={12} rx={2} fill="var(--c-plantilla)" opacity={k ? 0.55 : 1} />)
  const panels: { t: string; d: string; svg: ReactNode }[] = [
    {
      t: L('El entrenador cambia de club', 'The coach changes clubs'),
      d: L('Mismo entrenador, otro club y otros jugadores. Lo que se repite en los dos equipos viaja con él.', 'Same coach, a different club and different players. Whatever repeats at both teams travels with him.'),
      svg: <svg viewBox="0 0 290 120" className="mt-svg">{defs}{box(8, L('Club 1', 'Club 1'))}{box(162, L('Club 2', 'Club 2'))}{arrow}
        <Dot x={68} y={50} c="var(--c-dt)" r={11} label="A" /><Dot x={222} y={50} c="var(--c-dt)" r={11} label="A" />{sq(36, 78, 0)}{sq(190, 78, 1)}</svg>,
    },
    {
      t: L('El jugador cambia de entrenador', 'The player changes coach'),
      d: L('Mismo jugador con dos entrenadores. Lo que cambia en el equipo mientras él sigue en cancha no puede ser suyo.', 'The same player under two coaches. Whatever changes in the team while he stays on the pitch cannot be his.'),
      svg: <svg viewBox="0 0 290 120" className="mt-svg">{defs}{box(8, L('Temporada 1', 'Season 1'))}{box(162, L('Temporada 2', 'Season 2'))}{arrow}
        <Dot x={68} y={50} c="var(--c-dt)" r={11} label="A" /><Dot x={222} y={50} c="var(--c-dt)" r={11} label="B" />
        <rect x={56} y={76} width={24} height={16} rx={3} fill="var(--c-plantilla)" /><rect x={210} y={76} width={24} height={16} rx={3} fill="var(--c-plantilla)" />
        <text x={68} y={88} textAnchor="middle" fontSize={10} fontWeight={800} fill="var(--bg)">9</text><text x={222} y={88} textAnchor="middle" fontSize={10} fontWeight={800} fill="var(--bg)">9</text></svg>,
    },
    {
      t: L('Rotación y cambios', 'Rotation and substitutions'),
      d: L('Mismo entrenador y mismo partido, otro once. Cada sustitución abre un tramo nuevo con otros jugadores.', 'Same coach, same match, a different XI. Every substitution opens a new segment with different players.'),
      svg: <svg viewBox="0 0 290 120" className="mt-svg">
        <rect x={10} y={46} width={270} height={26} rx={6} fill="var(--surface-2)" />
        {[[10, 120, 1], [120, 190, 0.7], [190, 280, 0.45]].map(([a, b, o], i) => <rect key={i} x={a + 1.5} y={48} width={b - a - 3} height={22} rx={5} fill="var(--c-plantilla)" opacity={o} />)}
        {[120, 190].map(x => <g key={x}><line x1={x} y1={36} x2={x} y2={82} stroke="var(--ink)" strokeWidth={2} /><text x={x} y={30} textAnchor="middle" fontSize={11} fill="var(--ink-2)">⇄</text></g>)}
        <text x={10} y={96} fontSize={13} fill="var(--ink-3)">0'</text><text x={280} y={96} fontSize={13} fill="var(--ink-3)" textAnchor="end">90'</text>
        <text x={145} y={114} fontSize={13} fill="var(--ink-3)" textAnchor="middle">{L('3 tramos, 3 alineaciones', '3 segments, 3 line-ups')}</text>
        <Dot x={22} y={22} c="var(--c-dt)" r={11} label="A" /></svg>,
    },
  ]
  return (
    <div className="mt-ident">
      {panels.map((p, i) => (
        <div key={i} className="mt-ident-p">
          <div className="mt-ident-k">{String.fromCharCode(97 + i)}</div>
          {p.svg}
          <div className="mt-ident-t">{p.t}</div>
          <p>{p.d}</p>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ 2b. red de movilidad (datos reales) */
export function MobilityNet({ dts }: { dts: Any[] }) {
  const tip = useTip()
  const g = useMemo(() => {
    const W = 640, cx = W / 2, cy = W / 2, R = 248
    const clubM: Record<string, number> = {}
    dts.forEach(d => d.clubes.forEach((c: Any) => { clubM[c.club] = (clubM[c.club] || 0) + c.partidos }))
    // orden de clubes: el que reduce cruces sería ideal; alfabético es estable y legible
    const clubs = Object.keys(clubM).sort((a, b) => a.localeCompare(b))
    const pos: Record<string, [number, number, number]> = {}
    clubs.forEach((c, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / clubs.length; pos[c] = [cx + R * Math.cos(a), cy + R * Math.sin(a), a] })
    const movers: Any[] = [], stayers: Any[] = []
    const perClub: Record<string, number> = {}
    dts.forEach((d, i) => {
      const cl = d.clubes as Any[]
      if (cl.length > 1) {
        const tot = cl.reduce((s, c) => s + c.partidos, 0)
        let x = 0, y = 0
        cl.forEach(c => { x += pos[c.club][0] * c.partidos / tot; y += pos[c.club][1] * c.partidos / tot })
        // tirar un poco hacia el centro para despejar el anillo y separar puntos solapados
        const j = (i * 137.5) % 360 * Math.PI / 180
        x = cx + (x - cx) * 0.78 + 9 * Math.cos(j); y = cy + (y - cy) * 0.78 + 9 * Math.sin(j)
        movers.push({ ...d, x, y })
      } else {
        const c = cl[0].club, k = perClub[c] = (perClub[c] || 0) + 1
        const [, , a] = pos[c]
        const r = R - 26 - Math.floor((k - 1) / 3) * 13, da = ((k - 1) % 3 - 1) * 0.05
        stayers.push({ ...d, x: cx + r * Math.cos(a + da), y: cy + r * Math.sin(a + da) })
      }
    })
    return { W, clubs, pos, movers, stayers, cx, cy, R }
  }, [dts])
  const { W, clubs, pos, movers, stayers, cx, R } = g
  return (
    <div className="mt-net">
      <svg viewBox={`-120 -34 ${W + 240} ${W + 68}`} className="mt-svg" role="img" aria-label={L('Red de entrenadores y clubes', 'Network of coaches and clubs')}>
        <circle cx={cx} cy={g.cy} r={R} fill="none" stroke="var(--rule)" strokeDasharray="2 5" />
        {movers.map(m => m.clubes.map((c: Any) => (
          <line key={m.id + c.club} x1={m.x} y1={m.y} x2={pos[c.club][0]} y2={pos[c.club][1]} stroke="var(--c-dt)" strokeOpacity={0.35} strokeWidth={1 + Math.min(3, c.partidos / 40)} />
        )))}
        {stayers.map(s => <circle key={s.id} cx={s.x} cy={s.y} r={5} fill="var(--ink-3)" opacity={0.75}
          onMouseMove={e => tip.show(e, <>{s.nombre}<br />{s.clubes[0].club} · {s.partidos} {L('partidos', 'matches')}</>)} onMouseLeave={tip.hide} />)}
        {movers.map(m => <circle key={m.id} cx={m.x} cy={m.y} r={8} fill="var(--c-dt)" stroke="var(--surface)" strokeWidth={1.5}
          onMouseMove={e => tip.show(e, <>{m.nombre}<br />{m.clubes.map((c: Any) => `${c.club} (${c.partidos})`).join(' · ')}</>)} onMouseLeave={tip.hide} />)}
        {clubs.map(c => {
          const [x, y, a] = pos[c]
          const lx = cx + (R + 16) * Math.cos(a), ly = g.cy + (R + 16) * Math.sin(a)
          const anchor = Math.abs(Math.cos(a)) < 0.12 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'
          return (
            <g key={c}>
              <rect x={x - 10} y={y - 10} width={20} height={20} rx={5} fill="var(--c-club)" stroke="var(--surface)" strokeWidth={1.5} />
              <text x={lx} y={ly + (Math.sin(a) > 0.9 ? 14 : Math.sin(a) < -0.9 ? -4 : 6)} fontSize={19} textAnchor={anchor} fill="var(--ink-2)">{c}</text>
            </g>
          )
        })}
      </svg>
      <div className="mt-net-legend">
        <span><i style={{ background: 'var(--c-club)', borderRadius: 3 }} />Club</span>
        <span><i style={{ background: 'var(--c-dt)' }} />{L('Entrenador con 2 o más clubes', 'Coach with 2+ clubs')} ({movers.length})</span>
        <span><i style={{ background: 'var(--ink-3)' }} />{L('Un solo club', 'One club only')} ({stayers.length})</span>
      </div>
      {tip.el}
    </div>
  )
}

/* ------------------------------------------------------------ 3. esquema de la suma (sin datos) */
export function SumSketch() {
  const steps = [
    { k: 'base', v: 0, c: 'var(--ink-3)', l: L('Media liga', 'League mean') },
    { k: 'coach', v: 1.0, c: C.coach, l: L('DT', 'Coach') },
    { k: 'player', v: 1.5, c: C.player, l: L('Jugadores', 'Players') },
    { k: 'club', v: -0.5, c: C.club, l: 'Club' },
    { k: 'opp', v: -0.8, c: C.opp, l: L('Rival', 'Opponent') },
    { k: 'ctx', v: 0.6, c: C.ctx, l: L('Contexto', 'Context') },
    { k: 'eps', v: 0.35, c: C.residual, l: L('Ruido', 'Noise') },
  ]
  const W = 520, H = 262, y0 = 190, u = 46, bw = 54, gap = 9
  let acc = 0
  const bars = steps.map((s, i) => {
    const from = acc; acc += s.v
    return { ...s, x: 8 + i * (bw + gap), from, to: acc }
  })
  const total = acc
  const xT = 8 + steps.length * (bw + gap)
  const Y = (v: number) => y0 - v * u
  return (
    <svg viewBox={`0 0 ${W + 50} ${H}`} className="mt-svg" role="img" aria-label={L('Esquema: el valor observado como suma de aportes', 'Sketch: the observed value as a sum of contributions')}>
      <line x1={6} x2={W + 46} y1={y0} y2={y0} stroke="var(--rule)" strokeWidth={1.5} />
      {bars.map((b, i) => (
        <g key={b.k}>
          {b.k === 'base'
            ? <line x1={b.x} x2={b.x + bw} y1={y0} y2={y0} stroke="var(--ink-2)" strokeWidth={4} />
            : <rect x={b.x} y={Math.min(Y(b.from), Y(b.to))} width={bw} height={Math.abs(b.v) * u} rx={4} fill={b.c} />}
          {i < bars.length - 1 && <line x1={b.x + bw} x2={bars[i + 1].x} y1={Y(b.to)} y2={Y(b.to)} stroke="var(--ink-3)" strokeDasharray="3 3" />}
          <text x={b.x + bw / 2} y={y0 + 22} textAnchor="middle" fontSize={13.5} fill="var(--ink-2)">{b.l.split(' ').map((w, j) => <tspan key={j} x={b.x + bw / 2} dy={j ? 14 : 0}>{w}</tspan>)}</text>
          {b.k !== 'base' && <text x={b.x + bw / 2} y={b.v > 0 ? Y(b.to) - 7 : Y(b.to) + 15} textAnchor="middle" fontSize={18} fontWeight={700} fill={b.c}>{b.v > 0 ? '+' : '−'}</text>}
        </g>
      ))}
      <line x1={bars[bars.length - 1].x + bw} x2={xT} y1={Y(total)} y2={Y(total)} stroke="var(--ink-3)" strokeDasharray="3 3" />
      <rect x={xT} y={Y(total)} width={bw} height={total * u} rx={4} fill="var(--ink)" />
      <text x={xT + bw / 2} y={y0 + 22} textAnchor="middle" fontSize={13.5} fontWeight={700} fill="var(--ink)">{L('Observado', 'Observed')}</text>
      <text x={xT + bw / 2} y={Y(total) - 7} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--ink)">=</text>
    </svg>
  )
}

/* ------------------------------------------------------------ penalización por bloque */
export function LambdaBars({ lam }: { lam: Record<string, number> }) {
  const max = Math.log10(Math.max(...Object.values(lam)) * 1.6)
  return (
    <div className="mt-lam">
      {BLOCKS.map(b => (
        <div key={b} className="mt-lam-row">
          <span>{blockName(b)}</span>
          <span className="mt-lam-track"><span style={{ width: `${Math.max(3, (Math.log10(lam[b] + 1) / max) * 100)}%`, background: C[b] }} /></span>
          <b className="mono">λ = {fmt(lam[b], 0)}</b>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ 4. geometría de la cancha (umbrales reales) */
export function PitchGeometry({ F }: { F: Any }) {
  const p = F.pitch
  const lines = [
    { x: p.own_third_max_x, l: L('fin del tercio propio', 'end of own third'), c: 'var(--c-club)' },
    { x: F.pase_progresivo.min_end_x, l: L('fin mínimo de una acción progresiva; inicio de la zona PPDA', 'minimum end of a progressive action; start of the PPDA zone'), c: 'var(--c-dt)' },
    { x: p.opp_half_min_x, l: L('campo rival; recuperación alta', "opponent's half; high regain"), c: 'var(--c-rival)' },
    { x: p.final_third_min_x, l: L('último tercio; presión alta', 'final third; high press'), c: 'var(--c-plantilla)' },
  ]
  return (
    <div>
      <svg viewBox="-2 -7 124 89" className="mt-svg mt-pitch" role="img" aria-label={L('Umbrales del marco sobre la cancha', 'Framework thresholds on the pitch')}>
        <rect x={0} y={0} width={120} height={80} fill="var(--pitch)" rx={1} />
        <rect x={p.final_third_min_x} y={0} width={120 - p.final_third_min_x} height={80} fill="var(--c-plantilla)" opacity={0.1} />
        <rect x={0} y={p.wide_lane.y_low} width={120} height={p.wide_lane.y_high - p.wide_lane.y_low} fill="var(--ink)" opacity={0.035} />
        <g fill="none" stroke="var(--pitch-line)" strokeWidth={0.5}>
          <rect x={0} y={0} width={120} height={80} />
          <line x1={60} y1={0} x2={60} y2={80} /><circle cx={60} cy={40} r={10} />
          <rect x={0} y={18} width={18} height={44} /><rect x={102} y={18} width={18} height={44} />
        </g>
        <rect x={p.box.x_min} y={p.box.y_min} width={120 - p.box.x_min} height={p.box.y_max - p.box.y_min} fill="var(--c-ctx)" opacity={0.16} />
        {lines.map((ln, i) => (
          <g key={i}>
            <line x1={ln.x} x2={ln.x} y1={-1.5} y2={80} stroke={ln.c} strokeWidth={0.8} strokeDasharray={i % 2 ? '1.6 1' : undefined} />
            <text x={ln.x} y={-2.6} fontSize={3.2} fontWeight={700} textAnchor="middle" fill={ln.c}>{ln.x}</text>
          </g>
        ))}
        <defs><marker id="mt-a-p" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4} markerHeight={4} orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--ink)" /></marker></defs>
        <path d="M26 66 Q 42 58, 62 50" fill="none" stroke="var(--ink)" strokeWidth={0.9} markerEnd="url(#mt-a-p)" />
        <circle cx={26} cy={66} r={1.2} fill="var(--ink)" />
        <text x={28} y={73} fontSize={3} fill="var(--ink-2)">{L('acción progresiva', 'progressive action')}</text>
        <text x={111} y={16} fontSize={3} textAnchor="middle" fill="var(--ink-2)">{L('área', 'box')}</text>
        <text x={118} y={78} fontSize={3} textAnchor="end" fill="var(--ink-3)">{L('ataque →', 'attack →')}</text>
      </svg>
      <div className="mt-pitch-keys">
        {lines.map((ln, i) => <div key={i}><i style={{ background: ln.c }} /><b className="mono">x = {ln.x}</b> {ln.l}</div>)}
        <div><i style={{ background: 'var(--ink)' }} /><b>{L('Progresiva', 'Progressive')}</b> {L(`acerca el balón ≥ ${100 * F.pase_progresivo.min_gain_ratio}% al arco y termina en x ≥ ${F.pase_progresivo.min_end_x}`, `brings the ball ≥ ${100 * F.pase_progresivo.min_gain_ratio}% closer to goal and ends at x ≥ ${F.pase_progresivo.min_end_x}`)}</div>
        <div><i style={{ background: 'var(--ink-3)', opacity: 0.4 }} /><b>{L('Carril central', 'Central lane')}</b> {L(`y ${p.wide_lane.y_low}–${p.wide_lane.y_high}; fuera de él, banda`, `y ${p.wide_lane.y_low}–${p.wide_lane.y_high}; outside it, wide`)}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ 5a. reparto de varianza por indicador */
const ORDER = ['coach', 'player', 'club', 'opp', 'ctx', 'residual'] as const
const NEG = 0.2, POS = 1.2  // eje: partes negativas a la izquierda del cero; positivas pueden pasar de 100%
function ShareBar({ v }: { v: Any }) {
  let pos = 0, neg = 0
  const segs: { k: string; a: number; b: number }[] = []
  ORDER.forEach(k => {
    const x = v[k] ?? 0
    if (x >= 0) { segs.push({ k, a: pos, b: pos + x }); pos += x } else { segs.push({ k, a: neg + x, b: neg }); neg += x }
  })
  const sx = (t: number) => ((t + NEG) / (POS + NEG)) * 100
  return (
    <span className="mt-sb">
      {segs.map(s => s.b - s.a > 0.0005 && (
        <span key={s.k} style={{ left: `${sx(s.a)}%`, width: `${sx(s.b) - sx(s.a)}%`, background: C[s.k as keyof typeof C] }} />
      ))}
      <i style={{ left: `${sx(0)}%` }} />
    </span>
  )
}
export function VarianceChart({ glob }: { glob: Any }) {
  const tip = useTip()
  const rows = Object.entries(glob.varianza as Record<string, Any>).sort((a, b) => b[1].coach - a[1].coach)
  const label = (k: string) => kpiLabel(k, glob.kpis[k]?.etiqueta ?? k)
  const tipOf = (name: string, v: Any) => <>{name}<br />{ORDER.map(k => <span key={k} style={{ display: 'block' }}>{blockName(k)}: <b>{fmt(100 * v[k], 0)}%</b></span>)}</>
  const mean = glob.varianza_media
  const half = Math.ceil(rows.length / 2)
  const head = (
    <div className="mt-var-head">
      <span />
      <span className="mt-var-axis">{[0, 0.25, 0.5, 0.75, 1].map(t => <em key={t} style={{ left: `${((t + NEG) / (POS + NEG)) * 100}%` }}>{fmt(100 * t, 0)}%</em>)}</span>
      <span className="mt-var-c">{L('Entr.', 'Coach')}</span>
    </div>
  )
  return (
    <div className="mt-var">
      <div className="mt-var-row mt-var-mean" onMouseMove={e => tip.show(e, tipOf(L('Promedio de los indicadores', 'Average across indicators'), mean))} onMouseLeave={tip.hide}>
        <span>{L(`Promedio de los ${rows.length} indicadores`, `Average of the ${rows.length} indicators`)}</span><ShareBar v={mean} /><b className="mono">{fmt(100 * mean.coach, 0)}%</b>
      </div>
      <div className="mt-var-cols">
        {[rows.slice(0, half), rows.slice(half)].map((part, ci) => (
          <div key={ci}>
            {head}
            {part.map(([k, v]) => (
              <div key={k} className="mt-var-row" onMouseMove={e => tip.show(e, tipOf(label(k), v))} onMouseLeave={tip.hide}>
                <span title={label(k)}>{label(k)}</span><ShareBar v={v} /><b className="mono">{fmt(100 * v.coach, 0)}%</b>
              </div>
            ))}
          </div>
        ))}
      </div>
      {tip.el}
    </div>
  )
}
export function ShareLegend() {
  return (
    <div className="mt-legend">
      {ORDER.map(k => <span key={k}><i style={{ background: C[k] }} />{blockName(k)}</span>)}
    </div>
  )
}

/* ------------------------------------------------------------ 5b. tramo vs equipo-temporada */
export function LevelCompare({ glob }: { glob: Any }) {
  const seg = glob.varianza_segmento as Record<string, Any>
  const ks = Object.keys(seg)
  const segMean: Any = {}
  ORDER.forEach(c => { segMean[c] = ks.reduce((s, k) => s + seg[k][c], 0) / ks.length })
  const rows = [
    { l: L('Un tramo de ≥ 5 min', 'One segment (≥ 5 min)'), v: segMean },
    { l: L('Un equipo en una temporada', 'One team over a season'), v: glob.varianza_media },
  ]
  return (
    <div className="mt-lvl">
      {rows.map(r => (
        <div key={r.l} className="mt-lvl-row">
          <div className="mt-lvl-l">{r.l}</div>
          <div className="mt-lvl-bar">
            {ORDER.filter(k => r.v[k] > 0.004).map(k => (
              <span key={k} style={{ flexGrow: r.v[k], background: C[k] }} title={`${blockName(k)} ${fmt(100 * r.v[k], 0)}%`}>
                {r.v[k] > 0.08 && <em>{fmt(100 * r.v[k], 0)}%</em>}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ 5c. prueba de transferencia */
export function TransferHist({ tr, res }: { tr: Any[]; res: Any }) {
  const K = tr[0]?.n_clases ?? 70, bw = 5, nb = Math.ceil(K / bw)
  const cnt = (key: string) => { const h = Array(nb).fill(0); tr.forEach(t => { h[Math.min(nb - 1, Math.floor((t[key] - 1) / bw))]++ }); return h }
  const adj = cnt('rank_ajustado'), raw = cnt('rank_crudo')
  const chance = (tr.length * bw) / K
  const W = 520, H = 268, x0 = 34, y0 = 214, ymax = Math.max(...adj, ...raw) + 2
  const sx = (i: number) => x0 + (i * (W - x0 - 10)) / nb, bwp = (W - x0 - 10) / nb
  const sy = (v: number) => y0 - (v / ymax) * (y0 - 16)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-svg" role="img" aria-label={L('Histograma del puesto del entrenador verdadero', 'Histogram of the true coach’s rank')}>
      {[0, 5, 10, 15].filter(v => v <= ymax).map(v => <g key={v}><line x1={x0} x2={W - 10} y1={sy(v)} y2={sy(v)} stroke="var(--rule)" /><text x={x0 - 6} y={sy(v) + 4} fontSize={13} textAnchor="end" fill="var(--ink-3)">{v}</text></g>)}
      <rect x={sx(0)} y={16} width={sx(nb / 2) - sx(0)} height={y0 - 16} fill="var(--c-dt)" opacity={0.06} />
      {adj.map((v, i) => <rect key={i} x={sx(i) + 3} y={sy(v)} width={bwp - 6} height={y0 - sy(v)} rx={2} fill="var(--c-dt)" />)}
      <path d={raw.map((v, i) => `${i ? 'L' : 'M'}${sx(i)} ${sy(v)} L${sx(i + 1)} ${sy(v)}`).join(' ')} fill="none" stroke="var(--ink-2)" strokeWidth={1.6} />
      <line x1={x0} x2={W - 10} y1={sy(chance)} y2={sy(chance)} stroke="var(--c-plantilla)" strokeWidth={2} strokeDasharray="6 4" />
      <text x={W - 12} y={sy(chance) - 6} fontSize={13} textAnchor="end" fill="var(--c-plantilla)" fontWeight={700}>{L('azar', 'chance')} ({fmt(chance, 1)} {L('por barra', 'per bar')})</text>
      <line x1={x0} x2={W - 10} y1={y0} y2={y0} stroke="var(--ink-3)" />
      {Array.from({ length: nb }, (_, i) => i % 3 === 0 && <text key={i} x={sx(i) + bwp / 2} y={y0 + 16} fontSize={12} textAnchor="middle" fill="var(--ink-3)">{i * bw + 1}–{Math.min(K, (i + 1) * bw)}</text>)}
      <text x={(x0 + W) / 2} y={y0 + 40} fontSize={13} textAnchor="middle" fill="var(--ink-2)">{L(`Puesto del entrenador verdadero entre ${K} candidatos (1 = el más parecido)`, `Rank of the true coach among ${K} candidates (1 = most similar)`)}</text>
      <text x={sx(nb / 2) - 6} y={34} textAnchor="end" fontSize={13} fill="var(--c-dt)" fontWeight={700}>{L(`mitad superior: ${res.ajustado.mitad_superior} de ${res.etapas}`, `top half: ${res.ajustado.mitad_superior} of ${res.etapas}`)}</text>
    </svg>
  )
}

/* ------------------------------------------------------------ 5d. validación sintética */
export function SynthBars() {
  // tests/test_decomposition.py (salida verificada: corr=0.95 rmse_model=0.40 rmse_naive=1.02)
  const rows = [
    { l: L('Nuestro modelo', 'Our model'), v: 0.40, c: 'var(--c-dt)' },
    { l: L('Promedio simple por entrenador', 'Simple per-coach average'), v: 1.02, c: 'var(--ink-3)' },
  ]
  return (
    <div className="mt-syn">
      {rows.map(r => (
        <div key={r.l} className="mt-syn-row">
          <span>{r.l}</span>
          <span className="mt-syn-track"><span style={{ width: `${(r.v / 1.1) * 100}%`, background: r.c }} /></span>
          <b className="mono">{r.v.toFixed(2)}</b>
        </div>
      ))}
      <div className="mt-syn-ax">{L('Error típico (RMSE) al recuperar el efecto verdadero del entrenador, en σ. Menos es mejor.', 'Typical error (RMSE) recovering the true coach effect, in σ. Lower is better.')}</div>
    </div>
  )
}

/* ------------------------------------------------------------ 5e. índice de identificabilidad */
export function IdentWeights() {
  const w = [
    { k: L('Movilidad', 'Mobility'), v: 35, c: 'var(--c-dt)', d: L('clubes dirigidos (tope 3)', 'clubs coached (cap 3)') },
    { k: L('Conectividad', 'Connectivity'), v: 40, c: 'var(--c-plantilla)', d: L('minutos de jugadores con ≥ 450 min con otro DT', 'minutes by players with ≥ 450 min under another coach') },
    { k: L('Club compartido', 'Shared club'), v: 25, c: 'var(--c-club)', d: L('tiempo en clubes con otros DTs', 'time at clubs that had other coaches') },
  ]
  return (
    <div className="mt-iw">
      <div className="mt-iw-bar">{w.map(x => <span key={x.k} style={{ flexGrow: x.v, background: x.c }}><em>{x.v}%</em></span>)}</div>
      <div className="mt-iw-keys">{w.map(x => <div key={x.k}><i style={{ background: x.c }} /><b>{x.k}</b> <span>{x.d}</span></div>)}</div>
    </div>
  )
}
export function IdentHist({ dts }: { dts: Any[] }) {
  const vals = dts.map(d => d.identificabilidad).filter((v: Any) => v != null) as number[]
  const lo = 40, bw = 10, nb = 6
  const h = Array(nb).fill(0); vals.forEach(v => { h[Math.max(0, Math.min(nb - 1, Math.floor((v - lo) / bw)))]++ })
  const W = 420, H = 170, x0 = 30, y0 = 135, ym = Math.max(...h) + 2
  const sx = (i: number) => x0 + (i * (W - x0 - 6)) / nb, b = (W - x0 - 6) / nb
  const sy = (v: number) => y0 - (v / ym) * (y0 - 12)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-svg mt-svg-cap" role="img" aria-label={L('Distribución del índice de identificabilidad', 'Distribution of the identifiability index')}>
      {h.map((v, i) => <g key={i}><rect x={sx(i) + 3} y={sy(v)} width={b - 6} height={y0 - sy(v)} rx={2} fill={`color-mix(in oklab, var(--c-dt) ${35 + i * 13}%, var(--surface))`} />
        <text x={sx(i) + b / 2} y={sy(v) - 5} fontSize={11} textAnchor="middle" fill="var(--ink-2)">{v}</text>
        <text x={sx(i) + b / 2} y={y0 + 15} fontSize={10.5} textAnchor="middle" fill="var(--ink-3)">{lo + i * bw}–{lo + (i + 1) * bw}</text></g>)}
      <line x1={x0} x2={W - 6} y1={y0} y2={y0} stroke="var(--ink-3)" />
      <text x={(x0 + W) / 2} y={y0 + 32} fontSize={11.5} textAnchor="middle" fill="var(--ink-2)">{L(`Índice (0–100) de los ${vals.length} entrenadores con perfil`, `Index (0–100) for the ${vals.length} profiled coaches`)}</text>
    </svg>
  )
}

/* ------------------------------------------------------------ 6. jugadas tipo (frecuencias reales) */
export function ArchBars({ arq, label }: { arq: Record<string, Any>; label: (s: string) => string }) {
  const rows = Object.values(arq) as Any[]
  const tot = rows.reduce((s, r) => s + r.n, 0)
  const max = Math.max(...rows.map(r => r.n))
  return (
    <div className="mt-arch">
      {rows.sort((a, b) => b.n - a.n).map(r => (
        <div key={r.nombre} className="mt-arch-row">
          <span>{label(r.nombre)}</span>
          <span className="mt-arch-track"><span style={{ width: `${(r.n / max) * 100}%` }} /></span>
          <b className="mono">{fmt((100 * r.n) / tot, 0)}%</b>
        </div>
      ))}
      <div className="mt-syn-ax">{L(`${tot.toLocaleString(LOCALE)} posesiones en juego abierto`, `${tot.toLocaleString(LOCALE)} open-play possessions`)}</div>
    </div>
  )
}

/* ------------------------------------------------------------ 6b. mapa de estilos en miniatura (datos reales) */
const HUES = ['var(--c-dt)', 'var(--c-plantilla)', 'var(--c-club)', 'var(--c-rival)', 'var(--c-ctx)']
const soft = (a: number[]) => {
  const m = a.reduce((s, v) => s + v, 0) / a.length
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1
  return a.map(v => Math.asinh(((v - m) / sd) * 1.3))
}
export function MapMini({ mapa, label }: { mapa: Any; label: (s: string) => string }) {
  const tip = useTip()
  const P = mapa.puntos as Any[]
  const X = soft(P.map(p => p.x)), Y = soft(P.map(p => p.y))
  const ext = Math.max(...X.map(Math.abs), ...Y.map(Math.abs)) * 1.08
  const W = 300, H = 200
  const sx = (v: number) => W / 2 + (v / ext) * (W / 2 - 10), sy = (v: number) => H / 2 - (v / ext) * (H / 2 - 10)
  return (
    <div className="mt-mapmini">
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-svg" role="img" aria-label={L('Mapa de estilos', 'Style map')}>
        <line x1={W / 2} x2={W / 2} y1={4} y2={H - 4} stroke="var(--rule)" /><line x1={4} x2={W - 4} y1={H / 2} y2={H / 2} stroke="var(--rule)" />
        {P.map((p, i) => <circle key={p.id} cx={sx(X[i])} cy={sy(Y[i])} r={4.2} fill={HUES[p.grupo % HUES.length]} stroke="var(--surface)" strokeWidth={1}
          onMouseMove={e => tip.show(e, <>{p.nombre}<br />{label(mapa.grupos[p.grupo]?.nombre ?? '')}</>)} onMouseLeave={tip.hide} />)}
        <text x={W - 4} y={H - 4} fontSize={9} textAnchor="end" fill="var(--ink-3)">{label(mapa.ejes.x.positivo)} →</text>
        <text x={W / 2 + 4} y={11} fontSize={9} fill="var(--ink-3)">↑ {label(mapa.ejes.y.positivo)}</text>
      </svg>
      <div className="mt-net-legend">{mapa.grupos.map((g: Any) => <span key={g.id}><i style={{ background: HUES[g.id % HUES.length] }} />{label(g.nombre)} ({g.n})</span>)}</div>
      {tip.el}
    </div>
  )
}

/* ------------------------------------------------------------ 5.5 trasplante de estilo (estudio de eventos) */
/** Curva del estudio de eventos: puntaje medio por partido antes y después del cambio, con IC95 por evento. */
export function EventCurve({ T }: { T: Any }) {
  const S = T.sin_plantilla_todos, R = T.crudo_todos, win: number = T.params.WIN
  const W = 540, H = 300, x0 = 40, x1 = W - 12, y0 = 244, yt = 22
  const vals = [...S.curva_pre_lo, ...S.curva_pre_hi, ...S.curva_post_lo, ...S.curva_post_hi, S.nula_media, 0, 1].filter((v: Any) => v != null) as number[]
  const lo = Math.min(-0.5, Math.floor(Math.min(...vals) * 2) / 2), hi = Math.max(...vals) + 0.25
  const sx = (t: number) => x0 + ((t + win) / (2 * win)) * (x1 - x0)
  const sy = (v: number) => y0 - ((v - lo) / (hi - lo)) * (y0 - yt)
  const pre = (a: (number | null)[]) => a.map((v, i) => [i - win, v] as const)
  const post = (a: (number | null)[]) => a.map((v, i) => [i + 1, v] as const)
  const line = (pts: readonly (readonly [number, number | null])[]) => pts.filter(p => p[1] != null).map((p, i) => `${i ? 'L' : 'M'}${sx(p[0])} ${sy(p[1] as number)}`).join(' ')
  const band = (pts: [number, number][], up: number[], dn: number[]) => `M${pts.map(([t], i) => `${sx(t)} ${sy(up[i])}`).join(' L')} L${pts.map(([t], i) => `${sx(t)} ${sy(dn[i])}`).reverse().join(' L')} Z`
  const tPre = S.curva_pre.map((_: Any, i: number) => [i - win, 0] as [number, number]), tPost = S.curva_post.map((_: Any, i: number) => [i + 1, 0] as [number, number])
  const ticks = [lo, ...[-1, 0, 1, 2, 3].filter(v => v > lo && v < hi)]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-svg" role="img" aria-label={L('Estudio de eventos alrededor del cambio de entrenador', 'Event study around the coaching change')}>
      {ticks.map(v => <g key={v}><line x1={x0} x2={x1} y1={sy(v)} y2={sy(v)} stroke="var(--rule)" /><text x={x0 - 6} y={sy(v) + 4} fontSize={15} textAnchor="end" fill="var(--ink-3)">{fmt(v, v % 1 ? 1 : 0)}</text></g>)}
      <path d={band(tPre, S.curva_pre_hi, S.curva_pre_lo)} fill="var(--ink-3)" opacity={0.14} />
      <path d={band(tPost, S.curva_post_hi, S.curva_post_lo)} fill="var(--c-dt)" opacity={0.18} />
      <line x1={sx(0.5)} x2={sx(0.5)} y1={yt} y2={y0} stroke="var(--ink-2)" strokeDasharray="3 3" />
      <text x={sx(0.5) + 6} y={yt + 12} fontSize={15} fill="var(--ink-2)">{L('llega el DT nuevo', 'new coach arrives')}</text>
      <line x1={sx(1)} x2={x1} y1={sy(S.nula_media)} y2={sy(S.nula_media)} stroke="var(--c-plantilla)" strokeWidth={1.8} strokeDasharray="6 4" />
      <text x={x1 - 2} y={sy(S.nula_media) + 16} fontSize={15} textAnchor="end" fill="var(--c-plantilla)" fontWeight={700}>{L('cualquier otro DT (placebo)', 'any other coach (placebo)')}</text>
      <path d={line([...pre(R.curva_pre), ...post(R.curva_post)])} fill="none" stroke="var(--ink-3)" strokeWidth={1.4} />
      <path d={line(pre(S.curva_pre))} fill="none" stroke="var(--ink-2)" strokeWidth={2.2} />
      <path d={line(post(S.curva_post))} fill="none" stroke="var(--c-dt)" strokeWidth={2.6} />
      {post(S.curva_post).map(([t, v]) => v != null && <circle key={t} cx={sx(t)} cy={sy(v)} r={3} fill="var(--c-dt)" />)}
      <line x1={x0} x2={x1} y1={y0} y2={y0} stroke="var(--ink-3)" />
      {[-win, -10, -5, 1, 5, 10, win].map(t => <text key={t} x={sx(t)} y={y0 + 17} fontSize={15} textAnchor="middle" fill="var(--ink-3)">{t > 0 ? `+${t}` : t}</text>)}
      <text x={(x0 + x1) / 2} y={y0 + 40} fontSize={15.5} textAnchor="middle" fill="var(--ink-2)">{L('Partidos antes (−) y después (+) del cambio', 'Matches before (−) and after (+) the change')}</text>
    </svg>
  )
}

/** Gráfico de bosque: el mismo efecto bajo cada variante del diseño, con su IC95. */
export function TransplantForest({ T }: { T: Any }) {
  const rows: { l: string; v: number; lo?: number; hi?: number; c: string; note: string }[] = [
    { l: L('Principal: sin plantilla, rival ni contexto', 'Main: net of squad, opponent and context'), v: T.sin_plantilla_todos.efecto, lo: T.sin_plantilla_todos.ic95[0], hi: T.sin_plantilla_todos.ic95[1], c: 'var(--c-dt)', note: `n=${T.sin_plantilla_todos.n}` },
    { l: L('Estilo crudo, sin ajustar', 'Raw style, unadjusted'), v: T.crudo_todos.efecto, lo: T.crudo_todos.ic95[0], hi: T.crudo_todos.ic95[1], c: 'var(--ink-2)', note: `n=${T.crudo_todos.n}` },
    ...(T.sin_plantilla_mitad_temporada ? [{ l: L('Solo cambios a mitad de torneo', 'Mid-tournament changes only'), v: T.sin_plantilla_mitad_temporada.efecto, lo: T.sin_plantilla_mitad_temporada.ic95[0], hi: T.sin_plantilla_mitad_temporada.ic95[1], c: 'var(--c-dt)', note: `n=${T.sin_plantilla_mitad_temporada.n}` }] : []),
    { l: L('DT nuevo con ≥ 15 partidos en otros clubes', 'New coach with ≥ 15 matches elsewhere'), v: T.sensibilidad.otros15.efecto, c: 'var(--c-dt)', note: `n=${T.sensibilidad.otros15.n}` },
    { l: L(`Quitando un club a la vez (${T.sensibilidad.sin_un_club.n_clubes} variantes)`, `Dropping one club at a time (${T.sensibilidad.sin_un_club.n_clubes} variants)`), v: (T.sensibilidad.sin_un_club.efecto_min + T.sensibilidad.sin_un_club.efecto_max) / 2, lo: T.sensibilidad.sin_un_club.efecto_min, hi: T.sensibilidad.sin_un_club.efecto_max, c: 'var(--c-dt)', note: L('rango', 'range') },
    { l: L('Placebo: otro DT al azar en lugar del nuevo', 'Placebo: random coach instead of the new one'), v: T.sin_plantilla_todos.nula_media, hi: T.sin_plantilla_todos.nula_p95, lo: T.sin_plantilla_todos.nula_media, c: 'var(--c-plantilla)', note: L('media · p95', 'mean · p95') },
    { l: L('Placebo: fecha falsa sin cambio de DT', 'Placebo: fake date with no change'), v: T.placebo_tiempo.media, lo: T.placebo_tiempo.media_ic95[0], hi: T.placebo_tiempo.media_ic95[1], c: 'var(--ink-3)', note: `n=${T.placebo_tiempo.n}` },
  ]
  const all = rows.flatMap(r => [r.v, r.lo ?? r.v, r.hi ?? r.v])
  const lo = Math.min(-0.5, Math.floor(Math.min(...all) * 2) / 2), hi = Math.ceil(Math.max(...all) * 2) / 2 + 0.25
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  const ticks = [-1, 0, 1, 2, 3].filter(v => v >= lo && v <= hi)
  return (
    <div className="mt-forest">
      {rows.map(r => (
        <div key={r.l} className="mt-forest-row">
          <span className="mt-forest-l">{r.l}</span>
          <span className="mt-forest-track">
            <i className="mt-forest-zero" style={{ left: pos(0) }} />
            {r.lo != null && r.hi != null && <i className="mt-forest-ci" style={{ left: pos(r.lo), width: `calc(${pos(r.hi)} - ${pos(r.lo)})`, background: r.c }} />}
            <i className="mt-forest-pt" style={{ left: pos(r.v), background: r.c }} />
          </span>
          <b className="mono">{fmt(r.v, 2)}</b>
          <em>{r.note}</em>
        </div>
      ))}
      <div className="mt-forest-row mt-forest-ax">
        <span />
        <span className="mt-forest-track">{ticks.map(v => <em key={v} style={{ left: pos(v) }}>{v}</em>)}</span>
        <span /><span />
      </div>
    </div>
  )
}

/** Un punto por cambio de DT, ordenados por efecto; color = si supera su propio placebo. */
export function EventDots({ T, names }: { T: Any; names: Record<string, string> }) {
  const tip = useTip()
  const ev = useMemo(() => [...T.eventos].sort((a: Any, b: Any) => a.efecto_sin_plantilla - b.efecto_sin_plantilla), [T])
  const W = 540, H = 220, x0 = 34, x1 = W - 8, y0 = 182, yt = 12
  const vals = ev.map((e: Any) => e.efecto_sin_plantilla) as number[]
  const lo = Math.min(-1, Math.floor(Math.min(...vals))), hi = Math.ceil(Math.max(...vals))
  const sy = (v: number) => y0 - ((v - lo) / (hi - lo)) * (y0 - yt)
  const sx = (i: number) => x0 + ((i + 0.5) / ev.length) * (x1 - x0)
  const nm = (id: number, f: string) => names[String(id)] ?? f
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-svg" role="img" aria-label={L('Efecto por cambio de entrenador', 'Effect per coaching change')}>
        {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map(v => <g key={v}><line x1={x0} x2={x1} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? 'var(--ink-3)' : 'var(--rule)'} /><text x={x0 - 6} y={sy(v) + 4} fontSize={15} textAnchor="end" fill="var(--ink-3)">{v}</text></g>)}
        <line x1={x0} x2={x1} y1={sy(T.sin_plantilla_todos.nula_media)} y2={sy(T.sin_plantilla_todos.nula_media)} stroke="var(--c-plantilla)" strokeDasharray="6 4" strokeWidth={1.6} />
        {ev.map((e: Any, i: number) => {
          const sig = e.p_evento < 0.1
          return (
            <g key={`${e.club_id}-${e.date}`} onMouseMove={m => tip.show(m, <>{nm(e.old, e.old_n)} → <b>{nm(e.new, e.new_n)}</b><br />{e.club_n} · {e.date}<br />{L('efecto', 'effect')} <b>{fmt(e.efecto_sin_plantilla, 2)}</b> · {L('p del evento', 'event p')} {fmt(e.p_evento, 2)}</>)} onMouseLeave={tip.hide}>
              <rect x={sx(i) - (x1 - x0) / ev.length / 2} y={yt} width={(x1 - x0) / ev.length} height={y0 - yt} fill="transparent" />
              <line x1={sx(i)} x2={sx(i)} y1={sy(0)} y2={sy(e.efecto_sin_plantilla)} stroke={sig ? 'var(--c-dt)' : 'var(--ink-3)'} strokeWidth={2} />
              <circle cx={sx(i)} cy={sy(e.efecto_sin_plantilla)} r={4.6} fill={sig ? 'var(--c-dt)' : 'var(--surface)'} stroke={sig ? 'var(--c-dt)' : 'var(--ink-3)'} strokeWidth={1.6} />
            </g>
          )
        })}
        <text x={(x0 + x1) / 2} y={y0 + 24} fontSize={15.5} textAnchor="middle" fill="var(--ink-2)">{L(`${ev.length} cambios de entrenador, ordenados por efecto`, `${ev.length} coaching changes, sorted by effect`)}</text>
      </svg>
      {tip.el}
    </div>
  )
}
