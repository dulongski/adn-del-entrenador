import { useEffect, useMemo, useState } from 'react'
import { ClubLogo } from '../charts'
import Info from '../Info'
import { dataUrl, divColor, fmt, getJSON, type Any } from '../lib'
import { L } from '../settings'
import { KEY, Seg } from './common'
import { Evolution } from './Contexto'
import { kName } from './resumenKit'
import '../styles/tl.css'
import '../styles/plan.css'

/* A lo largo del tiempo (pipeline/tiempo.py → tiempo.json): su estilo propio torneo a torneo,
   qué tan estable es su identidad frente a los demás DTs, cambios claros y de club a club. */

export function useTiempo(id: number) {
  const [d, setD] = useState<Any>(null)
  useEffect(() => { setD(null); getJSON(dataUrl('tiempo.json')).then(t => setD(t.dts?.[String(id)] ? { ...t.dts[String(id)], kpis: t.kpis, liga: t.liga } : false)).catch(() => setD(false)) }, [id])
  return d
}

const tname = (id: string) => L(id.startsWith('A') ? `Apertura ${2000 + Number(id.slice(1))}` : `Clausura ${2000 + Number(id.slice(1))}`, id.startsWith('A') ? `Apertura ${2000 + Number(id.slice(1))}` : `Clausura ${2000 + Number(id.slice(1))}`)

