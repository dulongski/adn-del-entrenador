import { useEffect, useMemo, useState } from 'react'
import { HBar, PosTag } from '../charts'
import { clubColor, dataUrl, fmt, getJSON, jugadorCorto, sig, type Any } from '../lib'
import { type P } from './common'
import { CARRERA, ClubSwitch, dibujo, FormList, OncePitch, OnceList } from './JugOnce'
import { CambiosBells } from './JugCambios'
import '../styles/jugadores.css'
import { L, LANG } from '../settings'
import { kpiLabel, posLabel, td } from '../i18n/data'

/** Rol espacial (NMF) en palabras: "Zona media – carril derecho" -> "En el medio, por la derecha". */
function rolLlano(r?: string | null) {
  if (!r) return '—'
  const m = /Zona (\w+) – carril (\w+)/.exec(r)
  if (!m) return r
  if (LANG === 'en') {
    const z = { defensiva: 'Deep', media: 'Midfield', ofensiva: 'Up front' }[m[1]] ?? m[1]
    const c = { izquierdo: 'on the left', central: 'through the middle', derecho: 'on the right' }[m[2]] ?? m[2]
    return `${z}, ${c}`
  }
  const z = { defensiva: 'Atrás', media: 'En el medio', ofensiva: 'Arriba' }[m[1]] ?? m[1]
  const c = { izquierdo: 'por la izquierda', central: 'por el centro', derecho: 'por la derecha' }[m[2]] ?? m[2]
  return `${z}, ${c}`
}

/** Nombre corto y sin tecnicismos de cada indicador para las fichas de la tabla. */
const CORTO: Record<string, string> = {
  posesion: 'Posesión', salida_corta: 'Salida corta del portero', pase_largo: 'Pase largo', construccion_exito: 'Salida limpia desde atrás',
  pases_por_posesion: 'Pases por jugada', tempo: 'Ritmo de pase', verticalidad: 'Juego directo', progresivos: 'Pases hacia adelante',
  conduccion_prog: 'Avance con el balón', progresion_banda: 'Juego por las bandas', cambios_orientacion: 'Cambios de frente',
  entradas_ultimo_tercio: 'Llegadas al último tercio', xg_90: 'Peligro generado', xg_por_tiro: 'Calidad de los tiros', tiros_90: 'Tiros',
  llegada_area: 'Llegadas al área', centros: 'Centros', obv_90: 'Valor de sus jugadas', ppda: 'Presión', altura_presion: 'Altura de presión',
  presion_alta: 'Presión arriba', intensidad_presion: 'Volumen de presión', contrapresion: 'Presión tras perderla', recuperaciones_altas_90: 'Robos en campo rival',
  altura_defensiva: 'Altura al defender', linea_360: 'Altura de la defensa', compacidad_360: 'Bloque compacto', posesion_rival_dur: 'Recupera rápido',
  xg_contra_90: 'Peligro concedido', contraataque: 'Contraataques', xg_transicion: 'Peligro al contragolpe', transicion_def: 'Contras recibidas',
  field_tilt: 'Juego en campo rival', xg_balon_parado_90: 'Peligro a balón parado',
}
const CORTO_EN: Record<string, string> = {
  posesion: 'Possession', salida_corta: 'Short goal kicks', pase_largo: 'Long balls', construccion_exito: 'Clean build-up',
  pases_por_posesion: 'Passes per move', tempo: 'Passing tempo', verticalidad: 'Direct play', progresivos: 'Forward passes',
  conduccion_prog: 'Ball carrying', progresion_banda: 'Wing play', cambios_orientacion: 'Switches of play',
  entradas_ultimo_tercio: 'Final-third entries', xg_90: 'Chances created', xg_por_tiro: 'Shot quality', tiros_90: 'Shots',
  llegada_area: 'Box entries', centros: 'Crosses', obv_90: 'Value of his actions', ppda: 'Pressing', altura_presion: 'Pressing height',
  presion_alta: 'High press', intensidad_presion: 'Pressing volume', contrapresion: 'Counter-press', recuperaciones_altas_90: 'High turnovers',
  altura_defensiva: 'Defending height', linea_360: 'Defensive line height', compacidad_360: 'Compact block', posesion_rival_dur: 'Wins it back fast',
  xg_contra_90: 'Chances conceded', contraataque: 'Counter-attacks', xg_transicion: 'Danger on the break', transicion_def: 'Counters faced',
  field_tilt: 'Territory', xg_balon_parado_90: 'Set-piece danger',
}
/** En estos, un valor menor significa "más" de lo que dice la etiqueta corta. */
const INV = new Set(['ppda', 'compacidad_360', 'posesion_rival_dur'])
function huellaChip(kpi: string, efecto: number, glob: Any) {
  const inv = INV.has(kpi) ? -1 : 1
  const full = glob.kpis[kpi]?.etiqueta ? kpiLabel(kpi, glob.kpis[kpi].etiqueta) : kpi
  const lbl = (LANG === 'en' ? CORTO_EN[kpi] : CORTO[kpi]) ?? full.replace(/\s*\(.*\)$/, '')
  return { up: inv * efecto > 0, lbl, title: L(`${full}: ${sig(efecto)} cuando juega (ya descontado el DT)`, `${full}: ${sig(efecto)} when he plays (coach effect already removed)`) }
}

