import { Fragment, useState } from 'react'
import { COMP, fmt, pct, shortName, sig, type Any } from '../lib'
import { ClubName, HBar, How, Legend, PrismDetail, prismSentence, useTip } from '../charts'
import { FAM_ORDER, type P } from './common'
import { useDistData } from '../Dist'
import { KpiBell, kFmt, kName } from './resumenKit'
import '../styles/resumen.css'

export function DtVsPlantilla({ art, glob }: P) {
  const [fam, setFam] = useState('todas')
  const rows = art.atribucion.filter((a: Any) => !a.kpi.startsWith('arq_'))
  const byFam = FAM_ORDER.map(f => [f, rows.filter((r: Any) => glob.kpis[r.kpi].familia === f)] as [string, Any[]])
  const hu = Object.fromEntries(art.huella.map((h: Any) => [h.kpi, h]))
  const id = art.identificabilidad
  const vm = glob.varianza_media
  const dd = useDistData()
  return (
    <div className="att-page">
      <h3 className="h2">De dónde sale cada rasgo</h3>
      <p className="lede">Cada fila es un rasgo de su forma de jugar. La primera barra es lo que se ve en sus partidos comparado con la liga.
        Las demás dicen quién lo empuja: él, sus jugadores, el club, los rivales o el contexto (localía, marcador, minuto).
        Hacia la derecha lo sube, hacia la izquierda lo baja. <b>Toca una fila</b> para ver dónde queda entre todos los DTs.</p>
      <div className="att-fams" role="group" aria-label="Filtrar por familia">
        {[['todas', 'Todas'], ...FAM_ORDER.filter(f => byFam.some(([g, rs]) => g === f && rs.length)).map(f => [f, f])].map(([k, l]) => (
          <button key={k} type="button" aria-pressed={fam === k} onClick={() => setFam(k)}>{l}</button>
        ))}
      </div>
      <Legend items={[{ key: 'obs', label: 'Lo que se ve', color: 'var(--ink)' }, ...COMP.map(c => ({ ...c, label: WHO[c.key] ?? c.label }))]} />
      {byFam.filter(([f]) => fam === 'todas' || f === fam).map(([f, rs]) => rs.length ? (
        <div key={f} className="card tbl-wrap att-card">
          <div className="att-fam">{f}</div>
          <AttribTable rows={rs} glob={glob} hu={hu} art={art} dd={dd} />
        </div>
      ) : null)}
      <How>
        Modelo AKM (Abowd, Kramarz y Margolis, 1999), el que Muehlheusser et al. (2018) usan para separar al DT del club en resultados, aplicado aquí a <i>estilo</i> y ampliado con jugadores en cancha (ridge tipo RAPM).
        Unidad: segmento de ≥5 min sin cambios de jugadores ni de marcador. z = α<sub>DT</sub> + φ<sub>club</sub> + Σβ<sub>jugador</sub>·exposición + γ<sub>rival·temporada</sub> + δ·contexto + ε,
        con penalización ridge por bloque (DT {glob.lambda.coach}, club {glob.lambda.club}, jugadores {glob.lambda.player}). Las barras están en desviaciones estándar entre equipos (σ).
        Lo que separa al DT de su plantilla es que los mismos jugadores jueguen con otros DTs, que el DT cambie de club y las rotaciones dentro de su etapa.
      </How>

      <h3 className="h2">¿Qué tan bien se le separa de su plantilla?</h3>
      <div className="grid3">
        <div className="card"><div className="note">Nota de separación</div><div className="big">{fmt(id.indice, 0)}<span style={{ fontSize: 24 }}>/100</span></div><div className="note">Sube si dirigió varios clubes y si sus jugadores también jugaron con otros técnicos.</div></div>
        <div className="card"><div className="note">Clubes dirigidos</div><div className="big">{id.movilidad}</div><div className="note">Verlo con plantillas distintas ayuda a saber qué es suyo.</div></div>
        <div className="card"><div className="note">Jugadores compartidos</div><div className="big">{pct(100 * id.conectividad)}</div><div className="note">de los minutos de sus jugadores son de futbolistas que también jugaron con otro DT (450 min o más).</div></div>
      </div>

      <h3 className="h2">En Liga MX, ¿por qué juegan distinto los equipos?</h3>
      <p className="lede">Si comparas a todos los equipos de la liga, esto es lo que explica sus diferencias de estilo, en promedio:
        el DT {pct(100 * vm.coach)}, los jugadores {pct(100 * vm.player)}, el club {pct(100 * vm.club)}, los rivales {pct(100 * vm.opp)} y el contexto {pct(100 * vm.ctx)}. El resto no lo explica nadie en particular.</p>
      <Legend items={[...COMP.map(c => ({ ...c, label: WHO[c.key] ?? c.label })), { key: 'r', label: 'Sin explicar', color: 'var(--c-resid)' }]} />
      <div className="card">
        {Object.entries(glob.varianza).filter(([k]) => !k.startsWith('arq_')).map(([k, v]: Any) => <ShareBar key={k} label={kName(k, glob)} v={v} />)}
      </div>
      <How title="¿Cómo se lee?">Para cada indicador se promedian observado y componentes por equipo-temporada y se reparte la varianza como cov(componente, observado)/var(observado). Las partes pueden ser negativas cuando dos fuentes se compensan (por ejemplo, un DT ofensivo con una plantilla defensiva).</How>
    </div>
  )
}

