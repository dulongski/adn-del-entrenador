import { useMemo, useState } from 'react'
import { div3, real, realN, type Any } from '../lib'
import { useTip } from '../charts'
import { KEY, Seg, type P } from './common'
import { L } from '../settings'
import Info from '../Info'
import { kpiLabel, td } from '../i18n/data'
import '../styles/juego.css'

const DIMS: [string, string, string][] = [['marcador', 'Marcador', 'Scoreline'], ['minuto', 'Minuto', 'Minute'], ['localia', 'Localía', 'Home / away'], ['rival', 'Fuerza del rival', 'Opponent strength']]
const MIN_N = 40

/** fondo divergente: azul/verde (arriba) o rojo (abajo) según el signo, con intensidad ∝ |v| / escala */
const cellBg = (v: number | null, scale: number) => (v == null ? 'transparent' : div3(v, scale))

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
      <h3 className="h2">{L('Cómo se adapta', 'How he adapts')}</h3>
<div className="tab-sub">{L('Cómo cambia su juego cuando va perdiendo, empatando o ganando, según el minuto, si juega en casa o la fuerza del rival. Ya quitamos lo que ponen sus jugadores. 0 es la media de la liga en general y todo está en la unidad de cada estadística; el número pequeño es lo que hace la liga en esa misma situación: si el suyo se separa de ese, la reacción es suya.', 'How his game changes when he is losing, drawing or winning, by minute, home or away, and by the strength of the opponent. What his players bring is already taken out. 0σ is the league average overall; the small number is what the league does in that same situation: where his pulls away from it, the reaction is his.')}</div>

      <div className="ctx-hero">
        {top.map((o, i) => (
          <button key={o.kpi} className="ctx-hero-c" style={{ ['--i' as string]: i }} onClick={() => { setDim(o.dim); setMode('dif') }}>
            <span className="ctx-hero-k">{label(o.kpi)}</span>
            <b className={`ctx-hero-n ${o.d >= 0 ? 'up' : 'dn'}`}>{real(o.kpi, o.d)}</b>
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
                  onMouseMove={e => tip.show(e, <><b>{label(x)}</b> · {td(r.nivel)}<br />{L('Su cambio frente a su nivel normal', 'His shift vs his usual level')} {real(x, r.dt)} · {L('equipo promedio en la misma situación', 'average team in the same spot')} {real(x, r.liga)}<br />{r.n_dt} {L('segmentos', 'segments')}{weak ? ` · ${L('muestra chica', 'small sample')}` : ''}</>)} onMouseLeave={tip.hide}>
                  <b>{real(x, v)}</b>
                  <small>{mode === 'dif' ? `${L('su cambio', 'his shift')} ${realN(x, r.dt)} · ${L('cambio típico', 'typical shift')} ${realN(x, r.liga)}` : `${L('típico', 'typical')} ${realN(x, r.liga)}`}</small>
                </span>
              )
            })}
          </div>
        ))}
        <div className="ctx-leg note"><i className="neg" />{L('menos', 'less')}<span className="ctx-leg-bar" /><i className="pos" />{L('más', 'more')} · {mode === 'dif' ? L('diferencia con lo que hace la liga en esa situación, en la unidad de cada estadística', 'difference from what the league does in that situation, in each stat\'s unit') : L('estilo propio frente a la media de la liga (0), en la unidad de cada estadística', 'own style vs the league average (0), in each stat\'s unit')}</div>
      </div>
      {tip.el}

      <h3 className="h2">{L('Qué le hace cambiar de un partido a otro', 'What changes his approach from match to match')}</h3>
