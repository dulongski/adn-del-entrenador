/* Datos y constructor del torneo compartidos por el simulador de liga y por Golito. */
import { dataUrl, getJSON, type Any } from '../lib'
import { buildTeam, type Liga, type Team } from './engine'
import { Season } from './season'
import { loadStyle, type StyleX } from './styleModel'

export type Form = { att: number; def: number; n: number; sf: number; sc: number }
export type Pack = { wi: Any; sx: StyleX; ls: { liga: Liga; jugadores: Any; real?: Any }; real: { h: string; a: string; gh: number; ga: number; r: number }[]; cal: Any[]; lastRound: number; form: Record<string, Form> }

/* Forma reciente: cuánto pesa el último mes frente a todo el torneo (0 = nada, 1 = sólo el último mes).
   Se mide con goles y xG (mitad y mitad) a favor y en contra por partido, y se acota a ±FORM_MAX. */
export const FORM_W = 0.3, FORM_DAYS = 30, FORM_MIN = 3, FORM_MAX = 0.1
/* Lo que lleva cada equipo en el torneo (goles y xG por partido) corrige la fuerza que el modelo le da a su plantel. */
export const TOR_W = 0.5, TOR_MAX = 0.3

function formOf(rows: Any[][], I: (c: string) => number): Record<string, Form> {
  const last = rows.reduce((m, r) => (r[I('fecha')] > m ? r[I('fecha')] : m), '')
  const cut = new Date(new Date(last).getTime() - FORM_DAYS * 864e5).toISOString().slice(0, 10)
  const acc: Record<string, { f: number; c: number; n: number; rf: number; rc: number; rn: number }> = {}
  for (const r of rows) {
    const sides: [string, number, number, number, number][] = [[r[I('local')], r[I('gl')], r[I('xgl')], r[I('gv')], r[I('xgv')]], [r[I('visita')], r[I('gv')], r[I('xgv')], r[I('gl')], r[I('xgl')]]]
    for (const [club, g, xg, gc, xgc] of sides) {
      const o = (acc[club] ??= { f: 0, c: 0, n: 0, rf: 0, rc: 0, rn: 0 })
      const f = (g + xg) / 2, c = (gc + xgc) / 2
      o.f += f; o.c += c; o.n++
      if (r[I('fecha')] > cut) { o.rf += f; o.rc += c; o.rn++ }
    }
  }
  const mult = (recent: number, season: number) => Math.max(1 - FORM_MAX, Math.min(1 + FORM_MAX, 1 + FORM_W * (recent / Math.max(season, 0.2) - 1)))
  return Object.fromEntries(Object.entries(acc).map(([club, o]) => [club, o.rn >= FORM_MIN
    ? { att: mult(o.rf / o.rn, o.f / o.n), def: mult(o.rc / o.rn, o.c / o.n), n: o.rn, sf: o.f / o.n, sc: o.c / o.n }
    : { att: 1, def: 1, n: o.rn, sf: o.f / o.n, sc: o.c / o.n }]))
}

let packP: Promise<Pack> | null = null
export const loadPack = () => (packP ??= Promise.all([loadStyle(), getJSON(dataUrl('liga_sim.json')), getJSON(dataUrl('partidos.json')), getJSON(dataUrl('calendario.json'))]).then(([{ sx, wi }, ls, P, cal]: Any) => {
  const C: string[] = P.cols, I = (c: string) => C.indexOf(c)
  const rows = (P.rows as Any[][]).filter(r => r[I('temporada')] === '2026/27' && r[I('torneo')] === 'Apertura')
  return { wi, sx, ls, real: rows.map(r => ({ h: r[I('local')], a: r[I('visita')], gh: r[I('gl')], ga: r[I('gv')], r: r[I('jornada')] })), cal, lastRound: Math.max(...rows.map(r => r[I('jornada')])), form: formOf(rows, I) } as Pack
}))

export const clubsOf = (pk: Pack) => Object.keys(pk.wi.squads).filter(c => pk.wi.squads[c].temporada === '2026/27').sort((a, b) => a.localeCompare(b, 'es'))

/** Un torneo nuevo: `club` dirigido por `coach` (con estilo editado `dz`) o, con withCoach = false, tal como está hoy.
 *  En el resto del torneo en curso (fresh = false) la fuerza de cada equipo se ajusta un poco por su forma del último mes. */
export function buildSeason(pk: Pack, club: string, coach: number, dz: Record<string, number> | null, fresh: boolean, withCoach: boolean): Season {
  const clubs = clubsOf(pk)
  const teams = Object.fromEntries(clubs.map(k => [k, k === club && withCoach ? buildTeam(pk.wi, pk.ls, pk.sx, k, coach, withCoach ? dz : null) : buildTeam(pk.wi, pk.ls, pk.sx, k, pk.wi.squads[k].dt, null)])) as Record<string, Team>
  if (!fresh) {
    // lo que lleva cada uno en el torneo frente a lo que espera el modelo de su plantel, ambos relativos al promedio de la liga
    const ks = clubs.filter(k => pk.form[k]), avg = (f: (k: string) => number) => ks.reduce((s, k) => s + f(k), 0) / ks.length
    const mSF = avg(k => pk.form[k].sf), mSC = avg(k => pk.form[k].sc), mA = avg(k => teams[k].att), mD = avg(k => teams[k].def)
    const tor = (real: number, model: number) => Math.max(1 - TOR_MAX, Math.min(1 + TOR_MAX, 1 + TOR_W * (real / model - 1)))
    for (const k of ks) {
      const f = pk.form[k]
      teams[k].att *= tor(f.sf / mSF, teams[k].att / mA) * f.att; teams[k].def *= tor(f.sc / mSC, teams[k].def / mD) * f.def
    }
  }
  return new Season(clubs, teams, pk.ls.liga, pk.real, pk.cal, fresh, pk.ls.real)
}
