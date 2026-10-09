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
function Ataque({ pc, JG, liga, color, media, club }: { pc: Any; JG: Any; liga: Any; color: string; media: Any; club: string }) {
  const cats: Any[] = useMemo(() => liga.cats.map((c: Any) => ({ ...c, ...pc.ataque.cats[c.id] })).sort((a: Any, b: Any) => (b.xg ?? 0) - (a.xg ?? 0)), [liga, pc])
  const [sel, setSel] = useState<string>(cats[0].id)
  const [k, setK] = useState(0)
  const cur = cats.find(c => c.id === sel) ?? cats[0]
  const ex: Any[] = pc.ataque.ejemplos[cur.id] || []
  const e = ex[k]
  const max = Math.max(...cats.map(c => Math.max(c.xg ?? 0, c.liga_xg ?? 0, liga.cats.find((l: Any) => l.id === c.id)?.xg ?? 0)), 0.01)
  const partido = e ? JG.partidos[e.m] : null
  const pj = pc.partidos
  return (
    <div className="arq">
      <div className="card arq-list">
        <div className="jt-list-h">{L('xG por partido de cada tipo', 'xG per match from each type')} <Info wide><p>{L('Una jugada cuenta cuando termina en tiro o llega al área sin balón parado. Cada una se clasifica por cómo se creó el peligro. La barra es el xG por partido que genera de ese tipo; la raya negra, el promedio de la liga.', 'A move counts when it ends in a shot or reaches the box without a set piece. Each one is classified by how the danger was created. The bar is the xG per match it creates that way; the black line is the league average.')}</p><p>{L('Los tipos no se solapan: cada jugada va en uno solo, en el orden de la lista de «Cómo se clasifica».', 'Types do not overlap: each move goes in exactly one, in the order given in "How it is classified".')}</p></Info></div>
        {cats.map(c => {
          const lg = liga.cats.find((l: Any) => l.id === c.id)
          return (
            <button key={c.id} className="arq-row" aria-pressed={c.id === sel} onClick={() => { setSel(c.id); setK(0) }}>
              <span className="arq-name">{L(c.es, c.en)}</span>
              <span className="arq-bar"><span style={{ width: `${(c.xg ?? 0) / max * 100}%`, background: color }} /><i style={{ left: `${(lg?.xg ?? 0) / max * 100}%` }} /></span>
              <span className="mono arq-val">{fmt(c.xg, 2)}</span>
            </button>
          )
        })}
        <div className="jt-list-f note">{L('Raya: liga', 'Line: league')}</div>
      </div>
      <div className="card arq-ex">
        <div className="arq-head">
          <div>
            <div className="h3" style={{ margin: 0 }}>{L(cur.es, cur.en)} <Info wide><p>{L(cur.desc_es, cur.desc_en)}</p><p>{L('Una de sus jugadas más peligrosas de este tipo en ', 'One of his most dangerous moves of this type at ')}{club}{L('. Sólo aparecen los jugadores que tocan el balón. Línea continua: pase; discontinua: conducción; punteada gris: tramo que los datos no registran. Ataque hacia la derecha.', '. Only players who touch the ball are shown. Solid line: pass; dashed: carry; grey dotted: a stretch the data does not capture. Attacking to the right.')}</p></Info></div>
            <div className="note">
              {fmt(cur.n, 1)} {L('jugadas por partido', 'moves per match')} ({L('liga', 'league')} {fmt(liga.cats.find((l: Any) => l.id === cur.id)?.n, 1)}) · xG {fmt(cur.xg, 2)} · OBV {fmt(cur.obv, 2)} · {cur.goles} {L(cur.goles === 1 ? 'gol' : 'goles', cur.goles === 1 ? 'goal' : 'goals')} {L('en', 'in')} {pj} {L('partidos', 'matches')}
              {cur.pct != null && <> · <b>{pctText(cur.pct)}</b></>}
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
            <div className="h3" style={{ margin: 0 }}>{L(cur.es, cur.en)} <Info wide><p>{L(cur.desc_es, cur.desc_en)}</p><p>{L('El equipo ataca hacia arriba y su portería está abajo. Los puntos son la posición media de sus 10 jugadores de campo en esa situación (por hueco, no por nombre: el 360 no identifica jugadores); el círculo blanco es dónde suele estar el balón; la línea punteada es el promedio de la liga.', 'The team attacks upwards and its goal is at the bottom. The dots are the average position of its 10 outfield players in that situation (by slot, not by name: 360 data does not identify players); the white circle is where the ball usually is; the dashed line is the league average.')}</p></Info></div>
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
  const lgLines = (['front', 'back'] as const).filter(m => d.liga?.[m] != null).map(m => ({ m, x: d.liga[m] as number }))
  // acerca la cancha al tramo donde está el bloque, la pelota y las líneas de la liga
  const xs = [...(forma ?? []).map(p => p[0]), ...(bola ? [bola[0]] : []), ...lgLines.map(l => l.x), d.front, d.back].filter((v): v is number => v != null)
  let x0 = Math.max(0, Math.min(...xs) - 14), x1 = Math.min(120, Math.max(...xs) + 14)
  if (x1 - x0 < 62) { const mid = (x0 + x1) / 2; x0 = Math.max(0, mid - 31); x1 = Math.min(120, x0 + 62); x0 = Math.max(0, x1 - 62) }
  return (
    <Pitch vertical crop={[x0, x1]} labels={<>
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
          {d.front != null && <rect x={d.front - 1.3} y={14} width={2.6} height={52} rx={1.3} fill={color} fillOpacity={0.55} />}
          {d.back != null && <rect x={d.back - 1.3} y={14} width={2.6} height={52} rx={1.3} fill={color} fillOpacity={0.4} />}
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
    { k: 'nominal', title: `${L('Alineación', 'Line-up')}${F.formacion ? ` · ${F.formacion}` : ''}`, info: L(`Cada uno en el puesto con el que más veces salió de titular en ${club}. La formación es la que más usó.`, `Each player at the position he most often started in at ${club}. The formation is the one he used most.`) },
    { k: 'con', title: L('Con balón', 'With the ball'), info: L('Posición media de todos sus pases, conducciones, tiros y regates: dónde se para cada uno cuando su equipo tiene el balón.', 'Average position of all his passes, carries, shots and dribbles: where each player stands when his team has the ball.') },
    { k: 'sin', title: L('Sin balón', 'Without the ball'), info: L('Posición media de sus presiones, duelos, intercepciones, bloqueos y despejes: dónde defiende cada uno. Es donde actúan, no una foto de dónde se paran (los puntos tenues tienen menos de 25 acciones). El portero va fijo.', 'Average position of his pressures, duels, interceptions, blocks and clearances: where each player defends. It is where they act, not a snapshot of where they stand (faded dots have fewer than 25 actions). The goalkeeper is fixed.') },
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
            return [{ id: j.id, x: pos[0], y: pos[1], t: nm(j.id), n: j.portero ? undefined : n, gk: j.portero, tip: <><b>{names[j.id]}</b><br />{j.pos}{n != null && !j.portero ? <><br />{n} {L('acciones', 'actions')}</> : null}</> as Any }]
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
