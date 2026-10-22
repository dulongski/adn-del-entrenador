/* Modos del perfil de un DT: agrupan las vistas para que quien llega sin contexto elija por pregunta,
   no por nombre técnico. Cada modo tiene su color (tarjeta, barra fija y subpestañas). */
import { L } from './settings'

export type TabKey = 'resumen' | 'dt' | 'transfer' | 'fases' | 'contexto' | 'tiempo' | 'jugadores' | 'bp' | 'tl' | 'banda' | 'bpdef' | 'sim' | 'whatif' | 'liga' | 'plan' | 'fichajes' | 'tablero' | 'vs' | 'duelo' | 'metodo'
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
    desc: L('Los rasgos que son suyos y no de sus jugadores, con los números clave de su carrera y cómo vigilar si sigue jugando igual.', 'The traits that belong to him, not his players, plus the key numbers of his career and how to track whether he still plays the same way.'), subs: [['resumen', L('Resumen', 'Summary')], ['tablero', L('Seguimiento', 'Tracking')]] },
  { k: 'separar', name: L('¿DT o plantilla?', 'Coach or squad?'), title: L('¿DT o plantilla?', 'Coach or squad?'), q: L('¿El estilo es suyo o de sus jugadores?', 'Is the style his, or his players\'?'), color: '#e0662f',
    desc: L('Cuánto de cada rasgo pone el DT, la plantilla, el club, el rival y el contexto.', 'How much of each trait comes from the coach, squad, club, opponent and context.'),
    subs: [['dt', L('DT vs plantilla', 'Coach vs squad')]] },
  { k: 'juego', name: L('Cómo juega', 'How he plays'), title: L('Cómo juega', 'How he plays'), q: L('¿Dónde y cómo ataca y defiende?', 'How does he attack and defend?'), color: '#1fae7a',
    desc: L('Cómo crea peligro y cómo defiende, sus formaciones con y sin balón, mapas de presión y tiro, y cómo cambia según marcador, minuto y rival, y si se mantiene con el tiempo.', 'How it creates danger and defends, line-ups with and without the ball, pressing and shot maps, how it shifts with score, clock and opponent, and whether it holds over time.'),
    subs: [['fases', L('Estilo y zonas', 'Style & zones')], ['contexto', L('Según el partido', 'Game situations')], ['tiempo', L('A lo largo del tiempo', 'Over time')]] },
  { k: 'jugadores', name: L('Jugadores', 'Players'), title: L('Sus jugadores', 'His players'), q: L('¿A quién usa y cómo los mueve?', 'Who does he pick, and how?'), color: '#e8b10c',
    desc: L('Formaciones, titulares por línea, rotación, qué cambia cuando mete a alguien desde la banca y qué jugadores de la liga le encajan.', 'Formations, starters by line, rotation, what changes when he goes to the bench and which league players fit him.'), subs: [['jugadores', L('Jugadores', 'Players')], ['fichajes', L('Jugadores a su medida', 'Players who fit')]] },
  { k: 'bp', name: L('Balón parado', 'Set pieces'), title: L('Balón parado', 'Set pieces'), q: L('¿Qué hace a balón parado?', 'What does he do at set pieces?'), color: '#de4f87',
    desc: L('Córners en 2D y 3D: a dónde los manda, cuánto xG generan, dónde se paran sus jugadores. Tiros libres: desde dónde los tira, dónde centra, a dónde van en el arco y quién los cobra.', 'Corners in 2D and 3D: where he sends them, how much xG they create, where his players stand. Free kicks: where he takes them from, where he crosses, where they go in the goal and who takes them.'), subs: [['bp', L('Córners', 'Corners')], ['tl', L('Tiros libres', 'Free kicks')], ['banda', L('Saques de banda', 'Throw-ins')], ['bpdef', L('Cómo defiende', 'How he defends')]] },
  { k: 'lab', name: L('Laboratorio', 'Lab'), title: L('Laboratorio', 'Lab'), q: L('¿Y si se jugara otra vez?', 'What if it were played again?'), color: '#8f6cf0',
    desc: L('Rejuega sus partidos con el xG de cada tiro, o llévalo a dirigir otro club con el once que quieras, y juega un torneo completo con liguilla.', 'Replay his matches with the xG of every shot, send him to another club with the XI you choose, and play a full tournament with playoffs.'),
    subs: [['sim', L('Rejugar partidos', 'Replay matches')], ['whatif', L('Llévalo a otro club', 'Move him to another club')], ['liga', L('Simulador de liga', 'League simulator')]] },
  { k: 'vs', name: L('Cara a cara', 'Head to head'), title: L('Cara a cara', 'Head to head'), q: L('¿En qué se parece a otro DT?', 'Who does he play like?'), color: '#e5484d',
    desc: L('Compara su estilo propio contra cualquier otro entrenador, cómo jugarle a él y el plan concreto para enfrentar a un técnico o equipo.', 'Compare his own style with any other coach, how to play against him and the concrete plan to face a specific coach or team.'), subs: [['vs', '1 vs 1'], ['plan', L('Cómo jugarle', 'How to play him')], ['duelo', L('Plan contra un rival', 'Game plan vs a rival')]] },
  { k: 'metodo', name: L('Método', 'Method'), title: L('Método', 'Method'), q: L('¿Cómo se calcula todo esto?', 'How is all this calculated?'), color: '#8a9a92',
    desc: L('El modelo, sus supuestos y sus límites.', 'The model, its assumptions and its limits.'), subs: [['metodo', L('Método', 'Method')], ['transfer', L('Prueba de transferencia', 'Transfer test')]] },
]

/** Texto legible sobre el color del modo (oscuro sobre amarillo, blanco sobre el resto). */
export const inkOn = (hex: string) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; const L = 0.2126 * f(n >> 16 & 255) + 0.7152 * f(n >> 8 & 255) + 0.0722 * f(n & 255); return 1.05 / (L + 0.05) >= (L + 0.05) / 0.06 ? '#fff' : '#14100a' }   // el de mayor contraste (WCAG)

/** Título de cada modo; el del resumen cuenta la historia y el ADN del DT. */
export function modeTitle(m: Mode, _art?: unknown) {
  return m.k === 'resumen' ? L('Su historia y su ADN', 'His story and his DNA') : m.title
}

export const modeOf = (t: View) => MODES.find(m => m.subs.some(([k]) => k === t)) ?? MODES[0]
export const TAB_KEYS = MODES.flatMap(m => m.subs.map(([k]) => k))
