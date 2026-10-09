/* Puente estilo -> xG (pipeline/style_xg.py): cuánto se mueve el xG esperado de un partido si el estilo propio del DT cambia.
   Es una asociación entre equipos (ridge a nivel equipo-partido), no una causa; se usa con cuidado y sin mostrar el xG resultante. */
import { dataUrl, getJSON, type Any } from '../lib'

export type StyleX = { kpis: Record<string, { xg_90: number; xg_contra_90: number }>; xg_90: { sd_xg: number; mean_xg: number; r2_cv: number }; xg_contra_90: { sd_xg: number; mean_xg: number; r2_cv: number }; estilo: string[] }
export type Fx = { own: number; rival: number }

let cache: Promise<{ sx: StyleX; wi: Any }> | null = null
export const loadStyle = () => (cache ??= Promise.all([getJSON(dataUrl('style_xg.json')), getJSON(dataUrl('whatif.json'))]).then(([sx, wi]) => ({ sx, wi })))

export const SLIDERS = ['posesion', 'salida_corta', 'pase_largo', 'verticalidad', 'progresivos', 'tempo', 'contraataque', 'centros', 'ppda', 'altura_presion', 'presion_alta', 'linea_360']
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** dz: cambio del estilo propio de cada indicador en σ de la liga. Devuelve el cambio de xG por 90 a favor y en contra. */
export function xgShift(dz: Record<string, number>, sx: StyleX) {
  let f = 0, a = 0
  for (const [k, d] of Object.entries(dz)) { const g = sx.kpis[k]; if (g && d) { f += g.xg_90 * d; a += g.xg_contra_90 * d } }
  return { dFor: f * sx.xg_90.sd_xg, dAgainst: a * sx.xg_contra_90.sd_xg }
}
/** factores que multiplican el xG de los tiros propios y del rival al rejugar un partido */
export function fxOf(dz: Record<string, number>, sx: StyleX): Fx {
  const s = xgShift(dz, sx), m = sx.xg_90.mean_xg
  return { own: clamp((m + s.dFor) / m, 0.5, 1.8), rival: clamp((sx.xg_contra_90.mean_xg + s.dAgainst) / sx.xg_contra_90.mean_xg, 0.5, 1.8) }
}
