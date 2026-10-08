/* eslint-disable @typescript-eslint/no-explicit-any */
export type Any = any
import boot from './boot.json'
import { L, LOCALE } from './settings'
import { posAbbr } from './i18n/data'

/** Nombres y apellidos verificados (pipeline/names.py + config/nombres_manual.json). */
const NOMBRES: Record<string, { nombres: string; apellidos: string; corto: string }> = (boot as any).nombres || {}
const POR_NOMBRE: Record<string, { nombres: string; apellidos: string; corto: string }> = {}
for (const d of (boot as any).global?.dts || []) if (NOMBRES[d.id]) POR_NOMBRE[d.nombre] = NOMBRES[d.id]
const APODOS: Record<string, string> = (boot as any).apodos || {}
/** Nombre corto de un jugador: su apodo oficial (StatsBomb) o, si no hay, nombre + primer apellido. */
export const jugadorCorto = (id: number | string | null | undefined, nombre: string) => (id != null && APODOS[String(id)]) || shortName(nombre)
export const nombreDT = (id: number | string, completo?: string) => NOMBRES[String(id)] ?? (completo ? POR_NOMBRE[completo] : undefined)

const cache = new Map<string, Promise<Any>>()
export function getJSON(url: string): Promise<Any> {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then(async r => {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || L(`Error ${r.status} al cargar ${url}`, `Error ${r.status} loading ${url}`))
      return r.json()
    }))
  }
  return cache.get(url)!
}

export const COMP = [
  { key: 'coach', label: L('DT', 'Coach'), color: 'var(--c-dt)' },
  { key: 'player', label: L('Plantilla', 'Squad'), color: 'var(--c-plantilla)' },
  { key: 'club', label: 'Club', color: 'var(--c-club)' },
  { key: 'opp', label: L('Rival', 'Opponent'), color: 'var(--c-rival)' },
  { key: 'ctx', label: L('Contexto', 'Context'), color: 'var(--c-ctx)' },
] as const

