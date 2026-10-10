/* Datos y constructor del torneo compartidos por el simulador de liga y por Golito. */
import { dataUrl, getJSON, type Any } from '../lib'
import { buildTeam, type Liga, type Team } from './engine'
import { Season } from './season'
import { loadStyle, type StyleX } from './styleModel'

export type Pack = { wi: Any; sx: StyleX; ls: { liga: Liga; jugadores: Any; real?: Any }; real: { h: string; a: string; gh: number; ga: number; r: number }[]; cal: Any[]; lastRound: number }
let packP: Promise<Pack> | null = null
export const loadPack = () => (packP ??= Promise.all([loadStyle(), getJSON(dataUrl('liga_sim.json')), getJSON(dataUrl('partidos.json')), getJSON(dataUrl('calendario.json'))]).then(([{ sx, wi }, ls, P, cal]: Any) => {
  const C: string[] = P.cols, I = (c: string) => C.indexOf(c)
  const rows = (P.rows as Any[][]).filter(r => r[I('temporada')] === '2026/27' && r[I('torneo')] === 'Apertura')
  return { wi, sx, ls, real: rows.map(r => ({ h: r[I('local')], a: r[I('visita')], gh: r[I('gl')], ga: r[I('gv')], r: r[I('jornada')] })), cal, lastRound: Math.max(...rows.map(r => r[I('jornada')])) } as Pack
}))

export const clubsOf = (pk: Pack) => Object.keys(pk.wi.squads).filter(c => pk.wi.squads[c].temporada === '2026/27').sort((a, b) => a.localeCompare(b, 'es'))

/** Un torneo nuevo: `club` dirigido por `coach` (con estilo editado `dz`) o, con withCoach = false, tal como está hoy. */
export function buildSeason(pk: Pack, club: string, coach: number, dz: Record<string, number> | null, fresh: boolean, withCoach: boolean): Season {
  const clubs = clubsOf(pk)
  const teams = Object.fromEntries(clubs.map(k => [k, k === club && withCoach ? buildTeam(pk.wi, pk.ls, pk.sx, k, coach, withCoach ? dz : null) : buildTeam(pk.wi, pk.ls, pk.sx, k, pk.wi.squads[k].dt, null)])) as Record<string, Team>
  return new Season(clubs, teams, pk.ls.liga, pk.real, pk.cal, fresh, pk.ls.real)
}
