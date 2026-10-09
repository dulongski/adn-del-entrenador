import { useEffect, useMemo, useRef, useState } from 'react'
import { asset, clubColor, dataUrl, fmt, getJSON, jugadorCorto, nombreDT, pct, shortName, type Any } from '../lib'
import { ClubLogo } from '../charts'
import { L } from '../settings'
import Info from '../Info'
import StyleLab from '../StyleLab'
import { Seg } from './common'
import { buildTeam, FASES, type Ev, type Liga, type MatchRes, type Team, type Tie } from '../sim/engine'
import { manySeasons, Season, type Next } from '../sim/season'
import { loadStyle, type StyleX } from '../sim/styleModel'
import '../styles/liga.css'

type Pack = { wi: Any; sx: StyleX; ls: { liga: Liga; jugadores: Any }; real: { h: string; a: string; gh: number; ga: number }[]; lastRound: number }
let packP: Promise<Pack> | null = null
const loadPack = () => (packP ??= Promise.all([loadStyle(), getJSON(dataUrl('liga_sim.json')), getJSON(dataUrl('partidos.json'))]).then(([{ sx, wi }, ls, P]: Any) => {
  const C: string[] = P.cols, I = (c: string) => C.indexOf(c)
  const rows = (P.rows as Any[][]).filter(r => r[I('temporada')] === '2026/27' && r[I('torneo')] === 'Apertura')
  return { wi, sx, ls, real: rows.map(r => ({ h: r[I('local')], a: r[I('visita')], gh: r[I('gl')], ga: r[I('gv')] })), lastRound: Math.max(...rows.map(r => r[I('jornada')])) }
}))

const EV_ICON: Record<Ev['type'], string> = { goal: '⚽', og: '⚽', yellow: '🟨', red: '🟥', red2: '🟨🟥' }
const sName = (p: Any) => jugadorCorto(p.id, p.name)

export function LigaSim({ art, media }: { art: Any; media: Any }) {
  const [pk, setPk] = useState<Pack | null>(null)
  useEffect(() => { loadPack().then(setPk).catch(() => setPk(null)) }, [])
  if (!pk) return <div className="card note">{L('Cargando el simulador de liga…', 'Loading the league simulator…')}</div>
  return <Body key={art.id} art={art} media={media} pk={pk} />
}

