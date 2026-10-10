import type { Any } from '../lib'
import { Ico, iconFor } from '../icons'

export type P = { art: Any; glob: Any; media?: Any }
export const FAM_ORDER = ['Construcción', 'Progresión', 'Ocasiones', 'Presión', 'Organización defensiva', 'Transiciones', 'Dominio', 'Balón parado']
export const KEY = ['posesion', 'verticalidad', 'ppda', 'altura_presion', 'linea_360', 'contraataque', 'xg_90', 'xg_contra_90', 'pase_largo', 'field_tilt']

/** Selector de pastillas con icono (iconFor lo elige por palabras clave; un tercer elemento de la opción lo fuerza, '' lo quita). */
export const Seg = ({ opts, v, set }: { opts: ([string, string] | [string, string, string])[]; v: string; set: (s: string) => void }) => (
  <div className="seg" role="group">{opts.map(([k, l, ic]) => { const n = ic === '' ? null : ic ?? iconFor(k, l); return <button key={k} aria-pressed={v === k} onClick={() => set(k)}>{n && <Ico name={n} />}{l}</button> })}</div>
)
