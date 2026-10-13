import { useEffect, useState } from 'react'
import { dataUrl, fmt, getJSON, type Any } from '../lib'
import { L } from '../settings'
import { kName } from '../tabs/resumenKit'
import { Fig } from './figs'

/* Método 5.6: pruebas de robustez sobre el diseño REAL (pipeline/validation.py → validacion.json).
   No cambian el modelo publicado: lo ponen a prueba. */

export function useValidacion() {
  const [v, setV] = useState<Any>(null)
  useEffect(() => { getJSON(dataUrl('validacion.json')).then(setV).catch(() => setV(false)) }, [])
  return v
}

const EST: [string, string, string, string][] = [['modelo', 'Nuestro modelo', 'Our model', 'var(--c-dt)'], ['sin_jug', 'DT + club, sin jugadores', 'Coach + club, no players', 'var(--c-club)'], ['ingenuo', 'Promedio de sus partidos', 'Average of his matches', 'var(--ink-3)']]

function RecoveryBars({ S }: { S: Any }) {
  const W = 520, H = 210, l = 34, b = 40, t = 12
  const groups: [string, string, string][] = [['realista', 'Liga realista', 'Realistic league'], ['a_medida', 'Plantilla a su medida', 'Squad built in his image']]
  const gw = (W - l - 10) / groups.length, bw = gw / 4.2
  const Y = (v: number) => H - b - Math.max(0, v) * (H - b - t)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-svg" role="img">
      {[0, 0.25, 0.5, 0.75, 1].map(v => <g key={v}><line x1={l} x2={W - 6} y1={Y(v)} y2={Y(v)} stroke="var(--rule)" /><text x={l - 6} y={Y(v) + 3.5} textAnchor="end" className="mt-tick">{fmt(v, 2)}</text></g>)}
      {groups.map(([g, es, en], gi) => (
        <g key={g}>
          {EST.map(([k, , , c], i) => { const s = S[g]?.[k]; if (!s) return null; const x = l + gi * gw + gw * 0.12 + i * bw * 1.15; return (
            <g key={k}>
              <rect x={x} y={Y(s.media)} width={bw} height={Y(0) - Y(s.media)} rx={3} fill={c} />
              <line x1={x + bw / 2} x2={x + bw / 2} y1={Y(s.p05)} y2={Y(s.p95)} stroke="var(--ink)" strokeWidth={1.4} />
              <text x={x + bw / 2} y={Y(s.media) - 6} textAnchor="middle" className="mt-val">{fmt(s.media, 2)}</text>
            </g>) })}
          <text x={l + gi * gw + gw * 0.47} y={H - b + 18} textAnchor="middle" className="mt-lbl">{L(es, en)}</text>
        </g>
      ))}
      <text x={l} y={H - 4} className="mt-tick">{L('correlación con el efecto verdadero (barra = media, línea = 90% de las réplicas)', 'correlation with the true effect (bar = mean, line = 90% of replicates)')}</text>
    </svg>
  )
}

function FalseBars({ S }: { S: Any }) {
  const rows: [string, string, string, string][] = [['sd_falso', 'Nuestro modelo', 'Our model', 'var(--c-dt)'], ['sd_sin_jug', 'DT + club, sin jugadores', 'Coach + club, no players', 'var(--c-club)'], ['sd_ingenuo', 'Promedio de sus partidos', 'Average of his matches', 'var(--ink-3)']]
  const mx = Math.max(...rows.map(r => S.sin_dt?.[r[0]]?.media ?? 0), 0.01)
  return (
    <div className="mt-hbars">
      {rows.map(([k, es, en, c]) => { const s = S.sin_dt?.[k]; return s && (
        <div key={k} className="mt-hb"><span>{L(es, en)}</span><span className="bar"><i style={{ width: `${(s.media / mx) * 100}%`, background: c }} /></span><b>{fmt(s.media, 2)}σ</b></div>) })}
    </div>
  )
}