function Body({ art, media, pk }: { art: Any; media: Any; pk: Pack }) {
  const { wi, sx, ls } = pk
  const clubs: string[] = useMemo(() => Object.keys(wi.squads).filter(c => wi.squads[c].temporada === '2026/27').sort((a, b) => a.localeCompare(b, 'es')), [wi])
  const cur: string | undefined = media?.dts?.[art.id]?.club
  const [club, setClub] = useState<string>(cur && clubs.includes(cur) ? cur : clubs[0])
  const [fresh, setFresh] = useState(false)
  const [dz, setDz] = useState<Record<string, number> | null>(null)
  const [season, setSeason] = useState<Season | null>(null)
  const [, tick] = useState(0)
  const [live, setLive] = useState<{ n: Next; res: MatchRes; m: number; end: number } | null>(null)
  const [probs, setProbs] = useState<{ you: Any; base: Any; n: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const raf = useRef(0)
  const refresh = () => tick(x => x + 1)
  const coachName = shortName(nombreDT(art.id)?.corto ?? art.nombre)
  const realCoach: number = wi.squads[club].dt
  const sameCoach = realCoach === art.id
  const teamsFor = (c: string, withCoach: boolean, style: Record<string, number> | null) => Object.fromEntries(clubs.map(k => [k, k === c && withCoach ? buildTeam(wi, ls, sx, k, art.id, style) : buildTeam(wi, ls, sx, k, wi.squads[k].dt, null)])) as Record<string, Team>
  const make = (withCoach: boolean) => new Season(clubs, teamsFor(club, withCoach, withCoach ? dz : null), ls.liga, pk.real, fresh, pk.lastRound + 1)

  const start = () => { cancelAnimationFrame(raf.current); setLive(null); setProbs(null); setSeason(make(true)) }
  useEffect(() => { setSeason(null); setLive(null); setProbs(null) }, [club, fresh])
  const S = season

  // reloj de un partido: 90' + descuento en ~7 s
  const playOne = (animate = true) => {
    if (!S || live) return
    const n = S.next(); if (!n) return
    const res = S.compute(n)
    if (!animate) { S.commit(n, res); refresh(); return }
    const end = res.ev.length ? Math.max(94, ...res.ev.map(e => e.min)) : 94
    const t0 = performance.now(), dur = 7000
    setLive({ n, res, m: 0, end })
    const loop = () => {
      const m = Math.min(end, ((performance.now() - t0) / dur) * end)
      setLive(l => (l ? { ...l, m } : l))
      if (m < end) raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
  }
  const finishLive = () => { if (!S || !live) return; cancelAnimationFrame(raf.current); S.commit(live.n, live.res); setLive(null); refresh() }
  const over = !!live && live.m >= live.end
  useEffect(() => { if (over) { const t = setTimeout(finishLive, 1100); return () => clearTimeout(t) } }, [over]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  const runTo = (stop: (s: Season, n: Next) => boolean) => { if (!S) return; if (live) finishLive(); S.run(stop); refresh() }
  const doProbs = () => {
    setBusy(true)
    setTimeout(() => {
      const N = 400
      const you = manySeasons(() => make(true), N)
      const base = sameCoach && !dz ? you : manySeasons(() => make(false), N)
      setProbs({ you, base, n: N }); setBusy(false)
    }, 30)
  }

  const nxt = S?.next() ?? null
  const phaseName = S ? (S.phase === 'liga' ? L(`Jornada ${S.round()}`, `Round ${S.round()}`) : S.phase === 'done' ? L('Campeón', 'Champion') : L(FASES[S.phase].es, FASES[S.phase].en)) : ''
  const TB = S?.table() ?? []
  const color = clubColor(club, media)

  return (
    <div className="lg">
      <h3 className="h2">{L('Simulador de liga', 'League simulator')} <Info wide><p>{L('Pon a este DT en un club (con su plantilla actual: no se puede editar), mueve su estilo si quieres y juega el resto del torneo —o uno nuevo desde cero— con liguilla incluida. Los demás clubes siguen con su DT actual.', 'Put this coach at a club (with its current squad, which cannot be edited), move his style if you like, and play the rest of the tournament —or a new one from scratch— including the playoffs. All other clubs keep their current coach.')}</p><p>{L('Cada partido se juega minuto a minuto: los goles caen según el xG esperado de cada equipo (modelo «Llévalo a otro club») y los anota quien suele rematar en esa plantilla; las amarillas y rojas siguen las tasas de cada jugador. Sin sustituciones ni lesiones.', 'Each match is played minute by minute: goals follow each team\'s expected xG (the "Move him to another club" model) and are scored by whoever usually shoots in that squad; yellow and red cards follow each player\'s rates. No substitutions or injuries.')}</p><p>{L('Reglas supuestas: 6 directos a cuartos, 7–10 play-in a un partido (empate: avanza el mejor ubicado), series a ida y vuelta (empate global: avanza el mejor ubicado; en la final, tiempos extra y penales). El calendario de los partidos que faltan lo armamos nosotros: el real no está en los datos.', 'Assumed rules: top 6 go straight to the quarter-finals, 7–10 play a one-match play-in (draw: the better-placed team goes through), two-leg ties (aggregate draw: the better-placed team goes through; in the final, extra time and penalties). The schedule of the remaining matches is ours: the real one is not in the data.')}</p></Info></h3>

      {!S && (
        <div className="card lg-setup">
          <div className="lg-who">
            {asset(media?.dts?.[art.id]?.foto) ? <img src={asset(media.dts[art.id].foto)!} alt="" /> : <i>{coachName[0]}</i>}
            <div><b>{coachName}</b><small>{L('dirige a', 'coaches')}</small></div>
            <select value={club} onChange={e => setClub(e.target.value)} aria-label={L('Club', 'Club')}>{clubs.map(c => <option key={c} value={c}>{c}{wi.squads[c].dt === art.id ? ` · ${L('su club actual', 'his current club')}` : ''}</option>)}</select>
            <ClubLogo club={club} media={media} size={34} />
          </div>
          <div className="lg-note">{sameCoach ? L(`${coachName} ya dirige a ${club}.`, `${coachName} already coaches ${club}.`) : L(`Reemplaza a ${shortName(wi.squads[club].dt_nombre)} en ${club}, con la plantilla actual del club.`, `Replaces ${shortName(wi.squads[club].dt_nombre)} at ${club}, with the club's current squad.`)}</div>
          <Seg opts={[['act', L('Resto del torneo actual', 'Rest of the current tournament')], ['new', L('Torneo nuevo desde cero', 'New tournament from scratch')]]} v={fresh ? 'new' : 'act'} set={v => setFresh(v === 'new')} />
          <div className="lg-note">{fresh ? L('17 jornadas, todos contra todos.', '17 rounds, round robin.') : L(`Se respetan los ${pk.real.length} partidos que ya se jugaron (hasta la jornada ${pk.lastRound}) y se simula el resto.`, `The ${pk.real.length} matches already played (through round ${pk.lastRound}) are kept and the rest is simulated.`)}</div>
          <StyleLab art={art} glob={null} onChange={(_, d) => setDz(Object.values(d).some(v => Math.abs(v) > 0.01) ? d : null)} />
          <button className="btn lg-go" onClick={start}>▶ {L('Empezar torneo', 'Start tournament')}</button>
        </div>
      )}

      {S && (
        <>
          <div className="lg-bar card">
            <div className="lg-bar-t"><ClubLogo club={club} media={media} size={26} /><b>{coachName} · {club}</b><span className="note">{phaseName}{S.phase === 'liga' ? ` · ${S.fxLeft().length} ${L('partidos por jugar', 'matches to play')}` : ''}</span></div>
            <div className="lg-btns">
              <button className="btn" disabled={!nxt || !!live} onClick={() => playOne(true)}>▶ {L('Siguiente partido', 'Next match')}</button>
              <button className="btn" disabled={!nxt || !!live} onClick={() => { const ph = S.phase, r0 = S.round(); runTo(s => s.phase !== ph || (ph === 'liga' && s.round() !== r0)) }}>{L('Terminar la jornada', 'Finish the round')}</button>
              <button className="btn" disabled={!nxt || S.phase !== 'liga'} onClick={() => runTo(s => s.phase !== 'liga')}>{L('Hasta la liguilla', 'To the playoffs')}</button>
              <button className="btn" disabled={!nxt} onClick={() => runTo(() => false)}>{L('Hasta la final', 'To the final')}</button>
              <button className="btn lg-ghost" onClick={() => { cancelAnimationFrame(raf.current); setLive(null); setSeason(null) }}>↺ {L('Cambiar y reiniciar', 'Change & restart')}</button>
            </div>
          </div>

          {live && <LiveCard live={live} media={media} skip={finishLive} />}
          {S.champion && <Champion club={S.champion} media={media} mine={S.champion === club} coach={coachName} />}

          <div className="lg-cols">
            <div className="card lg-table">
              <div className="h3">{L('Tabla', 'Table')}</div>
              <table><thead><tr><th>#</th><th>{L('Club', 'Club')}</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead>
                <tbody>{TB.map((r, i) => (
                  <tr key={r.club} className={`${r.club === club ? 'me' : ''} ${i < 6 ? 'q' : i < 10 ? 'pi' : ''}`}>
                    <td>{i + 1}</td><td className="lg-cl"><ClubLogo club={r.club} media={media} size={18} />{r.club}</td><td>{r.pj}</td><td>{r.g}</td><td>{r.e}</td><td>{r.p}</td><td>{r.gf}</td><td>{r.gc}</td><td>{r.gf - r.gc > 0 ? '+' : ''}{r.gf - r.gc}</td><td><b>{r.pts}</b></td>
                  </tr>))}</tbody></table>
              <div className="lg-leg note"><i className="q" />{L('liguilla directa', 'direct to playoffs')} <i className="pi" />{L('play-in', 'play-in')}</div>
            </div>
            <div className="lg-side">
              {S.phase === 'liga' ? <Fixtures S={S} media={media} club={club} /> : <Bracket S={S} media={media} club={club} />}
              <Scorers S={S} media={media} />
            </div>
          </div>
        </>
      )}

      {S && (
        <div className="card lg-prob">
          <div className="h3">{L('Probabilidades', 'Probabilities')} <Info wide>{L(`Se juegan ${400} torneos completos (sólo marcadores) con esta misma configuración y se cuenta cuántas veces cada club llega a liguilla, a la final y es campeón. «Con su DT actual» es el mismo torneo sin tocar nada del club.`, `${400} full tournaments are played (scores only) with this same set-up and we count how often each club reaches the playoffs, the final and wins it. "With the current coach" is the same tournament with nothing changed at the club.`)}</Info></div>
          <button className="btn" disabled={busy} onClick={doProbs}>{busy ? L('Jugando 400 torneos…', 'Playing 400 tournaments…') : L('Jugar 400 torneos', 'Play 400 tournaments')}</button>
          {probs && <Probs probs={probs} club={club} media={media} coach={coachName} sameCoach={sameCoach && !dz} color={color} />}
        </div>
      )}
    </div>
  )
}

function Score({ res, h, a, media, minute }: { res: MatchRes; h: string; a: string; media: Any; minute?: number }) {
  const ev = minute == null ? res.ev : res.ev.filter(e => e.min <= minute)
  const gh = ev.filter(e => (e.type === 'goal' && e.team === 0) || (e.type === 'og' && e.team === 1)).length
  const ga = ev.filter(e => (e.type === 'goal' && e.team === 1) || (e.type === 'og' && e.team === 0)).length
  return { gh, ga, ev, el: null as null, h, a, media }
}

function LiveCard({ live, media, skip }: { live: { n: Next; res: MatchRes; m: number; end: number }; media: Any; skip: () => void }) {
  const { n, res, m, end } = live
  const sc = Score({ res, h: n.h, a: n.a, media, minute: m })
  const shown = Math.floor(m)
  const clock = shown <= 90 ? `${Math.max(1, shown)}'` : `90+${shown - 90}'`
  const over = m >= end
  const tie = n.kind === 'tie' ? n.tie : null
  return (
    <div className="card lg-live">
      <div className="lg-live-top note">{tie ? `${L(FASES[tie.fase].es, FASES[tie.fase].en)} · ${tie.fase === 'playin' ? '' : tie.legs.length === 0 ? L('ida', 'first leg') : L('vuelta', 'second leg')}` : `${L('Jornada', 'Round')} ${(n as Any).fx.round}`}</div>
      <div className="lg-score">
        <span className="r"><b>{n.h}</b><ClubLogo club={n.h} media={media} size={40} /></span>
        <div className="lg-sc"><b>{sc.gh}<i>–</i>{sc.ga}</b><span className={over ? 'ft' : 'clock'}>{over ? L('Final', 'Full time') : clock}</span></div>
        <span><ClubLogo club={n.a} media={media} size={40} /><b>{n.a}</b></span>
      </div>
      <div className="lg-prog"><i style={{ width: `${(m / end) * 100}%` }} /></div>
      <div className="lg-ev">{sc.ev.map((e, i) => (
        <div key={i} className={`lg-e t${e.team}`}><span>{e.label}</span><em>{EV_ICON[e.type]}</em><b>{sName(e.pl)}{e.type === 'og' ? ` (${L('autogol', 'own goal')})` : ''}</b></div>
      ))}</div>
      {!over && <button className="btn lg-skip" onClick={skip}>{L('Saltar al final', 'Skip to the end')}</button>}
    </div>
  )
}

function Fixtures({ S, media, club }: { S: Season; media: Any; club: string }) {
  const r = S.round()
  const cur = S.fixtures.filter(f => f.round === r)
  const last = S.log.slice(-6).reverse()
  return (
    <div className="card lg-fx">
      <div className="h3">{L('Jornada', 'Round')} {r}</div>
      {cur.map(f => (
        <div key={f.h + f.a} className={`lg-f${f.h === club || f.a === club ? ' me' : ''}`}>
          <span className="r">{f.h}<ClubLogo club={f.h} media={media} size={18} /></span>
          <b>{f.res ? `${f.res.gh} – ${f.res.ga}` : 'vs'}</b>
          <span><ClubLogo club={f.a} media={media} size={18} />{f.a}</span>
        </div>))}
      {last.length > 0 && <><div className="note lg-sub">{L('Últimos resultados', 'Latest results')}</div>
        {last.filter(x => x.fx.round !== r).map(x => <div key={x.fx.h + x.fx.a} className="lg-f old"><span className="r">{x.fx.h}</span><b>{x.res.gh} – {x.res.ga}</b><span>{x.fx.a}</span></div>)}</>}
    </div>
  )
}

function TieRow({ t, media, club }: { t: Tie; media: Any; club: string }) {
  const g = (i: number) => t.legs[i]
  const agg = () => { let a = 0, b = 0; t.legs.forEach((m, i) => { const homeIsHi = t.fase === 'playin' ? true : i === 1; a += homeIsHi ? m.gh : m.ga; b += homeIsHi ? m.ga : m.gh }); return [a, b] }
  const [a, b] = agg()
  return (
    <div className={`lg-tie${t.hi === club || t.lo === club ? ' me' : ''}`}>
      <span className={t.winner === t.hi ? 'w' : t.winner ? 'l' : ''}><ClubLogo club={t.hi} media={media} size={20} />{t.hi}</span>
      <span className="lg-legs">{t.legs.length === 0 ? 'vs' : t.fase === 'playin' ? `${g(0).gh}–${g(0).ga}` : <>{g(0) ? `${g(0).ga}–${g(0).gh}` : '·'} <i>|</i> {g(1) ? `${g(1).gh}–${g(1).ga}` : '·'}</>}{t.legs.length >= legsN(t) && t.fase !== 'playin' && <small> ({a}–{b}{t.pens ? `, ${L('pen.', 'pens')} ${t.pens[0]}–${t.pens[1]}` : t.legs.at(-1)?.et ? `, ${L('t. extra', 'extra time')}` : ''})</small>}{t.fase === 'playin' && t.legs.length === 1 && a === b && <small> ({L('mejor ubicado', 'better seed')})</small>}</span>
      <span className={t.winner === t.lo ? 'w' : t.winner ? 'l' : ''}>{t.lo}<ClubLogo club={t.lo} media={media} size={20} /></span>
    </div>
  )
}
const legsN = (t: Tie) => (t.fase === 'playin' ? 1 : 2)

function Bracket({ S, media, club }: { S: Season; media: Any; club: string }) {
  const groups: [string, Tie[]][] = (['playin', 'qf', 'sf', 'final'] as const).map(f => [f, [...new Map([...S.done, ...S.ties].map(t => [t.id, t])).values()].filter(t => t.fase === f)] as [string, Tie[]]).filter(([, t]) => t.length)
  return (
    <div className="card lg-br">
      <div className="h3">{L('Liguilla', 'Playoffs')}</div>
      {groups.map(([f, ts]) => (
        <div key={f}><div className="note lg-sub">{L(FASES[f as keyof typeof FASES].es, FASES[f as keyof typeof FASES].en)}</div>{ts.map(t => <TieRow key={t.id} t={t} media={media} club={club} />)}</div>
      ))}
    </div>
  )
}

function Champion({ club, media, mine, coach }: { club: string; media: Any; mine: boolean; coach: string }) {
  return (
    <div className={`card lg-champ${mine ? ' mine' : ''}`}>
      <ClubLogo club={club} media={media} size={64} />
      <div><span className="note">{L('Campeón', 'Champion')}</span><b>{club}</b>{mine && <em>{L(`¡${coach} lo logró!`, `${coach} did it!`)}</em>}</div>
    </div>
  )
}

function Scorers({ S, media }: { S: Season; media: Any }) {
  const top = [...S.scorers.values()].filter(s => s.g > 0).sort((a, b) => b.g - a.g || a.y - b.y).slice(0, 6)
  const ys = [...S.scorers.values()].reduce((a, s) => a + s.y, 0), rs = [...S.scorers.values()].reduce((a, s) => a + s.r, 0)
  if (!top.length) return null
  return (
    <div className="card lg-sc2">
      <div className="h3">{L('Goleadores', 'Top scorers')}</div>
      {top.map((s, i) => <div key={s.pl.id} className="lg-s"><span className="n">{i + 1}</span><ClubLogo club={s.club} media={media} size={16} /><b>{sName(s.pl)}</b><span className="note">{s.club}</span><em>{s.g}</em></div>)}
      <div className="note lg-sub">🟨 {ys} · 🟥 {rs} {L('en lo simulado', 'in what was simulated')}</div>
    </div>
  )
}

function Probs({ probs, club, media, coach, sameCoach, color }: { probs: { you: Any; base: Any; n: number }; club: string; media: Any; coach: string; sameCoach: boolean; color: string }) {
  const rows = Object.entries(probs.you as Record<string, Any>).sort((a, b) => b[1].title - a[1].title || b[1].liguilla - a[1].liguilla)
  const y = probs.you[club], b = probs.base[club]
  const d = (v: number) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v) * 100, 0)} pts`
  return (
    <div className="lg-pr">
      <div className="lg-pr-h">
        <div><span className="note">{L('Liguilla', 'Playoffs')}</span><b>{pct(100 * y.liguilla, 0)}</b>{!sameCoach && <small className={y.liguilla >= b.liguilla ? 'up' : 'dn'}>{d(y.liguilla - b.liguilla)}</small>}</div>
        <div><span className="note">{L('Final', 'Final')}</span><b>{pct(100 * y.final, 0)}</b>{!sameCoach && <small className={y.final >= b.final ? 'up' : 'dn'}>{d(y.final - b.final)}</small>}</div>
        <div><span className="note">{L('Campeón', 'Champion')}</span><b>{pct(100 * y.title, 1)}</b>{!sameCoach && <small className={y.title >= b.title ? 'up' : 'dn'}>{d(y.title - b.title)}</small>}</div>
        <div><span className="note">{L('Puntos esperados', 'Expected points')}</span><b>{fmt(y.pts, 1)}</b>{!sameCoach && <small className={y.pts >= b.pts ? 'up' : 'dn'}>{y.pts >= b.pts ? '+' : '−'}{fmt(Math.abs(y.pts - b.pts), 1)}</small>}</div>
      </div>
      {!sameCoach && <div className="note">{L(`Frente a «con su DT actual» (${fmt(b.title * 100, 1)}% de ser campeón).`, `Versus "with the current coach" (${fmt(b.title * 100, 1)}% to be champion).`)}</div>}
      <div className="lg-pr-t">{rows.slice(0, 10).map(([c, o]) => (
        <div key={c} className={`lg-pr-r${c === club ? ' me' : ''}`}><ClubLogo club={c} media={media} size={18} /><span>{c}</span><span className="bar"><i style={{ width: `${Math.min(100, o.title * 100 * 3)}%`, background: c === club ? color : undefined }} /></span><b>{pct(100 * o.title, 1)}</b><small>{pct(100 * o.liguilla, 0)} {L('liguilla', 'playoffs')}</small></div>))}</div>
    </div>
  )
}
