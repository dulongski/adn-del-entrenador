import { loadFont as loadGeist } from '@remotion/google-fonts/Geist'
import { loadFont as loadMono } from '@remotion/google-fonts/GeistMono'
import { loadFont as loadDisplay } from '@remotion/google-fonts/BigShoulders'

export const { fontFamily: SANS } = loadGeist('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin', 'latin-ext'] })
export const { fontFamily: MONO } = loadMono('normal', { weights: ['400', '500'], subsets: ['latin', 'latin-ext'] })
/* el logotipo de la app usa Big Shoulders: se conserva sólo para la palabra COACH DNA */
export const { fontFamily: DISPLAY } = loadDisplay('normal', { weights: ['900'], subsets: ['latin'] })

/* Paleta "crema" de la app: papel, tinta verde-negra, menta y rojo rosado reservado para el DT protagonista. */
export const C = {
  paper: '#F4F0E6',
  white: '#FFFFFF',
  ink: '#10201A',
  ink2: '#4A5A52',
  ink3: '#8A938C',
  grid: '#E6E0D2',
  grid2: '#D8D1C0',
  mint: '#9BE5C8',
  mintDeep: '#1FA97A',
  rose: '#EF4B5F',
}
export const FPS = 30
/* música: Minimal Electronica (Kulakovka, Pixabay). Arranca en 73.654 s para que el "drop" (85.654 s) caiga en el segundo 12. */
export const MUSIC_START_S = 73.654
export const DROP = 12 * FPS
export const BEAT = (60 / 117.5) * FPS        // ≈ 15.32 fotogramas
export const beat = (k: number) => Math.round(DROP + k * BEAT)
