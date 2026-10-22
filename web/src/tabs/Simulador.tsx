import { useEffect, useMemo, useState } from 'react'
import { asset, dataUrl, fmt, getJSON, jugadorCorto, matchColors, pct, sig, simulateMatch, type Any } from '../lib'
import { ClubLogo, ClubName, Legend, Pitch, useTip } from '../charts'
import { Seg } from './common'
import MatchSim from '../MatchSim'
import { L, LOCALE } from '../settings'
import Info from '../Info'
import StyleLab from '../StyleLab'
import type { Fx } from '../sim/styleModel'
import MatchPicker, { currentClub, type MatchRow } from '../MatchPicker'

export function Simulador({ art, media, glob }: { art: Any; media?: Any; glob?: Any }) {
  const S = art.simulacion
  // partidos del más reciente al más antiguo, con club y temporada
  const rows: MatchRow[] = useMemo(() => {
    const info = new Map<number, Any>((art.partidos || []).map((p: Any) => [p.match_id, p]))
    return [...S.partidos].reverse().map((p: Any) => {
      const q = info.get(p.match_id) || {}
      return { match_id: p.match_id, fecha: q.fecha ?? p.date, club: q.club ?? '', rival: p.rival, local: p.local, gf: p.gf, gc: p.gc, temporada: q.temporada, xg: p.xg, xg_rival: p.xg_rival }
    })
  }, [art, S])
  const clubActual = useMemo(() => currentClub(art, media, [...new Set(rows.map(r => r.club))]), [art, media, rows])
  const [mid, setMid] = useState<number>(() => (rows.find(r => r.club === clubActual) ?? rows[0])?.match_id)
  useEffect(() => { if (!rows.some(r => r.match_id === mid)) setMid((rows.find(r => r.club === clubActual) ?? rows[0])?.match_id) }, [rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const n = 50000  // siempre 50,000 rejugadas
  const [modo, setModo] = useState<'mil' | 'uno'>('mil')
  const [res, setRes] = useState<Any>(null)
  const [fx, setFx] = useState<Fx | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const tip = useTip()
  const run = () => {
    setRes(null); setErr(null)
    getJSON(dataUrl(`sim_${art.id}.json`)).then((all: Any) => {
      const data = all[mid]
      const shots: number[][] | undefined = data?.t
      const p = art.partidos.find((x: Any) => x.match_id === mid)
      if (!shots || !p) { setErr(L('No hay tiros registrados para este partido.', 'No shots recorded for this match.')); return }
      // se deja respirar al navegador antes de simular (la interfaz muestra «Rejugando…»)
      setTimeout(() => setRes({ ...simulateMatch(shots, n, fx ?? undefined), base: fx ? simulateMatch(shots, 20000) : null, partido: p, tiros: shots, data, fx }), 10)
    }).catch(e => setErr(e.message))
  }
  useEffect(run, [mid, fx]) // eslint-disable-line react-hooks/exhaustive-deps
  // una curva por club, cada una desde cero: así no se mezcla una etapa buena con una mala
  const porClub = useMemo(() => {
    const info = new Map<number, Any>((art.partidos || []).map((p: Any) => [p.match_id, p]))
    const g = new Map<string, { a: number; e: number; p: Any }[]>()
    for (const p of S.partidos) {
      const c = info.get(p.match_id)?.club ?? '—'
      const prev = g.get(c)?.at(-1)
      const row = { a: (prev?.a ?? 0) + p.puntos, e: (prev?.e ?? 0) + p.xpts, p }
      g.set(c, [...(g.get(c) ?? []), row])
    }
    return [...g.entries()]
  }, [S, art])
  const cols = res ? matchColors(res.partido.club, res.partido.rival, media) : ['var(--c-dt)', 'var(--c-plantilla)']
  const golSim = new Set<number>(res?.golesSim || [])
  const shooters: [number, string][] = res?.data?.s || []
  const shotTip = (i: number, [, , xg, own, g, minute]: number[]) => {
    const who = shooters[i]
    return (
      <div className="sim-tip">
        <b>{who ? jugadorCorto(who[0], who[1]) : L('Tiro', 'Shot')}</b>
        <span>{own ? res.partido.club : res.partido.rival} · {L('minuto', 'minute')} {minute}'</span><br />
        <span>xG {fmt(xg, 2)} · {g ? <b style={{ display: 'inline' }}>{L('fue gol', 'goal')}</b> : L('no fue gol', 'no goal')}</span>
        {golSim.has(i) && <div className="note">{L('Gol en la rejugada que se muestra', 'Goal in the replay shown')}</div>}
      </div>
    )
  }
  return (
    <div>
      <h3 className="h2">{L('Rejugar sus partidos', 'Replay his matches')}</h3>
<div className="tab-sub">{L('Volvemos a jugar cada partido 50,000 veces con los mismos tiros: cada uno entra con la probabilidad que marca su xG. Así se ve si el marcador fue justo con lo que pasó en la cancha.', 'We replay every match 50,000 times with the same shots: each one goes in with the probability its xG says. That shows whether the scoreline was fair to what happened on the pitch.')}</div>
      <Seg opts={[['mil', L('Probabilidades', 'Probabilities')], ['uno', L('Verlo jugada a jugada', 'Watch it play by play')]]} v={modo} set={v => setModo(v as 'mil' | 'uno')} />
      {glob && <StyleLab art={art} media={media} onChange={f => setFx(old => (JSON.stringify(old) === JSON.stringify(f) ? old : f))} />}
      <MatchPicker key={art.id} rows={rows} value={mid} onChange={setMid} media={media} defaultClub={clubActual} />
      {err && <p className="note">{err}</p>}
      {modo === 'uno' && (res ? <MatchSim key={res.partido.match_id + (fx ? 'x' : '')} art={art} media={media} data={res.data} partido={res.partido} fx={fx} /> : <p className="note">{L('Preparando partido…', 'Setting up the match…')}</p>)}
      {modo === 'mil' && <div className="sim-layout2">
        <div className="card">
          {res ? <Pitch>{res.tiros.map((t: number[], i: number) => {
            const [x, y, xg, own, g] = t
            const X = own ? x : 120 - x, Y = own ? y : 80 - y
            const c = own ? cols[0] : cols[1]
            const r = 0.7 + 3 * Math.sqrt(xg)
            return <g key={i} className="sim-shot" onMouseMove={e => tip.show(e, shotTip(i, t))} onMouseLeave={tip.hide}>
              <circle cx={X} cy={Y} r={r} fill={golSim.has(i) ? c : 'none'} stroke={c} strokeWidth={0.35} />
              {g === 1 && <circle cx={X} cy={Y} r={r + 1.1} fill="none" stroke="var(--ink)" strokeWidth={0.45} />}
              <circle cx={X} cy={Y} r={Math.max(r + 1.2, 2.2)} fill="transparent" />
            </g>
          })}</Pitch> : <Pitch />}
          {res && <Legend items={[{ key: 'a', label: L(`${res.partido.club} ataca → · xG ${fmt(res.xg, 2)}`, `${res.partido.club} attack → · xG ${fmt(res.xg, 2)}`), color: cols[0] }, { key: 'b', label: L(`← ${res.partido.rival} ataca · xG ${fmt(res.xg_rival, 2)}`, `← ${res.partido.rival} attack · xG ${fmt(res.xg_rival, 2)}`), color: cols[1] }]} extra={<Info wide label={L('Cómo leer la cancha', 'How to read the pitch')}>{L('Cada círculo es un tiro; más grande, más claro el chance (xG). ', 'Each circle is a shot; the bigger it is, the better the chance (xG). ')}<b>{L('Relleno', 'Filled')}</b>{L(': gol en una rejugada que terminó con el marcador más probable', ': goal in a replay that ended with the most likely score')} ({res.modal[0]}–{res.modal[1]}). <b>{L('Anillo', 'Ring')}</b>{L(': gol real', ': actual goal')} ({res.partido.gf}–{res.partido.gc}). {L('Pasa el cursor por un tiro para ver quién lo hizo.', 'Hover over a shot to see who took it.')}</Info>} />}
          {tip.el}
        </div>
        <div className="card sim-box">
          <div className="sim-box-inner">
            {res ? <><SimHeader r={res} media={media} cols={cols} /><SimScoreGrid r={res} media={media} /></> : <p className="note">{L('Rejugando…', 'Replaying…')}</p>}
          </div>
        </div>
      </div>}

      <h3 className="h2">{L('Toda su etapa: puntos vs puntos esperados', 'His whole spell: points vs expected points')}</h3>
      <div className="grid3">
        <div className="card"><div className="note">{L('Puntos reales', 'Actual points')}</div><div className="big">{S.puntos}</div></div>
        <div className="card"><div className="note">{L('Puntos esperados (xPts)', 'Expected points (xPts)')}</div><div className="big">{fmt(S.xpts)}</div><div className="note">{S.puntos >= S.xpts ? L('Sumó más de lo que generó', 'Took more points than his chances suggested') : L('Sumó menos de lo que generó', 'Took fewer points than his chances suggested')} ({sig((S.puntos - S.xpts) / 1).replace('σ', '')} pts)</div></div>
        <div className="card"><div className="note">{L('Dominio medio (cuota de xG)', 'Average dominance (xG share)')}</div><div className="big">{pct(S.dominio_medio)}</div></div>
      </div>
      <div className="sim-clubs">
        {porClub.map(([club, rows]) => {
          const last = rows.at(-1)!
          const d = last.a - last.e
          return (
            <div className="card" key={club}>
              <div className="h3 sim-club-h"><ClubLogo club={club} media={media} size={22} />{club}</div>
              <div className="note">{rows.length} {L('partidos', 'matches')} · {last.a} {L('reales vs', 'actual vs')} {fmt(last.e, 0)} {L('esperados', 'expected')} (<b className={d >= 0 ? 'up' : 'dn'}>{d >= 0 ? '+' : '−'}{fmt(Math.abs(d), 0)}</b>)</div>
              <CumPts rows={rows} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SimHeader({ r, media, cols }: { r: Any; media?: Any; cols: string[] }) {
  const segs = [[L(`Gana ${r.partido.club}`, `${r.partido.club} win`), r.victoria, cols[0]], [L('Empate', 'Draw'), r.empate, 'var(--c-resid)'], [L(`Gana ${r.partido.rival}`, `${r.partido.rival} win`), r.derrota, cols[1]]] as [string, number, string][]
  let acc = 0
  const light = (c: string) => /^#(f|e)/i.test(c)
  return (
    <div className="sim-head">
      <div className="sim-teams">
        <ClubName club={r.partido.club} media={media} size={26} />
        <ClubName club={r.partido.rival} media={media} size={26} />
      </div>
      <div className="sim-scores">
        <div className="sim-main"><div className="note">{r.fx ? L('Más probable con el estilo cambiado', 'Most likely with the changed style') : L('Más probable al rejugar', 'Most likely in replays')}</div><b className="sim-modal">{r.modal[0]}–{r.modal[1]}</b><div className="note">{pct(100 * r.modalP)} {L('de las rejugadas', 'of replays')}</div></div>
        <div className="sim-realrow"><span>{L('Marcador real', 'Actual score')}</span><b className="sim-real">{r.partido.gf}–{r.partido.gc}</b></div>
      </div>
      {r.base && <div className="sim-delta">{L('Con su estilo real:', 'With his real style:')} {L('gana', 'win')} {pct(100 * r.base.victoria)} → <b className={r.victoria >= r.base.victoria ? 'up' : 'dn'}>{pct(100 * r.victoria)}</b> · xPts {fmt(r.base.xpts, 2)} → <b className={r.xpts >= r.base.xpts ? 'up' : 'dn'}>{fmt(r.xpts, 2)}</b></div>}
      <svg viewBox="0 0 400 24" style={{ width: '100%', margin: '12px 0 4px' }} role="img" aria-label={segs.map(([l, v]) => `${l} ${Math.round(v * 100)}%`).join(', ')}>
        {segs.map(([l, v, c]) => { const x = acc; acc += v * 400; return <g key={l}><rect x={x + 1} y={0} width={Math.max(0, v * 400 - 2)} height={22} rx={4} fill={c} />{v > 0.1 && <text x={x + v * 200} y={15} fontSize={12} textAnchor="middle" fill={light(c) ? '#111' : '#fff'} fontWeight={700}>{Math.round(v * 100)}%</text>}</g> })}
      </svg>
      <Legend items={segs.map(([l, , c]) => ({ key: l, label: l, color: c }))} />
      <div className="note">{L('Puntos esperados del partido', 'Expected points for the match')} <b>{fmt(r.xpts, 2)}</b> · {r.n.toLocaleString(LOCALE)} {L('rejugadas', 'replays')}</div>
    </div>
  )
}

/** Marcadores de las rejugadas: filas = goles del equipo del DT (0…5+), columnas = goles del rival. */
function SimScoreGrid({ r, media }: { r: Any; media?: Any }) {
  const tip = useTip()
  const maxP = Math.max(...r.marcadores.flat())
  const C = 36, X0 = 44, Y0 = 42, N = 6, GL = N * C
  const lab = (k: number) => (k === N - 1 ? `${k}+` : String(k))
  const club = r.partido.club, rival = r.partido.rival
  const realI = Math.min(r.partido.gf, N - 1), realJ = Math.min(r.partido.gc, N - 1)
  // título de eje con escudo, centrado sobre la cuadrícula (ancho del texto estimado)
  const Axis = ({ team, rot }: { team: string; rot?: boolean }) => {
    const txt = L(`Goles de ${team}`, `${team} goals`), w = 18 + txt.length * 6.6, logo = asset(media?.clubes?.[team]?.logo)
    const start = (GL - w) / 2
    return (
      <g transform={rot ? `translate(12 ${Y0 + GL}) rotate(-90)` : `translate(${X0} 12)`}>
        {logo && <image href={logo} x={start} y={-12} width={15} height={15} />}
        <text x={start + (logo ? 18 : 0)} y={0} className="sg-axis">{txt}</text>
      </g>
    )
  }
  return (
    <div className="sim-grid">
      <div className="h3">{L('Marcadores más probables', 'Most likely scorelines')}<Info>{L('% de las rejugadas que acabaron con cada marcador. Recuadro continuo: marcador real · punteado: el más probable.', '% of replays that ended with each scoreline. Solid box: actual score · dashed: most likely.')}</Info></div>
      <svg viewBox={`0 0 ${X0 + GL + 2} ${Y0 + GL + 2}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={L(`Probabilidad de cada marcador: filas goles de ${club}, columnas goles de ${rival}`, `Probability of each scoreline: rows ${club} goals, columns ${rival} goals`)}>
        <Axis team={rival} />
        <Axis team={club} rot />
        {Array.from({ length: N }, (_, k) => <g key={k}>
          <text x={X0 + k * C + C / 2 - 1} y={Y0 - 8} textAnchor="middle" className="sg-num">{lab(k)}</text>
          <text x={X0 - 9} y={Y0 + k * C + C / 2 + 3} textAnchor="middle" className="sg-num">{lab(k)}</text>
        </g>)}
        {r.marcadores.map((row: number[], i: number) => row.map((p, j) => {
          const real = i === realI && j === realJ
          const modal = i === r.modal[0] && j === r.modal[1]
          return (
            <g key={`${i}-${j}`} className="sg-cell" onMouseMove={e => tip.show(e, <>{club} {lab(i)} – {lab(j)} {rival}: <b>{pct(100 * p, 1)}</b> {L('de las rejugadas', 'of replays')}{real ? L(' · marcador real', ' · actual score') : ''}{modal ? L(' · el más probable', ' · most likely') : ''}</>)} onMouseLeave={tip.hide}>
              <rect x={X0 + j * C} y={Y0 + i * C} width={C - 2} height={C - 2} rx={3} fill={`color-mix(in oklab, var(--c-dt) ${Math.round(100 * p / maxP)}%, var(--surface-2))`}
                stroke={real || modal ? 'var(--ink)' : 'none'} strokeWidth={2} strokeDasharray={modal && !real ? '4 3' : undefined} />
              {p > 0.005 && <text x={X0 + j * C + C / 2 - 1} y={Y0 + i * C + C / 2 + 3} fontSize={10} textAnchor="middle" fill={p / maxP > 0.55 ? '#fff' : 'var(--ink)'}>{p < 0.01 ? '<1' : Math.round(p * 100)}</text>}
            </g>
          )
        }))}
      </svg>
      {tip.el}
    </div>
  )
}

function CumPts({ rows }: { rows: { a: number; e: number; p: Any }[] }) {
  const W = 420, H = 200, P = { l: 30, r: 70, t: 10, b: 20 }
  const tip = useTip()
  const max = Math.max(...rows.map(r => Math.max(r.a, r.e)), 1)
  const x = (i: number) => P.l + i / Math.max(rows.length - 1, 1) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b)
  const last = rows.at(-1)!
  return (
    <div className="tbl-wrap"><svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <polyline points={rows.map((r, i) => `${x(i)},${y(r.e)}`).join(' ')} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="5 4" />
      <polyline points={rows.map((r, i) => `${x(i)},${y(r.a)}`).join(' ')} fill="none" stroke="var(--c-dt)" strokeWidth={2.5} />
      {rows.map((r, i) => (
        <circle key={i} cx={x(i)} cy={y(r.a)} r={rows.length > 60 ? 2.6 : 4} fill="var(--c-dt)" stroke="var(--surface)" strokeWidth={1}
          onMouseMove={e => tip.show(e, <><b>{r.p.date}</b> · {r.p.local ? 'vs' : L('en', 'at')} {r.p.rival} {r.p.gf}-{r.p.gc}<br />{r.p.puntos} pts · {L('merecía', 'deserved')} {fmt(r.p.xpts, 1)}<br />{L('Acumulado', 'Running total')}: {r.a} vs {fmt(r.e, 0)}</>)} onMouseLeave={tip.hide} />
      ))}
      <text x={x(rows.length - 1) + 6} y={y(last.a) + 4} fontSize={12} fill="var(--ink)">{L('Reales', 'Actual')} {last.a}</text>
      <text x={x(rows.length - 1) + 6} y={y(last.e) + 16} fontSize={12} fill="var(--ink-3)">xPts {Math.round(last.e)}</text>
      <text x={P.l} y={H - 4} fontSize={11} fill="var(--ink-3)">{L('partido', 'match')} 1</text>
      <text x={W - P.r} y={H - 4} fontSize={11} textAnchor="end" fill="var(--ink-3)">{L('partido', 'match')} {rows.length}</text>
    </svg>{tip.el}</div>
  )
}

/* ================================================================ MÉTODO */
