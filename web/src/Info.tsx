import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { L } from './settings'

/* "i" en un circulito: el texto explicativo aparece al pasar el cursor (o al tocar / enfocar con teclado).
   Úsalo junto a títulos y leyendas en lugar de párrafos debajo:  <h3>Título <Info>explicación…</Info></h3> */
export default function Info({ children, label, wide = false }: { children: ReactNode; label?: string; wide?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  // posición fija calculada desde el icono, siempre dentro de la pantalla; la flecha apunta al icono
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const pop = ref.current.querySelector<HTMLElement>('.info-pop')
    if (!pop) return
    const place = () => {
      const ic = ref.current!.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, m = 12
      const cx = ic.left + ic.width / 2
      const vw = document.documentElement.clientWidth || window.innerWidth
      const left = Math.max(m, Math.min(vw - m - w, cx - w / 2))
      const below = ic.bottom + 8 + h < window.innerHeight - m || ic.top - 8 - h < m
      pop.style.left = `${Math.round(left)}px`
      pop.style.top = `${Math.round(below ? ic.bottom + 8 : ic.top - 8 - h)}px`
      pop.style.setProperty('--ax', `${Math.round(cx - left)}px`)
      pop.classList.toggle('up', !below)
    }
    place()
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [open])
  return (
    <span ref={ref} className={`info${open ? ' open' : ''}${wide ? ' wide' : ''}`} tabIndex={0} role="button"
      aria-label={label ?? L('Más información', 'More info')} aria-expanded={open}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
      onKeyDown={e => { if (e.key === 'Escape') (e.currentTarget as HTMLElement).blur() }}>
      <span className="info-i" aria-hidden>i</span>
      {open && <span className="info-pop" role="tooltip">{children}</span>}
    </span>
  )
}
