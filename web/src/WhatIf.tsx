import { useEffect, useMemo, useState } from 'react'
import { ClubName, PosTag } from './charts'
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

const GROUP_ORDER: Record<string, number> = { por: 0, def: 1, med: 2, del: 3, none: 4 }
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

  const coached = new Set<string>((art.etapas ?? []).map((e: Any) => e.club))
  const defaultClub = clubs.find(c => !coached.has(c) && data.squads[c]?.temporada === latest) ?? clubs.find(c => !coached.has(c)) ?? clubs[0]

  const [coach, setCoach] = useState<number>(data.coaches[art.id] ? art.id : coachIds[0])
  const [club, setClubState] = useState<string>(defaultClub)
  const [xi, setXi] = useState<number[]>(() => [...data.squads[defaultClub].xi])
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const setClub = (c: string) => { setClubState(c); setXi([...data.squads[c].xi]) }
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

  /* ---------------- plantilla */
  const xiSorted = [...xi].sort((a, b) => (GROUP_ORDER[posTag(P(a)?.pos).group] ?? 4) - (GROUP_ORDER[posTag(P(b)?.pos).group] ?? 4))
  const bench = (sq.jugadores as [number, number][]).map(([p]) => p).filter(p => !xi.includes(p)).slice(0, 9)
  const suggestions = useMemo(() => {
    const q = norm(query.trim())
    if (q.length < 2) return []
    return Object.entries(data.players as Record<string, Any>)
      .filter(([id, p]) => norm(p.n).includes(q) && !xi.includes(Number(id)))
      .sort((a, b) => b[1].min - a[1].min).slice(0, 8)
  }, [query, data, xi])
  const full = xi.length >= 11
  const addPlayer = (id: number) => { if (!full && !xi.includes(id)) setXi([...xi, id]); setQuery('') }
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
      <h3 className="h2">¿Y si…?</h3>
      <p className="lede">Combina el estilo propio de este DT con la plantilla y el club que elijas. El modelo suma sus efectos; no captura química ni lesiones.</p>

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
              {clubs.map(c => <option key={c} value={c}>{c}{coachedBy.has(c) ? ' (ya lo dirigió)' : ''}</option>)}
            </select>
          </label>
        </div>

        <div className="wi-squad-head">
          <div>
            <div className="h3 wi-once" style={{ margin: 0 }}>Once de <ClubName club={club} media={media} /></div>
            <div className="note">
              XI más utilizado en {sq.temporada} ({sq.partidos} partidos{sq.formacion ? `, ${sq.formacion}` : ''}). DT actual: {coachName(hoyCoach)}.
            </div>
          </div>
          <button className="btn ghost" onClick={() => setXi([...sq.xi])}>Restablecer plantilla</button>
        </div>

        <ul className="wi-xi">
          {xiSorted.map(p => (
            <li key={p}>
              <PosTag pos={P(p)?.pos ?? ''} />
              <span className="wi-pname">{jugadorCorto(p, P(p)?.n ?? String(p))}</span>
              {P(p)?.club && P(p).club !== club && <span className="chip">{P(p).club}</span>}
              {!P(p)?.b && <span className="chip" title="Pocos minutos en la muestra: usa el efecto promedio de 'otros'">prom.</span>}
              <button className="wi-x" aria-label={`Quitar a ${P(p)?.n ?? p}`} onClick={() => setXi(xi.filter(q => q !== p))}>×</button>
            </li>
          ))}
        </ul>
        {xi.length !== 11 && (
          <p className="wi-warn">El XI tiene {xi.length} jugadores. {xi.length < 11 ? `Añade ${11 - xi.length} para comparar en igualdad.` : ''}</p>
        )}

        <div className="wi-sign">
          <label className="wi-field">
            <span>Fichar jugador</span>
            <input type="search" value={query} placeholder={full ? 'Quita a alguien del XI para fichar' : 'Busca por nombre…'}
                   disabled={full} onChange={e => setQuery(e.target.value)} />
          </label>
          {suggestions.length > 0 && (
            <ul className="wi-sugg" role="listbox">
              {suggestions.map(([id, p]) => (
                <li key={id}>
                  <button onClick={() => addPlayer(Number(id))}>
                    <PosTag pos={p.pos ?? ''} />
                    <span className="wi-pname">{p.n}</span>
                    <span className="note">{p.club ?? '—'} · {fmt(p.min, 0)} min</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!full && bench.length > 0 && (
            <div className="wi-bench">
              <span className="note">Otros de la plantilla:</span>{' '}
              {bench.map(p => <button key={p} className="chip wi-chip" onClick={() => addPlayer(p)}>+ {jugadorCorto(p, P(p)?.n ?? String(p))}</button>)}
            </div>
          )}
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
                <td>Proyección de temporada (34 partidos)</td>
                <td className="num">{fmt(pHoy.xpts * 34, 0)} pts</td>
                <td className="num wi-sim">{fmt(pSim.xpts * 34, 0)} pts <span className="note">({signed((pSim.xpts - pHoy.xpts) * 34, 0)})</span></td>
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
