import { useEffect, useMemo, useRef, useState } from 'react'
import { dataUrl, fmt, getJSON, jugadorCorto, matchColors, type Any } from './lib'
import { ClubName } from './charts'
import { L } from './settings'
import Info from './Info'
import { archLabel } from './i18n/data'

/* «Simular uno»: UNA realización animada del mismo modelo que las 50,000 rejugadas.
   - Tiros: los del partido real, en su minuto; cada posesión con tiro es gol con p = 1 − Π(1 − xG).
   - Resto: posesiones según las jugadas tipo del DT (sus secuencias reales de pases y conducciones);
     el rival usa jugadas sintéticas con la mezcla promedio de la liga.
   - Formas: posición media de cada titular del DT en ataque, defensa, transición ofensiva y
     transición defensiva (pipeline/shapes.py). Tras un robo, la siguiente posesión arranca en
     transición desde ese punto.
   Todo se precalcula como una línea de tiempo de segmentos (pausa → inicio → acciones → cierre),
   así la animación se puede pausar, acelerar o saltar al final sin perder coherencia. */

type Pt = [number, number]
type StepK = 'pass' | 'carry' | 'shot'
type Step = { k: StepK; a: Pt; b: Pt }
type End = 'gol' | 'tiro' | 'perdida' | 'fuera'
type Poss = { t: number; own: boolean; arch: string; trans: boolean; steps: Step[]; end: End; xg?: number }
type Seg = { kind: 'cut' | 'intro' | 'step' | 'outro'; p: number; s?: number; t0: number; dur: number; m0: number; m1: number }
type Phase = 'ataque' | 'defensa' | 'trans_of' | 'trans_def'

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const mir = (p: Pt): Pt => [120 - p[0], 80 - p[1]]
/** Duración (s de simulación) de cada acción: crece con la distancia para que nadie tenga que correr a velocidades imposibles. */
const stepDur = (s: Step) => {
  const d = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])
  return s.k === 'shot' ? 0.6 : s.k === 'pass' ? clamp(0.5 + d / 40, 0.6, 1.5) : clamp(0.55 + d / 13, 0.8, 2.2)
}
/** Velocidades máximas (unidades de cancha por s de simulación): resto, desmarque, portador, presión. */
const V_BASE = 9, V_RUN = 14, V_HOLD = 30, V_PRESS = 13
function pickW<T>(items: T[], w: number[]): T { const s = w.reduce((a, b) => a + b, 0); let r = Math.random() * s; for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i] } return items[items.length - 1] }

/** Posición base por puesto de la alineación (marco propio: ataca hacia x=120; derecha = y alta). */
const POS_XY: Record<string, Pt> = {
  'Goalkeeper': [6, 40], 'Right Back': [30, 70], 'Right Center Back': [22, 52], 'Center Back': [21, 40], 'Left Center Back': [22, 28], 'Left Back': [30, 10],
  'Right Wing Back': [40, 72], 'Left Wing Back': [40, 8], 'Right Defensive Midfield': [40, 49], 'Center Defensive Midfield': [38, 40], 'Left Defensive Midfield': [40, 31],
  'Right Center Midfield': [50, 52], 'Center Midfield': [48, 40], 'Left Center Midfield': [50, 28], 'Right Midfield': [52, 70], 'Left Midfield': [52, 10],
  'Right Attacking Midfield': [62, 55], 'Center Attacking Midfield': [62, 40], 'Left Attacking Midfield': [62, 25], 'Right Wing': [66, 70], 'Left Wing': [66, 10],
  'Right Center Forward': [74, 48], 'Center Forward': [76, 40], 'Left Center Forward': [74, 32], 'Secondary Striker': [70, 40],
}
/** Posición por fase a partir del puesto (cuando no hay datos del jugador con ese DT). */
function fromPos(pos: string, ph: Phase): Pt {
  const [x, y] = POS_XY[pos] ?? [48, 40]
  if (pos === 'Goalkeeper') return [ph === 'ataque' ? 10 : 6, 40]
  const k: Record<Phase, [number, number, number]> = { ataque: [1.05, 14, 1.05], defensa: [0.72, 4, 0.85], trans_of: [0.9, 8, 1], trans_def: [0.95, 12, 0.95] }
  const [m, b, ys] = k[ph]
  return [clamp(b + x * m, 6, 108), clamp(40 + (y - 40) * ys, 3, 77)]
}

/** Forma genérica 4-4-2 por fase (si no hay alineación). Marco propio: ataca hacia x=120. */
function genericShape(ph: Phase): Pt[] {
  const base: Pt[] = [[6, 40], [24, 12], [22, 31], [22, 49], [24, 68], [46, 10], [44, 31], [44, 49], [46, 70], [64, 32], [64, 48]]
  const k: Record<Phase, [number, number]> = { ataque: [1.05, 32], defensa: [0.62, 10], trans_of: [0.85, 18], trans_def: [0.8, 22] }
  return base.map(([x, y], i): Pt => (i === 0 ? [ph === 'ataque' ? 9 : 6, 40] : [clamp(k[ph][1] + (x - 6) * k[ph][0], 8, 108), 40 + (y - 40) * (ph === 'defensa' ? 0.85 : 1.05)]))
}

