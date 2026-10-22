import { useState, type ReactNode } from 'react'
import { asset, COMP, divColor, fmt, initials, posTag, real, sig, type Any } from './lib'
import { L } from './settings'
import { posLabel } from './i18n/data'

/* ------------------------------------------------------------ tooltip */
export function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; html: ReactNode } | null>(null)
  const show = (e: React.MouseEvent, html: ReactNode) => setTip({ x: e.clientX + 14, y: e.clientY + 14, html })
  const hide = () => setTip(null)
  const el = tip ? <div className="tip" style={{ left: Math.min(tip.x, window.innerWidth - 310), top: tip.y }}>{tip.html}</div> : null
  return { show, hide, el }
}

/* ------------------------------------------------------------ cancha */
/** Cancha StatsBomb (120×80, el equipo ataca hacia x=120). `vertical`: el ataque va hacia ARRIBA;
 *  los hijos se dibujan en coordenadas normales dentro de un grupo rotado, y `labels` (textos) se
 *  dibujan sin rotar usando `pitchXY(x, y, vertical)` para ubicarlos. */
export const pitchXY = (x: number, y: number, vertical?: boolean): [number, number] => (vertical ? [y, 120 - x] : [x, y])
export function Pitch({ children, labels, half = false, vertical = false, w = '100%', crop }: { children?: ReactNode; labels?: ReactNode; half?: boolean; vertical?: boolean; w?: string; crop?: [number, number] }) {
  // crop: tramo de la cancha a mostrar [x0, x1] (sólo vertical): acerca la vista a donde pasa la acción
  const vb = vertical ? (crop ? `-5 ${118 - crop[1]} 90 ${crop[1] - crop[0] + 4}` : half ? '-2 -2 84 64' : '-2 -2 84 124') : (half ? '60 -2 62 84' : '-2 -2 124 84')
  return (
    <svg viewBox={vb} style={{ width: w, display: 'block', maxWidth: '100%' }} role="img">
      <g transform={vertical ? 'matrix(0 -1 1 0 0 120)' : undefined}>
        <rect x={0} y={0} width={120} height={80} fill="var(--pitch)" rx={1} />
        <g fill="none" stroke="var(--pitch-line)" strokeWidth={0.5}>
          <rect x={0} y={0} width={120} height={80} />
          <line x1={60} y1={0} x2={60} y2={80} />
          <circle cx={60} cy={40} r={10} />
          <rect x={0} y={18} width={18} height={44} /><rect x={102} y={18} width={18} height={44} />
          <rect x={0} y={30} width={6} height={20} /><rect x={114} y={30} width={6} height={20} />
          <path d="M18 32.7 A10 10 0 0 1 18 47.3" /><path d="M102 32.7 A10 10 0 0 0 102 47.3" />
        </g>
        {children}
      </g>
      {labels}
    </svg>
  )
}

