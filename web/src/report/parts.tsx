import type { ReactNode } from 'react'
import { asset, fmt } from '../lib'
import { L } from '../settings'
import { apellido } from '../compare/util'
import { nombreDT } from '../lib'
import type { RD } from './data'

/* Piezas comunes de las páginas del informe (A4 horizontal, 1123 × 794 px). */
export const Img = ({ src, size, round, alt = '' }: { src?: string | null; size: number; round?: boolean; alt?: string }) =>
  src ? <img src={asset(src)!} alt={alt} width={size} height={size} style={{ width: size, height: size, objectFit: 'cover', borderRadius: round ? '50%' : 0, display: 'block' }} /> : <span style={{ width: size, height: size, borderRadius: round ? '50%' : 4, background: 'var(--surface-2)', display: 'block' }} />

export const Logo = ({ rd, club, size = 20 }: { rd: RD; club: string; size?: number }) => {
  const s = rd.media?.clubes?.[club]?.logo
  return s ? <img src={asset(s)!} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: 'contain', display: 'block', flex: 'none' }} /> : <span className="rp-logo-fb" style={{ width: size, height: size, fontSize: size * 0.42 }}>{club.slice(0, 2).toUpperCase()}</span>
}

export const coachNames = (rd: RD) => { const nm = nombreDT(rd.art.id, rd.art.nombre); return nm ? { first: nm.nombres, last: nm.apellidos } : { first: '', last: rd.art.nombre } }

export function Frame({ rd, mode, color, title, sub, n, total, children }: { rd: RD; mode: string; color: string; title: string; sub?: string; n: number; total: number; children: ReactNode }) {
  const { last } = coachNames(rd)
  return (
    <section className="rp-page" style={{ ['--mc' as string]: color }}>
      <div className="rp-top" />
      <header className="rp-head">
        <div className="rp-brand"><i /><b>COACH</b><b className="g">DNA</b></div>
        <div className="rp-mode"><span style={{ background: color }} />{mode}</div>
        <div className="rp-who"><Img src={rd.media.dts?.[rd.art.id]?.foto} size={30} round /><span><b>{apellido(rd.art.nombre) === last ? last : last}</b><small>{rd.club}</small></span></div>
      </header>
      <div className="rp-title"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      <div className="rp-body">{children}</div>
      <footer className="rp-foot"><span>{L('Datos StatsBomb · Liga MX 2021/22 – 2026/27 · estilo propio = lo que queda al quitar plantilla, club y rival', 'StatsBomb data · Liga MX 2021/22 – 2026/27 · own style = what is left after removing squad, club and opponent')}</span><b>{n} / {total}</b></footer>
    </section>
  )
}

export const Tile = ({ k, v, s, color }: { k: string; v: ReactNode; s?: ReactNode; color?: string }) => (
  <div className="rp-tile" style={color ? { ['--tc' as string]: color } : undefined}><span>{k}</span><b>{v}</b>{s && <small>{s}</small>}</div>
)

/** Barra con marca de la liga: valor vs raya. */
export const Bar = ({ v, lg, max, color = 'var(--mc)', label }: { v: number; lg?: number | null; max: number; color?: string; label?: ReactNode }) => (
  <div className="rp-bar"><i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} />{lg != null && <u style={{ left: `${Math.min(100, (lg / max) * 100)}%` }} />}{label && <em>{label}</em>}</div>
)

/** Pista de percentil 0–100 con punto. */
export const Track = ({ p, color = 'var(--mc)' }: { p: number | null | undefined; color?: string }) => (
  <div className="rp-track"><i /><u /><b style={{ left: `${Math.max(2, Math.min(98, p ?? 50))}%`, background: color }} /></div>
)

export const pctTxt = (p: number | null | undefined) => (p == null ? '' : L(`más alto que el ${fmt(p, 0)}% de los DTs`, `higher than ${fmt(p, 0)}% of coaches`))