function stepsFromTemplate(seq: Any[]): Step[] {
  const out: Step[] = []
  seq.forEach(([t, x, y, ex, ey]: Any) => {
    if (t === 'Shot') out.push({ k: 'shot', a: [x, y], b: [120, 40 + rnd(-3, 3)] })
    else if (ex != null) out.push({ k: t === 'Carry' ? 'carry' : 'pass', a: [x, y], b: [ex, ey] })
  })
  for (let i = 1; i < out.length; i++) out[i].a = out[i - 1].b  // cada acción empieza donde terminó la anterior
  return out.map(s => ({ ...s, a: [clamp(s.a[0], 1, 119), clamp(s.a[1], 1, 79)] as Pt, b: [clamp(s.b[0], 1, 120), clamp(s.b[1], 1, 79)] as Pt }))
}

function syntheticSteps(arch: Any, start?: Pt): Step[] {
  const n = clamp(Math.round((arch?.pases_mediana ?? 3) + rnd(0, 2)), 2, 7)
  let p: Pt = start ?? [arch?.inicio_x ?? rnd(20, 45), rnd(10, 70)]
  const xEnd = Math.max(p[0] + 10, arch?.max_x ?? 70)
  const out: Step[] = []
  for (let i = 0; i < n; i++) {
    const carry = Math.random() < 0.3
    const nx = clamp(p[0] + (xEnd - p[0]) / (n - i) + rnd(-6, 8), 4, 112)
    const ny = clamp(p[1] + rnd(carry ? -8 : -22, carry ? 8 : 22), 4, 76)
    out.push({ k: carry ? 'carry' : 'pass', a: p, b: [nx, ny] }); p = [nx, ny]
  }
  return out
}

function buildMatch(art: Any, shots: number[][], fx?: { own: number; rival: number } | null): Poss[] {
  const arqs: Any[] = art.arquetipos || []
  const ex = art.arquetipos_ejemplos || {}
  const area = arqs.find(a => /pisa el área/i.test(a.nombre)) || arqs[0]
  const posShare = (art.huella?.find((h: Any) => h.kpi === 'posesion')?.crudo ?? 50) / 100
  const P: Poss[] = []
  // posesiones con tiro (reales)
  const groups = new Map<number, number[][]>()
  shots.forEach(s => { if (!groups.has(s[6])) groups.set(s[6], []); groups.get(s[6])!.push(s) })
  groups.forEach(ss => {
    const own = ss[0][3] === 1, last = ss[ss.length - 1]
    const p = 1 - ss.reduce((q, s) => q * (1 - (fx ? Math.min(0.97, s[2] * (own ? fx.own : fx.rival)) : s[2])), 1)
    const shotAt: Pt = [last[0], last[1]]
    const tpl = own ? ex[area?.id] : undefined
    let steps = tpl?.length ? stepsFromTemplate(tpl[Math.floor(Math.random() * tpl.length)]) : syntheticSteps(area, [rnd(35, 60), rnd(10, 70)])
    steps = steps.filter(s => s.k !== 'shot' && s.b[0] < shotAt[0] - 3).slice(-4)
    if (!steps.length) steps = [{ k: 'pass', a: [Math.max(40, shotAt[0] - rnd(20, 30)), clamp(shotAt[1] + rnd(-15, 15), 4, 76)], b: shotAt }]
    else steps.push({ k: Math.random() < 0.6 ? 'pass' : 'carry', a: steps[steps.length - 1].b, b: shotAt })
    const goal = Math.random() < p
    steps.push({ k: 'shot', a: shotAt, b: [120, goal ? 40 + rnd(-3, 3) : 40 + (Math.random() < 0.5 ? -1 : 1) * rnd(5, 11)] })
    P.push({ t: last[5], own, arch: area?.nombre ? archLabel(area.nombre) : L('Ataque', 'Attack'), trans: false, steps, end: goal ? 'gol' : 'tiro', xg: ss.reduce((a, s) => a + s[2], 0) })
  })
  // relleno según las jugadas tipo
  const pool = arqs.filter(a => !/pisa el área/i.test(a.nombre))
  for (let i = 0; i < 20 && pool.length; i++) {
    const own = Math.random() < posShare
    const a = pickW(pool, pool.map(x => Math.max(0.1, own ? x.dt_pct ?? 1 : x.liga_pct ?? 1)))
    const seqs = own ? ex[a.id] : undefined
    const steps = seqs?.length ? stepsFromTemplate(seqs[Math.floor(Math.random() * seqs.length)]).filter(s => s.k !== 'shot') : syntheticSteps(a)
    if (!steps.length) continue
    P.push({ t: rnd(1, 92), own, arch: archLabel(a.nombre), trans: false, steps, end: Math.random() < 0.85 ? 'perdida' : 'fuera' })
  }
  P.sort((a, b) => a.t - b.t)
  for (let i = 1; i < P.length; i++) if (P[i].t - P[i - 1].t < 1) P[i].t = P[i - 1].t + 1
  // «balón fuera» tiene que verse: el último pase sale por la banda más cercana
  // (o por la línea de fondo si la jugada ya estaba en el área rival)
  P.forEach(c => {
    if (c.end !== 'fuera') return
    const l = c.steps[c.steps.length - 1].b
    const outB: Pt = l[0] > 104 ? [120.5, clamp(l[1] + rnd(-12, 12), 6, 74)] : [clamp(l[0] + rnd(-4, 12), 4, 116), l[1] < 40 ? -0.5 : 80.5]
    c.steps.push({ k: 'pass', a: l, b: outB })
  })
  return P
}

