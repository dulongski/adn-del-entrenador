import { chatBus } from './chatBus'
import { useEffect, useMemo, useState } from 'react'
import { ClubName, CoachPhoto } from './charts'
import CoachPicker from './compare/CoachPicker'
import StyleMini from './compare/StyleMini'
import TraitBars, { DistGrid, type Row } from './compare/TraitBars'
import { apellido, famHue, ordinal, signed } from './compare/util'
import { useDistData } from './Dist'
import { clubColor, dataUrl, fmt, getJSON, nombreDT, shortName, type Any } from './lib'
import { L } from './settings'
import Info from './Info'
import { kpiLabel, mapLabel } from './i18n/data'
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

const verdict = (r: number) => r >= 0.6 ? L('muy parecidos', 'very similar') : r >= 0.3 ? L('parecidos', 'similar') : r >= 0.15 ? L('algo parecidos', 'somewhat similar') : r > -0.3 ? L('distintos', 'different') : r > -0.6 ? L('bastante opuestos', 'fairly opposite') : L('opuestos', 'opposite')
const hexRgb = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
const dist3 = (a: string, b: string) => { const x = hexRgb(a), y = hexRgb(b); return x && y ? Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) : 999 }
const ALT = ['#3987e5', '#e5484d', '#F5A623', '#2FB24A', '#9b6bd6']
const cap = (t: string) => t[0].toUpperCase() + t.slice(1)
const fmtForm = (f?: string) => (f ? f.split('').join('-') : '—')

type Fact = { label: string; get: (f: Any) => number | string | null; show: (v: Any, f: Any) => string; better?: 'hi' | 'lo'; hint?: string }

