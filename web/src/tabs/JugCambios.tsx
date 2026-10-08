import { useMemo, useState } from 'react'
import Dist, { rankOf, toValues, useDistData } from '../Dist'
import { fmt, type Any } from '../lib'

/* "Qué cambia cuando mete un cambio": una campana por indicador con el efecto neto de los cambios
   de TODOS los DTs (dist.json -> cambios[k]) y él resaltado. PPDA se invierte para que a la derecha
   siempre quede "más presión". */

const FRASE: Record<string, { t: string; mas: string; menos: string; nada: string; inv?: boolean }> = {
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

const num = (v: number) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), 2)}`

export function CambiosBells({ art, glob }: { art: Any; glob: Any }) {
  const dd = useDistData()
  const [all, setAll] = useState(false)
  const rows = useMemo(() => {
    if (!dd?.cambios) return []
    return (art.impacto_cambios as Any[]).filter(r => dd.cambios[r.kpi]).map(r => {
      const f = FRASE[r.kpi] ?? { t: glob.kpis[r.kpi]?.etiqueta ?? r.kpi, mas: `sube «${glob.kpis[r.kpi]?.etiqueta}»`, menos: `baja «${glob.kpis[r.kpi]?.etiqueta}»`, nada: glob.kpis[r.kpi]?.etiqueta }
      const s = f.inv ? -1 : 1
      const values = toValues(dd.cambios[r.kpi]).map(o => ({ id: o.id, v: s * o.v }))
      const v = s * r.neto
      const rk = rankOf(values, v)
      const p = Math.round(rk.pct)
      const ruido = r.se ? Math.abs(r.neto) < r.se : false
      let frase: string
      if (p >= 40 && p <= 60) frase = `Sus cambios apenas mueven ${f.nada}: queda en la mitad de la tabla de los DTs.`
      else if (v > 0) frase = `Tras sus cambios su equipo ${f.mas} que con el ${p}% de los DTs.`
      else frase = `Tras sus cambios su equipo ${f.menos} que con el ${100 - p}% de los DTs.`
      return { kpi: r.kpi, f, values, frase, ruido, dist: Math.abs(p - 50) }
    }).sort((a, b) => b.dist - a.dist)
  }, [dd, art, glob])

  if (!art.impacto_cambios?.length) return <p className="note">Todavía no tiene suficientes cambios registrados para comparar.</p>
  if (!dd) return <div className="card note">Cargando…</div>
  const shown = all ? rows : rows.slice(0, 4)
  return (
    <>
      <div className="jg-bells">
        {shown.map(r => (
          <div key={r.kpi} className="card jg-bell">
            <div className="jg-bell-t">{r.f.t}</div>
            <p className="jg-bell-s">{r.frase}{r.ruido && <span className="note"> Diferencia chica: puede ser casualidad.</span>}</p>
            <Dist values={r.values} marks={[{ id: art.id, color: 'var(--c-dt)' }]} refV={0} refLabel="DT típico" format={num} height={64} compact />
            <div className="jg-bell-ax"><span>← {r.f.menos}</span><span>{r.f.mas} →</span></div>
          </div>
        ))}
      </div>
      {rows.length > 4 && (
        <button className="jg-more" onClick={() => setAll(a => !a)}>{all ? 'Ver menos' : `Ver los ${rows.length} aspectos`}</button>
      )}
    </>
  )
}
