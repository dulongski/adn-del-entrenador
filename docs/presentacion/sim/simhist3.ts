import { loadPack, buildSeason } from '/Users/sdulongsalazar/coach-dna-work/repo/web/src/sim/pack'
import { setSeed } from '/Users/sdulongsalazar/coach-dna-work/repo/web/src/sim/engine'
;(async () => {
  const pk = await loadPack()
  const N = 3000, pos: Record<string, number[]> = {}, title: Record<string, number> = {}, fin: Record<string, number> = {}, lig: Record<string, number> = {}, pts: Record<number, number> = {}
  for (let i = 0; i < N; i++) {
    setSeed(100003 + i * 7919)
    const s = buildSeason(pk, 'América', 2947, null, false, true)
    s.run(() => false, true)
    s.table().forEach((r, k) => { (pos[r.club] ??= Array(18).fill(0))[k]++; if (r.club === 'América') pts[r.pts] = (pts[r.pts] ?? 0) + 1 })
    s.seeds.forEach((c, k) => { if (k < 8) lig[c] = (lig[c] ?? 0) + 1 })
    if (s.champion) title[s.champion] = (title[s.champion] ?? 0) + 1
    s.done.filter(t => t.fase === 'final').forEach(t => { fin[t.hi] = (fin[t.hi] ?? 0) + 1; fin[t.lo] = (fin[t.lo] ?? 0) + 1 })
  }
  ;(window as any).RESULT = { pos, title, fin, lig, pts, N }
})()
