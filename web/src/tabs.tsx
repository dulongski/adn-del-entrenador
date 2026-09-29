import { Fragment, useEffect, useMemo, useState } from 'react'
import { clubColor, COMP, dataUrl, fmt, getJSON, jugadorCorto, matchColors, pct, shortName, sig, simulateMatch, type Any } from './lib'
import MatchSim from './MatchSim'
import Corners3D from './Corners3D'
import { ClubName, DotCI, HBar, HeatGrid, How, Legend, MiniLines, Pitch, pitchXY, PosTag, PrismDetail, prismSentence, useTip } from './charts'

type P = { art: Any; glob: Any; media?: Any }
const FAM_ORDER = ['Construcción', 'Progresión', 'Ocasiones', 'Presión', 'Organización defensiva', 'Transiciones', 'Dominio', 'Balón parado']
const KEY = ['posesion', 'verticalidad', 'ppda', 'altura_presion', 'linea_360', 'contraataque', 'xg_90', 'xg_contra_90', 'pase_largo', 'field_tilt']

const Seg = ({ opts, v, set }: { opts: [string, string][]; v: string; set: (s: string) => void }) => (
  <div className="seg" role="group">{opts.map(([k, l]) => <button key={k} aria-pressed={v === k} onClick={() => set(k)}>{l}</button>)}</div>
)

/* ================================================================ RESUMEN */
export function Resumen({ art, glob, go }: P & { go: (t: Any) => void }) {
  const N = art.narrativa
  const att = Object.fromEntries(art.atribucion.map((a: Any) => [a.kpi, a]))
  const tr = art.transferencia as Any[]
  const best = tr.length ? tr.reduce((a, b) => (a.rank_ajustado <= b.rank_ajustado ? a : b)) : null
  const S = art.simulacion
  return (
    <div>
      <div className="facts">
        <div><span className="note">Partidos analizados</span><b>{art.partidos_total}</b></div>
        <div><span className="note">Identificabilidad DT/plantilla</span><b>{fmt(art.identificabilidad.indice, 0)}<small>/100</small></b></div>
        <div><span className="note">Prueba de transferencia</span><b>{best ? <>{best.rank_ajustado}º<small> de {best.n_clases} en {best.club}</small></> : <small>no aplica (1 club)</small>}</b></div>
        <div><span className="note">Reconocible en un partido</span><b>{art.identidad?.lift ? <>{fmt(art.identidad.lift)}×<small> el azar</small></> : '—'}</b></div>
        <div><span className="note">Puntos vs esperados</span><b>{S.puntos}<small> vs {fmt(S.xpts, 0)} xPts</small></b></div>
      </div>
      <p className="eyebrow">Titular</p>
      <h3 className="h2" style={{ fontSize: 34, marginTop: 4 }}>{N.titular.split(': ').slice(1).join(': ') || N.titular}</h3>
      <p className="lede">Cada idea sale del <b>efecto propio del entrenador</b>: lo que queda del estilo después de descontar a sus jugadores, su club, el rival y el contexto. En cada tarjeta, la primera barra (negra) es lo que se ve en sus partidos comparado con la liga. Las de color muestran quién empuja ese valor hacia arriba o hacia abajo, y su suma más un pequeño residuo da la barra negra. El título describe <b>solo al DT</b> (barra azul).</p>
      <div className="principles">
        {N.principios.map((p: Any) => (
          <article key={p.titulo} className="principle">
            <h4>{p.titulo}</h4>
            <p>{p.descripcion}</p>
            {att[p.kpi] && <PrismDetail row={att[p.kpi]} />}
            {att[p.kpi] && <p className="explain">{prismSentence(att[p.kpi], glob.kpis[p.kpi].etiqueta)}</p>}
            <p className="ev">{p.evidencia}</p>
          </article>
        ))}
        {!N.principios.length && <p className="note">Ningún rasgo supera el umbral de señal (|efecto| ≥ 1.5 veces su error). El estilo de este DT no se distingue con claridad del de su plantilla.</p>}
      </div>
      <h3 className="h2" style={{ marginTop: 36 }}>La historia en {N.secciones.length} claves</h3>
      <div className="chapters">
        {N.secciones.map((sec: Any) => <Chapter key={sec.id} sec={sec} go={go} />)}
      </div>
      <p className="note">Para ver de dónde sale cada rasgo, abre <button className="btn ghost" style={{ padding: '2px 8px' }} onClick={() => go('dt')}>DT vs Plantilla</button>. Todos los números vienen de {glob.muestra.partidos.toLocaleString('es-MX')} partidos de Liga MX y un solo modelo.</p>
    </div>
  )
}

const SEC_TAB: Record<string, [string, string]> = {
  identidad: ['dt', 'DT vs Plantilla'], ofensiva: ['fases', 'Estilo'], defensiva: ['fases', 'Estilo'],
  dt_vs_plantilla: ['transfer', 'Prueba de transferencia'], contexto: ['contexto', 'Contexto'], jugadores: ['jugadores', 'Jugadores'],
  balon_parado: ['bp', 'Balón parado'], simulacion: ['sim', 'Simulador'],
}

function EffectChip({ v }: { v: number }) {
  const strong = Math.abs(v) >= 0.3
  return <span className={`fx ${v >= 0 ? 'fx-up' : 'fx-down'}${strong ? '' : ' fx-weak'}`} title="Efecto propio del DT, en σ entre equipos. La flecha indica dirección (sube/baja el indicador), no si es bueno o malo.">{v >= 0 ? '▲' : '▼'} {sig(v)}</span>
}

function Chapter({ sec, go }: { sec: Any; go: (t: Any) => void }) {
  const puntos: Any[] = sec.puntos || []
  const link = SEC_TAB[sec.id]
  return (
    <article className="chapter">
      <div className="eyebrow">{sec.titulo}</div>
      {sec.idea && <p className="chapter-idea">{sec.idea}</p>}
      {puntos.length > 0 && (
        <ul className="pts">
          {puntos.map((p, i) => (
            <li key={i}>
              <span className="pt-txt">{p.texto}{p.nota && <span className={`pt-nota${/plantilla/.test(p.nota) ? ' squad' : ''}`}>{p.nota}</span>}</span>
              <span className="pt-dato">{p.dato && <b>{p.dato}</b>}{p.liga && <span className="note"> {p.liga}</span>}</span>
              <span className="pt-fx">{typeof p.efecto === 'number' && <EffectChip v={p.efecto} />}</span>
            </li>
          ))}
        </ul>
      )}
      {!puntos.length && sec.parrafos.slice(0, 2).map((t: string, i: number) => <p key={i} className="chapter-p">{t}</p>)}
      <div className="chapter-foot">
        {puntos.length > 0 && <details className="how"><summary>Leer el texto completo</summary><div>{sec.parrafos.map((t: string, i: number) => <p key={i}>{t}</p>)}</div></details>}
        {link && <button className="linkbtn" onClick={() => { go(link[0]); window.scrollTo({ top: 0 }) }}>Ver en {link[1]} →</button>}
      </div>
    </article>
  )
}