<div className="tab-sub">{L('Qué es lo que más cambia su forma de jugar de un partido a otro: jugar en casa, la fuerza del rival, el marcador o ', 'What shifts his style most from one match to the next: playing at home, the opponent\'s strength, the scoreline or ')}<b>{L('cómo juega el rival', 'how the opponent plays')}</b>{L(' (si presiona, si tiene el balón, si es directo). Cada punto es un partido.', ' (whether they press, keep the ball or go direct). Each dot is a match.')}</div>
      <Seg opts={KEY.filter(x => C.motores?.[x]).slice(0, 8).map(x => [x, label(x)] as [string, string])} v={k} set={setK} />
      {C.motores?.[k] ? <Drivers rows={C.motores[k]} k={k} kn={label(k).replace(/\s*\(.*\)$/, '').toLowerCase()} /> : <div className="note">{L('Hacen falta al menos 15 partidos.', 'Needs at least 15 matches.')}</div>}

    </div>
  )
}

const VAR_ES: Record<string, string> = { local: L('Juega de local', 'Playing at home'), fuerza_rival: L('Fuerza del rival', 'Opponent strength'), dif_goles_media: L('Diferencia de goles', 'Goal difference'), rival_presion: L('Presión del rival', 'Opponent pressing'), rival_posesion: L('Posesión del rival', 'Opponent possession'), rival_verticalidad: L('Verticalidad del rival', 'Opponent directness') }
/** Cómo se lee cada factor, en sus dos extremos y en el medio. */
const ENDS: Record<string, [string, string, string]> = {
  fuerza_rival: [L('contra rivales débiles', 'against weak opponents'), L('contra rivales medios', 'against mid-table opponents'), L('contra rivales fuertes', 'against strong opponents')],
  dif_goles_media: [L('cuando va perdiendo', 'when losing'), L('con el marcador parejo', 'with the score level'), L('cuando va ganando', 'when winning')],
  local: [L('de visita', 'away'), '', L('de local', 'at home')],
  rival_presion: [L('contra rivales que presionan poco', 'against teams that press little'), L('contra rivales de presión media', 'against average pressers'), L('contra rivales que presionan mucho', 'against heavy pressers')],
  rival_posesion: [L('contra rivales que ceden el balón', 'against teams that cede the ball'), L('contra rivales de posesión media', 'against average-possession teams'), L('contra rivales de posesión', 'against possession teams')],
  rival_verticalidad: [L('contra rivales elaborados', 'against patient teams'), L('contra rivales intermedios', 'against in-between teams'), L('contra rivales directos', 'against direct teams')],
}
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const amt = (k: string, z: number) => real(k, Math.abs(z)).replace(/^[+−-]/, '')

/** Forma de la curva a partir de los puntos SHAP (x = factor, y = cuánto movió su estilo ese partido):
 *  promedios por tercio (o por valor, si es sí/no) → sube, baja, en U, en ∩ o casi plano, con su tamaño real. */
function shape(r: Any, k: string, kn: string) {
  const pts = [...(r.puntos ?? [])].sort((a: number[], b: number[]) => a[0] - b[0])
  const E = ENDS[r.variable] ?? ['', '', '']
  const mean = (a: number[][]) => a.reduce((s, p) => s + p[1], 0) / Math.max(a.length, 1)
  const bin = r.variable === 'local'
  const g = bin ? [pts.filter(p => p[0] < 0.5), [], pts.filter(p => p[0] >= 0.5)]
    : [pts.slice(0, Math.floor(pts.length / 3)), pts.slice(Math.floor(pts.length / 3), Math.floor((2 * pts.length) / 3)), pts.slice(Math.floor((2 * pts.length) / 3))]
  const [lo, mid, hi] = g.map(mean)
  const d = hi - lo, bump = mid - (lo + hi) / 2
  if (Math.max(Math.abs(d), bin ? 0 : Math.abs(bump)) < 0.08) return { ico: '→', cls: 'flat', txt: L(`Casi no mueve su ${kn}: menos de ${amt(k, 0.08)} de diferencia.`, `Barely moves his ${kn}.`) }
  if (!bin && Math.abs(bump) > Math.abs(d) * 0.75 && E[1]) {
    const more = bump > 0
    return { ico: more ? '∩' : '∪', cls: 'flat', txt: L(`${cap(E[1])} tiene ${amt(k, bump)} ${more ? 'más' : 'menos'} de ${kn} que ${E[0]} o ${E[2]}: no es una línea recta.`,
      `${cap(E[1])} his ${kn} is ${amt(k, bump)} ${more ? 'higher' : 'lower'} than ${E[0]} or ${E[2]}.`) }
  }
  const more = d > 0
  return { ico: more ? '↗' : '↘', cls: more ? 'up' : 'dn', txt: L(`${cap(E[2])} tiene ${amt(k, d)} ${more ? 'más' : 'menos'} de ${kn} que ${E[0]}.`,
    `${cap(E[2])} his ${kn} is ${amt(k, d)} ${more ? 'higher' : 'lower'} than ${E[0]}.`) }
}