/** Rejilla 12x8 sobre la cancha. mode 'div' = diferencia vs liga; 'seq' = magnitud (en el color del club). */
export function HeatGrid({ grid, mode = 'seq', label, unit = L('por partido', 'per match'), color = 'var(--c-dt)', vertical = false }: { grid: number[][]; mode?: 'seq' | 'div'; label: string; unit?: string; color?: string; vertical?: boolean }) {
  const tip = useTip()
  const nx = grid.length, ny = grid[0]?.length || 8
  const flat = grid.flat()
  const max = mode === 'div' ? Math.max(...flat.map(Math.abs)) : Math.max(...flat)
  const seq = (v: number) => `color-mix(in oklab, ${color} ${Math.round(8 + Math.max(0, Math.min(1, v / (max || 1))) * 92)}%, var(--surface))`
  const [lx, ly] = pitchXY(118, 1, vertical)
  return (
    <div>
      <Pitch vertical={vertical} labels={vertical ? undefined : <text x={vertical ? 40 : lx} y={vertical ? -0.5 : ly - 1.4} fontSize={3} textAnchor={vertical ? 'middle' : 'end'} fill="var(--ink-3)">{vertical ? L('ataque ↑', 'attack ↑') : L('ataque →', 'attack →')}</text>}>
        {grid.map((col, i) => col.map((v, j) => (
          <rect key={`${i}-${j}`} x={i * 120 / nx + 0.25} y={j * 80 / ny + 0.25} width={120 / nx - 0.5} height={80 / ny - 0.5}
            fill={mode === 'div' ? divColor(v, max) : seq(v)} opacity={0.92} rx={0.4}
            onMouseMove={e => tip.show(e, <>{label}<br /><b>{mode === 'div' && v > 0 ? '+' : ''}{fmt(v, 2)}</b> {unit}</>)} onMouseLeave={tip.hide} />
        )))}
        {/* líneas encima de las celdas: halo claro + trazo de tinta, visibles en ambos temas */}
        {[{ s: 'var(--surface)', w: 0.85, o: 0.55 }, { s: 'var(--ink)', w: 0.32, o: 0.7 }].map((l, i) => (
          <g key={i} fill="none" stroke={l.s} strokeWidth={l.w} strokeOpacity={l.o} pointerEvents="none">
            <rect x={0} y={0} width={120} height={80} />
            <line x1={60} y1={0} x2={60} y2={80} /><circle cx={60} cy={40} r={10} />
            <rect x={0} y={18} width={18} height={44} /><rect x={102} y={18} width={18} height={44} />
            <rect x={0} y={30} width={6} height={20} /><rect x={114} y={30} width={6} height={20} />
            <path d="M18 32.7 A10 10 0 0 1 18 47.3" /><path d="M102 32.7 A10 10 0 0 0 102 47.3" />
          </g>
        ))}
      </Pitch>
      {mode === 'div' && (
        <div className="legend" style={{ marginTop: 6 }}>
          <span><i style={{ background: 'var(--div-neg)' }} />{L('menos que la liga', 'less than the league')}</span>
          <span><i style={{ background: 'var(--div-mid)', border: '1px solid var(--rule)' }} />{L('igual', 'same')}</span>
          <span><i style={{ background: 'var(--div-pos)' }} />{L('más que la liga', 'more than the league')}</span>
        </div>
      )}
      {mode === 'seq' && (
        <div className="legend" style={{ marginTop: 6 }}>
          <span>{L('pocas', 'few')}</span>
          <span style={{ display: 'inline-block', width: 90, height: 10, borderRadius: 3, border: '1px solid var(--rule)', background: `linear-gradient(90deg, ${seq(0)}, ${seq(max)})` }} />
          <span>{L('muchas', 'many')} ({fmt(max, 1)} {unit})</span>
        </div>
      )}
      {tip.el}
    </div>
  )
}

/* ------------------------------------------------------------ prisma (firma) */
export function Legend({ items = COMP as readonly { key: string; label: string; color: string }[], extra }: { items?: readonly { key: string; label: string; color: string }[]; extra?: ReactNode }) {
  return <div className="legend">{items.map(c => <span key={c.key}><i style={{ background: c.color }} />{c.label}</span>)}{extra}</div>
}

/** Desglose legible del prisma: una fila por fuente, barras divergentes desde el promedio de la liga.
 *  Primera fila = lo que se ve en sus partidos; las demás reparten ese valor entre quien lo empuja. */
const PD_LABEL: Record<string, string> = {
  obs: L('Lo que se ve', 'What we see'), coach: L('Él (DT)', 'Him (coach)'), player: L('Sus jugadores', 'His players'),
  club: L('El club', 'The club'), opp: L('Los rivales', 'The opponents'), ctx: L('El contexto', 'The context'),
}
export function PrismDetail({ row }: { row: Any }) {
  const rows = [{ key: 'obs', color: 'var(--ink)', v: row.observado as number },
    ...COMP.map(c => ({ key: c.key, color: c.color, v: (row[c.key] ?? 0) as number }))]
  const scale = Math.max(1, ...rows.map(r => Math.abs(r.v))) * 1.05
  const pctX = (v: number) => 50 + (v / scale) * 50
  return (
    <div className="pd" title={L('Cuánto aporta cada parte, en la unidad de la estadística. 0 = promedio de la liga.', 'How much each part adds, in the stat\'s own unit. 0 = league average.')}>
      <div className="pd-axis"><span>{L('← lo baja', '← pushes it down')}</span><span>{L('liga', 'league')}</span><span>{L('lo sube →', 'pushes it up →')}</span></div>
      {rows.map((r, i) => (
        <div key={r.key} className={`pd-row${i === 0 ? ' pd-obs' : ''}`}>
          <span className="pd-lbl">{i === 0 ? PD_LABEL.obs : <><i style={{ background: r.color }} />{PD_LABEL[r.key] ?? r.key}</>}</span>
          <span className="pd-track">
            <span className="pd-mid" />
            <span className="pd-bar" style={{ background: r.color, left: `${Math.min(50, pctX(r.v))}%`, width: `${Math.abs(pctX(r.v) - 50)}%` }} />
          </span>
          <span className="pd-val">{real(row.kpi, r.v)}</span>
        </div>
      ))}
    </div>
  )
}

