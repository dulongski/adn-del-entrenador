import { loadPack, buildSeason } from '/Users/sdulongsalazar/coach-dna-work/repo/web/src/sim/pack'
;(async () => {
  const pk = await loadPack()
  const a = buildSeason(pk, 'América', 2947, null, true, true), b = buildSeason(pk, 'América', 2947, null, false, true)
  const out: any = {}
  for (const k of Object.keys(a.teams)) out[k] = { att0: +a.teams[k].att.toFixed(2), def0: +a.teams[k].def.toFixed(2), att: +b.teams[k].att.toFixed(2), def: +b.teams[k].def.toFixed(2), sf: +pk.form[k]?.sf.toFixed(2), sc: +pk.form[k]?.sc.toFixed(2), fa: pk.form[k]?.att.toFixed(2), fd: pk.form[k]?.def.toFixed(2) }
  ;(window as any).RESULT = out
})()
