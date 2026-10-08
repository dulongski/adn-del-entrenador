import { useEffect, useState, type ReactNode } from 'react'
import { asset, dataUrl, fmt, getJSON, shortName, type Any } from './lib'
import { MODES, modeTitle, type Mode, type TabKey } from './modes'
import { similares } from './Compare'
import './hub.css'
import { L } from './settings'
import { archLabel, td } from './i18n/data'

/* Selector de modos: una tarjeta por pregunta. El fondo de cada tarjeta se dibuja con los datos
   de ESTE DT (su foto, su red de pases, su formación, sus tiros…), así que cambia de un DT a otro. */

const fmtForm = (f?: string) => (f ? f.split('').join('-') : '')
const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

/* ---------------------------------------------------------------- fondos */
function PitchLines({ half = false }: { half?: boolean }) {
  // cancha vertical 80 × 120 (o media cancha 80 × 60, atacando hacia arriba)
  return (
    <g fill="none" stroke="currentColor" strokeWidth={0.6} opacity={0.5}>
      <rect x={1} y={1} width={78} height={half ? 70 : 118} />
      {!half && <><line x1={1} y1={60} x2={79} y2={60} /><circle cx={40} cy={60} r={10} /></>}
      <rect x={18} y={1} width={44} height={18} /><rect x={30} y={1} width={20} height={6} />
      {!half && <><rect x={18} y={101} width={44} height={18} /><rect x={30} y={113} width={20} height={6} /></>}
    </g>
  )
}

function ArtPhoto({ art, media }: { art: Any; media: Any }) {
  const src = asset(media.dts[art.id]?.foto)
  return src ? <img className="hub-photo" src={src} alt="" /> : null
}

function ArtPrism({ art }: { art: Any }) {
  const comp: [string, string][] = [['coach', 'var(--c-dt)'], ['player', 'var(--c-plantilla)'], ['club', 'var(--c-club)'], ['opp', 'var(--c-rival)'], ['ctx', 'var(--c-ctx)']]
  const rows = [...(art.atribucion ?? [])].sort((a: Any, b: Any) => Math.abs(b.observado) - Math.abs(a.observado)).slice(0, 14)
  return (
    <svg viewBox="0 0 200 280" preserveAspectRatio="xMaxYMid slice">
      {rows.map((r: Any, i: number) => {
        let x = 200
        const tot = comp.reduce((s, [k]) => s + Math.abs(r[k] ?? 0), 0) || 1
        return comp.map(([k, c]) => {
          const w = (Math.abs(r[k] ?? 0) / tot) * 150
          x -= w
          return <rect key={k + i} x={x} y={8 + i * 19} width={Math.max(0, w - 1.5)} height={13} fill={c} rx={2} />
        })
      })}
    </svg>
  )
}

function ArtNet({ art }: { art: Any }) {
  const net = art.mapas?.red_pases
  if (!net) return null
  const P = (x: number, y: number) => [y, 120 - x]
  const byId = new Map(net.nodos.map((n: Any) => [n.id, n]))
  const maxN = Math.max(...net.aristas.map((e: Any) => e.n))
  return (
    <svg viewBox="-4 -4 88 128" preserveAspectRatio="xMidYMid slice">
      <PitchLines />
      {net.aristas.map((e: Any, i: number) => {
        const a: Any = byId.get(e.a), b: Any = byId.get(e.b)
        if (!a || !b) return null
        const [x1, y1] = P(a.x, a.y), [x2, y2] = P(b.x, b.y)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={0.6 + 2.4 * e.n / maxN} opacity={0.75} strokeLinecap="round" />
      })}
      {net.nodos.map((n: Any) => { const [x, y] = P(n.x, n.y); return <circle key={n.id} cx={x} cy={y} r={3.6} fill="currentColor" /> })}
    </svg>
  )
}

function ArtFormation({ art }: { art: Any }) {
  const f = Object.entries(art.jugadores?.formaciones ?? {}).sort((a: Any, b: Any) => b[1] - a[1])[0]?.[0] ?? '442'
  const lines = f.split('').map(Number)
  const dots: [number, number][] = [[40, 112]]
  lines.forEach((n, li) => {
    const y = 92 - li * (76 / Math.max(1, lines.length - 1 || 1)) * (lines.length > 1 ? 1 : 0)
    for (let i = 0; i < n; i++) dots.push([n === 1 ? 40 : 10 + (60 * i) / (n - 1), y])
  })
  return (
    <svg viewBox="-4 -4 88 128" preserveAspectRatio="xMidYMid slice">
      <PitchLines />
      {dots.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r={5.4} fill="currentColor" /><circle cx={x} cy={y} r={8.5} fill="none" stroke="currentColor" strokeWidth={0.6} opacity={0.6} /></g>)}
    </svg>
  )
}