/* ================================================================ DT vs PLANTILLA */
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
export function Fases({ art, glob, media }: P) {
  const tc = clubColor(media?.dts?.[art.id]?.club ?? art.etapas?.at(-1)?.club, media)
  const [map, setMap] = useState('presion')
  const [mode, setMode] = useState<'div' | 'seq'>('div')
  const hu = art.huella.filter((h: Any) => !h.kpi.startsWith('arq_'))
  const M = art.mapas
  const mapLabels: Record<string, string> = { presion: 'Presiones', recuperaciones: 'Recuperaciones', progresion: 'Destino de acciones progresivas' }
  return (
    <div>
      <h3 className="h2">Jugadas tipo</h3>
      <p className="lede">Cada posesión en juego se clasifica en uno de 8 arquetipos (mezcla gaussiana sobre inicio, avance, duración, pases, verticalidad y peligro). Barra: % de sus posesiones; línea negra: promedio de la liga. Elige una jugada para ver ejemplos reales.</p>
      <Archetypes art={art} />

      <h3 className="h2">Dónde ocurre</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Seg opts={[['presion', 'Presión'], ['recuperaciones', 'Recuperaciones'], ['progresion', 'Progresión']]} v={map} set={setMap} />
        <Seg opts={[['div', 'Diferencia vs liga'], ['seq', 'Volumen del DT']]} v={mode} set={s => setMode(s as Any)} />
      </div>
      <div className="grid3">
        <div className="card">
          <div className="h3">{mapLabels[map]} por partido</div>
          <HeatGrid grid={mode === 'div' ? M[map].dif : M[map].dt} mode={mode} label={mapLabels[map]} unit={mode === 'div' ? 'vs liga, por partido' : 'por partido'} color={tc} vertical />
          <div className="note">Su equipo ataca siempre hacia arriba. Crudo: incluye el efecto de la plantilla.</div>
        </div>
        <div className="card">
          <div className="h3">Red de pases (11 con más minutos)</div>
          <PassNet net={M.red_pases} art={art} color={tc} />
        </div>
        <div className="card"><div className="h3">Tiros ({M.tiros.length})</div><ShotMap shots={M.tiros} color={tc} /></div>
      </div>

      <h3 className="h2">Huella de estilo</h3>
      <p className="lede">Efecto propio del DT en cada indicador, ya descontados plantilla, club, rival y contexto. El punto relleno indica que el efecto supera dos veces su error (bootstrap por partido); la barra es el intervalo del 95%.</p>
      <div className="grid2">
        {FAM_ORDER.map(f => {
          const rs = hu.filter((h: Any) => h.familia === f)
          return rs.length ? (
            <div key={f} className="card">
              <div className="h3">{f}</div>
              {rs.map((h: Any) => (
                <div key={h.kpi} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) 1.3fr 90px', gap: 10, alignItems: 'center', padding: '3px 0' }}>
                  <span style={{ fontSize: 13, lineHeight: 1.2 }} title={glob.kpis[h.kpi].descripcion}>{h.etiqueta}</span>
                  <DotCI v={h.alpha} se={h.se} pctl={h.pct} />
                  <span className="mono" style={{ fontSize: 12, textAlign: 'right' }}>{fmt(h.crudo)} <span style={{ color: 'var(--ink-3)' }}>/ {fmt(h.liga)}</span></span>
                </div>
              ))}
              <div className="note" style={{ marginTop: 4 }}>Eje: −2.5σ … +2.5σ · derecha: DT / liga (crudo)</div>
            </div>
          ) : null
        })}
      </div>
    </div>
  )
}

/** Etiqueta mínima para la red de pases: apodo de una palabra o apellido (con partículas: «de la Rosa»). */
function apellidoCorto(n: string) {
  const t = n.trim().split(/\s+/)
  if (t.length <= 1) return n
  let i = t.length - 1
  while (i > 1 && /^(de|del|la|las|los|da|do|dos|van|von|di)$/i.test(t[i - 1])) i--
  return t.slice(i).join(' ')
}

