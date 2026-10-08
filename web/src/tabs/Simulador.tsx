import { useEffect, useMemo, useState } from 'react'
import { dataUrl, fmt, getJSON, matchColors, pct, sig, simulateMatch, type Any } from '../lib'
import { ClubName, Legend, Pitch, useTip } from '../charts'
import { Seg } from './common'
import MatchSim from '../MatchSim'

export function Simulador({ art, media }: { art: Any; media?: Any }) {
  const S = art.simulacion
  const ps: Any[] = [...S.partidos].reverse()
  const [mid, setMid] = useState<number>(ps[0]?.match_id)
  const n = 50000  // siempre 50,000 rejugadas
  const [modo, setModo] = useState<'mil' | 'uno'>('mil')
  const [res, setRes] = useState<Any>(null)
  const [err, setErr] = useState<string | null>(null)
  const run = () => {
    setRes(null); setErr(null)
    getJSON(dataUrl(`sim_${art.id}.json`)).then((all: Any) => {
      const data = all[mid]
      const shots: number[][] | undefined = data?.t
      const p = art.partidos.find((x: Any) => x.match_id === mid)
      if (!shots || !p) { setErr('No hay tiros registrados para este partido.'); return }
      // se deja respirar al navegador antes de simular (la interfaz muestra «Rejugando…»)
      setTimeout(() => setRes({ ...simulateMatch(shots, n), partido: p, tiros: shots, data }), 10)
    }).catch(e => setErr(e.message))
  }
  useEffect(run, [mid]) // eslint-disable-line react-hooks/exhaustive-deps
  const pts = useMemo(() => {
    let a = 0, e = 0
    return S.partidos.map((p: Any) => { a += p.puntos; e += p.xpts; return { a, e } })
  }, [S])
  const cols = res ? matchColors(res.partido.club, res.partido.rival, media) : ['var(--c-dt)', 'var(--c-plantilla)']
  const golSim = new Set<number>(res?.golesSim || [])
  return (
    <div>
      <h3 className="h2">Simulador: rejugar cada partido</h3>
      <p className="lede">Cada posesión que terminó en tiro se vuelve gol con probabilidad igual a su xG (máximo un gol por posesión), miles de veces. No predice: muestra si el marcador reflejó lo que pasó en la cancha.</p>
      <Seg opts={[['mil', '50,000 rejugadas'], ['uno', 'Simular uno (animado)']]} v={modo} set={v => setModo(v as 'mil' | 'uno')} />
      <div className="sim-controls">
        <select value={mid} onChange={e => setMid(Number(e.target.value))} aria-label="Partido">
          {ps.map(p => <option key={p.match_id} value={p.match_id}>{p.date} · {p.local ? 'vs' : '@'} {p.rival} · {p.gf}-{p.gc}</option>)}
        </select>
      </div>
      {err && <p className="note">{err}</p>}
      {modo === 'uno' && (res ? <MatchSim key={res.partido.match_id} art={art} media={media} data={res.data} partido={res.partido} /> : <p className="note">Preparando partido…</p>)}
      {modo === 'mil' && <div className="sim-layout2">
        <div className="card">
          {res ? <Pitch>{res.tiros.map(([x, y, xg, own, g]: number[], i: number) => {
            const X = own ? x : 120 - x, Y = own ? y : 80 - y
            const c = own ? cols[0] : cols[1]
            const r = 0.7 + 3 * Math.sqrt(xg)
            return <g key={i}>
              <circle cx={X} cy={Y} r={r} fill={golSim.has(i) ? c : 'none'} stroke={c} strokeWidth={0.35} />
              {g === 1 && <circle cx={X} cy={Y} r={r + 1.1} fill="none" stroke="var(--ink)" strokeWidth={0.45} />}
            </g>
          })}</Pitch> : <Pitch />}
          {res && <Legend items={[{ key: 'a', label: `${res.partido.club} ataca → · xG ${fmt(res.xg, 2)}`, color: cols[0] }, { key: 'b', label: `← ${res.partido.rival} ataca · xG ${fmt(res.xg_rival, 2)}`, color: cols[1] }]} />}
          {res && <div className="note">Tamaño ∝ xG. <b>Relleno</b> = gol en una rejugada que terminó con el marcador más probable ({res.modal[0]}–{res.modal[1]}). <b>Anillo</b> = gol real ({res.partido.gf}–{res.partido.gc}).</div>}
        </div>
        <div className="card sim-box">
          <div className="sim-box-inner">
            {res ? <><SimHeader r={res} media={media} cols={cols} /><SimScoreGrid r={res} /></> : <p className="note">Rejugando…</p>}
          </div>
        </div>
      </div>}

      <h3 className="h2">Toda su etapa: puntos vs puntos esperados</h3>
      <div className="grid3">
        <div className="card"><div className="note">Puntos reales</div><div className="big">{S.puntos}</div></div>
        <div className="card"><div className="note">Puntos esperados (xPts)</div><div className="big">{fmt(S.xpts)}</div><div className="note">{S.puntos >= S.xpts ? 'Sumó más de lo que generó' : 'Sumó menos de lo que generó'} ({sig((S.puntos - S.xpts) / 1).replace('σ', '')} pts)</div></div>
        <div className="card"><div className="note">Dominio medio (cuota de xG)</div><div className="big">{pct(S.dominio_medio)}</div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="h3">Puntos reales vs esperados, acumulados</div>
        <CumPts rows={pts} />
      </div>
    </div>
  )
}

