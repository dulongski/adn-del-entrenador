import type { Any } from '../lib'
import { decide, INJ_FACTOR, rnd, setSeed, legsTotal, mkTie, nextLeg, quickMatch, simMatch, table, type Fx, type Liga, type MatchRes, type Pl, type Team, type Tie } from './engine'

export type Phase = 'liga' | 'qf' | 'sf' | 'final' | 'done'
export type Next = { kind: 'fx'; fx: Fx; h: string; a: string } | { kind: 'tie'; tie: Tie; h: string; a: string }
export type Scorer = { pl: Pl; club: string; g: number; y: number; r: number }

/** Un torneo: fase regular (partidos que faltan o desde cero) + play-in + liguilla. Todo muta en sitio. */
export class Season {
  phase: Phase = 'liga'
  fixtures: Fx[]
  played: { h: string; a: string; gh: number; ga: number }[]     // los de la vida real (si el torneo ya empezó)
  ties: Tie[] = []
  done: Tie[] = []
  seeds: string[] = []
  champion?: string
  scorers = new Map<number, Scorer>()
  log: { fx: Fx; res: MatchRes }[] = []
  inj: Record<string, { pl: Pl; left: number }[]> = {}   // bajas por lesión: quién y cuántos partidos le faltan
  /** real: partidos ya jugados (con su jornada); cal: calendario oficial de lo que falta. «fresh» rehace todo el torneo con el mismo calendario. */
  constructor(public clubs: string[], public teams: Record<string, Team>, public L: Liga, real: { h: string; a: string; gh: number; ga: number; r: number }[], cal: { r: number; j?: number; h: string; a: string }[], fresh: boolean, init: [number, string, string, number, number, number][] = []) {
    // si el torneo ya va a la mitad, goleo y tarjetas arrancan con lo que ya pasó de verdad
    if (!fresh) for (const [id, name, club, g, y, r] of init) this.scorers.set(id, { pl: { id, name, pos: '', g: 0, y: 0, r: 0 }, club, g, y, r })
    this.played = fresh ? [] : real
    this.fixtures = (fresh ? [...real.map(x => ({ r: x.r, h: x.h, a: x.a })), ...cal] : cal).map(f => ({ h: f.h, a: f.a, round: f.r, j: (f as Any).j })).sort((x, y) => x.round - y.round)
  }
  team = (c: string) => this.teams[c]
  games() { return [...this.played, ...this.fixtures.filter(f => f.res).map(f => ({ h: f.h, a: f.a, gh: f.res!.gh, ga: f.res!.ga }))] }
  table() { return table(this.clubs, this.games()) }
  fxLeft() { return this.fixtures.filter(f => !f.res) }
  round() { return this.fxLeft()[0]?.round }
  next(): Next | null {
    if (this.phase === 'liga') { const f = this.fxLeft()[0]; return f ? { kind: 'fx', fx: f, h: f.h, a: f.a } : null }
    if (this.phase === 'done') return null
    const t = this.ties.find(t => !t.winner && t.legs.length < legsTotal(t))
    if (!t) return null
    const [h, a] = nextLeg(t)
    return { kind: 'tie', tie: t, h, a }
  }
  /** El siguiente partido de un club (fase regular o serie de liguilla); null si ya no le toca jugar en la fase actual. */
  nextOf(club: string): Next | null {
    if (this.phase === 'liga') { const f = this.fxLeft().find(f => f.h === club || f.a === club); return f ? { kind: 'fx', fx: f, h: f.h, a: f.a } : null }
    const t = this.ties.find(t => (t.hi === club || t.lo === club) && !t.winner && t.legs.length < legsTotal(t))
    if (!t) return null
    const [h, a] = nextLeg(t)
    return { kind: 'tie', tie: t, h, a }
  }
  /** Simula de golpe todo lo que debe jugarse antes (o a la par) del partido `mine`: el resto de la jornada o de la ronda. */
  playOthers(mine: Next) {
    for (let guard = 0; guard < 400; guard++) {
      let n: Next | null = null
      if (mine.kind === 'fx') { const f = this.fixtures.find(f => !f.res && f !== mine.fx && f.round <= mine.fx.round); if (f) n = { kind: 'fx', fx: f, h: f.h, a: f.a } }
      else { const t = this.ties.find(t => t !== mine.tie && !t.winner && t.legs.length <= mine.tie.legs.length && t.legs.length < legsTotal(t)); if (t) { const [h, a] = nextLeg(t); n = { kind: 'tie', tie: t, h, a } } }
      if (!n) break
      this.commit(n, this.compute(n))
    }
  }
  private tally(res: MatchRes, h: string, a: string) {
    for (const e of res.ev) {
      const club = e.type === 'og' ? (e.team === 0 ? a : h) : e.team === 0 ? h : a
      const club2 = e.type === 'og' ? (e.team === 0 ? a : h) : club
      const s = this.scorers.get(e.pl.id) ?? { pl: e.pl, club: club2, g: 0, y: 0, r: 0 }
      if (e.type === 'goal') s.g++
      else if (e.type === 'yellow') s.y++
      else if (e.type === 'red' || e.type === 'red2') s.r++
      if (e.type !== 'og') this.scorers.set(e.pl.id, s)
    }
  }
  /** El equipo tal como sale hoy: los lesionados son baja (entran los de la banca) y el equipo se resiente un poco. */
  teamFor(club: string): Team {
    const base = this.teams[club], out = this.inj[club] ?? []
    if (!out.length) return base
    const ids = new Set(out.map(o => o.pl.id))
    const free = base.bench.filter(p => !ids.has(p.id) && !p.gk)
    const used = new Set<number>()
    const xi = base.xi.map(p => { if (!ids.has(p.id)) return p; const r = free.find(q => !used.has(q.id)); if (r) { used.add(r.id); return r } return p })
    const k = out.filter(o => base.xi.some(p => p.id === o.pl.id)).length
    return { ...base, xi, bench: base.bench.filter(p => !used.has(p.id) && !ids.has(p.id)), att: base.att * (1 - INJ_FACTOR * k), def: base.def * (1 + INJ_FACTOR * k) }
  }
  compute(n: Next, quick = false): MatchRes {
    const H = quick ? this.teams[n.h] : this.teamFor(n.h), A = quick ? this.teams[n.a] : this.teamFor(n.a)
    return quick ? (([gh, ga]) => ({ gh, ga, ev: [] }))(quickMatch(H, A, this.L)) : simMatch(H, A, this.L, { extra: n.kind === 'tie' && n.tie.fase === 'final' })
  }
  /** Aplica un resultado y avanza el torneo. */
  commit(n: Next, res: MatchRes, quick = false) {
    if (!quick) {
      this.tally(res, n.h, n.a)
      for (const c of [n.h, n.a]) this.inj[c] = (this.inj[c] ?? []).map(o => ({ ...o, left: o.left - 1 })).filter(o => o.left > 0)
      for (const x of res.injured ?? []) { const c = x.team === 0 ? n.h : n.a; (this.inj[c] ??= []).push({ pl: x.pl, left: rnd() < 0.08 ? 6 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 4) }) }
    }
    if (n.kind === 'fx') { n.fx.res = res; this.log.push({ fx: n.fx, res }) } else { n.tie.legs.push(res); const w = decide(n.tie, this.team, this.L); if (w) n.tie.winner = w }
    this.refill()
  }
  play(n: Next, quick = false): MatchRes { const res = this.compute(n, quick); this.commit(n, res, quick); return res }
  private seedNo = (c: string) => this.seeds.indexOf(c) + 1
  refill() {
    if (this.phase === 'liga' && !this.fxLeft().length) {
      this.seeds = this.table().map(r => r.club)
      const S = this.seeds
      this.phase = 'qf'
      this.ties = [[0, 7], [1, 6], [2, 5], [3, 4]].map(([i, j], k) => mkTie(`qf${k + 1}`, 'qf', [S[i], i + 1], [S[j], j + 1], `${i + 1} vs ${j + 1}`))
      return
    }
    if (this.phase === 'qf' || this.phase === 'sf') {
      if (!this.ties.every(t => t.winner)) return
      this.done.push(...this.ties)
      const w = this.ties.map(t => t.winner!).sort((a, b) => this.seedNo(a) - this.seedNo(b))
      if (this.phase === 'qf') { this.phase = 'sf'; this.ties = [mkTie('sf1', 'sf', [w[0], this.seedNo(w[0])], [w[3], this.seedNo(w[3])], ''), mkTie('sf2', 'sf', [w[1], this.seedNo(w[1])], [w[2], this.seedNo(w[2])], '')] }
      else { this.phase = 'final'; this.ties = [mkTie('final', 'final', [w[0], this.seedNo(w[0])], [w[1], this.seedNo(w[1])], '')] }
      return
    }
    if (this.phase === 'final' && this.ties[0].winner) { this.done.push(...this.ties); this.champion = this.ties[0].winner; this.phase = 'done' }
  }
  /** Juega hasta que se cumpla `stop` (o no haya más). */
  run(stop: (s: Season, last: Next) => boolean, quick = false) {
    let guard = 0
    for (let n = this.next(); n && guard < 4000; n = this.next(), guard++) { this.play(n, quick); if (stop(this, n)) break }
  }
}

