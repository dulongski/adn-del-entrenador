import { fmt, type Any } from '../lib'

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
