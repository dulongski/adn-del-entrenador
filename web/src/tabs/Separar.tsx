import { Fragment, useState } from 'react'
import { COMP, fmt, pct, shortName, sig, type Any } from '../lib'
import { ClubName, HBar, How, Legend, PrismDetail, prismSentence, useTip } from '../charts'
import { FAM_ORDER, type P } from './common'
import { useDistData } from '../Dist'
import { KpiBell, kFmt, kName } from './resumenKit'
import { LANG, L } from '../settings'
import { famLabel } from '../i18n/data'

/** Ordinal: «3º» en español, «3rd» en inglés. */
const ord = (n: number | string) => {
  if (LANG !== 'en') return `${n}º`
  const v = Math.round(Number(n))
  return `${n}${v % 100 >= 11 && v % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[v % 10] ?? 'th'}`
}
import Info from '../Info'
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
      <h3 className="h2">{L('De dónde sale cada rasgo', 'Where each trait comes from')} <Info wide>{LANG === 'en'
        ? <>Each row is one trait of how his teams play. The first bar is what shows up in his matches compared with the league.
          The rest tell you who drives it: him, his players, the club, the opponents or the context (home/away, scoreline, minute).
          To the right pushes it up, to the left pushes it down. <b>Tap a row</b> to see where he ranks among all coaches.</>
        : <>Cada fila es un rasgo de su forma de jugar. La primera barra es lo que se ve en sus partidos comparado con la liga.
          Las demás dicen quién lo empuja: él, sus jugadores, el club, los rivales o el contexto (localía, marcador, minuto).
          Hacia la derecha lo sube, hacia la izquierda lo baja. <b>Toca una fila</b> para ver dónde queda entre todos los DTs.</>}</Info></h3>
      <div className="att-fams" role="group" aria-label={L('Filtrar por familia', 'Filter by family')}>
        {[['todas', L('Todas', 'All')], ...FAM_ORDER.filter(f => byFam.some(([g, rs]) => g === f && rs.length)).map(f => [f, famLabel(f)])].map(([k, l]) => (
          <button key={k} type="button" aria-pressed={fam === k} onClick={() => setFam(k)}>{l}</button>
        ))}
      </div>
      <Legend items={[{ key: 'obs', label: L('Lo que se ve', 'What we see'), color: 'var(--ink)' }, ...COMP.map(c => ({ ...c, label: WHO[c.key] ?? c.label }))]} />
      {byFam.filter(([f]) => fam === 'todas' || f === fam).map(([f, rs]) => rs.length ? (
        <div key={f} className="card tbl-wrap att-card">
          <div className="att-fam">{famLabel(f)}</div>
          <AttribTable rows={rs} glob={glob} hu={hu} art={art} dd={dd} />
        </div>
      ) : null)}
      {LANG === 'en' ? (
        <How>
          AKM model (Abowd, Kramarz and Margolis, 1999), the one Muehlheusser et al. (2018) use to separate the coach from the club in results, applied here to <i>style</i> and extended with the players on the pitch (RAPM-style ridge).
          Unit: a segment of ≥5 min with no substitutions and no change in the score. z = α<sub>coach</sub> + φ<sub>club</sub> + Σβ<sub>player</sub>·exposure + γ<sub>opponent·season</sub> + δ·context + ε,
          with a ridge penalty per block (coach {glob.lambda.coach}, club {glob.lambda.club}, players {glob.lambda.player}). Bars are in standard deviations across teams (σ).
          What separates a coach from his squad: the same players playing under other coaches, the coach moving clubs, and rotation within his spell.
        </How>
      ) : (
        <How>
          Modelo AKM (Abowd, Kramarz y Margolis, 1999), el que Muehlheusser et al. (2018) usan para separar al DT del club en resultados, aplicado aquí a <i>estilo</i> y ampliado con jugadores en cancha (ridge tipo RAPM).
          Unidad: segmento de ≥5 min sin cambios de jugadores ni de marcador. z = α<sub>DT</sub> + φ<sub>club</sub> + Σβ<sub>jugador</sub>·exposición + γ<sub>rival·temporada</sub> + δ·contexto + ε,
          con penalización ridge por bloque (DT {glob.lambda.coach}, club {glob.lambda.club}, jugadores {glob.lambda.player}). Las barras están en desviaciones estándar entre equipos (σ).
          Lo que separa al DT de su plantilla es que los mismos jugadores jueguen con otros DTs, que el DT cambie de club y las rotaciones dentro de su etapa.
        </How>
      )}

      <h3 className="h2">{L('¿Qué tan bien se le separa de su plantilla?', 'How cleanly can he be separated from his squad?')}</h3>
      <div className="grid3">
        <div className="card"><div className="note">{L('Nota de separación', 'Separation score')} <Info>{L('Sube si dirigió varios clubes y si sus jugadores también jugaron con otros técnicos.', 'Goes up if he coached several clubs and his players also played under other coaches.')}</Info></div><div className="big">{fmt(id.indice, 0)}<span style={{ fontSize: 24 }}>/100</span></div></div>
        <div className="card"><div className="note">{L('Clubes dirigidos', 'Clubs coached')} <Info>{L('Verlo con plantillas distintas ayuda a saber qué es suyo.', 'Seeing him with different squads helps tell what is really his.')}</Info></div><div className="big">{id.movilidad}</div></div>
        <div className="card"><div className="note">{L('Jugadores compartidos', 'Shared players')}</div><div className="big">{pct(100 * id.conectividad)}</div><div className="note">{L('de los minutos de sus jugadores son de futbolistas que también jugaron con otro DT (450 min o más).', 'of his players\' minutes come from players who also played under another coach (450+ min).')}</div></div>
      </div>

      <h3 className="h2">{L('En Liga MX, ¿por qué juegan distinto los equipos?', 'In Liga MX, why do teams play differently?')}</h3>
      {LANG === 'en'
        ? <p className="lede">Compare every team in the league and this is what explains their differences in style, on average:
          the coach {pct(100 * vm.coach)}, the players {pct(100 * vm.player)}, the club {pct(100 * vm.club)}, the opponents {pct(100 * vm.opp)} and the context {pct(100 * vm.ctx)}. The rest can't be pinned on anyone in particular.</p>
        : <p className="lede">Si comparas a todos los equipos de la liga, esto es lo que explica sus diferencias de estilo, en promedio:
          el DT {pct(100 * vm.coach)}, los jugadores {pct(100 * vm.player)}, el club {pct(100 * vm.club)}, los rivales {pct(100 * vm.opp)} y el contexto {pct(100 * vm.ctx)}. El resto no lo explica nadie en particular.</p>}
      <Legend items={[...COMP.map(c => ({ ...c, label: WHO[c.key] ?? c.label })), { key: 'r', label: L('Sin explicar', 'Unexplained'), color: 'var(--c-resid)' }]} />
      <div className="card">
        {Object.entries(glob.varianza).filter(([k]) => !k.startsWith('arq_')).map(([k, v]: Any) => <ShareBar key={k} label={kName(k, glob)} v={v} />)}
      </div>
      <How title={L('¿Cómo se lee?', 'How to read it')}>{L('Para cada indicador se promedian observado y componentes por equipo-temporada y se reparte la varianza como cov(componente, observado)/var(observado). Las partes pueden ser negativas cuando dos fuentes se compensan (por ejemplo, un DT ofensivo con una plantilla defensiva).', 'For each indicator, the observed value and its components are averaged per team-season, and the variance is split as cov(component, observed)/var(observed). Shares can be negative when two sources offset each other (say, an attacking coach with a defensive squad).')}</How>
    </div>
  )
}

