/* Motor del simulador de liga: partido (minuto a minuto, con goles, amarillas y rojas), calendario, tabla y liguilla.
   El equipo se arma con el mismo modelo de «Llévalo a otro club» (DT + club + plantilla -> xG a favor y en contra) y el estilo editable del DT. */
import type { Any } from '../lib'
import { xgShift, type StyleX } from './styleModel'

export type Pl = { id: number; name: string; pos: string; g: number; y: number; r: number }
export type Team = { club: string; coach: number; att: number; def: number; xi: Pl[]; bench: Pl[] }
export type Ev = { min: number; label: string; type: 'goal' | 'og' | 'yellow' | 'red' | 'red2'; team: 0 | 1; pl: Pl }
export type MatchRes = { gh: number; ga: number; ev: Ev[]; et?: boolean; pens?: [number, number] }
export type Liga = { xg_mean: number; goles_local: number; goles_visita: number; goles_pdf5: number[]; amarillas_pdf5: number[]; amarillas_por_equipo: number; rojas_por_equipo: number }
const M0 = 1.073        // xG medio por 90 sin penales (escala de los indicadores xg_90 y xg_contra_90)
let seed: number | null = null
/** Semilla fija (mulberry32) para comparar dos configuraciones con los mismos «dados»; null = aleatorio. */
export const setSeed = (n: number | null) => { seed = n === null ? null : n >>> 0 }
export function rnd() {
  if (seed === null) return Math.random()
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Tasas de un equipo: z = base + α(DT) + φ(club) + Σβ(XI) + cambio de estilo (como en «Llévalo a otro club»). */
export function buildTeam(wi: Any, ls: Any, sx: StyleX, club: string, coach: number, dz: Record<string, number> | null): Team {
  const kp: Any[] = wi.kpis, n = kp.length, ix = (k: string) => kp.findIndex(x => x.k === k)
  const z: number[] = [...wi.base]
  const add = (b?: number[] | null) => { if (b) for (let i = 0; i < n; i++) z[i] += b[i] }
  const sq = wi.squads[club]
  add(wi.coaches[coach]); add(wi.clubs[club]?.phi)
  for (const p of sq.xi) add(wi.players[p]?.b ?? wi.otros)
  const raw = (k: string) => kp[ix(k)].mean + z[ix(k)] * kp[ix(k)].sd
  const sh = dz ? xgShift(dz, sx) : { dFor: 0, dAgainst: 0 }
  const mk = (id: number): Pl => { const r = ls.jugadores[id] ?? [0.05, 0.12, 0.004, 0]; return { id, name: wi.players[id]?.n ?? String(id), pos: sq.pos?.[id] ?? wi.players[id]?.pos ?? '', g: r[0], y: r[1], r: r[2] } }
  const xi: Pl[] = sq.xi.map(mk)
  const bench: Pl[] = (sq.jugadores as [number, number][]).map(([p]) => p).filter((p: number) => !sq.xi.includes(p)).slice(0, 5).map(mk)
  return { club, coach, att: clamp(raw('xg_90') + sh.dFor, 0.5, 2.2), def: clamp(raw('xg_contra_90') + sh.dAgainst, 0.5, 2.2), xi, bench }
}

const pick = <T,>(arr: T[], w: number[]): T => { const t = w.reduce((a, b) => a + b, 0); let r = rnd() * t; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i] } return arr[arr.length - 1] }
export const lambdas = (h: Team, a: Team, L: Liga) => ({ lh: L.goles_local * clamp(h.att / M0, 0.4, 2) * clamp(a.def / M0, 0.4, 2), la: L.goles_visita * clamp(a.att / M0, 0.4, 2) * clamp(h.def / M0, 0.4, 2) })
const poisson = (l: number) => { const e = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rnd() } while (p > e); return k - 1 }

/** Partido rápido (sólo marcador, sin eventos): para miles de torneos. */
export function quickMatch(h: Team, a: Team, L: Liga): [number, number] { const { lh, la } = lambdas(h, a, L); return [poisson(lh), poisson(la)] }

