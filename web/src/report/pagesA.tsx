import { fmt, type Any } from '../lib'
import { L } from '../settings'
import { kFmt, kName } from '../tabs/resumenKit'
import { famLabel, kpiLabel } from '../i18n/data'
import { FAM_ORDER } from '../tabs/common'
import { apellido } from '../compare/util'
import { HUES, MODE_COLOR, type RD } from './data'
import { Frame, Img, Logo, Tile, Track, coachNames, pctTxt } from './parts'

export const TOTAL_KEY = '__total__'

/* ------------------------------------------------------------ portada */
export function Cover({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const { art, media, glob, mapa } = rd
  const { first, last } = coachNames(rd)
  const info = media.dts?.[art.id]
  const pts = art.simulacion?.puntos, pj = art.partidos_total
  const pm = pts != null && pj ? fmt(pts / pj, 2) : '—'
  const clubs: Any[] = art.etapas ?? []
  const tot = clubs.reduce((a, c) => a + c.partidos, 0) || 1
  const me = (mapa.puntos as Any[]).find(p => p.id === art.id)
  const grupo = me ? (mapa.grupos as Any[]).find(g => g.id === me.grupo) : null
  const xs = (mapa.puntos as Any[]).map(p => p.x), ys = (mapa.puntos as Any[]).map(p => p.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const X = (v: number) => 10 + ((v - x0) / (x1 - x0)) * 300, Y = (v: number) => 10 + (1 - (v - y0) / (y1 - y0)) * 200
  const idea: Any[] = (L(art.narrativa, art.narrativa_en ?? art.narrativa) as Any)?.principios ?? []
  const yr = (c: Any) => (c.desde.slice(0, 4) === c.hasta.slice(0, 4) ? c.desde.slice(0, 4) : `${c.desde.slice(0, 4)}–${c.hasta.slice(0, 4)}`)
  return (
    <section className="rp-page rp-cover" style={{ ['--mc' as string]: MODE_COLOR.resumen }}>
      <div className="rp-top" />
      <div className="rp-cv-l">
        <div className="rp-brand big"><i /><b>COACH</b><b className="g">DNA</b></div>
        <div className="rp-cv-photo"><Img src={info?.foto} size={290} round /><span className="rp-cv-club"><Logo rd={rd} club={rd.club} size={74} /></span></div>
      </div>
      <div className="rp-cv-r">
        <div className="rp-eyebrow">{L('Historia de un entrenador a través de los datos', 'The story of a coach through the data')}</div>
        <h1 className="rp-cv-name"><span>{first}</span>{last}</h1>
        <div className="rp-cv-club-line"><Logo rd={rd} club={rd.club} size={22} />{rd.club}<i />{pj} {L('partidos', 'matches')} · {clubs.length} {L(clubs.length === 1 ? 'club' : 'clubes', clubs.length === 1 ? 'club' : 'clubs')} · {art.temporadas?.[0]} – {art.temporadas?.at(-1)}</div>
        <div className="rp-cv-tl">
          {clubs.map(c => (
            <div key={c.club} className="rp-cv-seg" style={{ flex: `${Math.max(c.partidos / tot, 0.3)} 1 auto`, minWidth: 128 }}><Logo rd={rd} club={c.club} size={22} /><b>{c.club}</b><small>{c.partidos} {L('p.', 'm.')} · {yr(c)}</small></div>
          ))}
        </div>
        <div className="rp-tiles">
          <Tile k={L('Puntos por partido', 'Points per match')} v={pm} s={`${pts} ${L('pts en', 'pts in')} ${pj}`} color="var(--c-dt)" />
          <Tile k={L('Puntos esperados', 'Expected points')} v={fmt(art.simulacion?.xpts, 0)} s={pts >= art.simulacion?.xpts ? L('sumó más de lo que generó', 'took more than he created') : L('sumó menos de lo que generó', 'took less than he created')} color="var(--c-club)" />
          <Tile k={L('Identificabilidad', 'Identifiability')} v={`${fmt(art.identificabilidad?.indice, 0)}/100`} s={L('qué tan bien se separa de su plantilla', 'how cleanly he separates from his squad')} color="var(--c-plantilla)" />
        </div>
        <div className="rp-cv-bottom">
          <div className="rp-cv-ideas">{idea.slice(0, 3).map((p, i) => <div key={i}><b>{i + 1}</b><span>{p.titulo}</span></div>)}</div>
          <div className="rp-cv-map">
            <svg viewBox="0 0 320 220" width="300" height="206">
              <rect width="320" height="220" rx="14" fill="var(--paper)" stroke="var(--rule)" />
              {(mapa.puntos as Any[]).map(p => <circle key={p.id} cx={X(p.x)} cy={Y(p.y)} r={p.id === art.id ? 0 : 4} fill={HUES[p.grupo % HUES.length]} opacity={0.5} />)}
              {me && <g><circle cx={X(me.x)} cy={Y(me.y)} r={11} fill="none" stroke="var(--ink)" strokeWidth={2} /><circle cx={X(me.x)} cy={Y(me.y)} r={5.5} fill={HUES[me.grupo % HUES.length]} /></g>}
            </svg>
            <p><b>{apellido(art.nombre)}</b> {L('en el mapa de estilos', 'on the style map')}{grupo ? <> · <span style={{ color: HUES[me.grupo % HUES.length] }}>{grupo.nombre}</span></> : null}</p>
          </div>
        </div>
      </div>
      <footer className="rp-foot rp-foot-cv"><span>{L('Datos StatsBomb · Liga MX 2021/22 – 2026/27', 'StatsBomb data · Liga MX 2021/22 – 2026/27')}</span><b>{n} / {total}</b></footer>
    </section>
  )
}

/* ------------------------------------------------------------ su ADN en ideas */
export function Ideas({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const { art, glob } = rd
  const nar: Any = L(art.narrativa, art.narrativa_en ?? art.narrativa)
  const hu: Record<string, Any> = Object.fromEntries(art.huella.map((h: Any) => [h.kpi, h]))
  const ps: Any[] = (nar.principios ?? []).slice(0, 6)
  return (
    <Frame rd={rd} mode={L('Resumen', 'Summary')} color={MODE_COLOR.resumen} n={n} total={total}
      title={L(`Su ADN en ${ps.length === 6 ? 'seis' : ps.length} ideas`, `His DNA in ${ps.length === 6 ? 'six' : ps.length} ideas`)} sub={L('Los rasgos que son suyos y no de sus jugadores. Cada tarjeta compara lo que se vio en sus partidos con la liga y dice dónde queda su sello entre los demás DTs.', 'The traits that are his and not his players’. Each card compares what his matches showed with the league and where his imprint ranks among all coaches.')}>
      <div className="rp-ideas">
        {ps.map((p, i) => {
          const h = hu[p.kpi]
          const sello = h && glob.kpis[p.kpi] ? h.liga + h.alpha * (glob.kpis[p.kpi].sd ?? 1) : null
          return (
            <article key={i} className="rp-idea">
              <div className="rp-idea-n">{L('IDEA', 'IDEA')} {i + 1}</div>
              <h3>{p.titulo}</h3>
              <p>{p.descripcion}</p>
              <p className="rp-ev">{(String(p.evidencia ?? '').split('. ')[1] ?? '').replace(/\.$/, '')}.</p>
              {h && <>
                <div className="rp-trio">
                  <div><span>{L('En sus partidos', 'In his matches')}</span><b>{kFmt(p.kpi, h.crudo, true)}</b></div>
                  <div className="on"><span>{L('Su sello', 'His imprint')}</span><b>{kFmt(p.kpi, sello, true)}</b></div>
                  <div><span>{L('Liga', 'League')}</span><b>{kFmt(p.kpi, h.liga, true)}</b></div>
                </div>
                <Track p={h.pct} />
                <small><b>{kName(p.kpi, glob)}</b> · {pctTxt(h.pct)}</small>
              </>}
            </article>
          )
        })}
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------ ¿DT o plantilla? */
const COMPS: [string, string, string, string][] = [['coach', 'DT', 'Coach', 'var(--c-dt)'], ['player', 'Plantilla', 'Squad', 'var(--c-plantilla)'], ['club', 'Club', 'Club', 'var(--c-club)'], ['opp', 'Rival', 'Opponent', 'var(--c-rival)'], ['ctx', 'Contexto', 'Context', 'var(--c-ctx)'], ['residual', 'Sin explicar', 'Unexplained', 'var(--c-resid)']]
const shares = (r: Any) => { const t = COMPS.reduce((a, [k]) => a + Math.abs(r[k] ?? 0), 0) || 1; return Object.fromEntries(COMPS.map(([k]) => [k, Math.abs(r[k] ?? 0) / t])) as Record<string, number> }

export function Separar({ rd, n, total }: { rd: RD; n: number; total: number }) {
  const { art, glob } = rd
  const rows: Any[] = art.atribucion.filter((a: Any) => !a.kpi.startsWith('arq_'))
  const sh = rows.map(r => ({ r, s: shares(r) }))
  const avg = Object.fromEntries(COMPS.map(([k]) => [k, sh.reduce((a, x) => a + x.s[k], 0) / sh.length])) as Record<string, number>
  const byFam = FAM_ORDER.map(f => { const rs = sh.filter(x => glob.kpis[x.r.kpi]?.familia === f); return { f, s: Object.fromEntries(COMPS.map(([k]) => [k, rs.length ? rs.reduce((a, x) => a + x.s[k], 0) / rs.length : 0])) as Record<string, number> } })
  const top = [...sh].sort((a, b) => b.s.coach - a.s.coach).slice(0, 6)
  const tr: Any = (art.transferencia as Any[])?.slice().reverse().find(t => t.partidos >= 8) ?? art.transferencia?.at(-1)
  const id = art.identificabilidad
  const Stack = ({ s, h = 22 }: { s: Record<string, number>; h?: number }) => (
    <div className="rp-stack" style={{ height: h }}>{COMPS.map(([k, , , c]) => s[k] > 0.015 ? <span key={k} style={{ width: `${s[k] * 100}%`, background: c }}>{s[k] > 0.07 ? `${fmt(s[k] * 100, 0)}` : ''}</span> : null)}</div>
  )
  return (
    <Frame rd={rd} mode={L('¿DT o plantilla?', 'Coach or squad?')} color={MODE_COLOR.separar} n={n} total={total}
      title={L('¿Cuánto de su estilo es suyo?', 'How much of the style is his?')} sub={L('El modelo reparte cada rasgo entre el DT, su plantilla, el club, el rival y el contexto (local o visita, marcador, minuto). Aquí, el promedio de los 34 indicadores.', 'The model splits each trait between the coach, his squad, the club, the opponent and the context (home/away, scoreline, minute). Here, the average of the 34 indicators.')}>
      <div className="rp-sep">
        <div className="rp-sep-l">
          <div className="rp-card">
            <h4>{L('Promedio de todos los rasgos', 'Average across all traits')}</h4>
            <Stack s={avg} h={34} />
            <div className="rp-leg">{COMPS.map(([k, es, en, c]) => <span key={k}><i style={{ background: c }} />{L(es, en)} <b>{fmt(avg[k] * 100, 0)}%</b></span>)}</div>
          </div>
          <div className="rp-card">
            <h4>{L('Por familia de rasgos', 'By family of traits')}</h4>
            {byFam.filter(x => x.s.coach + x.s.player > 0).map(x => <div key={x.f} className="rp-famrow"><span>{famLabel(x.f)}</span><Stack s={x.s} h={14} /></div>)}
          </div>
        </div>
        <div className="rp-sep-r">
          <div className="rp-card">
            <h4>{L('Los rasgos donde más pone él', 'Traits where he contributes most')}</h4>
            {top.map(({ r, s }) => <div key={r.kpi} className="rp-famrow wide"><span>{kName(r.kpi, glob)}</span><Stack s={s} h={14} /><b>{fmt(s.coach * 100, 0)}%</b></div>)}
          </div>
          <div className="rp-tiles two">
            <Tile k={L('Identificabilidad', 'Identifiability')} v={`${fmt(id.indice, 0)}/100`} s={L(`${fmt(id.conectividad * 100, 0)}% de sus minutos son de jugadores que también jugaron con otros técnicos`, `${fmt(id.conectividad * 100, 0)}% of his minutes come from players who also played under other coaches`)} color="var(--c-plantilla)" />
            {tr && <Tile k={L('Prueba de transferencia', 'Transfer test')} v={`${L('puesto', 'rank')} ${tr.rank_ajustado}`} s={L(`entre ${tr.n_clases} DTs al reconocerlo en ${tr.club} con otros jugadores (sin descontar plantilla: ${tr.rank_crudo})`, `among ${tr.n_clases} coaches when spotting him at ${tr.club} with different players (without removing the squad: ${tr.rank_crudo})`)} color="var(--c-dt)" />}
          </div>
        </div>
      </div>
      <div className="rp-card rp-how"><h4>{L('Cómo leerlo', 'How to read it')}</h4><div><p><b style={{ color: 'var(--c-dt)' }}>{L('DT', 'Coach')}</b> {L('es la parte del rasgo que se queda cuando cambian los jugadores, el club y el rival: su sello.', 'is the part of a trait that stays when players, club and opponent change: his imprint.')}</p><p><b style={{ color: 'var(--c-plantilla)' }}>{L('Plantilla', 'Squad')}</b> {L('es lo que ponen los jugadores que tiene. El modelo lo estima con quienes jugaron bajo varios técnicos.', 'is what his players bring. The model estimates it from players who played under several coaches.')}</p><p><b>{L('Prueba de transferencia', 'Transfer test')}</b> {L('responde: ¿se reconoce su estilo en otro club y con otros jugadores? Si sí, es suyo.', 'asks: is his style recognisable at another club with other players? If yes, it is his.')}</p></div></div>
    </Frame>
  )
}
