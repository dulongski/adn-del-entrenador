import { useEffect, useMemo, useState } from 'react'
import { L } from './settings'
import { kpiLabel } from './i18n/data'
import { nombreDT, shortName, type Any } from './lib'
import Info from './Info'
import { loadStyle, SLIDERS, fxOf, type Fx, type StyleX } from './sim/styleModel'
import './styles/lab.css'

/** Editor de estilo: mueve el estilo propio del DT (en σ de la liga) o cópialo de otro entrenador. Avisa con un factor de xG (no se muestra el xG). */
export default function StyleLab({ art, glob, onChange }: { art: Any; glob: Any; onChange: (fx: Fx | null, dz: Record<string, number>) => void }) {
  const [D, setD] = useState<{ sx: StyleX; wi: Any } | null>(null)
  const [dz, setDz] = useState<Record<string, number>>({})
  const [from, setFrom] = useState<string>('')
  const [open, setOpen] = useState(false)
  useEffect(() => { loadStyle().then(setD).catch(() => setD(null)) }, [])
  useEffect(() => { setDz({}); setFrom('') }, [art.id])
  const wi = D?.wi, sx = D?.sx
  const idx = useMemo(() => (wi ? Object.fromEntries(wi.kpis.map((k: Any, i: number) => [k.k, i])) : {}) as Record<string, number>, [wi])
  const alpha = (id: number | string, k: string): number | null => { const v = wi?.coaches?.[id]; return v && idx[k] != null ? v[idx[k]] : null }
  const changed = Object.values(dz).filter(v => Math.abs(v) > 0.01).length
  useEffect(() => { if (sx) onChange(changed ? fxOf(dz, sx) : null, dz) }, [dz, sx]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!D) return <div className="card note">{L('Cargando el editor de estilo…', 'Loading the style editor…')}</div>
  const a0 = (k: string) => alpha(art.id, k) ?? 0
  const coaches = Object.keys(wi.coaches).filter(id => String(id) !== String(art.id)).map(id => ({ id, n: shortName(nombreDT(id)?.corto ?? wi.coach_nombres[id] ?? id) })).sort((a, b) => a.n.localeCompare(b.n, 'es'))
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
          <label>{L('Copiar el estilo de', 'Copy the style of')}
            <select value={from} onChange={e => copy(e.target.value)}><option value="">—</option>{coaches.map(c => <option key={c.id} value={c.id}>{c.n}</option>)}</select>
          </label>
          <button className="btn slab-reset" disabled={!changed} onClick={() => { setDz({}); setFrom('') }}>{L('Volver a su estilo real', 'Back to his real style')}</button>
          <Info wide><p>{L('Cada barra es su estilo propio (ya sin plantilla, club ni rival) en desviaciones típicas de la liga: 0 = DT promedio. Al moverlo, el modelo ajusta cuánto xG suelen generar y conceder los equipos con ese estilo (asociación entre equipos, no causa) y se vuelven a jugar los partidos con esas probabilidades.', 'Each bar is his own style (squad, club and opponent already removed) in league standard deviations: 0 = average coach. When you move it, the model adjusts how much xG teams with that style tend to create and concede (an association across teams, not a cause) and the matches are replayed with those probabilities.')}</p><p>{L(`Copiar a otro DT mueve los ${sx!.estilo.length} rasgos de estilo a los suyos, no sólo los que ves.`, `Copying another coach moves all ${sx!.estilo.length} style traits to his, not only the ones you see.`)}</p><p>{L(`Poder predictivo del puente estilo → xG (validación cruzada): R² ≈ ${(sx!.xg_90.r2_cv).toFixed(2)}. Es modesto: el estilo explica una parte del xG, no todo.`, `Predictive power of the style → xG bridge (cross-validation): R² ≈ ${(sx!.xg_90.r2_cv).toFixed(2)}. It is modest: style explains part of xG, not all of it.`)}</p></Info>
        </div>
        <div className="slab-grid">
          {SLIDERS.filter(k => idx[k] != null).map(k => {
            const base = a0(k), v = base + (dz[k] ?? 0)
            return (
              <div key={k} className={`slab-row${Math.abs(dz[k] ?? 0) > 0.01 ? ' on' : ''}`}>
                <span className="slab-l">{kpiLabel(k, wi.kpis[idx[k]].etiqueta)}</span>
                <span className="slab-v mono">{v >= 0 ? '+' : '−'}{Math.abs(v).toFixed(2)}σ</span>
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