/** Partido minuto a minuto. */
export function simMatch(h: Team, a: Team, L: Liga, opt: { extra?: boolean } = {}): MatchRes {
  const { lh, la } = lambdas(h, a, L)
  const T = [h, a], lam = [lh, la]
  const off: Set<number>[] = [new Set(), new Set()], yel: Set<number>[] = [new Set(), new Set()]
  const ev: Ev[] = []
  const g = [0, 0]
  const add = opt.extra ? 3 : 2 + Math.floor(rnd() * 5)
  const end = 90 + add
  const nRed = [0, 0]
  const onPitch = (t: 0 | 1, m: number) => [...T[t].xi, ...(m >= 58 ? T[t].bench.slice(0, 3) : [])].filter(p => !off[t].has(p.id))
  const wOf = (t: 0 | 1, m: number, f: (p: Pl) => number) => { const ps = onPitch(t, m); return { ps, w: ps.map(p => f(p) * (T[t].xi.includes(p) ? 1 : 0.45)) } }
  const lab = (m: number) => (m <= 90 ? `${m}'` : `90+${m - 90}'`)
  for (let m = 1; m <= end; m++) {
    const bin = Math.min(17, Math.floor((m - 1) / 5))
    for (const t of [0, 1] as const) {
      const f = (nRed[t] ? 0.82 ** nRed[t] : 1) * (nRed[1 - t] ? 1.12 ** nRed[1 - t] : 1)
      if (rnd() < (lam[t] * L.goles_pdf5[bin] / 5) * f) {
        if (rnd() < 0.025) { const { ps, w } = wOf((1 - t) as 0 | 1, m, () => 1); const p = pick(ps, w); g[t]++; ev.push({ min: m, label: lab(m), type: 'og', team: t, pl: p }) }
        else { const { ps, w } = wOf(t, m, p => p.g); const p = pick(ps, w); g[t]++; ev.push({ min: m, label: lab(m), type: 'goal', team: t, pl: p }) }
      }
      if (rnd() < (0.85 * L.amarillas_por_equipo * L.amarillas_pdf5[bin] / 5)) {
        const { ps, w } = wOf(t, m, p => p.y); const p = pick(ps, w)
        if (yel[t].has(p.id)) { ev.push({ min: m, label: lab(m), type: 'red2', team: t, pl: p }); off[t].add(p.id); nRed[t]++ } else { yel[t].add(p.id); ev.push({ min: m, label: lab(m), type: 'yellow', team: t, pl: p }) }
      }
      if (rnd() < 0.06 / 90) {
        const { ps, w } = wOf(t, m, p => p.r + 0.01); const p = pick(ps, w); off[t].add(p.id); nRed[t]++; ev.push({ min: m, label: lab(m), type: 'red', team: t, pl: p })
      }
    }
  }
  ev.sort((x, y) => x.min - y.min)
  return { gh: g[0], ga: g[1], ev }
}

/* ------------------------------------------------------------ calendario */
export type Fx = { h: string; a: string; round: number; j?: number; res?: MatchRes }
/** Todos contra todos (método del círculo): cada par se juega una vez. */
export function roundRobin(clubs: string[]): Fx[] {
  const n = clubs.length, arr = [...clubs]
  const out: Fx[] = []
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const x = arr[i], y = arr[n - 1 - i]
      out.push((r + i) % 2 ? { h: x, a: y, round: r + 1 } : { h: y, a: x, round: r + 1 })
    }
    arr.splice(1, 0, arr.pop()!)
  }
  return out
}
/** Partidos que faltan: pares aún no jugados, repartidos en jornadas (el calendario real no está en los datos). */
export function remaining(clubs: string[], played: { h: string; a: string }[], firstRound: number): Fx[] {
  const done = new Set(played.map(p => [p.h, p.a].sort().join('|')))
  const left = roundRobin(clubs).filter(f => !done.has([f.h, f.a].sort().join('|')))
  const rounds: Fx[][] = []
  const pool = [...left]
  while (pool.length) {
    const busy = new Set<string>(), r: Fx[] = []
    // primero los equipos con más partidos pendientes, para no dejar jornadas casi vacías al final
    const cnt: Record<string, number> = {}
    pool.forEach(f => { cnt[f.h] = (cnt[f.h] ?? 0) + 1; cnt[f.a] = (cnt[f.a] ?? 0) + 1 })
    pool.sort((p, q) => (cnt[q.h] + cnt[q.a]) - (cnt[p.h] + cnt[p.a]))
    for (let i = 0; i < pool.length; i++) { const f = pool[i]; if (!busy.has(f.h) && !busy.has(f.a)) { busy.add(f.h); busy.add(f.a); r.push(f); pool.splice(i, 1); i-- } }
    rounds.push(r)
  }
  return rounds.flatMap((r, i) => r.map(f => ({ ...f, round: firstRound + i })))
}