const WHO: Record<string, string> = { coach: 'Él (DT)', player: 'Jugadores', club: 'Club', opp: 'Rivales', ctx: 'Contexto' }
const ATT_COLS = [{ key: 'observado', label: 'Lo que se ve', color: 'var(--ink)' }, ...COMP.map(c => ({ ...c, label: WHO[c.key] ?? c.label }))]

function AttribTable({ rows, glob, hu, art, dd }: { rows: Any[]; glob: Any; hu: Any; art: Any; dd: Any }) {
  const [open, setOpen] = useState<string | null>(null)
  const max = Math.max(1, ...rows.flatMap(r => ATT_COLS.map(c => Math.abs(r[c.key] ?? 0))))
  return (
    <table className="t att">
      <thead><tr><th>Rasgo</th>{ATT_COLS.map(c => <th key={c.key} className="att-th">{c.key !== 'observado' && <i className="sw" style={{ background: c.color }} />}{c.label}</th>)}<th aria-hidden /></tr></thead>
      <tbody>{rows.map(r => {
        const isOpen = open === r.kpi
        const h = hu[r.kpi]
        return (
          <Fragment key={r.kpi}>
            <tr className={`att-row${isOpen ? ' open' : ''}`} onClick={() => setOpen(isOpen ? null : r.kpi)} aria-expanded={isOpen}
                tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(isOpen ? null : r.kpi))}>
              <td className="att-name">{kName(r.kpi, glob)}<div className="note">sus partidos <b>{kFmt(r.kpi, h?.crudo, true)}</b> · liga {kFmt(r.kpi, h?.liga, true)}</div></td>
              {ATT_COLS.map(c => {
                const v = r[c.key] ?? 0
                const w = Math.min(50, Math.abs(v) / max * 50)
                return (
                  <td key={c.key} className={`cell${c.key === 'observado' ? ' obs' : ''}`}>
                    <span className="mini"><span className="mid" /><span className="bar" style={{ background: c.color, left: v >= 0 ? '50%' : `${50 - w}%`, width: `${w}%` }} /></span>
                    <span className="num">{sig(v)}</span>
                  </td>
                )
              })}
              <td className="att-caret" aria-hidden>▾</td>
            </tr>
            {isOpen && (
              <tr><td colSpan={ATT_COLS.length + 2} className="att-open">
                <p className="explain">{prismSentence(r, glob.kpis[r.kpi].etiqueta)}</p>
                <div className="att-open-grid">
                  <div><div className="att-open-h">Entre todos los DTs</div><KpiBell k={r.kpi} art={art} glob={glob} dd={dd} color="var(--c-dt)" mode="v" /></div>
                  <div><div className="att-open-h">¿Quién lo empuja?</div><PrismDetail row={r} /></div>
                </div>
              </td></tr>
            )}
          </Fragment>
        )
      })}</tbody>
    </table>
  )
}

