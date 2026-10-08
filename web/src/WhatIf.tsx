import { useEffect, useMemo, useState } from 'react'
import { ClubLogo, ClubName, Pitch, PosTag } from './charts'
import { type Any, dataUrl, fmt, getJSON, jugadorCorto, posTag, shortName } from './lib'
import './whatif.css'

/* ------------------------------------------------------------ modelo (misma convención que pipeline/whatif.py)
 * z_k = base_k + α_DT,k + φ_club,k + Σ_{j en el XI} β_j,k ; valor = media_k + z_k·sd_k */

const KEY = ['posesion', 'pase_largo', 'verticalidad', 'progresivos', 'ppda', 'altura_presion', 'presion_alta',
  'linea_360', 'contraataque', 'centros', 'xg_90', 'xg_contra_90']

// cómo se lee un aumento/disminución de cada KPI clave en una frase
const PHRASE: Record<string, [string, string]> = {
  posesion: ['tendría más posesión', 'tendría menos posesión'],
  pase_largo: ['jugaría más en largo', 'jugaría menos en largo'],
  verticalidad: ['sería más vertical', 'sería menos vertical'],
  progresivos: ['progresaría más con el balón', 'progresaría menos con el balón'],
  ppda: ['presionaría con menos intensidad', 'presionaría con más intensidad'],
  altura_presion: ['presionaría más arriba', 'presionaría más abajo'],
  presion_alta: ['presionaría más en campo rival', 'presionaría menos en campo rival'],
  linea_360: ['adelantaría su línea defensiva', 'retrasaría su línea defensiva'],
  contraataque: ['correría más al contragolpe', 'correría menos al contragolpe'],
  centros: ['centraría más', 'centraría menos'],
  xg_90: ['generaría más ocasiones', 'generaría menos ocasiones'],
  xg_contra_90: ['concedería más ocasiones', 'concedería menos ocasiones'],
}

const apellido = (n: string) => { const t = n.trim().split(/\s+/); let i = t.length - 1; while (i > 1 && /^(de|del|la|las|los|da|do|dos|van|von|di)$/i.test(t[i - 1])) i--; return t.length > 1 ? t.slice(i).join(' ') : n }
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function unitOf(etiqueta: string) {
  if (etiqueta.includes('%')) return 'pts'
  if (etiqueta.includes('(x)') || etiqueta.includes('yd')) return 'yd'
  if (etiqueta.startsWith('xG')) return 'xG'
  if (etiqueta.includes('(s)')) return 's'
  return ''
}
const signed = (x: number, d = 1) => `${x >= 0 ? '+' : '−'}${fmt(Math.abs(x), d)}`

/** Probabilidades de un partido con goles Poisson independientes. */
function poisson(lf: number, la: number) {
  const pmf = (l: number) => { const p = [Math.exp(-l)]; for (let k = 1; k <= 10; k++) p.push(p[k - 1] * l / k); return p }
  const a = pmf(Math.max(lf, 0.05)), b = pmf(Math.max(la, 0.05))
  let w = 0, d = 0
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) { if (i > j) w += a[i] * b[j]; else if (i === j) d += a[i] * b[j] }
  const l = Math.max(0, 1 - w - d)
  return { w, d, l, xpts: 3 * w + d }
}


/* ------------------------------------------------------------ formación a partir de las posiciones del XI
 * Cada posición cae en una línea (0 POR … 5 DEL) y un carril (−3 banda izq. … +3 banda der.).
 * La formación se recalcula con quien esté en la cancha. */
const SIDE = (pos: string) => (/izq\./.test(pos) ? -1 : /der\./.test(pos) ? 1 : 0)
function slotOf(pos: string | undefined, hayMediapunta: boolean): { line: number; lat: number } {
  const p = pos ?? '', s = SIDE(p)
  if (p === 'Portero') return { line: 0, lat: 0 }
  if (p.startsWith('Lateral')) return { line: 1, lat: 3 * s }
  if (p.startsWith('Central')) return { line: 1, lat: s }
  if (p.startsWith('Carrilero')) return { line: 2, lat: 3 * s }
  if (p.startsWith('Pivote')) return { line: 2, lat: s }
  if (p.startsWith('Volante')) return { line: 3, lat: 3 * s }
  if (p.startsWith('Interior') || p === 'Mediocentro') return { line: 3, lat: 1.2 * s }
  if (p.startsWith('Mediapunta')) return { line: 4, lat: 1.5 * s }
  if (p.startsWith('Extremo')) return { line: hayMediapunta ? 4 : 5, lat: 3 * s }
  if (p.startsWith('Delantero') || p === 'Segundo delantero') return { line: 5, lat: s }
  return { line: 3, lat: 0 }
}
const LINE_Y = [6, 22, 38, 52, 68, 83]   // % de la cancha desde la portería propia

