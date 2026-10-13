/* Datos que necesitan las páginas del informe (los mismos JSON de la web) + utilidades de formato. */
import boot from '../boot.json'
import { dataUrl, getJSON, type Any } from '../lib'

export type RD = { art: Any; glob: Any; media: Any; mapa: Any; J: Any; X: Any; C: Any; jgl: Any; club: string; clubLogo?: string; foto?: string; plan?: Any; tiempo?: Any; bp2?: Any; val?: Any }
const mapa: Any = (boot as Any).mapa
const media: Any = (boot as Any).media
const glob: Any = (boot as Any).global

export async function loadRD(art: Any): Promise<RD> {
  const get = (f: string) => getJSON(dataUrl(f)).catch(() => null)
  const [J, X, C, jgl, P, T, B, V] = await Promise.all([get(`juego_${art.id}.json`), get(`jugadores_${art.id}.json`), get(`corners_${art.id}.json`), get('jugadas_liga.json'),
    get('plan.json'), get('tiempo.json'), get('bp2.json'), get('validacion.json')])
  const k = String(art.id)
  const plan = P?.dts?.[k] ? { ...P.dts[k], meta: P } : null
  const tiempo = T?.dts?.[k] ? { ...T.dts[k], kpis: T.kpis, liga: T.liga } : null
  const bp2 = B?.dts?.[k] ? { ...B.dts[k], liga: B.liga } : null
  const club: string = media.dts?.[art.id]?.club ?? art.etapas?.at(-1)?.club ?? ''
  return { art, glob, media, mapa, J, X, C, jgl, club, plan, tiempo, bp2, val: V }
}

export const MODE_COLOR: Record<string, string> = { plan: '#11a3b4', resumen: '#3987e5', separar: '#e0662f', juego: '#1fae7a', jugadores: '#e8b10c', bp: '#de4f87', lab: '#8f6cf0', vs: '#e5484d', metodo: '#8a9a92' }
export const HUES = ['#2f7dd6', '#e0662f', '#17a173', '#d9a000']
