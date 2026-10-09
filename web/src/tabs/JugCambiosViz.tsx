import { fmt, type Any } from '../lib'
import { L } from '../settings'
import { td } from '../i18n/data'

/** Minuto de cada cambio frente a la liga: una fila por cambio con su punto, el de la liga y cuántos minutos antes o después. */
export function MinutosCambios({ mc, ml, color = 'var(--c-dt)' }: { mc: Record<string, number>; ml: Record<string, number>; color?: string }) {
  const keys = Object.keys(mc)
  const lo = 40, hi = 95
  const P = (m: number) => ((Math.max(lo, Math.min(hi, m)) - lo) / (hi - lo)) * 100
  const ticks = [45, 60, 75, 90]
  return (
    <div className="cm-min">
      <div className="cm-axis" aria-hidden>
        <span className="cm-lab" />
        <span className="cm-track">{ticks.map(t => <span key={t} className="cm-tick" style={{ left: `${P(t)}%` }}>{t}'</span>)}</span>
        <span className="cm-gap" />
      </div>
      {keys.map(n => {
        const v = mc[n], r = ml?.[n], d = r != null ? v - r : null
        return (
          <div key={n} className="cm-row">
            <span className="cm-lab"><b>{n}</b><small>{L('º cambio', 'sub')}</small></span>
            <span className="cm-track">
              {ticks.map(t => <i key={t} className={`cm-grid${t === 45 ? ' ht' : ''}`} style={{ left: `${P(t)}%` }} />)}
              {r != null && <i className="cm-link" style={{ left: `${Math.min(P(v), P(r))}%`, width: `${Math.abs(P(v) - P(r))}%` }} />}
              {r != null && <i className="cm-ref" style={{ left: `${P(r)}%` }} title={`${L('Liga', 'League')} ${fmt(r, 1)}'`} />}
              <i className="cm-dot" style={{ left: `${P(v)}%`, background: color }}><em>{fmt(v, 0)}'</em></i>
            </span>
            <span className={`cm-gap${d == null ? '' : d < -1 ? ' early' : d > 1 ? ' late' : ''}`}>
              {d == null ? '' : Math.abs(d) <= 1 ? L('como la liga', 'like the league') : d < 0 ? L(`${fmt(-d, 0)}' antes`, `${fmt(-d, 0)}' earlier`) : L(`${fmt(d, 0)}' después`, `${fmt(d, 0)}' later`)}
            </span>
          </div>
        )
      })}
      <div className="cm-legend note"><i className="cm-dot sm" style={{ background: color }} />{L('él', 'him')}<i className="cm-ref sm" />{L('promedio de la liga', 'league average')}<i className="cm-ht" />{L('medio tiempo', 'half-time')}</div>
    </div>
  )
}

const TIPOS: [string, string, string, string][] = [
  ['Más ofensivo', 'Más ofensivo', 'More attacking', 'var(--c-plantilla)'],
  ['Misma línea', 'Mismo puesto', 'Same role', 'var(--c-resid)'],
  ['Más defensivo', 'Más defensivo', 'More defensive', 'var(--c-dt)'],
]
/** Tipo de cambio según el marcador: una barra al 100% por situación, con cuántos y qué parte. */
export function TipoCambios({ data }: { data: Record<string, Any> }) {
  return (
    <div className="cm-tipo">
      <div className="cm-tipo-leg">{TIPOS.map(([, es, en, c]) => <span key={es}><i style={{ background: c }} />{L(es, en)}</span>)}</div>
      {Object.entries(data).map(([e, v]) => {
        const tot = TIPOS.reduce((s, [k]) => s + (v[k] ?? 0), 0) || 1
        return (
          <div key={e} className="cm-tipo-row">
            <span className="cm-tipo-st">{td(e)}<small>{tot} {L('cambios', 'subs')}</small></span>
            <span className="cm-stack">
              {TIPOS.map(([k, , , c]) => {
                const n = v[k] ?? 0, pc = (100 * n) / tot
                return n ? <span key={k} style={{ width: `${pc}%`, background: c }} title={`${n} · ${fmt(pc, 0)}%`}>{pc >= 9 ? `${fmt(pc, 0)}%` : ''}</span> : null
              })}
            </span>
          </div>
        )
      })}
    </div>
  )
}
