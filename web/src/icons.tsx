import type { ReactNode } from 'react'

/* Iconos de línea (24×24, trazo redondeado) para los selectores y filtros de toda la app.
   iconFor(clave, etiqueta) elige uno por palabras clave; si no hay coincidencia, no pone nada. */
const P: Record<string, ReactNode> = {
  all: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  build: <><path d="M4 19h16" /><path d="M6 19v-5h4v5" /><path d="M12 19V9h4v10" /><path d="M5 8l4-4 4 4" /></>,
  progress: <><path d="M4 18l6-6 4 4 6-8" /><path d="M15 8h5v5" /></>,
  chance: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>,
  press: <><path d="M13 3L5 13h6l-1 8 8-11h-6z" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /></>,
  swap: <><path d="M4 8h13" /><path d="M14 4l4 4-4 4" /><path d="M20 16H7" /><path d="M10 12l-4 4 4 4" /></>,
  crown: <><path d="M4 8l4 4 4-7 4 7 4-4-1.5 10h-13z" /></>,
  flag: <><path d="M6 21V4" /><path d="M6 5h11l-2 4 2 4H6" /></>,
  eye: <><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  person: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-4 3.4-6 7-6s6.2 2 7 6" /></>,
  users: <><circle cx="9" cy="9" r="3" /><path d="M3 19c.6-3.3 2.8-5 6-5s5.4 1.7 6 5" /><circle cx="17" cy="8" r="2.4" /><path d="M16.5 13.3c2.5.2 4 1.7 4.5 4.7" /></>,
  club: <><path d="M5 20V9l7-5 7 5v11" /><path d="M9 20v-6h6v6" /></>,
  rival: <><path d="M5 5l14 14" /><path d="M19 5L5 19" /><circle cx="12" cy="12" r="2" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>,
  away: <><path d="M3 11l18-7-6 17-3-7z" /></>,
  sword: <g transform="rotate(45 12 12)"><path d="M12 1.5l2.2 3.3V14H9.8V4.8z" /><path d="M6.5 14h11" /><path d="M12 14v5" /><circle cx="12" cy="20.5" r="1.1" /></g>,
  flame: <><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-1-5 1-8z" /></>,
  ball: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5l3.5 2.5-1.3 4h-4.4L8.5 10z" /><path d="M12 3.5v4M15.5 10l4-1.3M14.2 14l2.4 3.4M9.8 14l-2.4 3.4M8.5 10L4.5 8.7" /></>,
  cube: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9" /></>,
  square: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 12h16M12 4v16" opacity=".5" /></>,
  play: <><path d="M8 5l11 7-11 7z" /></>,
  compare: <><path d="M8 4v16M16 4v16" /><path d="M4 8h8M12 16h8" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></>,
  trend: <><path d="M3 17l5-6 4 3 8-9" /></>,
  scale: <><path d="M12 4v16M6 20h12" /><path d="M5 8h14" /><path d="M5 8l-2.5 6a3 3 0 005 0zM19 8l-2.5 6a3 3 0 005 0z" /></>,
  ruler: <><rect x="3" y="8" width="18" height="8" rx="1.5" /><path d="M7 8v3M11 8v4M15 8v3M19 8v4" /></>,
  heat: <><circle cx="9" cy="10" r="4" opacity=".6" /><circle cx="15" cy="14" r="4" /></>,
  bolt: <><path d="M13 3L5 13h6l-1 8 8-11h-6z" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></>,
  target: <><circle cx="12" cy="12" r="8" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
  trophy: <><path d="M7 4h10v5a5 5 0 01-10 0z" /><path d="M7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3" /><path d="M12 14v4M8 20h8" /></>,
  swords: <><path d="M5 5l9 9M19 5l-9 9" /><path d="M4 17l3 3M20 17l-3 3" /></>,
  down: <><path d="M12 4v14" /><path d="M6 13l6 6 6-6" /></>,
  up: <><path d="M12 20V6" /><path d="M6 11l6-6 6 6" /></>,
  card: <><rect x="6" y="3.5" width="12" height="17" rx="2" /></>,
  left: <><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></>,
  right: <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
  swapfeet: <><path d="M7 7h10l-3-3M17 17H7l3 3" /></>,
}
export type IconName = keyof typeof P

export function Ico({ name, size = 16 }: { name: IconName | string; size?: number }) {
  const d = P[name as string]
  if (!d) return null
  return <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** [expresión, icono]: gana la primera que coincida con «clave etiqueta». */
const RULES: [RegExp, IconName][] = [
  [/^(todas?|todos|all)\b|\btodos? \(/, 'all'],
  [/construccion|build-?up|salida/, 'build'],
  [/progres|progression|avance|recuperaciones/, 'progress'],
  [/ocasion|chance|oportunidad|tiro|shot|goles|goals/, 'chance'],
  [/organizacion defensiva|defensive organi|defiende|defends|defensa|defence|defense|bloque/, 'shield'],
  [/presion|press|pressing|ppda/, 'press'],
  [/transicion|transition|contra(ataque| )|counter|cambios?\b.*(dibujo|formation)/, 'swap'],
  [/dominio|domination|possession|posesion|territor/, 'crown'],
  [/balon parado|set piece|corner|tiros libres/, 'flag'],
  [/lo que se ve|what we see|observado|su valor|his value|en sus partidos/, 'eye'],
  [/el \(dt\)|\bdt\b|coach|su sello|his imprint|estilo propio/, 'person'],
  [/jugadores|players|plantilla|squad|alineacion|line-?up/, 'users'],
  [/club\b/, 'club'],
  [/rivales?|opponents?|fuerza del rival|opponent strength|en contra|against|defending/, 'rival'],
  [/marcador|scoreline/, 'scale'],
  [/contexto|context|minuto|minute|tiempo|time/, 'clock'],
  [/local|home\b/, 'home'],
  [/visita|away/, 'away'],
  [/a favor|attacking|ataca|attacks|ataque|attack/, 'sword'],
  [/izquierda|left/, 'left'], [/derecha|right/, 'right'], [/ambos|both/, 'all'],
  [/^3d$/, 'cube'], [/^2d$/, 'square'],
  [/simula|simulate|jugada a jugada|play by play|ver |watch|empezar|start/, 'play'],
  [/probabilidades|probabilities/, 'trend'],
  [/frente a la liga|vs league|versus league|diferencia|difference|liga\b|league/, 'compare'],
  [/volumen|volume/, 'heat'],
  [/mapa|map|calor|heat|presion\b/, 'heat'],
  [/torneo|tournament|liguilla|playoffs?/, 'trophy'],
  [/velocidad|speed|rapido|fast/, 'bolt'],
  [/campos?|pitch|zonas?|zones?/, 'target'],
  [/ataque|dibujo|formation|con balon|with the ball|sin balon|without/, 'ball'],
]
export function iconFor(key: string, label: string): IconName | null {
  const t = norm(`${key} ${label}`)
  const first = norm(label)
  for (const [re, n] of RULES) if (re.test(first)) return n
  for (const [re, n] of RULES) if (re.test(t)) return n
  return null
}
