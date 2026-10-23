import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { jugadorCorto, type Any } from './lib'
import { ClubLogo, Pitch } from './charts'
import './styles/juego.css'
import { L, LANG, LOCALE } from './settings'

/** Etiqueta mínima: apodo de una palabra o apellido (con partículas: «de la Rosa»). */
export function apellidoCorto(n: string) {
  const t = n.trim().split(/\s+/)
  if (t.length <= 1) return n
  let i = t.length - 1
  while (i > 1 && /^(de|del|la|las|los|da|do|dos|van|von|di)$/i.test(t[i - 1])) i--
  return t.slice(i).join(' ')
}

export const RES_ES: Record<string, string> = LANG === 'en' ? {
  Goal: 'Goal', Saved: 'Saved', 'Saved to Post': 'Saved onto the post', 'Saved Off Target': 'Saved', Post: 'Hit the post',
  'Off T': 'Off target', Wayward: 'Way off target', Blocked: 'Blocked',
} : {
  Goal: 'Gol', Saved: 'Atajado', 'Saved to Post': 'Atajado al poste', 'Saved Off Target': 'Atajado', Post: 'Al poste',
  'Off T': 'Desviado', Wayward: 'Muy desviado', Blocked: 'Bloqueado',
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const fecha = (d: string) => {
  const [y, m, dd] = d.split('-')
  if (LANG === 'en') return new Date(+y, +m - 1, +dd).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${+dd} ${MESES[+m - 1]} ${y}`
}

export function useReducedMotion() {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const [r, setR] = useState(!!q?.matches)
  useEffect(() => {
    if (!q) return
    const f = () => setR(q.matches)
    q.addEventListener('change', f)
    return () => q.removeEventListener('change', f)
  }, [q])
  return r
}

type Step = { t: string; x: number; y: number; ex: number; ey: number; a: number | null; r: number | null; ok: boolean; s: number; e: number }
type Move = { t0: number; t1: number; x: number; y: number }

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const easeOut = (k: number) => 1 - (1 - k) * (1 - k)
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)
const clamp01 = (k: number) => Math.max(0, Math.min(1, k))

/** Animación de una posesión: el balón recorre pase a pase / conducción a conducción y sólo aparecen los
 *  jugadores que intervienen. Cancha horizontal, ataque hacia la derecha. */
/** Búsqueda en YouTube del resumen de ese partido: «Local vs Visita 3-0 resumen goles 2026». (No se puede incrustar video en la app.) */
/** Clips exactos ya ubicados a mano (fecha|rival|minuto de la jugada → video y segundo donde arranca la jugada). */
const CLIPS: Record<string, [string, number]> = {
  '2026-10-18|León|32': ['6Tmkh5pDHvk', 205],
  '2026-10-18|León|57': ['6Tmkh5pDHvk', 318],
  '2026-10-18|León|83': ['6Tmkh5pDHvk', 492],
}
const clipOf = (p: Any[], min?: number | null) => (min == null ? null : CLIPS[`${p[0]}|${p[1]}|${min}`] ?? null)

function ytSearch(club: string, p: Any[]) {
  const [date, rival, home, gf, gc] = p as [string, string, number, number, number]
  const q = home ? `${club} vs ${rival} ${gf}-${gc}` : `${rival} vs ${club} ${gc}-${gf}`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${q} resumen goles Liga MX ${String(date).slice(0, 4)}`)}`
}

export function PlayAnim({ seq, meta, jugadores, partido, club, color, media }: {
  seq: Any[]; meta?: Any | null; jugadores?: [number, string][]; partido?: Any[] | null; club?: string; color: string; media: Any
}) {
  const reduced = useReducedMotion()
  const uid = useId().replace(/:/g, '')
  const wrap = useRef<HTMLDivElement>(null)

  const { steps, total, moves, names } = useMemo(() => {
    const steps: Step[] = []
    let T = 450
    seq.forEach(([t, x, y, ex, ey]: Any, i: number) => {
      const acc = meta?.acc?.[i]
      const prev = steps.at(-1)
      if (prev && Math.hypot(prev.ex - x, prev.ey - y) > 2) { // hueco en los datos: el balón llega sin pase registrado
        const g = Math.hypot(prev.ex - x, prev.ey - y)
        steps.push({ t: 'Gap', x: prev.ex, y: prev.ey, ex: x, ey: y, a: null, r: acc?.[0] ?? null, ok: true, s: T, e: T + 300 + g * 10 })
        T += 300 + g * 10 + 120
      }
      const toX = ex ?? (t === 'Shot' ? 120 : x), toY = ey ?? (t === 'Shot' ? 40 : y)
      const d = Math.hypot(toX - x, toY - y)
      const dur = t === 'Pass' ? 420 + d * 13 : t === 'Carry' ? (d < 1.5 ? 140 : 380 + d * 30) : 420 + d * 9
      steps.push({ t, x, y, ex: toX, ey: toY, a: acc?.[0] ?? null, r: acc?.[1] ?? null, ok: acc ? acc[2] === 1 : true, s: T, e: T + dur })
      T += dur + 160
    })
    const moves: Record<number, Move[]> = {}
    const add = (p: number | null, m: Move) => { if (p == null) return; (moves[p] ||= []).push(m) }
    steps.forEach(st => {
      add(st.a, { t0: st.s - 260, t1: st.s, x: st.x, y: st.y })
      if (st.t === 'Carry') add(st.a, { t0: st.s, t1: st.e, x: st.ex, y: st.ey })
      if ((st.t === 'Pass' || st.t === 'Gap') && st.r != null) add(st.r, { t0: st.s, t1: st.e, x: st.ex, y: st.ey })
    })
    const names: Record<number, string> = {}
    for (const p of Object.keys(moves).map(Number)) {
      const j = jugadores?.[p]
      names[p] = j ? apellidoCorto(jugadorCorto(j[0], j[1])) : ''
    }
    return { steps, total: T + 900, moves, names }
  }, [seq, meta, jugadores])

  const [time, setTime] = useState(reduced ? total : 0)
  const [playing, setPlaying] = useState(false)
  const seen = useRef(false)
  const [wPx, setWPx] = useState(800)
  useEffect(() => {
    const el = wrap.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(es => setWPx(es[0].contentRect.width || 800))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const raf = useRef<number>(0)

  // nueva jugada: reiniciar (o mostrar el dibujo completo con movimiento reducido)
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    if (reduced) { setTime(total); setPlaying(false); return }
    setTime(0)
    setPlaying(seen.current)
  }, [seq, total, reduced])

  // arrancar la primera vez que se ve en pantalla
  useEffect(() => {
    const el = wrap.current
    if (!el || reduced || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting) && !seen.current) { seen.current = true; setPlaying(true) }
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(64, now - last); last = now
      setTime(t => {
        const nt = t + dt
        if (nt >= total) { setPlaying(false); return total }
        return nt
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, total])

  const done = time >= total - 1
  const toggle = () => {
    if (done) { setTime(0); setPlaying(true) } else setPlaying(p => !p)
  }
  const replay = () => { setTime(0); setPlaying(true) }

  // estado en el instante `time`
  const cur = steps.findIndex(s => time < s.e + 160)
  const ci = cur === -1 ? steps.length - 1 : cur
  const ball = (() => {
    if (!steps.length) return null
    const st = steps[ci]
    if (time <= st.s) return [st.x, st.y]
    const k = clamp01((time - st.s) / (st.e - st.s))
    const kk = st.t === 'Carry' ? ease(k) : easeOut(k)
    return [lerp(st.x, st.ex, kk), lerp(st.y, st.ey, kk)]
  })()
  const posOf = (p: number): [number, number, number] | null => {
    const ms = moves[p]
    if (!ms?.length || time < ms[0].t0) return null
    let x = ms[0].x, y = ms[0].y
    for (const m of ms) {
      if (time >= m.t1) { x = m.x; y = m.y; continue }
      if (time > m.t0) { const k = ease((time - m.t0) / (m.t1 - m.t0)); x = lerp(x, m.x, k); y = lerp(y, m.y, k) }
      break
    }
    return [x, y, clamp01((time - ms[0].t0) / 220)]
  }
  const last = steps.at(-1)
  const finished = last ? time >= last.e : false
  const onBall = steps[ci]?.t === 'Pass' && time > steps[ci].s ? null : steps[ci]?.a
  const fin = meta?.fin as string | undefined
  const resName = meta?.res != null && meta.res >= 0 ? ['Goal', 'Saved', 'Saved to Post', 'Saved Off Target', 'Post', 'Off T', 'Wayward', 'Blocked'][meta.res] : null
  const endLabel = fin === 'gol' ? L('¡Gol!', 'Goal!') : fin === 'tiro' ? `${L('Tiro', 'Shot')} · ${(resName && RES_ES[resName]) || L('sin gol', 'no goal')}` : fin === 'perdida' ? L('Pérdida', 'Ball lost') : L('Fin de la jugada', 'End of the move')

  const nm = (p: number | null) => (p != null && names[p]) || L('un compañero', 'a teammate')
  const caption = (() => {
    if (!steps.length) return ''
    if (finished && done) { const n = steps.filter(x => x.t !== 'Gap').length; return `${n} ${n === 1 ? L('acción', 'action') : L('acciones', 'actions')} · ${endLabel}` }
    const st = steps[ci]
    if (time < st.s && ci === 0) return L(`Arranca ${nm(st.a)}`, `${nm(st.a)} starts it`)
    if (st.t === 'Pass') return st.ok ? L(`Pase de ${nm(st.a)}${st.r != null ? ` a ${nm(st.r)}` : ''}`, `${nm(st.a)} passes${st.r != null ? ` to ${nm(st.r)}` : ''}`) : L(`Pase de ${nm(st.a)}, no llega`, `${nm(st.a)}'s pass doesn't connect`)
    if (st.t === 'Carry') return L(`Conduce ${nm(st.a)}`, `${nm(st.a)} carries it`)
    if (st.t === 'Gap') return L(`El balón le llega a ${nm(st.r)}`, `The ball reaches ${nm(st.r)}`)
    return `${L(`Remata ${nm(st.a)}`, `${nm(st.a)} shoots`)}${time >= st.e ? ` · ${endLabel}` : ''}`
  })()

  const mk = `pa-ar-${uid}`
  const FS = Math.min(4.6, Math.max(2.8, 10.5 / (wPx / 124))) // ≥ ~10.5 px en pantalla
  const R = Math.min(3, Math.max(2, 6 / (wPx / 124)))
  const shown = Object.keys(moves).map(Number).map(p => [p, posOf(p)] as const).filter(([, q]) => q)
  // etiquetas sin solaparse: primera posición libre (abajo, arriba, derecha, izquierda) respecto a otras etiquetas y puntos
  type Box = { x0: number; y0: number; x1: number; y1: number }
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
  const dots: Box[] = shown.map(([, q]) => ({ x0: q![0] - R, y0: q![1] - R, x1: q![0] + R, y1: q![1] + R }))
  const placed: Box[] = []
  const labelPos: Record<number, [number, number, 'middle' | 'start' | 'end']> = {}
  for (const [p, q] of [...shown].sort((a, b) => (a[0] === onBall ? -1 : b[0] === onBall ? 1 : 0))) {
    const [x, y] = q!
    const w = (names[p]?.length || 1) * FS * 0.56, h = FS
    const cands: [number, number, 'middle' | 'start' | 'end'][] = [
      [x, y + R + FS * 0.95, 'middle'], [x, y - R - FS * 0.3, 'middle'], [x + R + 0.8, y + FS * 0.35, 'start'], [x - R - 0.8, y + FS * 0.35, 'end'],
    ]
    const box = ([cx, cy, an]: [number, number, string]): Box => {
      const x0 = an === 'middle' ? cx - w / 2 : an === 'start' ? cx : cx - w
      return { x0, y0: cy - h * 0.8, x1: x0 + w, y1: cy + h * 0.2 }
    }
    const pick = cands.find(c => { const b = box(c); return b.y0 > -2 && b.y1 < 82 && !placed.some(o => hit(o, b)) && !dots.some(o => hit(o, b)) }) ?? cands[0]
    placed.push(box(pick))
    labelPos[p] = pick
  }
  const dimTrail = (i: number) => (done ? 0.75 : Math.max(0.16, 0.95 - (ci - i) * 0.24))

  return (
    <div ref={wrap} className="pa">
      {partido && (
        <div className="pa-match">
          {club && <ClubLogo club={club} media={media} size={18} />}
          <span className="pa-vs">vs</span>
          <ClubLogo club={partido[1]} media={media} size={18} />
          <b>{partido[1]}</b>
          <span className="note">{partido[2] ? L('local', 'home') : L('visita', 'away')} · {fecha(partido[0])}{meta?.min != null ? ` · min ${meta.min + 1}'` : ''} · {L('terminó', 'final')} {partido[3]}-{partido[4]}</span>
          {club && (() => { const c = clipOf(partido, meta?.min); return (
          <a className={`pa-yt${c ? ' exact' : ''}`} href={c ? `https://www.youtube.com/watch?v=${c[0]}&t=${c[1]}s` : ytSearch(club, partido)} target="_blank" rel="noopener noreferrer"
            title={c ? L('Abre el resumen oficial justo donde empieza esta jugada', 'Opens the official highlights right where this play starts') : L('Abre en YouTube la búsqueda del resumen de este partido', 'Opens a YouTube search for this match\'s highlights')}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.8 15.1V8.9l5.4 3.1-5.4 3.1Z" /></svg>
            {meta?.res === 0 ? L('Ver el gol', 'Watch the goal') : L('Ver el partido', 'Watch the match')}{c ? '' : meta?.min != null ? ` · ${meta.min + 1}'` : ''}
          </a>) })()}
        </div>
      )}
      <Pitch labels={<>
        {shown.map(([p, q]) => {
          const [, , o] = q!
          const [lx, ly, an] = labelPos[p]
          return <text key={p} x={lx} y={ly} fontSize={FS} fontWeight={600} textAnchor={an} fill="var(--ink)" opacity={o}
            className="pa-label">{names[p]}</text>
        })}
        {steps.length > 0 && time >= 0 && <text x={steps[0].x} y={steps[0].y - R - 1.2} fontSize={FS * 0.85} textAnchor="middle" fill="var(--ink-2)" className="pa-label">{L('inicio', 'start')}</text>}
        {finished && last && (
          <text x={Math.max(10, Math.min(last.ex, 110))} y={Math.hypot(last.ex - steps[0].x, last.ey - steps[0].y) < 12 || last.ey < 9 ? Math.min(78, last.ey + R + FS * 2.3) : last.ey - R - FS * 0.6} fontSize={fin === 'gol' ? FS * 1.45 : FS * 1.1} fontWeight={800} textAnchor="middle"
            fill={fin === 'gol' ? color : 'var(--ink)'} className="pa-label pa-end">{endLabel}</text>
        )}
      </>}>
        <defs>
          <marker id={mk} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="3.6" markerHeight="3.6" orient="auto"><path d="M0 0 L6 3 L0 6z" fill={color} /></marker>
        </defs>
        {/* inicio */}
        {steps.length > 0 && <circle cx={steps[0].x} cy={steps[0].y} r={R + 0.6} fill="none" stroke="var(--ink-2)" strokeWidth={0.35} strokeDasharray="0.8 0.6" />}
        {/* estelas */}
        {steps.map((st, i) => {
          if (time <= st.s) return null
          const k = clamp01((time - st.s) / (st.e - st.s))
          const kk = st.t === 'Carry' ? ease(k) : easeOut(k)
          const x2 = lerp(st.x, st.ex, kk), y2 = lerp(st.y, st.ey, kk)
          return (
            <line key={i} x1={st.x} y1={st.y} x2={x2} y2={y2} stroke={st.t === 'Shot' ? 'var(--c-plantilla)' : st.t === 'Gap' ? 'var(--ink-3)' : color} strokeOpacity={i === ci && !done ? 1 : dimTrail(i)}
              strokeWidth={st.t === 'Carry' ? 0.55 : st.t === 'Gap' ? 0.4 : 0.85} strokeDasharray={st.t === 'Carry' ? '1.4 1' : st.t === 'Gap' ? '0.3 1' : undefined} strokeLinecap="round"
              markerEnd={k >= 1 && st.t === 'Pass' ? `url(#${mk})` : undefined} />
          )
        })}
        {/* fin: pérdida o tiro */}
        {finished && last && fin === 'perdida' && (
          <g stroke="var(--c-plantilla)" strokeWidth={0.7} strokeLinecap="round"><line x1={last.ex - 1.5} y1={last.ey - 1.5} x2={last.ex + 1.5} y2={last.ey + 1.5} /><line x1={last.ex - 1.5} y1={last.ey + 1.5} x2={last.ex + 1.5} y2={last.ey - 1.5} /></g>
        )}
        {finished && last && fin === 'gol' && <circle cx={last.ex} cy={last.ey} r={3.2} fill="none" stroke={color} strokeWidth={0.6} className={reduced ? undefined : 'pa-pulse'} />}
        {/* jugadores */}
        {shown.map(([p, q]) => {
          const [x, y, o] = q!
          const on = p === onBall && !done
          return <g key={p} opacity={o}>
            {on && <circle cx={x} cy={y} r={R + 0.9} fill="none" stroke={color} strokeWidth={0.4} strokeOpacity={0.7} />}
            <circle cx={x} cy={y} r={R} fill={color} stroke="var(--ink)" strokeOpacity={0.6} strokeWidth={0.4} />
          </g>
        })}
        {/* balón */}
        {ball && !(finished && done && fin === 'perdida') && <circle cx={ball[0]} cy={ball[1]} r={R * 0.47} fill="#fff" stroke="#111" strokeWidth={0.3} />}
      </Pitch>
      <div className="pa-bar">
        <button className="pa-btn" onClick={toggle} aria-label={playing ? L('Pausar', 'Pause') : done ? L('Ver de nuevo', 'Watch again') : L('Reproducir', 'Play')}>
          {playing ? <svg viewBox="0 0 10 10" width="12" height="12"><rect x="1.5" y="1" width="2.5" height="8" fill="currentColor" /><rect x="6" y="1" width="2.5" height="8" fill="currentColor" /></svg>
            : done ? <svg viewBox="0 0 10 10" width="13" height="13"><path d="M5 1.2a3.8 3.8 0 1 1-3.6 2.6" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M0.6 1.2 L1.6 4.4 L4.4 2.8z" fill="currentColor" /></svg>
              : <svg viewBox="0 0 10 10" width="12" height="12"><path d="M2 1 L9 5 L2 9z" fill="currentColor" /></svg>}
        </button>
        <div className="pa-track" role="slider" aria-label={L('Progreso de la jugada', 'Play progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(time / total * 100)} tabIndex={0}
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setTime(clamp01((e.clientX - r.left) / r.width) * total) }}
          onKeyDown={e => { if (e.key === 'ArrowRight') setTime(t => Math.min(total, t + 400)); if (e.key === 'ArrowLeft') setTime(t => Math.max(0, t - 400)) }}>
          {steps.map((st, i) => <i key={i} style={{ left: `${st.s / total * 100}%` }} />)}
          <span style={{ width: `${time / total * 100}%`, background: color }} />
        </div>
        {!done && time > 0 && <button className="pa-btn ghost" onClick={replay} aria-label={L('Reiniciar', 'Restart')}>↺</button>}
        <span className="pa-cap" aria-live="polite">{caption}</span>
      </div>
    </div>
  )
}
