import { useState } from 'react'
import { ClubLogo } from '../charts'
import { shortName, type Any } from '../lib'
import { apellido, famHue, useWidth } from './util'

/** Mapa de estilos reducido: ejes con su significado, hover sobre cualquier DT y clic para elegirlo como rival. */
export default function StyleMini({ mapa, media, A, B, ca, cb, onPick }: { mapa: Any; media: Any; A: Any; B: Any; ca: string; cb: string; onPick: (id: number) => void }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [hov, setHov] = useState<number | null>(null)
  const narrow = W < 520
  const foot = narrow ? 34 : 20                // filas para las etiquetas del eje X, debajo del mapa
  const H = Math.round(Math.max(300, Math.min(420, W * 0.68)))
  const pad = 22, top = 24, bottom = H - foot - 22
  const xs = mapa.puntos.map((p: Any) => p.x), ys = mapa.puntos.map((p: Any) => p.y)
  const ax = Math.max(Math.abs(Math.min(...xs)), Math.abs(Math.max(...xs))) * 1.08
  const ay = Math.max(Math.abs(Math.min(...ys)), Math.abs(Math.max(...ys))) * 1.12
  const X = (x: number) => pad + ((x + ax) / (2 * ax)) * (W - 2 * pad)
  const Y = (y: number) => top + 6 + ((ay - y) / (2 * ay)) * (bottom - top - 12)
  const e = mapa.ejes
  const hp = hov != null ? mapa.puntos.find((p: Any) => p.id === hov) : null
  const club = (p: Any) => media.dts[p.id]?.club ?? p.clubes.at(-1)
  const cx0 = X(0), cy0 = Y(0)

  return (
    <div className="vs-sm" ref={ref}>
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={`Mapa de estilos: ${A.nombre} y ${B.nombre}`} onMouseLeave={() => setHov(null)}>
          <defs>
            <marker id="vs-sm-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)" />
            </marker>
          </defs>
          <line x1={6} x2={W - 6} y1={cy0} y2={cy0} stroke="var(--ink-3)" strokeOpacity={0.45} markerStart="url(#vs-sm-arr)" markerEnd="url(#vs-sm-arr)" />
          <line x1={cx0} x2={cx0} y1={top - 4} y2={bottom + 4} stroke="var(--ink-3)" strokeOpacity={0.45} markerStart="url(#vs-sm-arr)" markerEnd="url(#vs-sm-arr)" />
          <text className="vs-sm-ax" x={cx0} y={12} textAnchor="middle">↑ {e.y.positivo}</text>
          <text className="vs-sm-ax" x={cx0} y={bottom + 18} textAnchor="middle">↓ {e.y.negativo}</text>
          <text className="vs-sm-ax" x={W - 4} y={H - (narrow ? 18 : 4)} textAnchor="end">{e.x.positivo} →</text>
          <text className="vs-sm-ax" x={4} y={H - 4}>← {e.x.negativo}</text>
          <line x1={X(A.x)} y1={Y(A.y)} x2={X(B.x)} y2={Y(B.y)} stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="5 4" />
          {mapa.puntos.filter((p: Any) => p.id !== A.id && p.id !== B.id).map((p: Any) => (
            <g key={p.id} className="vs-sm-pt" onMouseEnter={() => setHov(p.id)} onClick={() => onPick(p.id)}>
              <circle cx={X(p.x)} cy={Y(p.y)} r={10} fill="transparent" />
              <circle cx={X(p.x)} cy={Y(p.y)} r={hov === p.id ? 6 : 3.6} fill={hov === p.id ? famHue(p.grupo) : 'var(--ink-3)'} opacity={hov === p.id ? 1 : 0.5}
                      stroke={hov === p.id ? 'var(--surface)' : 'none'} strokeWidth={2} />
            </g>
          ))}
          {[[B, cb], [A, ca]].map(([p, c]: Any) => {
            // si quedan muy cerca, el de más abajo lleva su nombre debajo del punto
            const close = Math.hypot(X(A.x) - X(B.x), Y(A.y) - Y(B.y)) < 70
            const other = p.id === A.id ? B : A
            const below = close && Y(p.y) >= Y(other.y)
            return (
            <g key={p.id} onMouseEnter={() => setHov(null)}>
              <circle cx={X(p.x)} cy={Y(p.y)} r={9} fill={c} stroke="var(--surface)" strokeWidth={2.5} />
              <text x={X(p.x)} y={below ? Y(p.y) + 24 : Y(p.y) - 14} fontSize={13} fontWeight={700} textAnchor={X(p.x) < 50 ? 'start' : X(p.x) > W - 50 ? 'end' : 'middle'}
                    fill="var(--ink)" stroke="var(--surface)" strokeWidth={3.5} paintOrder="stroke">{apellido(shortName(p.nombre))}</text>
            </g>
          )})}
        </svg>
      )}
      {hp && (
        <div className="vs-sm-tip" style={{ left: Math.min(W - 8, Math.max(8, X(hp.x))), top: Y(hp.y) - 12, transform: `translate(${X(hp.x) < 110 ? '0' : X(hp.x) > W - 110 ? '-100%' : '-50%'}, -100%)` }}>
          {club(hp) && <ClubLogo club={club(hp)} media={media} size={18} />}
          <span><b>{shortName(hp.nombre)}</b><span className="vs-sm-tip-s">{mapa.grupos.find((g: Any) => g.id === hp.grupo)?.nombre} · clic para comparar</span></span>
        </div>
      )}
    </div>
  )
}
