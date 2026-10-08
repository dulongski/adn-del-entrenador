/* Ajustes del visitante (paleta, tipografía, idioma, logo). Se guardan en el navegador y se aplican
   ANTES de pintar la app (main.tsx); al cambiarlos se recarga la página para que todo —incluidos los
   lienzos 3D y los textos— salga ya con la nueva configuración. */
import type { LogoKind } from './Logo'

export type Palette = 'noche' | 'crema' | 'estadio' | 'pizarra' | 'atardecer'
export type Font = 'inter' | 'sistema' | 'dmsans' | 'source'
export type Lang = 'es' | 'en'
export type Settings = { palette: Palette; font: Font; lang: Lang; logo: LogoKind }

export const PALETTES: { k: Palette; es: string; en: string; sw: string[] }[] = [
  { k: 'noche', es: 'Noche', en: 'Night', sw: ['#111814', '#18211c', '#3987e5', '#d95926', '#199e70'] },
  { k: 'crema', es: 'Crema', en: 'Cream', sw: ['#F4F0E6', '#FFFFFF', '#1FA97A', '#9BE5C8', '#EF4B5F'] },
  { k: 'estadio', es: 'Estadio', en: 'Stadium', sw: ['#0B1226', '#121B36', '#FFD23F', '#4CC9F0', '#FF6B6B'] },
  { k: 'pizarra', es: 'Pizarra', en: 'Chalkboard', sw: ['#1F2A27', '#263330', '#F2EFE6', '#FFE38A', '#8EC5FF'] },
  { k: 'atardecer', es: 'Atardecer', en: 'Sunset', sw: ['#1A1220', '#241A2C', '#FF7A59', '#FFC857', '#2EC4B6'] },
]
export const FONTS: { k: Font; label: string; css: string }[] = [
  { k: 'inter', label: 'Inter', css: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { k: 'sistema', label: 'Sistema (SF Pro / Segoe)', css: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" },
  { k: 'dmsans', label: 'DM Sans', css: "'DM Sans', system-ui, sans-serif" },
  { k: 'source', label: 'Source Sans 3', css: "'Source Sans 3', system-ui, sans-serif" },
]

const DEF: Settings = { palette: 'noche', font: 'inter', lang: 'es', logo: 'helix' }
const KEY = 'coachdna.settings'

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    const s = raw ? { ...DEF, ...JSON.parse(raw) } : { ...DEF }
    // tema viejo (oscuro/claro) → paleta nueva
    if (!raw) { const old = localStorage.getItem('theme'); if (old === 'light') s.palette = 'crema' }
    if (!PALETTES.some(p => p.k === s.palette)) s.palette = DEF.palette
    if (!FONTS.some(f => f.k === s.font)) s.font = DEF.font
    if (s.lang !== 'en') s.lang = 'es'
    s.logo = 'helix'
    return s
  } catch { return { ...DEF } }
}

export const SETTINGS: Settings = read()
export const LANG: Lang = SETTINGS.lang

/** Texto según el idioma elegido: L('Partidos', 'Matches'). */
export const L = (es: string, en: string) => (LANG === 'en' ? en : es)
/** Formato de números y fechas del idioma. */
export const LOCALE = LANG === 'en' ? 'en-US' : 'es-MX'

export function applySettings(s: Settings = SETTINGS) {
  const el = document.documentElement
  el.setAttribute('data-theme', s.palette)
  el.setAttribute('lang', s.lang)
  el.style.setProperty('--body', FONTS.find(f => f.k === s.font)!.css)
}

export function saveSettings(patch: Partial<Settings>) {
  const next = { ...SETTINGS, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* sin almacenamiento: se aplica sólo en esta visita */ }
  applySettings(next)
  window.location.reload()
}
