import { Fragment, useState } from 'react'
import { COMP, fmt, pct, shortName, sig, type Any } from '../lib'
import { ClubName, HBar, How, Legend, PrismDetail, prismSentence, useTip } from '../charts'
import { FAM_ORDER, Seg, type P } from './common'

export function DtVsPlantilla({ art, glob }: P) {
  const [fam, setFam] = useState('todas')
  const rows = art.atribucion.filter((a: Any) => !a.kpi.startsWith('arq_'))
  const byFam = FAM_ORDER.map(f => [f, rows.filter((r: Any) => glob.kpis[r.kpi].familia === f)] as [string, Any[]])
  const hu = Object.fromEntries(art.huella.map((h: Any) => [h.kpi, h]))
  const id = art.identificabilidad
  const vm = glob.varianza_media
  return (
    <div>
      <h3 className="h2">De dónde sale cada rasgo</h3>
      <p className="lede">Cada fila es un indicador de estilo. «En sus partidos» es lo que se observa, en σ respecto a la liga (0 = promedio). Las columnas siguientes reparten ese valor entre el entrenador, la plantilla, el club, el rival y el contexto: positivo empuja hacia arriba, negativo hacia abajo. Toca una fila para verla explicada.</p>
      <Seg opts={[['todas', 'Todas'], ...FAM_ORDER.map(f => [f, f] as [string, string])]} v={fam} set={setFam} />
      {byFam.filter(([f]) => fam === 'todas' || f === fam).map(([f, rs]) => rs.length ? (
        <div key={f} className="card tbl-wrap" style={{ marginBottom: 14 }}>
          <div className="h3">{f}</div>
          <AttribTable rows={rs} glob={glob} hu={hu} />
        </div>
      ) : null)}
      <How>
        Modelo AKM (Abowd, Kramarz y Margolis, 1999), el que Muehlheusser et al. (2018) usan para separar al DT del club en resultados, aplicado aquí a <i>estilo</i> y ampliado con jugadores en cancha (ridge tipo RAPM).
        Unidad: segmento de ≥5 min sin cambios de jugadores ni de marcador. z = α<sub>DT</sub> + φ<sub>club</sub> + Σβ<sub>jugador</sub>·exposición + γ<sub>rival·temporada</sub> + δ·contexto + ε,
        con penalización ridge por bloque (DT {glob.lambda.coach}, club {glob.lambda.club}, jugadores {glob.lambda.player}). Lo que separa al DT de su plantilla es que los mismos jugadores jueguen con otros DTs, que el DT cambie de club y las rotaciones dentro de su etapa.
      </How>

      <h3 className="h2">¿Qué tan separable es este DT?</h3>
      <div className="grid3">
        <div className="card"><div className="note">Índice de identificabilidad</div><div className="big">{fmt(id.indice, 0)}<span style={{ fontSize: 24 }}>/100</span></div><div className="note">Combina movilidad, conectividad y club compartido.</div></div>
        <div className="card"><div className="note">Clubes dirigidos en la muestra</div><div className="big">{id.movilidad}</div><div className="note">Si dirigió más de uno, su estilo se ve con plantillas distintas.</div></div>
        <div className="card"><div className="note">Conectividad de la plantilla</div><div className="big">{pct(100 * id.conectividad)}</div><div className="note">de sus minutos-jugador son de futbolistas que también sumaron ≥450 min con otro DT.</div></div>
      </div>

      <h3 className="h2">En Liga MX, ¿por qué difieren los estilos?</h3>
      <p className="lede">Parte de la diferencia de estilo entre equipos-temporada que explica cada fuente, en promedio sobre los {Object.keys(glob.kpis).filter(k => !k.startsWith('arq_')).length} indicadores: DT {pct(100 * vm.coach)}, plantilla {pct(100 * vm.player)}, club {pct(100 * vm.club)}, rival {pct(100 * vm.opp)}, contexto {pct(100 * vm.ctx)}.</p>
      <Legend items={[...COMP, { key: 'r', label: 'Sin explicar', color: 'var(--c-resid)' }]} />
      <div className="card">
        {Object.entries(glob.varianza).filter(([k]) => !k.startsWith('arq_')).map(([k, v]: Any) => <ShareBar key={k} label={glob.kpis[k].etiqueta} v={v} />)}
      </div>
      <How title="¿Cómo se lee?">Para cada indicador se promedian observado y componentes por equipo-temporada y se reparte la varianza como cov(componente, observado)/var(observado). Las partes pueden ser negativas cuando dos fuentes se compensan (por ejemplo, un DT ofensivo con una plantilla defensiva).</How>
    </div>
  )
}

const ATT_COLS = [{ key: 'observado', label: 'En sus partidos', color: 'var(--ink)' }, ...COMP]

