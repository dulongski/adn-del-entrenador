import { fmt, type Any } from '../lib'
import { LANG, L, LOCALE } from '../settings'
import { famLabel, kpiDesc, kpiLabel } from '../i18n/data'

export function Metodo({ glob }: { glob: Any }) {
  const F = glob.framework
  const kp = Object.entries(glob.kpis).filter(([k]) => !k.startsWith('arq_'))
  return (
    <div className="narr">
      <h3 className="h2">{L('Marco analítico', 'Analytical framework')}</h3>
      <p>{L('Todas las métricas, gráficos y modelos de este laboratorio salen de los mismos objetos y umbrales (config/framework.yaml). Nada se define dos veces.', 'Every metric, chart and model in this lab is built from the same objects and thresholds (config/framework.yaml). Nothing is defined twice.')}</p>
      <div className="grid2">
        {(LANG === 'en' ? [
          ['Possession', `StatsBomb possession id, when the team is in possession and makes at least ${F.posesion.min_own_ball_actions} on-ball action (pass, carry, shot or dribble).`],
          ['Attacking sequence', `A possession that reaches the final third (x ≥ ${F.secuencia_ofensiva.min_x}).`],
          ['Transition', `An open-play possession that starts right after an opponent possession. It counts as fast if it reaches the final third within ≤ ${F.transicion.window_s} s. A defensive transition is the same thing seen from the opponent's side.`],
          ['Pressing phase', `A chain of the same team's Pressure events no more than ${F.presion.chain_gap_s} s apart. High: x ≥ ${F.presion.high_min_x}. Counter-press: a pressure ≤ ${F.presion.counterpress_window_s} s after losing the ball.`],
          ['Progressive action', `A completed pass or a carry (≥ ${F.pase_progresivo.min_carry_length} yd) that brings the ball at least ${100 * F.pase_progresivo.min_gain_ratio}% closer to goal and ends at x ≥ ${F.pase_progresivo.min_end_x}.`],
          ['Defensive line (360)', `Average position of the ${F.bloque_360.n_defenders} deepest outfield players visible in the freeze-frame, during opponent possession (at least ${F.bloque_360.min_visible_defenders} visible).`],
          ['Stint and segment', `Stint: a stretch with no change in the 22 players on the pitch or in the score. Segment: consecutive stints joined until they add up to ≥ ${F.stint.min_duration_s / 60} min. It is the model's unit of analysis.`],
          ['Set piece', `Corner, free kick in the opponent's half, or throw-in in the final third (x ≥ ${F.balon_parado.throw_in_danger_min_x}). Lasts up to ${F.balon_parado.window_s} s or until the possession ends.`],
        ] : [
          ['Posesión', `Id de posesión de StatsBomb, cuando el equipo es el poseedor y hace al menos ${F.posesion.min_own_ball_actions} acción con balón (pase, conducción, tiro o regate).`],
          ['Secuencia ofensiva', `Posesión que llega al último tercio (x ≥ ${F.secuencia_ofensiva.min_x}).`],
          ['Transición', `Posesión en juego abierto que empieza tras una posesión rival. Es rápida si llega al último tercio en ≤ ${F.transicion.window_s} s. La transición defensiva es lo mismo, visto desde el rival.`],
          ['Fase de presión', `Cadena de eventos Pressure del mismo equipo separados por ≤ ${F.presion.chain_gap_s} s. Alta: x ≥ ${F.presion.high_min_x}. Contrapresión: presión ≤ ${F.presion.counterpress_window_s} s después de perder el balón.`],
          ['Acción progresiva', `Pase completado o conducción (≥ ${F.pase_progresivo.min_carry_length} yd) que acerca el balón a la portería al menos ${100 * F.pase_progresivo.min_gain_ratio}% y termina en x ≥ ${F.pase_progresivo.min_end_x}.`],
          ['Línea defensiva (360)', `Media de los ${F.bloque_360.n_defenders} jugadores de campo más retrasados que se ven en el freeze-frame, durante la posesión rival (mínimo ${F.bloque_360.min_visible_defenders} visibles).`],
          ['Stint y segmento', `Stint: intervalo sin cambios en los 22 jugadores ni en el marcador. Segmento: stints consecutivos unidos hasta sumar ≥ ${F.stint.min_duration_s / 60} min. Es la unidad del modelo.`],
          ['Balón parado', `Córner, tiro libre en campo rival o saque de banda en el último tercio (x ≥ ${F.balon_parado.throw_in_danger_min_x}). Dura hasta ${F.balon_parado.window_s} s o hasta el fin de la posesión.`],
        ]).map(([t, d]) => <div key={t} className="card"><div className="h3">{t}</div><div style={{ fontSize: 14 }}>{d}</div></div>)}
      </div>
      <h3>{L('Indicadores', 'Indicators')} ({kp.length})</h3>
      <p>{L('Cada indicador es num/den sobre contadores por stint y se agrega siempre como Σnum/Σden. Por eso un stint, un partido y una temporada se miden igual.', 'Each indicator is num/den over per-stint counters and is always aggregated as Σnum/Σden. That is why a stint, a match and a season are all measured the same way.')}</p>
      <div className="card tbl-wrap"><table className="t"><thead><tr><th>{L('Familia', 'Family')}</th><th>{L('Indicador', 'Indicator')}</th><th>{L('Definición', 'Definition')}</th><th style={{ textAlign: 'right' }}>{L('Media liga', 'League avg')}</th></tr></thead>
        <tbody>{kp.map(([k, v]: Any) => <tr key={k}><td className="note">{famLabel(v.familia)}</td><td>{kpiLabel(k, v.etiqueta)}</td><td style={{ fontSize: 13 }}>{kpiDesc(k, v.descripcion)}</td><td className="num">{fmt(v.media)}</td></tr>)}</tbody></table></div>
      {LANG === 'en' ? <>
      <h3>Model</h3>
      <p><b>Style decomposition (AKM + RAPM).</b> For each standardized indicator z (σ across team-seasons): z = α<sub>coach</sub> + φ<sub>club</sub> + Σβ<sub>j</sub>·exposure<sub>j</sub> + γ<sub>opponent×season</sub> + δ·context + ε. It is fit by weighted least squares with a ridge penalty per block. Sample: {glob.muestra.partidos.toLocaleString(LOCALE)} matches, {glob.muestra.segmentos.toLocaleString(LOCALE)} team-segments, {glob.muestra.dts} coaches, {glob.muestra.jugadores_modelados} players. The uncertainty in α comes from a match-level bootstrap.</p>
      <p><b>Synthetic validation.</b> In a simulated league where every coach signs players "in his own image" (0.8 correlation between the coach's style and his players'), the model recovers the coach effects with a 0.95 correlation (RMSE 0.40). The naive per-coach average has an RMSE of 1.02 (tests/test_decomposition.py).</p>
      <p><b>Transfer test.</b> A coach's spell at one club is held out, everything is refit without it, and a multinomial classifier tries to recognize him from raw style and from adjusted style. The result is compared against permuted labels.</p>
      <p><b>Possession types.</b> A Gaussian mixture (K=8) over six descriptors of each possession (start, furthest point reached, duration, passes, directness and danger). Their frequencies enter the same model as indicators.</p>
      <p><b>Context.</b> Adjusted-style curves by scoreline, minute, home/away and opponent strength, plus match-level LightGBM with SHAP that uses the opposing coach's style as a feature.</p>
      <p><b>Simulation.</b> Possession-by-possession Monte Carlo using StatsBomb xG. It is there to explain, not to predict.</p>
      <h3>Scope and limitations</h3>
      <ul>
        <li>Event data, not tracking. 360 data is a single snapshot per event with a partially visible pitch, and it isn't available for every match.</li>
        <li>A coach who never changed clubs and rotated little is harder to separate from his squad. The identifiability index flags this.</li>
        <li>The model is additive and linear. It doesn't capture coach×player interactions, such as a system built to get the best out of one specific player.</li>
        <li>The coach is whoever StatsBomb lists for each match. One-match interim spells and the wider coaching staff are not modeled.</li>
      </ul>
      </> : <>
      <h3>Modelo</h3>
      <p><b>Descomposición de estilo (AKM + RAPM).</b> Para cada indicador estandarizado z (σ entre equipos-temporada): z = α<sub>DT</sub> + φ<sub>club</sub> + Σβ<sub>j</sub>·exposición<sub>j</sub> + γ<sub>rival×temporada</sub> + δ·contexto + ε. Se ajusta por mínimos cuadrados ponderados con ridge por bloque. Muestra: {glob.muestra.partidos.toLocaleString(LOCALE)} partidos, {glob.muestra.segmentos.toLocaleString(LOCALE)} segmentos-equipo, {glob.muestra.dts} DTs, {glob.muestra.jugadores_modelados} jugadores. La incertidumbre de α sale de un bootstrap por partido.</p>
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
      </>}
      <h3>{L('Referencias', 'References')}</h3>
      <ul style={{ fontSize: 14 }}>
        <li>Abowd, J., Kramarz, F.{L(' y ', ' and ')}Margolis, D. (1999). High Wage Workers and High Wage Firms. <i>Econometrica</i>, 67(2).</li>
        <li>Muehlheusser, G., Schneemann, S., Sliwka, D.{L(' y ', ' and ')}Wallmeier, N. (2018). The Contribution of Managers to Organizational Success: Evidence from German Soccer. <i>Journal of Sports Economics</i>, 19(6), 786–819. {L('(Documentan además que el DT afecta el estilo de juego.)', '(They also document that the coach affects playing style.)')}</li>
        <li>Fernández-Navarro, J., Fradua, L., Zubillaga, A., Ford, P.{L(' y ', ' and ')}McRobert, A. (2016). Attacking and defensive styles of play in soccer: analysis of Spanish and English elite teams. <i>Journal of Sports Sciences</i>, 34(24), 2195–2204.</li>
        <li>Decroos, T.{L(' y ', ' and ')}Davis, J. (2019). Player Vectors: Characterizing Soccer Players' Playing Style from Match Event Streams. <i>ECML-PKDD</i>.</li>
        <li>Macdonald, B. (2011). A Regression-Based Adjusted Plus-Minus Statistic for NHL Players. <i>Journal of Quantitative Analysis in Sports</i>, 7(3). {L('Versión ridge', 'Ridge version')}: Macdonald (2012), arXiv:1201.0317.</li>
        <li>Lundberg, S.{L(' y ', ' and ')}Lee, S.-I. (2017). A Unified Approach to Interpreting Model Predictions (SHAP). <i>NeurIPS</i>.</li>
      </ul>
    </div>
  )
}
