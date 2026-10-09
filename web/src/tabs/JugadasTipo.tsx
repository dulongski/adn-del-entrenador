/* Jugadas tipo (ataque: cómo crea peligro · defensa: cómo se para según el rival) y Formaciones.
   Datos: web/public/data/jugadas_<id>.json (uno por DT, por club) y jugadas_liga.json (pipeline/jugadas_extra.py).
   Siempre del club elegido (por defecto el actual). */
import { useMemo, useState } from 'react'
import { fmt, jugadorCorto, type Any } from '../lib'
import { ClubLogo, Pitch, pitchXY, useTip } from '../charts'
import { apellidoCorto, PlayAnim } from '../PlayAnim'
import Info from '../Info'
import { L } from '../settings'
import { Seg } from './common'
import '../styles/jugadas.css'

const pctText = (p: number | null | undefined) => (p == null ? '' : L(`más alto que el ${p}% de los DTs`, `higher than ${p}% of coaches`))

/* ------------------------------------------------------------ ataque */
const useMore = (p: number | null | undefined) => (p == null ? '' : L(`lo usa más que el ${p}% de los DTs`, `uses it more than ${p}% of coaches`))

function Ataque({ pc, JG, liga, color, media, club }: { pc: Any; JG: Any; liga: Any; color: string; media: Any; club: string }) {
  // dos ejes que no se pisan: cómo se arma y cómo termina; cada uno se ordena por cuánto lo usa el equipo
  const blocks: Any[] = useMemo(() => liga.bloques.map((b: Any) => ({ ...b, cats: b.cats.map((c: Any) => ({ ...c, ...pc.ataque.cats[c.id], lg_share: c.share, lg_n: c.n })).sort((x: Any, y: Any) => (y.share ?? 0) - (x.share ?? 0)) })), [liga, pc])
  const all: Any[] = blocks.flatMap(b => b.cats)
  const [sel, setSel] = useState<string>(all[0].id)
  const [k, setK] = useState(0)
  const cur = all.find(c => c.id === sel) ?? all[0]
  const ex: Any[] = pc.ataque.ejemplos[cur.id] || []
  const e = ex[k]
  const max = Math.max(...all.map(c => Math.max(c.share ?? 0, c.lg_share ?? 0)), 1)
  const partido = e ? JG.partidos[e.m] : null
  const pj = pc.partidos
  return (
    <div className="arq">
      <div className="card arq-list">
        {blocks.map((bl: Any, bi: number) => (
          <div key={bl.id} className="jt-block">
            <div className="jt-list-h">{L(bl.es, bl.en)}{bi === 0 && <> <Info wide><p>{L('Sólo cuentan jugadas efectivas: las que terminan en tiro o llegan al área en juego abierto (sin balón parado ni penales).', 'Only effective moves count: those that end in a shot or reach the box in open play (no set pieces or penalties).')}</p><p>{L('Cada jugada se clasifica de dos maneras que no se pisan: cómo se armó (arriba) y cómo terminó (abajo). Así una salida desde atrás puede acabar en centro, y cuenta en una fila de cada bloque. La barra es el % de sus jugadas efectivas de ese tipo; la raya negra, el promedio de la liga.', 'Each move is classified in two ways that do not overlap: how it was built (top) and how it ended (bottom). So a build-up from the back can end in a cross, and it counts in one row of each block. The bar is the % of his effective moves of that type; the black line is the league average.')}</p></Info></>}</div>
            {bl.cats.map((c: Any) => (
              <button key={c.id} className="arq-row" aria-pressed={c.id === sel} onClick={() => { setSel(c.id); setK(0) }}>
                <span className="arq-name">{L(c.es, c.en)}</span>
                <span className="arq-bar"><span style={{ width: `${(c.share ?? 0) / max * 100}%`, background: color }} /><i style={{ left: `${(c.lg_share ?? 0) / max * 100}%` }} /></span>
                <span className="mono arq-val">{fmt(c.share, 0)}%</span>
              </button>
            ))}
          </div>
        ))}
        <div className="jt-list-f note">{L('% de sus jugadas efectivas · raya: liga', '% of his effective moves · line: league')}</div>
      </div>
      <div className="card arq-ex">
        <div className="arq-head">
          <div>
            <div className="h3" style={{ margin: 0 }}>{L(cur.es, cur.en)} <Info wide><p>{L(cur.desc_es, cur.desc_en)}</p><p>{L('Una de sus jugadas más peligrosas de este tipo en ', 'One of his most dangerous moves of this type at ')}{club}{L('. Sólo aparecen los jugadores que tocan el balón. Línea continua: pase; discontinua: conducción; punteada gris: tramo que los datos no registran. Ataque hacia la derecha.', '. Only players who touch the ball are shown. Solid line: pass; dashed: carry; grey dotted: a stretch the data does not capture. Attacking to the right.')}</p></Info></div>
            <div className="note">
              <b>{fmt(cur.share, 0)}%</b> {L('de sus jugadas efectivas', 'of his effective moves')} ({L('liga', 'league')} {fmt(cur.lg_share, 0)}%) · {fmt(cur.n, 1)} {L('por partido', 'per match')} ({L('liga', 'league')} {fmt(cur.lg_n, 1)}) · {cur.goles} {L(cur.goles === 1 ? 'gol' : 'goles', cur.goles === 1 ? 'goal' : 'goals')} {L('en', 'in')} {pj} {L('partidos', 'matches')}
              {cur.pct != null && <> · <b>{useMore(cur.pct)}</b></>}
              {pj < 10 && <> · <b className="jt-warn">{L('muestra chica', 'small sample')}</b></>}
            </div>
          </div>
          {ex.length > 0 && (
            <div className="carousel">
              <button onClick={() => setK((k - 1 + ex.length) % ex.length)} aria-label={L('Ejemplo anterior', 'Previous example')}>‹</button>
              <span className="mono">{k + 1} / {ex.length}</span>
              <button onClick={() => setK((k + 1) % ex.length)} aria-label={L('Ejemplo siguiente', 'Next example')}>›</button>
            </div>
          )}
        </div>
        {e ? <PlayAnim key={`${cur.id}-${k}-${club}`} seq={e.seq} meta={e} jugadores={JG.jugadores} partido={partido} club={club} color={color} media={media} />
          : <div className="note">{L(`Todavía no hay una jugada de este tipo con ${club}.`, `There is no move of this type yet with ${club}.`)}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ defensa (360) */
const MET: Record<string, { es: string; en: string; d_es: string; d_en: string; unit: string }> = {
  front: { es: 'Línea más adelantada', en: 'Highest line', unit: ' m', d_es: 'Altura media de sus 3 jugadores de campo más adelantados, en metros desde su propia portería.', d_en: 'Average height of its 3 most advanced outfield players, in metres from its own goal.' },
  back: { es: 'Línea defensiva', en: 'Defensive line', unit: ' m', d_es: 'Altura media de sus 4 jugadores de campo más atrasados, en metros desde su portería.', d_en: 'Average height of its 4 deepest outfield players, in metres from its own goal.' },
  cent: { es: 'Centro del equipo', en: 'Team centre', unit: ' m', d_es: 'Altura media de todos sus jugadores de campo visibles.', d_en: 'Average height of all visible outfield players.' },
  wid: { es: 'Ancho de la línea defensiva', en: 'Back-line width', unit: ' m', d_es: 'Distancia lateral entre el defensor más abierto de un lado y el del otro.', d_en: 'Sideways distance between the widest defender on each side.' },
  near: { es: 'Jugadores cerca del balón', en: 'Players near the ball', unit: '', d_es: 'Cuántos de sus jugadores de campo están a 15 m o menos del balón cuando el rival lo tiene.', d_en: 'How many of its outfield players are within 15 m of the ball when the opponent has it.' },
}
const KX = 105 / 120   // el 360 viene en metros; la cancha se dibuja en unidades de 120 × 80
const HEAD: Record<string, string> = { atras: 'front', medio: 'front', bajo: 'back', contra: 'front' }

function Defensa({ pc, liga, color }: { pc: Any; liga: Any; color: string }) {
  const D = pc.defensa
  const sits: Any[] = liga.sits.filter((s: Any) => D.sits[s.id])
  const [sel, setSel] = useState<string>(sits.find((s: Any) => s.id === 'medio')?.id ?? sits[0]?.id)
  const cur = sits.find((s: Any) => s.id === sel) ?? sits[0]
  if (!cur) return <div className="card"><div className="note">{L('Sin datos 360 para este club.', 'No 360 data for this club.')}</div></div>
  const d = D.sits[cur.id]
  const mets = Object.keys(d.liga ?? {})
  return (
    <div className="arq">
      <div className="card arq-list">
        <div className="jt-list-h">{L('Cómo se para según lo que hace el rival', 'How it sets up depending on what the opponent does')} <Info wide><p>{L('Con los datos 360 (la foto de dónde están los jugadores en cada evento) se mide dónde se para el equipo cuando el rival tiene el balón, separando cuatro situaciones. La barra es la altura de su línea clave en metros desde su portería; la raya negra, el promedio de la liga.', 'Using the 360 data (a snapshot of where players stand at each event) we measure where the team stands while the opponent has the ball, split into four situations. The bar is the height of its key line in metres from its own goal; the black line is the league average.')}</p><p>{L('El 360 sólo muestra la parte de la cancha que ve la cámara, por eso cada situación usa las medidas que sí se ven bien. Sólo juego abierto, sin balón parado.', 'The 360 data only shows the part of the pitch the camera sees, so each situation uses the measures that are reliably visible. Open play only, no set pieces.')}</p></Info></div>
        {sits.map((s: Any) => {
          const m = HEAD[s.id], v = D.sits[s.id][m], lg = D.sits[s.id].liga?.[m]
          const diff = v != null && lg != null ? v - lg : null
          return (
            <button key={s.id} className="arq-row jt-sit" aria-pressed={s.id === sel} onClick={() => setSel(s.id)}>
              <span className="arq-name">{L(s.es, s.en)}<small>{L(MET[m].es, MET[m].en)}</small></span>
              <span className="arq-bar"><span style={{ width: `${(v ?? 0) / 110 * 100}%`, background: color }} /><i style={{ left: `${(lg ?? 0) / 110 * 100}%` }} /></span>
              <span className="mono arq-val">{v != null ? fmt(v, 0) : '—'}<small className={diff != null && diff >= 0 ? 'up' : 'dn'}>{diff != null ? `${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff), 1)}` : ''}</small></span>
            </button>
          )
        })}
        <div className="jt-list-f note">{L('Metros desde su portería · raya: liga', 'Metres from its own goal · line: league')}</div>
      </div>
      <div className="card arq-ex">
        <div className="arq-head">
          <div>
            <div className="h3" style={{ margin: 0 }}>{L(cur.es, cur.en)} <Info wide><p>{L(cur.desc_es, cur.desc_en)}</p><p>{L('El equipo ataca hacia arriba y su portería está abajo. Los puntos son la posición media de sus 10 jugadores de campo en esa situación (por hueco, no por nombre: el 360 no identifica jugadores); el círculo blanco es dónde suele estar el balón; la línea punteada es el promedio de la liga. Se ve toda la cancha; el ancho sólo usa fotos donde la cámara ve de banda a banda.', 'The team attacks upwards and its goal is at the bottom. The dots are the average position of its 10 outfield players in that situation (by slot, not by name: 360 data does not identify players); the white circle is where the ball usually is; the dashed line is the league average. The whole pitch is shown; width only uses frames where the camera sees touchline to touchline.')}</p></Info></div>
            <div className="note">{d.partidos} {L('partidos', 'matches')} · {fmt(d.n, 0)} {L('eventos del rival', 'opponent events')}{d.pocos && <> · <b className="jt-warn">{L('muestra chica', 'small sample')}</b></>}</div>
          </div>
        </div>
        <div className="jt-def">
          <div className="jt-pitch"><BlockPitch d={d} tam={D.tam} color={color} /></div>
          <div className="jt-mets">
            {mets.map(m => (
              <div key={m} className="jt-met">
                <div className="jt-met-l">{L(MET[m].es, MET[m].en)} <Info>{L(MET[m].d_es, MET[m].d_en)}</Info></div>
                <div className="jt-met-v mono">{d[m] != null ? `${fmt(d[m], m === 'near' ? 1 : 1)}${MET[m].unit}` : '—'}</div>
                <div className="jt-met-t"><i className="mid" />{d.pct?.[m] != null && <i className="dot" style={{ left: `${d.pct[m]}%`, background: color }} />}</div>
                <div className="jt-met-s note">{L('liga', 'league')} {d.liga?.[m] != null ? `${fmt(d.liga[m], 1)}${MET[m].unit}` : '—'}{d.pct?.[m] != null && <> · {pctText(d.pct[m])}</>}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Cancha vertical (ataque hacia arriba, su portería abajo) con el bloque medio: 10 puntos por hueco, unidos por línea. */
function BlockPitch({ d, tam, color }: { d: Any; tam: number[]; color: string }) {
  const forma: number[][] | null = d.forma
  const bola: number[] | null = d.bola?.[0] != null ? d.bola : null
  const lines: number[][][] = []
  if (forma) { let i = 0; for (const n of tam) { lines.push(forma.slice(i, i + n)); i += n } }
  const lgLines = (['front', 'back'] as const).filter(m => d.liga?.[m] != null).map(m => ({ m, x: (d.liga[m] as number) / KX }))   // metros -> unidades de la cancha
  return (
    <Pitch vertical labels={<>
      {!forma && (['front', 'back'] as const).filter(m => d[m] != null).map(m => { const [tx, ty] = pitchXY(d[m] / KX, 79, true); return <text key={'b' + m} x={tx} y={ty - 1.2} fontSize={2.8} textAnchor="end" fontWeight={700} fill={color}>{m === 'front' ? L('línea adelantada', 'front line') : L('línea defensiva', 'back line')} · {fmt(d[m], 0)} m</text> })}
      {!forma && (() => { const [tx, ty] = pitchXY(52, 40, true); return <g><rect x={tx - 34} y={ty - 6.5} width={68} height={13} rx={2} fill="var(--card, #14201a)" fillOpacity={0.88} /><text x={tx} y={ty - 1} fontSize={3} textAnchor="middle" fill="var(--ink-2)">{L('Pocas fotos con los 10 jugadores a la vista:', 'Few frames show all 10 players:')}</text><text x={tx} y={ty + 3.4} fontSize={3} textAnchor="middle" fill="var(--ink-2)">{L('sólo se miden las líneas, no la forma.', 'only the lines are measured, not the shape.')}</text></g> })()}
      {lgLines.map(l => { const [tx, ty] = pitchXY(l.x, 2, true); return <text key={l.m} x={tx + 1} y={ty - 0.8} fontSize={2.6} fill="var(--ink-3)">{L('liga', 'league')} {l.m === 'front' ? L('adelante', 'front') : L('atrás', 'back')}</text> })}
    </>}>
      {lgLines.map(l => <line key={l.m} x1={l.x} y1={0} x2={l.x} y2={80} stroke="var(--ink-3)" strokeWidth={0.35} strokeDasharray="1.6 1.4" />)}
      {forma ? (
        <>
          {lines.map((ln, i) => ln.length > 1 && <polyline key={i} points={ln.map(p => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke={color} strokeOpacity={0.5} strokeWidth={0.7} strokeLinejoin="round" />)}
          {forma.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill={color} stroke="var(--ink)" strokeOpacity={0.55} strokeWidth={0.4} />)}
        </>
      ) : (
        <>
          {d.front != null && d.back != null && <rect x={d.back / KX} y={8} width={Math.max(0, (d.front - d.back) / KX)} height={64} fill={color} fillOpacity={0.12} />}
          {d.front != null && <line x1={d.front / KX} y1={8} x2={d.front / KX} y2={72} stroke={color} strokeWidth={1.6} strokeLinecap="round" />}
          {d.back != null && <line x1={d.back / KX} y1={8} x2={d.back / KX} y2={72} stroke={color} strokeOpacity={0.7} strokeWidth={1.6} strokeLinecap="round" />}
        </>
      )}
      {bola && <g><circle cx={bola[0]} cy={bola[1]} r={2} fill="#fff" stroke="var(--ink)" strokeWidth={0.6} /><circle cx={bola[0]} cy={bola[1]} r={3.4} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={0.4} /></g>}
    </Pitch>
  )
}

/* ------------------------------------------------------------ contenedor */
export function JugadasTipo({ pc, JG, liga, color, media, club }: { pc: Any; JG: Any; liga: Any; color: string; media: Any; club: string }) {
  const [mode, setMode] = useState<'ataque' | 'defensa'>('ataque')
  return (
    <div>
      <div className="jt-mode"><Seg opts={[['ataque', L('Cómo ataca', 'How it attacks')], ['defensa', L('Cómo defiende', 'How it defends')]]} v={mode} set={s => setMode(s as Any)} /></div>
      {mode === 'ataque' ? <Ataque pc={pc} JG={JG} liga={liga} color={color} media={media} club={club} /> : <Defensa pc={pc} liga={liga} color={color} />}
    </div>
  )
}

/* ------------------------------------------------------------ formaciones */
type Box = { x0: number; y0: number; x1: number; y1: number }
const FS = 2.7

/** Etiquetas sin chocar: la primera posición libre alrededor de cada punto (abajo, arriba, derecha, izquierda, diagonales);
 *  si ninguna queda libre, abajo con línea guía. Cancha vertical (se usa pitchXY). */
function layoutLabels(nodes: { id: number; x: number; y: number; t: string }[], r: number) {
  const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
  if (ctx) ctx.font = '600 100px "Source Sans 3", system-ui, sans-serif'
  const textW = (t: string) => (ctx ? ctx.measureText(t).width / 100 * FS : t.length * FS * 0.55)
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
  const nodeBoxes: Box[] = nodes.map(n => { const [x, y] = pitchXY(n.x, n.y, true); return { x0: x - r, y0: y - r, x1: x + r, y1: y + r } })
  const placed: Box[] = []
  const out: { id: number; x: number; y: number; t: string; anchor: 'middle' | 'start' | 'end'; lx?: number; ly?: number }[] = []
  nodes.forEach(n => {
    const [cx, cy] = pitchXY(n.x, n.y, true)
    const w = textW(n.t), h = FS * 1.05
    const cands: [number, number, 'middle' | 'start' | 'end'][] = [
      [cx, cy + r + h * 0.95, 'middle'], [cx, cy - r - 0.6, 'middle'], [cx + r + 0.8, cy + h * 0.35, 'start'], [cx - r - 0.8, cy + h * 0.35, 'end'],
      [cx + r * 0.7, cy + r + h * 0.95, 'start'], [cx - r * 0.7, cy + r + h * 0.95, 'end'], [cx + r * 0.7, cy - r - 0.6, 'start'], [cx - r * 0.7, cy - r - 0.6, 'end'],
    ]
    const boxOf = ([x, y, an]: [number, number, 'middle' | 'start' | 'end']): Box => {
      const x0 = an === 'middle' ? x - w / 2 : an === 'start' ? x : x - w
      return { x0: x0 - 0.3, y0: y - h * 0.8, x1: x0 + w + 0.3, y1: y + h * 0.25 }
    }
    const inside = (b: Box) => b.x0 >= -1 && b.x1 <= 81 && b.y0 >= -1 && b.y1 <= 121
    let pick = cands.find(c => { const b = boxOf(c); return inside(b) && !placed.some(o => hit(o, b)) && !nodeBoxes.some(o => hit(o, b)) })
    let lead = false
    if (!pick) {
      let yy = cy + r + h
      while (yy < 118 && placed.some(o => hit(o, boxOf([cx, yy, 'middle'])))) yy += h * 1.05
      pick = [cx, yy, 'middle']; lead = true
    }
    placed.push(boxOf(pick))
    out.push({ id: n.id, x: pick[0], y: pick[1], t: n.t, anchor: pick[2], ...(lead ? { lx: cx, ly: cy + r } : {}) })
  })
  return out
}

function FormPitch({ nodes, color }: { nodes: { id: number; x: number; y: number; t: string; n?: number; gk?: boolean; tip?: string }[]; color: string }) {
  const tip = useTip()
  const labels = layoutLabels(nodes, 2.7)
  return (
    <>
      <Pitch vertical labels={labels.map(l => (
        <g key={l.id} pointerEvents="none">
          {l.lx != null && <line x1={l.lx} y1={l.ly} x2={l.x} y2={l.y - FS * 0.8} stroke="var(--ink-3)" strokeWidth={0.2} />}
          <text x={l.x} y={l.y} fontSize={FS} fontWeight={600} textAnchor={l.anchor} fill="var(--ink)" style={{ paintOrder: 'stroke', stroke: 'var(--pitch)', strokeWidth: 0.7 }}>{l.t}</text>
        </g>
      ))}>
        {nodes.map(n => (
          <circle key={n.id} cx={n.x} cy={n.y} r={2.7} fill={n.gk ? 'var(--surface)' : color} fillOpacity={n.n != null && n.n < 25 ? 0.5 : 1} stroke={n.gk ? color : 'var(--ink)'} strokeOpacity={n.gk ? 1 : 0.55} strokeWidth={n.gk ? 0.9 : 0.4}
            onMouseMove={e => tip.show(e, <>{n.tip}</>)} onMouseLeave={tip.hide} />
        ))}
      </Pitch>
      {tip.el}
    </>
  )
}

export function Formaciones({ F, JG, color, club }: { F: Any; JG: Any; color: string; club: string }) {
  const [on, setOn] = useState<'nominal' | 'con' | 'sin'>('con')
  const names: Record<number, string> = useMemo(() => Object.fromEntries((JG.jugadores as [number, string][]).map(([id, n]) => [id, n])), [JG])
  const nm = (id: number) => apellidoCorto(jugadorCorto(id, names[id] ?? String(id)))
  const panes: { k: 'nominal' | 'con' | 'sin'; title: string; info: string }[] = [
    { k: 'nominal', title: `${L('Alineación', 'Line-up')}${F.formacion ? ` · ${F.formacion}` : ''}`, info: F.con_360
      ? L(`Un once real de ${club}: el partido que más se parece a sus 11 con más minutos. Los puestos son los oficiales de la alineación; el dibujo es el estándar de la formación (una fila por línea, de izquierda a derecha), no una medición.`, `A real starting XI of ${club}: the match closest to its 11 players with the most minutes. Positions are the official line-up ones; the drawing is the standard shape of the formation (one row per line, left to right), not a measurement.`)
      : L(`Cada uno en el puesto con el que más veces salió de titular en ${club}, sobre un dibujo estándar. Sin datos 360 de este club no se puede medir la forma.`, `Each player at the position he most often started in at ${club}, on a standard drawing. Without 360 data for this club the shape cannot be measured.`) },
    { k: 'con', title: L('Con balón', 'With the ball'), info: F.con_360
      ? L(`La forma del equipo cuando ataca con claridad (balón en campo rival, juego abierto, sin contragolpe: en las transiciones los jugadores están a medio camino y el promedio se amontona en el medio), medida con los datos 360: en ${fmt(F.cuadros, 0)} fotos con los 10 jugadores de campo a la vista, la cámara de banda a banda y sólo partidos con su formación habitual, se ordenan en 10 huecos (por línea y de izquierda a derecha) y se promedia cada hueco. La línea de cada jugador sale de su puesto oficial en la alineación; el lado dentro de la línea, de ese puesto y de quién hizo el evento en esas fotos (el 360 sí dice quién lo hizo): en promedio ${fmt((F.evidencia ?? 0) * 100, 0)}% de las veces que vimos a un jugador estaba en el hueco que se le asigna; los vecinos de la misma línea se intercambian a menudo. El portero es la posición media de sus acciones.`, `The team's shape when it clearly attacks (ball in the opponent half, open play, no counter-attack: in transitions players are caught half-way and the average bunches in the middle), measured with 360 data: in ${fmt(F.cuadros, 0)} frames with all 10 outfield players in view, the camera touchline to touchline and only matches in his usual formation, they are sorted into 10 slots (by line, left to right) and each slot is averaged. A player's line comes from his official line-up position; the side within the line, from that position and from who performed the event in those frames (360 does say that): on average ${fmt((F.evidencia ?? 0) * 100, 0)}% of the times we saw a player he was in the slot he is given; neighbours in the same line often swap. The goalkeeper is the average position of his actions.`)
      : L('Posición media de todos sus pases, conducciones, tiros y regates: dónde se para cada uno cuando su equipo tiene el balón. (Sin 360 en este club: es dónde toca el balón, que se carga hacia donde está la jugada.)', 'Average position of all his passes, carries, shots and dribbles: where each player stands when his team has the ball. (No 360 for this club: this is where he touches the ball, which skews toward where the play is.)') },
    { k: 'sin', title: L('Sin balón', 'Without the ball'), info: F.sin_360
      ? L('El bloque del equipo cuando defiende con claridad: el rival ataca en su tercio (bloque bajo; si hay pocas fotos, en el medio campo), medido con los datos 360 y sólo en partidos con su formación habitual. El 360 no dice quién es quién: cada hueco del bloque se asigna con el mismo método que «Con balón». El portero va fijo.', 'The team\'s block when it clearly defends: the opponent attacks in its third (low block; with few frames, midfield), measured with 360 data and only in matches in his usual formation. 360 data does not say who is who: each slot is assigned with the same method as "With the ball". The goalkeeper is fixed.')
      : L('Posición media de sus presiones, duelos, intercepciones, bloqueos y despejes: dónde defiende cada uno. Es donde actúan, no una foto de dónde se paran (los puntos tenues tienen menos de 25 acciones). El portero va fijo.', 'Average position of his pressures, duels, interceptions, blocks and clearances: where each player defends. It is where they act, not a snapshot of where they stand (faded dots have fewer than 25 actions). The goalkeeper is fixed.') },
  ]
  return (
    <div className="fm">
      <div className="fm-seg"><Seg opts={panes.map(p => [p.k, p.k === 'nominal' ? L('Alineación', 'Line-up') : p.title] as [string, string])} v={on} set={s => setOn(s as Any)} /></div>
      <div className="fm-grid">
        {panes.map(p => {
          const nodes = (F.jugadores as Any[]).flatMap(j => {
            const pos = p.k === 'nominal' ? j.nominal : p.k === 'con' ? j.con : j.sin
            if (!pos || pos[0] == null) return []
            const n = p.k === 'nominal' ? undefined : pos[2]
            return [{ id: j.id, x: pos[0], y: pos[1], t: nm(j.id), n: j.portero ? undefined : n, gk: j.portero, tip: <><b>{names[j.id]}</b><br />{j.pos}{n != null && !j.portero ? <><br />{n} {L('acciones', 'actions')}</> : null}{p.k === 'sin' && j.sin360 && !j.portero ? <><br />{L('posición en el bloque (360)', 'position in the block (360)')}</> : null}</> as Any }]
          })
          return (
            <div key={p.k} className="fm-p" data-on={on === p.k ? '1' : '0'}>
              <div className="fm-t">{p.title} <Info wide>{p.info}</Info></div>
              <FormPitch nodes={nodes} color={color} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { ClubLogo }
