/* Modos del perfil de un DT: agrupan las vistas para que quien llega sin contexto elija por pregunta,
   no por nombre técnico. Cada modo tiene su color (tarjeta, barra fija y subpestañas). */
import { L } from './settings'

export type TabKey = 'resumen' | 'dt' | 'transfer' | 'fases' | 'contexto' | 'tiempo' | 'jugadores' | 'bp' | 'tl' | 'banda' | 'bpdef' | 'sim' | 'whatif' | 'liga' | 'plan' | 'fichajes' | 'tablero' | 'vs' | 'metodo'
export type View = TabKey | 'hub'

export type Mode = {
  k: string
  name: string        // nombre corto (barra fija)
  title: string       // título de la tarjeta
  q: string           // la pregunta que responde
  desc: string        // qué vas a ver
  color: string
  subs: [TabKey, string][]
}

export const MODES: Mode[] = [
  { k: 'resumen', name: L('Resumen', 'Summary'), title: L('Su ADN en tres ideas', 'His DNA in three ideas'), q: L('¿Cómo juega este DT?', 'How does this coach play?'), color: '#3987e5',
    desc: L('Los rasgos que son suyos y no de sus jugadores, con los números clave de su carrera.', 'The traits that belong to him, not his players, plus the key numbers of his career.'), subs: [['resumen', L('Resumen', 'Summary')]] },
  { k: 'separar', name: L('¿DT o plantilla?', 'Coach or squad?'), title: L('¿DT o plantilla?', 'Coach or squad?'), q: L('¿El estilo es suyo o de sus jugadores?', 'Is the style his, or his players\'?'), color: '#e0662f',
    desc: L('Cuánto de cada rasgo pone el DT, la plantilla, el club y el rival, y si su estilo viaja con él de club en club.', 'How much of each trait comes from the coach, squad, club and opponent, and whether his style travels with him.'),
    subs: [['dt', L('DT vs plantilla', 'Coach vs squad')], ['transfer', L('Prueba de transferencia', 'Transfer test')]] },
  { k: 'juego', name: L('Cómo juega', 'How he plays'), title: L('Cómo juega', 'How he plays'), q: L('¿Dónde y cómo ataca y defiende?', 'How does he attack and defend?'), color: '#1fae7a',
    desc: L('Cómo crea peligro y cómo defiende, sus formaciones con y sin balón, mapas de presión y tiro, y cómo cambia según marcador, minuto y rival, y si se mantiene con el tiempo.', 'How it creates danger and defends, line-ups with and without the ball, pressing and shot maps, how it shifts with score, clock and opponent, and whether it holds over time.'),
    subs: [['fases', L('Estilo y zonas', 'Style & zones')], ['contexto', L('Según el partido', 'Game situations')], ['tiempo', L('A lo largo del tiempo', 'Over time')]] },
  { k: 'jugadores', name: L('Jugadores', 'Players'), title: L('Sus jugadores', 'His players'), q: L('¿A quién usa y cómo los mueve?', 'Who does he pick, and how?'), color: '#e8b10c',
    desc: L('Formaciones, titulares por línea, rotación y qué cambia cuando mete a alguien desde la banca.', 'Formations, starters by line, rotation, and what changes when he goes to the bench.'), subs: [['jugadores', L('Jugadores', 'Players')]] },
  { k: 'bp', name: L('Balón parado', 'Set pieces'), title: L('Balón parado', 'Set pieces'), q: L('¿Qué hace a balón parado?', 'What does he do at set pieces?'), color: '#de4f87',
    desc: L('Córners en 2D y 3D: a dónde los manda, cuánto xG generan, dónde se paran sus jugadores. Tiros libres: desde dónde los tira, dónde centra, a dónde van en el arco y quién los cobra.', 'Corners in 2D and 3D: where he sends them, how much xG they create, where his players stand. Free kicks: where he takes them from, where he crosses, where they go in the goal and who takes them.'), subs: [['bp', L('Córners', 'Corners')], ['tl', L('Tiros libres', 'Free kicks')], ['banda', L('Saques de banda', 'Throw-ins')], ['bpdef', L('Cómo defiende', 'How he defends')]] },
  { k: 'lab', name: L('Laboratorio', 'Lab'), title: L('Laboratorio', 'Lab'), q: L('¿Y si se jugara otra vez?', 'What if it were played again?'), color: '#8f6cf0',
    desc: L('Rejuega sus partidos con el xG de cada tiro, o llévalo a dirigir otro club con el once que quieras, y juega un torneo completo con liguilla.', 'Replay his matches with the xG of every shot, send him to another club with the XI you choose, and play a full tournament with playoffs.'),
    subs: [['sim', L('Rejugar partidos', 'Replay matches')], ['whatif', L('Llévalo a otro club', 'Move him to another club')], ['liga', L('Simulador de liga', 'League simulator')]] },
  { k: 'vs', name: L('Cara a cara', 'Head to head'), title: L('Cara a cara', 'Head to head'), q: L('¿En qué se parece a otro DT?', 'Who does he play like?'), color: '#e5484d',
    desc: L('Compara su estilo propio contra cualquier otro entrenador, rasgo por rasgo.', 'Compare his own style with any other coach, trait by trait.'), subs: [['vs', '1 vs 1']] },
  { k: 'plan', name: L('Plan de partido', 'Game plan'), title: L('Qué hacer con su ADN', 'What to do with his DNA'), q: L('¿Cómo le juego y qué le conviene?', 'How do I play him, and what suits him?'), color: '#11a3b4',
    desc: L('Claves para enfrentarlo con su evidencia, los jugadores que encajan con su estilo y un tablero para vigilar si sigue siendo él.', 'Keys to face him with their evidence, the players who fit his style and a dashboard to check he is still himself.'),
    subs: [['plan', L('Cómo jugarle', 'How to play him')], ['fichajes', L('Jugadores a su medida', 'Players who fit')], ['tablero', L('Seguimiento', 'Tracking')]] },
  { k: 'metodo', name: L('Método', 'Method'), title: L('Método', 'Method'), q: L('¿Cómo se calcula todo esto?', 'How is all this calculated?'), color: '#8a9a92',
    desc: L('El modelo, sus supuestos y sus límites.', 'The model, its assumptions and its limits.'), subs: [['metodo', L('Método', 'Method')]] },
]