function PassNet({ net, art, color }: { net: Any; art: Any; color: string }) {
  const tip = useTip()
  // un solo portero: el de más minutos (la red usa los 11 con más minutos y a veces entran dos)
  const linea = Object.fromEntries((art.jugadores?.jugadores || []).map((j: Any) => [j.player_id, j.linea]))
  const gks = net.nodos.filter((n: Any) => linea[n.id] === 0).sort((a: Any, b: Any) => b.minutos - a.minutos)
  const drop = new Set(gks.slice(1).map((n: Any) => n.id))
  const nodos = net.nodos.filter((n: Any) => !drop.has(n.id))
  const aristas = net.aristas.filter((e: Any) => !drop.has(e.a) && !drop.has(e.b))
  const byId = Object.fromEntries(nodos.map((n: Any) => [n.id, n]))
  const maxE = Math.max(...aristas.map((e: Any) => e.n), 1)
  const maxP = Math.max(...nodos.map((n: Any) => n.pases), 1)
  // etiquetas: ancho real del texto (canvas) y la primera posición libre alrededor del nodo
  // (abajo, arriba, derecha, izquierda, diagonales); si ninguna está libre, abajo con línea guía
  const FS = 2.7
  const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
  if (ctx) ctx.font = '600 100px "Source Sans 3", system-ui, sans-serif'
  const textW = (t: string) => (ctx ? ctx.measureText(t).width / 100 * FS : t.length * FS * 0.55)
  type Box = { x0: number; y0: number; x1: number; y1: number }
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
  const nodeBoxes: Box[] = nodos.map((n: Any) => { const [x, y] = pitchXY(n.x, n.y, true); const r = 1.8 + 2.2 * n.pases / maxP; return { x0: x - r, y0: y - r, x1: x + r, y1: y + r } })
  const placed: Box[] = []
  const labels: { id: number; x: number; y: number; t: string; lx?: number; ly?: number; anchor: 'middle' | 'start' | 'end' }[] = []
  ;[...nodos].sort((a: Any, b: Any) => b.pases - a.pases).forEach((n: Any) => {
    const [cx, cy] = pitchXY(n.x, n.y, true)
    const r = 1.8 + 2.2 * n.pases / maxP
    const t = apellidoCorto(jugadorCorto(n.id, n.nombre))
    const w = textW(t), h = FS * 1.05
    const cands: [number, number, 'middle' | 'start' | 'end'][] = [
      [cx, cy + r + h * 0.95, 'middle'], [cx, cy - r - 0.6, 'middle'], [cx + r + 0.8, cy + h * 0.35, 'start'], [cx - r - 0.8, cy + h * 0.35, 'end'],
      [cx + r * 0.7, cy + r + h * 0.95, 'start'], [cx - r * 0.7, cy + r + h * 0.95, 'end'], [cx + r * 0.7, cy - r - 0.6, 'start'], [cx - r * 0.7, cy - r - 0.6, 'end'],
    ]
    const boxOf = ([x, y, an]: [number, number, 'middle' | 'start' | 'end']): Box => {
      const x0 = an === 'middle' ? x - w / 2 : an === 'start' ? x : x - w
      return { x0: x0 - 0.3, y0: y - h * 0.8, x1: x0 + w + 0.3, y1: y + h * 0.25 }
    }
    const inside = (b: Box) => b.x0 >= -1 && b.x1 <= 81 && b.y0 >= -1 && b.y1 <= 121
    let pick = cands.find(c => { const b = boxOf(c); return inside(b) && !placed.some(o => hit(o, b)) && !nodeBoxes.some(o => hit(o, b)) })
    let lead = false
    if (!pick) { // bajar hasta encontrar hueco, con línea guía al nodo
      let yy = cy + r + h
      while (yy < 118 && placed.some(o => hit(o, boxOf([cx, yy, 'middle'])))) yy += h * 1.05
      pick = [cx, yy, 'middle']; lead = true
    }
    placed.push(boxOf(pick))
    labels.push({ id: n.id, x: pick[0], y: pick[1], t, anchor: pick[2], ...(lead ? { lx: cx, ly: cy + r } : {}) })
  })
  return (
    <>
      <Pitch vertical labels={labels.map(l => <g key={l.id} pointerEvents="none">
        {l.lx != null && <line x1={l.lx} y1={l.ly} x2={l.x} y2={l.y - FS * 0.8} stroke="var(--ink-3)" strokeWidth={0.2} />}
        <text x={l.x} y={l.y} fontSize={FS} fontWeight={600} textAnchor={l.anchor} fill="var(--ink)" style={{ paintOrder: 'stroke', stroke: 'var(--pitch)', strokeWidth: 0.7 }}>{l.t}</text>
      </g>)}>
        {aristas.map((e: Any, i: number) => byId[e.a] && byId[e.b] ? (
          <line key={i} x1={byId[e.a].x} y1={byId[e.a].y} x2={byId[e.b].x} y2={byId[e.b].y} stroke={color} strokeOpacity={0.3 + 0.6 * e.n / maxE} strokeWidth={0.3 + 1.6 * e.n / maxE} strokeLinecap="round" />
        ) : null)}
        {nodos.map((n: Any) => (
          <circle key={n.id} cx={n.x} cy={n.y} r={1.8 + 2.2 * n.pases / maxP} fill={color} stroke="var(--surface)" strokeWidth={0.6}
            onMouseMove={e => tip.show(e, <><b>{n.nombre}</b><br />{fmt(n.pases)} pases completados / 90 · {fmt(n.minutos, 0)} min</>)} onMouseLeave={tip.hide} />
        ))}
      </Pitch>
      <div className="note">Ataca hacia arriba. Nodo: posición media de sus pases (tamaño = pases por 90); grosor: pases entre la pareja por partido (≥1).</div>
      {tip.el}
    </>
  )
}

function ShotMap({ shots, color }: { shots: number[][]; color: string }) {
  const tip = useTip()
  return (
    <>
      <Pitch half vertical>
        {shots.map(([x, y, xg, g], i) => (
          <circle key={i} cx={x} cy={y} r={0.35 + 1.9 * Math.sqrt(xg)} fill={g ? color : 'none'} stroke={color} strokeWidth={0.22} opacity={g ? 0.95 : 0.55}
            onMouseMove={e => tip.show(e, <>xG {fmt(xg, 2)}{g ? ' · gol' : ''}</>)} onMouseLeave={tip.hide} />
        ))}
      </Pitch>
      <div className="note">Tamaño ∝ xG · relleno = gol.</div>
      {tip.el}
    </>
  )
}

function Archetypes({ art }: { art: Any }) {
  const arqs = [...art.arquetipos].sort((a: Any, b: Any) => (b.dt_pct ?? 0) - (a.dt_pct ?? 0))
  const [sel, setSel] = useState<number>(arqs[0]?.id)
  const [k, setK] = useState(0)
  const ex: Any[] = art.arquetipos_ejemplos[sel] || []
  const cur = arqs.find((a: Any) => a.id === sel)
  const max = Math.max(...arqs.map((a: Any) => Math.max(a.dt_pct ?? 0, a.liga_pct ?? 0)), 1)
  const pick = (id: number) => { setSel(id); setK(0) }
  const seq: Any[] = ex[k] || []
  return (
    <div className="arq">
      <div className="card arq-list">
        {arqs.map((a: Any) => (
          <button key={a.id} className="arq-row" aria-pressed={a.id === sel} onClick={() => pick(a.id)}>
            <span className="arq-name">{a.nombre}</span>
            <span className="arq-bar"><span style={{ width: `${(a.dt_pct ?? 0) / max * 100}%` }} /><i style={{ left: `${(a.liga_pct ?? 0) / max * 100}%` }} /></span>
            <span className="mono arq-val">{fmt(a.dt_pct)}%</span>
          </button>
        ))}
        <div className="note" style={{ marginTop: 6 }}>Barra azul: sus partidos · línea negra: liga</div>
      </div>
      <div className="card arq-ex">
        <div className="arq-head">
          <div>
            <div className="h3" style={{ margin: 0 }}>{cur?.nombre}</div>
            <div className="note">{fmt(cur?.dt_pct)}% de sus posesiones (liga {fmt(cur?.liga_pct)}%) · efecto DT {sig(cur?.alpha)}</div>
          </div>
          {ex.length > 0 && (
            <div className="carousel">
              <button onClick={() => setK((k - 1 + ex.length) % ex.length)} aria-label="Ejemplo anterior">‹</button>
              <span className="mono">{k + 1} / {ex.length}</span>
              <button onClick={() => setK((k + 1) % ex.length)} aria-label="Ejemplo siguiente">›</button>
            </div>
          )}
        </div>
        <Pitch>
          <defs><marker id="ar" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6z" fill="var(--c-dt)" /></marker></defs>
          {seq.map(([t, x, y, ex_, ey]: Any, i: number) => ex_ == null ? (t === 'Shot' ? <circle key={i} cx={x} cy={y} r={1.6} fill="var(--c-plantilla)" /> : null) : (
            <g key={i}>
              <line x1={x} y1={y} x2={ex_} y2={ey} stroke="var(--c-dt)" strokeWidth={t === 'Carry' ? 0.55 : 0.9}
                strokeDasharray={t === 'Carry' ? '1.4 1' : undefined} markerEnd={t === 'Shot' ? undefined : 'url(#ar)'} />
              {i === 0 && <circle cx={x} cy={y} r={1.3} fill="var(--c-dt)" />}
              {t === 'Shot' && <circle cx={x} cy={y} r={1.6} fill="var(--c-plantilla)" />}
            </g>
          ))}
        </Pitch>
        <div className="note">{ex.length ? <>Posesión real de mayor OBV del arquetipo. Punto azul = inicio; línea continua = pase; discontinua = conducción; punto naranja = tiro. Ataque hacia la derecha.</> : 'Sin ejemplos para este arquetipo.'}</div>
      </div>
    </div>
  )
}

