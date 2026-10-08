import { useEffect, useState } from 'react'
import Dist, { rankOf } from '../Dist'
import { fmt, sig, type Any } from '../lib'

/* Piezas compartidas por Resumen y «De dónde sale cada rasgo»: unidades legibles por indicador,
   comparación en palabras contra la liga y la campana de los DTs con dos lecturas:
   «sus partidos» (valor crudo) y «su sello» (liga + efecto propio del DT, en las unidades del indicador:
   lo que harían sus equipos con jugadores, club y rival promedio). */

/** Etiqueta corta, unidad y decimales con los que se lee cada indicador. */
export const KU: Record<string, [string, string, number]> = {
  posesion: ['Posesión', '%', 1], salida_corta: ['Salida corta del portero', '%', 1], pase_largo: ['Pases largos', '%', 1],
  construccion_exito: ['Salidas desde atrás que llegan a campo rival', '%', 1], pases_por_posesion: ['Pases por posesión', '', 1],
  tempo: ['Ritmo de circulación', ' pases/min', 1], verticalidad: ['Verticalidad', '%', 1], progresivos: ['Acciones progresivas', ' por 100', 1],
  conduccion_prog: ['Progresión en conducción', '%', 1], progresion_banda: ['Progresión por banda', '%', 1],
  cambios_orientacion: ['Cambios de orientación', ' por 100 pases', 1], entradas_ultimo_tercio: ['Entradas al último tercio', ' por 100 posesiones', 1],
  xg_90: ['xG a favor', ' por 90', 2], xg_por_tiro: ['xG por tiro', '', 3], tiros_90: ['Tiros', ' por 90', 1],
  llegada_area: ['Posesiones que pisan el área', '%', 1], centros: ['Centros', ' por 100 llegadas', 1], obv_90: ['Valor generado con balón (OBV)', ' por 90', 2],
  ppda: ['Pases rivales por cada robo (PPDA)', '', 1], altura_presion: ['Altura de la presión', ' yd', 1], presion_alta: ['Presiones en tercio rival', '%', 1],
  intensidad_presion: ['Presiones por minuto sin balón', '', 1], contrapresion: ['Contrapresión tras pérdida', '%', 1],
  recuperaciones_altas_90: ['Recuperaciones en campo rival', ' por 90', 1], altura_defensiva: ['Altura de acciones defensivas', ' yd', 1],
  linea_360: ['Altura de la línea defensiva', ' yd', 1], compacidad_360: ['Longitud del bloque', ' yd', 1],
  posesion_rival_dur: ['Duración de la posesión rival', ' s', 1], xg_contra_90: ['xG en contra', ' por 90', 2],
  contraataque: ['Transiciones rápidas', '%', 1], xg_transicion: ['xG de transiciones rápidas', '%', 1],
  transicion_def: ['Contras rápidas concedidas', '%', 1], field_tilt: ['Dominio territorial', '%', 1], xg_balon_parado_90: ['xG a balón parado', ' por 90', 2],
}
export const kName = (k: string, glob: Any) => KU[k]?.[0] ?? String(glob.kpis[k]?.etiqueta ?? k).split(' (')[0]
/** Valor con su unidad («50.8%», «3.0 por 100 pases»). `short` deja solo las unidades de 1–3 letras. */
export function kFmt(k: string, v: number | null | undefined, short = false) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const [, u, d] = KU[k] ?? ['', '', 1]
  const unit = short && u.length > 3 ? '' : u
  return `${fmt(v, d)}${unit}`
}

/** Compara con la liga en palabras usando la dispersión entre equipos (sd del indicador). */
export function vsLiga(x: number, ref: number, sd: number) {
  const d = sd ? (x - ref) / sd : 0
  if (Math.abs(d) < 0.15) return { txt: 'casi igual que la liga', dir: 0 }
  const w = d > 0 ? 'más' : 'menos'
  return { txt: `${Math.abs(d) < 0.6 ? `un poco ${w}` : Math.abs(d) < 1.2 ? w : `mucho ${w}`} que la liga`, dir: Math.sign(d) }
}

/** Posición entre los DTs en una frase («Solo 3 de 76 DTs están más abajo»). */
export function rankText(values: { id: string | number; v: number }[], v: number) {
  const { below, above, n } = rankOf(values, v)
  if (n < 3) return ''
  if (above === 0) return `El más alto de los ${n} DTs.`
  if (below === 0) return `El más bajo de los ${n} DTs.`
  if (above <= below) return above <= n / 4 ? `Solo ${above} de ${n} DTs están más arriba.` : `Más arriba que ${below} de ${n} DTs.`
  return below <= n / 4 ? `Solo ${below} de ${n} DTs están más abajo.` : `Más abajo que ${above} de ${n} DTs.`
}

