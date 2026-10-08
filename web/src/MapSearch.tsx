import { useEffect, useMemo, useRef, useState } from 'react'
import { ClubLogo, CoachPhoto } from './charts'
import { shortName, type Any } from './lib'
import { L } from './settings'
import { mapLabel } from './i18n/data'

/* Buscador de la portada: por DT o por club (actual o pasado). Mientras escribes, el mapa atenúa a
   quien no coincide; al pasar por un resultado su burbuja se resalta. ↑↓ para moverte, Enter abre,
   Esc limpia, "/" enfoca desde cualquier lugar. */

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function searchCoaches(mapa: Any, media: Any, q: string) {
  const t = norm(q.trim())
  if (!t) return null
  const terms = t.split(/\s+/)
  return (mapa.puntos as Any[]).map(p => {
    const now = media.dts?.[p.id]?.club as string | undefined
    const clubs: string[] = [...new Set([...(p.clubes as string[]), ...(now ? [now] : [])])]
    const hay = norm(`${p.nombre} ${shortName(p.nombre)} ${clubs.join(' ')}`)
    if (!terms.every(w => hay.includes(w))) return null
    const nameHit = terms.every(w => norm(`${p.nombre} ${shortName(p.nombre)}`).includes(w))
    const clubHit = clubs.find(c => terms.some(w => norm(c).includes(w)))
    // nombre primero; luego club actual; luego más partidos
    const score = (nameHit ? 0 : 2) + (clubHit && clubHit === now ? 0 : 1) - Math.min(p.partidos, 300) / 1000
    return { p, now, clubHit: nameHit ? undefined : clubHit, score }
  }).filter(Boolean).sort((a: Any, b: Any) => a.score - b.score) as { p: Any; now?: string; clubHit?: string; score: number }[]
}

export default function MapSearch({ mapa, media, onPick, q, setQ, setPulse, hueOf }: {
  mapa: Any; media: Any; onPick: (id: number) => void; q: string; setQ: (s: string) => void; setPulse: (id: number | null) => void; hueOf: (g: number) => string
}) {
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const res = useMemo(() => searchCoaches(mapa, media, q) ?? [], [mapa, media, q])
  const fam = (g: number) => mapa.grupos.find((x: Any) => x.id === g)?.nombre ?? ''
  const famL = (g: number) => mapLabel(fam(g))
  useEffect(() => { setSel(0) }, [q])
  useEffect(() => { setPulse(open && res[sel] ? res[sel].p.id : null) }, [sel, res, open, setPulse])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); input.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const shown = res.slice(0, 7)
  const go = (id: number) => { setPulse(null); onPick(id) }

  return (
    <div className={`msearch${open && q ? ' open' : ''}`} onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
      <div className="msearch-box">
        <svg className="msearch-ic" viewBox="0 0 24 24" aria-hidden><circle cx="10.5" cy="10.5" r="6.5" /><line x1="15.5" y1="15.5" x2="21" y2="21" /></svg>
        <input ref={input} value={q} placeholder={L('Busca un entrenador o un club…', 'Search for a coach or a club…')} aria-label={L('Buscar entrenador o club', 'Search coach or club')}
          role="combobox" aria-expanded={open && !!q} aria-controls="msearch-list" aria-autocomplete="list"
          onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(shown.length - 1, s + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
            else if (e.key === 'Enter' && shown[sel]) go(shown[sel].p.id)
            else if (e.key === 'Escape') { setQ(''); input.current?.blur() }
          }} />
        {q ? <button className="msearch-x" aria-label={L('Limpiar búsqueda', 'Clear search')} onClick={() => { setQ(''); input.current?.focus() }}>×</button>
          : <kbd className="msearch-kbd" aria-hidden>/</kbd>}
      </div>
      {open && q && (
        <ul className="msearch-list" id="msearch-list" role="listbox">
          {shown.length === 0 && <li className="msearch-empty">{L(`Ningún DT ni club coincide con «${q}».`, `No coach or club matches “${q}”.`)}</li>}
          {shown.map((r, i) => {
            const m = media.dts?.[r.p.id] ?? {}
            return (
              <li key={r.p.id} role="option" aria-selected={i === sel}>
                <button className="msearch-row" onMouseEnter={() => setSel(i)} onMouseDown={e => e.preventDefault()} onClick={() => go(r.p.id)}>
                  <CoachPhoto name={r.p.nombre} src={m.foto} size={40} />
                  <span className="msearch-who">
                    <b>{shortName(r.p.nombre)}</b>
                    <span className="msearch-meta">
                      {r.now && <><ClubLogo club={r.now} media={media} size={14} /> {m.vigente ? r.now : L(`último club: ${r.now}`, `last club: ${r.now}`)}</>}
                      {r.clubHit && r.clubHit !== r.now && <span className="msearch-past">· {L('dirigió a', 'coached')} {r.clubHit}</span>}
                      <span>· {r.p.partidos} {L('partidos', 'matches')}</span>
                    </span>
                  </span>
                  <span className="msearch-fam" style={{ ['--hue' as string]: hueOf(r.p.grupo) }}><i />{famL(r.p.grupo)}</span>
                  {m.vigente && <span className="msearch-live">{L('activo', 'active')}</span>}
                </button>
              </li>
            )
          })}
          {res.length > shown.length && <li className="msearch-more">{L(`${res.length - shown.length} más resaltados en el mapa`, `${res.length - shown.length} more highlighted on the map`)}</li>}
        </ul>
      )}
      {q && !open && <div className="msearch-count">{res.length} {res.length === 1 ? L('coincidencia', 'match') : L('coincidencias', 'matches')} {L('en el mapa', 'on the map')}</div>}
    </div>
  )
}
