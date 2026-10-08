import { loadFont as loadDisplay } from '@remotion/google-fonts/BigShoulders'
import { loadFont as loadBody } from '@remotion/google-fonts/SourceSans3'

export const { fontFamily: DISPLAY } = loadDisplay('normal', { weights: ['900'], subsets: ['latin', 'latin-ext'] })
export const { fontFamily: BODY } = loadBody('normal', { weights: ['400', '700'], subsets: ['latin', 'latin-ext'] })

/* Paleta del tráiler: papel crema, tinta verde-negra de la app, menta y un rojo rosado sólo para resaltar. */
export const C = {
  paper: '#F4F0E6',
  white: '#FFFFFF',
  ink: '#10201A',
  ink2: '#4A5A52',
  mint: '#9BE5C8',
  mintDeep: '#1FA97A',
  rose: '#EF4B5F',
  line: '#D9D3C4',
}
/* familias de estilo en el mapa: tonos de la misma paleta */
export const FAM = ['#1FA97A', '#EF4B5F', '#6FB7D6', '#E3B04B']
export const FPS = 30