function timeline(P: Poss[]): { segs: Seg[]; total: number } {
  const segs: Seg[] = []
  let t = 0, m = 0
  const push = (s: Omit<Seg, 't0'>) => { segs.push({ ...s, t0: t }); t += s.dur }
  P.forEach((p, i) => {
    // corte: fundido a negro + tarjeta con la jugada que viene + fundido de entrada
    push({ kind: 'cut', p: i, dur: 1.7, m0: p.t, m1: p.t }); m = p.t
    push({ kind: 'intro', p: i, dur: 0.6, m0: m, m1: m })
    p.steps.forEach((s, j) => { push({ kind: 'step', p: i, s: j, dur: stepDur(s), m0: m, m1: m + 0.12 }); m += 0.12 })
    push({ kind: 'outro', p: i, dur: p.end === 'gol' ? 2.2 : 1.2, m0: m, m1: m })
  })
  push({ kind: 'cut', p: P.length, dur: 1.2, m0: 90, m1: 90 })
  return { segs, total: t }
}

const cssVar = (n: string, d: string) => { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d } catch { return d } }

export default function MatchSim({ art, media, data, partido, fx }: { art: Any; media: Any; data: Any; partido: Any; fx?: { own: number; rival: number } | null }) {
  const shots: number[][] = data?.t || []
  const canvas = useRef<HTMLCanvasElement>(null)
  const [seed, setSeed] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [tau, setTau] = useState(0)
  const [formas, setFormas] = useState<Any | null>(null)
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useEffect(() => { getJSON(dataUrl('formas.json')).then((f: Any) => setFormas(f[art.id] || {})).catch(() => setFormas({})) }, [art.id])

  const P = useMemo(() => buildMatch(art, shots, fx), [art, shots, seed, fx]) // eslint-disable-line react-hooks/exhaustive-deps
  const { segs, total } = useMemo(() => timeline(P), [P])
  useEffect(() => { setTau(reduce ? total : 0); setPlaying(!reduce) }, [P, total, reduce])

  // once REAL de este partido (ambos equipos): cada jugador en su posición media por fase con este DT
  // (pipeline/shapes.py); si no hay datos suficientes, la posición de su puesto en la alineación
  const sortXI = (xi: Any[]) => [...(xi || [])].sort((a, b) => (a[1] === 'Goalkeeper' ? -1 : b[1] === 'Goalkeeper' ? 1 : 0))
  const own = useMemo(() => {
    const xi = sortXI(data?.xi)
    if (xi.length !== 11) return { ataque: genericShape('ataque'), defensa: genericShape('defensa'), trans_of: genericShape('trans_of'), trans_def: genericShape('trans_def'), names: [] as string[] }
    const pp = formas?.p || {}
    const ph = (f: Phase): Pt[] => xi.map(([pid, pos]: Any) => (pp[pid]?.[f] as Pt) ?? fromPos(pos, f))
    return { ataque: ph('ataque'), defensa: ph('defensa'), trans_of: ph('trans_of'), trans_def: ph('trans_def'), names: xi.map(([pid, , n]: Any) => jugadorCorto(pid, n)) }
  }, [formas, data])
  const riv = useMemo(() => {
    const xi = sortXI(data?.xr)
    if (xi.length !== 11) return { ataque: genericShape('ataque'), defensa: genericShape('defensa'), trans_of: genericShape('trans_of'), trans_def: genericShape('trans_def'), names: [] as string[] }
    const ph = (f: Phase): Pt[] => xi.map(([, pos]: Any) => fromPos(pos, f))
    return { ataque: ph('ataque'), defensa: ph('defensa'), trans_of: ph('trans_of'), trans_def: ph('trans_def'), names: xi.map(([pid, , n]: Any) => jugadorCorto(pid, n)) }
  }, [data])

  // estado derivado del tiempo τ
  const segIdx = useMemo(() => { const i = segs.findIndex(s => tau < s.t0 + s.dur); return i < 0 ? segs.length - 1 : i }, [segs, tau])
  const seg = segs[segIdx]
  const f = clamp((tau - seg.t0) / seg.dur, 0, 1)
  const cur: Poss | undefined = P[seg.p]
  const minute = seg.m0 + (seg.m1 - seg.m0) * f
  const doneT = tau >= total - 1e-6
  const score = useMemo(() => {
    let a = 0, b = 0
    segs.forEach(s => { if (s.kind === 'outro' && P[s.p]?.end === 'gol' && tau >= s.t0 + 0.2) { if (P[s.p].own) a++; else b++ } })
    return [a, b]
  }, [segs, P, tau])
  const teamName = (o: boolean) => (o ? partido.club : partido.rival)
  // colores principales de cada club (si se parecen, el rival viste de blanco)
  const teamCols = useMemo(() => matchColors(partido.club, partido.rival, media).map(c => (c.startsWith('var(') ? cssVar(c.slice(4, -1), '#2a78d6') : c)) as [string, string], [partido, media])
  const events = useMemo(() => {
    const ev: { m: number; own: boolean; txt: string; cls?: string }[] = []
    segs.forEach(s => {
      const p = P[s.p]
      if (!p || tau < s.t0) return
      if (s.kind === 'intro') ev.push({ m: s.m0, own: p.own, txt: L(`Jugada ${s.p + 1}: ${p.arch}`, `Move ${s.p + 1}: ${p.arch}`) })
      if (s.kind === 'outro') ev.push({ m: s.m0, own: p.end === 'perdida' || p.end === 'fuera' ? !p.own : p.own,
        txt: p.end === 'gol' ? `${L('¡Gol!', 'Goal!')} (xG ${fmt(p.xg ?? 0, 2)})` : p.end === 'tiro' ? L(`Tiro sin gol de ${teamName(p.own)} (xG ${fmt(p.xg ?? 0, 2)})`, `${teamName(p.own)} shot, no goal (xG ${fmt(p.xg ?? 0, 2)})`) : p.end === 'perdida' ? L('Recupera el balón', 'Wins the ball back') : L('saca tras balón fuera', 'restart after the ball goes out'), cls: p.end === 'gol' ? 'goal' : '' })
    })
    return ev.slice(-14).reverse()
  }, [segs, P, tau]) // eslint-disable-line react-hooks/exhaustive-deps

  // posiciones suavizadas (fuera de React para 60 fps)
  const pos = useRef<{ A: Pt[]; B: Pt[] } | null>(null)
  const vel = useRef<{ A: Pt[]; B: Pt[] } | null>(null)
  const asg = useRef(new Map<string, number>())
  const last = useRef(performance.now())
  const drawRef = useRef<(dt: number) => void>(() => {})
  useEffect(() => {
    let raf = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last.current) / 1000); last.current = now
      if (playing) setTau(v => (v >= total ? v : Math.min(total, v + dt * speed)))
      drawRef.current(dt * Math.max(1, speed))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, total])
  useEffect(() => { if (doneT) setPlaying(false) }, [doneT])

  function ballAt(): { ball: Pt } {
    if (!cur) return { ball: [60, 40] }
    const toWorld = (p: Pt): Pt => (cur.own ? p : mir(p))
    if (seg.kind === 'cut' || seg.kind === 'intro') return { ball: toWorld(cur.steps[0].a) }
    if (seg.kind === 'step') {
      const s = cur.steps[seg.s!]
      const e = s.k === 'pass' ? f * f * (3 - 2 * f) : f
      return { ball: toWorld([s.a[0] + (s.b[0] - s.a[0]) * e, s.a[1] + (s.b[1] - s.a[1]) * e]) }
    }
    return { ball: toWorld(cur.steps[cur.steps.length - 1].b) }
  }

  drawRef.current = (dt: number) => {
    const c = canvas.current
    if (!c) return
    const W = c.clientWidth, H = c.clientHeight, dpr = window.devicePixelRatio || 1
    if (!W) return
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const sx = W / 124, sy = H / 84, X = (x: number) => (x + 2) * sx, Y = (y: number) => (y + 2) * sy
    const [blue, orange] = teamCols
    g.fillStyle = cssVar('--pitch', '#1d2922'); g.fillRect(0, 0, W, H)
    g.strokeStyle = cssVar('--pitch-line', '#3b4b42'); g.lineWidth = 1.2
    g.strokeRect(X(0), Y(0), 120 * sx, 80 * sy)
    g.beginPath(); g.moveTo(X(60), Y(0)); g.lineTo(X(60), Y(80)); g.stroke()
    g.beginPath(); g.arc(X(60), Y(40), 10 * sx, 0, Math.PI * 2); g.stroke()
    g.strokeRect(X(0), Y(18), 18 * sx, 44 * sy); g.strokeRect(X(102), Y(18), 18 * sx, 44 * sy)
    g.strokeRect(X(0), Y(30), 6 * sx, 20 * sy); g.strokeRect(X(114), Y(30), 6 * sx, 20 * sy)
    g.strokeRect(X(-1.5), Y(36), 1.5 * sx, 8 * sy); g.strokeRect(X(120), Y(36), 1.5 * sx, 8 * sy)

    const { ball } = ballAt()
    // fase de cada equipo: tras un robo, los dos primeros movimientos son de transición
    const inTrans = !!cur?.trans && (seg.kind === 'intro' || (seg.kind === 'step' && (seg.s ?? 0) < 2))
    const ownAtt = cur ? cur.own : true
    const phA: Phase = ownAtt ? (inTrans ? 'trans_of' : 'ataque') : (inTrans ? 'trans_def' : 'defensa')
    const phB: Phase = ownAtt ? (inTrans ? 'trans_def' : 'defensa') : (inTrans ? 'trans_of' : 'ataque')
    // la forma se desplaza con el balón: el bloque que defiende bascula más que el que ataca
    const shift = (base: Pt[], mine: boolean, attacking: boolean): Pt[] => {
      const b = mine ? ball : mir(ball)
      const mx = base.slice(1).reduce((s, p) => s + p[0], 0) / 10
      const kx = attacking ? 0.22 : 0.3, ky = attacking ? 0.15 : 0.3
      const out = base.map((p, i): Pt => (i === 0 ? [p[0], clamp(40 + (b[1] - 40) * 0.15, 34, 46)] : [clamp(p[0] + (b[0] - mx) * kx, 4, 116), clamp(p[1] + (b[1] - 40) * ky, 3, 77)]))
      return mine ? out : out.map(mir)
    }
    const tA = shift(own[phA], true, ownAtt), tB = shift(riv[phB], false, !ownAtt)
    if (!pos.current || seg.kind === 'cut') {
      pos.current = { A: tA.map(p => [...p] as Pt), B: tB.map(p => [...p] as Pt) }
      vel.current = { A: tA.map((): Pt => [0, 0]), B: tB.map((): Pt => [0, 0]) }
    }
    const vmA = tA.map(() => V_BASE), vmB = tB.map(() => V_BASE)
    // quién tiene el balón y quién lo recibe: se decide una vez por jugada (con las posiciones del momento)
    // y el receptor del siguiente pase empieza a desmarcarse desde la acción anterior, a velocidad limitada
    let carrier = -1
    if (cur && seg.kind !== 'cut') {
      const att = ownAtt ? tA : tB, def = ownAtt ? tB : tA
      const attNow = ownAtt ? pos.current.A : pos.current.B, defNow = ownAtt ? pos.current.B : pos.current.A
      const vAtt = ownAtt ? vmA : vmB, vDef = ownAtt ? vmB : vmA
      const W_ = (p: Pt): Pt => (cur.own ? p : mir(p))
      const back = ownAtt ? -1.2 : 1.2
      const nearest = (arr: Pt[], p: Pt, excl: number[]) => {
        let bi = 1, bd = 1e9
        arr.forEach((q, i) => { if (i === 0 || excl.includes(i)) return; const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; bi = i } })
        return bi
      }
      const memo = (k: string, fn: () => number) => { const m = asg.current, kk = `${seed}:${seg.p}:${k}`; if (!m.has(kk)) m.set(kk, fn()); return m.get(kk)! }
      const isOut = (k: number) => cur.end === 'fuera' && k === cur.steps.length - 1
      const receiver = (j: number): number => memo(`r${j}`, () => nearest(attNow, W_(cur.steps[j].b), [holder(j)]))
      const holder = (j: number): number => (j <= 0 ? memo('h0', () => nearest(attNow, W_(cur.steps[0].a), []))
        : cur.steps[j - 1].k === 'pass' && !isOut(j - 1) ? receiver(j - 1) : holder(j - 1))
      const last = cur.steps.length - 1
      const j = seg.kind === 'step' ? seg.s! : seg.kind === 'intro' ? 0 : last
      const st = seg.kind === 'step' ? cur.steps[j] : null
      const h = seg.kind === 'outro' ? (cur.steps[last].k === 'pass' && !isOut(last) ? receiver(last) : holder(last)) : holder(j)
      // portador: pegado al balón al conducir; al pasar se queda donde soltó el balón
      const ls = cur.steps[last]
      const stay = st && st.k !== 'carry' ? st.a : seg.kind === 'outro' && (ls.k === 'shot' || isOut(last)) ? ls.a : null
      att[h] = stay ? [W_(stay)[0] + back, W_(stay)[1]] : [ball[0] + back, ball[1]]
      vAtt[h] = V_HOLD
      carrier = h
      let rc = -1
      if (st?.k === 'pass' && !isOut(j)) {
        rc = receiver(j)
        const tg = W_(st.b)
        att[rc] = [tg[0] + back * 0.8, tg[1]]; vAtt[rc] = V_RUN
        if (f >= 0.5) { carrier = rc; vAtt[rc] = f > 0.85 ? V_HOLD : V_RUN }
      }
      // desmarque anticipado del receptor del próximo pase: va hacia la zona donde lo recibirá
      if (seg.kind !== 'outro') {
        const from = seg.kind === 'intro' ? 0 : j + 1
        const nk = cur.steps.findIndex((s, k) => k >= from && s.k === 'pass' && !isOut(k))
        if (nk >= 0) {
          const r2 = receiver(nk)
          if (r2 !== h && r2 !== rc) {
            const tg = W_(cur.steps[nk].b), w = 0.7
            att[r2] = [att[r2][0] + (tg[0] - att[r2][0]) * w, att[r2][1] + (tg[1] - att[r2][1]) * w]; vAtt[r2] = V_RUN
          }
        }
      }
      // presión: el defensor más cercano al balón (uno por acción)
      const pr = memo(`p${seg.kind}${j}`, () => nearest(defNow, ball, []))
      const won = seg.kind === 'outro' && cur.end === 'perdida'
      def[pr] = won ? [ball[0] - back, ball[1]] : [ball[0] - back * 2.5, ball[1] + 1.5]
      vDef[pr] = won ? V_HOLD : V_PRESS
    }
    // movimiento suave: cada jugador acelera hacia su objetivo con velocidad máxima limitada
    const move = (P: Pt[], V: Pt[], T: Pt[], vm: number[]) => P.map((p, i): Pt => {
      const gain = vm[i] >= V_HOLD ? 8 : 3  // el portador va pegado al balón; el resto llega frenando
      let vx = (T[i][0] - p[0]) * gain, vy = (T[i][1] - p[1]) * gain
      const sp = Math.hypot(vx, vy)
      if (sp > vm[i]) { vx *= vm[i] / sp; vy *= vm[i] / sp }
      const k = Math.min(1, dt * (gain > 3 ? 14 : 7))
      V[i] = [V[i][0] + (vx - V[i][0]) * k, V[i][1] + (vy - V[i][1]) * k]
      return [p[0] + V[i][0] * dt, p[1] + V[i][1] * dt]
    })
    pos.current.A = move(pos.current.A, vel.current!.A, tA, vmA)
    pos.current.B = move(pos.current.B, vel.current!.B, tB, vmB)

    // anotaciones de la posesión en curso: pase (línea + flecha), conducción (punteada), tiro (gruesa + xG)
    if (cur && seg.kind !== 'cut') {
      const col = cur.own ? blue : orange
      const W_ = (p: Pt): Pt => (cur.own ? p : mir(p))
      cur.steps.forEach((s, j) => {
        const st = segs.find(q => q.kind === 'step' && q.p === seg.p && q.s === j)
        if (!st || tau < st.t0) return
        const alpha = clamp(1 - (tau - st.t0) / 3.2, 0.2, 1)
        const a = W_(s.a), b0 = W_(s.b)
        const prog = clamp((tau - st.t0) / st.dur, 0, 1)
        const b: Pt = [a[0] + (b0[0] - a[0]) * prog, a[1] + (b0[1] - a[1]) * prog]
        g.globalAlpha = alpha
        g.strokeStyle = s.k === 'shot' ? '#ffffff' : col
        g.lineWidth = s.k === 'shot' ? 3.4 : 2
        g.setLineDash(s.k === 'carry' ? [5, 4] : [])
        g.beginPath(); g.moveTo(X(a[0]), Y(a[1])); g.lineTo(X(b[0]), Y(b[1])); g.stroke(); g.setLineDash([])
        if (s.k === 'pass' && prog >= 1) {
          const ang = Math.atan2(Y(b[1]) - Y(a[1]), X(b[0]) - X(a[0])), L = 9
          g.fillStyle = col; g.beginPath(); g.moveTo(X(b[0]), Y(b[1]))
          g.lineTo(X(b[0]) - L * Math.cos(ang - 0.45), Y(b[1]) - L * Math.sin(ang - 0.45)); g.lineTo(X(b[0]) - L * Math.cos(ang + 0.45), Y(b[1]) - L * Math.sin(ang + 0.45)); g.fill()
        }
        if (s.k === 'shot' && cur.xg != null) {
          g.font = `700 ${Math.max(12, 2.3 * sx)}px system-ui`; g.fillStyle = '#fff'; g.textAlign = 'center'
          g.fillText(`xG ${fmt(cur.xg, 2)}`, X(a[0]), Y(a[1]) - 3.2 * sy)
        }
        g.globalAlpha = 1
      })
      // robo: ✕ roja con onda donde se perdió
      if (seg.kind === 'outro' && cur.end === 'perdida') {
        const p = W_(cur.steps[cur.steps.length - 1].b), r = 2.4 * sx
        g.strokeStyle = '#ff4d4d'; g.lineWidth = 3
        g.beginPath(); g.moveTo(X(p[0]) - r, Y(p[1]) - r); g.lineTo(X(p[0]) + r, Y(p[1]) + r); g.moveTo(X(p[0]) + r, Y(p[1]) - r); g.lineTo(X(p[0]) - r, Y(p[1]) + r); g.stroke()
        g.beginPath(); g.arc(X(p[0]), Y(p[1]), r * (1.2 + 1.2 * f), 0, Math.PI * 2); g.globalAlpha = 1 - f; g.stroke(); g.globalAlpha = 1
      }
    }
    // jugadores (borde blanco = quien lleva el balón)
    const dot = (p: Pt, col: string, gk: boolean, hl: boolean) => {
      g.beginPath(); g.arc(X(p[0]), Y(p[1]), Math.max(4.5, 1.6 * sx), 0, Math.PI * 2); g.fillStyle = col; g.fill()
      g.lineWidth = hl ? 3 : 1.5; g.strokeStyle = hl ? '#ffffff' : gk ? '#e8e8e8' : 'rgba(0,0,0,.35)'; g.stroke()
    }
    pos.current.B.forEach((p, i) => dot(p, orange, i === 0, !ownAtt && i === carrier))
    pos.current.A.forEach((p, i) => dot(p, blue, i === 0, ownAtt && i === carrier))
    const nm = ownAtt ? own.names : riv.names
    if (carrier >= 0 && nm[carrier]) {
      const p = ownAtt ? pos.current.A[carrier] : pos.current.B[carrier]
      g.font = `600 ${Math.max(11, 1.9 * sx)}px system-ui`; g.textAlign = 'center'; g.fillStyle = '#fff'
      g.fillText(nm[carrier], X(p[0]), Y(p[1]) - 2.8 * sy)
    }
    g.beginPath(); g.arc(X(ball[0]), Y(ball[1]), Math.max(3.2, 0.95 * sx), 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1; g.strokeStyle = '#111'; g.stroke()
    // corte entre jugadas: fundido a negro, tarjeta (HTML) y fundido de entrada
    if (seg.kind === 'cut') { const k = f < 0.2 ? f / 0.2 : f > 0.8 ? (1 - f) / 0.2 : 1; g.fillStyle = `rgba(8,12,10,${0.96 * k})`; g.fillRect(0, 0, W, H) }
  }

  const inTransUI = !!cur?.trans && (seg.kind === 'intro' || (seg.kind === 'step' && (seg.s ?? 0) < 2))
  const nPlay = Math.min(seg.p, P.length - 1) + 1
  const phaseChip = doneT || seg.p >= P.length ? L('Final del partido', 'Full time') : seg.kind === 'cut' ? L(`Jugada ${nPlay} de ${P.length}`, `Move ${nPlay} of ${P.length}`) : seg.kind === 'outro' ? L(`Fin de la jugada ${nPlay}`, `End of move ${nPlay}`) : L(`Jugada ${nPlay} · ${inTransUI ? 'transición' : 'ataque'} de ${teamName(cur!.own)}`, `Move ${nPlay} · ${teamName(cur!.own)} ${inTransUI ? 'transition' : 'attack'}`)
  const jump = (d: number) => {
    const target = clamp(seg.p + d, 0, P.length - 1)
    const c = segs.find(q => q.kind === 'cut' && q.p === target)
    if (c) { setTau(c.t0 + 0.34); pos.current = null }
  }
  const mm = Math.min(90, Math.floor(minute))
  return (
    <div className="msim">
      <div className="msim-board">
        <ClubName club={partido.club} media={media} size={30} />
        <b className="msim-score">{score[0]} – {score[1]}</b>
        <ClubName club={partido.rival} media={media} size={30} />
        <span className="msim-clock mono">{doneT ? L('Final', 'FT') : `${mm}'`}</span>
      </div>
      <div className="msim-phase" style={cur && !doneT && seg.kind !== 'cut' ? { background: `color-mix(in oklab, ${cur.own ? teamCols[0] : teamCols[1]} 28%, var(--surface))`, color: 'var(--ink)' } : undefined}>{phaseChip}</div>
      <div className="msim-main">
      <div className="msim-stage">
        <canvas ref={canvas} className="msim-canvas" aria-label={`${L('Partido simulado', 'Simulated match')}: ${partido.club} ${score[0]}, ${partido.rival} ${score[1]}`} />
        {cur && !doneT && seg.kind === 'cut' && f > 0.15 && f < 0.85 && (
          <div key={`c${segIdx}`} className="msim-card">
            <div className="note">{L(`Jugada ${nPlay} de ${P.length} · minuto`, `Move ${nPlay} of ${P.length} · minute`)} {Math.floor(cur.t)}'</div>
            <div className="msim-card-team"><ClubName club={teamName(cur.own)} media={media} size={34} /></div>
            <div className="msim-card-arch">{cur.trans ? L('Transición tras recuperar', 'Transition after winning it back') : cur.arch}</div>
          </div>
        )}
        {cur && !doneT && seg.kind === 'intro' && (
          <div key={`i${segIdx}`} className="msim-banner" style={{ borderLeftColor: cur.own ? teamCols[0] : teamCols[1] }}>
            <b>{teamName(cur.own)}</b> · {cur.trans ? L('recupera y sale en transición', 'wins it back and breaks') : cur.arch}
          </div>
        )}
        {cur && !doneT && seg.kind === 'outro' && (
          <div key={`o${segIdx}`} className={`msim-result ${cur.end}`}>
            {cur.end === 'perdida' ? <>{L('Pierde el balón', 'Ball lost')} <span>{L(`${teamName(!cur.own)} recupera`, `${teamName(!cur.own)} win it back`)}</span></>
              : cur.end === 'gol' ? <>{L('¡GOL!', 'GOAL!')} <span>{teamName(cur.own)}</span></>
              : cur.end === 'tiro' ? <>{L('Tiro sin gol', 'Shot, no goal')} <span>xG {fmt(cur.xg ?? 0, 2)}</span></>
              : <>{L('Balón fuera', 'Ball out')} <span>{L(`saca ${teamName(!cur.own)}`, `${teamName(!cur.own)} restart`)}</span></>}
          </div>
        )}
        {doneT && <div className="msim-result gol">{L('Final', 'Full time')} <span>{partido.club} {score[0]} – {score[1]} {partido.rival}</span></div>}
      </div>
      <ul className="msim-feed">
        <li className="msim-feed-h">{L('Relato', 'Commentary')}</li>
        {events.map((e, i) => (
          <li key={i} className={e.cls}><span className="mono">{Math.floor(e.m)}'</span><i style={{ background: e.own ? teamCols[0] : teamCols[1] }} />{teamName(e.own)} · {e.txt}</li>
        ))}
      </ul>
      </div>
      <div className="msim-legend">
        <span><svg width="26" height="10" aria-hidden><line x1="1" y1="5" x2="19" y2="5" stroke="currentColor" strokeWidth="2" /><path d="M25 5 L18 1.5 L18 8.5z" fill="currentColor" /></svg>{L('Pase', 'Pass')}</span>
        <span><svg width="26" height="10" aria-hidden><line x1="1" y1="5" x2="25" y2="5" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" /></svg>{L('Conducción', 'Carry')}</span>
        <span><svg width="26" height="10" aria-hidden><line x1="1" y1="5" x2="25" y2="5" stroke="currentColor" strokeWidth="3.5" /></svg>{L('Tiro (con su xG)', 'Shot (with its xG)')}</span>
        <span><svg width="14" height="14" aria-hidden><path d="M2 2 L12 12 M12 2 L2 12" stroke="#ff4d4d" strokeWidth="2.5" /></svg>{L('Robo', 'Turnover')}</span>
        <span><i className="sw" style={{ background: teamCols[0] }} />{partido.club}</span><span><i className="sw" style={{ background: teamCols[1] }} />{partido.rival}</span>
        <Info wide label={L('Cómo leer la rejugada', 'How to read the replay')}>
          <p>{L('Borde blanco = quien lleva el balón · once inicial real del partido', 'White outline = player on the ball · actual starting XI')}</p>
          <p>{L('Una sola rejugada del partido, contada como un resumen de jugadas. Los tiros, su minuto y su xG son los reales; si cada uno entra se sortea con esa probabilidad, igual que en las 50,000 rejugadas. Las jugadas sin tiro siguen las jugadas tipo del DT. Juegan los onces iniciales reales: cada jugador del DT se coloca donde solía estar con él en ataque, en defensa y en las transiciones; el rival, según su puesto en la alineación.', "One single replay of the match, told as a highlights reel. The shots, their minute and their xG are real; whether each one goes in is drawn with that probability, just like in the 50,000 replays. Moves without a shot follow the coach's signature moves. The actual starting XIs play: each of the coach's players lines up where he usually stood under him in attack, defence and transitions; the opponent, by his position in the lineup.")}</p>
        </Info>
      </div>
      <div className="msim-ctrl">
        <button className="btn" onClick={() => { if (doneT) setTau(0); setPlaying(p => (doneT ? true : !p)) }}>{doneT ? L('↺ Ver de nuevo', '↺ Watch again') : playing ? L('❚❚ Pausa', '❚❚ Pause') : L('▶ Seguir', '▶ Resume')}</button>
        <div className="seg sm" role="group" aria-label={L('Velocidad', 'Speed')}>
          {[1, 2, 4].map(v => <button key={v} aria-pressed={speed === v} onClick={() => setSpeed(v)}>{v}×</button>)}
        </div>
        <input className="msim-scrub" type="range" min={0} max={total} step={0.1} value={tau} onChange={e => { setTau(Number(e.target.value)); setPlaying(false); pos.current = null }} aria-label={L('Momento del partido', 'Match time')} />
        <button className="btn ghost" onClick={() => jump(-1)} aria-label={L('Jugada anterior', 'Previous move')}>{L('‹ Anterior', '‹ Previous')}</button>
        <button className="btn ghost" onClick={() => jump(1)} aria-label={L('Siguiente jugada', 'Next move')}>{L('Siguiente ›', 'Next ›')}</button>
        <button className="btn ghost" onClick={() => { setTau(total); setPlaying(false) }} disabled={doneT}>{L('Ir al final', 'Skip to end')}</button>
        <button className="btn ghost" onClick={() => { pos.current = null; setSeed(s => s + 1) }}>{L('↻ Otro partido', '↻ Another match')}</button>
      </div>
    </div>
  )
}