function ShareBar({ label, v }: { label: string; v: Any }) {
  const tip = useTip()
  const parts = [...COMP.map(c => ({ ...c, x: Math.max(0, v[c.key]) })), { key: 'residual', label: 'Sin explicar', color: 'var(--c-resid)', x: Math.max(0, v.residual) }]
  const tot = parts.reduce((s, p) => s + p.x, 0) || 1
  let acc = 0
  return (
    <div className="prism-row" style={{ gridTemplateColumns: 'minmax(150px,260px) 1fr 64px' }}>
      <span className="prism-label">{label}</span>
      <svg viewBox="0 0 400 16" preserveAspectRatio="none" style={{ width: '100%', height: 16 }}>
        {parts.map(p => { const w = p.x / tot * 400; const x = acc; acc += w; return w > 0.5 ? <rect key={p.key} x={x + 1} y={2} width={Math.max(0, w - 2)} height={12} rx={3} fill={p.color} onMouseMove={e => tip.show(e, <><b>{p.label}</b>: {pct(100 * v[p.key], 1)}</>)} onMouseLeave={tip.hide} /> : null })}
      </svg>
      <span className="prism-val">DT {pct(100 * v.coach)}</span>
      {tip.el}
    </div>
  )
}

/* ================================================================ TRANSFERENCIA */
export function Transferencia({ art, glob, media }: P) {
  const all: Any[] = glob.transferencia
  const mine = art.transferencia
  const R = glob.transferencia_resumen || {}
  return (
    <div>
      <h3 className="h2">¿Su estilo viaja con él?</h3>
      <p className="lede">La prueba más directa de que un estilo es del DT y no de sus jugadores: le escondemos al modelo todos sus partidos en un club, lo entrenamos con el resto de la liga y le pedimos que adivine quién dirigía esos partidos. Si lo reconoce aunque los jugadores sean otros, el estilo es suyo.</p>
      {mine.length ? (
        <div className="grid2">
          {mine.map((t: Any) => (
            <div key={t.club} className="card">
              <div className="h3 inline-club">Partidos escondidos: <ClubName club={t.club} media={media} size={20} /> ({t.partidos})</div>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', margin: '8px 0 12px' }}>
                <div><div className="note">En qué lugar lo puso</div><div className="big">{t.rank_ajustado}º<span style={{ fontSize: 22 }}> de {t.n_clases}</span></div></div>
                <div><div className="note">Sin descontar jugadores</div><div className="big" style={{ color: 'var(--ink-3)' }}>{t.rank_crudo}º</div></div>
                <div><div className="note">Al azar</div><div className="big" style={{ color: 'var(--ink-3)' }}>{fmt(t.rank_nulo, 0)}º</div></div>
              </div>
              <div className="note">1º sería adivinarlo a la primera. A qué técnicos se parece más esa etapa:</div>
              <HBar items={t.top5_ajustado.map(([n, p]: Any) => ({ label: n === art.nombre ? `✓ ${n}` : n, v: Math.max(0, p) }))} max={1} />
            </div>
          ))}
        </div>
      ) : <div className="card note">Dirigió un solo club (con al menos 8 partidos) en estos datos, así que con él no se puede hacer la prueba. Abajo están los resultados de toda la liga.</div>}
      <h3 className="h2">Todos los DTs que cambiaron de club</h3>
      {R.ajustado && (
        <div className="grid3" style={{ marginBottom: 16 }}>
          <div className="card"><div className="note">El DT real queda en la mitad de arriba</div><div className="big">{R.ajustado.mitad_superior}<span style={{ fontSize: 22 }}> de {R.etapas}</span></div><div className="note">al azar serían {R.etapas / 2} · sin descontar jugadores: {R.crudo.mitad_superior}</div></div>
          <div className="card"><div className="note">El DT real entre los 5 primeros</div><div className="big">{pct(100 * R.ajustado.top5)}</div><div className="note">al azar: {pct(100 * R.azar.top5)} · sin descontar jugadores: {pct(100 * R.crudo.top5)}</div></div>
          <div className="card"><div className="note">Lugar típico del DT real</div><div className="big">{fmt(R.ajustado.mediana, 0)}º<span style={{ fontSize: 22 }}> de {all[0]?.n_clases}</span></div><div className="note">al azar: {fmt(R.azar.mediana, 0)}º · sin descontar jugadores: {fmt(R.crudo.mediana, 0)}º</div></div>
        </div>
      )}
      <p className="lede">En resumen, el estilo <b>sí viaja</b>: el DT real sale muy por encima del azar con jugadores que el modelo nunca vio con él. No es una huella perfecta, porque hay técnicos parecidos y etapas cortas o raras. Descontar jugadores, club y rival ayuda a reconocerlo en {R.ajustado_mejor_que_crudo} de {R.etapas} etapas (empate en {R.ajustado_igual}).
        {R.ajustado?.p_signo != null && <span className="note"> Prueba de signo: p {R.ajustado.p_signo < 0.001 ? '< 0.001' : `= ${fmt(R.ajustado.p_signo, 3)}`}.</span>}</p>
      <RankPlot rows={all} highlight={art.id} />
      <How>
        Para cada etapa oculta se reajusta todo el modelo sin esos partidos, para que no haya fuga de información. Se promedia el vector de estilo (35 indicadores, en σ) de los partidos de la etapa y se correlaciona con el perfil medio de cada DT candidato (≥12 partidos) en el resto de la liga.
        «Crudo» es el estilo tal como se observa. «Ajustado» le resta lo que el modelo atribuye a club, jugadores, rival y contexto. Con K candidatos, el azar da un puesto esperado de (K+1)/2. La prueba de signo contrasta cuántas etapas quedan en la mitad superior.
      </How>
    </div>
  )
}

