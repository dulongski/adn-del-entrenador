import { useEffect, useMemo, useState } from 'react'
import { ClubName, CoachPhoto } from './charts'
import CoachPicker from './compare/CoachPicker'
import StyleMini from './compare/StyleMini'
import TraitBars, { DistGrid, type Row } from './compare/TraitBars'
import { apellido, famHue, signed } from './compare/util'
import { useDistData } from './Dist'
import { clubColor, dataUrl, fmt, getJSON, nombreDT, shortName, type Any } from './lib'
import './styles/compare.css'

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

const verdict = (r: number) => r >= 0.6 ? 'muy parecidos' : r >= 0.3 ? 'parecidos' : r >= 0.15 ? 'algo parecidos' : r > -0.3 ? 'distintos' : r > -0.6 ? 'bastante opuestos' : 'opuestos'
const hexRgb = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
const dist3 = (a: string, b: string) => { const x = hexRgb(a), y = hexRgb(b); return x && y ? Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) : 999 }
const ALT = ['#3987e5', '#e5484d', '#F5A623', '#2FB24A', '#9b6bd6']
const fmtForm = (f?: string) => (f ? f.split('').join('-') : '—')

type Fact = { label: string; get: (f: Any) => number | string | null; show: (v: Any, f: Any) => string; better?: 'hi' | 'lo'; hint?: string }

