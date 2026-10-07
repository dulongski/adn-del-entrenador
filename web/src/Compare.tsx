import { useEffect, useMemo, useState } from 'react'
import { ClubName, CoachPhoto } from './charts'
import { clubColor, dataUrl, fmt, getJSON, nombreDT, shortName, type Any } from './lib'

/* Cara a cara: compara el estilo PROPIO (α, ya descontada su plantilla) de dos DTs.
   Parecido = correlación de Pearson entre sus huellas α sobre los mismos indicadores del mapa de estilos. */

export function corr(a: Record<string, number>, b: Record<string, number>, keys: string[]) {
  const xs = keys.map(k => a[k] ?? 0), ys = keys.map(k => b[k] ?? 0), n = keys.length
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0
}

/** Todos los demás DTs ordenados del más parecido al más distinto. */
export function similares(id: number, mapa: Any): { id: number; r: number }[] {
  const me = mapa.puntos.find((p: Any) => p.id === id)
  if (!me) return []
  return mapa.puntos.filter((p: Any) => p.id !== id)
    .map((p: Any) => ({ id: p.id, r: corr(me.alpha, p.alpha, mapa.kpis) }))
    .sort((a: Any, b: Any) => b.r - a.r)
}

const verdict = (r: number) => r >= 0.6 ? 'muy parecidos' : r >= 0.3 ? 'parecidos' : r > -0.3 ? 'distintos' : r > -0.6 ? 'bastante opuestos' : 'opuestos'
const hexRgb = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
const sgn = (v: number) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), 2)}σ`
const fmtForm = (f?: string) => (f ? f.split('').join('-') : '—')

export default function Compare({ art, glob, media, mapa, onOpen }: { art: Any; glob: Any; media: Any; mapa: Any; onOpen: (id: number) => void }) {
  const sims = useMemo(() => similares(art.id, mapa), [art.id, mapa])
  const pts = useMemo(() => new Map<number, Any>(mapa.puntos.map((p: Any) => [p.id, p])), [mapa])
  const [rid, setRid] = useState<number | null>(sims[0]?.id ?? null)
  const [other, setOther] = useState<Any>(null)
  const [all, setAll] = useState(false)
  useEffect(() => { setOther(null); if (rid !== null) getJSON(dataUrl(`dt_${rid}.json`)).then(setOther).catch(() => setOther(false)) }, [rid])

  const A = pts.get(art.id), B = rid !== null ? pts.get(rid) : null
  if (!A) return <p className="note">Este DT no aparece en el mapa de estilos, así que no se puede comparar.</p>
  if (!B) return <p className="note">Elige con quién compararlo.</p>

  const clubA = media.dts[art.id]?.club ?? art.etapas.at(-1)?.club, clubB = media.dts[B.id]?.club ?? B.clubes.at(-1)
  let ca = clubColor(clubA, media), cb = clubColor(clubB, media)
  if (ca.startsWith('var')) ca = '#3987e5'
  if (cb.startsWith('var')) cb = '#e5484d'
  const ra = hexRgb(ca), rb = hexRgb(cb)
  if (ra && rb && Math.hypot(ra[0] - rb[0], ra[1] - rb[1], ra[2] - rb[2]) < 120) cb = '#f2f2f2'
  const r = sims.find(s => s.id === B.id)?.r ?? 0
  const nA = shortName(A.nombre), nB = shortName(B.nombre)
  const grupo = (p: Any) => mapa.grupos.find((g: Any) => g.id === p.grupo)?.nombre ?? '—'

  const rows = (mapa.kpis as string[]).map(k => ({ k, a: A.alpha[k] ?? 0, b: B.alpha[k] ?? 0 }))
    .map(o => ({ ...o, d: o.a - o.b })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
  const shown = all ? rows : rows.slice(0, 12)
  const lab = (k: string) => glob.kpis[k]?.etiqueta ?? k
  const top = rows.slice(0, 3)
  const same = rows.filter(o => Math.abs(o.d) < 0.15 && Math.abs(o.a) > 0.4 && Math.sign(o.a) === Math.sign(o.b)).slice(0, 2)

  // ------------------------------------------------ dumbbell
  const M = Math.min(2.5, Math.max(1, ...shown.flatMap(o => [Math.abs(o.a), Math.abs(o.b)])) * 1.08)
  const W = 720, L = 250, R = 24, rowH = 30, H = shown.length * rowH + 34
  const X = (v: number) => L + ((Math.max(-M, Math.min(M, v)) + M) / (2 * M)) * (W - L - R)

  // ------------------------------------------------ mapa mini
  const xs = mapa.puntos.map((p: Any) => p.x), ys = mapa.puntos.map((p: Any) => p.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const MX = (x: number) => 14 + ((x - x0) / (x1 - x0)) * 292, MY = (y: number) => 186 - ((y - y0) / (y1 - y0)) * 172

  const facts = (d: Any, p: Any) => {
    if (!d) return null
    const tr = (d.transferencia ?? []) as Any[]
    const best = tr.length ? tr.reduce((a, b) => (a.rank_ajustado <= b.rank_ajustado ? a : b)) : null
    const f = Object.entries(d.jugadores?.formaciones ?? {}).sort((a: Any, b: Any) => b[1] - a[1])[0]
    const np = d.simulacion?.partidos?.length || d.partidos_total
    return {
      partidos: d.partidos_total, clubes: d.etapas.length, ident: d.identificabilidad?.indice,
      familia: grupo(p), form: fmtForm(f?.[0]), ppp: d.simulacion ? d.simulacion.puntos / np : null, xppp: d.simulacion ? d.simulacion.xpts / np : null,
      transfer: best ? `${best.rank_ajustado}º de ${best.n_clases}` : 'no aplica', corners: d.balon_parado?.ofensivo?.corners_por_partido,
    }
  }
  const fa = facts(art, A), fb = other ? facts(other, B) : null
  const factRows: [string, (f: Any) => string][] = [
    ['Familia de estilo', f => f.familia], ['Partidos en la muestra', f => fmt(f.partidos, 0)], ['Clubes dirigidos', f => String(f.clubes)],
    ['Identificabilidad', f => (f.ident != null ? `${fmt(f.ident, 0)}/100` : '—')], ['Formación más usada', f => f.form],
    ['Puntos por partido', f => (f.ppp != null ? fmt(f.ppp, 2) : '—')], ['Puntos esperados (xPts) por partido', f => (f.xppp != null ? fmt(f.xppp, 2) : '—')],
    ['Prueba de transferencia (mejor)', f => f.transfer], ['Córners a favor por partido', f => (f.corners != null ? fmt(f.corners, 1) : '—')],
  ]

  const side = (p: Any, d: Any, col: string, club: string, align: 'l' | 'r') => {
    const nm = nombreDT(p.id, p.nombre)
    return (
      <div className={`vs-side vs-${align}`} style={{ ['--vc' as string]: col }}>
        <CoachPhoto name={p.nombre} src={media.dts[p.id]?.foto} size={104} />
        <div className="vs-id">
          <div className="vs-name">{nm ? <><span className="light">{nm.nombres}</span> {nm.apellidos}</> : p.nombre}</div>
          {club && <ClubName club={club} media={media} size={18} />}
          <div className="vs-fam">{grupo(p)}</div>
          {d && d.id !== art.id && <button className="vs-open" onClick={() => onOpen(p.id)}>Abrir su perfil →</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="vs">
      <div className="vs-pick">
        <label className="wi-field" style={{ minWidth: 260, flex: 1 }}>
          <span>Comparar con</span>
          <select value={B.id} onChange={e => setRid(Number(e.target.value))}>
            <optgroup label="Más parecidos">{sims.slice(0, 6).map(s => <option key={s.id} value={s.id}>{shortName(pts.get(s.id).nombre)} · r {fmt(s.r, 2)}</option>)}</optgroup>
            <optgroup label="Más distintos">{sims.slice(-6).reverse().map(s => <option key={s.id} value={s.id}>{shortName(pts.get(s.id).nombre)} · r {fmt(s.r, 2)}</option>)}</optgroup>
            <optgroup label="Todos">{[...sims].sort((a, b) => shortName(pts.get(a.id).nombre).localeCompare(shortName(pts.get(b.id).nombre), 'es')).map(s => <option key={s.id} value={s.id}>{shortName(pts.get(s.id).nombre)}</option>)}</optgroup>
          </select>
        </label>
        <div className="vs-quick">
          <button className="chip" onClick={() => setRid(sims[0].id)}>Su gemelo: {shortName(pts.get(sims[0].id).nombre)}</button>
          <button className="chip" onClick={() => setRid(sims.at(-1)!.id)}>Su opuesto: {shortName(pts.get(sims.at(-1)!.id).nombre)}</button>
        </div>
      </div>

      <div className="vs-face">
        {side(A, art, ca, clubA, 'l')}
        <div className="vs-mid">
          <span className="vs-badge">VS</span>
          <b className="vs-rval">{r >= 0 ? '+' : '−'}{fmt(Math.abs(r), 2)}</b>
          <span className="vs-verd">{verdict(r)}</span>
          <span className="note">correlación de estilos</span>
        </div>
        {side(B, other || { id: B.id }, cb, clubB, 'r')}
      </div>

      <div className="card vs-sum">
        <p>
          Con la plantilla descontada, {nA} y {nB} son <b>{verdict(r)}</b> (r = {fmt(r, 2)}; entre todos los pares de la liga, 0 es lo típico).
          {' '}Donde más se separan: {top.map((o, i) => (
            <span key={o.k}>{i ? (i === top.length - 1 ? ' y ' : ', ') : ''}«{lab(o.k)}» ({nA} {sgn(o.a)}, {nB} {sgn(o.b)})</span>
          ))}.
          {same.length > 0 && <> Coinciden en {same.map((o, i) => <span key={o.k}>{i ? ' y ' : ''}«{lab(o.k)}»</span>)}.</>}
        </p>
      </div>

      <div className="vs-grid">
        <div className="card">
          <div className="wi-table-head">
            <div className="h3" style={{ margin: 0 }}>Rasgo por rasgo</div>
            <div className="seg" style={{ margin: 0 }}>
              <button aria-pressed={!all} onClick={() => setAll(false)}>Mayores diferencias</button>
              <button aria-pressed={all} onClick={() => setAll(true)}>Todos ({rows.length})</button>
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="vs-db" role="img" aria-label={`Efecto propio de ${nA} y ${nB} por indicador`}>
            <line x1={X(0)} x2={X(0)} y1={18} y2={H - 4} stroke="var(--ink-3)" strokeDasharray="3 3" />
            <text x={X(-M) + 2} y={12} fontSize={11} fill="var(--ink-3)">← menos que la liga</text>
            <text x={X(M) - 2} y={12} fontSize={11} fill="var(--ink-3)" textAnchor="end">más que la liga →</text>
            {shown.map((o, i) => {
              const y = 34 + i * rowH
              return (
                <g key={o.k}>
                  <rect x={0} y={y - rowH / 2} width={W} height={rowH} fill={i % 2 ? 'transparent' : 'color-mix(in oklab, var(--ink) 4%, transparent)'} />
                  <text x={L - 12} y={y + 4} fontSize={13} textAnchor="end" fill="var(--ink)">{lab(o.k).length > 34 ? lab(o.k).slice(0, 33) + '…' : lab(o.k)}</text>
                  <line x1={X(o.a)} x2={X(o.b)} y1={y} y2={y} stroke="var(--ink-3)" strokeWidth={2} opacity={0.6} />
                  <circle cx={X(o.b)} cy={y} r={6.5} fill={cb} stroke="var(--surface)" strokeWidth={1.5}><title>{nB}: {sgn(o.b)}</title></circle>
                  <circle cx={X(o.a)} cy={y} r={6.5} fill={ca} stroke="var(--surface)" strokeWidth={1.5}><title>{nA}: {sgn(o.a)}</title></circle>
                </g>
              )
            })}
          </svg>
          <div className="vs-legend">
            <span><i style={{ background: ca }} />{nA}</span><span><i style={{ background: cb }} />{nB}</span>
            <span className="note">Efecto propio del DT (α) en desviaciones típicas entre DTs; 0 = promedio de la liga.</span>
          </div>
        </div>

        <div className="vs-col">
          <div className="card">
            <div className="h3" style={{ marginTop: 0 }}>En el mapa de estilos</div>
            <svg viewBox="0 0 320 200" className="vs-map" role="img" aria-label="Posición de ambos DTs en el mapa de estilos">
              {mapa.puntos.map((p: Any) => <circle key={p.id} cx={MX(p.x)} cy={MY(p.y)} r={2.6} fill="var(--ink-3)" opacity={0.35} />)}
              <line x1={MX(A.x)} y1={MY(A.y)} x2={MX(B.x)} y2={MY(B.y)} stroke="var(--ink-2)" strokeDasharray="4 3" />
              {[[B, cb], [A, ca]].map(([p, c]: Any) => (
                <g key={p.id}>
                  <circle cx={MX(p.x)} cy={MY(p.y)} r={8} fill={c} stroke="var(--surface)" strokeWidth={2} />
                  <text x={MX(p.x)} y={MY(p.y) - 12} fontSize={11.5} fontWeight={700} textAnchor="middle" fill="var(--ink)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">{shortName(p.nombre).split(' ').at(-1)}</text>
                </g>
              ))}
            </svg>
            <p className="note" style={{ margin: '6px 0 0' }}>Cerca = ideas de juego parecidas. Mismo mapa que la portada.</p>
          </div>
          <div className="card">
            <table className="t vs-facts">
              <thead><tr><th></th><th style={{ color: ca === '#f2f2f2' ? undefined : ca }}>{nA.split(' ').at(-1)}</th><th style={{ color: cb === '#f2f2f2' ? undefined : cb }}>{nB.split(' ').at(-1)}</th></tr></thead>
              <tbody>
                {factRows.map(([l, f]) => <tr key={l}><td>{l}</td><td className="num">{fa ? f(fa) : '—'}</td><td className="num">{fb ? f(fb) : other === false ? '—' : '…'}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
