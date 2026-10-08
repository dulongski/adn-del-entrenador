import { Fragment, useState } from 'react'
import { fmt, sig, type Any } from '../lib'
import { ClubLogo, PrismDetail, prismSentence } from '../charts'
import { useDistData } from '../Dist'
import { MODES, type TabKey } from '../modes'
import { type P } from './common'
import { KpiBell, RankStrip, alphaPos, kName } from './resumenKit'
import '../styles/resumen.css'

/* ================================================================ RESUMEN */
const DT_BLUE = '#3987e5'

// Color, pestaña de destino y orden de cada capítulo (los colores siguen a los modos del perfil).
const SEC: Record<string, { color: string; tab: TabKey }> = {
  identidad: { color: '#3987e5', tab: 'dt' },
  ofensiva: { color: '#1fae7a', tab: 'fases' },
  defensiva: { color: '#2ab3cf', tab: 'fases' },
  dt_vs_plantilla: { color: '#e0662f', tab: 'transfer' },
  contexto: { color: '#e5484d', tab: 'contexto' },
  jugadores: { color: '#e8b10c', tab: 'jugadores' },
  balon_parado: { color: '#de4f87', tab: 'bp' },
  simulacion: { color: '#8f6cf0', tab: 'sim' },
}
const tabLabel = (t: TabKey) => MODES.flatMap(m => m.subs).find(([k]) => k === t)?.[1] ?? t

export function Resumen({ art, glob, media, go }: P & { go: (t: Any) => void }) {
  const N = art.narrativa
  const dd = useDistData()
  const att = Object.fromEntries(art.atribucion.map((a: Any) => [a.kpi, a]))
  const tr = art.transferencia as Any[]
  const best = tr.length ? tr.reduce((a, b) => (a.rank_ajustado <= b.rank_ajustado ? a : b)) : null
  const S = art.simulacion
  const nDT = glob.dts.length
  const open = (t: TabKey) => { go(t); window.scrollTo({ top: 0 }) }
  const secs: Any[] = N.secciones
  return (
    <div className="rs">
      <div className="facts rs-facts">
        <div><span className="note">Partidos analizados</span><b>{art.partidos_total}</b></div>
        <div><span className="note">Se separa de su plantilla</span><b>{fmt(art.identificabilidad.indice, 0)}<small>/100</small></b></div>
        <div><span className="note">Lo reconocen en otro club</span><b>{best ? <>{best.rank_ajustado}º<small> de {best.n_clases} DTs en {best.club}</small></> : <small>no aplica: un solo club</small>}</b></div>
        <div><span className="note">Se le reconoce en un partido</span><b>{art.identidad?.lift ? <>{fmt(art.identidad.lift)}×<small> más que al azar</small></> : '—'}</b></div>
        <div><span className="note">Puntos sumados</span><b>{S.puntos}<small> por su juego, {fmt(S.xpts, 0)}</small></b></div>
      </div>

      <p className="eyebrow">Su ADN en pocas palabras</p>
      <h3 className="h2 rs-title">{N.titular.split(': ').slice(1).join(': ') || N.titular}</h3>
      <p className="lede">Lo que hace con cualquier plantilla. En cada idea ves sus números, los de la liga y dónde queda entre los {nDT} técnicos.
        <b> Su sello</b> es lo que harían sus equipos con jugadores, club y rivales promedio.</p>
      {art.partidos_total < 10 && <p className="rs-empty rs-warn">Con solo {art.partidos_total} partidos estas ideas son preliminares: el modelo acerca su estilo al promedio hasta tener más datos.</p>}

      {N.principios.length ? (
        <div className={`rs-principles${N.principios.length === 1 ? ' one' : ''}`} data-n={N.principios.length}>
          {N.principios.map((p: Any, i: number) => (
            <article key={p.titulo} className="rs-pr">
              <span className="rs-pr-n">Idea {i + 1}</span>
              <h4>{p.titulo}</h4>
              <p className="rs-pr-desc">{p.descripcion}</p>
              <KpiBell k={p.kpi} art={art} glob={glob} dd={dd} color={DT_BLUE} />
              {att[p.kpi] && (
                <details className="rs-pr-who">
                  <summary><span className="rs-pr-h">Qué parte pone él y qué parte sus jugadores</span></summary>
                  <PrismDetail row={att[p.kpi]} />
                  <p className="explain">{prismSentence(att[p.kpi], kName(p.kpi, glob))}</p>
                </details>
              )}
            </article>
          ))}
        </div>
      ) : <p className="rs-empty">Ningún rasgo suyo destaca con claridad: con los datos que hay, su estilo se confunde con el de sus jugadores.</p>}

      <h3 className="h2 rs-h">La historia en {secs.length} claves</h3>
      <p className="lede">Toca un dato con flechita para ver dónde queda entre todos los DTs.</p>
      <div className="rs-chapters">
        {secs.map(sec => <Chapter key={sec.id} sec={sec} art={art} glob={glob} media={media} dd={dd} open={open} />)}
      </div>
      <p className="note rs-foot">Todos los números salen de {glob.muestra.partidos.toLocaleString('es-MX')} partidos de Liga MX y un solo modelo.
        Para ver de dónde sale cada rasgo, abre <button className="rs-link" style={{ ['--acc' as string]: '#e0662f' }} onClick={() => open('dt')}>{tabLabel('dt')} →</button></p>
    </div>
  )
}

