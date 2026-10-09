import { Fragment, useState } from 'react'
import Dist, { rankOf, toValues } from '../Dist'
import { fmt, type Any } from '../lib'
import { apellido, rawFormat, signed } from './util'
import { L } from '../settings'
import Info from '../Info'

export type Row = { k: string; a: number; b: number; d: number }
type Side = { id: number; name: string; color: string }

/** Campanas de un rasgo: estilo propio (α) o lo que se vio en sus partidos (valor crudo). */
export function TraitBell({ dd, k, A, B, modo, compact = false, height = 84 }: { dd: Any; k: string; A: Side; B: Side; modo: 'a' | 'v'; compact?: boolean; height?: number }) {
  const kp = dd?.kpis?.[k]
  if (!kp) return <p className="note">{L('Cargando la distribución…', 'Loading the distribution…')}</p>
  const marks = [{ id: A.id, color: A.color, label: apellido(A.name) }, { id: B.id, color: B.color, label: apellido(B.name) }]
  if (modo === 'a') {
    return <Dist values={toValues(kp.a)} marks={marks} refV={0} refLabel={L('promedio', 'average')} format={v => signed(v)} low={L('menos', 'less')} high={L('más', 'more')} height={height} compact={compact} axis={L('Estilo propio en σ (0 = DT promedio) · cada punto, un DT', 'Own style in σ (0 = average coach) · each dot, one coach')} />
  }
  return <Dist values={toValues(kp.v)} marks={marks} refV={kp.liga} refLabel={L('liga', 'league')} format={rawFormat(kp.etiqueta, kp.liga)} low={L('menos', 'less')} high={L('más', 'more')} height={height} compact={compact} axis={`${kp.etiqueta} · ${L('en sus partidos, cada punto un DT', 'in his matches, each dot a coach')}`} />
}

/** Frase corta: dónde queda cada uno entre todos los DTs. */
function rankLine(dd: Any, k: string, A: Side, B: Side, modo: 'a' | 'v') {
  const m = dd?.kpis?.[k]?.[modo]
  if (!m) return null
  const vals = toValues(m)
  const one = (s: Side) => { const v = m[String(s.id)]; if (v == null) return null; const r = rankOf(vals, v); return L(`${apellido(s.name)} supera a ${r.below} de ${r.n - 1}`, `${apellido(s.name)} is above ${r.below} of ${r.n - 1}`) }
  return [one(A), one(B)].filter(Boolean).join(' · ')
}

