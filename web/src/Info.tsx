import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { L } from './settings'

/* "i" en un circulito: el texto explicativo aparece al pasar el cursor (o al tocar / enfocar con teclado).
   Úsalo junto a títulos y leyendas en lugar de párrafos debajo:  <h3>Título <Info>explicación…</Info></h3> */
export default function Info({ children, label, wide = false }: { children: ReactNode; label?: string; wide?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  // mantiene el globo dentro de la pantalla
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const pop = ref.current.querySelector<HTMLElement>('.info-pop')
    if (!pop) return
    const r = pop.getBoundingClientRect(), m = 12
    setShift(r.left < m ? m - r.left : r.right > window.innerWidth - m ? window.innerWidth - m - r.right : 0)
  }, [open])
  return (
    <span ref={ref} className={`info${open ? ' open' : ''}${wide ? ' wide' : ''}`} tabIndex={0} role="button"
      aria-label={label ?? L('Más información', 'More info')} aria-expanded={open}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => { setOpen(false); setShift(0) }}
      onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setShift(0) }}
      onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
      onKeyDown={e => { if (e.key === 'Escape') (e.currentTarget as HTMLElement).blur() }}>
      <span className="info-i" aria-hidden>i</span>
      {open && <span className="info-pop" role="tooltip" style={{ translate: `${shift}px 0` }}>{children}</span>}
    </span>
  )
}