/** Texto legible sobre el color del modo (oscuro sobre amarillo, blanco sobre el resto). */
export const inkOn = (hex: string) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; const L = 0.2126 * f(n >> 16 & 255) + 0.7152 * f(n >> 8 & 255) + 0.0722 * f(n & 255); return 1.05 / (L + 0.05) >= (L + 0.05) / 0.06 ? '#fff' : '#14100a' }   // el de mayor contraste (WCAG)

/** Título que depende del DT: "Su ADN en dos ideas" si su resumen tiene dos rasgos claros, etc. */
export function modeTitle(m: Mode, art?: { narrativa?: { principios?: unknown[] } } | null) {
  if (m.k !== 'resumen') return m.title
  const n = art?.narrativa?.principios?.length ?? 3
  if (n === 0) return L('Su ADN', 'His DNA')
  const i = Math.min(n, 8) - 1
  return L(`Su ADN en ${['una idea', 'dos ideas', 'tres ideas', 'cuatro ideas', 'cinco ideas', 'seis ideas', 'siete ideas', 'ocho ideas'][i]}`,
    `His DNA in ${['one idea', 'two ideas', 'three ideas', 'four ideas', 'five ideas', 'six ideas', 'seven ideas', 'eight ideas'][i]}`)
}

export const modeOf = (t: View) => MODES.find(m => m.subs.some(([k]) => k === t)) ?? MODES[0]
export const TAB_KEYS = MODES.flatMap(m => m.subs.map(([k]) => k))