/** Frase en lenguaje llano que explica el prisma (sin cifras técnicas). */
const PS_WHO: Record<string, string> = { player: 'sus jugadores', club: 'el club', opp: 'los rivales', ctx: 'el contexto de los partidos' }
const PS_WHO_EN: Record<string, string> = { player: 'his players', club: 'the club', opp: 'the opponents', ctx: 'the match context' }
const PS_PLURAL_EN = new Set(['player', 'opp'])
export function prismSentence(row: Any, etiqueta: string): string {
  if (L('es', 'en') === 'en') return prismSentenceEn(row, etiqueta)
  const obs = row.observado as number, dt = row.coach as number
  const others = COMP.filter(c => c.key !== 'coach').map(c => ({ who: PS_WHO[c.key] ?? c.label.toLowerCase(), v: (row[c.key] ?? 0) as number }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
  const top = others[0]
  const lo = etiqueta.split(' (')[0].toLowerCase()
  const cuanto = (v: number) => (Math.abs(v) < 0.5 ? 'un poco ' : Math.abs(v) >= 1 ? 'muy ' : '')
  const where = Math.abs(obs) < 0.15 ? 'queda en el promedio de la liga' : `queda ${cuanto(obs)}${obs > 0 ? 'por encima' : 'por debajo'} de la liga`
  const base = `En sus partidos, «${lo}» ${where}.`
  const hacia = (v: number) => (v > 0 ? 'hacia arriba' : 'hacia abajo')
  if (Math.abs(dt) < 0.08 && Math.abs(top.v) < 0.15) return `${base} Ni él ni sus jugadores lo mueven mucho.`
  if (Math.sign(obs) !== Math.sign(dt) && Math.abs(obs) >= 0.15 && Math.abs(top.v) > Math.abs(dt)) {
    return `${base} Eso no sale de él: ${/^(sus|los) /.test(top.who) ? 'lo empujan' : 'lo empuja'} sobre todo ${top.who}. Por su cuenta, él tira hacia el lado contrario.`
  }
  if (Math.abs(dt) >= Math.abs(top.v)) return `${base} Quien más lo empuja ${hacia(dt)} es él, por delante ${top.who.startsWith('el ') ? 'del ' + top.who.slice(3) : 'de ' + top.who}.`
  if (Math.sign(dt) === Math.sign(top.v)) return `${base} Él lo empuja ${hacia(dt)}, y ${top.who} todavía más.`
  return `${base} Él lo empuja ${hacia(dt)}, pero ${top.who} ${/^(sus|los) /.test(top.who) ? 'pesan' : 'pesa'} más ${hacia(top.v)}.`
}
function prismSentenceEn(row: Any, etiqueta: string): string {
  const obs = row.observado as number, dt = row.coach as number
  const others = COMP.filter(c => c.key !== 'coach').map(c => ({ who: PS_WHO_EN[c.key] ?? c.label.toLowerCase(), pl: PS_PLURAL_EN.has(c.key), v: (row[c.key] ?? 0) as number }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
  const top = others[0]
  const raw = etiqueta.split(' (')[0]
  const lo = raw.length > 1 && raw[1] === raw[1].toUpperCase() && raw[1] !== raw[1].toLowerCase() ? raw : raw.charAt(0).toLowerCase() + raw.slice(1)
  const howMuch = (v: number) => (Math.abs(v) < 0.5 ? 'slightly ' : Math.abs(v) >= 1 ? 'well ' : '')
  const where = Math.abs(obs) < 0.15 ? 'sits right at the league average' : `sits ${howMuch(obs)}${obs > 0 ? 'above' : 'below'} the league average`
  const base = `In his matches, “${lo}” ${where}.`
  const dir = (v: number) => (v > 0 ? 'up' : 'down')
  if (Math.abs(dt) < 0.08 && Math.abs(top.v) < 0.15) return `${base} Neither he nor his players move it much.`
  if (Math.sign(obs) !== Math.sign(dt) && Math.abs(obs) >= 0.15 && Math.abs(top.v) > Math.abs(dt)) {
    return `${base} That isn't his doing: it's driven mainly by ${top.who}. Left to himself, he pulls the other way.`
  }
  if (Math.abs(dt) >= Math.abs(top.v)) return `${base} He's the one pushing it ${dir(dt)} the most, ahead of ${top.who}.`
  if (Math.sign(dt) === Math.sign(top.v)) return `${base} He pushes it ${dir(dt)}, and ${top.who} ${top.pl ? 'push' : 'pushes'} it even further.`
  return `${base} He pushes it ${dir(dt)}, but ${top.who} ${top.pl ? 'pull' : 'pulls'} it ${dir(top.v)} harder.`
}

/* ------------------------------------------------------------ huella con IC */
export function DotCI({ v, se, pctl, k, scale = 2.5, h = 20 }: { v: number; se?: number | null; pctl?: number | null; k?: string; scale?: number; h?: number }) {
  const W = 300, mid = W / 2, u = mid / scale
  const c = (x: number) => mid + Math.max(-scale, Math.min(scale, x)) * u
  const tip = useTip()
  const strong = se ? Math.abs(v) / se >= 2 : Math.abs(v) >= 0.5
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: '100%', height: h, display: 'block' }}
      onMouseMove={e => tip.show(e, <>{L('Efecto DT frente a la liga', 'Coach effect vs the league')} {real(k, v)}{se ? <> ± {real(k, 1.96 * se).slice(1)} ({L('IC 95%', '95% CI')})</> : null}{pctl != null ? <><br />{L(`percentil ${fmt(pctl, 0)} entre DTs`, `${fmt(pctl, 0)}th percentile among coaches`)}</> : null}</>)} onMouseLeave={tip.hide}>
      {[-2, -1, 1, 2].map(t => <line key={t} x1={c(t)} x2={c(t)} y1={4} y2={h - 4} stroke="var(--rule)" />)}
      <line x1={mid} x2={mid} y1={1} y2={h - 1} stroke="var(--ink-3)" />
      {se ? <line x1={c(v - 1.96 * se)} x2={c(v + 1.96 * se)} y1={h / 2} y2={h / 2} stroke="var(--c-dt)" strokeWidth={2} strokeLinecap="round" opacity={0.55} /> : null}
      <circle cx={c(v)} cy={h / 2} r={5} fill={strong ? 'var(--c-dt)' : 'var(--surface)'} stroke="var(--c-dt)" strokeWidth={2} />
      {tip.el}
    </svg>
  )
}

/* ------------------------------------------------------------ líneas pequeñas */
export function MiniLines({ rows, xKey, series, h = 140, yLabel }: {
  rows: Any[]; xKey: string; series: { key: string; label: string; color: string; dash?: string }[]; h?: number; yLabel?: string
}) {
  const tip = useTip()
  const W = 320, P = { l: 34, r: 10, t: 10, b: 26 }
  const vals = rows.flatMap(r => series.map(s => r[s.key])).filter((v: Any) => v !== null && v !== undefined) as number[]
  if (!vals.length) return <div className="note">{L('Sin datos suficientes.', 'Not enough data.')}</div>
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals)
  if (hi - lo < 0.5) { hi += 0.25; lo -= 0.25 }
  const x = (i: number) => P.l + (rows.length === 1 ? 0.5 : i / (rows.length - 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (h - P.t - P.b)
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: '100%', display: 'block' }}>
      <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="var(--ink-3)" strokeDasharray="2 3" />
      <text x={P.l - 4} y={y(hi) + 4} fontSize={10} textAnchor="end" fill="var(--ink-3)">{sig(hi).replace('σ', '')}</text>
      <text x={P.l - 4} y={y(lo)} fontSize={10} textAnchor="end" fill="var(--ink-3)">{sig(lo).replace('σ', '')}</text>
      {yLabel && <text x={4} y={P.t} fontSize={10} fill="var(--ink-3)">{yLabel}</text>}
      {rows.map((r, i) => <text key={i} x={x(i)} y={h - 8} fontSize={10} textAnchor={rows.length > 1 && i === 0 ? 'start' : rows.length > 1 && i === rows.length - 1 ? 'end' : 'middle'} fill="var(--ink-2)">{r[xKey]}</text>)}
      {series.map(s => {
        const pts = rows.map((r, i) => (r[s.key] === null || r[s.key] === undefined ? null : [x(i), y(r[s.key])])).filter(Boolean) as number[][]
        return (
          <g key={s.key}>
            <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} strokeLinejoin="round" />
            {rows.map((r, i) => r[s.key] === null || r[s.key] === undefined ? null :
              <circle key={i} cx={x(i)} cy={y(r[s.key])} r={4} fill={s.dash ? 'var(--surface)' : s.color} stroke={s.color} strokeWidth={2}
                onMouseMove={e => tip.show(e, <><b>{s.label}</b> · {r[xKey]}<br />{sig(r[s.key])}{r.n_dt !== undefined && !s.dash ? <><br />{r.n_dt} {L('segmentos', 'segments')}</> : null}</>)} onMouseLeave={tip.hide} />)}
          </g>
        )
      })}
      {tip.el}
    </svg>
  )
}