/* ------------------------------------------------------------ tabla */
export type Row = { club: string; pj: number; g: number; e: number; p: number; gf: number; gc: number; pts: number; gfa: number }
export function table(clubs: string[], games: { h: string; a: string; gh: number; ga: number }[]): Row[] {
  const R: Record<string, Row> = Object.fromEntries(clubs.map(c => [c, { club: c, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, gfa: 0 }]))
  for (const m of games) {
    const h = R[m.h], a = R[m.a]; if (!h || !a) continue
    h.pj++; a.pj++; a.gfa += m.ga; h.gf += m.gh; h.gc += m.ga; a.gf += m.ga; a.gc += m.gh
    if (m.gh > m.ga) { h.g++; h.pts += 3; a.p++ } else if (m.gh < m.ga) { a.g++; a.pts += 3; h.p++ } else { h.e++; a.e++; h.pts++; a.pts++ }
  }
  const tie = Object.fromEntries(clubs.map(c => [c, rnd()]))
  return Object.values(R).sort((x, y) => y.pts - x.pts || (y.gf - y.gc) - (x.gf - x.gc) || y.gf - x.gf || y.gfa - x.gfa || tie[y.club] - tie[x.club])
}

/* ------------------------------------------------------------ liguilla */
export type Tie = { id: string; fase: 'qf' | 'sf' | 'final'; hi: string; lo: string; seedHi: number; seedLo: number; legs: MatchRes[]; pens?: [number, number]; winner?: string; label: string }
/** Liguilla de 8 (sin play-in): ida y vuelta; empate global: avanza el mejor ubicado en la tabla; en la final, tiempos extra y penales. */
export const FASES = { qf: { es: 'Cuartos de final', en: 'Quarter-finals' }, sf: { es: 'Semifinales', en: 'Semi-finals' }, final: { es: 'Final', en: 'Final' } }
export function mkTie(id: string, fase: Tie['fase'], a: [string, number], b: [string, number], label: string): Tie {
  const [hi, lo] = a[1] < b[1] ? [a, b] : [b, a]
  return { id, fase, hi: hi[0], lo: lo[0], seedHi: hi[1], seedLo: lo[1], legs: [], label }
}
/** Un juego de la serie: el siguiente a jugar es [local, visita]. */
export function nextLeg(t: Tie): [string, string] {
  return t.legs.length === 0 ? [t.lo, t.hi] : [t.hi, t.lo]
}
export const legsTotal = (_t: Tie) => 2
/** Resuelve la serie cuando ya se jugaron todos sus partidos; devuelve el ganador (o undefined si falta). */
export function decide(t: Tie, team: (c: string) => Team, L: Liga): string | undefined {
  if (t.legs.length < legsTotal(t)) return undefined
    let gHi = 0, gLo = 0
  t.legs.forEach((m, i) => { const homeIsHi = i === 1; gHi += homeIsHi ? m.gh : m.ga; gLo += homeIsHi ? m.ga : m.gh })
  if (gHi !== gLo) return gHi > gLo ? t.hi : t.lo
  if (t.fase !== 'final') return t.hi
  // final: tiempos extra (30 min) y penales
  const h = team(t.hi), a = team(t.lo)
  const { lh, la } = lambdas(h, a, L)
  const eh = poisson((lh * 30) / 90 * 0.9), ea = poisson((la * 30) / 90 * 0.9)
  gHi += eh; gLo += ea
  t.legs[t.legs.length - 1] = { ...t.legs[t.legs.length - 1], et: true }
  if (gHi !== gLo) return gHi > gLo ? t.hi : t.lo
  const win = rnd() < 0.5 + 0.02 * (t.seedLo - t.seedHi)
  const pw = 4 + Math.floor(rnd() * 2), pl = pw - 1 - Math.floor(rnd() * 2)
  t.pens = win ? [pw, pl] : [pl, pw]
  return win ? t.hi : t.lo
}
