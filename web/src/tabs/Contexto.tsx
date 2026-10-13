import { useMemo, useState } from 'react'
import { sig, type Any } from '../lib'
import { useTip } from '../charts'
import { KEY, Seg, type P } from './common'
import { L } from '../settings'
import Info from '../Info'
import { kpiLabel, td } from '../i18n/data'
import '../styles/juego.css'

const DIMS: [string, string, string][] = [['marcador', 'Marcador', 'Scoreline'], ['minuto', 'Minuto', 'Minute'], ['localia', 'Localía', 'Home / away'], ['rival', 'Fuerza del rival', 'Opponent strength']]
const MIN_N = 40

/** fondo divergente: azul/verde (arriba) o rojo (abajo) según el signo, con intensidad ∝ |v| / escala */
const cellBg = (v: number | null, scale: number) => {
  if (v == null) return 'transparent'
  const k = Math.min(1, Math.abs(v) / scale)
  return `color-mix(in oklab, var(${v >= 0 ? '--div-pos' : '--div-neg'}) ${Math.round(8 + k * 52)}%, var(--surface))`
}

export function Contexto({ art, glob }: P) {
  const C = art.contexto
  const [dim, setDim] = useState('marcador')
  const [mode, setMode] = useState<'dif' | 'val'>('dif')
  const [k, setK] = useState('posesion')
  const tip = useTip()
  const ks = KEY.filter(x => C.curvas[dim]?.[x])
  const label = (x: string) => kpiLabel(x, glob.kpis[x].etiqueta)
  // lo que más se separa de la liga en cualquier situación (con muestra suficiente)
  const top = useMemo(() => {
    const out: { dim: string; kpi: string; nivel: string; dt: number; liga: number; d: number; n: number }[] = []
    for (const [d] of DIMS) for (const x of KEY) for (const r of C.curvas[d]?.[x] ?? []) if (r.dt != null && r.liga != null && r.n_dt >= MIN_N) out.push({ dim: d, kpi: x, nivel: td(r.nivel), dt: r.dt, liga: r.liga, d: r.dt - r.liga, n: r.n_dt })
    out.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    const seen = new Set<string>(), res: typeof out = []
    for (const o of out) { const key = `${o.kpi}`; if (seen.has(key)) continue; seen.add(key); res.push(o); if (res.length === 4) break }
    return res
  }, [C])
  const cols: any[] = C.curvas[dim][ks[0]] ?? []
  const maxD = Math.max(1, ...ks.flatMap(x => (C.curvas[dim][x] as Any[]).map(r => Math.abs(r.dt - r.liga))))
  return (
    <div className="ctx">
      <h3 className="h2">{L('Cómo se adapta', 'How he adapts')} <Info wide>{L('Cómo cambia su juego cuando va perdiendo, empatando o ganando, según el minuto, si juega en casa o la fuerza del rival. Ya quitamos lo que ponen sus jugadores. 0σ es la media de la liga en general; el número pequeño es lo que hace la liga en esa misma situación: si el suyo se separa de ese, la reacción es suya.', 'How his game changes when he is losing, drawing or winning, by minute, home or away, and by the strength of the opponent. What his players bring is already taken out. 0σ is the league average overall; the small number is what the league does in that same situation: where his pulls away from it, the reaction is his.')}</Info></h3>

      <div className="ctx-hero">
        {top.map((o, i) => (
          <button key={o.kpi} className="ctx-hero-c" style={{ ['--i' as string]: i }} onClick={() => { setDim(o.dim); setMode('dif') }}>
            <span className="ctx-hero-k">{label(o.kpi)}</span>
            <b className={`ctx-hero-n ${o.d >= 0 ? 'up' : 'dn'}`}>{o.d >= 0 ? '+' : '−'}{Math.abs(o.d).toFixed(1)}<small>σ</small></b>
            <span className="ctx-hero-t">{o.d >= 0 ? L('más que la liga', 'more than the league') : L('menos que la liga', 'less than the league')} · {o.nivel}</span>
            <span className="ctx-hero-s">{L(DIMS.find(d => d[0] === o.dim)![1], DIMS.find(d => d[0] === o.dim)![2])}</span>
          </button>
        ))}
      </div>

      <div className="ctx-ctrl">
        <Seg opts={DIMS.map(d => [d[0], L(d[1], d[2])] as [string, string])} v={dim} set={setDim} />
        <Seg opts={[['dif', L('Frente a la liga', 'Versus league')], ['val', L('Su valor', 'His value')]]} v={mode} set={s => setMode(s as Any)} />
      </div>
      <div className="card ctx-matrix" style={{ ['--cols' as string]: cols.length }}>
        <div className="ctx-mh"><span /> {cols.map((r, i) => <b key={i}>{td(r.nivel)}</b>)}</div>
        {ks.map(x => (
          <div key={x} className="ctx-mr">
            <span className="ctx-ml">{label(x)}</span>
            {(C.curvas[dim][x] as Any[]).map((r, i) => {
              const d = r.dt != null && r.liga != null ? r.dt - r.liga : null
              const v = mode === 'dif' ? d : r.dt
              const weak = r.n_dt < MIN_N
              return (
                <span key={i} className={`ctx-cell${weak ? ' weak' : ''}`} style={{ background: cellBg(v, mode === 'dif' ? maxD : 2) }}
                  onMouseMove={e => tip.show(e, <><b>{label(x)}</b> · {td(r.nivel)}<br />{L('Él', 'Him')} {sig(r.dt)} · {L('liga', 'league')} {sig(r.liga)}<br />{r.n_dt} {L('segmentos', 'segments')}{weak ? ` · ${L('muestra chica', 'small sample')}` : ''}</>)} onMouseLeave={tip.hide}>
                  <b>{v == null ? '—' : mode === 'dif' ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}` : sig(v)}</b>
                  <small>{mode === 'dif' ? `${sig(r.dt)} / ${sig(r.liga)}` : `${L('liga', 'league')} ${sig(r.liga)}`}</small>
                </span>
              )
            })}
          </div>
        ))}
        <div className="ctx-leg note"><i className="neg" />{L('menos', 'less')}<span className="ctx-leg-bar" /><i className="pos" />{L('más', 'more')} · {mode === 'dif' ? L('diferencia con lo que hace la liga en esa situación (σ)', 'difference from what the league does in that situation (σ)') : L('estilo propio en σ, 0 = media de la liga', 'own style in σ, 0 = league average')}</div>
      </div>
      {tip.el}

      <h3 className="h2">{L('Qué le hace cambiar de un partido a otro', 'What changes his approach from match to match')} <Info wide>{L('Qué es lo que más cambia su forma de jugar de un partido a otro: jugar en casa, la fuerza del rival, el marcador o ', 'What shifts his style most from one match to the next: playing at home, the opponent\'s strength, the scoreline or ')}<b>{L('cómo juega el rival', 'how the opponent plays')}</b>{L(' (si presiona, si tiene el balón, si es directo). Cada punto es un partido.', ' (whether they press, keep the ball or go direct). Each dot is a match.')}</Info></h3>
      <Seg opts={KEY.filter(x => C.motores?.[x]).slice(0, 8).map(x => [x, label(x)] as [string, string])} v={k} set={setK} />
      {C.motores?.[k] ? <Drivers rows={C.motores[k]} /> : <div className="note">{L('Hacen falta al menos 15 partidos.', 'Needs at least 15 matches.')}</div>}

    </div>
  )
}

const VAR_ES: Record<string, string> = { local: L('Juega de local', 'Playing at home'), fuerza_rival: L('Fuerza del rival', 'Opponent strength'), dif_goles_media: L('Diferencia de goles', 'Goal difference'), rival_presion: L('Presión del rival', 'Opponent pressing'), rival_posesion: L('Posesión del rival', 'Opponent possession'), rival_verticalidad: L('Verticalidad del rival', 'Opponent directness') }
function Drivers({ rows }: { rows: Any[] }) {
  const max = Math.max(...rows.map(r => r.importancia), 1e-6)
  return (
    <div className="card ctx-drivers">
      {rows.map((r, i) => {
        const pts: number[][] = r.puntos ?? []
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
        const sx = (v: number) => 4 + ((v - x0) / Math.max(x1 - x0, 1e-9)) * 112, sy = (v: number) => 4 + (1 - (v - y0) / Math.max(y1 - y0, 1e-9)) * 40
        const mx = xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1), my = ys.reduce((a, b) => a + b, 0) / Math.max(ys.length, 1)
        const vx = xs.reduce((a, b) => a + (b - mx) ** 2, 0), cv = xs.reduce((a, b, j) => a + (b - mx) * (ys[j] - my), 0)
        const b1 = vx > 0 ? cv / vx : 0
        const flat = Math.abs(r.direccion) < 0.2
        const up = r.direccion > 0
        return (
          <div key={r.variable} className="ctx-drv2" style={{ ['--i' as string]: i }}>
            <span className="ctx-rank">{i + 1}</span>
            <div className="ctx-dn"><b>{VAR_ES[r.variable] || r.variable}</b>
              <span className="ctx-dbar"><i style={{ width: `${(r.importancia / max) * 100}%` }} /></span>
            </div>
            <svg className="ctx-sc" viewBox="0 0 120 48" preserveAspectRatio="none" aria-hidden>
              {pts.map((p, j) => <circle key={j} cx={sx(p[0])} cy={sy(p[1])} r={1.7} fill="var(--c-dt)" opacity={0.4} />)}
              {vx > 0 && <line x1={sx(x0)} y1={sy(my + b1 * (x0 - mx))} x2={sx(x1)} y2={sy(my + b1 * (x1 - mx))} stroke="var(--ink)" strokeWidth={1.6} strokeLinecap="round" />}
            </svg>
            <span className={`ctx-dir ${flat ? 'flat' : up ? 'up' : 'dn'}`}>{flat ? '↔' : up ? '↗' : '↘'}<small>{flat ? L('depende del caso', 'it depends') : up ? L('cuanto más, más sube', 'the more, the higher') : L('cuanto más, más baja', 'the more, the lower')}</small></span>
          </div>
        )
      })}
    </div>
  )
}

export function Evolution({ rows, k, etapas }: { rows: Any[]; k: string; etapas: Any[] }) {
  const tip = useTip()
  if (!rows?.length) return null
  const W = 900, H = 230, P = { l: 44, r: 12, t: 14, b: 26 }
  const vals = rows.flatMap(r => [r[k], r[`${k}_movil`]]).filter(v => v != null)
  const lo = Math.min(-1, ...vals), hi = Math.max(1, ...vals)
  const x = (i: number) => P.l + (i / Math.max(rows.length - 1, 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b)
  const clubOf = (d: string) => etapas.find((e: Any) => d >= e.desde && d <= e.hasta)?.club ?? ''
  const segs: { a: number; b: number; club: string }[] = []
  rows.forEach((r, i) => { const c = r.club_id; if (!segs.length || segs.at(-1)!.club !== String(c)) segs.push({ a: i, b: i, club: String(c) }); else segs.at(-1)!.b = i })
  const hues = ['var(--c-dt)', 'var(--c-plantilla)', 'var(--c-club)', 'var(--c-rival)', 'var(--c-ctx)']
  const hueOf = (c: string) => hues[[...new Set(segs.map(s => s.club))].indexOf(c) % hues.length]
  const line = rows.map((r, i) => `${x(i)},${y(r[`${k}_movil`])}`).join(' ')
  const gid = `ev${k}`
  return (
    <div className="card tbl-wrap ctx-evo">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 560 }}>
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--c-dt)" stopOpacity=".35" /><stop offset="1" stopColor="var(--c-dt)" stopOpacity="0" /></linearGradient></defs>
        {segs.map((s, i) => <rect key={i} x={x(s.a) - 2} y={P.t} width={Math.max(4, x(s.b) - x(s.a) + 4)} height={H - P.t - P.b} fill={hueOf(s.club)} opacity={0.07} />)}
        {segs.map((s, i) => <text key={'l' + i} x={x(s.a) + 4} y={P.t + 10} fontSize={11} fontWeight={700} fill={hueOf(s.club)}>{clubOf(rows[s.a].date)}</text>)}
        <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="var(--ink-3)" strokeDasharray="2 3" />
        <text x={P.l - 6} y={y(0) + 4} fontSize={11} textAnchor="end" fill="var(--ink-3)">{L('liga', 'league')}</text>
        <polygon points={`${x(0)},${y(0)} ${line} ${x(rows.length - 1)},${y(0)}`} fill={`url(#${gid})`} />
        {rows.map((r, i) => <circle key={i} cx={x(i)} cy={y(r[k])} r={3} fill={hueOf(String(r.club_id))} opacity={0.5} onMouseMove={e => tip.show(e, <>{r.date} · {clubOf(r.date)}<br />{L('ajustado', 'adjusted')} {sig(r[k])} · {L('crudo', 'raw')} {sig(r[`${k}_crudo`])}</>)} onMouseLeave={tip.hide} />)}
        <polyline points={line} fill="none" stroke="var(--c-dt)" strokeWidth={2.8} strokeLinejoin="round" strokeLinecap="round" />
        <text x={P.l} y={H - 6} fontSize={11} fill="var(--ink-3)">{rows[0].date}</text>
        <text x={W - P.r} y={H - 6} fontSize={11} textAnchor="end" fill="var(--ink-3)">{rows.at(-1).date}</text>
      </svg>
      {tip.el}
    </div>
  )
}