export function Jugadores({ art, glob, media }: P) {
  const J = art.jugadores
  const [X, setX] = useState<Any>(null)
  const [pick, setPick] = useState<{ id: number; club: string } | null>(null)
  const [allRows, setAllRows] = useState(false)
  useEffect(() => { setX(null); getJSON(dataUrl(`jugadores_${art.id}.json`)).then(setX).catch(() => setX(false)) }, [art.id])

  const actual: string | null = useMemo(() => {
    if (!X) return null
    const c = media?.dts?.[art.id]?.club
    if (c && X.clubes.includes(c)) return c
    const last = art.etapas?.[art.etapas.length - 1]?.club
    return last && X.clubes.includes(last) ? last : X.clubes[0]
  }, [X, media, art])
  const clubes: string[] = X ? [actual!, ...X.clubes.filter((c: string) => c !== actual)] : []
  const club = pick && pick.id === art.id && (pick.club === CARRERA || clubes.includes(pick.club)) ? pick.club : actual
  const sel = X ? (club === CARRERA || !club ? X.carrera : X.por_club[club]) : null
  const color = club && club !== CARRERA ? clubColor(club, media) : 'var(--c-dt)'
  const setClub = (c: string) => setPick({ id: art.id, club: c })
  const byId = useMemo(() => Object.fromEntries((J.jugadores as Any[]).map(j => [j.player_id, j])), [J])

  const mc = J.minuto_cambios, ml = J.minuto_cambios_liga
  const tabla: Any[] = sel ? sel.jugadores.map(([id, min, tit, pos]: Any[]) => ({ id, min, tit, pos, j: byId[id] })) : []
  const quien = club === CARRERA ? L('en toda su carrera', 'across his whole career') : L(`en ${club}`, `at ${club}`)
  const switcher = X && sel ? <ClubSwitch clubes={clubes} value={club!} set={setClub} media={media}
    partidos={Object.fromEntries(clubes.map(c => [c, X.por_club[c].partidos]))} carrera={X.carrera.partidos} /> : null

  return (
    <div className="jg">
      <h3 className="h2">{L('Su once y su dibujo', 'His XI and formation')}</h3>
      <p className="lede">{L('Cómo para al equipo desde el arranque y cuánto toca el once. Elige un club o mira toda su carrera.', 'How he lines the team up from kick-off and how much he tinkers with the XI. Pick a club or view his whole career.')}</p>
      {X === false && <div className="card note">{L('No se pudieron cargar las alineaciones de este DT.', 'Couldn\'t load this coach\'s line-ups.')}</div>}
      {X === null && <div className="card note">{L('Cargando alineaciones…', 'Loading line-ups…')}</div>}
      {sel && (
        <>
          {switcher}
          {sel.partidos < 8 && <p className="note jg-warn">{L(`Sólo ${sel.partidos} partidos ${quien}: tómalo como una primera impresión.`, `Only ${sel.partidos} ${sel.partidos === 1 ? 'match' : 'matches'} ${quien}: treat it as a first impression.`)}</p>}
          <div className="jg-top">
            <div className="card jg-pitch-card">
              <OncePitch sel={sel} club={club === CARRERA ? null : club} media={media} />
            </div>
            <div className="jg-side">
              <div className="card">
                <div className="note">{L('Dibujo inicial más usado', 'Most used starting formation')} {quien}</div>
                <div className="big" style={{ color }}>{dibujo(sel.dibujo)}</div>
                <div className="note jg-gap">{L(`Arrancó así ${sel.partidos_dibujo} de ${sel.partidos} partidos.`, `Started this way in ${sel.partidos_dibujo} of ${sel.partidos} matches.`)}</div>
                <FormList forms={sel.formaciones} total={sel.partidos} color={color} />
              </div>
              <div className="jg-pair">
                <div className="card">
                  <div className="note">{L('Rotación del once', 'XI rotation')}</div>
                  <div className="big">{fmt(sel.rotacion)}</div>
                  <div className="jg-txt">{L('titulares cambia en promedio de un partido al siguiente.', 'starters changed on average from one match to the next.')}</div>
                  <div className="note">{L('El DT típico cambia', 'The typical coach changes')} {fmt(X.mediana_dts.rotacion)}.</div>
                </div>
                <div className="card">
                  <div className="note">{L('Cambios de dibujo en el partido', 'In-game formation changes')}</div>
                  <div className="big">{fmt(sel.cambios_dibujo)}</div>
                  <div className="jg-txt">{L('veces por partido cambia el dibujo con el partido en marcha.', 'times per match he switches shape mid-game.')}</div>
                  <div className="note">{L(`El DT típico lo hace ${fmt(X.mediana_dts.cambios_dibujo)} veces.`, `The typical coach does it ${fmt(X.mediana_dts.cambios_dibujo)} times.`)}</div>
                </div>
              </div>
              <div className="card jg-xi-card">
                <div className="note">{L(`Los fijos del ${dibujo(sel.dibujo)}: veces que arrancó cada uno con ese dibujo`, `Regulars in the ${dibujo(sel.dibujo)}: starts for each player in that formation`)}</div>
                <OnceList sel={sel} color={color} />
              </div>
            </div>
          </div>
        </>
      )}

      <h3 className="h2">{L('Sus cambios', 'His substitutions')}</h3>
      <p className="lede">{L('Cuándo mete los cambios, de qué tipo según cómo va el partido y qué le pasa a su equipo después. Toda su carrera.', 'When he makes his subs, what kind depending on the score, and what happens to his team afterwards. Whole career.')}</p>
      <div className="grid2">
        <div className="card">
          <div className="h3">{L('En qué minuto hace cada cambio', 'When each sub comes on')}</div>
          <div className="jg-hbar"><HBar items={Object.keys(mc).map(n => ({ label: L(`${n}º cambio`, `Sub ${n}`), v: mc[n], ref: ml[n] }))} max={95} unit="'" /></div>
          <div className="note">{L('Minuto típico de cada cambio. La raya marca lo habitual en la liga.', 'Typical minute of each sub. The tick marks the league norm.')}</div>
        </div>
        <div className="card">
          <div className="h3">{L('Qué tipo de cambio hace según el marcador', 'Type of sub by scoreline')}</div>
          <table className="t jg-tipo"><thead><tr><th></th><th>{L('Más ofensivo', 'More attacking')}</th><th>{L('Mismo puesto', 'Same role')}</th><th>{L('Más defensivo', 'More defensive')}</th></tr></thead>
            <tbody>{Object.entries(J.cambios_por_estado).map(([e, v]: Any) => {
              const tot = ['Más ofensivo', 'Misma línea', 'Más defensivo'].reduce((s, t) => s + v[t], 0) || 1
              const mx = Math.max(v['Más ofensivo'], v['Misma línea'], v['Más defensivo'])
              return <tr key={e}><td>{td(e)}</td>{['Más ofensivo', 'Misma línea', 'Más defensivo'].map(t => (
                <td key={t} className={`num${v[t] === mx && mx > 0 ? ' jg-max' : ''}`}>{v[t]}<small> · {fmt(100 * v[t] / tot, 0)}%</small></td>))}</tr>
            })}</tbody></table>
          <div className="note">{L('Cambios de toda su carrera. «Más ofensivo»: entra alguien que juega más adelante que el que sale.', 'Subs across his whole career. “More attacking”: the player coming on plays further forward than the one going off.')}</div>
        </div>
      </div>

      <h3 className="h3 jg-sub">{L('Qué le pasa a su equipo después de un cambio', 'What happens to his team after a sub')}</h3>
      <p className="lede">{L('Cada punto es un DT de la liga; el resaltado es él. A la derecha, más de lo que dice el título. Primero lo que más lo distingue', 'Each dot is a league coach; the highlighted one is him. Further right means more of what the title says. What sets him apart most comes first')}{art.impacto_cambios?.length ? ` (${art.impacto_cambios[0].n} ${L('cambios', 'subs')})` : ''}.</p>
      <CambiosBells art={art} glob={glob} />

      <h3 className="h2">{L('Quién juega y dónde', 'Who plays where')}</h3>
      <p className="lede">{L(`Los jugadores que más usó ${quien}: por dónde se mueven en la cancha y qué cambia en el equipo cuando están en ella.`, `The players he used most ${quien}: where they move on the pitch and what changes for the team when they're on it.`)}</p>
      {switcher && clubes.length > 1 && <div className="jg-switch-again">{switcher}</div>}
      {sel && (
        <div className="card tbl-wrap">
          <table className="t jg-roles">
            <thead><tr><th>{L('Jugador', 'Player')}</th><th>{L('Posición', 'Position')}</th><th>{L('Por dónde se mueve', 'Where he moves')}</th><th style={{ textAlign: 'right' }}>{L('Minutos', 'Minutes')}</th><th style={{ textAlign: 'right' }}>{L('Titular', 'Starts')}</th><th>{L('Con él en la cancha el equipo…', 'With him on the pitch, the team…')}</th></tr></thead>
            <tbody>{(allRows ? tabla : tabla.slice(0, 18)).map(r => (
              <tr key={r.id}>
                <td><b>{jugadorCorto(r.id, r.j?.nombre ?? '')}</b><div className="note jg-full">{r.j?.nombre}</div><div className="note jg-mob">{fmt(r.min, 0)} min · {r.tit} {L('de titular', r.tit === 1 ? 'start' : 'starts')} · {rolLlano(r.j?.rol_espacial).toLowerCase()}</div></td>
                <td className="pos-cell"><PosTag pos={r.pos} /> <span className="note">{posLabel(r.pos)}</span></td>
                <td className="note">{rolLlano(r.j?.rol_espacial)}</td>
                <td className="num">{fmt(r.min, 0)}</td><td className="num">{r.tit}</td>
                <td>{(r.j?.huella ?? []).map((h: Any) => { const c = huellaChip(h.kpi, h.efecto, glob); return <span key={h.kpi} className={`chip jg-chip ${c.up ? 'up' : 'down'}`} title={c.title}>{c.up ? '▲' : '▼'} {c.lbl}</span> })}</td>
              </tr>
            ))}</tbody>
          </table>
          {tabla.length > 18 && <button className="jg-more" onClick={() => setAllRows(a => !a)}>{allRows ? L('Ver menos', 'Show fewer') : L(`Ver los ${tabla.length} jugadores`, `Show all ${tabla.length} players`)}</button>}
          <div className="note jg-gap">{L('▲ / ▼: lo que más sube o baja en el juego del equipo cuando él está en la cancha, ya descontado lo que pone el DT. Pasa el cursor para ver el detalle.', '▲ / ▼: what rises or drops most in the team\'s game when he\'s on the pitch, with the coach\'s effect already removed. Hover for details.')}</div>
        </div>
      )}
    </div>
  )
}

/* ================================================================ BALÓN PARADO */