function Reliability({ R, glob }: { R: Any; glob: Any }) {
  const rows = Object.entries(R as Record<string, Any>).sort((a, b) => b[1].confiabilidad - a[1].confiabilidad)
  const X = (v: number) => (Math.max(-0.2, Math.min(1, v)) + 0.2) / 1.2 * 100
  return (
    <div className="mt-rel">
      <div className="mt-rel-ax"><span /><div>{[0, 0.5, 0.7, 1].map(v => <em key={v} style={{ left: `${X(v)}%` }}>{fmt(v, 1)}</em>)}</div></div>
      {rows.map(([k, r]) => (
        <div key={k} className={`mt-rel-r${r.confiabilidad < 0.5 ? ' weak' : ''}`}>
          <span>{kName(k, glob)}</span>
          <div><u style={{ left: `${X(0.5)}%` }} /><i className="raw" style={{ left: `${X(r.crudo)}%` }} /><b style={{ left: `${X(r.confiabilidad)}%` }} /></div>
          <em>{fmt(r.confiabilidad, 2)}</em>
        </div>
      ))}
    </div>
  )
}

function Silhouette({ M }: { M: Any }) {
  const ks = Object.keys(M.silueta).map(Number)
  const W = 360, H = 150, l = 34, b = 26, t = 10
  const lo = 0.25, hi = 0.5
  const X = (k: number) => l + ((k - ks[0]) / (ks[ks.length - 1] - ks[0])) * (W - l - 10)
  const Y = (v: number) => H - b - ((v - lo) / (hi - lo)) * (H - b - t)
  const pts = ks.map(k => `${X(k)},${Y(M.silueta[k])}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-svg" role="img">
      <rect x={l} y={Y(M.silueta_nula.p95)} width={W - l - 10} height={Y(lo) - Y(M.silueta_nula.p95)} fill="var(--surface-2)" />
      <text x={l + 6} y={Y(lo) - 5} className="mt-tick">{L('zona del azar (95%)', 'chance zone (95%)')}</text>
      {[0.3, 0.4, 0.5].map(v => <g key={v}><line x1={l} x2={W - 10} y1={Y(v)} y2={Y(v)} stroke="var(--rule)" /><text x={l - 5} y={Y(v) + 3.5} textAnchor="end" className="mt-tick">{fmt(v, 1)}</text></g>)}
      <polyline points={pts} fill="none" stroke="var(--c-dt)" strokeWidth={2.4} />
      {ks.map(k => <circle key={k} cx={X(k)} cy={Y(M.silueta[k])} r={k === M.k ? 5 : 3} fill={k === M.k ? 'var(--c-rival)' : 'var(--c-dt)'} />)}
      {ks.map(k => <text key={'t' + k} x={X(k)} y={H - 8} textAnchor="middle" className="mt-tick">K={k}</text>)}
    </svg>
  )
}

export function Validacion({ glob, n0 }: { glob: Any; n0: number }) {
  const v = useValidacion()
  if (!v) return null
  const S = v.sintetico, R = v.confiabilidad, O = v.fuera_muestra, M = v.mapa
  const relMean = R ? Object.values(R as Record<string, Any>).reduce((a, r) => a + r.confiabilidad, 0) / Object.keys(R).length : null
  const weak = R ? Object.entries(R as Record<string, Any>).filter(([, r]) => r.confiabilidad < 0.5).map(([k]) => kName(k, glob)) : []
  return (
    <>
      <h3 className="mt-h3 mt-h3-gap" id="mt-s5-6"><span className="mt-subnum">5.6</span>{L('Poner el modelo a prueba sobre los datos reales', 'Stress-testing the model on the real data')}</h3>
      <div className="mt-two">
        <div className="mt-prose">
          <p>{L('La prueba 5.3 usa una liga inventada. Esta usa la de verdad: el mismo calendario, los mismos entrenadores, clubes, rivales y jugadores en cancha en cada tramo, con los mismos pesos. Sobre ese diseño plantamos efectos conocidos, con tamaños como los que estima el modelo y ruido con la forma del real, y volvemos a ajustar con las mismas λ. Tres escenarios:', 'Test 5.3 uses an invented league. This one uses the real one: the same schedule, coaches, clubs, opponents and players on the pitch in every segment, with the same weights. On that design we plant known effects, sized like the ones the model estimates and with noise shaped like the real noise, and refit with the same λ. Three scenarios:')}</p>
          <ol className="mt-steps mt-steps-tight">
            <li><b>{L('Realista: ', 'Realistic: ')}</b>{L('entrenadores, jugadores, clubes y rivales con efectos independientes.', 'coaches, players, clubs and opponents with independent effects.')}</li>
            <li><b>{L('Plantilla a su medida: ', 'Squad in his image: ')}</b>{L('cada jugador empuja en la misma dirección que el entrenador con el que más jugó. Es la confusión que critica el plus-minus.', 'each player pushes in the same direction as the coach he played most for. It is the confusion plus-minus is criticised for.')}</li>
            <li><b>{L('Sin entrenador: ', 'No coach: ')}</b>{L('el entrenador no aporta nada, pero sus jugadores sí comparten un estilo. ¿El modelo inventa un entrenador que no existe?', 'the coach adds nothing, but his players do share a style. Does the model invent a coach who is not there?')}</li>
          </ol>
          <div className="mt-stats">
            <div><b>{fmt(S.realista.modelo.media, 2)}</b><span>{L('correlación con la verdad', 'correlation with the truth')}</span><em>{L('promedio simple', 'simple average')} {fmt(S.realista.ingenuo.media, 2)}</em></div>
            <div><b>{fmt(S.signo_significativos.media * 100, 0)}%</b><span>{L('aciertos de signo en los rasgos marcados como claros', 'right sign on traits flagged as clear')}</span><em>{fmt(S.share_significativos.media * 100, 0)}% {L('de los rasgos se marcan', 'of traits get flagged')}</em></div>
            <div><b>{fmt(S.realista.pend.media, 2)}</b><span>{L('pendiente: el tamaño del sello sale encogido', 'slope: the imprint size comes out shrunk')}</span><em>{L('cota prudente', 'a cautious bound')}</em></div>
          </div>
          <p>{L(`Lectura honesta: el modelo ordena bien a los entrenadores y casi nunca se equivoca de dirección cuando dice que un rasgo es claro, pero encoge el tamaño (pendiente ${fmt(S.realista.pend.media, 2)}) y por eso sus intervalos al 95% sólo cubren el valor verdadero el ${fmt(S.cobertura_95.media * 100, 0)}% de las veces: miden el ruido, no el encogimiento. En la app, «más que la liga» es fiable; «0.8 desviaciones» es un mínimo, no el número exacto.`, `Honest reading: the model ranks coaches well and almost never gets the direction wrong when it calls a trait clear, but it shrinks the size (slope ${fmt(S.realista.pend.media, 2)}), so its 95% intervals only cover the true value ${fmt(S.cobertura_95.media * 100, 0)}% of the time: they measure noise, not shrinkage. In the app, «more than the league» is reliable; «0.8 standard deviations» is a floor, not the exact number.`)}</p>
        </div>
        <div>
          <Fig n={n0} title={L(`Qué tanto recupera cada método el efecto verdadero del entrenador, en ${S.reps} réplicas sobre el diseño real.`, `How well each method recovers the true coach effect, in ${S.reps} replicates on the real design.`)}>
            <RecoveryBars S={S} />
            <div className="mt-leg">{EST.map(([k, es, en, c]) => <span key={k}><i style={{ background: c }} />{L(es, en)}</span>)}</div>
          </Fig>
          <Fig n={n0 + 1} title={L('Escenario sin entrenador: dispersión del «estilo de DT» que cada método se inventa. Lo ideal es 0.', 'No-coach scenario: spread of the «coach style» each method invents. Ideal is 0.')}>
            <FalseBars S={S} />
          </Fig>
        </div>
      </div>

      <div className="mt-two mt-h3-gap">
        <div className="mt-prose">
          <h3 className="mt-h3">{L('¿Sale lo mismo con la otra mitad de los partidos?', 'Does the other half of the matches give the same answer?')}</h3>
          <p>{L(`Repartimos los partidos al azar en dos mitades, ajustamos el modelo en cada una y comparamos el sello de cada entrenador (los que tienen al menos 10 partidos en cada mitad). Corregida por Spearman–Brown, la confiabilidad media es ${fmt(relMean, 2)}.`, `We split the matches at random into two halves, fit the model on each and compare each coach's imprint (those with at least 10 matches in each half). Corrected with Spearman–Brown, the mean reliability is ${fmt(relMean, 2)}.`)}</p>
          <p>{L(`Los rasgos de cómo se mueve el balón (posesión, pases por posesión, juego directo, salida del portero) son los más fiables. Los que dependen de pocos tiros o goles no lo son: ${weak.join(', ')}. La app usa esa confiabilidad para elegir qué rasgos van al tablero de seguimiento y pesa menos los débiles en el plan de partido.`, `How the ball moves (possession, passes per possession, direct play, goal kicks) is the most reliable. Traits that depend on a few shots or goals are not: ${weak.join(', ')}. The app uses this reliability to choose which traits go on the tracking dashboard and weighs weak ones less in the game plan.`)}</p>
          <p>{L('El promedio crudo de sus partidos sale más «estable» (raya gris) porque repite la misma plantilla en las dos mitades: es estable, pero mide también a los jugadores.', 'The raw average of his matches looks more «stable» (grey tick) because it repeats the same squad in both halves: it is stable, but it also measures the players.')}</p>
          <h3 className="mt-h3 mt-h3-gap">{L('Fuera de muestra', 'Out of sample')}</h3>
          <p>{L(`Con validación cruzada por partido, el modelo explica el ${fmt(O.media.completo * 100, 0)}% de las diferencias de estilo entre un partido y otro (el resto es el ruido propio de cada partido). Quitando al entrenador baja a ${fmt(O.media.sin_dt * 100, 1)}%, y quitando a los jugadores a ${fmt(O.media.sin_jugadores * 100, 1)}%. Saber quién es el DT ayuda poco a predecir un partido suelto porque casi siempre llega con el mismo club y plantilla; donde se ve su peso es cuando cambia de equipo (5.2 y 5.5).`, `With match-grouped cross-validation, the model explains ${fmt(O.media.completo * 100, 0)}% of the style differences from one match to the next (the rest is match-level noise). Without the coach it drops to ${fmt(O.media.sin_dt * 100, 1)}%, and without the players to ${fmt(O.media.sin_jugadores * 100, 1)}%. Knowing the coach adds little to predicting a single match because he almost always comes with the same club and squad; his weight shows when he changes teams (5.2 and 5.5).`)}</p>
        </div>
        <div>
          <Fig n={n0 + 2} title={L('Confiabilidad mitad/mitad de cada rasgo del sello (punto). Raya gris: el promedio crudo. Debajo de 0.5 (línea), poco fiable.', 'Split-half reliability of each imprint trait (dot). Grey tick: the raw average. Below 0.5 (line), unreliable.')}>
            <Reliability R={R} glob={glob} />
          </Fig>
        </div>
      </div>

      <div className="mt-two mt-h3-gap">
        <div className="mt-prose">
          <h3 className="mt-h3">{L('¿Los grupos del mapa de estilos son reales?', 'Are the style-map groups real?')}</h3>
          <p>{L(`No del todo, y lo decimos. La silueta del agrupamiento con K = ${M.k} es ${fmt(M.silueta[M.k], 2)}, igual a la que da una nube sin ninguna estructura con la misma forma (${fmt(M.silueta_nula.media, 2)}; 95% del azar hasta ${fmt(M.silueta_nula.p95, 2)}). Al remuestrear entrenadores, los grupos se reproducen sólo en parte (ARI medio ${fmt(M.ari.media, 2)}).`, `Not quite, and we say so. The silhouette of the clustering with K = ${M.k} is ${fmt(M.silueta[M.k], 2)}, the same as a structureless cloud of the same shape (${fmt(M.silueta_nula.media, 2)}; 95% of chance up to ${fmt(M.silueta_nula.p95, 2)}). When coaches are resampled, the groups only partly repeat (mean ARI ${fmt(M.ari.media, 2)}).`)}</p>
          <p>{L('Conclusión: los estilos de los entrenadores forman un continuo, no tribus separadas. El mapa sirve como mapa (quién está cerca de quién, que sí es estable porque sale del sello) y los colores son una guía para leerlo, no una clasificación.', 'Conclusion: coaching styles form a continuum, not separate tribes. The map works as a map (who is close to whom, which is stable because it comes from the imprint) and the colours are a reading aid, not a classification.')}</p>
        </div>
        <div>
          <Fig n={n0 + 3} title={L(`Silueta según el número de grupos (K). En rojo, el K que usa el mapa. Gris: lo que daría el azar.`, `Silhouette by number of groups (K). Red: the K the map uses. Grey: what chance would give.`)}>
            <Silhouette M={M} />
          </Fig>
        </div>
      </div>
    </>
  )
}
