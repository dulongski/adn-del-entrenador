import { fmt, jugadorCorto, type Any } from '../lib'
import { L } from '../settings'
import { apellidoCorto } from '../PlayAnim'
import { td } from '../i18n/data'
import { KEY } from '../tabs/common'
import { kName } from '../tabs/resumenKit'
import { BlockPitch, FormPitch } from '../tabs/JugadasTipo'
import { MODE_COLOR, type RD } from './data'
import { Bar, Frame } from './parts'

const clubData = (rd: RD) => {
  const pcs = rd.J?.jg?.por_club ?? {}
  const club = pcs[rd.club] ? rd.club : Object.keys(pcs).at(-1) ?? rd.club
  return { club, pc: pcs[club] as Any | undefined }
}
const Empty = ({ rd, mode, color, title, n, total }: { rd: RD; mode: string; color: string; title: string; n: number; total: number }) => (
  <Frame rd={rd} mode={mode} color={color} title={title} n={n} total={total}><div className="rp-card" style={{ margin: 'auto', textAlign: 'center', color: 'var(--ink-3)' }}>{L('Todavía no hay datos suficientes para esta página.', 'There is not enough data for this page yet.')}</div></Frame>
)

/* ------------------------------------------------------------ jugadas tipo + defensa */
const SITS: [string, string, string][] = [['atras', 'Rival sale desde su portería', 'Opponent builds from the back'], ['medio', 'Rival en el medio campo', 'Opponent in midfield'], ['bajo', 'Rival ataca en nuestro tercio', 'Opponent attacks in our third'], ['contra', 'Rival contragolpea', 'Opponent counter-attacks']]
export function Jugadas({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const { club, pc } = clubData(rd)
  const mode = L('Cómo juega', 'How he plays')
  if (!pc || !rd.jgl) return <Empty rd={rd} mode={mode} color={MODE_COLOR.juego} title={L('Jugadas tipo', 'Signature plays')} n={n} total={total} />
  const blocks: Any[] = rd.jgl.bloques.map((b: Any) => ({ ...b, cats: b.cats.map((c: Any) => ({ ...c, ...pc.ataque.cats[c.id], lg: c.share })).sort((x: Any, y: Any) => (y.share ?? 0) - (x.share ?? 0)) }))
  const max = Math.max(...blocks.flatMap(b => b.cats.map((c: Any) => Math.max(c.share ?? 0, c.lg ?? 0))), 1)
  const D = pc.defensa, tam = D.tam
  const pitch = (id: string) => D.sits[id]?.forma ? { id, d: D.sits[id] } : null
  const two = [pitch('medio') ?? pitch('atras'), pitch('bajo') ?? pitch('contra')].filter(Boolean) as { id: string; d: Any }[]
  const mt = (d: Any, k: string) => (d[k] != null ? `${fmt(d[k], 1)} m` : '—')
  return (
    <Frame rd={rd} mode={mode} color={MODE_COLOR.juego} n={n} total={total} title={L(`Jugadas tipo · ${club}`, `Signature plays · ${club}`)}
      sub={L('Sólo cuentan jugadas efectivas (terminan en tiro o pisan el área en juego abierto). Barras: % de sus jugadas efectivas; raya: promedio de la liga. A la derecha, cómo se para cuando defiende (datos 360, en metros desde su portería).', 'Only effective moves count (they end in a shot or reach the box in open play). Bars: % of his effective moves; tick: league average. On the right, how he sets up when defending (360 data, metres from his own goal).')}>
      <div className="rp-jg">
        <div className="rp-card rp-jg-l">
          {blocks.map(b => (
            <div key={b.id} className="rp-jg-b">
              <h4>{L(b.es, b.en)}</h4>
              {b.cats.map((c: Any) => (
                <div key={c.id} className="rp-jg-r"><span>{L(c.es, c.en)}</span><Bar v={c.share ?? 0} lg={c.lg} max={max} /><b>{fmt(c.share, 0)}%</b></div>
              ))}
            </div>
          ))}
          <small className="rp-note">{L('Raya: liga. Con él, ', 'Tick: league. With him, ')}{pc.partidos} {L('partidos en ', 'matches at ')}{club}.</small>
        </div>
        {two.map(({ id, d }) => (
          <div key={id} className="rp-card rp-jg-p">
            <h4>{L(SITS.find(s => s[0] === id)![1], SITS.find(s => s[0] === id)![2])}</h4>
            <div className="rp-pitchbox"><BlockPitch d={d} tam={tam} color="var(--c-dt)" /></div>
            <div className="rp-mets">
              <span>{L('Línea más adelantada', 'Front line')}<b>{mt(d, 'front')}</b><small>{L('liga', 'league')} {d.liga?.front != null ? fmt(d.liga.front, 1) : '—'}</small></span>
              {d.back != null && <span>{L('Línea defensiva', 'Back line')}<b>{mt(d, 'back')}</b><small>{L('liga', 'league')} {d.liga?.back != null ? fmt(d.liga.back, 1) : '—'}</small></span>}
              <span>{L('Cerca del balón', 'Near the ball')}<b>{fmt(d.near, 1)}</b><small>{L('liga', 'league')} {d.liga?.near != null ? fmt(d.liga.near, 1) : '—'}</small></span>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------ formaciones */
export function Formaciones({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const { club, pc } = clubData(rd)
  const mode = L('Cómo juega', 'How he plays')
  const F = pc?.formaciones
  if (!F) return <Empty rd={rd} mode={mode} color={MODE_COLOR.juego} title={L('Formaciones', 'Formations')} n={n} total={total} />
  const names: Record<number, string> = Object.fromEntries((rd.J.jg.jugadores as [number, string][]).map(([id, nm]) => [id, nm]))
  const nm = (id: number) => apellidoCorto(jugadorCorto(id, names[id] ?? String(id)))
  const panes: [string, string, string][] = [['nominal', L('Alineación', 'Line-up') + (F.formacion ? ` · ${F.formacion}` : ''), L('Un once real, sobre el dibujo estándar de su formación.', 'A real XI on the standard drawing of his formation.')], ['con', L('Con balón', 'With the ball'), L('Ataque claro: balón en campo rival, juego abierto, sin contragolpe (360).', 'Clear attack: ball in the opponent half, open play, no counter (360).')], ['sin', L('Sin balón', 'Without the ball'), L('Defensa clara: el rival ataca en nuestro tercio (360).', 'Clear defence: the opponent attacks in our third (360).')]]
  return (
    <Frame rd={rd} mode={mode} color={MODE_COLOR.juego} n={n} total={total} title={L(`Formaciones · ${club}`, `Formations · ${club}`)} sub={L(`El once con el que más repitió y dónde se para de verdad: la forma sale de los datos 360 (fotos con los 10 jugadores a la vista) y cada jugador ocupa el hueco que su puesto y sus acciones indican. Ataca hacia arriba.`, `The XI he repeated most and where it really stands: the shape comes from 360 data (frames with all 10 outfield players in view), and each player takes the slot his position and actions point to. Attacking upwards.`)}>
      <div className="rp-fm">
        {panes.map(([k, t, d]) => {
          const nodes = (F.jugadores as Any[]).flatMap(j => {
            const pos = k === 'nominal' ? j.nominal : k === 'con' ? j.con : j.sin
            if (!pos || pos[0] == null) return []
            return [{ id: j.id, x: pos[0], y: pos[1], t: nm(j.id), n: j.portero ? undefined : pos[2], gk: j.portero, tip: '' }]
          })
          return <div key={k} className="rp-card"><h4>{t}</h4><div className="rp-pitchbox"><FormPitch nodes={nodes} color="var(--c-dt)" /></div><small className="rp-note">{d}</small></div>
        })}
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------ según el partido */
const DIMS: [string, string, string][] = [['marcador', 'Marcador', 'Scoreline'], ['minuto', 'Minuto', 'Minute'], ['localia', 'Localía', 'Home / away'], ['rival', 'Fuerza del rival', 'Opponent strength']]
const bg = (v: number | null, sc: number) => (v == null ? 'transparent' : `color-mix(in oklab, ${v >= 0 ? 'var(--div-pos)' : 'var(--div-neg)'} ${Math.round(8 + Math.min(1, Math.abs(v) / sc) * 55)}%, var(--paper))`)
export function Contexto({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const { art, glob } = rd
  const C = art.contexto
  const label = (k: string) => kName(k, glob)
  const all: Any[] = []
  for (const [d] of DIMS) for (const k of KEY) for (const r of C.curvas[d]?.[k] ?? []) if (r.dt != null && r.liga != null && r.n_dt >= 40) all.push({ d, k, nivel: td(r.nivel), dif: r.dt - r.liga })
  all.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif))
  const seen = new Set<string>(); const top = all.filter(o => (seen.has(o.k) ? false : (seen.add(o.k), true))).slice(0, 4)
  const keys = KEY.filter(k => C.curvas.marcador?.[k]).slice(0, 8)
  const mat = (dim: string) => {
    const cols: any[] = C.curvas[dim][keys[0]] ?? []
    return (
      <div className="rp-card rp-mx">
        <h4>{L(DIMS.find(x => x[0] === dim)![1], DIMS.find(x => x[0] === dim)![2])}</h4>
        <div className="rp-mx-g" style={{ gridTemplateColumns: `150px repeat(${cols.length}, 1fr)` }}>
          <span />{cols.map((c, i) => <b key={i}>{td(c.nivel)}</b>)}
          {keys.map(k => [<span key={k + 'l'} className="l">{label(k)}</span>, ...(C.curvas[dim][k] as Any[]).map((r, i) => { const d = r.dt - r.liga; return <span key={k + i} className={`c${r.n_dt < 40 ? ' weak' : ''}`} style={{ background: bg(d, 1.2) }}>{d >= 0 ? '+' : '−'}{Math.abs(d).toFixed(2)}</span> })])}
        </div>
      </div>
    )
  }
  return (
    <Frame rd={rd} mode={L('Cómo juega', 'How he plays')} color={MODE_COLOR.juego} n={n} total={total} title={L('Cómo cambia según el partido', 'How he changes with the game')}
      sub={L('Cuánto se separa su juego de lo que hace la liga en la misma situación (en desviaciones típicas): verde = hace más, rojo = hace menos. Ya se quitó lo que ponen los jugadores.', 'How far his play moves away from what the league does in the same situation (in standard deviations): green = does more, red = does less. What his players bring is removed.')}>
      <div className="rp-hero">{top.map((o, i) => <div key={i}><span>{label(o.k)}</span><b className={o.dif >= 0 ? 'up' : 'dn'}>{o.dif >= 0 ? '+' : '−'}{Math.abs(o.dif).toFixed(1)}<small>σ</small></b><em>{o.dif >= 0 ? L('más que la liga', 'more than the league') : L('menos que la liga', 'less than the league')} · {o.nivel}</em></div>)}</div>
      <div className="rp-mxs">{mat('marcador')}{mat('minuto')}</div>
    </Frame>
  )
}