function formationLayout(ids: number[], posOf: (id: number) => string | undefined) {
  const hayMP = ids.some(id => (posOf(id) ?? '').startsWith('Mediapunta'))
  const byLine = new Map<number, { id: number; lat: number }[]>()
  ids.forEach(id => { const { line, lat } = slotOf(posOf(id), hayMP); if (!byLine.has(line)) byLine.set(line, []); byLine.get(line)!.push({ id, lat }) })
  const out: { id: number; x: number; y: number }[] = []
  byLine.forEach((ps, line) => {
    // los de banda (|carril| = 3) se quedan abiertos si hay alguien por dentro o si hay bandas de los dos lados;
    // el resto se reparte simétrico alrededor del centro, sea cual sea el número de jugadores
    const wide = ps.filter(p => Math.abs(p.lat) >= 3)
    const inner = ps.filter(p => Math.abs(p.lat) < 3)
    const bothSides = wide.some(p => p.lat < 0) && wide.some(p => p.lat > 0)
    const keepWide = inner.length > 0 || bothSides
    const center = keepWide ? inner : ps
    center.sort((a, b) => a.lat - b.lat)
    const m = center.length
    const avail = keepWide && wide.length ? 50 : 72
    const gap = m > 1 ? Math.min(22, avail / (m - 1)) : 0
    center.forEach((p, i) => out.push({ id: p.id, x: 50 + (i - (m - 1) / 2) * gap, y: LINE_Y[line] }))
    if (keepWide) {
      ;[-1, 1].forEach(side => {
        const w = wide.filter(p => Math.sign(p.lat) === side)
        // dos del mismo costado: uno pegado a la banda y otro un poco más adentro
        w.forEach((p, i) => out.push({ id: p.id, x: 50 + side * (39 - i * 14), y: LINE_Y[line] }))
      })
    }
  })
  const n = [1, 2, 3, 4, 5].map(l => byLine.get(l)?.length ?? 0)
  // pivotes + interiores se leen como una sola línea de medios (4-3-3, 3-5-2, 4-3-1-2) salvo el 4-1-4-1
  const merge = n[1] && n[2] && (!n[3] || n[1] <= 1 || n[2] <= 1) && !(n[1] === 1 && n[2] >= 4)
  const lines = merge ? [n[0], n[1] + n[2], n[3], n[4]] : n
  return { pts: out, formacion: lines.filter(Boolean).join('-'), porteros: byLine.get(0)?.length ?? 0 }
}

/** Un torneo de Liga MX (Apertura o Clausura) son 17 jornadas. */
const TORNEO = 17

type Scenario = { key: string; title: string; sub: string; z: number[]; raw: number[] }

export default function WhatIf({ art, glob, media }: { art: Any; glob: Any; media: Any }) {
  const [data, setData] = useState<Any>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { getJSON(dataUrl('whatif.json')).then(setData, e => setErr(String(e.message || e))) }, [])

  if (err) return <div className="card note">No se pudo cargar el modelo: {err}</div>
  if (!data) return <p className="note">Cargando modelo…</p>
  return <WhatIfBody key={art.id} art={art} glob={glob} media={media} data={data} />
}