export default function Compare({ art, glob, media, mapa, onOpen }: { art: Any; glob: Any; media: Any; mapa: Any; onOpen: (id: number) => void }) {
  const sims = useMemo(() => similares(art.id, mapa), [art.id, mapa])
  const pts = useMemo(() => new Map<number, Any>(mapa.puntos.map((p: Any) => [p.id, p])), [mapa])
  const [rid, setRid] = useState<number | null>(sims[0]?.id ?? null)
  const [other, setOther] = useState<Any>(null)
  const [all, setAll] = useState(false)
  const dd = useDistData()
  useEffect(() => { setOther(null); if (rid !== null) getJSON(dataUrl(`dt_${rid}.json`)).then(setOther).catch(() => setOther(false)) }, [rid])

  const A = pts.get(art.id), B = rid !== null ? pts.get(rid) : null
  if (!A) return <p className="note">Este DT no aparece en el mapa de estilos, así que no se puede comparar.</p>
  if (!B) return <p className="note">Elige con quién compararlo.</p>

  const clubA = media.dts[art.id]?.club ?? art.etapas.at(-1)?.club, clubB = media.dts[B.id]?.club ?? B.clubes.at(-1)
  let ca = clubColor(clubA, media), cb = clubColor(clubB, media)
  if (ca.startsWith('var')) ca = '#3987e5'
  if (cb.startsWith('var') || dist3(ca, cb) < 120) cb = ALT.find(c => dist3(ca, c) >= 120)!
  const r = sims.find(s => s.id === B.id)?.r ?? 0
  const pos = sims.findIndex(s => s.id === B.id) + 1
  const nA = shortName(A.nombre), nB = shortName(B.nombre)
  const grupo = (p: Any) => mapa.grupos.find((g: Any) => g.id === p.grupo)?.nombre ?? '—'
  const SA = { id: A.id, name: nA, color: ca }, SB = { id: B.id, name: nB, color: cb }
  const pick = (id: number) => { if (id !== A.id) setRid(id) }

  const rows = (mapa.kpis as string[]).map(k => ({ k, a: A.alpha[k] ?? 0, b: B.alpha[k] ?? 0 }))
    .map(o => ({ ...o, d: o.a - o.b })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
  const shown = all ? rows : rows.slice(0, 10)
  const lab = (k: string) => glob.kpis[k]?.etiqueta ?? k
  const low = (k: string) => { const t = lab(k).replace(/\s*\(.*\)$/, ''); return /^[A-ZÁÉÍÓÚ][a-záéíóúñ]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t }
  const top = rows.slice(0, 3)
  const same = rows.filter(o => Math.abs(o.d) < 0.15 && Math.abs(o.a) > 0.4 && Math.sign(o.a) === Math.sign(o.b)).slice(0, 2)
  const quien = (o: Row) => `más ${apellido(o.d > 0 ? nA : nB)}${Math.abs(o.d) > 1.2 ? ', y por mucho' : ''}`

  // ------------------------------------------------ ficha
  const facts = (d: Any, p: Any) => {
    if (!d) return null
    const tr = (d.transferencia ?? []) as Any[]
    const best = tr.length ? tr.reduce((a, b) => (a.rank_ajustado <= b.rank_ajustado ? a : b)) : null
    const f = Object.entries(d.jugadores?.formaciones ?? {}).sort((a: Any, b: Any) => b[1] - a[1])[0]
    const np = d.simulacion?.partidos?.length || d.partidos_total
    return {
      partidos: d.partidos_total, clubes: d.etapas.length, ident: d.identificabilidad?.indice, familia: grupo(p), form: fmtForm(f?.[0]),
      ppp: d.simulacion ? d.simulacion.puntos / np : null, xppp: d.simulacion ? d.simulacion.xpts / np : null,
      transfer: best ? best.rank_ajustado : null, transferN: best?.n_clases, corners: d.balon_parado?.ofensivo?.corners_por_partido,
    }
  }
  const fa = facts(art, A), fb = other ? facts(other, B) : null
  const factRows: Fact[] = [
    { label: 'Familia de estilo', get: f => f.familia, show: v => v },
    { label: 'Partidos analizados', get: f => f.partidos, show: v => fmt(v, 0), better: 'hi', hint: 'más experiencia en la muestra' },
    { label: 'Clubes dirigidos', get: f => f.clubes, show: v => String(v) },
    { label: 'Formación más usada', get: f => f.form, show: v => v },
    { label: 'Puntos por partido', get: f => f.ppp, show: v => fmt(v, 2), better: 'hi' },
    { label: 'Puntos esperados por partido', get: f => f.xppp, show: v => fmt(v, 2), better: 'hi', hint: 'según la calidad de las ocasiones (xPts)' },
    { label: 'Qué tan reconocible es su estilo', get: f => f.ident, show: v => `${fmt(v, 0)}/100`, better: 'hi' },
    { label: 'Estilo que viaja de club a club', get: f => f.transfer, show: (v, f) => `${v}º de ${f.transferN}`, better: 'lo', hint: 'puesto en la prueba de transferencia: 1º = su estilo se reconoce mejor al cambiar de club' },
    { label: 'Córners a favor por partido', get: f => f.corners, show: v => fmt(v, 1) },
  ]
  const cell = (f: Any, row: Fact) => { const v = f ? row.get(f) : null; return v == null || v === '' ? '—' : row.show(v, f) }
  const winner = (row: Fact) => {
    if (!row.better || !fa || !fb) return null
    const a = row.get(fa), b = row.get(fb)
    if (typeof a !== 'number' || typeof b !== 'number' || Math.abs(a - b) < 1e-9) return null
    return (row.better === 'hi' ? a > b : a < b) ? 'a' : 'b'
  }

  const side = (p: Any, col: string, club: string, align: 'l' | 'r') => {
    const nm = nombreDT(p.id, p.nombre)
    return (
      <div className={`vs-side vs-${align}`} style={{ ['--vc' as string]: col }}>
        <CoachPhoto name={p.nombre} src={media.dts[p.id]?.foto} size={104} />
        <div className="vs-id">
          <div className="vs-name">{nm ? <><span className="light">{nm.nombres}</span> {nm.apellidos}</> : p.nombre}</div>
          {club && <ClubName club={club} media={media} size={18} />}
          <div className="vs-fam"><i style={{ background: famHue(p.grupo) }} />{grupo(p)} · {fmt(p.partidos, 0)} partidos</div>
          {p.partidos < 10 && <span className="vs-pre" title="Con menos de 10 partidos el modelo acerca su estilo al promedio">Perfil preliminar: pocos partidos</span>}
          {p.id !== art.id && <button className="vs-open" onClick={() => onOpen(p.id)}>Abrir su perfil →</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="vs">
      <CoachPicker sims={sims} pts={pts} mapa={mapa} media={media} selected={B.id} onPick={pick} nA={nA} />

      <div className="vs-face">
        {side(A, ca, clubA, 'l')}
        <div className="vs-mid">
          <span className="vs-badge">VS</span>
          <b className="vs-rval">{signed(r)}</b>
          <span className="vs-verd">{verdict(r)}</span>
          <span className="vs-meter" aria-hidden><i style={{ left: `${(r + 1) * 50}%` }} /></span>
          <span className="vs-scale"><span>opuestos</span><span>iguales</span></span>
        </div>
        {side(B, cb, clubB, 'r')}
      </div>

      <div className="card vs-sum">
        <p>
          Quitando lo que aportan sus jugadores, {nA} y {nB} tienen estilos <b>{verdict(r)}</b>: {nB} es el {pos}º más parecido a {nA} de {sims.length} DTs.
          {' '}Donde más se separan: {top.map((o, i) => (
            <span key={o.k}>{i ? (i === top.length - 1 ? ' y ' : ', ') : ''}<b>{low(o.k)}</b> ({quien(o)})</span>
          ))}.
          {same.length > 0 && <> Se parecen en {same.map((o, i) => <span key={o.k}>{i ? ' y ' : ''}{low(o.k)}</span>)}.</>}
        </p>
      </div>

      <div className="card">
        <div className="vs-head">
          <div>
            <div className="h3" style={{ margin: 0 }}>Rasgo por rasgo</div>
            <p className="note" style={{ margin: '2px 0 0' }}>Haz clic en un rasgo para ver dónde quedan entre todos los DTs.</p>
          </div>
          <div className="seg" style={{ margin: 0 }}>
            <button aria-pressed={!all} onClick={() => setAll(false)}>Mayores diferencias</button>
            <button aria-pressed={all} onClick={() => setAll(true)}>Todos ({rows.length})</button>
          </div>
        </div>
        <TraitBars rows={shown} lab={lab} A={SA} B={SB} dd={dd} />
        <p className="note vs-scale-note">
          Cómo leerlo: 0 es el DT promedio de la liga. +1 quiere decir que ese DT empuja el rasgo bastante más que lo normal; +2, muchísimo más; los negativos, lo contrario.
          Las cifras están en desviaciones respecto al DT promedio y ya descuentan lo que aportan sus jugadores, el club y los rivales.
        </p>
      </div>

      <DistGrid rows={rows} lab={lab} A={SA} B={SB} dd={dd} />

      <div className="vs-col">
        <div className="card">
          <div className="h3" style={{ marginTop: 0 }}>En el mapa de estilos</div>
          <StyleMini mapa={mapa} media={media} A={A} B={B} ca={ca} cb={cb} onPick={pick} />
          <p className="note" style={{ margin: '6px 0 0' }}>Cerca = ideas de juego parecidas. Pasa el cursor por cualquier punto para ver qué DT es y haz clic para compararlo.</p>
        </div>
        <div className="card">
          <div className="h3" style={{ marginTop: 0 }}>Ficha</div>
          <table className="t vs-facts">
            <colgroup><col style={{ width: '42%' }} /><col /><col /></colgroup>
            <thead><tr><th></th>
              <th className="num"><i style={{ background: ca }} />{apellido(nA)}</th>
              <th className="num"><i style={{ background: cb }} />{apellido(nB)}</th></tr></thead>
            <tbody>
              {factRows.map(row => {
                const w = winner(row)
                return (
                  <tr key={row.label}>
                    <td title={row.hint}>{row.label}{row.hint && <span className="vs-hint"> ⓘ</span>}</td>
                    <td className={`num${typeof (fa && row.get(fa)) === 'string' ? ' vs-txt' : ''}${w === 'a' ? ' win' : ''}`} style={{ ['--vc' as string]: ca }}>{cell(fa, row)}</td>
                    <td className={`num${typeof (fa && row.get(fa)) === 'string' ? ' vs-txt' : ''}${w === 'b' ? ' win' : ''}`} style={{ ['--vc' as string]: cb }}>{fb ? cell(fb, row) : other === false ? '—' : '…'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="note" style={{ margin: '8px 0 0' }}>Resaltado = mejor de los dos en ese dato.</p>
        </div>
      </div>
    </div>
  )
}