function AttribTable({ rows, glob, hu }: { rows: Any[]; glob: Any; hu: Any }) {
  const [open, setOpen] = useState<string | null>(null)
  const max = Math.max(1, ...rows.flatMap(r => ATT_COLS.map(c => Math.abs(r[c.key] ?? 0))))
  return (
    <table className="t att">
      <thead><tr><th>Indicador</th>{ATT_COLS.map(c => <th key={c.key}>{c.key !== 'observado' && <i className="sw" style={{ background: c.color }} />}{c.label}</th>)}</tr></thead>
      <tbody>{rows.map(r => (
        <Fragment key={r.kpi}>
          <tr className="att-row" onClick={() => setOpen(o => (o === r.kpi ? null : r.kpi))} aria-expanded={open === r.kpi}>
            <td>{glob.kpis[r.kpi].etiqueta}<div className="note">{fmt(hu[r.kpi]?.crudo)} vs liga {fmt(hu[r.kpi]?.liga)}</div></td>
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
          </tr>
          {open === r.kpi && <tr><td colSpan={ATT_COLS.length + 1} className="att-open"><p className="explain">{prismSentence(r, glob.kpis[r.kpi].etiqueta)}</p><PrismDetail row={r} /></td></tr>}
        </Fragment>
      ))}</tbody>
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
      <h3 className="h2">¿El estilo viaja con el entrenador?</h3>
      <p className="lede">La prueba más directa de que un estilo es del DT y no de su plantilla: esconder al modelo todos los partidos del DT en un club, entrenarlo con el resto de la liga y pedirle que adivine quién dirigió esos partidos. Si lo reconoce con otros jugadores, el estilo viajó con él.</p>
      {mine.length ? (
        <div className="grid2">
          {mine.map((t: Any) => (
            <div key={t.club} className="card">
              <div className="h3 inline-club">Etapa oculta: <ClubName club={t.club} media={media} size={20} /> ({t.partidos} partidos)</div>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', margin: '8px 0 12px' }}>
                <div><div className="note">Puesto con estilo ajustado</div><div className="big">{t.rank_ajustado}<span style={{ fontSize: 22 }}> / {t.n_clases}</span></div></div>
                <div><div className="note">Con estilo crudo</div><div className="big" style={{ color: 'var(--ink-3)' }}>{t.rank_crudo}</div></div>
                <div><div className="note">Azar</div><div className="big" style={{ color: 'var(--ink-3)' }}>{fmt(t.rank_nulo, 0)}</div></div>
              </div>
              <div className="note">A qué DT se parece más esa etapa (estilo ajustado; correlación entre perfiles):</div>
              <HBar items={t.top5_ajustado.map(([n, p]: Any) => ({ label: n === art.nombre ? `✓ ${n}` : n, v: Math.max(0, p) }))} max={1} />
            </div>
          ))}
        </div>
      ) : <div className="card note">Este DT dirigió un solo club con al menos 8 partidos en la muestra, así que no se le puede aplicar la prueba. Abajo están los resultados de toda la liga.</div>}
      <h3 className="h2">Todos los DTs que cambiaron de club</h3>
      {R.ajustado && (
        <div className="grid3" style={{ marginBottom: 16 }}>
          <div className="card"><div className="note">DT verdadero en la mitad superior</div><div className="big">{R.ajustado.mitad_superior}<span style={{ fontSize: 22 }}> / {R.etapas}</span></div><div className="note">azar: {R.etapas / 2} · prueba de signo p = {R.ajustado.p_signo < 0.001 ? '< 0.001' : fmt(R.ajustado.p_signo, 3)} (crudo: {R.crudo.mitad_superior})</div></div>
          <div className="card"><div className="note">DT verdadero en el top 5</div><div className="big">{pct(100 * R.ajustado.top5)}</div><div className="note">azar: {pct(100 * R.azar.top5)} · crudo: {pct(100 * R.crudo.top5)}</div></div>
          <div className="card"><div className="note">Puesto mediano</div><div className="big">{fmt(R.ajustado.mediana, 0)}<span style={{ fontSize: 22 }}> / {all[0]?.n_clases}</span></div><div className="note">azar: {fmt(R.azar.mediana, 0)} · crudo: {fmt(R.crudo.mediana, 0)}</div></div>
        </div>
      )}
      <p className="lede">Lectura honesta: el estilo <b>sí viaja</b>. El DT verdadero aparece muy por encima del azar con plantillas que el modelo nunca vio a su lado. Pero no es una huella dactilar: hay DTs con estilos parecidos y etapas cortas o atípicas. Ajustar por plantilla, club y rival mejora el reconocimiento frente al estilo crudo en {R.ajustado_mejor_que_crudo} de {R.etapas} etapas (empate en {R.ajustado_igual}).</p>
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
      <Legend items={[{ key: 'a', label: 'Ajustado', color: 'var(--c-dt)' }, { key: 'c', label: 'Crudo', color: 'var(--c-plantilla)' }, { key: 'n', label: 'Azar', color: 'var(--c-resid)' }]} />
      <svg viewBox={`0 0 ${W} ${sorted.length * rowH + 24}`} style={{ width: '100%', minWidth: 520 }}>
        {[1, 2, 5, 10, 20, 40].filter(t => t <= K).map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={0} y2={sorted.length * rowH} stroke="var(--rule)" /><text x={x(t)} y={sorted.length * rowH + 16} fontSize={11} textAnchor="middle" fill="var(--ink-3)">{t}</text></g>)}
        {sorted.map((r, i) => {
          const y = i * rowH + rowH / 2
          const hl = r.coach_id === highlight
          return (
            <g key={`${r.coach_id}-${r.club}`} onMouseMove={e => tip.show(e, <><b>{r.dt}</b> en {r.club}<br />ajustado {r.rank_ajustado}º · crudo {r.rank_crudo}º · azar {fmt(r.rank_nulo, 0)}º de {r.n_clases}</>)} onMouseLeave={tip.hide}>
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
      <div className="note">Eje en escala logarítmica: más a la izquierda = mejor identificado.</div>
      {tip.el}
    </div>
  )
}

/* ================================================================ FASES */