/* ================================================================ CONTEXTO */
export function Contexto({ art, glob }: P) {
  const [dim, setDim] = useState('marcador')
  const C = art.contexto
  const [k, setK] = useState('posesion')
  const evo: Any[] = C.evolucion
  return (
    <div>
      <h3 className="h2">Cómo se adapta</h3>
      <p className="lede">Estilo ajustado (sin plantilla, club ni rival) del DT según la situación del partido, frente a la liga en la misma situación. Si su línea se separa de la de la liga, ese ajuste es suyo.</p>
      <Seg opts={[['marcador', 'Marcador'], ['minuto', 'Minuto'], ['localia', 'Localía'], ['rival', 'Fuerza del rival']]} v={dim} set={setDim} />
      <Legend items={[{ key: 'd', label: art.nombre.split(' ')[0] + ' ' + (art.nombre.split(' ').slice(-2, -1)[0] || ''), color: 'var(--c-dt)' }, { key: 'l', label: 'Liga', color: 'var(--ink-3)' }]} />
      <div className="grid3">
        {KEY.map(kk => C.curvas[dim]?.[kk] ? (
          <div key={kk} className="card">
            <div className="h3">{glob.kpis[kk].etiqueta}</div>
            <MiniLines rows={C.curvas[dim][kk]} xKey="nivel" series={[{ key: 'dt', label: 'DT', color: 'var(--c-dt)' }, { key: 'liga', label: 'Liga', color: 'var(--ink-3)', dash: '4 3' }]} />
          </div>
        ) : null)}
      </div>

      <h3 className="h2">Qué le hace cambiar de un partido a otro</h3>
      <p className="lede">Modelo de gradient boosting con SHAP entrenado sobre sus partidos: cuánto pesan la localía, la fuerza del rival, el marcador y el <b>estilo del rival</b> (su efecto DT en presión, posesión y verticalidad).</p>
      <Seg opts={KEY.filter(x => C.motores?.[x]).slice(0, 8).map(x => [x, glob.kpis[x].etiqueta] as [string, string])} v={k} set={setK} />
      {C.motores?.[k] ? <Drivers rows={C.motores[k]} /> : <div className="note">Hacen falta al menos 15 partidos.</div>}

      <h3 className="h2">Evolución en el tiempo</h3>
      <Seg opts={KEY.slice(0, 6).map(x => [x, glob.kpis[x].etiqueta] as [string, string])} v={k} set={setK} />
      <Evolution rows={evo} k={k} />
    </div>
  )
}

const VAR_ES: Record<string, string> = { local: 'Juega de local', fuerza_rival: 'Fuerza del rival', dif_goles_media: 'Diferencia de goles', rival_presion: 'Presión del rival', rival_posesion: 'Posesión del rival', rival_verticalidad: 'Verticalidad del rival' }
function Drivers({ rows }: { rows: Any[] }) {
  const max = Math.max(...rows.map(r => r.importancia), 1e-6)
  return (
    <div className="card">
      {rows.map(r => (
        <div key={r.variable} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 190px', gap: 10, alignItems: 'center', margin: '6px 0' }}>
          <span style={{ fontSize: 14 }}>{VAR_ES[r.variable] || r.variable}</span>
          <svg viewBox="0 0 200 12" preserveAspectRatio="none" style={{ width: '100%', height: 12 }}><rect x={0} y={1} width={r.importancia / max * 200} height={10} rx={3} fill="var(--c-dt)" /></svg>
          <span className="note">{Math.abs(r.direccion) < 0.2 ? 'efecto no lineal / débil' : r.direccion > 0 ? 'cuanto más, más sube' : 'cuanto más, más baja'} · |SHAP| {fmt(r.importancia, 2)}σ</span>
        </div>
      ))}
    </div>
  )
}

function Evolution({ rows, k }: { rows: Any[]; k: string }) {
  const tip = useTip()
  if (!rows?.length) return null
  const W = 900, H = 200, P = { l: 40, r: 10, t: 10, b: 24 }
  const vals = rows.flatMap(r => [r[k], r[`${k}_movil`]]).filter(v => v != null)
  const lo = Math.min(-1, ...vals), hi = Math.max(1, ...vals)
  const x = (i: number) => P.l + i / Math.max(rows.length - 1, 1) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b)
  const clubChanges = rows.map((r, i) => (i > 0 && r.club_id !== rows[i - 1].club_id ? i : null)).filter(v => v !== null) as number[]
  return (
    <div className="card tbl-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 560 }}>
        <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="var(--ink-3)" strokeDasharray="2 3" />
        <text x={P.l - 6} y={y(0) + 4} fontSize={11} textAnchor="end" fill="var(--ink-3)">liga</text>
        {clubChanges.map(i => <g key={i}><line x1={x(i)} x2={x(i)} y1={P.t} y2={H - P.b} stroke="var(--ink)" strokeDasharray="4 3" /><text x={x(i) + 4} y={P.t + 10} fontSize={11} fill="var(--ink)">cambio de club</text></g>)}
        {rows.map((r, i) => <circle key={i} cx={x(i)} cy={y(r[k])} r={3} fill="var(--c-dt)" opacity={0.35} onMouseMove={e => tip.show(e, <>{r.date}<br />ajustado {sig(r[k])} · crudo {sig(r[`${k}_crudo`])}</>)} onMouseLeave={tip.hide} />)}
        <polyline points={rows.map((r, i) => `${x(i)},${y(r[`${k}_movil`])}`).join(' ')} fill="none" stroke="var(--c-dt)" strokeWidth={2.5} strokeLinejoin="round" />
        <text x={P.l} y={H - 6} fontSize={11} fill="var(--ink-3)">{rows[0].date}</text>
        <text x={W - P.r} y={H - 6} fontSize={11} textAnchor="end" fill="var(--ink-3)">{rows.at(-1).date}</text>
      </svg>
      <div className="note">Puntos: cada partido (ajustado). Línea: media móvil de 5 partidos.</div>
      {tip.el}
    </div>
  )
}

