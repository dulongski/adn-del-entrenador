import { useEffect, useMemo, useRef, useState } from 'react'
import boot from './boot.json'
import { dataUrl, fmt, getJSON, shortName, type Any } from './lib'
import { L } from './settings'

/* Distribución entre DTs ("campana"): densidad espejada de los 70+ DTs para un indicador, cada DT
   como un punto (pasa el cursor para ver quién es), la línea de la liga y el/los DT(s) resaltados.
   Datos: web/public/data/dist.json (pipeline/dist.py): kpis[k].a = efecto propio α, .v = valor crudo
   en sus partidos, .se = error; cambios[k] = efecto neto de sus cambios. */

let distP: Promise<Any> | null = null
/** dist.json se pide una sola vez por sesión. */
export function useDistData(): Any | null {
  const [d, setD] = useState<Any>(null)
  useEffect(() => { distP ??= getJSON(dataUrl('dist.json')); distP.then(setD).catch(() => setD(false)) }, [])
  return d || null
}

const NAMES: Record<string, string> = Object.fromEntries(((boot as Any).global.dts as Any[]).map(d => [String(d.id), shortName(d.nombre)]))
export const coachShort = (id: number | string) => NAMES[String(id)] ?? String(id)

/** Valores {id, v} de un mapa {id: valor}. */
export const toValues = (m: Record<string, number> | undefined) => Object.entries(m ?? {}).map(([id, v]) => ({ id, v }))

/** Posición de v entre los valores: cuántos DTs tienen un valor menor (para frases tipo "más que 60 de 74 DTs"). */
export function rankOf(values: { v: number }[], v: number) {
  const below = values.filter(o => o.v < v).length
  return { below, above: values.length - below - 1, n: values.length, pct: values.length > 1 ? (100 * below) / (values.length - 1) : 50 }
}

export type Mark = { id: number | string; color: string; label?: string }

