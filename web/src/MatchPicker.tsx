import { useEffect, useMemo, useRef, useState } from 'react'
import { ClubLogo } from './charts'
import { type Any } from './lib'
import './styles/lab.css'

/* Selector de partido del Laboratorio: compacto cuando está cerrado (tarjeta del partido elegido +
   flechas para ir al anterior/siguiente); al abrir, buscador + filtros por club y resultado + tarjetas.
   Teclado: ↑↓←→ para moverse, Enter elige, Esc cierra. */

export type MatchRow = { match_id: number; fecha: string; club: string; rival: string; local: boolean; gf: number; gc: number; temporada?: string; xg?: number; xg_rival?: number }
type Res = 'G' | 'E' | 'P'
const resOf = (m: MatchRow): Res => (m.gf > m.gc ? 'G' : m.gf === m.gc ? 'E' : 'P')
const RES_TXT: Record<Res, string> = { G: 'Victoria', E: 'Empate', P: 'Derrota' }
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const x1 = (v: number) => v.toFixed(1)
export const fechaCorta = (f: string) => { const [y, m, d] = f.split('-'); return `${Number(d)} ${MESES[Number(m) - 1]} ${y}` }

/** Club actual del DT (media.dts[id].club) si dirigió partidos ahí; si no, el de su etapa más reciente. */
export function currentClub(art: Any, media: Any, clubs: string[]): string | undefined {
  const c = media?.dts?.[art.id]?.club
  if (c && clubs.includes(c)) return c
  const et = (art.etapas ?? []) as Any[]
  for (let i = et.length - 1; i >= 0; i--) if (clubs.includes(et[i].club)) return et[i].club
  return clubs[0]
}

function ResChip({ m }: { m: MatchRow }) {
  const r = resOf(m)
  return <span className={`mp-res r-${r}`} title={RES_TXT[r]}><i>{r}</i>{m.gf}–{m.gc}</span>
}

function Card({ m, media, multiClub }: { m: MatchRow; media: Any; multiClub: boolean }) {
  return (
    <>
      <span className="mp-meta"><span>{fechaCorta(m.fecha)}</span><span className={`mp-ha ${m.local ? 'h' : 'a'}`}>{m.local ? 'Local' : 'Visita'}</span></span>
      <span className="mp-rival"><ClubLogo club={m.rival} media={media} size={22} /><span className="mp-rname">{m.local ? 'vs' : 'en'} {m.rival}</span></span>
      <span className="mp-foot">
        <ResChip m={m} />
        {m.xg != null && <span className="mp-xg" title="Goles esperados (xG) de cada equipo">xG {x1(m.xg)}–{x1(m.xg_rival ?? 0)}</span>}
        {multiClub && <span className="mp-club" title={`Con ${m.club}`}><ClubLogo club={m.club} media={media} size={14} /></span>}
      </span>
    </>
  )
}