/* ================================================================ JUGADORES */
export function Jugadores({ art, glob }: P) {
  const J = art.jugadores
  const forms = Object.entries(J.formaciones as Record<string, number>).sort((a, b) => b[1] - a[1])
  const totF = forms.reduce((s, [, v]) => s + v, 0)
  const mc = J.minuto_cambios, ml = J.minuto_cambios_liga
  return (
    <div>
      <div className="grid3">
        <div className="card"><div className="note">Dibujo más usado</div><div className="big">{forms[0]?.[0].split('').join('-')}</div><div className="note">{pct(100 * (forms[0]?.[1] ?? 0) / totF)} de los partidos · {forms.slice(1, 4).map(([f, v]) => `${f.split('').join('-')} ${pct(100 * v / totF)}`).join(' · ')}</div></div>
        <div className="card"><div className="note">Rotación</div><div className="big">{fmt(J.estabilidad_xi)}</div><div className="note">titulares distintos entre partidos consecutivos</div></div>
        <div className="card"><div className="note">Cambios tácticos por partido</div><div className="big">{fmt(J.cambios_tacticos_por_partido)}</div><div className="note">cambios de dibujo registrados (Tactical Shift)</div></div>
      </div>
      <div className="grid2" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="h3">Minuto mediano de cada cambio</div>
          <HBar items={Object.keys(mc).map(n => ({ label: `${n}º cambio`, v: mc[n], ref: ml[n] }))} max={95} unit="'" compare="mediana de la liga" />
        </div>
        <div className="card">
          <div className="h3">Tipo de cambio según el marcador</div>
          <table className="t"><thead><tr><th></th><th>Más ofensivo</th><th>Misma línea</th><th>Más defensivo</th></tr></thead>
            <tbody>{Object.entries(J.cambios_por_estado).map(([e, v]: Any) => <tr key={e}><td>{e}</td>{['Más ofensivo', 'Misma línea', 'Más defensivo'].map(t => <td key={t} className="num">{v[t]}</td>)}</tr>)}</tbody></table>
        </div>
      </div>
      {art.impacto_cambios?.length ? (
        <>
          <h3 className="h2">Qué cambia cuando mete un cambio</h3>
          <p className="lede">Variación del estilo del segmento anterior al posterior de cada sustitución, menos la variación típica de la liga tras un cambio ({art.impacto_cambios[0].n} cambios).</p>
          <div className="card">
            {art.impacto_cambios.map((r: Any) => (
              <div key={r.kpi} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,240px) 1fr 70px', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>{glob.kpis[r.kpi].etiqueta}</span><DotCI v={r.neto} se={r.se} scale={3} /><span className="mono" style={{ fontSize: 12, textAlign: 'right' }}>{sig(r.neto)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <h3 className="h2">Roles dentro del sistema</h3>
      <p className="lede">Rol espacial por NMF sobre el mapa de calor de acciones (Decroos y Davis, 2019). «Huella» son los tres indicadores de estilo que más mueve el jugador cuando está en cancha (β del modelo, ya descontado el DT).</p>
      <div className="card tbl-wrap">
        <table className="t">
          <thead><tr><th>Jugador</th><th>Posición</th><th>Rol espacial</th><th style={{ textAlign: 'right' }}>Min</th><th style={{ textAlign: 'right' }}>Tit.</th><th>Huella en el estilo</th></tr></thead>
          <tbody>{J.jugadores.slice(0, 30).map((j: Any) => (
            <tr key={j.player_id}><td><b>{jugadorCorto(j.player_id, j.nombre)}</b><div className="note">{j.nombre}</div></td><td className="pos-cell"><PosTag pos={j.posicion} /> <span className="note">{j.posicion}</span></td><td className="note">{j.rol_espacial || '—'}</td><td className="num">{fmt(j.minutos, 0)}</td><td className="num">{j.titularidades}</td>
              <td>{j.huella.map((h: Any) => <span key={h.kpi} className="chip">{glob.kpis[h.kpi].etiqueta} {sig(h.efecto)}</span>)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

/* ================================================================ BALÓN PARADO */
export function BalonParado({ art, media }: { art: Any; media?: Any }) {
  const B = art.balon_parado
  const o = B.ofensivo || {}, d = B.defensivo || {}, l = B.liga || {}
  const rows: [string, string, number | null, number | null, number | null, number?][] = [
    ['Córners por partido', '', o.corners_por_partido, d.corners_por_partido, l.corners_por_partido],
    ['Córner en corto', '%', o.corner_corto_pct, d.corner_corto_pct, l.corner_corto_pct, 0],
    ['Primer contacto propio', '%', o.corner_primer_contacto_pct, d.corner_primer_contacto_pct != null ? 100 - d.corner_primer_contacto_pct : null, l.corner_primer_contacto_pct, 0],
    ['Córners que terminan en remate', '%', o.corner_remate_pct, d.corner_remate_pct, l.corner_remate_pct, 0],
    ['xG por córner', '', o.corner_xg, d.corner_xg, l.corner_xg, 3],
    ['Atacantes en el área (360)', '', o.atacantes_area_360, d.atacantes_area_360, l.atacantes_area_360],
    ['Defensores en el área (360)', '', o.defensores_area_360, d.defensores_area_360, l.defensores_area_360],
    ['Tiros libres en campo rival / partido', '', o.tl_por_partido, d.tl_por_partido, l.tl_por_partido],
    ['xG por tiro libre', '', o.tl_xg, d.tl_xg, l.tl_xg, 3],
    ['Saques de banda en último tercio / partido', '', o.banda_peligrosa_por_partido, d.banda_peligrosa_por_partido, l.banda_peligrosa_por_partido],
    ['xG de balón parado por partido', '', o.xg_total_por_partido, d.xg_total_por_partido, l.xg_total_por_partido, 2],
  ]
  return (
    <div>
      <h3 className="h2">Balón parado</h3>
      <p className="lede">Córners en 3D: cada barra es una zona del área; su <b>altura</b> dice cuántos envíos caen ahí y su <b>color</b>, cuánto xG generan. Los muñecos marcan dónde se paran atacantes y defensores al momento del envío (fotogramas 360). Puedes re-jugar sus córners reales.</p>
      <Corners3D art={art} media={media} />
      <div className="card tbl-wrap" style={{ marginTop: 20 }}>
        <table className="t"><thead><tr><th>Indicador</th><th style={{ textAlign: 'right' }}>A favor</th><th style={{ textAlign: 'right' }}>En contra</th><th style={{ textAlign: 'right' }}>Liga</th></tr></thead>
          <tbody>{rows.map(([n, u, a, b, c, dd]) => <tr key={n}><td>{n}</td><td className="num">{fmt(a, dd ?? 1)}{u}</td><td className="num">{fmt(b, dd ?? 1)}{u}</td><td className="num">{fmt(c, dd ?? 1)}{u}</td></tr>)}</tbody></table>
        <div className="note">«Primer contacto propio» en contra = % de córners rivales en los que su equipo toca primero. Los goles a favor/en contra son {o.goles ?? 0}/{d.goles ?? 0}.</div>
      </div>
    </div>
  )
}

/* ================================================================ SIMULADOR */
export function Simulador({ art, media }: { art: Any; media?: Any }) {
  const S = art.simulacion
  const ps: Any[] = [...S.partidos].reverse()
  const [mid, setMid] = useState<number>(ps[0]?.match_id)
  const n = 50000  // siempre 50,000 rejugadas
  const [modo, setModo] = useState<'mil' | 'uno'>('mil')
  const [res, setRes] = useState<Any>(null)
  const [err, setErr] = useState<string | null>(null)
  const run = () => {
    setRes(null); setErr(null)
    getJSON(dataUrl(`sim_${art.id}.json`)).then((all: Any) => {
      const data = all[mid]
      const shots: number[][] | undefined = data?.t
      const p = art.partidos.find((x: Any) => x.match_id === mid)
      if (!shots || !p) { setErr('No hay tiros registrados para este partido.'); return }
      // se deja respirar al navegador antes de simular (la interfaz muestra «Rejugando…»)
      setTimeout(() => setRes({ ...simulateMatch(shots, n), partido: p, tiros: shots, data }), 10)
    }).catch(e => setErr(e.message))
  }
  useEffect(run, [mid]) // eslint-disable-line react-hooks/exhaustive-deps
  const pts = useMemo(() => {
    let a = 0, e = 0
    return S.partidos.map((p: Any) => { a += p.puntos; e += p.xpts; return { a, e } })
  }, [S])
  const cols = res ? matchColors(res.partido.club, res.partido.rival, media) : ['var(--c-dt)', 'var(--c-plantilla)']
  const golSim = new Set<number>(res?.golesSim || [])
  return (
    <div>
      <h3 className="h2">Simulador: rejugar cada partido</h3>
      <p className="lede">Cada posesión que terminó en tiro se vuelve gol con probabilidad igual a su xG (máximo un gol por posesión), miles de veces. No predice: muestra si el marcador reflejó lo que pasó en la cancha.</p>
      <Seg opts={[['mil', '50,000 rejugadas'], ['uno', 'Simular uno (animado)']]} v={modo} set={v => setModo(v as 'mil' | 'uno')} />
      <div className="sim-controls">
        <select value={mid} onChange={e => setMid(Number(e.target.value))} aria-label="Partido">
          {ps.map(p => <option key={p.match_id} value={p.match_id}>{p.date} · {p.local ? 'vs' : '@'} {p.rival} · {p.gf}-{p.gc}</option>)}
        </select>
      </div>
      {err && <p className="note">{err}</p>}
      {modo === 'uno' && (res ? <MatchSim key={res.partido.match_id} art={art} media={media} data={res.data} partido={res.partido} /> : <p className="note">Preparando partido…</p>)}
      {modo === 'mil' && <div className="sim-layout2">
        <div className="card">
          {res ? <Pitch>{res.tiros.map(([x, y, xg, own, g]: number[], i: number) => {
            const X = own ? x : 120 - x, Y = own ? y : 80 - y
            const c = own ? cols[0] : cols[1]
            const r = 0.7 + 3 * Math.sqrt(xg)
            return <g key={i}>
              <circle cx={X} cy={Y} r={r} fill={golSim.has(i) ? c : 'none'} stroke={c} strokeWidth={0.35} />
              {g === 1 && <circle cx={X} cy={Y} r={r + 1.1} fill="none" stroke="var(--ink)" strokeWidth={0.45} />}
            </g>
          })}</Pitch> : <Pitch />}
          {res && <Legend items={[{ key: 'a', label: `${res.partido.club} ataca → · xG ${fmt(res.xg, 2)}`, color: cols[0] }, { key: 'b', label: `← ${res.partido.rival} ataca · xG ${fmt(res.xg_rival, 2)}`, color: cols[1] }]} />}
          {res && <div className="note">Tamaño ∝ xG. <b>Relleno</b> = gol en una rejugada que terminó con el marcador más probable ({res.modal[0]}–{res.modal[1]}). <b>Anillo</b> = gol real ({res.partido.gf}–{res.partido.gc}).</div>}
        </div>
        <div className="card sim-box">
          <div className="sim-box-inner">
            {res ? <><SimHeader r={res} media={media} cols={cols} /><SimScoreGrid r={res} /></> : <p className="note">Rejugando…</p>}
          </div>
        </div>
      </div>}

      <h3 className="h2">Toda su etapa: puntos vs puntos esperados</h3>
      <div className="grid3">
        <div className="card"><div className="note">Puntos reales</div><div className="big">{S.puntos}</div></div>
        <div className="card"><div className="note">Puntos esperados (xPts)</div><div className="big">{fmt(S.xpts)}</div><div className="note">{S.puntos >= S.xpts ? 'Sumó más de lo que generó' : 'Sumó menos de lo que generó'} ({sig((S.puntos - S.xpts) / 1).replace('σ', '')} pts)</div></div>
        <div className="card"><div className="note">Dominio medio (cuota de xG)</div><div className="big">{pct(S.dominio_medio)}</div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="h3">Puntos reales vs esperados, acumulados</div>
        <CumPts rows={pts} />
      </div>
    </div>
  )
}

function SimHeader({ r, media, cols }: { r: Any; media?: Any; cols: string[] }) {
  const segs = [[`Gana ${r.partido.club}`, r.victoria, cols[0]], ['Empate', r.empate, 'var(--c-resid)'], [`Gana ${r.partido.rival}`, r.derrota, cols[1]]] as [string, number, string][]
  let acc = 0
  const light = (c: string) => /^#(f|e)/i.test(c)
  return (
    <div className="sim-head">
      <div className="sim-teams">
        <ClubName club={r.partido.club} media={media} size={26} />
        <ClubName club={r.partido.rival} media={media} size={26} />
      </div>
      <div className="sim-scores">
        <div><div className="note">Más probable al rejugar</div><b className="sim-modal">{r.modal[0]}–{r.modal[1]}</b><div className="note">{pct(100 * r.modalP)} de las rejugadas</div></div>
        <div><div className="note">Real</div><b className="sim-real">{r.partido.gf}–{r.partido.gc}</b></div>
      </div>
      <svg viewBox="0 0 400 24" style={{ width: '100%', margin: '12px 0 4px' }} role="img" aria-label={segs.map(([l, v]) => `${l} ${Math.round(v * 100)}%`).join(', ')}>
        {segs.map(([l, v, c]) => { const x = acc; acc += v * 400; return <g key={l}><rect x={x + 1} y={0} width={Math.max(0, v * 400 - 2)} height={22} rx={4} fill={c} />{v > 0.1 && <text x={x + v * 200} y={15} fontSize={12} textAnchor="middle" fill={light(c) ? '#111' : '#fff'} fontWeight={700}>{Math.round(v * 100)}%</text>}</g> })}
      </svg>
      <Legend items={segs.map(([l, , c]) => ({ key: l, label: l, color: c }))} />
      <div className="note">xPts del partido <b>{fmt(r.xpts, 2)}</b> · {r.n.toLocaleString('es-MX')} rejugadas</div>
    </div>
  )
}

function SimScoreGrid({ r }: { r: Any }) {
  const tip = useTip()
  const maxP = Math.max(...r.marcadores.flat())
  return (
    <div className="sim-grid">
      <div className="h3">Marcadores más probables</div>
      <svg viewBox="0 6 230 224" preserveAspectRatio="xMidYMid meet">
        <text x={130} y={12} fontSize={10} textAnchor="middle" fill="var(--ink-3)">goles de {r.partido.rival} →</text>
        <text x={10} y={130} fontSize={10} textAnchor="middle" fill="var(--ink-3)" transform="rotate(-90 10 130)">goles de {r.partido.club} →</text>
        {r.marcadores.map((row: number[], i: number) => row.map((p, j) => {
          const real = i === Math.min(r.partido.gf, 5) && j === Math.min(r.partido.gc, 5)
          const modal = i === r.modal[0] && j === r.modal[1]
          return (
            <g key={`${i}${j}`} onMouseMove={e => tip.show(e, <>{i}{i === 5 ? '+' : ''}–{j}{j === 5 ? '+' : ''}: {pct(100 * p, 1)}{real ? ' · real' : ''}{modal ? ' · más probable' : ''}</>)} onMouseLeave={tip.hide}>
              <rect x={24 + j * 34} y={20 + i * 34} width={32} height={32} rx={3} fill={`color-mix(in oklab, var(--c-dt) ${Math.round(100 * p / maxP)}%, var(--surface-2))`}
                stroke={real ? 'var(--ink)' : modal ? 'var(--ink)' : 'none'} strokeWidth={2} strokeDasharray={modal && !real ? '4 3' : undefined} />
              {p > 0.02 && <text x={40 + j * 34} y={40 + i * 34} fontSize={10} textAnchor="middle" fill={p / maxP > 0.55 ? '#fff' : 'var(--ink)'}>{Math.round(p * 100)}</text>}
            </g>
          )
        }))}
      </svg>
      <div className="note">% de las rejugadas. Recuadro continuo: marcador real · punteado: más probable.</div>
      {tip.el}
    </div>
  )
}

function CumPts({ rows }: { rows: { a: number; e: number }[] }) {
  const W = 900, H = 170, P = { l: 36, r: 60, t: 10, b: 20 }
  const max = Math.max(...rows.map(r => Math.max(r.a, r.e)), 1)
  const x = (i: number) => P.l + i / Math.max(rows.length - 1, 1) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b)
  const last = rows.at(-1)!
  return (
    <div className="tbl-wrap"><svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 520 }}>
      <polyline points={rows.map((r, i) => `${x(i)},${y(r.e)}`).join(' ')} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="5 4" />
      <polyline points={rows.map((r, i) => `${x(i)},${y(r.a)}`).join(' ')} fill="none" stroke="var(--c-dt)" strokeWidth={2.5} />
      <text x={x(rows.length - 1) + 6} y={y(last.a) + 4} fontSize={12} fill="var(--ink)">Reales {last.a}</text>
      <text x={x(rows.length - 1) + 6} y={y(last.e) + 16} fontSize={12} fill="var(--ink-3)">xPts {Math.round(last.e)}</text>
      <text x={P.l} y={H - 4} fontSize={11} fill="var(--ink-3)">partido 1</text>
      <text x={W - P.r} y={H - 4} fontSize={11} textAnchor="end" fill="var(--ink-3)">partido {rows.length}</text>
    </svg></div>
  )
}

/* ================================================================ MÉTODO */
export function Metodo({ glob }: { glob: Any }) {
  const F = glob.framework
  const kp = Object.entries(glob.kpis).filter(([k]) => !k.startsWith('arq_'))
  return (
    <div className="narr">
      <h3 className="h2">Marco analítico</h3>
      <p>Todas las métricas, gráficos y modelos de este laboratorio salen de los mismos objetos y umbrales (config/framework.yaml). Nada se define dos veces.</p>
      <div className="grid2">
        {[
          ['Posesión', `Id de posesión de StatsBomb, cuando el equipo es el poseedor y hace al menos ${F.posesion.min_own_ball_actions} acción con balón (pase, conducción, tiro o regate).`],
          ['Secuencia ofensiva', `Posesión que llega al último tercio (x ≥ ${F.secuencia_ofensiva.min_x}).`],
          ['Transición', `Posesión en juego abierto que empieza tras una posesión rival. Es rápida si llega al último tercio en ≤ ${F.transicion.window_s} s. La transición defensiva es lo mismo, visto desde el rival.`],
          ['Fase de presión', `Cadena de eventos Pressure del mismo equipo separados por ≤ ${F.presion.chain_gap_s} s. Alta: x ≥ ${F.presion.high_min_x}. Contrapresión: presión ≤ ${F.presion.counterpress_window_s} s después de perder el balón.`],
          ['Acción progresiva', `Pase completado o conducción (≥ ${F.pase_progresivo.min_carry_length} yd) que acerca el balón a la portería al menos ${100 * F.pase_progresivo.min_gain_ratio}% y termina en x ≥ ${F.pase_progresivo.min_end_x}.`],
          ['Línea defensiva (360)', `Media de los ${F.bloque_360.n_defenders} jugadores de campo más retrasados que se ven en el freeze-frame, durante la posesión rival (mínimo ${F.bloque_360.min_visible_defenders} visibles).`],
          ['Stint y segmento', `Stint: intervalo sin cambios en los 22 jugadores ni en el marcador. Segmento: stints consecutivos unidos hasta sumar ≥ ${F.stint.min_duration_s / 60} min. Es la unidad del modelo.`],
          ['Balón parado', `Córner, tiro libre en campo rival o saque de banda en el último tercio (x ≥ ${F.balon_parado.throw_in_danger_min_x}). Dura hasta ${F.balon_parado.window_s} s o hasta el fin de la posesión.`],
        ].map(([t, d]) => <div key={t} className="card"><div className="h3">{t}</div><div style={{ fontSize: 14 }}>{d}</div></div>)}
      </div>
      <h3>Indicadores ({kp.length})</h3>
      <p>Cada indicador es num/den sobre contadores por stint y se agrega siempre como Σnum/Σden. Por eso un stint, un partido y una temporada se miden igual.</p>
      <div className="card tbl-wrap"><table className="t"><thead><tr><th>Familia</th><th>Indicador</th><th>Definición</th><th style={{ textAlign: 'right' }}>Media liga</th></tr></thead>
        <tbody>{kp.map(([k, v]: Any) => <tr key={k}><td className="note">{v.familia}</td><td>{v.etiqueta}</td><td style={{ fontSize: 13 }}>{v.descripcion}</td><td className="num">{fmt(v.media)}</td></tr>)}</tbody></table></div>
      <h3>Modelo</h3>
      <p><b>Descomposición de estilo (AKM + RAPM).</b> Para cada indicador estandarizado z (σ entre equipos-temporada): z = α<sub>DT</sub> + φ<sub>club</sub> + Σβ<sub>j</sub>·exposición<sub>j</sub> + γ<sub>rival×temporada</sub> + δ·contexto + ε. Se ajusta por mínimos cuadrados ponderados con ridge por bloque. Muestra: {glob.muestra.partidos.toLocaleString('es-MX')} partidos, {glob.muestra.segmentos.toLocaleString('es-MX')} segmentos-equipo, {glob.muestra.dts} DTs, {glob.muestra.jugadores_modelados} jugadores. La incertidumbre de α sale de un bootstrap por partido.</p>
      <p><b>Validación sintética.</b> En una liga simulada donde cada DT ficha jugadores «a su imagen» (correlación 0.8 entre el estilo del DT y el de sus jugadores), el modelo recupera los efectos DT con correlación 0.95 (RMSE 0.40). El promedio ingenuo por DT tiene RMSE 1.02 (tests/test_decomposition.py).</p>
      <p><b>Prueba de transferencia.</b> Se esconde la etapa de un DT en un club, se reajusta todo sin ella y un clasificador multinomial intenta reconocerlo con estilo crudo y con estilo ajustado. Se compara contra etiquetas permutadas.</p>
      <p><b>Jugadas tipo.</b> Mezcla gaussiana (K=8) sobre seis descriptores de cada posesión (inicio, avance máximo, duración, pases, verticalidad y peligro). Las frecuencias entran al mismo modelo como indicadores.</p>
      <p><b>Contexto.</b> Curvas de estilo ajustado por marcador, minuto, localía y fuerza del rival, más LightGBM con SHAP a nivel partido, que usa el estilo del DT rival como variable.</p>
      <p><b>Simulación.</b> Monte Carlo por posesión con el xG de StatsBomb. Sirve para explicar, no para predecir.</p>
      <h3>Alcance y límites</h3>
      <ul>
        <li>Datos de eventos, no tracking. El 360 es una foto por evento con campo visible parcial y no existe en todos los partidos.</li>
        <li>Un DT que nunca cambió de club y con poca rotación se separa peor de su plantilla. El índice de identificabilidad lo advierte.</li>
        <li>El modelo es aditivo y lineal. No captura interacciones DT×jugador, como un sistema que potencia a un jugador concreto.</li>
        <li>El DT es el que StatsBomb registra por partido. No se modelan interinatos de un solo partido ni el cuerpo técnico.</li>
      </ul>
      <h3>Referencias</h3>
      <ul style={{ fontSize: 14 }}>
        <li>Abowd, J., Kramarz, F. y Margolis, D. (1999). High Wage Workers and High Wage Firms. <i>Econometrica</i>, 67(2).</li>
        <li>Muehlheusser, G., Schneemann, S., Sliwka, D. y Wallmeier, N. (2018). The Contribution of Managers to Organizational Success: Evidence from German Soccer. <i>Journal of Sports Economics</i>, 19(6), 786–819. (Documentan además que el DT afecta el estilo de juego.)</li>
        <li>Fernández-Navarro, J., Fradua, L., Zubillaga, A., Ford, P. y McRobert, A. (2016). Attacking and defensive styles of play in soccer: analysis of Spanish and English elite teams. <i>Journal of Sports Sciences</i>, 34(24), 2195–2204.</li>
        <li>Decroos, T. y Davis, J. (2019). Player Vectors: Characterizing Soccer Players' Playing Style from Match Event Streams. <i>ECML-PKDD</i>.</li>
        <li>Macdonald, B. (2011). A Regression-Based Adjusted Plus-Minus Statistic for NHL Players. <i>Journal of Quantitative Analysis in Sports</i>, 7(3). Versión ridge: Macdonald (2012), arXiv:1201.0317.</li>
        <li>Lundberg, S. y Lee, S.-I. (2017). A Unified Approach to Interpreting Model Predictions (SHAP). <i>NeurIPS</i>.</li>
      </ul>
    </div>
  )
}