function Drivers({ rows, k, kn }: { rows: Any[]; k: string; kn: string }) {
  const max = Math.max(...rows.map(r => r.importancia), 1e-6)
  return (
    <div className="card ctx-drivers">
      {rows.map((r, i) => {
        const pts: number[][] = r.puntos ?? []
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
        const sx = (v: number) => 4 + ((v - x0) / Math.max(x1 - x0, 1e-9)) * 112, sy = (v: number) => 4 + (1 - (v - y0) / Math.max(y1 - y0, 1e-9)) * 40
        const sh = shape(r, k, kn)
        return (
          <div key={r.variable} className="ctx-drv2" style={{ ['--i' as string]: i }}>
            <span className="ctx-rank">{i + 1}</span>
            <div className="ctx-dn">
              <span className="ctx-dh"><b>{VAR_ES[r.variable] || r.variable}</b><em title={L('Cuánto mueve este factor su estilo en un partido típico', 'How much this factor moves his style in a typical match')}>{L('mueve', 'moves')} ±{amt(k, r.importancia)} {L('por partido', 'per match')}</em></span>
              <span className="ctx-dbar"><i style={{ width: `${(r.importancia / max) * 100}%` }} /></span>
              <span className="ctx-dtxt">{sh.txt}</span>
            </div>
            <svg className="ctx-sc" viewBox="0 0 120 48" preserveAspectRatio="none" aria-hidden>
              {pts.map((p, j) => <circle key={j} cx={sx(p[0])} cy={sy(p[1])} r={1.7} fill="var(--c-dt)" opacity={0.45} />)}
              <line x1={4} x2={116} y1={sy(0)} y2={sy(0)} stroke="var(--ink-3)" strokeDasharray="2 3" strokeWidth={0.8} />
            </svg>
            <span className={`ctx-dir ${sh.cls}`}>{sh.ico}</span>
          </div>
        )
      })}
      <p className="note ctx-dnote">{L('Cada punto del mini gráfico es un partido: a la derecha, más del factor (rival más fuerte, más ventaja en el marcador…); arriba, el factor subió su estilo ese partido; la línea punteada es «no cambió nada». Sale de un modelo de árboles con valores SHAP, ya sin el efecto de sus jugadores.',
        'Each dot is a match: right = more of the factor; up = it pushed his style up that match; dotted line = no change. From a tree model with SHAP values, net of his players.')}</p>
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
        {rows.map((r, i) => <circle key={i} cx={x(i)} cy={y(r[k])} r={3} fill={hueOf(String(r.club_id))} opacity={0.5} onMouseMove={e => tip.show(e, <>{r.date} · {clubOf(r.date)}<br />{L('ajustado', 'adjusted')} {real(k, r[k])} · {L('crudo', 'raw')} {real(k, r[`${k}_crudo`])}</>)} onMouseLeave={tip.hide} />)}
        <polyline points={line} fill="none" stroke="var(--c-dt)" strokeWidth={2.8} strokeLinejoin="round" strokeLinecap="round" />
        <text x={P.l} y={H - 6} fontSize={11} fill="var(--ink-3)">{rows[0].date}</text>
        <text x={W - P.r} y={H - 6} fontSize={11} textAnchor="end" fill="var(--ink-3)">{rows.at(-1).date}</text>
      </svg>
      {tip.el}
    </div>
  )
}