function SimHeader({ r, media, cols }: { r: Any; media?: Any; cols: string[] }) {
  const segs = [[`Gana ${r.partido.club}`, r.victoria, cols[0]], ['Empate', r.empate, 'var(--c-resid)'], [`Gana ${r.partido.rival}`, r.derrota, cols[1]]] as [string, number, string][]
  let acc = 0
  const light = (c: string) => /^#(f|e)/i.test(c)
  return (
    <div className="sim-head">
      <div className="sim-teams">
        <ClubName club={r.partido.club} media={media} size={26} />
        <ClubName club={r.partido.rival} media={media} size={26} />
      </div>
      <div className="sim-scores">
        <div><div className="note">Más probable al rejugar</div><b className="sim-modal">{r.modal[0]}–{r.modal[1]}</b><div className="note">{pct(100 * r.modalP)} de las rejugadas</div></div>
        <div><div className="note">Real</div><b className="sim-real">{r.partido.gf}–{r.partido.gc}</b></div>
      </div>
      <svg viewBox="0 0 400 24" style={{ width: '100%', margin: '12px 0 4px' }} role="img" aria-label={segs.map(([l, v]) => `${l} ${Math.round(v * 100)}%`).join(', ')}>
        {segs.map(([l, v, c]) => { const x = acc; acc += v * 400; return <g key={l}><rect x={x + 1} y={0} width={Math.max(0, v * 400 - 2)} height={22} rx={4} fill={c} />{v > 0.1 && <text x={x + v * 200} y={15} fontSize={12} textAnchor="middle" fill={light(c) ? '#111' : '#fff'} fontWeight={700}>{Math.round(v * 100)}%</text>}</g> })}
      </svg>
      <Legend items={segs.map(([l, , c]) => ({ key: l, label: l, color: c }))} />
      <div className="note">xPts del partido <b>{fmt(r.xpts, 2)}</b> · {r.n.toLocaleString('es-MX')} rejugadas</div>
    </div>
  )
}

function SimScoreGrid({ r }: { r: Any }) {
  const tip = useTip()
  const maxP = Math.max(...r.marcadores.flat())
  return (
    <div className="sim-grid">
      <div className="h3">Marcadores más probables</div>
      <svg viewBox="0 6 230 224" preserveAspectRatio="xMidYMid meet">
        <text x={130} y={12} fontSize={10} textAnchor="middle" fill="var(--ink-3)">goles de {r.partido.rival} →</text>
        <text x={10} y={130} fontSize={10} textAnchor="middle" fill="var(--ink-3)" transform="rotate(-90 10 130)">goles de {r.partido.club} →</text>
        {r.marcadores.map((row: number[], i: number) => row.map((p, j) => {
          const real = i === Math.min(r.partido.gf, 5) && j === Math.min(r.partido.gc, 5)
          const modal = i === r.modal[0] && j === r.modal[1]
          return (
            <g key={`${i}${j}`} onMouseMove={e => tip.show(e, <>{i}{i === 5 ? '+' : ''}–{j}{j === 5 ? '+' : ''}: {pct(100 * p, 1)}{real ? ' · real' : ''}{modal ? ' · más probable' : ''}</>)} onMouseLeave={tip.hide}>
              <rect x={24 + j * 34} y={20 + i * 34} width={32} height={32} rx={3} fill={`color-mix(in oklab, var(--c-dt) ${Math.round(100 * p / maxP)}%, var(--surface-2))`}
                stroke={real ? 'var(--ink)' : modal ? 'var(--ink)' : 'none'} strokeWidth={2} strokeDasharray={modal && !real ? '4 3' : undefined} />
              {p > 0.02 && <text x={40 + j * 34} y={40 + i * 34} fontSize={10} textAnchor="middle" fill={p / maxP > 0.55 ? '#fff' : 'var(--ink)'}>{Math.round(p * 100)}</text>}
            </g>
          )
        }))}
      </svg>
      <div className="note">% de las rejugadas. Recuadro continuo: marcador real · punteado: más probable.</div>
      {tip.el}
    </div>
  )
}

function CumPts({ rows }: { rows: { a: number; e: number }[] }) {
  const W = 900, H = 170, P = { l: 36, r: 60, t: 10, b: 20 }
  const max = Math.max(...rows.map(r => Math.max(r.a, r.e)), 1)
  const x = (i: number) => P.l + i / Math.max(rows.length - 1, 1) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b)
  const last = rows.at(-1)!
  return (
    <div className="tbl-wrap"><svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 520 }}>
      <polyline points={rows.map((r, i) => `${x(i)},${y(r.e)}`).join(' ')} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="5 4" />
      <polyline points={rows.map((r, i) => `${x(i)},${y(r.a)}`).join(' ')} fill="none" stroke="var(--c-dt)" strokeWidth={2.5} />
      <text x={x(rows.length - 1) + 6} y={y(last.a) + 4} fontSize={12} fill="var(--ink)">Reales {last.a}</text>
      <text x={x(rows.length - 1) + 6} y={y(last.e) + 16} fontSize={12} fill="var(--ink-3)">xPts {Math.round(last.e)}</text>
      <text x={P.l} y={H - 4} fontSize={11} fill="var(--ink-3)">partido 1</text>
      <text x={W - P.r} y={H - 4} fontSize={11} textAnchor="end" fill="var(--ink-3)">partido {rows.length}</text>
    </svg></div>
  )
}

/* ================================================================ MÉTODO */
