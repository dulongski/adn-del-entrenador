import { useMemo, useState } from 'react'
import { ClubLogo, CoachPhoto } from '../charts'
import { fmt, shortName, type Any } from '../lib'
import { famHue, norm, signed } from './util'

type Orden = 'parecido' | 'distinto' | 'nombre' | 'partidos'

/** Buscador de rival al estilo del mercado de "¿Y si…?": texto + filtros + lista ordenable. */
export default function CoachPicker({ sims, pts, mapa, media, selected, onPick, nA }: {
  sims: { id: number; r: number }[]; pts: Map<number, Any>; mapa: Any; media: Any; selected: number; onPick: (id: number) => void; nA: string
}) {
  const [q, setQ] = useState('')
  const [activos, setActivos] = useState(false)
  const [fam, setFam] = useState(-1)
  const [club, setClub] = useState('todos')
  const [minP, setMinP] = useState(0)
  const [orden, setOrden] = useState<Orden>('parecido')
  const [showF, setShowF] = useState(false)

  const clubOf = (id: number) => media.dts[id]?.club ?? pts.get(id)?.clubes.at(-1) ?? ''
  const clubes = useMemo(() => [...new Set(sims.flatMap(s => pts.get(s.id)?.clubes ?? []))].sort((a, b) => a.localeCompare(b, 'es')), [sims, pts])
  const rank = useMemo(() => new Map(sims.map((s, i) => [s.id, i + 1])), [sims])

  const results = useMemo(() => {
    const nq = norm(q.trim())
    const out = sims.filter(s => {
      const p = pts.get(s.id)
      if (!p) return false
      if (activos && !media.dts[s.id]?.vigente) return false
      if (fam >= 0 && p.grupo !== fam) return false
      if (club !== 'todos' && !p.clubes.includes(club)) return false
      if (p.partidos < minP) return false
      return !nq || norm(`${p.nombre} ${p.clubes.join(' ')} ${clubOf(s.id)}`).includes(nq)
    })
    if (orden === 'distinto') out.reverse()
    if (orden === 'nombre') out.sort((a, b) => shortName(pts.get(a.id).nombre).localeCompare(shortName(pts.get(b.id).nombre), 'es'))
    if (orden === 'partidos') out.sort((a, b) => pts.get(b.id).partidos - pts.get(a.id).partidos)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sims, pts, q, activos, fam, club, minP, orden, media])

  const twin = sims[0], opp = sims.at(-1)!
  const filtered = q || activos || fam >= 0 || club !== 'todos' || minP > 0
  const open = showF || q.trim().length > 0 || !!filtered
  const reset = () => { setQ(''); setActivos(false); setFam(-1); setClub('todos'); setMinP(0) }

  return (
    <div className="card vs-cp">
      <div className="vs-cp-head">
        <div className="h3" style={{ margin: 0 }}>¿Con quién comparar a {nA}?</div>
        <div className="vs-cp-quick">
          <button className="vs-cp-chip" aria-pressed={selected === twin.id} onClick={() => onPick(twin.id)}>
            <span className="vs-cp-chip-k">Su gemelo</span> {shortName(pts.get(twin.id).nombre)}
          </button>
          <button className="vs-cp-chip" aria-pressed={selected === opp.id} onClick={() => onPick(opp.id)}>
            <span className="vs-cp-chip-k">Su opuesto</span> {shortName(pts.get(opp.id).nombre)}
          </button>
        </div>
      </div>

      <div className="vs-cp-searchrow">
        <input className="vs-cp-search" type="search" value={q} placeholder="Busca un DT por nombre o club…" aria-label="Buscar DT" onChange={e => setQ(e.target.value)} />
        <button className="vs-cp-ftoggle" aria-expanded={open} onClick={() => setShowF(v => !v)}>{open ? 'Ocultar filtros' : 'Filtros y lista completa'}</button>
      </div>
      {!open && (
        <div className="vs-cp-strip">
          <span className="note">Más parecidos:</span>
          {sims.slice(0, 5).map(x => (
            <button key={x.id} className="vs-cp-chip" aria-pressed={selected === x.id} onClick={() => onPick(x.id)}>{shortName(pts.get(x.id).nombre)} <span className="vs-cp-chip-k">{signed(x.r)}</span></button>
          ))}
        </div>
      )}
      {open && <>
      <div className="vs-cp-controls">
        <label className="vs-cp-field"><span>Familia de estilo</span>
          <select value={fam} onChange={e => setFam(Number(e.target.value))}>
            <option value={-1}>Todas</option>
            {mapa.grupos.map((g: Any) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </label>
        <label className="vs-cp-field"><span>Club que dirigió</span>
          <select value={club} onChange={e => setClub(e.target.value)}>
            <option value="todos">Todos</option>
            {clubes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="vs-cp-field"><span>Partidos mín.</span>
          <select value={minP} onChange={e => setMinP(Number(e.target.value))}>
            {[0, 10, 34, 60, 100].map(m => <option key={m} value={m}>{m === 0 ? 'Cualquiera' : `${m}+`}</option>)}
          </select>
        </label>
        <label className="vs-cp-field"><span>Ordenar por</span>
          <select value={orden} onChange={e => setOrden(e.target.value as Orden)}>
            <option value="parecido">Más parecido</option><option value="distinto">Más distinto</option>
            <option value="nombre">Nombre</option><option value="partidos">Partidos</option>
          </select>
        </label>
        <label className="vs-cp-check"><input type="checkbox" checked={activos} onChange={e => setActivos(e.target.checked)} /> Solo DTs en activo</label>
      </div>

      <div className="vs-cp-meta note">
        <span>{results.length} de {sims.length} DTs{filtered && <> · <button className="vs-cp-reset" onClick={reset}>quitar filtros</button></>}</span>
        <span className="vs-cp-meta-r">Parecido de estilo con {nA}: +1 idéntico · 0 nada que ver · −1 opuesto</span>
      </div>

      <ul className="vs-cp-list">
        {results.map(s => {
          const p = pts.get(s.id), c = clubOf(s.id), g = mapa.grupos.find((x: Any) => x.id === p.grupo)
          const w = Math.min(50, Math.abs(s.r) * 50)
          return (
            <li key={s.id}>
              <button className="vs-cp-row" aria-pressed={selected === s.id} onClick={() => onPick(s.id)}>
                <CoachPhoto name={p.nombre} src={media.dts[s.id]?.foto} size={36} />
                <span className="vs-cp-who">
                  <span className="vs-cp-name">{shortName(p.nombre)}{p.partidos < 10 && <span className="vs-cp-pre" title="Menos de 10 partidos: perfil preliminar">preliminar</span>}</span>
                  <span className="vs-cp-sub">
                    {c && <span className="vs-cp-club"><ClubLogo club={c} media={media} size={14} />{c}</span>}
                    <span className="vs-cp-fam"><i style={{ background: famHue(p.grupo) }} />{g?.nombre}</span>
                  </span>
                </span>
                <span className="vs-cp-r" title={`${rank.get(s.id)}º más parecido a ${nA} de ${sims.length}`}>
                  <span className="vs-cp-bar"><i className={s.r >= 0 ? 'up' : 'dn'} style={s.r >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} /></span>
                  <b>{signed(s.r)}</b>
                </span>
                <span className="vs-cp-pj">{fmt(p.partidos, 0)} PJ</span>
              </button>
            </li>
          )
        })}
        {results.length === 0 && <li className="note" style={{ padding: 10 }}>Ningún DT cumple esos filtros.</li>}
      </ul>
      </>}
    </div>
  )
}