export default function MatchPicker({ rows, value, onChange, media, defaultClub }: { rows: MatchRow[]; value: number; onChange: (id: number) => void; media: Any; defaultClub?: string }) {
  // rows: del más reciente al más antiguo
  const clubs = useMemo(() => {
    const c = new Map<string, number>()
    rows.forEach(r => c.set(r.club, (c.get(r.club) ?? 0) + 1))
    return [...c.entries()]
  }, [rows])
  const multiClub = clubs.length > 1
  const sel = rows.find(r => r.match_id === value) ?? rows[0]
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [fClub, setFClub] = useState<string>(defaultClub && clubs.some(([c]) => c === defaultClub) ? defaultClub : 'todos')
  const [fRes, setFRes] = useState<'todos' | Res>('todos')
  const [act, setAct] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const shown = useMemo(() => {
    const t = norm(q.trim())
    return rows.filter(r => (fClub === 'todos' || r.club === fClub) && (fRes === 'todos' || resOf(r) === fRes)
      && (!t || norm(`${r.rival} ${r.fecha} ${fechaCorta(r.fecha)} ${r.gf}-${r.gc} ${r.temporada ?? ''}`).includes(t)))
  }, [rows, q, fClub, fRes])
  const counts = useMemo(() => {
    const base = rows.filter(r => fClub === 'todos' || r.club === fClub)
    return { todos: base.length, G: base.filter(r => resOf(r) === 'G').length, E: base.filter(r => resOf(r) === 'E').length, P: base.filter(r => resOf(r) === 'P').length }
  }, [rows, fClub])

  // flechas del selector cerrado: recorren la lista filtrada (o toda, si el elegido no está en ella)
  const nav = shown.some(r => r.match_id === sel?.match_id) ? shown : rows
  const iSel = nav.findIndex(r => r.match_id === sel?.match_id)
  const older = iSel >= 0 && iSel < nav.length - 1 ? nav[iSel + 1] : null
  const newer = iSel > 0 ? nav[iSel - 1] : null

  useEffect(() => {
    if (!open) return
    const i = shown.findIndex(r => r.match_id === value)
    setAct(i >= 0 ? i : 0)
    // que el panel quede visible bajo la barra fija
    const top = root.current?.getBoundingClientRect().top ?? 0
    if (top < 170 || top > window.innerHeight * 0.55) window.scrollBy({ top: top - 170, behavior: 'smooth' })
    setTimeout(() => input.current?.focus({ preventScroll: true }), 0)
    const close = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAct(a => Math.min(a, Math.max(0, shown.length - 1))) }, [shown.length])
  useEffect(() => {
    if (!open) return
    // desplaza solo la lista (scrollIntoView movería también la página)
    const ul = list.current, el = ul?.querySelector<HTMLElement>(`[data-i="${act}"]`)
    if (ul && el) {
      const t = el.offsetTop - ul.offsetTop, b = t + el.offsetHeight
      if (t < ul.scrollTop) ul.scrollTop = t - 4
      else if (b > ul.scrollTop + ul.clientHeight) ul.scrollTop = b - ul.clientHeight + 4
    }
  }, [act, open])

  const pick = (id: number) => { onChange(id); setOpen(false) }
  const cols = () => {
    const ul = list.current
    if (!ul) return 1
    return Math.max(1, getComputedStyle(ul).gridTemplateColumns.split(' ').length)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return }
    if (!shown.length) return
    const n = shown.length, c = cols()
    const mv = (d: number) => { e.preventDefault(); setAct(a => Math.max(0, Math.min(n - 1, a + d))) }
    if (e.key === 'ArrowDown') mv(c)
    else if (e.key === 'ArrowUp') mv(-c)
    else if (e.key === 'ArrowRight' && (e.target as HTMLElement).tagName !== 'INPUT') mv(1)
    else if (e.key === 'ArrowLeft' && (e.target as HTMLElement).tagName !== 'INPUT') mv(-1)
    else if (e.key === 'Enter') { e.preventDefault(); pick(shown[act].match_id) }
  }

  if (!sel) return null
  return (
    <div className="mp" ref={root} onKeyDown={open ? onKey : undefined}>
      <div className="mp-bar">
        <button className="mp-step" onClick={() => older && onChange(older.match_id)} disabled={!older} aria-label="Partido anterior" title="Partido anterior">‹</button>
        <button className={`mp-closed${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
          <span className="mp-lab">Partido</span>
          <span className="mp-date">{fechaCorta(sel.fecha)}</span>
          <span className="mp-rival"><ClubLogo club={sel.rival} media={media} size={24} /><span className="mp-rname">{sel.local ? 'vs' : 'en'} {sel.rival}</span></span>
          <ResChip m={sel} />
          {sel.xg != null && <span className="mp-xg mp-hide-sm">xG {x1(sel.xg)}–{x1(sel.xg_rival ?? 0)}</span>}
          <span className="mp-change">{open ? 'Cerrar' : 'Cambiar'}<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d={open ? 'M2 8 L6 4 L10 8' : 'M2 4 L6 8 L10 4'} fill="none" stroke="currentColor" strokeWidth="2" /></svg></span>
        </button>
        <button className="mp-step" onClick={() => newer && onChange(newer.match_id)} disabled={!newer} aria-label="Partido siguiente" title="Partido siguiente">›</button>
      </div>
      {open && (
        <div className="mp-pop" role="dialog" aria-label="Elegir partido">
          <div className="mp-tools">
            <input ref={input} className="mp-search" type="search" value={q} onChange={e => { setQ(e.target.value); setAct(0) }}
                   placeholder="Busca rival, fecha o marcador…" aria-label="Buscar partido"
                   aria-controls="mp-list" aria-activedescendant={shown[act] ? `mp-o-${shown[act].match_id}` : undefined} />
            {multiClub && (
              <div className="mp-chips" role="group" aria-label="Club">
                {clubs.map(([c, n]) => (
                  <button key={c} aria-pressed={fClub === c} onClick={() => { setFClub(c); setAct(0) }}><ClubLogo club={c} media={media} size={16} />{c}<small>{n}</small></button>
                ))}
                <button aria-pressed={fClub === 'todos'} onClick={() => { setFClub('todos'); setAct(0) }}>Toda su carrera<small>{rows.length}</small></button>
              </div>
            )}
            <div className="mp-chips" role="group" aria-label="Resultado">
              {(['todos', 'G', 'E', 'P'] as const).map(r => (
                <button key={r} aria-pressed={fRes === r} className={r !== 'todos' ? `rf-${r}` : ''} onClick={() => { setFRes(r); setAct(0) }}>
                  {r === 'todos' ? 'Todos' : r === 'G' ? 'Ganados' : r === 'E' ? 'Empatados' : 'Perdidos'}<small>{counts[r]}</small>
                </button>
              ))}
            </div>
          </div>
          <ul className="mp-list" id="mp-list" role="listbox" ref={list} aria-label="Partidos">
            {shown.map((m, i) => (
              <li key={m.match_id} id={`mp-o-${m.match_id}`} data-i={i} role="option" aria-selected={m.match_id === value}
                  className={`mp-card${i === act ? ' act' : ''}${m.match_id === value ? ' cur' : ''}`}
                  onMouseEnter={() => setAct(i)} onClick={() => pick(m.match_id)}>
                <Card m={m} media={media} multiClub={multiClub && fClub === 'todos'} />
              </li>
            ))}
            {!shown.length && <li className="note mp-empty">Ningún partido coincide.</li>}
          </ul>
          <div className="mp-hint note">{shown.length} partidos · ↑↓←→ para moverte, Enter para elegir, Esc para cerrar</div>
        </div>
      )}
    </div>
  )
}
