import { useEffect, useMemo, useRef, useState } from 'react'
import { dataUrl, getJSON, nombreDT, shortName, fmt, type Any } from './lib'
import boot from './boot.json'
import { ClubLogo, ClubName, CoachPhoto } from './charts'
import StyleMap from './StyleMap'
import WhatIf from './WhatIf'
import { Resumen, DtVsPlantilla, Transferencia, Fases, Contexto, Jugadores, BalonParado, Simulador, Metodo } from './tabs'

import Hub from './Hub'
import Compare from './Compare'
import { MODES, TAB_KEYS, inkOn, modeOf, modeTitle, type TabKey, type View } from './modes'

function readHash() {
  const [c, t] = window.location.hash.replace('#', '').split('/')
  const n = Number(c)
  return { c: c && Number.isFinite(n) ? n : null, t: (TAB_KEYS.includes(t as TabKey) ? t : 'hub') as View }
}
const wide = () => window.matchMedia('(min-width: 900px)').matches
// en un visor embebido (p.ej. Artifact) cambiar la URL puede estar prohibido: nunca debe romper la app
const setHash = (h: string) => { try { window.history.replaceState(null, '', h) } catch { /* sin historial */ } }

export default function App() {
  // global + mapa + media vienen empaquetados en el JS: la portada no espera ninguna petición
  const glob: Any = (boot as Any).global
  const media: Any = (boot as Any).media
  const [err, setErr] = useState<string | null>(null)
  const [coachId, setCoachId] = useState<number | null>(readHash().c)
  const [tab, setTabRaw] = useState<View>(readHash().t)
  const setTab = (t: View) => { setTabRaw(t); window.scrollTo({ top: 0 }) }
  const [art, setArt] = useState<Any>(null)
  const [q, setQ] = useState('')
  const [activos, setActivos] = useState<boolean>(() => { try { return localStorage.getItem('soloActivos') === '1' } catch { return false } })
  useEffect(() => { try { localStorage.setItem('soloActivos', activos ? '1' : '0') } catch { /* sin almacenamiento */ } }, [activos])
  const nActivos = useMemo(() => (glob?.dts || []).filter((d: Any) => media.dts?.[d.id]?.vigente).length, [glob, media])
  const mapa: Any = (boot as Any).mapa
  const [sideOpen, setSideOpen] = useState(() => readHash().c !== null && wide())
  const [theme, setTheme] = useState<string | null>(() => { try { return localStorage.getItem('theme') } catch { return null } })

  useEffect(() => {
    const onHash = () => { const h = readHash(); setCoachId(h.c); if (h.c !== null) setTabRaw(h.t); else setSideOpen(false) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // si la ventana pasa a ancho de teléfono, el menú lateral (que ahí es un cajón encima) se cierra
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const onChange = () => { if (!mq.matches) setSideOpen(false) }
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSideOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const openCoach = (id: number) => { setTabRaw('hub'); setCoachId(id); setSideOpen(wide()); window.scrollTo({ top: 0 }) }
  const goMap = () => { setCoachId(null); setArt(null); setSideOpen(false); setHash('#mapa') }
  useEffect(() => {
    if (coachId === null) return
    setArt(null)
    getJSON(dataUrl(`dt_${coachId}.json`)).then(setArt).catch(e => setErr(e.message))
    setHash(`#${coachId}/${tab}`)
  }, [coachId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (coachId !== null) setHash(`#${coachId}/${tab}`) }, [tab, coachId])
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme); else document.documentElement.removeAttribute('data-theme')
    try { if (theme) localStorage.setItem('theme', theme); else localStorage.removeItem('theme') } catch { /* sin almacenamiento */ }
  }, [theme])

  const groups = useMemo(() => {
    if (!glob) return []
    const list = glob.dts.filter((d: Any) => (!activos || media.dts?.[d.id]?.vigente) && (d.nombre.toLowerCase().includes(q.toLowerCase()) || shortName(d.nombre).toLowerCase().includes(q.toLowerCase()) || d.clubes.some((c: Any) => c.club.toLowerCase().includes(q.toLowerCase()))))
    return [
      ['Dirigieron 2+ clubes · mejor identificados', list.filter((d: Any) => d.clubes.length >= 2)],
      ['Un solo club', list.filter((d: Any) => d.clubes.length < 2)],
    ] as [string, Any[]][]
  }, [glob, q, activos, media])

  if (err) return <div className="empty"><h2 className="h2">No se pudieron cargar los resultados</h2><p>{err}</p><p className="note">Faltan los archivos de datos: corre <code>python -m pipeline.export_static</code> y vuelve a compilar la web.</p></div>
  if (!glob) return <div className="empty">Cargando modelo…</div>

  return (
    <div className={`shell${sideOpen ? ' side-open' : ''}${coachId === null ? ' on-map' : ''}`}>
      <button className="burger" aria-label={sideOpen ? 'Cerrar menú' : 'Abrir menú de entrenadores'} aria-expanded={sideOpen} onClick={() => setSideOpen(o => !o)}>
        <span /><span /><span />
      </button>
      {sideOpen && <div className="scrim" onClick={() => setSideOpen(false)} />}
      <aside className="side" aria-hidden={!sideOpen}>
        <button className="map-link" onClick={goMap}>◎ Mapa de estilos</button>
        <h1 className="brand">ADN del<br />Entrenador<small>Qué parte del estilo es del DT y qué parte de su plantilla. Liga MX {glob.muestra.temporadas[0]}–{glob.muestra.temporadas.at(-1)}, {glob.muestra.partidos.toLocaleString('es-MX')} partidos.</small></h1>
        <input className="search" placeholder="Buscar DT o club" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar DT o club" />
        <label className="toggle-activos" htmlFor="solo-activos"><input id="solo-activos" type="checkbox" checked={activos} onChange={e => setActivos(e.target.checked)} /> Solo DTs activos <span className="note">({nActivos} con club actual)</span></label>
        {groups.map(([title, items]) => items.length ? (
          <div key={title}>
            <div className="coach-group">{title}</div>
            {items.map((d: Any) => (
              <button key={d.id} className="coach-btn" aria-current={d.id === coachId} onClick={() => openCoach(d.id)}>
                <span className="coach-name side-row">{(media.dts[d.id]?.club) && <ClubLogo club={media.dts[d.id].club} media={media} size={16} />}{shortName(d.nombre)}</span>
                <span className="coach-idx" title="Índice de identificabilidad (0–100)">{fmt(d.identificabilidad, 0)}</span>
                <span className="coach-meta">{d.clubes.map((c: Any) => c.club).join(' → ')} · {d.partidos} p.</span>
              </button>
            ))}
          </div>
        ) : null)}
        <button className="theme-toggle" onClick={() => setTheme(t => (t === 'dark' ? 'light' : t === 'light' ? null : 'dark'))}>
          Tema: {theme === 'dark' ? 'oscuro' : theme === 'light' ? 'claro' : 'sistema'}
        </button>
      </aside>
      <main className="main">
        {coachId === null ? (
          mapa ? (
            <section className="landing">
              <header className="landing-head">
                <h1 className="landing-title">ADN del Entrenador</h1>
                <p className="landing-sub">Cada burbuja es un DT de Liga MX. Cerca = ideas de juego parecidas, <b>ya descontada su plantilla</b>. Toca una para abrir su perfil.</p>
              </header>
              <StyleMap mapa={mapa} media={media} kpis={glob.kpis} onPick={openCoach} activos={activos} setActivos={setActivos} />
            </section>
          ) : <div className="empty">Cargando mapa…</div>
        ) : !art ? <div className="empty">Cargando DT…</div> : (
          <>
            <CoachBar art={art} media={media} tab={tab} setTab={setTab} />
            {tab === 'hub' ? (
              <>
                <header className="hero">
                  <div className="hero-top">
                    <CoachPhoto name={art.nombre} src={media.dts[art.id]?.foto} />
                    <div style={{ minWidth: 0 }}>
                      <div className="eyebrow">Historia de un entrenador a través de los datos</div>
                      <h2 className="coach-title">{(() => { const nm = nombreDT(art.id, art.nombre); return nm ? <><span className="light">{nm.nombres}</span> <span className="surname">{nm.apellidos}</span></> : art.nombre })()}</h2>
                      {media.dts[art.id]?.club && (
                        <div className="current-club">
                          <span className={media.dts[art.id].vigente ? 'badge-live' : 'badge-past'}>{media.dts[art.id].vigente ? 'Club actual' : 'Último club'}</span>
                          <ClubName club={media.dts[art.id].club} media={media} size={22} />
                          <span className="note">· último partido registrado {media.dts[art.id].ultimo_partido}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="spells" style={{ marginTop: 14, marginBottom: 0 }}>
                    {art.etapas.map((e: Any) => <span key={e.club} className="spell"><ClubName club={e.club} media={media} size={16} /> · <b>{e.partidos}</b> p. · {e.desde.slice(0, 4)}–{e.hasta.slice(0, 4)}</span>)}
                    <span className="spell">Identificabilidad <b>{fmt(art.identificabilidad.indice, 0)}</b>/100</span>
                    {art.partidos_total < 10 && <span className="spell warn" title="Con menos de 10 partidos el modelo encoge su estilo hacia el promedio de la liga">⚠ Solo {art.partidos_total} partidos: perfil preliminar</span>}
                  </div>
                </header>
                <section className="panel hub-panel">
                  <h3 className="hub-lead">¿Qué quieres saber de {shortName(art.nombre)}?</h3>
                  <Hub art={art} media={media} mapa={mapa} go={setTab} />
                </section>
              </>
            ) : (
              <section className="panel" role="tabpanel" style={{ ['--mc' as string]: modeOf(tab).color }}>
                <header className="mode-head">
                  <span className="mode-q">{modeOf(tab).q}</span>
                  <p className="mode-desc">{modeOf(tab).desc}</p>
                </header>
                {tab === 'resumen' && <Resumen art={art} glob={glob} media={media} go={setTab} />}
                {tab === 'dt' && <DtVsPlantilla art={art} glob={glob} media={media} />}
                {tab === 'transfer' && <Transferencia art={art} glob={glob} media={media} />}
                {tab === 'fases' && <Fases art={art} glob={glob} media={media} />}
                {tab === 'contexto' && <Contexto art={art} glob={glob} media={media} />}
                {tab === 'jugadores' && <Jugadores art={art} glob={glob} media={media} />}
                {tab === 'bp' && <BalonParado art={art} media={media} />}
                {tab === 'sim' && <Simulador art={art} media={media} />}
                {tab === 'whatif' && <WhatIf art={art} glob={glob} media={media} />}
                {tab === 'vs' && <Compare key={art.id} art={art} glob={glob} media={media} mapa={mapa} onOpen={openCoach} />}
                {tab === 'metodo' && <Metodo glob={glob} />}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

/** Barra fija: tarjeta compacta del DT que estás viendo + modos + subpestañas del modo actual. */
function CoachBar({ art, media, tab, setTab }: { art: Any; media: Any; tab: View; setTab: (t: View) => void }) {
  const mode = modeOf(tab), hub = tab === 'hub'
  // si los modos no caben, se difumina el borde y el modo activo se desplaza a la vista
  const modesRef = useRef<HTMLElement>(null)
  const [over, setOver] = useState({ l: false, r: false })
  useEffect(() => {
    const el = modesRef.current
    if (!el) return
    const upd = () => setOver({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
    const ro = new ResizeObserver(upd); ro.observe(el); el.addEventListener('scroll', upd, { passive: true }); upd()
    el.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
    return () => { ro.disconnect(); el.removeEventListener('scroll', upd) }
  }, [tab])
  const nm = nombreDT(art.id, art.nombre)
  const club = media.dts[art.id]?.club
  return (
    <div className="coachbar" style={{ ['--mc' as string]: hub ? 'var(--ink-3)' : mode.color, ['--mt' as string]: inkOn(mode.color) }}>
      <div className="cb-row">
        <button className="cb-id" onClick={() => setTab('hub')} title="Volver al menú de este DT">
          <CoachPhoto name={art.nombre} src={media.dts[art.id]?.foto} size={40} />
          <span className="cb-who">
            <span className="cb-name">{nm ? <><span className="light">{nm.nombres.split(' ')[0]}</span> {nm.apellidos}</> : art.nombre}</span>
            <span className="cb-club">{club && <ClubLogo club={club} media={media} size={14} />}{club ?? ''}{art.partidos_total ? ` · ${art.partidos_total} p.` : ''}</span>
          </span>
        </button>
        <nav ref={modesRef} className={`cb-modes${over.l ? ' ov-l' : ''}${over.r ? ' ov-r' : ''}`} aria-label="Modos">
          <button className="cb-mode cb-hubbtn" aria-pressed={hub} onClick={() => setTab('hub')}>Menú</button>
          {MODES.map(m => (
            <button key={m.k} className="cb-mode" style={{ ['--pc' as string]: m.color, ['--pt' as string]: inkOn(m.color) }} aria-pressed={!hub && mode.k === m.k} onClick={() => setTab(m.subs[0][0])}>
              <i aria-hidden />{m.name}
            </button>
          ))}
        </nav>
      </div>
      {!hub && (
        <div className="cb-subrow">
          <b className="cb-mode-title">{modeTitle(mode, art)}</b>
          {mode.subs.length > 1 && (
            <div className="cb-subs" role="tablist">
              {mode.subs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
