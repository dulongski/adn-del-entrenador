import { useEffect, useMemo, useState } from 'react'
import { clubColor, dataUrl, fmt, getJSON, type Any } from '../lib'
import { ClubLogo, DotCI, HeatGrid } from '../charts'
import { parseShots, ShotExplorer } from '../ShotExplorer'
import Info from '../Info'
import '../styles/juego.css'
import { L } from '../settings'
import { famLabel, kpiDesc, kpiLabel } from '../i18n/data'
import { FAM_ORDER, Seg, type P } from './common'
import { Formaciones, JugadasTipo } from './JugadasTipo'

export function Fases({ art, glob, media }: P) {
  const cur = media?.dts?.[art.id]?.club ?? art.etapas?.at(-1)?.club
  const tc = clubColor(cur, media)
  const [map, setMap] = useState('presion')
  const [mode, setMode] = useState<'div' | 'seq'>('div')
  const [J, setJ] = useState<Any>(null)       // tiros por club
  const [liga, setLiga] = useState<Any>(null)
  const [club, setClub] = useState<string | null>(null)
  useEffect(() => {
    setJ(null); setClub(null)
    getJSON(dataUrl(`juego_${art.id}.json`)).then(setJ).catch(() => setJ(false))
  }, [art.id])
  useEffect(() => { getJSON(dataUrl('jugadas_liga.json')).then(setLiga).catch(() => setLiga(false)) }, [])
  const JG: Any = J ? J.jg ?? false : J      // jugadas tipo, formaciones y defensa 360 viajan dentro de juego_<id>.json
  const clubes: Any[] = JG?.clubes || J?.clubes || []
  const club_ = club && clubes.some(c => c.club === club) ? club : (clubes.find(c => c.club === cur)?.club ?? clubes.at(-1)?.club ?? cur)
  const cc = clubColor(club_, media)
  const allShots = useMemo(() => parseShots(J), [J])
  const shots = useMemo(() => allShots.filter(s => s.club === club_), [allShots, club_])
  const pc = JG?.por_club?.[club_]
  const hu = art.huella.filter((h: Any) => !h.kpi.startsWith('arq_'))
  const M = art.mapas
  const mapLabels: Record<string, string> = { presion: L('Presiones', 'Pressures'), recuperaciones: L('Recuperaciones', 'Ball recoveries'), progresion: L('Destino de las acciones que hacen avanzar', 'Where progressive actions end up') }
  const total = clubes.reduce((a, c) => a + c.partidos, 0)
  const loading = (bad: boolean) => <div className="card"><div className="note">{bad ? L('Sin datos.', 'No data.') : L('Cargando…', 'Loading…')}</div></div>
  return (
    <div>
      <div className="jg-clubs" role="group" aria-label={L('Club para las jugadas tipo, las formaciones y los tiros', 'Club for the signature plays, line-ups and shots')}>
        <span className="jg-clubs-label">{L('Datos de', 'Data from')} <Info wide>{L('Las jugadas tipo, las formaciones y los tiros son del club que elijas (por defecto, el actual). El mapa de calor junta todos sus clubes.', 'Signature plays, line-ups and shots are from the club you pick (the current one by default). The heat map combines all his clubs.')}</Info></span>
        {clubes.length ? [...clubes].reverse().sort((a, b) => Number(b.club === cur) - Number(a.club === cur)).map(c => (
          <button key={c.club} className="jg-chip" aria-pressed={c.club === club_} onClick={() => setClub(c.club)} style={{ ['--hue' as Any]: clubColor(c.club, media) }}>
            <ClubLogo club={c.club} media={media} size={20} />{c.club}<span className="note">{c.partidos} {L('PJ', 'MP')}</span>
            {c.club === cur && <span className="badge-live">{L('actual', 'current')}</span>}
          </button>
        )) : <span className="note">{J === false ? L('Sin datos por club.', 'No club data.') : L('Cargando…', 'Loading…')}</span>}
      </div>

      <h3 className="h2">{L('Jugadas tipo', 'Signature plays')} · {club_} <Info wide><p>{L('Cómo crea peligro este equipo y cómo se para cuando defiende, en el club elegido. Sólo cuentan jugadas efectivas: las que terminan en tiro o llegan al área en juego abierto. Elige un tipo para ver, paso a paso, sus mejores jugadas reales.', 'How this team creates danger and how it sets up when defending, at the chosen club. Only effective moves count: those that end in a shot or reach the box in open play. Pick a type to watch its best real moves, step by step.')}</p><p>{L('Es lo que pasó en sus partidos, así que incluye lo que ponen sus jugadores.', 'This is what happened in his matches, so it includes what his players bring.')}</p></Info></h3>
      {pc && liga ? <JugadasTipo pc={pc} JG={JG} liga={liga} color={cc} media={media} club={club_} /> : loading(JG === false || liga === false)}

      <h3 className="h2">{L('Formaciones', 'Formations')} · {club_} <Info wide>{L(`Los 11 con más minutos en ${club_}${pc ? ` (${pc.partidos} partidos)` : ''}: dónde juegan sobre el papel, dónde se paran con el balón y dónde defienden. Ataca hacia arriba.`, `The 11 players with the most minutes at ${club_}${pc ? ` (${pc.partidos} matches)` : ''}: where they play on paper, where they stand with the ball and where they defend. Attacking upwards.`)}</Info></h3>
      {pc && JG ? <Formaciones F={pc.formaciones} JG={JG} color={cc} club={club_} /> : loading(JG === false)}

      <h3 className="h2">{L('Dónde ocurre', 'Where it happens')}</h3>
      <div className="jg-grid">
        <div className="card jg-heat">
          <div className="h3">{L('Mapa de calor', 'Heat map')} <Info wide><p>{mapLabels[map]} {L('por partido', 'per match')}{mode === 'div' ? L(', comparado con el promedio de la liga', ', compared with the league average') : ''}. {L('Todos sus partidos', 'All his matches')}{total ? ` (${total})` : ''}, {L('en todos sus clubes', 'across all his clubs')}.</p><p>{L('Su equipo ataca hacia arriba. Es lo que pasó en sus partidos: incluye lo que ponen sus jugadores.', 'His team attacks upwards. This is what happened in his matches, so it includes what his players bring.')}</p></Info></div>
          <div className="jg-heat-in">
            <div className="jg-ctrl">
              <span className="jg-ctrl-label">{L('Qué mostrar', 'Show')}</span>
              <Seg opts={[['presion', L('Presión', 'Pressing')], ['recuperaciones', L('Recuperaciones', 'Recoveries')], ['progresion', L('Progresión', 'Progression')]]} v={map} set={setMap} />
              <span className="jg-ctrl-label">{L('Cómo', 'View')}</span>
              <Seg opts={[['div', L('Diferencia vs liga', 'Vs league average')], ['seq', L('Volumen del DT', 'Coach volume')]]} v={mode} set={s => setMode(s as Any)} />
            </div>
            <div className="jg-grow">
              <HeatGrid grid={mode === 'div' ? M[map].dif : M[map].dt} mode={mode} label={mapLabels[map]} unit={mode === 'div' ? L('vs liga, por partido', 'vs league, per match') : L('por partido', 'per match')} color={tc} vertical />
            </div>
          </div>
        </div>
        <div className="card jg-shots">
          <div className="h3">{L('Tiros', 'Shots')} · {club_}</div>
          {J ? <ShotExplorer shots={shots} color={cc} media={media} /> : <div className="note">{J === false ? L('Sin datos.', 'No data.') : L('Cargando…', 'Loading…')}</div>}
        </div>
      </div>

      <h3 className="h2">{L('Huella de estilo', 'Style fingerprint')} <Info wide><p>{L('Su sello en cada aspecto del juego: lo que harían sus equipos con jugadores, club y rivales promedio. Punto a la derecha del centro: más que el DT típico; a la izquierda: menos. Relleno: la diferencia es clara, no ruido. La raya es el margen de error.', 'His mark on every part of the game: what his teams would do with average players, club and opponents. Dot right of center: more than the typical coach; left: less. Filled: the difference is real, not noise. The line is the margin of error.')}</p><p>{L('Centro: el DT típico. Números: lo que se vio en sus partidos / promedio de la liga.', 'Center: the typical coach. Numbers: what we saw in his matches / league average.')}</p></Info></h3>
      <div className="grid2">
        {FAM_ORDER.map(f => {
          const rs = hu.filter((h: Any) => h.familia === f)
          return rs.length ? (
            <div key={f} className="card">
              <div className="h3">{famLabel(f)}</div>
              {rs.map((h: Any) => (
                <div key={h.kpi} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) 1.3fr 90px', gap: 10, alignItems: 'center', padding: '3px 0' }}>
                  <span style={{ fontSize: 13, lineHeight: 1.2 }} title={kpiDesc(h.kpi, glob.kpis[h.kpi].descripcion)}>{kpiLabel(h.kpi, h.etiqueta)}</span>
                  <DotCI v={h.alpha} se={h.se} pctl={h.pct} />
                  <span className="mono" style={{ fontSize: 12, textAlign: 'right' }}>{fmt(h.crudo)} <span style={{ color: 'var(--ink-3)' }}>/ {fmt(h.liga)}</span></span>
                </div>
              ))}
            </div>
          ) : null
        })}
      </div>
    </div>
  )
}

/* ================================================================ CONTEXTO */
