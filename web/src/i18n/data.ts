/* Traducción de los textos que vienen de los DATOS (boot.json, dt_*.json, whatif.json…), no del código.
   La UI llama a estos helpers con el texto en español; en inglés devuelven la traducción si existe y,
   si no, el original (nunca rompen). Los mapas EN se llenan aquí. */
import { LANG } from '../settings'

const en = LANG === 'en'

/** KPI por clave (glob.kpis[k]): etiqueta y descripción. */
export const KPI_EN: Record<string, { etiqueta: string; descripcion?: string }> = {}
export const kpiLabel = (k: string, es: string) => (en ? KPI_EN[k]?.etiqueta ?? es : es)
export const kpiDesc = (k: string, es: string) => (en ? KPI_EN[k]?.descripcion ?? es : es)

/** Familias de indicadores (Construcción, Progresión…), por nombre en español. */
export const FAM_EN: Record<string, string> = {}
export const famLabel = (es: string) => (en ? FAM_EN[es] ?? es : es)

/** Familias de estilo del mapa (mapa.grupos[].nombre), rasgos y ejes, por texto en español. */
export const MAP_EN: Record<string, string> = {}
export const mapLabel = (es: string) => (en ? MAP_EN[es] ?? es : es)

/** Jugadas tipo (arquetipos[].nombre) y roles espaciales, por nombre en español. */
export const ARCH_EN: Record<string, string> = {}
export const archLabel = (es: string) => {
  if (!en) return es
  const m = /^(.*?)( \(\d+\))?$/.exec(es)
  return (ARCH_EN[m?.[1] ?? es] ?? m?.[1] ?? es) + (m?.[2] ?? '')
}

/** Posiciones en español (p.ej. "Pivote izq.") → nombre en inglés; abreviaturas (POR → GK). */
export const POS_EN: Record<string, string> = {}
export const POS_ABBR_EN: Record<string, string> = {}
export const posLabel = (es: string) => (en ? POS_EN[es] ?? es : es)
export const posAbbr = (es: string) => (en ? POS_ABBR_EN[es] ?? es : es)

/** Cualquier otra cadena de datos en español (comodín). */
export const DATA_EN: Record<string, string> = {}
export const td = (es: string) => (en ? DATA_EN[es] ?? es : es)
