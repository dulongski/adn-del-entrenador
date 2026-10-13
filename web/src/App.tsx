import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { dataUrl, getJSON, nombreDT, shortName, fmt, type Any } from './lib'
import boot from './boot.json'
import { ClubLogo, ClubName, CoachPhoto } from './charts'
import StyleMap from './StyleMap'
import Logo from './Logo'
import SettingsMenu from './SettingsMenu'
import Info from './Info'
import { L, LOCALE, SETTINGS } from './settings'
import WhatIf from './WhatIf'
import { LigaSim } from './tabs/LigaSim'
import { TirosLibres } from './tabs/TirosLibres'
import { Banda, BpDefensa } from './tabs/BpExtra'
import { Fichajes, PlanJuego, Tablero } from './tabs/Plan'
import { Tiempo } from './tabs/Tiempo'
import { Duelo } from './tabs/Duelo'
import { Resumen, DtVsPlantilla, Transferencia, Fases, Contexto, Jugadores, BalonParado, Simulador, Metodo } from './tabs'

import Hub from './Hub'
import Chat from './Chat'
import Compare from './Compare'
import { PdfMenu } from './report/Export'
import { MODES, TAB_KEYS, inkOn, modeOf, modeTitle, type TabKey, type View } from './modes'

function readHash() {
  const [c, t] = window.location.hash.replace('#', '').split('/')
  const n = Number(c)
  return { c: c && Number.isFinite(n) ? n : null, t: (TAB_KEYS.includes(t as TabKey) ? t : 'hub') as View }
}
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
  // en el móvil, los botones flotantes (mapa y ajustes) se esconden al bajar y reaparecen al subir: no tapan el contenido
  useEffect(() => {
    let last = window.scrollY
    const f = () => { const y = window.scrollY; document.body.classList.toggle('fabs-hide', y > last + 4 && y > 120); if (y < last - 4 || y < 120) document.body.classList.remove('fabs-hide'); last = y }
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  useEffect(() => { try { localStorage.setItem('soloActivos', activos ? '1' : '0') } catch { /* sin almacenamiento */ } }, [activos])
  const nActivos = useMemo(() => (glob?.dts || []).filter((d: Any) => media.dts?.[d.id]?.vigente).length, [glob, media])
  const mapa: Any = (boot as Any).mapa
  const [sideOpen, setSideOpen] = useState(false)

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
  // cambio de pantalla con fundido (View Transitions si el navegador lo soporta; si no, cambio directo + animación CSS)
  const swap = (fn: () => void) => {
    const d = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (d.startViewTransition && !reduce) {
      // si el navegador aborta la transición (pestaña oculta, cambio durante otra transición) el cambio igual se aplica y no hay error
      const vt = d.startViewTransition(() => flushSync(fn)) as { ready?: Promise<unknown>; finished?: Promise<unknown>; updateCallbackDone?: Promise<unknown> } | undefined
      vt?.ready?.catch(() => {}); vt?.finished?.catch(() => {}); vt?.updateCallbackDone?.catch(() => {})
    }
    else fn()
  }
  const openCoach = (id: number) => swap(() => { setTabRaw('hub'); setCoachId(id); setSideOpen(false); window.scrollTo({ top: 0 }) })
  const goMap = () => swap(() => { setCoachId(null); setArt(null); setSideOpen(false); setHash('#mapa'); window.scrollTo({ top: 0 }) })
  // el chat de IA pide ir a un DT y una vista
  useEffect(() => {
    const onGo = (e: Event) => {
      const { coach, view } = (e as CustomEvent).detail as { coach: number | null; view: string }
      if (coach == null) return goMap()
      swap(() => { setCoachId(coach); setTabRaw((TAB_KEYS.includes(view as TabKey) ? view : 'hub') as View); setSideOpen(false); window.scrollTo({ top: 0 }) })
    }
    window.addEventListener('coachdna:go', onGo)
    return () => window.removeEventListener('coachdna:go', onGo)
  }) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (coachId === null) return
    setArt(null)
    getJSON(dataUrl(`dt_${coachId}.json`)).then(setArt).catch(e => setErr(e.message))
    setHash(`#${coachId}/${tab}`)
  }, [coachId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (coachId !== null) setHash(`#${coachId}/${tab}`) }, [tab, coachId])

  const groups = useMemo(() => {
    if (!glob) return []
    const list = glob.dts.filter((d: Any) => (!activos || media.dts?.[d.id]?.vigente) && (d.nombre.toLowerCase().includes(q.toLowerCase()) || shortName(d.nombre).toLowerCase().includes(q.toLowerCase()) || d.clubes.some((c: Any) => c.club.toLowerCase().includes(q.toLowerCase()))))
    return [
      [L('Dirigieron 2+ clubes · mejor identificados', 'Coached 2+ clubs · best identified'), list.filter((d: Any) => d.clubes.length >= 2)],
      [L('Un solo club', 'One club only'), list.filter((d: Any) => d.clubes.length < 2)],
    ] as [string, Any[]][]
  }, [glob, q, activos, media])

  if (err) return <div className="empty"><h2 className="h2">{L('No se pudieron cargar los resultados', 'Couldn\'t load the results')}</h2><p>{err}</p><p className="note">{L('Faltan los archivos de datos: corre ', 'The data files are missing: run ')}<code>python -m pipeline.export_static</code>{L(' y vuelve a compilar la web.', ' and rebuild the site.')}</p></div>
  if (!glob) return <div className="empty">{L('Cargando modelo…', 'Loading model…')}</div>

  return (
    <div className={`shell${sideOpen ? ' side-open' : ''}${coachId === null ? ' on-map' : ''}`}>
      <button className="burger" aria-label={sideOpen ? L('Cerrar menú', 'Close menu') : L('Abrir menú de entrenadores', 'Open coaches menu')} aria-expanded={sideOpen} onClick={() => setSideOpen(o => !o)}>
        <span /><span /><span />
      </button>
      <button className="home-btn" aria-label={L('Ir al mapa de estilos', 'Go to the style map')} title={L('Mapa de estilos', 'Style map')} onClick={goMap}>
        <svg viewBox="0 0 24 24" aria-hidden><circle cx="7" cy="8" r="2.4" /><circle cx="16.5" cy="6.5" r="1.8" /><circle cx="15" cy="15.5" r="2.8" /><circle cx="6.5" cy="17" r="1.6" /><path d="M7 8 L16.5 6.5 M7 8 L15 15.5 M15 15.5 L6.5 17" fill="none" strokeWidth="1.1" stroke="currentColor" opacity=".55" /></svg>
      </button>
      <SettingsMenu />
      <Chat coach={coachId} view={coachId === null ? 'mapa' : tab} />
      {sideOpen && <div className="scrim" onClick={() => setSideOpen(false)} />}
      <aside className="side" aria-hidden={!sideOpen}>
        <button className="map-link" onClick={goMap}>◎ {L('Mapa de estilos', 'Style map')}</button>
        <h1 className="brand"><Logo kind={SETTINGS.logo} size={30} /><small>{L('Qué parte del estilo es del DT y qué parte de su plantilla.', 'How much of the style is the coach and how much is the squad.')} Liga MX {glob.muestra.temporadas[0]}–{glob.muestra.temporadas.at(-1)}, {glob.muestra.partidos.toLocaleString(LOCALE)} {L('partidos', 'matches')}.</small></h1>
        <input className="search" placeholder={L('Buscar DT o club', 'Search coach or club')} value={q} onChange={e => setQ(e.target.value)} aria-label={L('Buscar DT o club', 'Search coach or club')} />
        <label className="toggle-activos" htmlFor="solo-activos"><input id="solo-activos" type="checkbox" checked={activos} onChange={e => setActivos(e.target.checked)} /> {L('Solo DTs activos', 'Active coaches only')} <span className="note">({nActivos} {L('con club actual', 'at a club now')})</span></label>
        {groups.map(([title, items]) => items.length ? (
          <div key={title}>
            <div className="coach-group">{title}</div>
            {items.map((d: Any) => (
              <button key={d.id} className="coach-btn" aria-current={d.id === coachId} onClick={() => openCoach(d.id)}>
                <span className="coach-name side-row">{(media.dts[d.id]?.club) && <ClubLogo club={media.dts[d.id].club} media={media} size={16} />}{shortName(d.nombre)}</span>
                <span className="coach-idx" title={L('Índice de identificabilidad (0–100)', 'Identifiability index (0–100)')}>{fmt(d.identificabilidad, 0)}</span>
                <span className="coach-meta">{d.clubes.map((c: Any) => c.club).join(' → ')} · {d.partidos} {L('p.', 'matches')}</span>
              </button>
            ))}
          </div>
        ) : null)}
      </aside>
      <main className="main">
        {coachId === null ? (
          mapa ? (
            <section className="landing">
              <header className="landing-head">
                <h1 className="landing-title"><Logo kind={SETTINGS.logo} size={40} /><span className="landing-info"><Info wide>{L('Cada burbuja es un DT de Liga MX. Cerca = ideas de juego parecidas, ', 'Each bubble is a Liga MX coach. Closer = similar ideas about the game, ')}<b>{L('ya descontada su plantilla', 'squad already factored out')}</b>{L('. Toca una para abrir su perfil.', '. Tap one to open his profile.')}</Info></span></h1>
              </header>
              <StyleMap mapa={mapa} media={media} kpis={glob.kpis} onPick={openCoach} activos={activos} setActivos={setActivos} />
            </section>
          ) : <div className="empty">{L('Cargando mapa…', 'Loading map…')}</div>
        ) : !art ? <div className="empty">{L('Cargando DT…', 'Loading coach…')}</div> : (
          <>
            <CoachBar art={art} media={media} tab={tab} setTab={setTab} />
            {tab === 'hub' ? (
              <>
                <header className="hero">
                  <div className="hero-top">
                    <CoachPhoto name={art.nombre} src={media.dts[art.id]?.foto} />
                    <div style={{ minWidth: 0 }}>
                      <div className="eyebrow">{L('Historia de un entrenador a través de los datos', 'A coach\'s story, told through data')}</div>
                      <h2 className="coach-title">{(() => { const nm = nombreDT(art.id, art.nombre); return nm ? <><span className="light">{nm.nombres}</span> <span className="surname">{nm.apellidos}</span></> : art.nombre })()}</h2>
                      {media.dts[art.id]?.club && (
                        <div className="current-club">
                          <span className={media.dts[art.id].vigente ? 'badge-live' : 'badge-past'}>{media.dts[art.id].vigente ? L('Club actual', 'Current club') : L('Último club', 'Last club')}</span>
                          <ClubName club={media.dts[art.id].club} media={media} size={22} />
                          <span className="note">· {L('último partido registrado', 'last recorded match')} {media.dts[art.id].ultimo_partido}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="spells" style={{ marginTop: 14, marginBottom: 0 }}>
                    {art.etapas.map((e: Any) => <span key={e.club} className="spell"><ClubName club={e.club} media={media} size={16} /> · <b>{e.partidos}</b> {L('p.', 'matches')} · {e.desde.slice(0, 4)}–{e.hasta.slice(0, 4)}</span>)}
                    <span className="spell">{L('Identificabilidad', 'Identifiability')} <b>{fmt(art.identificabilidad.indice, 0)}</b>/100</span>
                    {art.partidos_total < 10 && <span className="spell warn" title={L('Con menos de 10 partidos el modelo encoge su estilo hacia el promedio de la liga', 'With fewer than 10 matches the model shrinks his style toward the league average')}>⚠ {L(`Solo ${art.partidos_total} partidos: perfil preliminar`, `Only ${art.partidos_total} matches: preliminary profile`)}</span>}
                  </div>
                </header>
                <section className="panel hub-panel">
                  <h3 className="hub-lead">{L(`¿Qué quieres saber de ${shortName(art.nombre)}?`, `What do you want to know about ${shortName(art.nombre)}?`)}</h3>
                  <Hub art={art} media={media} mapa={mapa} go={setTab} />
                </section>
              </>
            ) : (
              <section className="panel" role="tabpanel" style={{ ['--mc' as string]: modeOf(tab).color }}>
                <header className="mode-head">
                  <span className="mode-q">{modeOf(tab).q}<Info>{modeOf(tab).desc}</Info></span>
                </header>
                {tab === 'resumen' && <Resumen art={art} glob={glob} media={media} go={setTab} />}
                {tab === 'dt' && <DtVsPlantilla art={art} glob={glob} media={media} />}
                {tab === 'transfer' && <Transferencia art={art} glob={glob} media={media} />}
                {tab === 'fases' && <Fases art={art} glob={glob} media={media} />}
                {tab === 'contexto' && <Contexto art={art} glob={glob} media={media} />}
                {tab === 'jugadores' && <Jugadores art={art} glob={glob} media={media} />}
                {tab === 'bp' && <BalonParado art={art} media={media} />}
                {tab === 'tl' && <TirosLibres art={art} media={media} />}
                {tab === 'banda' && <Banda art={art} media={media} />}
                {tab === 'bpdef' && <BpDefensa art={art} media={media} />}
                {tab === 'tiempo' && <Tiempo art={art} glob={glob} media={media} />}
                {tab === 'plan' && <PlanJuego art={art} glob={glob} />}
                {tab === 'fichajes' && <Fichajes art={art} glob={glob} media={media} />}
                {tab === 'tablero' && <Tablero art={art} glob={glob} />}
                {tab === 'sim' && <Simulador art={art} media={media} glob={glob} />}
                {tab === 'whatif' && <WhatIf art={art} glob={glob} media={media} />}
                {tab === 'liga' && <LigaSim art={art} media={media} />}
                {tab === 'vs' && <Compare key={art.id} art={art} glob={glob} media={media} mapa={mapa} onOpen={openCoach} />}
                {tab === 'duelo' && <Duelo key={art.id} art={art} glob={glob} media={media} mapa={mapa} />}
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
        <button className="cb-id" onClick={() => setTab('hub')} title={L('Volver al menú de este DT', 'Back to this coach\'s menu')}>
          <CoachPhoto name={art.nombre} src={media.dts[art.id]?.foto} size={40} />
          <span className="cb-who">
            <span className="cb-name">{nm ? <><span className="light">{nm.nombres.split(' ')[0]}</span> {nm.apellidos}</> : art.nombre}</span>
            <span className="cb-club">{club && <ClubLogo club={club} media={media} size={14} />}{club ?? ''}{art.partidos_total ? ` · ${art.partidos_total} ${L('p.', 'matches')}` : ''}</span>
          </span>
        </button>
        <nav ref={modesRef} className={`cb-modes${over.l ? ' ov-l' : ''}${over.r ? ' ov-r' : ''}`} aria-label={L('Modos', 'Modes')}>
          <button className="cb-mode cb-hubbtn" aria-pressed={hub} onClick={() => setTab('hub')}>{L('Menú', 'Menu')}</button>
          {MODES.map(m => (
            <button key={m.k} className="cb-mode" style={{ ['--pc' as string]: m.color, ['--pt' as string]: inkOn(m.color) }} aria-pressed={!hub && mode.k === m.k} onClick={() => setTab(m.subs[0][0])}>
              <i aria-hidden />{m.name}
            </button>
          ))}
        </nav>
        <PdfMenu art={art} modeK={hub ? '' : mode.k} modeName={mode.name} />
      </div>
      {!hub && (
        <div className="cb-subrow">
          <b className="cb-mode-title">{modeTitle(mode, art)}</b>
          {mode.subs.length > 1 && (
            <div className="cb-subs" role="tablist">
              {mode.subs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}><SubIcon k={k} />{l}</button>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Iconos de las subpestañas: dejan claro que dentro de un modo hay varias vistas distintas. */
function SubIcon({ k }: { k: TabKey }) {
  const P: Partial<Record<TabKey, React.ReactNode>> = {
    resumen: <><path d="M8 3c0 6 8 6 8 12s-8 6-8 6M16 3c0 6-8 6-8 12s8 6 8 6" fill="none" strokeWidth="1.8" strokeLinecap="round" /><path d="M9 7h6M9 17h6" fill="none" strokeWidth="1.6" strokeLinecap="round" /></>,
    dt: <><rect x="3" y="5" width="7" height="3" rx="1" /><rect x="10" y="5" width="5" height="3" rx="1" opacity=".55" /><rect x="3" y="11" width="4" height="3" rx="1" /><rect x="7" y="11" width="9" height="3" rx="1" opacity=".55" /><rect x="3" y="17" width="10" height="3" rx="1" /><rect x="13" y="17" width="4" height="3" rx="1" opacity=".55" /></>,
    transfer: <><path d="M4 8h13l-3-3M20 16H7l3 3" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>,
    fases: <><rect x="3" y="5" width="18" height="14" rx="1.5" fill="none" strokeWidth="1.8" /><path d="M12 5v14" fill="none" strokeWidth="1.8" /><circle cx="12" cy="12" r="2.6" fill="none" strokeWidth="1.8" /></>,
    contexto: <><circle cx="12" cy="12" r="8" fill="none" strokeWidth="1.8" /><path d="M12 7v5l3.5 2" fill="none" strokeWidth="2" strokeLinecap="round" /></>,
    sim: <><path d="M19 12a7 7 0 1 1-2.1-5" fill="none" strokeWidth="2" strokeLinecap="round" /><path d="M17.5 3.5v4h-4" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.2" /></>,
    bp: <><path d="M6 21V4" fill="none" strokeWidth="1.8" strokeLinecap="round" /><path d="M6 5h11l-2 4 2 4H6" fill="none" strokeWidth="1.8" strokeLinejoin="round" /></>,
    tl: <><circle cx="8.5" cy="14.5" r="4.6" fill="none" strokeWidth="1.8" /><path d="M12.2 11.4L21 9.2v3.8h-7.2" fill="none" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="8.5" cy="14.5" r="1.1" /><path d="M5.2 7.2l1.3 1.9M9.5 5.5l.2 2.1" fill="none" strokeWidth="1.6" strokeLinecap="round" /></>,
    tiempo: <><path d="M4 18h16" fill="none" strokeWidth="1.8" strokeLinecap="round" /><path d="M5 14l4-4 4 3 6-7" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>,
    banda: <><path d="M5 20V4" fill="none" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="7" r="3" fill="none" strokeWidth="1.8" /><path d="M12 10c3 3 5 6 7 10" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 2.4" /></>,
    bpdef: <><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" fill="none" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>,
    plan: <><rect x="3.5" y="4" width="17" height="16" rx="2" fill="none" strokeWidth="1.8" /><path d="M7 15l3-3 2 2 5-6" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M14.5 8H17v2.5" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>,
    fichajes: <><circle cx="9" cy="8" r="3.2" fill="none" strokeWidth="1.8" /><path d="M3.5 19c.8-3.4 3-5 5.5-5s4.7 1.6 5.5 5" fill="none" strokeWidth="1.8" strokeLinecap="round" /><path d="M17 8v6m-3-3h6" fill="none" strokeWidth="1.8" strokeLinecap="round" /></>,
    duelo: <><circle cx="7" cy="8" r="3" fill="none" strokeWidth="1.8" /><circle cx="17" cy="8" r="3" fill="none" strokeWidth="1.8" /><path d="M3 19c.6-3 2-4.6 4-4.6s3.4 1.6 4 4.6M13 19c.6-3 2-4.6 4-4.6s3.4 1.6 4 4.6" fill="none" strokeWidth="1.8" strokeLinecap="round" /></>,
    tablero: <><path d="M4 16a8 8 0 0 1 16 0" fill="none" strokeWidth="1.8" strokeLinecap="round" /><path d="M12 16l4-5" fill="none" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="16" r="1.4" /></>,
    liga: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="none" strokeWidth="1.8" strokeLinejoin="round" /><path d="M12 14v4m-4 2h8" fill="none" strokeWidth="1.8" strokeLinecap="round" /></>,
    whatif: <><path d="M8 4l-4 3 2 3 2-1v11h8V9l2 1 2-3-4-3h-2a2 2 0 0 1-4 0z" fill="none" strokeWidth="1.7" strokeLinejoin="round" /></>,
  }
  return P[k] ? <svg className="cb-sub-ic" viewBox="0 0 24 24" aria-hidden fill="currentColor" stroke="currentColor" strokeWidth="0">{P[k]}</svg> : null
}
