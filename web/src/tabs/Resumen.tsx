import { Fragment, useState } from 'react'
import { fmt, sig, type Any } from '../lib'
import { ClubLogo, PrismDetail, prismSentence } from '../charts'
import { useDistData } from '../Dist'
import { MODES, type TabKey } from '../modes'
import { type P } from './common'
import { LANG, L, LOCALE } from '../settings'
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
  const N = (LANG === 'en' && art.narrativa_en) || art.narrativa
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
        <div><span className="note">{L('Partidos analizados', 'Matches analyzed')}</span><b>{art.partidos_total}</b></div>
        <div><span className="note">{L('Se separa de su plantilla', 'Separation from his squad')}</span><b>{fmt(art.identificabilidad.indice, 0)}<small>/100</small></b></div>
        <div><span className="note">{L('Lo reconocen en otro club', 'Recognized at another club')}</span><b>{best ? <>{L(`${best.rank_ajustado}º`, ordEn(best.rank_ajustado))}<small>{L(` de ${best.n_clases} DTs en ${best.club}`, ` of ${best.n_clases} coaches at ${best.club}`)}</small></> : <small>{L('no aplica: un solo club', 'n/a: only one club')}</small>}</b></div>
        <div><span className="note">{L('Se le reconoce en un partido', 'Recognizable from one match')}</span><b>{art.identidad?.lift ? <>{fmt(art.identidad.lift)}×<small>{L(' más que al azar', ' better than chance')}</small></> : '—'}</b></div>
        <div><span className="note">{L('Puntos sumados', 'Points earned')}</span><b>{S.puntos}<small>{L(` por su juego, ${fmt(S.xpts, 0)}`, ` · his play deserved ${fmt(S.xpts, 0)}`)}</small></b></div>
      </div>

      <p className="eyebrow">{L('Su ADN en pocas palabras', 'His DNA in a nutshell')}</p>
      <h3 className="h2 rs-title">{N.titular.split(': ').slice(1).join(': ') || N.titular}</h3>
      {LANG === 'en'
        ? <p className="lede">What he does with any squad. Each idea shows his numbers, the league's, and where he ranks among the {nDT} coaches.
          <b> His imprint</b> is what his teams would do with average players, an average club and average opponents.</p>
        : <p className="lede">Lo que hace con cualquier plantilla. En cada idea ves sus números, los de la liga y dónde queda entre los {nDT} técnicos.
          <b> Su sello</b> es lo que harían sus equipos con jugadores, club y rivales promedio.</p>}
      {art.partidos_total < 10 && <p className="rs-empty rs-warn">{L(`Con solo ${art.partidos_total} partidos estas ideas son preliminares: el modelo acerca su estilo al promedio hasta tener más datos.`,
        `With only ${art.partidos_total} matches these ideas are preliminary: the model pulls his style toward the average until there is more data.`)}</p>}

      {N.principios.length ? (
        <div className={`rs-principles${N.principios.length === 1 ? ' one' : ''}`} data-n={N.principios.length}>
          {N.principios.map((p: Any, i: number) => (
            <article key={p.titulo} className="rs-pr">
              <span className="rs-pr-n">{L('Idea', 'Idea')} {i + 1}</span>
              <h4>{p.titulo}</h4>
              <p className="rs-pr-desc">{p.descripcion}</p>
              <KpiBell k={p.kpi} art={art} glob={glob} dd={dd} color={DT_BLUE} />
              {att[p.kpi] && (
                <details className="rs-pr-who">
                  <summary><span className="rs-pr-h">{L('Qué parte pone él y qué parte sus jugadores', 'How much comes from him and how much from his players')}</span></summary>
                  <PrismDetail row={att[p.kpi]} />
                  <p className="explain">{prismSentence(att[p.kpi], kName(p.kpi, glob))}</p>
                </details>
              )}
            </article>
          ))}
        </div>
      ) : <p className="rs-empty">{L('Ningún rasgo suyo destaca con claridad: con los datos que hay, su estilo se confunde con el de sus jugadores.', "None of his traits stands out clearly: with the data available, his style blends into his players'.")}</p>}

      <h3 className="h2 rs-h">{L(`La historia en ${secs.length} claves`, `The story in ${secs.length} keys`)}</h3>
      <p className="lede">{L('Toca un dato con flechita para ver dónde queda entre todos los DTs.', 'Tap a stat with an arrow to see where he ranks among all coaches.')}</p>
      <div className="rs-chapters">
        {secs.map(sec => <Chapter key={sec.id} sec={sec} art={art} glob={glob} media={media} dd={dd} open={open} />)}
      </div>
      <p className="note rs-foot">{L(`Todos los números salen de ${glob.muestra.partidos.toLocaleString(LOCALE)} partidos de Liga MX y un solo modelo.`,
        `Every number comes from ${glob.muestra.partidos.toLocaleString(LOCALE)} Liga MX matches and a single model.`)}
        {L(' Para ver de dónde sale cada rasgo, abre', ' To see where each trait comes from, open')} <button className="rs-link" style={{ ['--acc' as string]: '#e0662f' }} onClick={() => open('dt')}>{tabLabel('dt')} →</button></p>
    </div>
  )
}

const NOTE_KIND: Record<string, string> = {
  'lo pone él': 'dt', 'viene de la plantilla': 'squad', 'él y su plantilla': 'both',
  'comes from him': 'dt', 'comes from the squad': 'squad', 'him and his squad': 'both',
}
/** Ordinal en inglés (1st, 2nd, 3rd, 22nd…). */
const ordEn = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`

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
          {hasKpi && <div className="rs-row rs-head" aria-hidden><span /><span>{L('Sus partidos', 'His matches')}</span><span>{L('Comparado con', 'Compared with')}</span><span title={L('Dónde queda su sello (lo que pone él) entre todos los DTs', 'Where his imprint (what he brings) ranks among all coaches')}>{L('Su sello', 'His imprint')}</span></div>}
          {puntos.map((p, i) => {
            if (/^Club(es|s)?$/.test(p.texto) && art.etapas?.length) {
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
                    {pos ? <RankStrip pos={pos} color={S.color} /> : typeof p.efecto === 'number' && !k ? <span className="rs-tech" title={L('En desviaciones estándar respecto a la liga', 'In standard deviations relative to the league')}>{sig(p.efecto)}</span> : null}
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
        {puntos.length > 0 && sec.parrafos.length > 0 && <details className="rs-read"><summary>{L('Leerlo en texto', 'Read it as text')}</summary><div>{sec.parrafos.map((t: string, i: number) => <p key={i}>{t}</p>)}</div></details>}
        <button className="rs-link" onClick={() => open(S.tab)}>{L('Ver en', 'See in')} {tabLabel(S.tab)} →</button>
      </div>
    </article>
  )
}