function ArtCorners({ art }: { art: Any }) {
  const z = art.balon_parado?.ofensivo?.corner_zonas ?? { 'Primer palo': 25, 'Punto penal': 30, 'Segundo palo': 30, 'Área chica': 10, Corto: 5 }
  const target: Record<string, [number, number]> = { 'Primer palo': [32, 8], 'Área chica': [40, 5], 'Punto penal': [40, 13], 'Segundo palo': [50, 9], Corto: [70, 14] }
  const r = rnd(art.id % 2147483646 || 7)
  const arcs: ReactNode[] = []
  Object.entries(z).forEach(([k, pct]) => {
    const t = target[k]
    if (!t) return
    const n = Math.max(1, Math.round((pct as number) / 4))
    for (let i = 0; i < n; i++) {
      const tx = t[0] + (r() - 0.5) * 9, ty = t[1] + (r() - 0.5) * 6
      arcs.push(<path key={k + i} d={`M79 1 Q ${(79 + tx) / 2} ${-14 - r() * 10} ${tx} ${ty}`} fill="none" stroke="currentColor" strokeWidth={0.7} opacity={0.35 + 0.5 * r()} />)
      arcs.push(<circle key={k + i + 'c'} cx={tx} cy={ty} r={1.3} fill="currentColor" />)
    }
  })
  return (
    <svg viewBox="-4 -24 88 74" preserveAspectRatio="xMidYMin slice">
      <PitchLines half />
      {arcs}
    </svg>
  )
}

