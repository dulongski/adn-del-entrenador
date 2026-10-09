import { useMemo, useState } from 'react'
import Dist, { rankOf, toValues, useDistData } from '../Dist'
import { fmt, type Any } from '../lib'
import { L, LANG } from '../settings'
import { kpiLabel } from '../i18n/data'

/* "Qué cambia cuando mete un cambio": una campana por indicador con el efecto neto de los cambios
   de TODOS los DTs (dist.json -> cambios[k]) y él resaltado. PPDA se invierte para que a la derecha
   siempre quede "más presión". */

const FRASE_ES: Record<string, { t: string; mas: string; menos: string; nada: string; inv?: boolean }> = {
  posesion: { t: 'Posesión', mas: 'tiene más la pelota', menos: 'tiene menos la pelota', nada: 'la posesión' },
  verticalidad: { t: 'Juego directo', mas: 'juega más directo', menos: 'juega menos directo', nada: 'lo directo de su juego' },
  ppda: { t: 'Intensidad de presión', mas: 'presiona más', menos: 'presiona menos', nada: 'la intensidad de la presión', inv: true },
  altura_presion: { t: 'Altura de la presión', mas: 'presiona más arriba', menos: 'presiona más abajo', nada: 'la altura de la presión' },
  linea_360: { t: 'Altura de la defensa', mas: 'adelanta más la defensa', menos: 'retrasa más la defensa', nada: 'la altura de la defensa' },
  contraataque: { t: 'Contraataques', mas: 'contraataca más', menos: 'contraataca menos', nada: 'los contraataques' },
  xg_90: { t: 'Peligro generado', mas: 'genera más peligro', menos: 'genera menos peligro', nada: 'el peligro que genera' },
  xg_contra_90: { t: 'Peligro concedido', mas: 'concede más peligro', menos: 'concede menos peligro', nada: 'el peligro que concede' },
  pase_largo: { t: 'Pase largo', mas: 'usa más el pase largo', menos: 'usa menos el pase largo', nada: 'el uso del pase largo' },
  field_tilt: { t: 'Juego en campo rival', mas: 'juega más en campo rival', menos: 'juega menos en campo rival', nada: 'el dominio del terreno' },
}
const FRASE_EN: typeof FRASE_ES = {
  posesion: { t: 'Possession', mas: 'has more of the ball', menos: 'has less of the ball', nada: 'possession' },
  verticalidad: { t: 'Direct play', mas: 'plays more directly', menos: 'plays less directly', nada: 'how direct his team is' },
  ppda: { t: 'Pressing intensity', mas: 'presses more', menos: 'presses less', nada: 'pressing intensity', inv: true },
  altura_presion: { t: 'Pressing height', mas: 'presses higher', menos: 'presses deeper', nada: 'pressing height' },
  linea_360: { t: 'Defensive line height', mas: 'pushes the line higher', menos: 'drops the line deeper', nada: 'the height of the back line' },
  contraataque: { t: 'Counter-attacks', mas: 'counters more', menos: 'counters less', nada: 'counter-attacking' },
  xg_90: { t: 'Chances created', mas: 'creates more danger', menos: 'creates less danger', nada: 'the danger it creates' },
  xg_contra_90: { t: 'Chances conceded', mas: 'concedes more danger', menos: 'concedes less danger', nada: 'the danger it concedes' },
  pase_largo: { t: 'Long balls', mas: 'goes long more', menos: 'goes long less', nada: 'use of long balls' },
  field_tilt: { t: 'Territory', mas: 'plays more in the opponent\'s half', menos: 'plays less in the opponent\'s half', nada: 'territorial control' },
}
const FRASE = LANG === 'en' ? FRASE_EN : FRASE_ES

const num = (v: number) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), 2)}`

export function CambiosBells({ art, glob }: { art: Any; glob: Any }) {
  const dd = useDistData()
  const [all, setAll] = useState(false)
  const rows = useMemo(() => {
    if (!dd?.cambios) return []
    return (art.impacto_cambios as Any[]).filter(r => dd.cambios[r.kpi]).map(r => {
      const et = glob.kpis[r.kpi]?.etiqueta ? kpiLabel(r.kpi, glob.kpis[r.kpi].etiqueta) : undefined
      const f = FRASE[r.kpi] ?? { t: et ?? r.kpi, mas: L(`sube «${et}»`, `“${et}” goes up`), menos: L(`baja «${et}»`, `“${et}” goes down`), nada: et }
      const s = f.inv ? -1 : 1
      const values = toValues(dd.cambios[r.kpi]).map(o => ({ id: o.id, v: s * o.v }))
      const v = s * r.neto
      const rk = rankOf(values, v)
      const p = Math.round(rk.pct)
      const ruido = r.se ? Math.abs(r.neto) < r.se : false
      let frase: string
      if (p >= 40 && p <= 60) frase = L(`Sus cambios apenas mueven ${f.nada}: queda en la mitad de la tabla de los DTs.`, `His subs barely move ${f.nada}: he sits mid-table among coaches.`)
      else if (v > 0) frase = L(`Tras sus cambios su equipo ${f.mas} que con el ${p}% de los DTs.`, `After his subs, his team ${f.mas} than ${p}% of coaches' teams.`)
      else frase = L(`Tras sus cambios su equipo ${f.menos} que con el ${100 - p}% de los DTs.`, `After his subs, his team ${f.menos} than ${100 - p}% of coaches' teams.`)
      return { kpi: r.kpi, f, values, frase, ruido, dist: Math.abs(p - 50) }
    }).sort((a, b) => b.dist - a.dist)
  }, [dd, art, glob])

  if (!art.impacto_cambios?.length) return <p className="note">{L('Todavía no tiene suficientes cambios registrados para comparar.', 'Not enough recorded subs to compare yet.')}</p>
  if (!dd) return <div className="card note">{L('Cargando…', 'Loading…')}</div>
  const shown = all ? rows : rows.slice(0, 4)
  return (
    <>
      <div className="jg-bells">
        {shown.map(r => (
          <div key={r.kpi} className="card jg-bell">
            <div className="jg-bell-t">{r.f.t}</div>
            <p className="jg-bell-s">{r.frase}{r.ruido && <span className="note">{L(' Diferencia chica: puede ser casualidad.', ' Small difference: could be chance.')}</span>}</p>
            <Dist values={r.values} marks={[{ id: art.id, color: 'var(--c-dt)' }]} refV={0} refLabel={L('DT típico', 'Typical coach')} format={num} height={64} compact low={r.f.menos} high={r.f.mas}
                  axis={L(`Cambio en «${r.f.t}» tras sus cambios (σ) · cada punto, un DT`, `Change in “${r.f.t}” after his subs (σ) · each dot, one coach`)} />
          </div>
        ))}
      </div>
      {rows.length > 4 && (
        <button className="jg-more" onClick={() => setAll(a => !a)}>{all ? L('Ver menos', 'Show fewer') : L(`Ver los ${rows.length} aspectos`, `Show all ${rows.length} metrics`)}</button>
      )}
    </>
  )
}
