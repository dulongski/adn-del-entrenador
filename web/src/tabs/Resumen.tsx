import { fmt, sig, type Any } from '../lib'
import { PrismDetail, prismSentence } from '../charts'
import { type P } from './common'

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