function ArtShots({ art }: { art: Any }) {
  const t: number[][] = (art.mapas?.tiros ?? []).slice(0, 420)
  return (
    <svg viewBox="-4 -4 88 70" preserveAspectRatio="xMidYMin slice">
      <PitchLines half />
      {t.map((s, i) => <circle key={i} cx={s[1]} cy={120 - s[0]} r={0.8 + 4 * Math.sqrt(s[2])} fill={s[3] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={0.4} opacity={s[3] ? 0.95 : 0.55} />)}
    </svg>
  )
}

function ArtVs({ art, media, mapa }: { art: Any; media: Any; mapa: Any }) {
  const twin = similares(art.id, mapa)[0]
  const a = asset(media.dts[art.id]?.foto), b = twin ? asset(media.dts[twin.id]?.foto) : null
  return (
    <div className="hub-vsart">
      {a && <img src={a} alt="" className="hub-vs-a" />}
      {b && <img src={b} alt="" className="hub-vs-b" />}
      <svg className="hub-vs-seam" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1={56} y1={-2} x2={44} y2={102} vectorEffect="non-scaling-stroke" /></svg>
    </div>
  )
}

function ArtFormula() {
  return <div className="hub-formula" aria-hidden>z = α<sub>{L('DT', 'coach')}</sub> + φ<sub>club</sub> + Σβ<sub>{L('jugador', 'player')}</sub> + γ<sub>{L('rival', 'opp')}</sub> + δ<sub>{L('contexto', 'context')}</sub></div>
}

/* ---------------------------------------------------------------- ganchos con datos del DT */
function hook(m: Mode, art: Any, mapa: Any, jug: Any): string {
  switch (m.k) {
    case 'resumen': return (art.narrativa?.principios ?? []).map((p: Any) => td(p.titulo ?? p)).slice(0, 3).join(' · ') || L('Sin rasgos por encima del umbral', 'No traits above the threshold')
    case 'separar': {
      const tr = art.transferencia ?? []
      const best = tr.length ? tr.reduce((a: Any, b: Any) => (a.rank_ajustado <= b.rank_ajustado ? a : b)) : null
      return best ? L(`Reconocible en ${best.club}: ${best.rank_ajustado}º de ${best.n_clases} DTs`, `Recognizable at ${best.club}: #${best.rank_ajustado} of ${best.n_clases} coaches`) : L(`Identificabilidad ${fmt(art.identificabilidad?.indice, 0)}/100`, `Identifiability ${fmt(art.identificabilidad?.indice, 0)}/100`)
    }
    case 'juego': {
      const a = [...(art.arquetipos ?? [])].sort((x: Any, y: Any) => y.alpha - x.alpha)[0]
      return a ? L(`Su jugada más propia: ${a.nombre.replace(/ \(\d\)$/, '')}`, `His signature move: ${archLabel(a.nombre.replace(/ \(\d\)$/, ''))}`) : ''
    }
    case 'jugadores': {
      // club actual primero (como en la pestaña Jugadores); si no hay datos por club, toda su carrera
      const club = jug?.clubes?.[0], b = club ? jug?.por_club?.[club] : null
      if (b?.dibujo) return L(`${fmtForm(b.dibujo)} en ${b.partidos_dibujo} de ${b.partidos} partidos con ${club}`, `${fmtForm(b.dibujo)} in ${b.partidos_dibujo} of ${b.partidos} matches with ${club}`)
      const f = Object.entries(art.jugadores?.formaciones ?? {}).sort((a: Any, b: Any) => b[1] - a[1])[0]
      const tot = Object.values(art.jugadores?.formaciones ?? {}).reduce((s: number, v: Any) => s + v, 0) as number
      return f ? L(`${fmtForm(f[0])} en ${f[1]} de ${tot} partidos`, `${fmtForm(f[0])} in ${f[1]} of ${tot} matches`) : ''
    }
    case 'bp': {
      const o = art.balon_parado?.ofensivo
      return o ? L(`${fmt(o.corners_por_partido, 1)} córners por partido · ${fmt(o.corner_primer_contacto_pct, 0)}% primer contacto`, `${fmt(o.corners_por_partido, 1)} corners per match · ${fmt(o.corner_primer_contacto_pct, 0)}% first contact`) : ''
    }
    case 'lab': { const s = art.simulacion; return s ? L(`${s.puntos} puntos reales vs ${fmt(s.xpts, 0)} esperados`, `${s.puntos} actual points vs ${fmt(s.xpts, 0)} expected`) : '' }
    case 'vs': {
      const s = similares(art.id, mapa)[0]
      const p = s && mapa.puntos.find((q: Any) => q.id === s.id)
      return p ? L(`Su gemelo de estilo: ${shortName(p.nombre)}`, `His style twin: ${shortName(p.nombre)}`) : ''
    }
    default: return 'z = α + φ + Σβ + γ + δ'
  }
}

export default function Hub({ art, media, mapa, go }: { art: Any; media: Any; mapa: Any; go: (t: TabKey) => void }) {
  const [jug, setJug] = useState<Any>(null)
  useEffect(() => { setJug(null); getJSON(dataUrl(`jugadores_${art.id}.json`)).then(setJug).catch(() => {}) }, [art.id])
  const ART: Record<string, ReactNode> = {
    resumen: <ArtPhoto art={art} media={media} />, separar: <ArtPrism art={art} />, juego: <ArtNet art={art} />,
    jugadores: <ArtFormation art={art} />, bp: <ArtCorners art={art} />, lab: <ArtShots art={art} />,
    vs: <ArtVs art={art} media={media} mapa={mapa} />, metodo: <ArtFormula />,
  }
  return (
    <nav className="hub" aria-label={L('Qué quieres ver de este DT', 'What you want to see about this coach')}>
      {MODES.map((m, i) => (
        <button key={m.k} className={`hub-card hub-${m.k}`} style={{ ['--mc' as string]: m.color, ['--i' as string]: i }} onClick={() => go(m.subs[0][0])}>
          <span className="hub-art" aria-hidden>{ART[m.k]}</span>
          <span className="hub-shade" aria-hidden />
          <span className="hub-body">
            <span className="hub-q">{m.q}</span>
            <span className="hub-title">{modeTitle(m, art)}</span>
            <span className="hub-desc">{m.desc}</span>
            <span className="hub-hook">{hook(m, art, mapa, jug)}</span>
            {m.subs.length > 1 && <span className="hub-subs">{m.subs.map(([, l]) => l).join(' · ')}</span>}
          </span>
          <span className="hub-go" aria-hidden>→</span>
        </button>
      ))}
    </nav>
  )
}