/* ------------------------------------------------------------ barras horizontales */
export function HBar({ items, max, color = 'var(--c-dt)', unit = '', compare }: {
  items: { label: string; v: number; ref?: number | null }[]; max?: number; color?: string; unit?: string; compare?: string
}) {
  const m = max ?? Math.max(...items.map(i => Math.max(i.v, i.ref ?? 0)), 1e-9)
  return (
    <div>
      {items.map(it => (
        <div key={it.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr 58px', gap: 10, alignItems: 'center', margin: '4px 0' }}>
          <span style={{ fontSize: 13 }}>{it.label}</span>
          <svg viewBox="0 0 200 14" preserveAspectRatio="none" style={{ width: '100%', height: 14 }}>
            <rect x={0} y={2} width={Math.max(0, it.v / m * 200)} height={10} rx={3} fill={color} />
            {it.ref != null && <line x1={it.ref / m * 200} x2={it.ref / m * 200} y1={0} y2={14} stroke="var(--ink)" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
          </svg>
          <span className="mono" style={{ fontSize: 12, textAlign: 'right' }}>{fmt(it.v)}{unit}</span>
        </div>
      ))}
      {compare && <div className="note">{L('Línea negra', 'Black line')}: {compare}</div>}
    </div>
  )
}

export function How({ children, title = L('¿Cómo se calcula?', 'How is it calculated?') }: { children: ReactNode; title?: string }) {
  return <details className="how"><summary>{title}</summary><div>{children}</div></details>
}

/* ------------------------------------------------------------ identidad visual */
export function PosTag({ pos }: { pos: string }) {
  const t = posTag(pos)
  return <span className={`pos pos-${t.group}`} title={posLabel(pos)}>{t.abbr}</span>
}

export function ClubLogo({ club, media, size = 18 }: { club: string; media: Any; size?: number }) {
  const [bad, setBad] = useState(false)
  const src = asset(media?.clubes?.[club]?.logo)
  if (!src || bad) return <span className="logo-fallback" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden>{club.slice(0, 2).toUpperCase()}</span>
  return <img className="club-logo" src={src} alt="" width={size} height={size} loading="lazy" onError={() => setBad(true)} />
}

export function ClubName({ club, media, size = 18 }: { club: string; media: Any; size?: number }) {
  return <span className="club-name"><ClubLogo club={club} media={media} size={size} />{club}</span>
}

export function CoachPhoto({ name, src, size = 112 }: { name: string; src?: string | null; size?: number }) {
  const [bad, setBad] = useState(false)
  return (
    <span className="coach-photo" style={{ width: size, height: size }}>
      {src && !bad ? <img src={asset(src)!} alt={L(`Foto de ${name}`, `Photo of ${name}`)} onError={() => setBad(true)} /> : <span className="coach-initials" style={{ fontSize: size * 0.36 }}>{initials(name)}</span>}
    </span>
  )
}
