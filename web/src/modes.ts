/* Modos del perfil de un DT: agrupan las vistas para que quien llega sin contexto elija por pregunta,
   no por nombre técnico. Cada modo tiene su color (tarjeta, barra fija y subpestañas). */

export type TabKey = 'resumen' | 'dt' | 'transfer' | 'fases' | 'contexto' | 'jugadores' | 'bp' | 'sim' | 'whatif' | 'vs' | 'metodo'
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
  { k: 'resumen', name: 'Resumen', title: 'Su ADN en tres ideas', q: '¿Cómo juega este DT?', color: '#3987e5',
    desc: 'Los rasgos que son suyos y no de sus jugadores, con los números clave de su carrera.', subs: [['resumen', 'Resumen']] },
  { k: 'separar', name: '¿DT o plantilla?', title: '¿DT o plantilla?', q: '¿El estilo es suyo o de sus jugadores?', color: '#e0662f',
    desc: 'Cuánto de cada rasgo pone el DT, la plantilla, el club y el rival, y si su estilo viaja con él de club en club.',
    subs: [['dt', 'DT vs plantilla'], ['transfer', 'Prueba de transferencia']] },
  { k: 'juego', name: 'Cómo juega', title: 'Cómo juega', q: '¿Dónde y cómo ataca y defiende?', color: '#1fae7a',
    desc: 'Sus jugadas tipo, mapas de presión y tiro, red de pases, y cómo cambia según marcador, minuto y rival.',
    subs: [['fases', 'Estilo y zonas'], ['contexto', 'Según el partido']] },
  { k: 'jugadores', name: 'Jugadores', title: 'Sus jugadores', q: '¿A quién usa y cómo los mueve?', color: '#e8b10c',
    desc: 'Formaciones, titulares por línea, rotación y qué cambia cuando mete a alguien desde la banca.', subs: [['jugadores', 'Jugadores']] },
  { k: 'bp', name: 'Balón parado', title: 'Balón parado', q: '¿Qué hace en córners y tiros libres?', color: '#de4f87',
    desc: 'Córners en 3D: a dónde los manda, cuánto xG generan, dónde se paran sus jugadores. Puedes simularlos.', subs: [['bp', 'Balón parado']] },
  { k: 'lab', name: 'Laboratorio', title: 'Laboratorio', q: '¿Y si se jugara otra vez?', color: '#8f6cf0',
    desc: 'Rejuega sus partidos con el xG de cada tiro, o llévalo a dirigir otro club con el once que quieras.',
    subs: [['sim', 'Rejugar partidos'], ['whatif', 'Llévalo a otro club']] },
  { k: 'vs', name: 'Cara a cara', title: 'Cara a cara', q: '¿En qué se parece a otro DT?', color: '#e5484d',
    desc: 'Compara su estilo propio contra cualquier otro entrenador, rasgo por rasgo.', subs: [['vs', '1 vs 1']] },
  { k: 'metodo', name: 'Método', title: 'Método', q: '¿Cómo se calcula todo esto?', color: '#8a9a92',
    desc: 'El modelo, sus supuestos y sus límites.', subs: [['metodo', 'Método']] },
]

/** Texto legible sobre el color del modo (oscuro sobre amarillo, blanco sobre el resto). */
export const inkOn = (hex: string) => { const n = parseInt(hex.slice(1), 16); const l = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? '#14100a' : '#fff' }

/** Título que depende del DT: "Su ADN en dos ideas" si su resumen tiene dos rasgos claros, etc. */
export function modeTitle(m: Mode, art?: { narrativa?: { principios?: unknown[] } } | null) {
  if (m.k !== 'resumen') return m.title
  const n = art?.narrativa?.principios?.length ?? 3
  return n === 0 ? 'Su ADN' : `Su ADN en ${['una idea', 'dos ideas', 'tres ideas', 'cuatro ideas'][Math.min(n, 4) - 1]}`
}

export const modeOf = (t: View) => MODES.find(m => m.subs.some(([k]) => k === t)) ?? MODES[0]
export const TAB_KEYS = MODES.flatMap(m => m.subs.map(([k]) => k))