function RankPlot({ rows, highlight }: { rows: Any[]; highlight: number }) {
  const tip = useTip()
  const sorted = [...rows].sort((a, b) => a.rank_ajustado - b.rank_ajustado)
  const K = Math.max(...rows.map(r => r.n_clases), 10)
  const W = 640, rowH = 22, L = 230
  const x = (r: number) => L + (Math.log(r) / Math.log(K)) * (W - L - 16)
  return (
    <div className="card tbl-wrap">
      <Legend items={[{ key: 'a', label: 'Descontando jugadores, club y rival', color: 'var(--c-dt)' }, { key: 'c', label: 'Sin descontar', color: 'var(--c-plantilla)' }, { key: 'n', label: 'Al azar', color: 'var(--c-resid)' }]} />
      <svg viewBox={`0 0 ${W} ${sorted.length * rowH + 24}`} style={{ width: '100%', minWidth: 520 }}>
        {[1, 2, 5, 10, 20, 40].filter(t => t <= K).map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={0} y2={sorted.length * rowH} stroke="var(--rule)" /><text x={x(t)} y={sorted.length * rowH + 16} fontSize={11} textAnchor="middle" fill="var(--ink-3)">{t}</text></g>)}
        {sorted.map((r, i) => {
          const y = i * rowH + rowH / 2
          const hl = r.coach_id === highlight
          return (
            <g key={`${r.coach_id}-${r.club}`} onMouseMove={e => tip.show(e, <><b>{r.dt}</b> en {r.club}<br />descontando {r.rank_ajustado}º · sin descontar {r.rank_crudo}º · al azar {fmt(r.rank_nulo, 0)}º de {r.n_clases}</>)} onMouseLeave={tip.hide}>
              <rect x={0} y={y - rowH / 2} width={W} height={rowH} fill={hl ? 'var(--surface-2)' : 'transparent'} />
              <text x={L - 8} y={y + 4} fontSize={12} textAnchor="end" fill="var(--ink)" fontWeight={hl ? 700 : 400}>{shortName(r.dt)} · {r.club}</text>
              <line x1={x(r.rank_ajustado)} x2={x(r.rank_crudo)} y1={y} y2={y} stroke="var(--ink-3)" strokeWidth={1} />
              <circle cx={x(r.rank_nulo)} cy={y} r={4} fill="var(--c-resid)" />
              <circle cx={x(r.rank_crudo)} cy={y} r={5} fill="var(--c-plantilla)" stroke="var(--surface)" strokeWidth={2} />
              <circle cx={x(r.rank_ajustado)} cy={y} r={5} fill="var(--c-dt)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )
        })}
      </svg>
      <div className="note">Más a la izquierda = lo reconoce antes (1º = a la primera). Eje en escala logarítmica.</div>
      {tip.el}
    </div>
  )
}

/* ================================================================ FASES */
