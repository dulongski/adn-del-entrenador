import type { Any } from '../lib'

export type P = { art: Any; glob: Any; media?: Any }
export const FAM_ORDER = ['Construcción', 'Progresión', 'Ocasiones', 'Presión', 'Organización defensiva', 'Transiciones', 'Dominio', 'Balón parado']
export const KEY = ['posesion', 'verticalidad', 'ppda', 'altura_presion', 'linea_360', 'contraataque', 'xg_90', 'xg_contra_90', 'pase_largo', 'field_tilt']

export const Seg = ({ opts, v, set }: { opts: [string, string][]; v: string; set: (s: string) => void }) => (
  <div className="seg" role="group">{opts.map(([k, l]) => <button key={k} aria-pressed={v === k} onClick={() => set(k)}>{l}</button>)}</div>
)
