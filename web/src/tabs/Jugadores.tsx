import { fmt, jugadorCorto, pct, sig, type Any } from '../lib'
import { DotCI, HBar, PosTag } from '../charts'
import { type P } from './common'

export function Jugadores({ art, glob }: P) {
  const J = art.jugadores
  const forms = Object.entries(J.formaciones as Record<string, number>).sort((a, b) => b[1] - a[1])
  const totF = forms.reduce((s, [, v]) => s + v, 0)
  const mc = J.minuto_cambios, ml = J.minuto_cambios_liga
  return (
    <div>
      <div className="grid3">
        <div className="card"><div className="note">Dibujo más usado</div><div className="big">{forms[0]?.[0].split('').join('-')}</div><div className="note">{pct(100 * (forms[0]?.[1] ?? 0) / totF)} de los partidos · {forms.slice(1, 4).map(([f, v]) => `${f.split('').join('-')} ${pct(100 * v / totF)}`).join(' · ')}</div></div>
        <div className="card"><div className="note">Rotación</div><div className="big">{fmt(J.estabilidad_xi)}</div><div className="note">titulares distintos entre partidos consecutivos</div></div>
        <div className="card"><div className="note">Cambios tácticos por partido</div><div className="big">{fmt(J.cambios_tacticos_por_partido)}</div><div className="note">cambios de dibujo registrados (Tactical Shift)</div></div>
      </div>
      <div className="grid2" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="h3">Minuto mediano de cada cambio</div>
          <HBar items={Object.keys(mc).map(n => ({ label: `${n}º cambio`, v: mc[n], ref: ml[n] }))} max={95} unit="'" compare="mediana de la liga" />
        </div>
        <div className="card">
          <div className="h3">Tipo de cambio según el marcador</div>
          <table className="t"><thead><tr><th></th><th>Más ofensivo</th><th>Misma línea</th><th>Más defensivo</th></tr></thead>
            <tbody>{Object.entries(J.cambios_por_estado).map(([e, v]: Any) => <tr key={e}><td>{e}</td>{['Más ofensivo', 'Misma línea', 'Más defensivo'].map(t => <td key={t} className="num">{v[t]}</td>)}</tr>)}</tbody></table>
        </div>
      </div>
      {art.impacto_cambios?.length ? (
        <>
          <h3 className="h2">Qué cambia cuando mete un cambio</h3>
          <p className="lede">Variación del estilo del segmento anterior al posterior de cada sustitución, menos la variación típica de la liga tras un cambio ({art.impacto_cambios[0].n} cambios).</p>
          <div className="card">
            {art.impacto_cambios.map((r: Any) => (
              <div key={r.kpi} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,240px) 1fr 70px', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>{glob.kpis[r.kpi].etiqueta}</span><DotCI v={r.neto} se={r.se} scale={3} /><span className="mono" style={{ fontSize: 12, textAlign: 'right' }}>{sig(r.neto)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <h3 className="h2">Roles dentro del sistema</h3>
      <p className="lede">Rol espacial por NMF sobre el mapa de calor de acciones (Decroos y Davis, 2019). «Huella» son los tres indicadores de estilo que más mueve el jugador cuando está en cancha (β del modelo, ya descontado el DT).</p>
      <div className="card tbl-wrap">
        <table className="t">
          <thead><tr><th>Jugador</th><th>Posición</th><th>Rol espacial</th><th style={{ textAlign: 'right' }}>Min</th><th style={{ textAlign: 'right' }}>Tit.</th><th>Huella en el estilo</th></tr></thead>
          <tbody>{J.jugadores.slice(0, 30).map((j: Any) => (
            <tr key={j.player_id}><td><b>{jugadorCorto(j.player_id, j.nombre)}</b><div className="note">{j.nombre}</div></td><td className="pos-cell"><PosTag pos={j.posicion} /> <span className="note">{j.posicion}</span></td><td className="note">{j.rol_espacial || '—'}</td><td className="num">{fmt(j.minutos, 0)}</td><td className="num">{j.titularidades}</td>
              <td>{j.huella.map((h: Any) => <span key={h.kpi} className="chip">{glob.kpis[h.kpi].etiqueta} {sig(h.efecto)}</span>)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

/* ================================================================ BALÓN PARADO */