/** Rasgo por rasgo: mancuernas en HTML (no se deforman en el móvil) con los dos valores y la brecha. Clic = abre sus campanas. */
export default function TraitBars({ rows, lab, A, B, dd }: { rows: Row[]; lab: (k: string) => string; A: Side; B: Side; dd: Any }) {
  const [open, setOpen] = useState<string | null>(null)
  const peak = Math.max(1, ...rows.flatMap(o => [Math.abs(o.a), Math.abs(o.b)]))
  const M = Math.min(3, Math.ceil(peak * 1.1 * 2) / 2)
  const P = (v: number) => ((Math.max(-M, Math.min(M, v)) + M) / (2 * M)) * 100
  const ticks = [] as number[]
  for (let t = -Math.floor(M); t <= Math.floor(M); t++) ticks.push(t)

  return (
    <div className="vs-tb">
      <div className="vs-tb-row vs-tb-axis" aria-hidden>
        <span className="vs-tb-lab" />
        <span className="vs-tb-track">
          {ticks.map(t => <span key={t} className="vs-tb-tick" style={{ left: `${P(t)}%` }}>{t === 0 ? <><span className="vs-tb-wide">{L('DT promedio', 'Average coach')}</span><span className="vs-tb-narrow">0</span></> : signed(t, 0)}</span>)}
        </span>
        <span className="vs-tb-nums vs-tb-nh"><span title={A.name}><i style={{ background: A.color }} /><span className="vs-tb-wide">{apellido(A.name)}</span></span><span title={B.name}><i style={{ background: B.color }} /><span className="vs-tb-wide">{apellido(B.name)}</span></span><span><span className="vs-tb-wide">{L('Brecha', 'Gap')}</span><span className="vs-tb-narrow">{L('Dif.', 'Gap')}</span></span></span>
      </div>
      {rows.map(o => {
        const isOpen = open === o.k
        const lo = Math.min(P(o.a), P(o.b)), hi = Math.max(P(o.a), P(o.b))
        return (
          <Fragment key={o.k}>
            <button className="vs-tb-row vs-tb-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : o.k)}>
              <span className="vs-tb-lab"><span className="vs-tb-caret" aria-hidden>{isOpen ? '▾' : '▸'}</span>{lab(o.k)}</span>
              <span className="vs-tb-track">
                {ticks.map(t => <span key={t} className={`vs-tb-grid${t === 0 ? ' zero' : ''}`} style={{ left: `${P(t)}%` }} />)}
                <span className="vs-tb-link" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
                <span className="vs-tb-dot" style={{ left: `${P(o.b)}%`, background: B.color }} title={`${B.name}: ${signed(o.b)}`} />
                <span className="vs-tb-dot" style={{ left: `${P(o.a)}%`, background: A.color }} title={`${A.name}: ${signed(o.a)}`} />
              </span>
              <span className="vs-tb-nums">
                <span>{signed(o.a)}</span><span>{signed(o.b)}</span><span className="vs-tb-gap">{fmt(Math.abs(o.d), 2)}</span>
              </span>
            </button>
            {isOpen && (
              <div className="vs-tb-open">
                <div>
                  <div className="vs-tb-bt">{L('Su sello propio', 'His own stamp')} <span className="note">{L('(sin el efecto de la plantilla)', '(squad effect removed)')}</span></div>
                  <TraitBell dd={dd} k={o.k} A={A} B={B} modo="a" />
                  <div className="note">{rankLine(dd, o.k, A, B, 'a')}</div>
                </div>
                <div>
                  <div className="vs-tb-bt">{L('Lo que se vio en sus partidos', 'What his matches showed')} <span className="note">{L('(con su plantilla)', '(with his squad)')}</span></div>
                  <TraitBell dd={dd} k={o.k} A={A} B={B} modo="v" />
                  <div className="note">{rankLine(dd, o.k, A, B, 'v')}</div>
                </div>
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

/** Las 6 mayores diferencias, cada una con la campana de todos los DTs. */
export function DistGrid({ rows, lab, A, B, dd }: { rows: Row[]; lab: (k: string) => string; A: Side; B: Side; dd: Any }) {
  const [modo, setModo] = useState<'a' | 'v'>('a')
  return (
    <div className="card">
      <div className="vs-head">
        <div className="h3" style={{ margin: 0 }}>{L('Dónde quedan entre todos los DTs', 'Where they sit among all coaches')}
          <Info wide>
            <p>{L('Cada punto gris es un DT de la liga. Pasa el cursor para ver quién es.', 'Each grey dot is a league coach. Hover to see who.')}</p>
            <p>{L('Sello propio: cuánto empuja el DT ese rasgo por encima o por debajo del DT promedio, ya descontado lo que aportan sus jugadores, el club y los rivales.', 'Own stamp: how far the coach pushes that trait above or below the average coach, after stripping out what his players, the club and opponents bring.')}</p>
            <p>{L('En sus partidos: el valor tal cual en los partidos que dirigió; la línea punteada es el promedio de la liga.', 'In his matches: the raw value in the matches he coached; the dotted line is the league average.')}</p>
          </Info>
        </div>
        <div className="seg" style={{ margin: 0 }}>
          <button aria-pressed={modo === 'a'} onClick={() => setModo('a')}>{L('Sello propio', 'Own stamp')}</button>
          <button aria-pressed={modo === 'v'} onClick={() => setModo('v')}>{L('En sus partidos', 'In his matches')}</button>
        </div>
      </div>
      <div className="vs-dg">
        {rows.slice(0, 6).map(o => (
          <div key={o.k} className="vs-dg-cell">
            <div className="vs-dg-t">{lab(o.k)}</div>
            <TraitBell dd={dd} k={o.k} A={A} B={B} modo={modo} compact height={64} />
          </div>
        ))}
      </div>
    </div>
  )
}