const WHO: Record<string, string> = { coach: L('Él (DT)', 'Him (coach)'), player: L('Jugadores', 'Players'), club: 'Club', opp: L('Rivales', 'Opponents'), ctx: L('Contexto', 'Context') }
const ATT_COLS = [{ key: 'observado', label: L('Lo que se ve', 'What we see'), color: 'var(--ink)' }, ...COMP.map(c => ({ ...c, label: WHO[c.key] ?? c.label }))]

function AttribTable({ rows, glob, hu, art, dd }: { rows: Any[]; glob: Any; hu: Any; art: Any; dd: Any }) {
  const [open, setOpen] = useState<string | null>(null)
  const max = Math.max(1, ...rows.flatMap(r => ATT_COLS.map(c => Math.abs(r[c.key] ?? 0))))
  return (
    <table className="t att">
      <thead><tr><th>{L('Rasgo', 'Trait')}</th>{ATT_COLS.map(c => <th key={c.key} className="att-th">{c.key !== 'observado' && <i className="sw" style={{ background: c.color }} />}{c.label}</th>)}<th aria-hidden /></tr></thead>
      <tbody>{rows.map(r => {
        const isOpen = open === r.kpi
        const h = hu[r.kpi]
        return (
          <Fragment key={r.kpi}>
            <tr className={`att-row${isOpen ? ' open' : ''}`} onClick={() => setOpen(isOpen ? null : r.kpi)} aria-expanded={isOpen}
                tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(isOpen ? null : r.kpi))}>
              <td className="att-name">{kName(r.kpi, glob)}<div className="note">{L('sus partidos', 'his matches')} <b>{kFmt(r.kpi, h?.crudo, true)}</b> · {L('liga', 'league')} {kFmt(r.kpi, h?.liga, true)}</div></td>
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
                <p className="explain">{prismSentence(r, kName(r.kpi, glob))}</p>
                <div className="att-open-grid">
                  <div><div className="att-open-h">{L('Entre todos los DTs', 'Among all coaches')}</div><KpiBell k={r.kpi} art={art} glob={glob} dd={dd} color="var(--c-dt)" mode="v" /></div>
                  <div><div className="att-open-h">{L('¿Quién lo empuja?', 'Who drives it?')}</div><PrismDetail row={r} /></div>
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
  const parts = [...COMP.map(c => ({ ...c, x: Math.max(0, v[c.key]) })), { key: 'residual', label: L('Sin explicar', 'Unexplained'), color: 'var(--c-resid)', x: Math.max(0, v.residual) }]
  const tot = parts.reduce((s, p) => s + p.x, 0) || 1
  let acc = 0
  return (
    <div className="prism-row" style={{ gridTemplateColumns: 'minmax(150px,260px) 1fr 64px' }}>
      <span className="prism-label">{label}</span>
      <svg viewBox="0 0 400 16" preserveAspectRatio="none" style={{ width: '100%', height: 16 }}>
        {parts.map(p => { const w = p.x / tot * 400; const x = acc; acc += w; return w > 0.5 ? <rect key={p.key} x={x + 1} y={2} width={Math.max(0, w - 2)} height={12} rx={3} fill={p.color} onMouseMove={e => tip.show(e, <><b>{p.label}</b>: {pct(100 * v[p.key], 1)}</>)} onMouseLeave={tip.hide} /> : null })}
      </svg>
      <span className="prism-val">{L('DT', 'Coach')} {pct(100 * v.coach)}</span>
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
      <h3 className="h2">{L('¿Su estilo viaja con él?', 'Does his style travel with him?')} <Info wide>{L('La prueba más directa de que un estilo es del DT y no de sus jugadores: le escondemos al modelo todos sus partidos en un club, lo entrenamos con el resto de la liga y le pedimos que adivine quién dirigía esos partidos. Si lo reconoce aunque los jugadores sean otros, el estilo es suyo.', "The most direct test that a style belongs to the coach and not his players: we hide all his matches at one club from the model, train it on the rest of the league and ask it to guess who was in charge of those matches. If it picks him out even with different players, the style is his.")}</Info></h3>
      {mine.length ? (
        <div className="grid2" style={mine.length % 2 ? { gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))' } : undefined}>
          {mine.map((t: Any) => (
            <div key={t.club} className="card">
              <div className="h3 inline-club">{L('Partidos escondidos:', 'Hidden matches:')} <ClubName club={t.club} media={media} size={20} /> ({t.partidos})</div>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', margin: '8px 0 12px' }}>
                <div><div className="note">{L('En qué lugar lo puso', 'Where it ranked him')} <Info>{L('1º sería adivinarlo a la primera.', '1st means guessing him on the first try.')}</Info></div><div className="big">{ord(t.rank_ajustado)}<span style={{ fontSize: 22 }}>{L(` de ${t.n_clases}`, ` of ${t.n_clases}`)}</span></div></div>
                <div><div className="note">{L('Sin descontar jugadores', 'Without adjusting for players')}</div><div className="big" style={{ color: 'var(--ink-3)' }}>{ord(t.rank_crudo)}</div></div>
                <div><div className="note">{L('Al azar', 'By chance')}</div><div className="big" style={{ color: 'var(--ink-3)' }}>{ord(fmt(t.rank_nulo, 0))}</div></div>
              </div>
              <div className="note">{L('A qué técnicos se parece más esa etapa:', 'The coaches that spell looks most like:')}</div>
              <HBar items={t.top5_ajustado.map(([n, p]: Any) => ({ label: n === art.nombre ? `✓ ${n}` : n, v: Math.max(0, p) }))} max={1} />
            </div>
          ))}
        </div>
      ) : <div className="card note">{L('Dirigió un solo club (con al menos 8 partidos) en estos datos, así que con él no se puede hacer la prueba. Abajo están los resultados de toda la liga.', 'He coached only one club (with at least 8 matches) in this data, so the test can\'t be run for him. Results for the whole league are below.')}</div>}
      <h3 className="h2">{L('Todos los DTs que cambiaron de club', 'Every coach who changed clubs')}</h3>
      {R.ajustado && (
        <div className="grid3" style={{ marginBottom: 16 }}>
          <div className="card"><div className="note">{L('El DT real queda en la mitad de arriba', 'Real coach ranked in the top half')}</div><div className="big">{R.ajustado.mitad_superior}<span style={{ fontSize: 22 }}>{L(` de ${R.etapas}`, ` of ${R.etapas}`)}</span></div><div className="note">{L(`al azar serían ${R.etapas / 2} · sin descontar jugadores: ${R.crudo.mitad_superior}`, `chance would give ${R.etapas / 2} · without adjusting for players: ${R.crudo.mitad_superior}`)}</div></div>
          <div className="card"><div className="note">{L('El DT real entre los 5 primeros', 'Real coach in the top 5')}</div><div className="big">{pct(100 * R.ajustado.top5)}</div><div className="note">{L('al azar:', 'by chance:')} {pct(100 * R.azar.top5)} · {L('sin descontar jugadores:', 'without adjusting for players:')} {pct(100 * R.crudo.top5)}</div></div>
          <div className="card"><div className="note">{L('Lugar típico del DT real', 'Typical rank of the real coach')}</div><div className="big">{ord(fmt(R.ajustado.mediana, 0))}<span style={{ fontSize: 22 }}>{L(` de ${all[0]?.n_clases}`, ` of ${all[0]?.n_clases}`)}</span></div><div className="note">{L('al azar:', 'by chance:')} {ord(fmt(R.azar.mediana, 0))} · {L('sin descontar jugadores:', 'without adjusting for players:')} {ord(fmt(R.crudo.mediana, 0))}</div></div>
        </div>
      )}
      {LANG === 'en'
        ? <p className="lede">Bottom line: style <b>does travel</b>. The real coach comes out far above chance with players the model never saw him with. It isn't a perfect fingerprint, since some coaches are alike and some spells are short or unusual. Adjusting for players, club and opponent helps pick him out in {R.ajustado_mejor_que_crudo} of {R.etapas} spells (tied in {R.ajustado_igual}).
          {R.ajustado?.p_signo != null && <span className="note"> Sign test: p {R.ajustado.p_signo < 0.001 ? '< 0.001' : `= ${fmt(R.ajustado.p_signo, 3)}`}.</span>}</p>
        : <p className="lede">En resumen, el estilo <b>sí viaja</b>: el DT real sale muy por encima del azar con jugadores que el modelo nunca vio con él. No es una huella perfecta, porque hay técnicos parecidos y etapas cortas o raras. Descontar jugadores, club y rival ayuda a reconocerlo en {R.ajustado_mejor_que_crudo} de {R.etapas} etapas (empate en {R.ajustado_igual}).
          {R.ajustado?.p_signo != null && <span className="note"> Prueba de signo: p {R.ajustado.p_signo < 0.001 ? '< 0.001' : `= ${fmt(R.ajustado.p_signo, 3)}`}.</span>}</p>}
      <RankPlot rows={all} highlight={art.id} />
      {LANG === 'en' ? (
        <How>
          For each hidden spell the whole model is refit without those matches, so no information leaks. The style vector (35 indicators, in σ) is averaged over the spell's matches and correlated with the mean profile of every candidate coach (≥12 matches) across the rest of the league.
          "Raw" is style as observed. "Adjusted" strips out what the model attributes to club, players, opponent and context. With K candidates, chance gives an expected rank of (K+1)/2. The sign test checks how many spells land in the top half.
        </How>
      ) : (
        <How>
          Para cada etapa oculta se reajusta todo el modelo sin esos partidos, para que no haya fuga de información. Se promedia el vector de estilo (35 indicadores, en σ) de los partidos de la etapa y se correlaciona con el perfil medio de cada DT candidato (≥12 partidos) en el resto de la liga.
          «Crudo» es el estilo tal como se observa. «Ajustado» le resta lo que el modelo atribuye a club, jugadores, rival y contexto. Con K candidatos, el azar da un puesto esperado de (K+1)/2. La prueba de signo contrasta cuántas etapas quedan en la mitad superior.
        </How>
      )}
    </div>
  )
}

function RankPlot({ rows, highlight }: { rows: Any[]; highlight: number }) {
  const tip = useTip()
  const sorted = [...rows].sort((a, b) => a.rank_ajustado - b.rank_ajustado)
  const K = Math.max(...rows.map(r => r.n_clases), 10)
  const W = 640, rowH = 22, LX = 230
  const x = (r: number) => LX + (Math.log(r) / Math.log(K)) * (W - LX - 16)
  return (
    <div className="card tbl-wrap">
      <Legend items={[{ key: 'a', label: L('Descontando jugadores, club y rival', 'Adjusted for players, club and opponent'), color: 'var(--c-dt)' }, { key: 'c', label: L('Sin descontar', 'Unadjusted'), color: 'var(--c-plantilla)' }, { key: 'n', label: L('Al azar', 'By chance'), color: 'var(--c-resid)' }]}
        extra={<Info>{L('Más a la izquierda = lo reconoce antes (1º = a la primera). Eje en escala logarítmica.', 'Further left = recognized sooner (1st = first guess). Log-scale axis.')}</Info>} />
      <svg viewBox={`0 0 ${W} ${sorted.length * rowH + 24}`} style={{ width: '100%', minWidth: 520, maxWidth: 820, display: 'block' }}>
        {[1, 2, 5, 10, 20, 40].filter(t => t <= K).map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={0} y2={sorted.length * rowH} stroke="var(--rule)" /><text x={x(t)} y={sorted.length * rowH + 16} fontSize={11} textAnchor="middle" fill="var(--ink-3)">{t}</text></g>)}
        {sorted.map((r, i) => {
          const y = i * rowH + rowH / 2
          const hl = r.coach_id === highlight
          return (
            <g key={`${r.coach_id}-${r.club}`} onMouseMove={e => tip.show(e, LANG === 'en'
              ? <><b>{r.dt}</b> at {r.club}<br />adjusted {ord(r.rank_ajustado)} · unadjusted {ord(r.rank_crudo)} · by chance {ord(fmt(r.rank_nulo, 0))} of {r.n_clases}</>
              : <><b>{r.dt}</b> en {r.club}<br />descontando {r.rank_ajustado}º · sin descontar {r.rank_crudo}º · al azar {fmt(r.rank_nulo, 0)}º de {r.n_clases}</>)} onMouseLeave={tip.hide}>
              <rect x={0} y={y - rowH / 2} width={W} height={rowH} fill={hl ? 'var(--surface-2)' : 'transparent'} />
              <text x={LX - 8} y={y + 4} fontSize={12} textAnchor="end" fill="var(--ink)" fontWeight={hl ? 700 : 400}>{shortName(r.dt)} · {r.club}</text>
              <line x1={x(r.rank_ajustado)} x2={x(r.rank_crudo)} y1={y} y2={y} stroke="var(--ink-3)" strokeWidth={1} />
              <circle cx={x(r.rank_nulo)} cy={y} r={4} fill="var(--c-resid)" />
              <circle cx={x(r.rank_crudo)} cy={y} r={5} fill="var(--c-plantilla)" stroke="var(--surface)" strokeWidth={2} />
              <circle cx={x(r.rank_ajustado)} cy={y} r={5} fill="var(--c-dt)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )
        })}
      </svg>
      {tip.el}
    </div>
  )
}

/* ================================================================ FASES */
