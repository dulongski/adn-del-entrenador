import { decide, legsTotal, mkTie, nextLeg, quickMatch, remaining, roundRobin, simMatch, table, type Fx, type Liga, type MatchRes, type Pl, type Team, type Tie } from './engine'

export type Phase = 'liga' | 'playin' | 'qf' | 'sf' | 'final' | 'done'
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
  constructor(public clubs: string[], public teams: Record<string, Team>, public L: Liga, real: { h: string; a: string; gh: number; ga: number }[], fresh: boolean, firstRound: number) {
    this.played = fresh ? [] : real
    this.fixtures = fresh ? roundRobin(clubs) : remaining(clubs, real, firstRound)
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
  compute(n: Next, quick = false): MatchRes {
    const H = this.teams[n.h], A = this.teams[n.a]
    return quick ? (([gh, ga]) => ({ gh, ga, ev: [] }))(quickMatch(H, A, this.L)) : simMatch(H, A, this.L, { extra: n.kind === 'tie' && n.tie.fase === 'final' })
  }
  /** Aplica un resultado y avanza el torneo. */
  commit(n: Next, res: MatchRes, quick = false) {
    if (!quick) this.tally(res, n.h, n.a)
    if (n.kind === 'fx') { n.fx.res = res; this.log.push({ fx: n.fx, res }) } else { n.tie.legs.push(res); const w = decide(n.tie, this.team, this.L); if (w) n.tie.winner = w }
    this.refill()
  }
  play(n: Next, quick = false): MatchRes { const res = this.compute(n, quick); this.commit(n, res, quick); return res }
  private seedNo = (c: string) => this.seeds.indexOf(c) + 1
  refill() {
    if (this.phase === 'liga' && !this.fxLeft().length) {
      this.seeds = this.table().map(r => r.club)
      const S = this.seeds
      this.phase = 'playin'
      this.ties = [mkTie('pi1', 'playin', [S[6], 7], [S[7], 8], '7 vs 8'), mkTie('pi2', 'playin', [S[8], 9], [S[9], 10], '9 vs 10')]
      return
    }
    if (this.phase === 'playin') {
      const [p1, p2] = this.ties
      if (this.ties.length === 2 && p1.winner && p2.winner) {
        const l1 = p1.winner === p1.hi ? p1.lo : p1.hi
        this.ties.push(mkTie('pi3', 'playin', [l1, this.seedNo(l1)], [p2.winner, this.seedNo(p2.winner)], L8))
      }
      const p3 = this.ties[2]
      if (p3?.winner) {
        const S = this.seeds, seven = p1.winner!, eight = p3.winner
        const b = [S[0], S[1], S[2], S[3], S[4], S[5], seven, eight]
        this.done.push(...this.ties)
        this.phase = 'qf'
        this.ties = [[0, 7], [1, 6], [2, 5], [3, 4]].map(([i, j], k) => mkTie(`qf${k + 1}`, 'qf', [b[i], this.seedNo(b[i])], [b[j], this.seedNo(b[j])], `${i + 1} vs ${j + 1}`))
      }
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
const L8 = '8.º lugar'

/** Miles de torneos rápidos: probabilidad de cada club de avanzar a liguilla y de ser campeón. */
export function manySeasons(make: () => Season, n: number) {
  const out: Record<string, { top6: number; liguilla: number; final: number; title: number; pts: number }> = {}
  for (let i = 0; i < n; i++) {
    const s = make()
    s.run(() => false, true)
    const all = [...s.done]
    const finalists = new Set(s.done.filter(t => t.fase === 'final').flatMap(t => [t.hi, t.lo]))
    s.seeds.forEach((c, k) => {
      const o = (out[c] ??= { top6: 0, liguilla: 0, final: 0, title: 0, pts: 0 })
      if (k < 6) o.top6++
      if (k < 8 || all.some(t => t.fase === 'qf' && (t.hi === c || t.lo === c))) o.liguilla += (k < 6 || all.some(t => t.fase === 'qf' && (t.hi === c || t.lo === c))) ? 1 : 0
      if (finalists.has(c)) o.final++
      if (s.champion === c) o.title++
    })
    const tb = s.table(); tb.forEach(r => { (out[r.club] ??= { top6: 0, liguilla: 0, final: 0, title: 0, pts: 0 }).pts += r.pts })
  }
  for (const k of Object.keys(out)) { const o = out[k]; o.top6 /= n; o.liguilla /= n; o.final /= n; o.title /= n; o.pts /= n }
  return out
}
