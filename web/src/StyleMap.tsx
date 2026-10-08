import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { asset, initials, shortName, sig, type Any } from './lib'
import MapSearch, { searchCoaches } from './MapSearch'

/* Paleta categórica validada (orden fijo), aplicada a las familias de estilo con opacidad baja. */
const HUES = ['var(--c-dt)', 'var(--c-plantilla)', 'var(--c-club)', 'var(--c-rival)', 'var(--c-ctx)', '#008300']

type Dim = '2d' | '3d'
type Mode = 'pca' | 'vars'
type Axis = { negativo: string; positivo: string }
type Hover = { d: Any; x: number; y: number } | null

function hash(n: number) { const x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x) }

/** Estandariza y comprime extremos (arcsinh): pocos DTs atípicos no amontonan al resto. Conserva el orden. */
function soft(a: number[]) {
  const m = a.reduce((s, v) => s + v, 0) / a.length
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1
  return a.map(v => Math.asinh(((v - m) / sd) * 1.3))
}

function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d } catch { return d } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } }

const PREF = ['posesion', 'ppda', 'verticalidad']

export default function StyleMap({ mapa, media, kpis, onPick, activos = false, setActivos }: { mapa: Any; media: Any; kpis: Any; onPick: (id: number) => void; activos?: boolean; setActivos?: (v: boolean) => void }) {
  const [dim, setDim] = useState<Dim>(() => load('mapa.dim', '2d'))
  const [mode, setMode] = useState<Mode>(() => load('mapa.mode', 'pca'))
  const avail: string[] = mapa.kpis
  const [vars, setVars] = useState<{ x: string; y: string; z: string }>(() => {
    const v = load('mapa.vars', { x: PREF[0], y: PREF[1], z: PREF[2] })
    return { x: avail.includes(v.x) ? v.x : avail[0], y: avail.includes(v.y) ? v.y : avail[1], z: avail.includes(v.z) ? v.z : avail[2] }
  })
  const [focus, setFocus] = useState<number | null>(null)
  const [hover, setHover] = useState<Hover>(null)
  const [legendOpen, setLegendOpen] = useState(() => load('mapa.leyenda', window.innerWidth >= 700))
  useEffect(() => save('mapa.leyenda', legendOpen), [legendOpen])
  useEffect(() => save('mapa.dim', dim), [dim])
  useEffect(() => save('mapa.mode', mode), [mode])
  useEffect(() => save('mapa.vars', vars), [vars])

  const label = (k: string) => (kpis[k]?.etiqueta || k).replace(/\s*\(.*?\)\s*/g, ' ').trim()
  // coordenadas crudas según el modo
  const coords = useMemo(() => {
    const P: Any[] = mapa.puntos
    const raw = mode === 'pca'
      ? [P.map(p => p.x), P.map(p => p.y), P.map(p => p.z ?? 0)]
      : [P.map(p => p.alpha[vars.x] ?? 0), P.map(p => p.alpha[vars.y] ?? 0), P.map(p => p.alpha[vars.z] ?? 0)]
    const s = raw.map(soft)
    return P.map((_, i) => [s[0][i], s[1][i], s[2][i]] as [number, number, number])
  }, [mapa, mode, vars])
  const axes: { x: Axis; y: Axis; z: Axis } = mode === 'pca' ? mapa.ejes : {
    x: { negativo: `menos ${label(vars.x).toLowerCase()}`, positivo: `más ${label(vars.x).toLowerCase()}` },
    y: { negativo: `menos ${label(vars.y).toLowerCase()}`, positivo: `más ${label(vars.y).toLowerCase()}` },
    z: { negativo: `menos ${label(vars.z).toLowerCase()}`, positivo: `más ${label(vars.z).toLowerCase()}` },
  }
  const varAxes = (dim === '3d' ? ['x', 'y', 'z'] : ['x', 'y']) as ('x' | 'y' | 'z')[]
  const families = ['Construcción', 'Progresión', 'Ocasiones', 'Presión', 'Organización defensiva', 'Transiciones', 'Dominio', 'Balón parado']

  // solo activos: se ocultan los DTs sin club actual; los demás conservan su lugar
  const hidden = useMemo(() => new Set<number>(activos ? mapa.puntos.filter((p: Any) => !media.dts?.[p.id]?.vigente).map((p: Any) => p.id) : []), [activos, mapa, media])
  const [q, setQ] = useState('')
  const [pulse, setPulse] = useState<number | null>(null)
  const match = useMemo(() => { const r = searchCoaches(mapa, media, q); return r ? new Set<number>(r.map(o => o.p.id)) : null }, [mapa, media, q])
  const common = { mapa, media, coords, axes, focus, setHover, onPick, groupLabels: mode === 'pca', hidden, match, pulse }
  return (
    <div className="smap-wrap">
      {dim === '2d' ? <Map2D {...common} /> : <Map3D {...common} />}
      <MapSearch mapa={mapa} media={media} onPick={onPick} q={q} setQ={setQ} setPulse={setPulse} hueOf={g => HUES[g % HUES.length]} />

      <div className="smap-ctrl" onPointerDown={e => e.stopPropagation()}>
        <div className="seg sm" role="group" aria-label="Dimensiones">
          <button aria-pressed={dim === '2d'} onClick={() => setDim('2d')}>2D</button>
          <button aria-pressed={dim === '3d'} onClick={() => setDim('3d')}>3D</button>
        </div>
        <div className="seg sm" role="group" aria-label="Qué define los ejes">
          <button aria-pressed={mode === 'pca'} onClick={() => setMode('pca')}>Ejes PCA</button>
          <button aria-pressed={mode === 'vars'} onClick={() => setMode('vars')}>Elegir variables</button>
        </div>
        {mode === 'vars' && (
          <div className="smap-vars">
            {varAxes.map(a => (
              <label key={a} htmlFor={`var-${a}`}><b>{a.toUpperCase()}</b>
                <select id={`var-${a}`} value={vars[a]} onChange={e => setVars(v => ({ ...v, [a]: e.target.value }))}>
                  {families.map(f => {
                    const ks = avail.filter(k => kpis[k]?.familia === f)
                    return ks.length ? <optgroup key={f} label={f}>{ks.map(k => <option key={k} value={k}>{label(k)}</option>)}</optgroup> : null
                  })}
                </select>
              </label>
            ))}
            <div className="note">Efecto propio del DT en σ (sin plantilla, club ni rival).</div>
          </div>
        )}
        {setActivos && (
          <label className="smap-activos" htmlFor="map-activos"><input id="map-activos" type="checkbox" checked={activos} onChange={e => setActivos(e.target.checked)} /> Solo DTs activos</label>
        )}
        {mode === 'pca' && <div className="note">{dim === '3d' ? `3 componentes · ${Math.round(100 * (mapa.varianza_total_3d ?? 0))}% de la variación` : `2 componentes · ${Math.round(100 * mapa.varianza_total)}% de la variación`}</div>}
      </div>

      <div className={`smap-legend${legendOpen ? '' : ' closed'}`} onPointerDown={e => e.stopPropagation()}>
        <button className="smap-legend-head" onClick={() => setLegendOpen(o => !o)} aria-expanded={legendOpen}>
          {!legendOpen && <span className="dots">{mapa.grupos.map((g: Any) => <i key={g.id} style={{ background: HUES[g.id % HUES.length] }} />)}</span>}
          Familias {legendOpen ? '▾' : '▸'}
        </button>
        {legendOpen && mapa.grupos.map((g: Any) => (
          <button key={g.id} className="smap-chip" aria-pressed={focus === g.id} onClick={() => setFocus(f => (f === g.id ? null : g.id))} title="Resaltar esta familia">
            <i style={{ background: HUES[g.id % HUES.length] }} />{g.nombre} <span className="note">{g.n}</span>
          </button>
        ))}
      </div>

      {hover && (
        <div className="tip" style={{ left: Math.min(hover.x + 14, window.innerWidth - 310), top: hover.y + 14 }}>
          <b>{hover.d.nombre}</b><br />
          {hover.d.clubes.join(' → ')} · {hover.d.partidos} partidos<br />
          <span style={{ opacity: 0.8 }}>{mapa.grupos[hover.d.grupo]?.nombre}</span>
          {mode === 'vars'
            ? varAxes.map(a => <div key={a}>{a.toUpperCase()} · {label(vars[a])}: <b>{sig(hover.d.alpha[vars[a]])}</b></div>)
            : hover.d.rasgos?.length ? <div style={{ opacity: 0.8 }}>{hover.d.rasgos.join(', ')}</div> : null}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ burbuja */
function Bubble({ d, media, r, style, dim, cls, showName, nameSize, onPick, setHover, dragged }: {
  d: Any; media: Any; r: number; style: CSSProperties; dim: boolean; cls?: string; showName?: boolean; nameSize?: number
  onPick: (id: number) => void; setHover: (h: Hover) => void; dragged: React.MutableRefObject<boolean>
}) {
  const m = media.dts?.[d.id] || {}
  const club = m.club || d.clubes.at(-1)
  const logo = asset(media.clubes?.[club]?.logo)
  return (
    <button className={`bub${cls ? ` ${cls}` : ''}${dim ? ' dim' : ''}`} style={{ ...style, '--hue': HUES[d.grupo % HUES.length] } as CSSProperties}
      aria-label={`${d.nombre}, ${d.partidos} partidos. Abrir perfil`}
      onClick={() => { if (!dragged.current) onPick(d.id) }}
      onMouseMove={e => setHover({ d, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHover(null)}
      onFocus={e => { const b = e.currentTarget.getBoundingClientRect(); setHover({ d, x: b.right, y: b.bottom }) }} onBlur={() => setHover(null)}>
      <span className="bub-face">
        {m.foto ? <img src={asset(m.foto)!} alt="" draggable={false} /> : <span className="bub-ini" style={{ fontSize: r * 0.7 }}>{initials(d.nombre)}</span>}
      </span>
      {logo && <span className="bub-logo" style={{ width: r * 0.78, height: r * 0.78 }}><img src={logo} alt="" draggable={false} /></span>}
      {showName && <span className="bub-name" style={{ fontSize: nameSize }}>{shortName(d.nombre)}</span>}
    </button>
  )
}

type MapProps = { mapa: Any; media: Any; coords: [number, number, number][]; axes: { x: Axis; y: Axis; z: Axis }; focus: number | null; setHover: (h: Hover) => void; onPick: (id: number) => void; groupLabels?: boolean; hidden: Set<number>; match: Set<number> | null; pulse: number | null }

/* Gestos comunes: pellizco / rueda = zoom; arrastre = mover (2D) o girar (3D). */
function useGestures(ref: React.RefObject<HTMLDivElement | null>, onZoom: (f: number, x: number, y: number) => void, onDrag: (dx: number, dy: number) => void) {
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<number | null>(null)
  const dragged = useRef(false)
  const local = (e: { clientX: number; clientY: number }) => { const b = ref.current!.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top } }
  const zoomRef = useRef(onZoom); zoomRef.current = onZoom
  const dragRef = useRef(onDrag); dragRef.current = onDrag
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e)
      if (e.ctrlKey || (Math.abs(e.deltaY) >= 50 && e.deltaX === 0)) zoomRef.current(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), p.x, p.y)
      else dragRef.current(-e.deltaX, -e.deltaY)
    }
    let last = 1
    const gs = (e: Any) => { e.preventDefault(); last = 1 }
    const gc = (e: Any) => { e.preventDefault(); const p = local(e); zoomRef.current(e.scale / last, p.x, p.y); last = e.scale }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', gs as EventListener)
    el.addEventListener('gesturechange', gc as EventListener)
    return () => { el.removeEventListener('wheel', onWheel); el.removeEventListener('gesturestart', gs as EventListener); el.removeEventListener('gesturechange', gc as EventListener) }
  }, [ref]) // eslint-disable-line react-hooks/exhaustive-deps
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      pointers.current.set(e.pointerId, local(e)); dragged.current = false
      if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y) }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const prev = pointers.current.get(e.pointerId)
      if (!prev) return
      const p = local(e)
      pointers.current.set(e.pointerId, p)
      if (pointers.current.size === 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        onZoom(d / pinch.current, (a.x + b.x) / 2, (a.y + b.y) / 2)
        pinch.current = d; dragged.current = true
      } else if (pointers.current.size === 1) {
        const dx = p.x - prev.x, dy = p.y - prev.y
        dragged.current = dragged.current || Math.abs(dx) + Math.abs(dy) > 3
        if (dragged.current) { ref.current?.setPointerCapture?.(e.pointerId); onDrag(dx, dy) }
      }
    },
    onPointerUp: (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null },
    onPointerCancel: (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); pinch.current = null },
  }
  return { handlers, dragged }
}

function useSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ W: 1200, H: 800 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ W: e.contentRect.width, H: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

/* ================================================================ 2D */
function Map2D({ mapa, media, coords, axes, focus, setHover, onPick, groupLabels, hidden, match, pulse }: MapProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { W, H } = useSize(ref)
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const zoomAt = (f: number, sx: number, sy: number) => setView(v => {
    const k = Math.min(6, Math.max(0.6, v.k * f)), r = k / v.k
    return { k, x: sx - (sx - v.x) * r, y: sy - (sy - v.y) * r }
  })
  const { handlers, dragged } = useGestures(ref, zoomAt, (dx, dy) => setView(v => ({ ...v, x: v.x + dx, y: v.y + dy })))

  const nodes = useMemo(() => {
    const P: Any[] = mapa.puntos
    const narrow = W < 600
    const pad = narrow ? { l: 44, r: 44, t: 262, b: 150 } : { l: 70, r: 70, t: 150, b: 70 }
    const xs = coords.map(c => c[0]), ys = coords.map(c => c[1])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const sx = (W - pad.l - pad.r) / (x1 - x0 || 1), sy = (H - pad.t - pad.b) / (y1 - y0 || 1)
    const sX = Math.min(sx, sy * 1.6), sY = Math.min(sy, sx * 1.6)
    const cx = pad.l + (W - pad.l - pad.r - sX * (x1 - x0)) / 2, cy = pad.b + (H - pad.t - pad.b - sY * (y1 - y0)) / 2
    const maxP = Math.max(...P.map(p => p.partidos))
    const base = Math.max(13, Math.min(W, H) / 42)
    const ns = P.map((d, i) => ({ d, r: base * (0.75 + 0.9 * Math.sqrt(d.partidos / maxP)), px: cx + (coords[i][0] - x0) * sX, py: H - (cy + (coords[i][1] - y0) * sY) }))
    const home = ns.map(n => [n.px, n.py])
    for (let it = 0; it < 220; it++) {
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j]
        let dx = b.px - a.px, dy = b.py - a.py
        const d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r + 4
        if (d < min) { dx /= d; dy /= d; const m = (min - d) / 2; a.px -= dx * m; a.py -= dy * m; b.px += dx * m; b.py += dy * m }
      }
      ns.forEach((n, i) => {
        n.px += (home[i][0] - n.px) * 0.02; n.py += (home[i][1] - n.py) * 0.02
        n.px = Math.min(W - pad.r + 30 - n.r, Math.max(pad.l - 30 + n.r, n.px))
        n.py = Math.min(H - pad.b + 20 - n.r, Math.max(pad.t - 10 + n.r, n.py))
      })
    }
    return ns
  }, [mapa, coords, W, H])
  const blobs = useMemo(() => mapa.grupos.map((g: Any) => {
    const ns = nodes.filter(n => n.d.grupo === g.id)
    const mx = ns.reduce((s, n) => s + n.px, 0) / ns.length, my = ns.reduce((s, n) => s + n.py, 0) / ns.length
    const sd = Math.sqrt(ns.reduce((s, n) => s + (n.px - mx) ** 2 + (n.py - my) ** 2, 0) / ns.length)
    return { ...g, mx, my, rad: Math.max(120, sd * 1.9) }
  }), [mapa, nodes])
  const grid = 44 * view.k
  return (
    <div className="smap" ref={ref} {...handlers} style={{ backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${view.x}px ${view.y}px` }}>
      <div className="smap-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        {blobs.map((b: Any) => <div key={b.id} className={`smap-blob${focus !== null && focus !== b.id ? ' dim' : ''}`} style={{ left: b.mx - b.rad, top: b.my - b.rad, width: b.rad * 2, height: b.rad * 2, '--hue': HUES[b.id % HUES.length] } as CSSProperties} />)}
        {groupLabels && blobs.map((b: Any) => <div key={`l${b.id}`} className="smap-glabel" style={{ left: b.mx, top: Math.max(W < 600 ? 270 : 165, b.my - b.rad * 0.72), color: HUES[b.id % HUES.length], opacity: focus !== null && focus !== b.id ? 0.25 : 1 }}>{b.nombre}</div>)}
        {nodes.filter(n => !hidden.has(n.d.id)).map(n => {
          const float = reduce ? {} : { '--dx': `${(hash(n.d.id) - 0.5) * 28}px`, '--dy': `${(hash(n.d.id + 7) - 0.5) * 28}px`, '--dur': `${4.5 + hash(n.d.id + 3) * 4}s`, '--delay': `${-hash(n.d.id + 11) * 8}s` }
          return <Bubble key={n.d.id} d={n.d} media={media} r={n.r} dim={(focus !== null && focus !== n.d.grupo) || (match !== null && !match.has(n.d.id))} cls={pulse === n.d.id ? 'pulse' : match?.has(n.d.id) ? 'hit' : undefined} onPick={onPick} setHover={setHover} dragged={dragged}
            showName={view.k >= 1.7 || pulse === n.d.id || (match !== null && match.size <= 6 && match.has(n.d.id))} nameSize={Math.max(5, 11 / view.k * 1.3)}
            style={{ left: n.px - n.r, top: n.py - n.r, width: n.r * 2, height: n.r * 2, ...float } as CSSProperties} />
        })}
      </div>
      <div className="smap-axis ax-left"><span className="ax-arrow" aria-hidden>←</span><span className="ax-vt">{axes.x.negativo}</span></div>
      <div className="smap-axis ax-right"><span className="ax-vt">{axes.x.positivo}</span><span className="ax-arrow" aria-hidden>→</span></div>
      <div className="smap-axis ax-top">↑ {axes.y.positivo}</div>
      <div className="smap-axis ax-bottom">↓ {axes.y.negativo}</div>
      <div className="smap-zoom" onPointerDown={e => e.stopPropagation()}>
        <button onClick={() => zoomAt(1.4, W / 2, H / 2)} aria-label="Acercar">+</button>
        <button onClick={() => zoomAt(1 / 1.4, W / 2, H / 2)} aria-label="Alejar">−</button>
        <button onClick={() => setView({ k: 1, x: 0, y: 0 })} aria-label="Restablecer vista">⤢</button>
      </div>
    </div>
  )
}

/* ================================================================ 3D */
const CUBE: [number, number, number][] = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]

function Map3D({ mapa, media, coords, axes, focus, setHover, onPick, hidden, match, pulse }: MapProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { W, H } = useSize(ref)
  const [rot, setRot] = useState({ yaw: -0.6, pitch: 0.35 })
  const [k, setK] = useState(1)
  const idleUntil = useRef(0)
  const [spin, setSpin] = useState(true)
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const { handlers, dragged } = useGestures(ref,
    f => { idleUntil.current = performance.now() + 4000; setK(v => Math.min(4, Math.max(0.5, v * f))) },
    (dx, dy) => { idleUntil.current = performance.now() + 4000; setRot(r => ({ yaw: r.yaw + dx * 0.008, pitch: Math.max(-1.35, Math.min(1.35, r.pitch + dy * 0.008)) })) })

  // giro automático lento mientras nadie toca el mapa
  useEffect(() => {
    if (reduce || !spin) return
    let raf = 0
    const tick = (t: number) => {
      if (t > idleUntil.current) setRot(r => ({ ...r, yaw: r.yaw + 0.0022 }))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduce, spin])

  // normaliza cada eje a [-1, 1]
  const unit = useMemo(() => {
    const m = [0, 1, 2].map(a => Math.max(...coords.map(c => Math.abs(c[a]))) || 1)
    return coords.map(c => [c[0] / m[0], c[1] / m[1], c[2] / m[2]] as [number, number, number])
  }, [coords])

  const S = Math.min(W, H - 160) * 0.3 * k
  const cx = W / 2, cy = H / 2 + 40
  const cy_ = Math.cos(rot.yaw), sy_ = Math.sin(rot.yaw), cp = Math.cos(rot.pitch), sp = Math.sin(rot.pitch)
  const proj = (p: [number, number, number]) => {
    const x1 = p[0] * cy_ - p[2] * sy_, z1 = p[0] * sy_ + p[2] * cy_
    const y2 = p[1] * cp - z1 * sp, z2 = p[1] * sp + z1 * cp
    const f = 3.6 / (3.6 - z2)
    return { x: cx + x1 * S * f, y: cy - y2 * S * f, z: z2, f }
  }
  const P: Any[] = mapa.puntos
  const maxP = Math.max(...P.map(p => p.partidos))
  const base = Math.max(12, Math.min(W, H) / 46) * Math.sqrt(k)
  const nodes = P.map((d, i) => ({ d, ...proj(unit[i]), r0: base * (0.75 + 0.9 * Math.sqrt(d.partidos / maxP)) })).sort((a, b) => a.z - b.z)
  const blobs = mapa.grupos.map((g: Any) => {
    const idx = P.map((p, i) => (p.grupo === g.id ? i : -1)).filter(i => i >= 0)
    const c = [0, 1, 2].map(a => idx.reduce((s, i) => s + unit[i][a], 0) / idx.length) as [number, number, number]
    const sd = Math.sqrt(idx.reduce((s, i) => s + (unit[i][0] - c[0]) ** 2 + (unit[i][1] - c[1]) ** 2 + (unit[i][2] - c[2]) ** 2, 0) / idx.length)
    const p = proj(c)
    return { ...g, ...p, rad: Math.max(60, sd * S * p.f * 1.3) }
  })
  const cube = CUBE.map(proj)
  const floor: [number, number, number][][] = []
  for (let t = -1; t <= 1.001; t += 0.5) { floor.push([[t, -1, -1], [t, -1, 1]]); floor.push([[-1, -1, t], [1, -1, t]]) }
  const axisEnd = (v: [number, number, number]) => proj(v)
  const ends = [
    { p: axisEnd([1.22, 0, 0]), t: axes.x.positivo, a: 'X+' }, { p: axisEnd([-1.22, 0, 0]), t: axes.x.negativo, a: 'X−' },
    { p: axisEnd([0, 1.2, 0]), t: axes.y.positivo, a: 'Y+' }, { p: axisEnd([0, -1.2, 0]), t: axes.y.negativo, a: 'Y−' },
    { p: axisEnd([0, 0, 1.22]), t: axes.z.positivo, a: 'Z+' }, { p: axisEnd([0, 0, -1.22]), t: axes.z.negativo, a: 'Z−' },
  ]
  const o = proj([0, 0, 0])
  return (
    <div className="smap smap3" ref={ref} {...handlers}>
      <svg className="smap3-svg" width={W} height={H} aria-hidden>
        {floor.map(([a, b], i) => { const A = proj(a), B = proj(b); return <line key={`f${i}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} className="g3-floor" /> })}
        {EDGES.map(([a, b], i) => <line key={i} x1={cube[a].x} y1={cube[a].y} x2={cube[b].x} y2={cube[b].y} className="g3-edge" />)}
        {[[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v, i) => { const A = proj([-v[0], -v[1], -v[2]] as [number, number, number]), B = proj(v as [number, number, number]); return <line key={`a${i}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} className="g3-axis" /> })}
        <circle cx={o.x} cy={o.y} r={3} className="g3-origin" />
      </svg>
      {blobs.map((b: Any) => (
        <div key={b.id} className={`smap-blob${focus !== null && focus !== b.id ? ' dim' : ''}`}
          style={{ left: b.x - b.rad, top: b.y - b.rad, width: b.rad * 2, height: b.rad * 2, zIndex: 1, '--hue': HUES[b.id % HUES.length] } as CSSProperties} />
      ))}
      {nodes.filter(n => !hidden.has(n.d.id)).map(n => {
        const r = n.r0 * n.f
        return <Bubble key={n.d.id} d={n.d} media={media} r={r} cls={`bub3${pulse === n.d.id ? ' pulse' : match?.has(n.d.id) ? ' hit' : ''}`} dim={(focus !== null && focus !== n.d.grupo) || (match !== null && !match.has(n.d.id))} onPick={onPick} setHover={setHover} dragged={dragged}
          showName={k >= 1.6 || pulse === n.d.id || (match !== null && match.size <= 6 && match.has(n.d.id))} nameSize={11}
          style={{ left: n.x - r, top: n.y - r, width: r * 2, height: r * 2, zIndex: 10 + Math.round((n.z + 2) * 100), opacity: 0.55 + 0.45 * Math.min(1, Math.max(0, (n.z + 1.2) / 2.4)) }} />
      })}
      {ends.map(e => (
        <div key={e.a} className="g3-label" style={{ left: e.p.x, top: e.p.y }}><b>{e.a}</b> {e.t}</div>
      ))}
      <div className="smap-zoom" onPointerDown={ev => ev.stopPropagation()}>
        <button onClick={() => setK(v => Math.min(4, v * 1.3))} aria-label="Acercar">+</button>
        <button onClick={() => setK(v => Math.max(0.5, v / 1.3))} aria-label="Alejar">−</button>
        <button onClick={() => { setK(1); setRot({ yaw: -0.6, pitch: 0.35 }) }} aria-label="Restablecer vista">⤢</button>
        {!reduce && <button onClick={() => setSpin(s => !s)} aria-label={spin ? 'Pausar giro' : 'Reanudar giro'} title={spin ? 'Pausar giro' : 'Reanudar giro'}>{spin ? '❚❚' : '▶'}</button>}
      </div>
      <div className="g3-hint note">Arrastra para girar · pellizca o usa la rueda para acercar</div>
    </div>
  )
}