export function Tiempo({ art, glob, media }: { art: Any; glob: Any; media: Any }) {
  const d = useTiempo(art.id)
  const [todos, setTodos] = useState(false)
  const [k, setK] = useState('posesion')
  const rows = useMemo(() => {
    if (!d) return []
    const K: string[] = d.kpis
    const car = d.ultimos.carrera as Record<string, number>
    const idx = K.map((kk, i) => ({ kk, i, c: car[kk] ?? 0 })).sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
    return todos ? idx : idx.slice(0, 10)
  }, [d, todos])
  if (d === false) return <div className="card note">{L('Pocos partidos para ver su evolución.', 'Too few matches to show his evolution.')}</div>
  if (!d) return <div className="card note">{L('Cargando…', 'Loading…')}</div>
  const T: Any[] = d.torneos
  const id = d.identidad
  const nombre = art.nombre.split(' ')[0]
  const maxR = 1
  const base = d.liga.base_mediana ?? 0
  return (
    <div className="pl">
      <div className="pl-lead">
        <h3 className="h2">{L('¿Mantiene su identidad con el tiempo?', 'Does he keep his identity over time?')}
          <Info wide><p>{L('Cada partido se mide sin lo que ponen sus jugadores, el club, el rival y el contexto. Luego se promedia por torneo (Apertura: julio a diciembre; Clausura: enero a junio), contando sólo los torneos con al menos 5 partidos.', 'Each match is measured without what his players, club, opponent and context bring. Then it is averaged by tournament (Apertura: July to December; Clausura: January to June), counting only tournaments with at least 5 matches.')}</p>
            <p>{L('Estabilidad: correlación entre su perfil de cada torneo (34 rasgos) y el de todo el resto de su carrera. 1 = idéntico, 0 = nada que ver. Para comparar, también se mide qué tanto se parece cada torneo suyo al de otro entrenador cualquiera.', 'Stability: correlation between his profile in each tournament (34 traits) and that of the rest of his career. 1 = identical, 0 = unrelated. For reference, we also measure how much each of his tournaments resembles another coach.')}</p></Info></h3>
        <p className="note">{L(`${T.length} torneos con al menos 5 partidos.`, `${T.length} tournaments with at least 5 matches.`)}</p>
      </div>
      <div className="tl-kpis">
        <div className="tl-kpi"><span className="note">{L('Estabilidad de su estilo', 'Style stability')}</span><b>{id.r != null ? fmt(id.r, 2) : '—'}</b><small>{id.pct != null ? L(`más estable que el ${fmt(id.pct, 0)}% de los ${id.n_dts} DTs`, `more stable than ${fmt(id.pct, 0)}% of ${id.n_dts} coaches`) : L('hace falta más de un torneo', 'needs more than one tournament')}</small></div>
        <div className="tl-kpi"><span className="note">{L('Parecido con otro DT cualquiera', 'Similarity to any other coach')}</span><b>{fmt(id.base ?? 0, 2)}</b><small>{L('la referencia: lo que se parecería por azar', 'the baseline: what chance would give')}</small></div>
        <div className="tl-kpi"><span className="note">{L('Cambios claros entre torneos', 'Clear changes between tournaments')}</span><b>{d.cambios.length}</b><small>{L('con control de falsos positivos (10%)', 'with false-positive control (10%)')}</small></div>
        <div className="tl-kpi"><span className="note">{L('Mediana de la liga', 'League median')}</span><b>{fmt(d.liga.r_mediana, 2)}</b><small>{L(`la mitad central de los DTs entre ${fmt(d.liga.r_p25, 2)} y ${fmt(d.liga.r_p75, 2)}`, `middle half of coaches between ${fmt(d.liga.r_p25, 2)} and ${fmt(d.liga.r_p75, 2)}`)}</small></div>
      </div>

      <div className="card">
        <div className="tl-h"><b>{L('Su estilo propio, torneo a torneo', 'His own style, tournament by tournament')}</b>
          <Info wide>{L('Cada celda: su valor en ese torneo, en desviaciones típicas frente a la liga (verde = más que la liga, rojo = menos). La primera columna es su carrera. Celdas tenues: torneos con menos de 10 partidos.', 'Each cell: his value in that tournament, in standard deviations versus the league (green = more than the league, red = less). The first column is his career. Faint cells: tournaments with fewer than 10 matches.')}</Info>
          <span style={{ marginLeft: 'auto' }}><Seg opts={[['10', L('Sus 10 rasgos más marcados', 'His 10 most distinctive'), ''], ['todos', L('Los 34', 'All 34'), '']]} v={todos ? 'todos' : '10'} set={v => setTodos(v === 'todos')} /></span></div>
        <div className="ti-heat">
          <table className="ti-tbl">
            <thead><tr><th className="l" /><th>{L('Carrera', 'Career')}</th>{T.map(t => <th key={t.id} title={`${tname(t.id)} · ${t.club} · ${t.n} ${L('partidos', 'matches')}`}><span className="ti-th"><ClubLogo club={t.club} media={media} size={16} />{t.id}</span></th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.kk}>
                  <td className="l">{kName(r.kk, glob)}</td>
                  <td className="car" style={{ background: divColor(r.c, 1.5) }}>{r.c >= 0 ? '+' : '−'}{fmt(Math.abs(r.c), 1)}</td>
                  {T.map((t, j) => { const v = d.m[j][r.i]; return <td key={t.id} className={t.n < 10 ? 'weak' : ''} style={{ background: divColor(v ?? 0, 1.5) }} title={`${tname(t.id)} · ±${fmt(d.se[j][r.i], 2)}`}>{v == null ? '' : `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), 1)}`}</td> })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tl-grid">
        <div className="card">
          <div className="tl-h"><b>{L('Qué tanto se parece cada torneo al resto de su carrera', 'How much each tournament resembles the rest of his career')}</b></div>
          <p className="note">{L(`1 = idéntico. La línea punteada (${fmt(base, 2)}) es lo que se parece a otro DT cualquiera.`, `1 = identical. The dotted line (${fmt(base, 2)}) is how much it resembles any other coach.`)}</p>
          <div className="ti-bars">
            <div className="ti-base" style={{ bottom: `${20 + (Math.max(0, base) / maxR) * 130}px` }} title={L('otro DT cualquiera', 'any other coach')} />
            {T.map((t, j) => { const r = d.perfil_r[j]; return (
              <div key={t.id} className="ti-b" title={`${tname(t.id)} · ${t.club}`}>
                <b>{r == null ? '—' : fmt(r, 2)}</b>
                <i style={{ height: `${Math.max(2, ((r ?? 0) / maxR) * 130)}px`, opacity: t.n < 10 ? 0.5 : 1 }} />
                <small>{t.id}</small>
              </div>) })}
          </div>
        </div>
        <div className="card">
          <div className="tl-h"><b>{L('Cambios claros', 'Clear changes')}</b><Info>{L('Rasgos que cambian entre dos torneos seguidos más de lo que explicaría el azar (prueba z, con control de falsos positivos de Benjamini–Hochberg al 10% entre todas sus comparaciones).', 'Traits that change between two consecutive tournaments more than chance would explain (z-test, with Benjamini–Hochberg false-positive control at 10% across all his comparisons).')}</Info></div>
          {d.cambios.length === 0 ? <p className="note">{L(`Ningún cambio supera al azar: ${nombre} jugó igual torneo a torneo. Las diferencias que se ven en la tabla son del tamaño del ruido de un torneo.`, `No change beats chance: ${nombre} played the same way tournament after tournament. The differences in the table are the size of one tournament's noise.`)}</p> : (
            <div className="ti-list">{d.cambios.map((c: Any, i: number) => (
              <div key={i} className="ti-ch"><span><b>{kName(c.kpi, glob)}</b><br /><small>{tname(c.de)} → {tname(c.a)}{c.club_de !== c.club_a ? ` · ${c.club_de} → ${c.club_a}` : ''}</small></span>
                <em className={c.dif >= 0 ? 'up' : 'dn'}>{c.dif >= 0 ? '+' : '−'}{fmt(Math.abs(c.dif), 1)}σ</em><small>z {fmt(c.z, 1)}</small></div>))}</div>
          )}
          {d.clubes.length > 0 && <>
            <div className="tl-h" style={{ marginTop: 16 }}><b>{L('De un club a otro', 'From one club to the next')}</b></div>
            <div className="ti-clubs">{d.clubes.map((c: Any, i: number) => (
              <div key={i}>
                <div className="ti-club"><ClubLogo club={c.de} media={media} size={18} />{c.de} → <ClubLogo club={c.a} media={media} size={18} />{c.a}<b className="r">{fmt(c.r, 2)}</b><span className="note">{L('de parecido entre los dos perfiles', 'similarity between both profiles')}</span></div>
                {c.cambios.length > 0 ? <p className="note">{L('Lo que más cambió: ', 'What changed most: ')}{c.cambios.map((x: Any) => `${kName(x.kpi, glob)} (${x.dif >= 0 ? '+' : '−'}${fmt(Math.abs(x.dif), 1)}σ)`).join(' · ')}</p> : <p className="note">{L('Ningún rasgo cambió de forma clara al cambiar de club.', 'No trait changed clearly when he changed clubs.')}</p>}
              </div>))}</div>
          </>}
        </div>
      </div>

      {d.estables.length > 0 && <div className="card">
        <div className="tl-h"><b>{L('Sus rasgos más marcados: ¿en cuántos torneos aparecen?', 'His most distinctive traits: in how many tournaments do they show up?')}</b></div>
        <div className="ti-list">{d.estables.map((e: Any) => (
          <div key={e.kpi} className="ti-ch"><span><b>{kName(e.kpi, glob)}</b> <small>{e.carrera >= 0 ? L('más que la liga', 'more than the league') : L('menos que la liga', 'less than the league')}</small></span>
            <em className={e.carrera >= 0 ? 'up' : 'dn'}>{e.carrera >= 0 ? '+' : '−'}{fmt(Math.abs(e.carrera), 1)}σ</em><small>{L(`mismo lado en el ${fmt(e.mismo_lado, 0)}% de ${e.torneos} torneos`, `same side in ${fmt(e.mismo_lado, 0)}% of ${e.torneos} tournaments`)}</small></div>))}</div>
      </div>}

      <h3 className="h2">{L('Partido a partido', 'Match by match')} <Info>{L('Cada punto es un partido (sin el efecto de sus jugadores); la línea es el promedio de los últimos 5. El color indica el club.', 'Each dot is a match (with his players\' effect removed); the line is the average of the last 5. Colour shows the club.')}</Info></h3>
      <Seg opts={KEY.slice(0, 8).map(x => [x, kName(x, glob)] as [string, string])} v={k} set={setK} />
      <Evolution rows={art.contexto.evolucion} k={k} etapas={art.etapas ?? []} />
    </div>
  )
}