const NOTE_KIND: Record<string, string> = { 'lo pone él': 'dt', 'viene de la plantilla': 'squad', 'él y su plantilla': 'both' }

function Chapter({ sec, art, glob, media, dd, open }: { sec: Any; art: Any; glob: Any; media: Any; dd: Any; open: (t: TabKey) => void }) {
  const [openK, setOpenK] = useState<number | null>(null)
  const puntos: Any[] = sec.puntos || []
  const S = SEC[sec.id] ?? { color: DT_BLUE, tab: 'resumen' as TabKey }
  const hasKpi = puntos.some(p => p.kpi)
  return (
    <article className="rs-ch" style={{ ['--acc' as string]: S.color }}>
      <div className="rs-ch-eyebrow">{sec.titulo}</div>
      {sec.idea && <p className="rs-ch-idea">{sec.idea}</p>}
      {puntos.length > 0 && (
        <div className="rs-rows" role="list">
          {hasKpi && <div className="rs-row rs-head" aria-hidden><span /><span>Sus partidos</span><span>Comparado con</span><span title="Dónde queda su sello (lo que pone él) entre todos los DTs">Su sello</span></div>}
          {puntos.map((p, i) => {
            if (/^Club(es)?$/.test(p.texto) && art.etapas?.length) {
              return (
                <div key={i} className="rs-row rs-clubs" role="listitem">
                  <span className="rs-lbl">{p.texto}</span>
                  <span className="rs-clublist">{art.etapas.map((e: Any, j: number) => (
                    <span key={j} className="rs-club"><ClubLogo club={e.club} media={media} size={16} />{e.club}<small>{e.partidos}</small></span>
                  ))}</span>
                </div>
              )
            }
            const k: string | null = p.kpi && dd?.kpis?.[p.kpi] ? p.kpi : null
            const pos = k ? alphaPos(dd, k, art.id) : null
            const isOpen = openK === i
            const toggle = () => k && setOpenK(isOpen ? null : i)
            const dato: string = p.dato ?? ''
            const isNum = /^[\d−+-]/.test(dato)
            const hasEnd = !!pos || typeof p.efecto === 'number'
            const span = !p.liga && !k && !isNum && dato.length > 9 ? (hasEnd ? ' span3' : ' span4') : ''
            // valor de un indicador: número grande y unidad larga debajo, en pequeño
            const unitM = k ? dato.match(/^([\d.,−+-]+)(.*)$/) : null
            const val = unitM && unitM[2].trim().length > 3
              ? <><b>{unitM[1]}</b><small>{unitM[2].trim()}</small></>
              : <b>{dato}</b>
            return (
              <Fragment key={i}>
                <div className={`rs-row${k ? ' click' : ''}${isOpen ? ' open' : ''}${span}`} role="listitem"
                     onClick={toggle} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle())}
                     tabIndex={k ? 0 : undefined} aria-expanded={k ? isOpen : undefined}>
                  <span className="rs-lbl">{p.texto}{p.nota && <span className={`rs-chip ${NOTE_KIND[p.nota] ?? ''}`}>{p.nota}</span>}</span>
                  <span className={`rs-val${isNum ? '' : ' txt'}`}>{val}</span>
                  <span className="rs-ref">{p.liga ?? ''}</span>
                  <span className="rs-end">
                    {pos ? <RankStrip pos={pos} color={S.color} /> : typeof p.efecto === 'number' && !k ? <span className="rs-tech" title="En desviaciones estándar respecto a la liga">{sig(p.efecto)}</span> : null}
                    {k && <span className="rs-caret" aria-hidden>▾</span>}
                  </span>
                </div>
                {isOpen && k && <div className="rs-open"><KpiBell k={k} art={art} glob={glob} dd={dd} color={S.color} compact /></div>}
              </Fragment>
            )
          })}
        </div>
      )}
      {!puntos.length && sec.parrafos.slice(0, 2).map((t: string, i: number) => <p key={i} className="rs-ch-p">{t}</p>)}
      <div className="rs-ch-foot">
        {puntos.length > 0 && sec.parrafos.length > 0 && <details className="rs-read"><summary>Leerlo en texto</summary><div>{sec.parrafos.map((t: string, i: number) => <p key={i}>{t}</p>)}</div></details>}
        <button className="rs-link" onClick={() => open(S.tab)}>Ver en {tabLabel(S.tab)} →</button>
      </div>
    </article>
  )
}