/** Valores de todos los DTs para un indicador: crudo en sus partidos, o «sello» (liga + α·sd). */
export function kValues(dd: Any, glob: Any, k: string, mode: 'v' | 'a') {
  const K = dd?.kpis?.[k]
  if (!K) return []
  if (mode === 'v') return Object.entries(K.v ?? {}).map(([id, v]) => ({ id, v: v as number }))
  const sd = glob.kpis[k]?.sd ?? 1
  return Object.entries(K.a ?? {}).map(([id, a]) => ({ id, v: K.liga + (a as number) * sd }))
}

/** Percentil del efecto propio (α) del DT entre todos: 0 = el que más baja el indicador, 1 = el que más lo sube. */
export function alphaPos(dd: Any, k: string, id: number | string) {
  const a = dd?.kpis?.[k]?.a
  if (!a || a[String(id)] === undefined) return null
  const vals = Object.values(a) as number[]
  const mine = a[String(id)] as number
  return { p: vals.filter(x => x < mine).length / Math.max(1, vals.length - 1), a: mine, se: dd.kpis[k].se?.[String(id)] as number | undefined, n: vals.length }
}

/** Mini regla: dónde queda su sello entre los DTs (punto) frente al DT promedio (raya central). */
export function RankStrip({ pos, color }: { pos: { p: number; a: number; se?: number; n: number } | null; color: string }) {
  if (!pos) return null
  return (
    <span className="rs-strip" title={`Su sello entre ${pos.n} DTs (izquierda = lo baja, derecha = lo sube). Dato técnico: ${sig(pos.a)}${pos.se ? ` ± ${fmt(pos.se, 2)}` : ''}`}>
      <span className="rs-strip-mid" />
      <span className="rs-strip-dot" style={{ left: `${4 + pos.p * 92}%`, background: color }} />
    </span>
  )
}

/** Campana de los DTs para un indicador, con selector «sus partidos» / «su sello». */
export function KpiBell({ k, art, glob, dd, color, mode: mode0 = 'a', showStats = true, compact = false }: {
  k: string; art: Any; glob: Any; dd: Any; color: string; mode?: 'v' | 'a'; showStats?: boolean; compact?: boolean
}) {
  const [mode, setMode] = useState<'v' | 'a'>(mode0)
  useEffect(() => setMode(mode0), [mode0, k])
  const K = dd?.kpis?.[k]
  const sd = glob.kpis[k]?.sd ?? 1
  if (!K) return <div className="rs-bell-wait">Cargando la comparación con los demás DTs…</div>
  const id = String(art.id)
  const raw = K.v?.[id] as number | undefined
  const a = K.a?.[id] as number | undefined
  const sello = a !== undefined ? K.liga + a * sd : undefined
  const vals = kValues(dd, glob, k, mode)
  const mine = mode === 'v' ? raw : sello
  // «un poco / mucho más que la liga» medido contra la dispersión de la misma campana que se dibuja
  const mu = vals.reduce((t, o) => t + o.v, 0) / Math.max(1, vals.length)
  const sdV = Math.sqrt(vals.reduce((t, o) => t + (o.v - mu) ** 2, 0) / Math.max(1, vals.length)) || sd
  const cmp = mine !== undefined ? vsLiga(mine, K.liga, sdV) : null
  const opt = (m: 'v' | 'a', lbl: string, sub: string, v?: number) => (
    <button type="button" className="rs-stat rs-pick" aria-pressed={mode === m} onClick={() => setMode(m)}>
      <span className="rs-stat-l">{lbl}</span><b>{kFmt(k, v)}</b><span className="rs-stat-s">{sub}</span>
    </button>
  )
  return (
    <div className="rs-bell" style={{ ['--acc' as string]: color }}>
      {showStats && (
        <div className="rs-stats">
          {opt('v', 'En sus partidos', 'lo que se vio', raw)}
          {opt('a', 'Su sello', 'con jugadores promedio', sello)}
          <div className="rs-stat rs-liga"><span className="rs-stat-l">Liga</span><b>{kFmt(k, K.liga)}</b><span className="rs-stat-s">promedio</span></div>
        </div>
      )}
      <Dist values={vals} marks={[{ id: art.id, color }]} refV={K.liga} refLabel="liga" format={v => kFmt(k, v, true)}
            low="menos" high="más" height={compact ? 64 : 78} compact={compact} />
      {mine !== undefined && cmp && (
        <p className="rs-bell-say">
          <b>{mode === 'v' ? 'En sus partidos' : 'Su sello'}: {cmp.txt}.</b> {rankText(vals, mine)}
          {mode === 'a' && a !== undefined && <span className="rs-tech" title="Efecto propio del DT en desviaciones estándar entre equipos, con su error"> {sig(a)}{K.se?.[id] ? ` ± ${fmt(K.se[id], 2)}` : ''}</span>}
        </p>
      )}
    </div>
  )
}

/** Uno o dos columnas según el ancho (para apilar tarjetas sin huecos). */
export function useWide(q = '(min-width: 960px)') {
  const [w, setW] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setW(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [q])
  return w
}