/** Miles de torneos rápidos: probabilidad de cada club de avanzar a liguilla y de ser campeón. */
export function manySeasons(make: () => Season, n: number, seed0 = 1) {
  const out: Record<string, { top6: number; liguilla: number; final: number; title: number; pts: number }> = {}
  for (let i = 0; i < n; i++) {
    setSeed(seed0 * 100003 + i * 7919)     // mismos «dados» en cada configuración: la diferencia entre ellas casi no tiene ruido
    const s = make()
    s.run(() => false, true)
    const finalists = new Set(s.done.filter(t => t.fase === 'final').flatMap(t => [t.hi, t.lo]))
    s.seeds.forEach((c, k) => {
      const o = (out[c] ??= { top6: 0, liguilla: 0, final: 0, title: 0, pts: 0 })
      if (k < 4) o.top6++
      if (k < 8) o.liguilla++
      if (finalists.has(c)) o.final++
      if (s.champion === c) o.title++
    })
    s.table().forEach(r => { (out[r.club] ??= { top6: 0, liguilla: 0, final: 0, title: 0, pts: 0 }).pts += r.pts })
  }
  setSeed(null)
  for (const k of Object.keys(out)) { const o = out[k]; o.top6 /= n; o.liguilla /= n; o.final /= n; o.title /= n; o.pts /= n }
  return out
}