export function fmt(x: number | null | undefined, d = 1): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  if (d === 1 && Math.abs(x) < 1 && x !== 0) d = 2
  return x.toLocaleString(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d })
}
export const sig = (x: number | null | undefined) =>
  x === null || x === undefined ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}σ`
export const pct = (x: number | null | undefined, d = 0) => (x === null || x === undefined ? '—' : `${fmt(x, d)}%`)

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'das', 'do', 'dos', 'di', 'san', 'van', 'von'])
/** Palabras del nombre con las partículas pegadas al apellido que sigue («de la Torre»). */
function nameTokens(n: string) {
  const out: string[] = []; let buf: string[] = []
  for (const w of n.split(' ').filter(Boolean)) { buf.push(w); if (!PARTICULAS.has(w.toLowerCase())) { out.push(buf.join(' ')); buf = [] } }
  if (buf.length) out.push(buf.join(' '))
  return out
}
export function shortName(n: string) {
  if (POR_NOMBRE[n]) return POR_NOMBRE[n].corto
  const t = nameTokens(n)
  if (t.length <= 2) return t.join(' ')
  // nombre + primer apellido (español: nombre(s) + apellido paterno + materno)
  if (t.length >= 4) return `${t[0]} ${t[t.length - 2]}`
  return /\s/.test(t[2]) ? `${t[0]} ${t[1]}` : `${t[0]} ${t[2]}`
}

/** Divergente azul↔gris↔rojo para diferencias (DT − liga). */
export function divColor(v: number, max: number) {
  const t = Math.max(-1, Math.min(1, v / (max || 1)))
  const a = Math.abs(t)
  const pole = t >= 0 ? 'var(--div-pos)' : 'var(--div-neg)'
  // raíz: los valores intermedios se ven con color claro en vez de un gris turbio
  return `color-mix(in oklab, ${pole} ${Math.round(Math.sqrt(a) * 100)}%, var(--div-mid))`
}
/** Secuencial de un solo tono. */
export function seqColor(v: number, max: number) {
  const t = Math.max(0, Math.min(1, v / (max || 1)))
  return `color-mix(in oklab, var(--c-dt) ${Math.round(8 + t * 92)}%, var(--surface))`
}

/* ---------------------------------------------------------------- posiciones estilo FIFA (español) */
const POS_TAG: Record<string, [string, 'por' | 'def' | 'med' | 'del']> = {
  'Portero': ['POR', 'por'],
  'Lateral der.': ['LD', 'def'], 'Lateral izq.': ['LI', 'def'],
  'Central': ['DFC', 'def'], 'Central der.': ['DFC', 'def'], 'Central izq.': ['DFC', 'def'],
  'Carrilero der.': ['CAD', 'def'], 'Carrilero izq.': ['CAI', 'def'],
  'Pivote': ['MCD', 'med'], 'Pivote der.': ['MCD', 'med'], 'Pivote izq.': ['MCD', 'med'],
  'Mediocentro': ['MC', 'med'], 'Interior der.': ['MC', 'med'], 'Interior izq.': ['MC', 'med'],
  'Volante der.': ['MD', 'med'], 'Volante izq.': ['MI', 'med'],
  'Mediapunta': ['MCO', 'med'], 'Mediapunta der.': ['MCO', 'med'], 'Mediapunta izq.': ['MCO', 'med'],
  'Extremo der.': ['ED', 'del'], 'Extremo izq.': ['EI', 'del'],
  'Delantero centro': ['DC', 'del'], 'Delantero der.': ['DC', 'del'], 'Delantero izq.': ['DC', 'del'],
  'Segundo delantero': ['SD', 'del'],
}
export function posTag(pos: string | null | undefined): { abbr: string; group: string } {
  const t = pos ? POS_TAG[pos] : undefined
  return t ? { abbr: posAbbr(t[0]), group: t[1] } : { abbr: '—', group: 'none' }
}
export const initials = (n: string) => { const p = n.split(' '); return (p[0][0] + (p.length >= 4 ? p[p.length - 2][0] : p[p.length - 1][0])).toUpperCase() }

/* ---------------------------------------------------------------- sitio estático */
/** Ruta a un recurso estático respetando la base del despliegue (funciona en subcarpetas, p.ej. GitHub Pages). */
export const asset = (p?: string | null) => (!p ? p ?? null : /^https?:/.test(p) ? p : import.meta.env.BASE_URL + p.replace(/^\//, ''))
export const dataUrl = (f: string) => asset(`data/${f}`)!

/** Rejuega un partido en el navegador: cada posesión con tiro es gol con p = 1 − Π(1 − xG);
 *  máximo un gol por posesión. Mismo método que pipeline/models/simulation.py.
 *  Además devuelve el marcador más probable y UNA rejugada que terminó con ese marcador
 *  (qué tiros fueron gol en ella), para mostrarla sobre la cancha. */
export function simulateMatch(shots: number[][], n = 10000) {
  const groups = new Map<string, number[]>()
  shots.forEach((s, i) => { const k = `${s[3]}-${s[6]}`; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(i) })
  const poss = [...groups.values()].map(ix => ({ own: shots[ix[0]][3] === 1, ix, p: 1 - ix.reduce((q, i) => q * (1 - shots[i][2]), 1) }))
  let w = 0, d = 0
  const grid = Array.from({ length: 6 }, () => new Array(6).fill(0))
  for (let i = 0; i < n; i++) {
    let ga = 0, gb = 0
    for (const q of poss) if (Math.random() < q.p) { if (q.own) ga++; else gb++ }
    if (ga > gb) w++; else if (ga === gb) d++
    grid[Math.min(ga, 5)][Math.min(gb, 5)]++
  }
  let modal: [number, number] = [0, 0], best = -1
  grid.forEach((r, i) => r.forEach((c, j) => { if (c > best) { best = c; modal = [i, j] } }))
  // una rejugada con el marcador más probable: qué tiro de cada posesión anotadora fue el gol
  let golesSim: number[] = []
  for (let t = 0; t < 20000; t++) {
    const g: number[] = []; let ga = 0, gb = 0
    for (const q of poss) if (Math.random() < q.p) {
      if (q.own) ga++; else gb++
      const tot = q.ix.reduce((a, i) => a + shots[i][2], 0); let r = Math.random() * tot
      g.push(q.ix.find(i => (r -= shots[i][2]) <= 0) ?? q.ix[q.ix.length - 1])
    }
    if (Math.min(ga, 5) === modal[0] && Math.min(gb, 5) === modal[1]) { golesSim = g; break }
  }
  const sum = (own: number) => shots.filter(s => s[3] === own).reduce((t, s) => t + s[2], 0)
  return { victoria: w / n, empate: d / n, derrota: 1 - (w + d) / n, xpts: (3 * w + d) / n, xg: sum(1), xg_rival: sum(0),
           marcadores: grid.map(r => r.map(c => c / n)), n, modal, modalP: best / n, golesSim }
}

/* ---------------------------------------------------------------- colores de club */
/** Color principal del club (media.clubes[club].color); por defecto el azul del DT. */
export const clubColor = (club: string | null | undefined, media: Any) => (club && media?.clubes?.[club]?.color) || 'var(--c-dt)'
function hexRgb(h: string) { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
/** Colores para dos equipos: si los principales se parecen, el rival viste de blanco. */
export function matchColors(club: string, rival: string, media: Any): [string, string] {
  const a = clubColor(club, media), b = clubColor(rival, media)
  const A = hexRgb(a), B = hexRgb(b)
  if (A && B && Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) < 120) return [a, '#f2f2f2']
  return [a, b === 'var(--c-dt)' ? '#eb6834' : b]
}
