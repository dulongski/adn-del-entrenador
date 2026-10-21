import { useEffect, useState } from 'react'
import { dataUrl, fmt, getJSON, type Any } from '../lib'
import { L } from '../settings'
import { Fig } from './figs'

/* Método 5.7: huella latente (pipeline/lowrank.py → lowrank.json; aplicada a la huella publicada por
   pipeline/apply_latent.py). Encogimiento empírico-bayesiano multitarea entre los 34 rasgos. */

function useLowrank() {
  const [v, setV] = useState<Any>(null)
  useEffect(() => { getJSON(dataUrl('lowrank.json')).then(setV).catch(() => setV(false)) }, [])
  return v
}

const MET: [string, string, string, string][] = [['ridge', 'Ridge solo', 'Ridge only', 'var(--ink-3)'], ['0', 'Encogimiento por rasgo', 'Per-trait shrinkage', 'var(--c-club)'], ['2', 'Huella latente', 'Latent fingerprint', 'var(--c-dt)']]

function LatentBars({ m }: { m: Any }) {
  const W = 520, H = 220, l = 40, b = 44, t = 14, lo = 0.45, hi = 0.6
  const groups: [string, string, string][] = [['todos', 'Todos los DTs', 'All coaches'], ['baja_ident', 'Difíciles de separar', 'Hard to separate']]
  const gw = (W - l - 10) / groups.length, bw = gw / 4.4
  const Y = (v: number) => H - b - ((Math.max(lo, v) - lo) / (hi - lo)) * (H - b - t)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-svg" role="img" aria-label={L('Correlación con la otra mitad de los partidos por método', 'Correlation with the other half of the matches by method')}>
      {[0.45, 0.5, 0.55, 0.6].map(v => <g key={v}><line x1={l} x2={W - 6} y1={Y(v)} y2={Y(v)} stroke="var(--rule)" /><text x={l - 6} y={Y(v) + 3.5} textAnchor="end" className="mt-tick">{fmt(v, 2)}</text></g>)}
      {groups.map(([g, es, en], gi) => (
        <g key={g}>
          {MET.map(([k, , , c], i) => { const v = m[g]?.[k]; if (v == null) return null; const x = l + gi * gw + gw * 0.12 + i * bw * 1.18; return (
            <g key={k}>
              <rect x={x} y={Y(v)} width={bw} height={Y(lo) - Y(v)} rx={3} fill={c} />
              <text x={x + bw / 2} y={Y(v) - 6} textAnchor="middle" className="mt-val">{fmt(v, 3)}</text>
            </g>) })}
          <text x={l + gi * gw + gw * 0.47} y={H - b + 18} textAnchor="middle" className="mt-lbl">{L(es, en)}</text>
        </g>
      ))}
      <text x={l} y={H - 6} className="mt-tick">{L('correlación media con la huella de la otra mitad (el eje empieza en 0.45)', 'mean correlation with the other half\'s fingerprint (axis starts at 0.45)')}</text>
    </svg>
  )
}

export function Latente({ n0 }: { n0: number }) {
  const v = useLowrank()
  if (!v) return null
  const m = v.mitad, c = v.carrera
  const gain = (m.todos['2'] - m.todos.ridge) * 100
  return (
    <>
      <h3 className="mt-h3 mt-h3-gap" id="mt-s5-7"><span className="mt-subnum">5.7</span>{L('Huella latente: compartir información entre rasgos', 'Latent fingerprint: sharing information across traits')}</h3>
      <div className="mt-two">
        <div className="mt-prose">
          <p>{L('El ridge estima cada rasgo por separado. Si un rasgo de un entrenador está pegado a su plantilla, sale ruidoso y nada lo rescata. Pero los rasgos se mueven juntos: quien presiona alto también recupera arriba y deja menos tiempo de posesión al rival. Por eso la huella publicada pasa por un último paso de aprendizaje multitarea.', 'Ridge estimates each trait on its own. If one of a coach\'s traits is stuck to his squad, it comes out noisy and nothing rescues it. But traits move together: a coach who presses high also wins the ball high and leaves the opponent less time on the ball. That is why the published fingerprint goes through one last multi-task learning step.')}</p>
          <p>{L('Un modelo de factores con encogimiento empírico-bayesiano aprende, con todos los entrenadores, cómo se mueven juntos los 34 rasgos (', 'A factor model with empirical-Bayes shrinkage learns, from all coaches, how the 34 traits move together (')}<span className="mono">Σ = ΛΛᵀ + Ψ</span>{L(`, ${c.rango} factores), y mide el ruido de cada rasgo para cada entrenador comparando dos mitades de sus partidos (`, `, ${c.rango} factors), and measures each trait's noise for each coach by comparing two halves of his matches (`)}<span className="mono">S<sub>c</sub></span>{L('). La huella final es', '). The final fingerprint is')}</p>
          <p className="mt-math">α̂<sub>c</sub><sup>{L('latente', 'latent')}</sup> = Σ (Σ + S<sub>c</sub>)<sup>−1</sup> α̂<sub>c</sub></p>
          <p>{L('Un rasgo con mucho ruido para ese entrenador pesa poco y se reconstruye con los rasgos correlacionados en los que él sí está claro; uno con poco ruido casi no se toca. Así el paso ataca justo el problema de separar al entrenador de su plantilla.', 'A trait with a lot of noise for that coach weighs little and is rebuilt from the correlated traits where he is clear; a trait with little noise is barely touched. The step thus targets exactly the problem of separating the coach from his squad.')}</p>
          <div className="mt-stats">
            <div><b>+{fmt(gain, 1)}</b><span>{L('puntos de correlación con la otra mitad', 'points of correlation with the other half')}</span><em>{L(`mejora en ${m.mejora_en_cada_particion['2']} de ${m.splits} particiones`, `better in ${m.mejora_en_cada_particion['2']} of ${m.splits} splits`)}</em></div>
            <div><b>{fmt(c.varianza_factores * 100, 0)}%</b><span>{L('de cómo se mueven juntos los rasgos, en 2 factores', 'of how traits move together, in 2 factors')}</span><em>{L('dónde defiende · cómo ataca', 'where it defends · how it attacks')}</em></div>
          </div>
          <p>{L(`Lectura honesta: la mejora es modesta pero consistente, y la ganancia viene de compartir entre rasgos (el encogimiento rasgo por rasgo sólo llega a ${fmt(m.todos['0'], 3)}). Lo que más gana son los rasgos más ruidosos, como el xG de balón parado, las llegadas al área y los contraataques. El intervalo de confianza que muestra la app sigue siendo el del bootstrap del ridge, que es más ancho: una postura prudente.`, `Honest reading: the gain is modest but consistent, and it comes from sharing across traits (per-trait shrinkage only reaches ${fmt(m.todos['0'], 3)}). The noisiest traits gain the most, such as set-piece xG, box entries and counter-attacks. The confidence interval the app shows is still the ridge bootstrap one, which is wider: a cautious stance.`)}</p>
        </div>
        <div>
          <Fig n={n0} title={L(`Qué tanto predice la huella de una mitad de los partidos la de la otra mitad (${m.splits} particiones, ${m.dts} entrenadores; «difíciles de separar»: identificabilidad menor a 80).`, `How well one half of the matches predicts the other half's fingerprint (${m.splits} splits, ${m.dts} coaches; «hard to separate»: identifiability below 80).`)}>
            <LatentBars m={m} />
          </Fig>
        </div>
      </div>
    </>
  )
}