export default function Dist({ values, marks, refV = 0, refLabel = L('liga', 'league'), format = (v: number) => fmt(v, 2), low = L('menos', 'less'), high = L('más', 'more'),
  height = 96, compact = false }: {
  values: { id: number | string; v: number }[]; marks: Mark[]; refV?: number | null; refLabel?: string; format?: (v: number) => string
  low?: string; high?: string; height?: number; compact?: boolean
}) {
  const [hover, setHover] = useState<string | null>(null)
  // se dibuja al ancho real del contenedor (1 unidad = 1 px): los textos no se encogen en el teléfono
  const svgRef = useRef<SVGSVGElement>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(([e]) => { const cw = Math.round(e.contentRect.width); if (cw > 0) setW(Math.max(260, cw)) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const W = w, padX = 18, top = compact ? 22 : 30, bot = compact ? 18 : 24, H = height + top + bot, mid = top + height / 2
  const geo = useMemo(() => {
    const vs = values.map(o => o.v).filter(Number.isFinite)
    if (vs.length < 3) return null
    let lo = Math.min(...vs, ...(refV != null ? [refV] : [])), hi = Math.max(...vs, ...(refV != null ? [refV] : []))
    const span = hi - lo || 1
    lo -= span * 0.06; hi += span * 0.06
    const X = (v: number) => padX + ((v - lo) / (hi - lo)) * (W - 2 * padX)
    // KDE gaussiano, ancho de banda de Silverman
    const n = vs.length, mean = vs.reduce((s, v) => s + v, 0) / n
    const sd = Math.sqrt(vs.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || span / 4
    const bw = 1.06 * sd * n ** -0.2
    const grid = Array.from({ length: 90 }, (_, i) => lo + ((hi - lo) * i) / 89)
    const dens = grid.map(g => vs.reduce((s, v) => s + Math.exp(-0.5 * ((g - v) / bw) ** 2), 0))
    const dmax = Math.max(...dens)
    const half = height / 2 - 2
    const up = grid.map((g, i) => `${X(g).toFixed(1)},${(mid - (dens[i] / dmax) * half).toFixed(1)}`)
    const dn = grid.map((g, i) => `${X(g).toFixed(1)},${(mid + (dens[i] / dmax) * half).toFixed(1)}`).reverse()
    const densAt = (v: number) => vs.reduce((s, x) => s + Math.exp(-0.5 * ((v - x) / bw) ** 2), 0) / dmax
    // enjambre: cada DT alterna arriba/abajo del eje dentro de la campana sin encimarse
    const r = 3.6
    const placed: { x: number; y: number }[] = []
    const dots = [...values].filter(o => Number.isFinite(o.v)).sort((a, b) => a.v - b.v).map(o => {
      const x = X(o.v), lim = Math.max(r, densAt(o.v) * half - r)
      let y = mid
      for (let k = 0; k < 60; k++) {
        const off = Math.ceil(k / 2) * (r * 1.7) * (k % 2 ? -1 : 1)
        if (Math.abs(off) > lim) { y = mid + (Math.random() - 0.5) * lim; break }
        y = mid + off
        if (!placed.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < (2 * r) ** 2 * 0.92)) break
      }
      placed.push({ x, y })
      return { id: String(o.id), v: o.v, x, y }
    })
    return { X, poly: [...up, ...dn].join(' '), dots, r }
  }, [values, refV, height, mid, W])
  if (!geo) return null
  const markIds = new Set(marks.map(m => String(m.id)))
  const hv = hover ? geo.dots.find(d => d.id === hover) : null

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="dist" role="img" style={{ width: '100%', display: 'block', overflow: 'visible' }}
         aria-label={marks.map(m => `${m.label ?? coachShort(m.id)}: ${format(values.find(o => String(o.id) === String(m.id))?.v ?? NaN)}`).join(' · ')}>
      <polygon points={geo.poly} fill="color-mix(in oklab, var(--ink) 9%, transparent)" stroke="color-mix(in oklab, var(--ink) 22%, transparent)" strokeWidth={1} />
      {refV != null && (
        <g>
          <line x1={geo.X(refV)} x2={geo.X(refV)} y1={top - 6} y2={top + height + 4} stroke="var(--ink-2)" strokeDasharray="3 3" />
          <text x={geo.X(refV)} y={top + height + 16} fontSize={11.5} textAnchor="middle" fill="var(--ink-3)">{refLabel}</text>
        </g>
      )}
      {!compact && <>
        <text x={padX} y={top + height + 16} fontSize={11.5} fill="var(--ink-3)">← {low}</text>
        <text x={W - padX} y={top + height + 16} fontSize={11.5} fill="var(--ink-3)" textAnchor="end">{high} →</text>
      </>}
      {geo.dots.filter(d => !markIds.has(d.id)).map(d => (
        <circle key={d.id} cx={d.x} cy={d.y} r={hover === d.id ? geo.r + 1.6 : geo.r} fill={hover === d.id ? 'var(--ink)' : 'var(--ink-3)'} opacity={hover === d.id ? 1 : 0.55}
                onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }} />
      ))}
      {marks.map((m, i) => {
        const d = geo.dots.find(o => o.id === String(m.id))
        if (!d) return null
        const ty = i % 2 ? top + height + (compact ? 14 : 16) : top - 10
        const anchor = d.x < 90 ? 'start' : d.x > W - 90 ? 'end' : 'middle'
        return (
          <g key={String(m.id)} onMouseEnter={() => setHover(null)}>
            <line x1={d.x} x2={d.x} y1={i % 2 ? d.y : top - 4} y2={i % 2 ? top + height + 4 : d.y} stroke={m.color} strokeWidth={2} />
            <circle cx={d.x} cy={d.y} r={geo.r + 3.4} fill={m.color} stroke="var(--surface)" strokeWidth={2} />
            <text x={d.x} y={ty} fontSize={12.5} fontWeight={700} textAnchor={anchor} fill="var(--ink)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">
              {m.label ?? coachShort(m.id)} · {format(d.v)}
            </text>
          </g>
        )
      })}
      {hv && (
        <g pointerEvents="none">
          <rect x={Math.min(W - 170, Math.max(0, hv.x - 85))} y={hv.y - 34} width={170} height={22} rx={5} fill="var(--ink)" />
          <text x={Math.min(W - 170, Math.max(0, hv.x - 85)) + 85} y={hv.y - 19} fontSize={12} textAnchor="middle" fill="var(--surface)">{coachShort(hv.id)} · {format(hv.v)}</text>
        </g>
      )}
    </svg>
  )
}
