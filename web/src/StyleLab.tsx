import { useEffect, useMemo, useState } from 'react'
import { L } from './settings'
import { kpiLabel } from './i18n/data'
import { asset, nombreDT, real, shortName, type Any } from './lib'
import { ClubLogo } from './charts'
import Info from './Info'
import { loadStyle, SLIDERS, fxOf, type Fx, type StyleX } from './sim/styleModel'
import './styles/slab.css'

/** Editor de estilo: mueve el estilo propio del DT (en σ de la liga) o cópialo de otro entrenador. Avisa con un factor de xG (no se muestra el xG). */
export default function StyleLab({ art, media, onChange }: { art: Any; glob?: Any; media?: Any; onChange: (fx: Fx | null, dz: Record<string, number>) => void }) {
  const [D, setD] = useState<{ sx: StyleX; wi: Any } | null>(null)
  const [dz, setDz] = useState<Record<string, number>>({})
  const [from, setFrom] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('sim')
  useEffect(() => { loadStyle().then(setD).catch(() => setD(null)) }, [])
  useEffect(() => { setDz({}); setFrom('') }, [art.id])
  const wi = D?.wi, sx = D?.sx
  const idx = useMemo(() => (wi ? Object.fromEntries(wi.kpis.map((k: Any, i: number) => [k.k, i])) : {}) as Record<string, number>, [wi])
  const alpha = (id: number | string, k: string): number | null => { const v = wi?.coaches?.[id]; return v && idx[k] != null ? v[idx[k]] : null }
  const changed = Object.values(dz).filter(v => Math.abs(v) > 0.01).length
  useEffect(() => { if (sx) onChange(changed ? fxOf(dz, sx) : null, dz) }, [dz, sx]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!D) return <div className="card note">{L('Cargando el editor de estilo…', 'Loading the style editor…')}</div>
  const a0 = (k: string) => alpha(art.id, k) ?? 0
  const nrm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const SORTS: [string, string, string | null][] = [['sim', L('Más parecido a él', 'Most like him'), null], ['az', L('Nombre (A–Z)', 'Name (A–Z)'), null], ['posesion', L('Más posesión', 'Most possession'), 'posesion'], ['verticalidad', L('Más directo', 'More direct'), 'verticalidad'], ['presion_alta', L('Más presión alta', 'More high press'), 'presion_alta'], ['contraataque', L('Más contragolpe', 'More counter-attack'), 'contraataque'], ['pase_largo', L('Más pase largo', 'More long balls'), 'pase_largo'], ['centros', L('Más centros', 'More crosses'), 'centros']]
  const sim = (id: string) => { const ks = sx!.estilo.filter(k => alpha(id, k) != null && alpha(art.id, k) != null); const a = ks.map(k => alpha(art.id, k)!), b = ks.map(k => alpha(id, k)!); const m = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length, ma = m(a), mb = m(b); const c = a.reduce((t, x, i) => t + (x - ma) * (b[i] - mb), 0) / Math.sqrt(a.reduce((t, x) => t + (x - ma) ** 2, 0) * b.reduce((t, x) => t + (x - mb) ** 2, 0)); return Math.round(((c + 1) / 2) * 100) }
  const coaches = Object.keys(wi.coaches).filter(id => String(id) !== String(art.id)).map(id => { const info = media?.dts?.[id]; return { id, n: shortName(nombreDT(id)?.corto ?? wi.coach_nombres[id] ?? id), club: (info?.club as string | undefined) ?? '', foto: info?.foto as string | undefined, vigente: !!info?.vigente, sim: sim(id) } })
  const sKey = SORTS.find(x => x[0] === sort)?.[2]
  const shown = coaches.filter(c => !q.trim() || nrm(`${c.n} ${wi.coach_nombres[c.id] ?? ''} ${c.club}`).includes(nrm(q.trim()))).sort((a, b) => sort === 'az' ? a.n.localeCompare(b.n, 'es') : sKey ? (alpha(b.id, sKey) ?? -9) - (alpha(a.id, sKey) ?? -9) : b.sim - a.sim).slice(0, 40)
  const chosen = coaches.find(c => c.id === from)
  const copy = (id: string) => {
    setFrom(id)
    if (!id) { setDz({}); return }
    const out: Record<string, number> = {}
    for (const k of sx!.estilo) { const o = alpha(id, k), m = alpha(art.id, k); if (o != null && m != null) out[k] = o - m }
    setDz(out)
  }
  return (
    <div className="card slab">
      <button className="slab-h" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span><b>{L('¿Y si hubiera jugado distinto?', 'What if he had played differently?')}</b><small>{L('Mueve su estilo propio o cópialo de otro DT y vuelve a jugar los partidos', 'Move his own style or copy another coach and replay the matches')}</small></span>
        {changed > 0 && <em className="slab-badge">{changed} {L(changed === 1 ? 'cambio' : 'cambios', changed === 1 ? 'change' : 'changes')}</em>}
        <i>{open ? '–' : '+'}</i>
      </button>
      {open && <>
        <div className="slab-bar">
          <div className="slab-pick">
            <button className="slab-pick-b" aria-expanded={pick} onClick={() => setPick(o => !o)}>
              {L('Copiar el estilo de', 'Copy the style of')}: <b>{chosen ? chosen.n : '—'}</b> <i>▾</i>
            </button>
            {pick && (
              <div className="slab-pop" onKeyDown={e => { if (e.key === 'Escape') setPick(false) }}>
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={L('Buscar por nombre o club…', 'Search by name or club…')} aria-label={L('Buscar entrenador', 'Search coach')} />
                <div className="slab-sorts" role="group" aria-label={L('Ordenar', 'Sort')}>{SORTS.map(([k, l]) => <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}</div>
                <div className="slab-list">
                  {shown.length === 0 && <div className="note" style={{ padding: 10 }}>{L('Sin resultados.', 'No results.')}</div>}
                  {shown.map(c => (
                    <button key={c.id} className={`slab-opt${c.id === from ? ' on' : ''}`} onClick={() => { copy(c.id); setPick(false) }}>
                      {asset(c.foto) ? <img src={asset(c.foto)!} alt="" /> : <i>{c.n[0]}</i>}
                      <span><b>{c.n}</b><small>{c.club ? <><ClubLogo club={c.club} media={media} size={12} />{c.club}{c.vigente ? ` · ${L('actual', 'current')}` : ''}</> : L('sin club', 'free')}</small></span>
                      <em>{c.sim}<small>/100</small></em>
                    </button>
                  ))}
                </div>
                {from && <button className="slab-clear" onClick={() => { copy(''); setPick(false) }}>{L('Quitar la copia', 'Remove the copy')}</button>}
              </div>
            )}
          </div>
          <button className="btn slab-reset" disabled={!changed} onClick={() => { setDz({}); setFrom('') }}>{L('Volver a su estilo real', 'Back to his real style')}</button>
          <Info wide><p>{L('Cada barra es su estilo propio (ya sin plantilla, club ni rival) en desviaciones típicas de la liga: 0 = DT promedio. Al moverlo, el modelo ajusta cuánto xG suelen generar y conceder los equipos con ese estilo (asociación entre equipos, no causa) y se vuelven a jugar los partidos con esas probabilidades.', 'Each bar is his own style (squad, club and opponent already removed) in league standard deviations: 0 = average coach. When you move it, the model adjusts how much xG teams with that style tend to create and concede (an association across teams, not a cause) and the matches are replayed with those probabilities.')}</p><p>{L(`Copiar a otro DT mueve los ${sx!.estilo.length} rasgos de estilo a los suyos, no sólo los que ves.`, `Copying another coach moves all ${sx!.estilo.length} style traits to his, not only the ones you see.`)}</p><p>{L(`Poder predictivo del puente estilo → xG (validación cruzada): R² ≈ ${(sx!.xg_90.r2_cv).toFixed(2)}. Es modesto: el estilo explica una parte del xG, no todo.`, `Predictive power of the style → xG bridge (cross-validation): R² ≈ ${(sx!.xg_90.r2_cv).toFixed(2)}. It is modest: style explains part of xG, not all of it.`)}</p></Info>
        </div>
        <div className="slab-grid">
          {SLIDERS.filter(k => idx[k] != null).map(k => {
            const base = a0(k), v = base + (dz[k] ?? 0)
            return (
              <div key={k} className={`slab-row${Math.abs(dz[k] ?? 0) > 0.01 ? ' on' : ''}`}>
                <span className="slab-l">{kpiLabel(k, wi.kpis[idx[k]].etiqueta)}</span>
                <span className="slab-v mono">{real(k, v)}</span>
                <span className="slab-t">
                  <i className="slab-zero" /><i className="slab-orig" style={{ left: `${((base + 3) / 6) * 100}%` }} title={L('su estilo real', 'his real style')} />
                  <input type="range" min={-3} max={3} step={0.05} value={v} aria-label={kpiLabel(k, wi.kpis[idx[k]].etiqueta)} onChange={e => { setFrom(''); setDz(d => ({ ...d, [k]: +e.target.value - base })) }} />
                </span>
              </div>
            )
          })}
        </div>
      </>}
    </div>
  )
}