export default function Compare({ art, glob, media, mapa, onOpen }: { art: Any; glob: Any; media: Any; mapa: Any; onOpen: (id: number) => void }) {
  const sims = useMemo(() => similares(art.id, mapa), [art.id, mapa])
  const pts = useMemo(() => new Map<number, Any>(mapa.puntos.map((p: Any) => [p.id, p])), [mapa])
  const [rid, setRid] = useState<number | null>(() => { const r = chatBus.vsRival; chatBus.vsRival = null; return r ?? sims[0]?.id ?? null })
  const [other, setOther] = useState<Any>(null)
  // el chat de IA puede pedir «Cara a cara» contra un DT concreto con esta vista ya abierta
  useEffect(() => {
    const f = () => setTimeout(() => { if (chatBus.vsRival != null) { setRid(chatBus.vsRival); chatBus.vsRival = null } }, 0)
    window.addEventListener('coachdna:go', f)
    return () => window.removeEventListener('coachdna:go', f)
  }, [])
  const [orden, setOrden] = useState<'sep' | 'par'>('sep')   // mayor brecha primero | menor brecha (más parecidos) primero
  const dd = useDistData()
  useEffect(() => { setOther(null); if (rid !== null) getJSON(dataUrl(`dt_${rid}.json`)).then(setOther).catch(() => setOther(false)) }, [rid])

  const A = pts.get(art.id), B = rid !== null ? pts.get(rid) : null
  if (!A) return <p className="note">{L('Este DT no aparece en el mapa de estilos, así que no se puede comparar.', 'This coach isn’t on the style map, so he can’t be compared.')}</p>
  if (!B) return <p className="note">{L('Elige con quién compararlo.', 'Pick someone to compare him with.')}</p>

  const clubA = media.dts[art.id]?.club ?? art.etapas.at(-1)?.club, clubB = media.dts[B.id]?.club ?? B.clubes.at(-1)
  let ca = clubColor(clubA, media), cb = clubColor(clubB, media)
  if (ca.startsWith('var')) ca = '#3987e5'
  if (cb.startsWith('var') || dist3(ca, cb) < 120) cb = ALT.find(c => dist3(ca, c) >= 120)!
  const r = sims.find(s => s.id === B.id)?.r ?? 0
  const pos = sims.findIndex(s => s.id === B.id) + 1
  const nA = shortName(A.nombre), nB = shortName(B.nombre)
  const grupo = (p: Any) => mapLabel(mapa.grupos.find((g: Any) => g.id === p.grupo)?.nombre ?? '—')
  const SA = { id: A.id, name: nA, color: ca }, SB = { id: B.id, name: nB, color: cb }
  const pick = (id: number) => { if (id !== A.id) setRid(id) }

  const rows = (mapa.kpis as string[]).map(k => ({ k, a: A.alpha[k] ?? 0, b: B.alpha[k] ?? 0 }))
    .map(o => ({ ...o, d: o.a - o.b })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
  const shown = orden === 'sep' ? rows : [...rows].reverse()
  const lab = (k: string) => kpiLabel(k, glob.kpis[k]?.etiqueta ?? k)
  const low = (k: string) => { const t = lab(k).replace(/\s*\(.*\)$/, ''); return /^[A-ZÁÉÍÓÚ][a-záéíóúñ]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t }
  const top = rows.slice(0, 3)
  const same = rows.filter(o => Math.abs(o.d) < 0.15 && Math.abs(o.a) > 0.4 && Math.sign(o.a) === Math.sign(o.b)).slice(0, 2)
  const quien = (o: Row) => L(`más ${apellido(o.d > 0 ? nA : nB)}${Math.abs(o.d) > 1.2 ? ', y por mucho' : ''}`, `${apellido(o.d > 0 ? nA : nB)} higher${Math.abs(o.d) > 1.2 ? ', by a mile' : ''}`)

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
    { label: L('Familia de estilo', 'Style family'), get: f => f.familia, show: v => v },
    { label: L('Partidos analizados', 'Matches analysed'), get: f => f.partidos, show: v => fmt(v, 0), better: 'hi', hint: L('más experiencia en la muestra', 'more experience in the sample') },
    { label: L('Clubes dirigidos', 'Clubs coached'), get: f => f.clubes, show: v => String(v) },
    { label: L('Formación más usada', 'Most-used formation'), get: f => f.form, show: v => v },
    { label: L('Puntos por partido', 'Points per match'), get: f => f.ppp, show: v => fmt(v, 2), better: 'hi' },
    { label: L('Puntos esperados por partido', 'Expected points per match'), get: f => f.xppp, show: v => fmt(v, 2), better: 'hi', hint: L('según la calidad de las ocasiones (xPts)', 'based on chance quality (xPts)') },
    { label: L('Qué tan reconocible es su estilo', 'How recognisable his style is'), get: f => f.ident, show: v => `${fmt(v, 0)}/100`, better: 'hi' },
    { label: L('Estilo que viaja de club a club', 'Style that travels between clubs'), get: f => f.transfer, show: (v, f) => L(`${v}º de ${f.transferN}`, `${ordinal(v)} of ${f.transferN}`), better: 'lo', hint: L('puesto en la prueba de transferencia: 1º = su estilo se reconoce mejor al cambiar de club', 'rank in the transfer test: 1st = his style is easiest to spot after changing clubs') },
    { label: L('Córners a favor por partido', 'Corners won per match'), get: f => f.corners, show: v => fmt(v, 1) },
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
          <div className="vs-fam"><i style={{ background: famHue(p.grupo) }} />{grupo(p)} · {fmt(p.partidos, 0)} {L('partidos', 'matches')}</div>
          {p.partidos < 10 && <span className="vs-pre" title={L('Con menos de 10 partidos el modelo acerca su estilo al promedio', 'With fewer than 10 matches the model pulls his style toward the average')}>{L('Perfil preliminar: pocos partidos', 'Early profile: few matches')}</span>}
          {p.id !== art.id && <button className="vs-open" onClick={() => onOpen(p.id)}>{L('Abrir su perfil →', 'Open his profile →')}</button>}
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
          <span className="vs-scale"><span>{L('opuestos', 'opposite')}</span><span>{L('iguales', 'identical')}</span></span>
        </div>
        {side(B, cb, clubB, 'r')}
      </div>

      <div className="card vs-sum">
        <div className="vs-sum-line">
          <b>{cap(verdict(r))}</b>{L(`: ${apellido(nB)} es el ${pos}º más parecido a ${apellido(nA)} de ${sims.length} DTs.`, `: ${apellido(nB)} is the ${pos === 1 ? '' : `${ordinal(pos)} `}closest match to ${apellido(nA)} out of ${sims.length} coaches.`)}
          <Info wide label={L('Detalle de la comparación', 'Comparison details')}>
            <p>{L(`Quitando lo que aportan sus jugadores, ${nA} y ${nB} tienen estilos `, `Stripping out what their players bring, ${nA} and ${nB} have `)}<b>{verdict(r)}</b>{L(`: ${nB} es el ${pos}º más parecido a ${nA} de ${sims.length} DTs.`, ` styles: ${nB} is the ${pos === 1 ? '' : `${ordinal(pos)} `}closest match to ${nA} out of ${sims.length} coaches.`)}</p>
            <p>{L('Donde más se separan: ', 'Where they differ most: ')}{top.map((o, i) => (
              <span key={o.k}>{i ? (i === top.length - 1 ? L(' y ', ' and ') : ', ') : ''}<b>{low(o.k)}</b> ({quien(o)})</span>
            ))}.
            {same.length > 0 && <> {L('Se parecen en', 'They’re alike in')} {same.map((o, i) => <span key={o.k}>{i ? L(' y ', ' and ') : ''}{low(o.k)}</span>)}.</>}</p>
          </Info>
        </div>
      </div>

      <div className="card">
        <div className="vs-head">
          <div className="h3" style={{ margin: 0 }}>{L('Rasgo por rasgo', 'Trait by trait')}
            <Info wide>
              <p>{L('Todos los rasgos, ordenados por la brecha entre sus estilos propios. Toca el encabezado «Brecha» para cambiar el orden: más distintos primero o más parecidos primero. Haz clic en un rasgo para ver dónde quedan entre todos los DTs.', 'All traits, ordered by the gap between their own styles. Tap the “Gap” header to switch the order: most different first or most alike first. Click a trait to see where they sit among all coaches.')}</p>
              <p>{L('Cómo leerlo: 0 es el DT promedio de la liga; +1 es que empuja el rasgo bastante más que lo normal, +2 muchísimo más, y los negativos lo contrario. Ya se descontó lo que aportan sus jugadores, el club y los rivales.', 'How to read it: 0 is the league’s average coach; +1 means he pushes the trait well above normal, +2 far above, and negatives the opposite. What his players, the club and opponents bring has been removed.')}</p>
            </Info>
          </div>
        </div>
        <TraitBars rows={shown} lab={lab} A={SA} B={SB} dd={dd} gapDir={orden === 'sep' ? 'desc' : 'asc'} onGap={() => setOrden(o => (o === 'sep' ? 'par' : 'sep'))} />
      </div>

      <DistGrid rows={rows} lab={lab} A={SA} B={SB} dd={dd} />

      <div className="vs-col">
        <div className="card">
          <div className="h3" style={{ marginTop: 0 }}>{L('En el mapa de estilos', 'On the style map')}<Info>{L('Cerca = ideas de juego parecidas. Pasa el cursor por cualquier punto para ver qué DT es y haz clic para compararlo.', 'Close together = similar ideas about the game. Hover any dot to see which coach it is and click to compare.')}</Info></div>
          <StyleMini mapa={mapa} media={media} A={A} B={B} ca={ca} cb={cb} onPick={pick} />
        </div>
        <div className="card">
          <div className="h3" style={{ marginTop: 0 }}>{L('Ficha', 'Fact sheet')}<Info>{L('Resaltado = mejor de los dos en ese dato.', 'Highlighted = the better of the two on that stat.')}</Info></div>
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
                    <td>{row.label}{row.hint && <Info>{row.hint}</Info>}</td>
                    <td className={`num${typeof (fa && row.get(fa)) === 'string' ? ' vs-txt' : ''}${w === 'a' ? ' win' : ''}`} style={{ ['--vc' as string]: ca }}>{cell(fa, row)}</td>
                    <td className={`num${typeof (fa && row.get(fa)) === 'string' ? ' vs-txt' : ''}${w === 'b' ? ' win' : ''}`} style={{ ['--vc' as string]: cb }}>{fb ? cell(fb, row) : other === false ? '—' : '…'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