function WhatIfBody({ art, glob, media, data }: { art: Any; glob: Any; media: Any; data: Any }) {
  const kpis: Any[] = data.kpis
  const kidx = useMemo(() => Object.fromEntries(kpis.map((k, i) => [k.k, i])) as Record<string, number>, [kpis])
  const clubs = useMemo(() => Object.keys(data.clubs).sort((a, b) => a.localeCompare(b, 'es')), [data])
  const latest = useMemo(() => Object.values(data.squads).map((s: Any) => s.temporada).sort().at(-1), [data])
  const dtInfo = useMemo(() => new Map<number, Any>(glob.dts.map((d: Any) => [d.id, d])), [glob])
  const coachName = (id: number) => dtInfo.get(id)?.nombre ?? data.coach_nombres[id] ?? String(id)
  const coachIds = useMemo(() => Object.keys(data.coaches).map(Number).sort((a, b) => coachName(a).localeCompare(coachName(b), 'es')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, dtInfo])

  // por defecto, su club actual (media.dts); si no está en el modelo, el de su etapa más reciente
  const defaultClub = useMemo(() => {
    const ok = (c?: string) => !!c && !!data.squads[c] && clubs.includes(c)
    const actual = media?.dts?.[art.id]?.club as string | undefined
    if (ok(actual)) return actual!
    const et = [...(art.etapas ?? [])].reverse().map((e: Any) => e.club as string).find(ok)
    return et ?? clubs.find(c => data.squads[c]?.temporada === latest) ?? clubs[0]
  }, [art, media, data, clubs, latest])

  const [coach, setCoach] = useState<number>(data.coaches[art.id] ? art.id : coachIds[0])
  const [club, setClubState] = useState<string>(defaultClub)
  const [xi, setXi] = useState<number[]>(() => [...data.squads[defaultClub].xi])
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [fPos, setFPos] = useState('todas')
  const [fClub, setFClub] = useState('todos')
  const [fMin, setFMin] = useState(450)
  const [orden, setOrden] = useState<'min' | 'xg' | 'nombre'>('min')
  const [nRes, setNRes] = useState(12)
  const [sel, setSel] = useState<number | null>(null)

  const setClub = (c: string) => { setClubState(c); setXi([...data.squads[c].xi]); setSel(null) }
  const P = (id: number) => data.players[id]
  const n = kpis.length

  const add = (a: number[], b: number[] | null | undefined, s = 1) => { if (b) for (let i = 0; i < n; i++) a[i] += s * b[i]; return a }
  const xiBeta = (ids: number[]) => ids.reduce((acc, p) => add(acc, P(p)?.b ?? data.otros), new Array(n).fill(0))
  const toRaw = (z: number[]) => z.map((v, i) => kpis[i].mean + v * kpis[i].sd)
  const predict = (coachId: number, clubName: string, plantilla: number[]) => {
    const z = [...data.base]
    add(z, data.coaches[coachId]); add(z, data.clubs[clubName]?.phi); add(z, plantilla)
    return z
  }

  const coachedBy = new Set<string>((dtInfo.get(coach)?.clubes ?? []).map((e: Any) => e.club))
  const sq = data.squads[club]
  const hoyCoach: number = sq.dt
  const hoyZ = predict(hoyCoach, club, xiBeta(sq.xi))

  // "DT en su último club": su última etapa real con la plantilla que tuvo allí (si no, la plantilla actual de ese club)
  const ult = data.ultima_etapa[coach]
  const dtLast = dtInfo.get(coach)?.clubes?.at(-1)?.club as string | undefined
  const lastClub: string | undefined = ult?.club ?? (dtLast && data.squads[dtLast] ? dtLast : undefined)
  const lastZ = lastClub ? predict(coach, lastClub, ult?.plantilla ?? xiBeta(data.squads[lastClub].xi)) : null

  const simZ = predict(coach, club, xiBeta(xi))
  const dtShort = shortName(coachName(coach))
  const scen: Scenario[] = [
    { key: 'hoy', title: `${club} hoy`, sub: `${shortName(coachName(hoyCoach))} · XI habitual`, z: hoyZ, raw: toRaw(hoyZ) },
    ...(lastZ && lastClub ? [{ key: 'ult', title: `${dtShort} en ${lastClub}`, sub: ult ? 'con la plantilla que dirigió allí' : 'con la plantilla actual de ese club', z: lastZ, raw: toRaw(lastZ) }] : []),
    { key: 'sim', title: `Simulado: ${dtShort} en ${club}`, sub: `${xi.length} jugadores elegidos`, z: simZ, raw: toRaw(simZ) },
  ]
  const hoy = scen[0], sim = scen[scen.length - 1]

  /* ---------------- frase resumen */
  const changes = KEY.map(k => ({ k, i: kidx[k], dz: sim.z[kidx[k]] - hoy.z[kidx[k]] }))
    .filter(c => Math.abs(c.dz) >= 0.25).sort((a, b) => Math.abs(b.dz) - Math.abs(a.dz)).slice(0, 3)
  const parts = changes.map(c => {
    const dRaw = sim.raw[c.i] - hoy.raw[c.i]
    const u = unitOf(kpis[c.i].etiqueta)
    return `${PHRASE[c.k][dRaw >= 0 ? 0 : 1]} (${signed(dRaw, u === 'xG' ? 2 : 1)}${u && u !== 'xG' ? ` ${u}` : ''})`
  })
  const sentence = coach === hoyCoach && changes.length === 0
    ? `${dtShort} ya dirige a ${club}: con este XI el estilo previsto apenas cambia.`
    : parts.length === 0
      ? `Con ${dtShort}, ${club} jugaría de forma muy parecida a como juega hoy: ningún rasgo clave cambia más de un cuarto de desviación típica.`
      : `Con ${dtShort}, ${club} ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`}.`

  /* ---------------- xG y puntos */
  const ixf = kidx['xg_90'], ixa = kidx['xg_contra_90']
  const pts = (s: Scenario) => ({ lf: s.raw[ixf], la: s.raw[ixa], ...poisson(s.raw[ixf], s.raw[ixa]) })
  const pHoy = pts(hoy), pSim = pts(sim)

  /* ---------------- plantilla y mercado */
  // rol en este club (alineaciones reales de la temporada); fichajes de fuera usan su posición habitual
  const posOf = (id: number): string | undefined => sq.pos?.[id] ?? P(id)?.pos
  const layout = formationLayout(xi, posOf)
  const bench = (sq.jugadores as [number, number][]).map(([p]) => p).filter(p => !xi.includes(p)).slice(0, 9)
  const ixfK = kidx['xg_90'], ixaK = kidx['xg_contra_90']
  const netXg = (p: Any) => { const bb = p?.b ?? data.otros; return bb ? bb[ixfK] * kpis[ixfK].sd - bb[ixaK] * kpis[ixaK].sd : 0 }
  const playerClubs = useMemo(() => [...new Set(Object.values(data.players as Record<string, Any>).map(p => p.club).filter(Boolean))].sort((a: Any, b: Any) => a.localeCompare(b, 'es')) as string[], [data])
  const selGroup = sel ? posTag(posOf(sel)).group : null
  const posFilter = sel && fPos === 'todas' ? `g:${selGroup}` : fPos
  const results = useMemo(() => {
    const q = norm(query.trim())
    const list = Object.entries(data.players as Record<string, Any>).filter(([id, p]) => {
      if (xi.includes(Number(id))) return false
      if (q && !norm(p.n).includes(q) && !norm(p.c ?? '').includes(q)) return false
      if (fClub !== 'todos' && p.club !== fClub) return false
      if ((p.min ?? 0) < fMin) return false
      if (posFilter.startsWith('g:')) { if (posTag(p.pos).group !== posFilter.slice(2)) return false }
      else if (posFilter !== 'todas' && posTag(p.pos).abbr !== posFilter) return false
      return true
    })
    list.sort((a, b) => orden === 'nombre' ? (a[1].c ?? a[1].n).localeCompare(b[1].c ?? b[1].n, 'es') : orden === 'xg' ? netXg(b[1]) - netXg(a[1]) : b[1].min - a[1].min)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, data, xi, fClub, fMin, posFilter, orden])
  const full = xi.length >= 11
  const addPlayer = (id: number) => {
    if (xi.includes(id)) return
    if (sel) { setXi(xi.map(q => (q === sel ? id : q))); setSel(null) }
    else if (!full) setXi([...xi, id])
  }
  const removePlayer = (id: number) => { setXi(xi.filter(q => q !== id)); if (sel === id) setSel(null) }
  const nOtros = xi.filter(p => !P(p)?.b).length

  /* ---------------- credibilidad */
  const V = data.validacion
  const ident = dtInfo.get(coach)?.identificabilidad as number | undefined

  /* ---------------- tabla */
  const rows = showAll ? kpis.map(k => k.k) : KEY
  const families = showAll ? [...new Set(kpis.map(k => k.familia as string))] : [null]
  const cell = (s: Scenario, i: number) => {
    const u = unitOf(kpis[i].etiqueta)
    const d = s.raw[i] - hoy.raw[i]
    const dz = s.z[i] - hoy.z[i]
    return (
      <td key={s.key} className={`num${s.key === 'sim' ? ' wi-sim' : ''}`}>
        {fmt(s.raw[i], u === 'xG' || kpis[i].k === 'xg_por_tiro' ? 2 : 1)}
        {s.key !== 'hoy' && (
          <span className={`wi-delta ${Math.abs(dz) < 0.15 ? 'flat' : d > 0 ? 'up' : 'down'}`} title={`${signed(d, 2)} vs ${club} hoy`}>
            {Math.abs(dz) < 0.15 ? '＝' : d > 0 ? '▲' : '▼'}
          </span>
        )}
      </td>
    )
  }

  return (
    <div className="wi">
      <h3 className="h2">Llévalo a otro club</h3>
      <p className="lede">Elige un club y arma el once: te decimos cómo jugaría ese equipo con este DT en el banquillo. Arranca con su club actual; cambia de club o de jugadores para comparar. Es una estimación: no sabe de química, lesiones ni vestidor.</p>

      <div className="wi-controls card">
        <div className="wi-pickers">
          <label className="wi-field">
            <span>DT</span>
            <select value={coach} onChange={e => setCoach(Number(e.target.value))}>
              {coachIds.map(id => <option key={id} value={id}>{coachName(id)}</option>)}
            </select>
          </label>
          <label className="wi-field">
            <span>Club</span>
            <select value={club} onChange={e => setClub(e.target.value)}>
              {clubs.map(c => <option key={c} value={c}>{c}{c === media?.dts?.[coach]?.club && media?.dts?.[coach]?.vigente ? ' (su club actual)' : coachedBy.has(c) ? ' (ya lo dirigió)' : ''}</option>)}
            </select>
          </label>
        </div>

        <div className="wi-squad-head">
          <div>
            <div className="h3 wi-once" style={{ margin: 0 }}>Once de <ClubName club={club} media={media} /></div>
            <div className="note">
              XI tipo de {sq.temporada} ({sq.partidos} partidos): su formación más usada{sq.formacion ? ` (${sq.formacion})` : ''} con el titular más frecuente en cada puesto. DT actual: {coachName(hoyCoach)}.
            </div>
          </div>
          <button className="btn ghost" onClick={() => { setXi([...sq.xi]); setSel(null) }}>Restablecer plantilla</button>
        </div>

        <div className="wi-builder">
          <div className="wi-pitch-col">
            <div className="wi-form-head">
              <span className="note">Formación resultante</span>
              <b className="wi-form">{layout.formacion || '—'}</b>
              {sel && <span className="chip wi-selchip">Cambiando a {jugadorCorto(sel, P(sel)?.n ?? '')} · <button className="wi-link" onClick={() => setSel(null)}>cancelar</button></span>}
            </div>
            <div className="wi-pitch">
              <Pitch vertical />
              {layout.pts.map(({ id, x, y }) => {
                const p = P(id), t = posTag(posOf(id))
                return (
                  <div key={id} className={`wi-tok${sel === id ? ' sel' : ''}${!p?.b ? ' prom' : ''}`}
                       style={{ left: `${(2 + 0.8 * x) / 84 * 100}%`, top: `${(2 + 120 * (1 - y / 100)) / 124 * 100}%` }}>
                    <button className={`wi-dot pos-${t.group}`} title={`${p?.n ?? id} · ${posOf(id) ?? '—'}${p?.club ? ` · ${p.club}` : ''}\nClic: cambiarlo por otro`}
                            onClick={() => setSel(sel === id ? null : id)}>
                      {t.abbr}
                      {p?.club && p.club !== club && <span className="wi-tok-logo"><ClubLogo club={p.club} media={media} size={14} /></span>}
                    </button>
                    <span className="wi-tok-name">{apellido(jugadorCorto(id, p?.n ?? String(id)))}</span>
                    <button className="wi-tok-x" aria-label={`Quitar a ${p?.n ?? id}`} onClick={() => removePlayer(id)}>×</button>
                  </div>
                )
              })}
            </div>
            {(xi.length !== 11 || layout.porteros !== 1) && (
              <p className="wi-warn">
                {xi.length !== 11 && `El XI tiene ${xi.length} jugadores.${xi.length < 11 ? ` Añade ${11 - xi.length} para comparar en igualdad.` : ''} `}
                {layout.porteros === 0 && 'No hay portero en la cancha. '}{layout.porteros > 1 && `Hay ${layout.porteros} porteros en la cancha.`}
              </p>
            )}
            <p className="note" style={{ margin: 0 }}>Clic en un jugador para cambiarlo; × para quitarlo. Borde punteado = pocos minutos (efecto promedio). Escudo = viene de otro club.</p>
            {bench.length > 0 && (!full || sel) && (
              <div className="wi-bench">
                <span className="note">Otros de la plantilla:</span>{' '}
                {bench.map(p => <button key={p} className="chip wi-chip" onClick={() => addPlayer(p)}>{sel ? '⇄' : '+'} {jugadorCorto(p, P(p)?.n ?? String(p))}</button>)}
              </div>
            )}
          </div>

          <div className="wi-market">
            <div className="h3" style={{ margin: 0 }}>{sel ? `Reemplazo para ${jugadorCorto(sel, P(sel)?.n ?? '')}` : 'Fichar jugador'}</div>
            <input className="wi-search" type="search" value={query} placeholder="Busca por nombre…" onChange={e => { setQuery(e.target.value); setNRes(12) }} />
            <div className="wi-filters">
              <label className="wi-field"><span>Posición</span>
                <select value={posFilter} onChange={e => { setFPos(e.target.value); setNRes(12) }}>
                  <option value="todas">Todas</option>
                  <optgroup label="Línea">
                    <option value="g:por">Porteros</option><option value="g:def">Defensas</option>
                    <option value="g:med">Medios</option><option value="g:del">Delanteros</option>
                  </optgroup>
                  <optgroup label="Posición">
                    {['POR', 'LI', 'DFC', 'LD', 'CAI', 'CAD', 'MCD', 'MC', 'MI', 'MD', 'MCO', 'EI', 'ED', 'DC', 'SD'].map(a => <option key={a} value={a}>{a}</option>)}
                  </optgroup>
                </select>
              </label>
              <label className="wi-field"><span>Club</span>
                <select value={fClub} onChange={e => { setFClub(e.target.value); setNRes(12) }}>
                  <option value="todos">Todos</option>
                  {playerClubs.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="wi-field"><span>Minutos mín.</span>
                <select value={fMin} onChange={e => { setFMin(Number(e.target.value)); setNRes(12) }}>
                  {[0, 450, 900, 1800, 2700, 4500].map(m => <option key={m} value={m}>{m === 0 ? 'Cualquiera' : `${fmt(m, 0)}+`}</option>)}
                </select>
              </label>
              <label className="wi-field"><span>Ordenar por</span>
                <select value={orden} onChange={e => setOrden(e.target.value as 'min' | 'xg' | 'nombre')}>
                  <option value="min">Minutos</option><option value="xg">Impacto en xG neto</option><option value="nombre">Nombre</option>
                </select>
              </label>
            </div>
            <div className="note">{fmt(results.length, 0)} jugadores{full && !sel ? ' · XI completo: haz clic en un jugador de la cancha para cambiarlo' : ''}</div>
            <ul className="wi-sugg">
              {results.slice(0, nRes).map(([id, p]) => {
                const nx = netXg(p)
                return (
                  <li key={id}>
                    <button onClick={() => addPlayer(Number(id))} disabled={full && !sel}>
                      <PosTag pos={p.pos ?? ''} />
                      <span className="wi-pname">{p.c ?? p.n}</span>
                      <span className="wi-res-club">{p.club && <ClubLogo club={p.club} media={media} size={14} />}{p.club ?? '—'}</span>
                      <span className="wi-res-num">{fmt(p.min, 0)}′</span>
                      <span className={`wi-res-num ${nx >= 0 ? 'up' : 'down'}`} title="Impacto modelado en xG a favor − xG en contra por 90 cuando está en la cancha">{signed(nx, 2)}</span>
                    </button>
                  </li>
                )
              })}
              {results.length === 0 && <li className="note" style={{ padding: 8 }}>Nadie cumple esos filtros.</li>}
            </ul>
            {results.length > nRes && <button className="btn ghost" onClick={() => setNRes(nRes + 20)}>Mostrar más</button>}
            <p className="note" style={{ margin: 0 }}>Columnas: minutos en la muestra · impacto en xG neto por 90 (β del jugador en xG a favor − en contra).</p>
          </div>
        </div>
      </div>

      <div className="card wi-summary">
        <p className="wi-sentence">{sentence}</p>
      </div>

      <div className="card">
        <div className="wi-table-head">
          <div className="h3" style={{ margin: 0 }}>Estilo previsto</div>
          <div className="seg" style={{ margin: 0 }}>
            <button aria-pressed={!showAll} onClick={() => setShowAll(false)}>Rasgos clave</button>
            <button aria-pressed={showAll} onClick={() => setShowAll(true)}>Todos ({kpis.length})</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="t wi-table">
            <thead>
              <tr>
                <th>Rasgo</th>
                {scen.map(s => (
                  <th key={s.key} className={s.key === 'sim' ? 'wi-sim' : ''}>
                    <span className="wi-th">{s.title}</span>
                    <span className="wi-th-sub">{s.sub}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {families.map(fam => [
                fam && <tr key={`f-${fam}`} className="wi-fam"><td colSpan={scen.length + 1}>{fam}</td></tr>,
                ...rows.filter(k => !fam || kpis[kidx[k]].familia === fam).map(k => {
                  const i = kidx[k]
                  return (
                    <tr key={k}>
                      <td>{kpis[i].etiqueta}</td>
                      {scen.map(s => cell(s, i))}
                    </tr>
                  )
                }),
              ])}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          Valores previstos en sus unidades para un partido promedio (mitad local, mitad visitante, marcador y minuto típicos). ▲▼ = cambio frente a {club} hoy; ＝ si es menor a 0.15 desviaciones típicas.
        </p>
      </div>

      <div className="card wi-xg">
        <div className="wi-table-head">
          <div className="h3" style={{ margin: 0 }}>Ocasiones y puntos</div>
          <span className="chip wi-spec">Estimación especulativa</span>
        </div>
        <div className="tbl-wrap">
          <table className="t">
            <thead>
              <tr><th></th><th>{club} hoy</th><th className="wi-sim">{dtShort} en {club}</th></tr>
            </thead>
            <tbody>
              {([
                ['xG a favor por 90', (p: Any) => fmt(p.lf, 2), 'lf'],
                ['xG en contra por 90', (p: Any) => fmt(p.la, 2), 'la'],
                ['Victoria', (p: Any) => `${fmt(p.w * 100, 0)}%`, 'w'],
                ['Empate', (p: Any) => `${fmt(p.d * 100, 0)}%`, 'd'],
                ['Derrota', (p: Any) => `${fmt(p.l * 100, 0)}%`, 'l'],
                ['Puntos esperados por partido', (p: Any) => fmt(p.xpts, 2), 'xpts'],
              ] as [string, (p: Any) => string, string][]).map(([lab, f, key]) => (
                <tr key={key}><td>{lab}</td><td className="num">{f(pHoy)}</td><td className="num wi-sim">{f(pSim)}</td></tr>
              ))}
              <tr className="wi-total">
                <td>Proyección de un torneo ({TORNEO} partidos)</td>
                <td className="num">{fmt(pHoy.xpts * TORNEO, 0)} pts</td>
                <td className="num wi-sim">{fmt(pSim.xpts * TORNEO, 0)} pts <span className="note">({signed((pSim.xpts - pHoy.xpts) * TORNEO, 0)})</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          Se toman el xG a favor y en contra previstos (sin penales) como goles esperados de cada equipo ante un rival promedio y se supone que los goles son independientes (Poisson).
          Ignora penales, calendario, rachas y la calidad de definición: sirve para comparar escenarios, no para pronosticar la tabla.
        </p>
      </div>

      <div className="card wi-cred">
        <div className="h3">¿Cuánto fiarse?</div>
        <p>
          En combinaciones reales, este cálculo reproduce el estilo observado con correlación <b>{fmt(V.dentro_muestra.correlacion_media, 2)}</b> (dentro de muestra, {V.dentro_muestra.n_mandatos} etapas DT-club).
          {' '}Cuando se predice una etapa que el modelo no vio (el DT llega con su estilo aprendido en otros clubes; {V.fuera_muestra.n_mandatos} etapas probadas), la correlación baja a <b>{fmt(V.fuera_muestra.correlacion_media, 2)}</b>
          {' '}(sin el término del DT sería {fmt(V.fuera_muestra.sin_dt.correlacion_media, 2)}).
        </p>
        {ident !== undefined && ident < 50 && (
          <p className="wi-warn">La identificabilidad de {dtShort} es baja ({fmt(ident, 0)}/100): su estilo propio está poco separado del de sus plantillas y clubes, así que la simulación es menos fiable.</p>
        )}
        {ident === undefined && (
          <p className="wi-warn">{dtShort} tiene pocos partidos en la muestra: su estilo propio está muy encogido hacia la media de la liga.</p>
        )}
        {nOtros >= 3 && (
          <p className="wi-warn">{nOtros} de los {xi.length} jugadores tienen pocos minutos en la muestra y usan un efecto promedio.</p>
        )}
      </div>
    </div>
  )
}
