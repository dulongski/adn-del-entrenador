import { useEffect, useRef, useState } from 'react'
import { fmt } from '../lib'
import { L } from '../settings'

/** Mismos tonos por familia de estilo que el mapa de la portada (StyleMap.tsx). */
export const HUES = ['var(--c-dt)', 'var(--c-plantilla)', 'var(--c-club)', 'var(--c-rival)', 'var(--c-ctx)', '#008300']
export const famHue = (g: number) => HUES[g % HUES.length]

/** Texto sin acentos y en minúsculas, para buscar. */
export const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** +0.76 / −0.07 (signo tipográfico). */
export const signed = (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), d)}`

/** Formato de un valor crudo según su escala ("Posesión (%)" → 49.2%). */
export function rawFormat(etiqueta: string, liga: number) {
  const d = Math.abs(liga) >= 20 ? 1 : 2
  const pct = /%/.test(etiqueta)
  return (v: number) => `${fmt(v, d)}${pct ? '%' : ''}`
}

export const apellido = (n: string) => n.split(' ').at(-1) ?? n

/** Ordinal: 3º en español; 3rd en inglés. */
export const ordinal = (n: number) => L(`${n}º`, `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`)

/** Ancho real de un elemento (para dibujar SVG a tamaño 1:1, sin escalar el texto). */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}
