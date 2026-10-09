/* Asistente de IA (abajo a la derecha). Claude responde desde el visor de claude.ai (capacidad «sample»)
   y sólo puede contestar con datos de la app: las herramientas leen los mismos JSON que dibujan las
   pestañas, devuelven tarjetas (rankings, perfiles, partidos) y pueden llevar al usuario a la vista
   donde está la respuesta. Sin IA disponible (fuera del visor, o si el usuario no la permite) cae a una
   búsqueda simple sobre nombres de DTs, clubes e indicadores. */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import boot from './boot.json'
import { asset, dataUrl, fmt, getJSON, nombreDT, shortName, type Any } from './lib'
import { ClubLogo } from './charts'
import { L, LANG } from './settings'
import { kpiLabel } from './i18n/data'
import { MODES, TAB_KEYS } from './modes'
import { chatBus } from './chatBus'
import './styles/chat.css'

const glob: Any = (boot as Any).global
const media: Any = (boot as Any).media
const DTS: Any[] = glob.dts
const DT_BY_ID = new Map<number, Any>(DTS.map(d => [d.id, d]))
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const dtName = (id: number) => nombreDT(id)?.corto ?? shortName(DT_BY_ID.get(id)?.nombre ?? String(id))
const dtClub = (id: number) => media.dts?.[id]?.club ?? DT_BY_ID.get(id)?.clubes.at(-1)?.club ?? ''
const dtFoto = (id: number) => asset(media.dts?.[id]?.foto)
const kl = (k: string) => kpiLabel(k, glob.kpis[k]?.etiqueta ?? k)
const VIEW_NAMES: Record<string, string> = Object.fromEntries(MODES.flatMap(m => m.subs.map(([k, n]) => [k, m.subs.length > 1 ? `${m.name} · ${n}` : m.name])))
VIEW_NAMES.hub = L('Menú del DT', 'Coach menu'); VIEW_NAMES.mapa = L('Mapa de estilos', 'Style map')

/* ------------------------------------------------------------ tipos */
type Card =
  | { t: 'rank'; title: string; unit: string; rows: { id: number; v: number; a: number }[]; measure: 'propio' | 'observado'; liga: number }
  | { t: 'coach'; id: number; stats: [string, string][]; traits: string[] }
  | { t: 'matches'; title: string; summary?: string; rows: Any[] }
  | { t: 'compare'; a: number; b: number; sim: number; same: CmpRow[]; diffs: CmpRow[] }
  | { t: 'go'; coach: number | null; view: string }
type CmpRow = { k: string; a: number; b: number; va: number | null; vb: number | null }
type Msg = { role: 'user' | 'assistant'; text: string; cards?: Card[]; status?: string; error?: string; local?: boolean; memo?: string }

/* ------------------------------------------------------------ navegación (App escucha este evento) */
function go(coach: number | null, view: string) {
  window.dispatchEvent(new CustomEvent('coachdna:go', { detail: { coach, view } }))
}

/* ------------------------------------------------------------ datos */
const distP = () => getJSON(dataUrl('dist.json'))
const partidosP = () => getJSON(dataUrl('partidos.json'))

function findCoaches(q: string, n = 5) {
  const t = norm(q).trim()
  if (!t) return []
  const words = t.split(/\s+/)
  const score = (d: Any) => {
    const hay = norm(`${d.nombre} ${dtName(d.id)} ${d.clubes.map((c: Any) => c.club).join(' ')}`)
    const nameHay = norm(`${d.nombre} ${dtName(d.id)}`)
    let s = 0
    for (const w of words) { if (nameHay.includes(w)) s += 3; else if (hay.includes(w)) s += 1 }
    if (nameHay.includes(t)) s += 4
    return s
  }
  return DTS.map(d => [d, score(d)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1] || b[0].partidos - a[0].partidos).slice(0, n).map(([d]) => d)
}

function matchRows(P: Any) {
  const C: string[] = P.cols
  return (P.rows as Any[][]).map(r => Object.fromEntries(C.map((c, i) => [c, r[i]])))
}

/* ------------------------------------------------------------ herramientas para Claude */
function makeTools(push: (c: Card) => void, status: (s: string) => void) {
  return [
    {
      name: 'find_coach',
      description: 'Busca entrenadores por nombre, apellido o club. Devuelve hasta 5 candidatos con id, nombre, clubes dirigidos (con partidos) y club actual. Úsala antes de cualquier herramienta que pida coach_id.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      execute: ({ query }: Any) => {
        status(L(`Buscando «${query}»…`, `Looking up "${query}"…`))
        const r = findCoaches(String(query ?? ''))
        if (!r.length) throw new Error('Sin coincidencias. Prueba con el apellido o el club.')
        return r.map(d => ({ id: d.id, nombre: dtName(d.id), clubes: d.clubes.map((c: Any) => `${c.club} (${c.partidos} p., ${c.desde.slice(0, 7)}–${c.hasta.slice(0, 7)})`), club_actual: media.dts?.[d.id]?.vigente ? dtClub(d.id) : null, partidos: d.partidos }))
      },
    },
    {
      name: 'rank_coaches',
      description: 'Ranking de los 76 entrenadores con perfil en un indicador. measure="propio" (estilo propio del DT, ya sin plantilla, club, rival ni contexto; es lo correcto para «el DT más X») u "observado" (lo que se vio en sus partidos). Muestra al usuario una tarjeta con el ranking; devuelve el top.',
      inputSchema: { type: 'object', properties: { indicator: { type: 'string', description: 'clave del indicador' }, order: { type: 'string', enum: ['desc', 'asc'] }, measure: { type: 'string', enum: ['propio', 'observado'] }, n: { type: 'number', description: '3 a 10' } }, required: ['indicator'] },
      execute: async ({ indicator, order = 'desc', measure = 'propio', n = 5 }: Any) => {
        status(L('Ordenando a los 76 DTs…', 'Ranking all 76 coaches…'))
        const D = await distP(); const k = String(indicator); const e = D.kpis[k]
        if (!e) throw new Error(`Indicador desconocido: ${k}`)
        const key = measure === 'observado' ? 'v' : 'a'
        const ids = Object.keys(e[key]).map(Number).filter(id => e[key][id] != null)
        ids.sort((x, y) => (order === 'asc' ? 1 : -1) * (e[key][x] - e[key][y]))
        const top = ids.slice(0, Math.max(3, Math.min(10, Number(n) || 5)))
        const rows = top.map(id => ({ id, v: e.v[id], a: e.a[id] }))
        push({ t: 'rank', title: kl(k), unit: '', rows, measure: measure === 'observado' ? 'observado' : 'propio', liga: e.liga })
        return { indicador: kl(k), media_liga: e.liga, orden: order, medida: measure, top: rows.map((r, i) => ({ puesto: i + 1, id: r.id, nombre: dtName(r.id), observado: r.v, estilo_propio_sigma: r.a })) }
      },
    },
    {
      name: 'coach_profile',
      description: 'Perfil de un entrenador: clubes, récord (G-E-P), goles y xG a favor y en contra por partido, sus rasgos más marcados y, si se piden, valores de indicadores (observado, liga, estilo propio en σ y percentil entre DTs). Muestra una tarjeta con su foto.',
      inputSchema: { type: 'object', properties: { coach_id: { type: 'number' }, indicators: { type: 'array', items: { type: 'string' } } }, required: ['coach_id'] },
      execute: async ({ coach_id, indicators }: Any) => {
        const id = Number(coach_id); if (!DT_BY_ID.has(id)) throw new Error('coach_id desconocido: usa find_coach')
        status(L(`Abriendo el perfil de ${dtName(id)}…`, `Opening ${dtName(id)}'s profile…`))
        const art = await getJSON(dataUrl(`dt_${id}.json`))
        const ps: Any[] = art.partidos, n = ps.length
        const w = ps.filter(p => p.gf > p.gc).length, d = ps.filter(p => p.gf === p.gc).length
        const sp: Any[] = art.simulacion?.partidos ?? []
        const mean = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN
        const xg = mean(sp.map(p => p.xg)), xga = mean(sp.map(p => p.xg_rival))
        const gf = mean(ps.map(p => p.gf)), gc = mean(ps.map(p => p.gc))
        const nar = L(art.narrativa, art.narrativa_en ?? art.narrativa) as Any
        const traits: string[] = (nar?.principios ?? []).map((p: Any) => p.titulo)
        const H = new Map<string, Any>(art.huella.map((h: Any) => [h.kpi, h]))
        const req = ((indicators as string[] | undefined) ?? []).map(String).filter(k => H.has(k)).map(k => { const h = H.get(k); return { indicador: kl(k), observado: h.crudo, liga: h.liga, estilo_propio_sigma: h.alpha, percentil_entre_DTs: h.pct } })
        const stats: [string, string][] = [
          [L('Partidos', 'Matches'), String(n)],
          [L('G-E-P', 'W-D-L'), `${w}-${d}-${n - w - d}`],
          [L('Goles / p.', 'Goals / m.'), `${fmt(gf, 2)} – ${fmt(gc, 2)}`],
          [L('xG / p.', 'xG / m.'), `${fmt(xg, 2)} – ${fmt(xga, 2)}`],
          ...req.slice(0, 2).map(r => [r.indicador, fmt(r.observado, 1)] as [string, string]),
        ]
        push({ t: 'coach', id, stats, traits })
        return { nombre: dtName(id), clubes: DT_BY_ID.get(id).clubes, partidos: n, ganados: w, empatados: d, perdidos: n - w - d, goles_favor_por_partido: gf, goles_contra_por_partido: gc, xg_favor_por_partido: xg, xg_contra_por_partido: xga, rasgos: traits, indicadores: req }
      },
    },
    {
      name: 'match_results',
      description: 'Resultados de partidos de Liga MX 2021/22–2026/27 (públicos): filtra por club, rival, entrenador, temporada ("2025/26") o torneo ("Apertura"/"Clausura"). Devuelve el resumen (G-E-P desde el punto de vista del club o DT filtrado) y como mucho 8 partidos, los más recientes. Muestra una tarjeta con los partidos.',
      inputSchema: { type: 'object', properties: { club: { type: 'string' }, rival: { type: 'string' }, coach_id: { type: 'number' }, season: { type: 'string' }, tournament: { type: 'string' }, limit: { type: 'number', description: '1 a 8' } } },
      execute: async ({ club, rival, coach_id, season, tournament, limit = 6 }: Any) => {
        status(L('Revisando resultados…', 'Checking results…'))
        const rows = matchRows(await partidosP())
        const has = (s: string, q?: string) => !q || norm(s).includes(norm(String(q)))
        const cid = coach_id != null ? Number(coach_id) : null
        const side = (r: Any): 'l' | 'v' | null => {
          if (cid != null) return r.dtl === cid ? 'l' : r.dtv === cid ? 'v' : null
          if (club) return has(r.local, club) ? 'l' : has(r.visita, club) ? 'v' : null
          return null
        }
        let sel = rows.filter(r => {
          if ((cid != null || club) && !side(r)) return false
          if (rival) { const s = side(r); const other = s === 'l' ? r.visita : s === 'v' ? r.local : `${r.local} ${r.visita}`; if (!has(other, rival)) return false }
          if (season && !String(r.temporada).includes(String(season))) return false
          if (tournament && !has(r.torneo, tournament)) return false
          return true
        })
        sel = sel.sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
        let summary: string | undefined
        if (cid != null || club) {
          let w = 0, d = 0, l = 0
          for (const r of sel) { const s = side(r); const f = s === 'l' ? r.gl : r.gv, c = s === 'l' ? r.gv : r.gl; if (f > c) w++; else if (f === c) d++; else l++ }
          summary = `${sel.length} ${L('partidos', 'matches')} · ${w}${L('G', 'W')} ${d}${L('E', 'D')} ${l}${L('P', 'L')}`
        }
        const k = Math.max(1, Math.min(8, Number(limit) || 6))
        const out = sel.slice(0, k)
        const who = cid != null ? dtName(cid) : club ? String(club) : ''
        push({ t: 'matches', title: [who, rival ? `vs ${rival}` : '', season ?? '', tournament ?? ''].filter(Boolean).join(' ') || L('Resultados', 'Results'), summary, rows: out })
        const dtTxt = (id: number | null) => (id ? `DT ${dtName(id)} (id ${id})` : 'DT sin dato')
        return { total: sel.length, resumen: summary, mostrados: out.map(r => ({ fecha: r.fecha, torneo: `${r.torneo} ${r.temporada}`, jornada: r.jornada, partido: `${r.local} [${dtTxt(r.dtl)}] ${r.gl}-${r.gv} ${r.visita} [${dtTxt(r.dtv)}]`, xg: `${r.local} ${r.xgl} – ${r.xgv} ${r.visita}` })), nota: (sel.length > k ? 'Hay más partidos; no los listes todos, sugiere filtrar. ' : '') + 'Los DTs de cada partido son SOLO los de este campo «partido».' }
      },
    },
    {
      name: 'compare_coaches',
      description: 'Compara el estilo propio de dos entrenadores en los indicadores base: parecido (0–100), los 2 rasgos en que más coinciden y los 4 en que más difieren, con el número de cada uno (estilo propio en σ, 0 = media de la liga, y valor observado). Muestra una tarjeta con ambos.',
      inputSchema: { type: 'object', properties: { coach_a: { type: 'number' }, coach_b: { type: 'number' } }, required: ['coach_a', 'coach_b'] },
      execute: async ({ coach_a, coach_b }: Any) => {
        const a = Number(coach_a), b = Number(coach_b)
        if (!DT_BY_ID.has(a) || !DT_BY_ID.has(b)) throw new Error('coach_id desconocido: usa find_coach')
        status(L('Comparando estilos…', 'Comparing styles…'))
        const D = await distP()
        const ks = Object.keys(D.kpis).filter(k => !k.startsWith('arq_') && D.kpis[k].a[a] != null && D.kpis[k].a[b] != null)
        const va = ks.map(k => D.kpis[k].a[a]), vb = ks.map(k => D.kpis[k].a[b])
        const m = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length, ma = m(va), mb = m(vb)
        const cov = va.reduce((s, v, i) => s + (v - ma) * (vb[i] - mb), 0)
        const r = cov / Math.sqrt(va.reduce((s, v) => s + (v - ma) ** 2, 0) * vb.reduce((s, v) => s + (v - mb) ** 2, 0))
        const sim = Math.round(((r + 1) / 2) * 100)
        const rows: CmpRow[] = ks.map((k, i) => ({ k, a: va[i], b: vb[i], va: D.kpis[k].v[a] ?? null, vb: D.kpis[k].v[b] ?? null }))
        const diffs = [...rows].sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b)).slice(0, 4)
        const same = rows.filter(r => Math.sign(r.a) === Math.sign(r.b) && Math.abs(r.a) >= 0.25 && Math.abs(r.b) >= 0.25).sort((x, y) => Math.abs(x.a - x.b) - Math.abs(y.a - y.b)).slice(0, 2)
        push({ t: 'compare', a, b, sim, same, diffs })
        const out = (r: CmpRow) => ({ indicador: kl(r.k), [`${dtName(a)}_estilo_propio_sigma`]: +r.a.toFixed(2), [`${dtName(b)}_estilo_propio_sigma`]: +r.b.toFixed(2), [`${dtName(a)}_observado`]: r.va, [`${dtName(b)}_observado`]: r.vb })
        return { parecido_0_100: sim, se_parecen_en: same.map(out), mas_distintos: diffs.map(out) }
      },
    },
    {
      name: 'open_view',
      description: 'Lleva al usuario a la vista de la app donde está la respuesta (cambia la pantalla de inmediato) y deja un botón para volver. coach_id null + view "mapa" = mapa de estilos. Para "vs", other_coach_id es el segundo DT.',
      inputSchema: { type: 'object', properties: { coach_id: { type: ['number', 'null'] }, view: { type: 'string', enum: ['mapa', 'hub', ...TAB_KEYS] }, other_coach_id: { type: 'number' } }, required: ['view'] },
      execute: ({ coach_id, view, other_coach_id }: Any) => {
        const v = String(view)
        const c = v === 'mapa' || coach_id == null ? null : Number(coach_id)
        if (c != null && !DT_BY_ID.has(c)) throw new Error('coach_id desconocido')
        if (v === 'vs' && other_coach_id != null) chatBus.vsRival = Number(other_coach_id)
        go(c, c == null ? 'mapa' : v)
        push({ t: 'go', coach: c, view: c == null ? 'mapa' : v })
        return 'ok'
      },
    },
  ]
}

function rules(view: string, coach: number | null) {
  const kp = Object.entries(glob.kpis as Record<string, Any>).map(([k, v]) => `${k}: ${kl(k)} (${v.familia})`).join('\n')
  const views = ['mapa', 'hub', ...TAB_KEYS].map(v => `${v}: ${VIEW_NAMES[v] ?? v}`).join('; ')
  return `Eres el asistente de IA de Coach DNA, una app sobre el estilo de juego de los entrenadores de Liga MX (temporadas ${glob.muestra.temporadas[0]} a ${glob.muestra.temporadas.at(-1)}, datos StatsBomb, ${glob.muestra.partidos} partidos, ${DTS.length} DTs con perfil).
Responde en ${LANG === 'en' ? 'inglés' : 'español'}, en 1 a 3 frases, con tono natural y directo. Sin listas largas ni tablas.
Reglas:
- Todo número sale de las herramientas. Nunca inventes datos ni uses lo que sepas de fuera. Si algo no está en los datos, dilo.
- Antes de usar un coach_id, búscalo con find_coach (salvo que ya lo tengas).
- Las herramientas ya le muestran al usuario tarjetas con rankings, perfiles y partidos: no las repitas; comenta lo importante.
- Nunca des tablas completas ni más de 8 partidos. Si piden «todos», da el resumen y sugiere filtrar por rival o temporada.
- Para «el mejor/más X DT», usa rank_coaches con measure "propio" y explica en pocas palabras que es su estilo propio, descontando plantilla y rival.
- Si la respuesta vive en una vista de la app, llama a open_view para llevar al usuario ahí.
- Cada pregunta se responde con datos de las herramientas DE ESE TURNO. Los DTs, clubes o partidos de preguntas anteriores NO se aplican a la nueva pregunta, salvo que el usuario los retome («él», «ese partido», «y contra el América»). Nunca pongas a un DT en un club o partido que no figure así en el resultado de la herramienta (campo «partido» de match_results); si no aparece, no lo menciones.
- No narres lo que vas a hacer («voy a buscar…»): llama a la herramienta y responde con el dato.
- Al final de los turnos anteriores verás «[datos de la respuesta anterior: …]»: es contexto interno para seguir la conversación; no lo cites ni lo copies.
- Para nombrar a un DT escribe [[dt:ID]] (se muestra su foto y nombre); para un club escribe [[club:Nombre exacto]].
- Si preguntan algo ajeno al futbol mexicano o a la app, responde amablemente que sólo sabes de esto.
Vistas (view): ${views}.
El usuario está viendo: ${coach != null ? `${dtName(coach)} (id ${coach}), vista ${view}` : 'el mapa de estilos'}. «Este DT» o «él» se refiere a ese entrenador.
Indicadores (clave: nombre):
${kp}`
}

/* ------------------------------------------------------------ respaldo sin IA */
function localAnswer(q: string): Msg {
  const t = norm(q)
  const cards: Card[] = []
  const STOP = new Set(['quien', 'quién', 'tiene', 'cual', 'cuanto', 'como', 'contra', 'mejor', 'which', 'what', 'coach', 'entrenador', 'partido', 'partidos', 'match', 'matches', 'with', 'para', 'about'])
  const nameWords = t.split(/[^a-z0-9ñ]+/).filter(w => w.length >= 4 && !STOP.has(w))
  const coaches = DTS.filter(d => nameWords.some(w => norm(`${d.nombre} ${dtName(d.id)}`).split(/\s+/).includes(w))).slice(0, 3)
  const kp = Object.keys(glob.kpis).map(k => [k, norm(kl(k))] as const)
  const words = t.split(/\W+/).filter(w => w.length > 3)
  const kHit = kp.map(([k, l]) => [k, words.filter(w => l.includes(w)).length] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1])[0]
  coaches.slice(0, 2).forEach(d => cards.push({ t: 'go', coach: d.id, view: 'resumen' }))
  const text = kHit
    ? L(`No pude usar la IA en esta vista. Con búsqueda simple encontré «${kl(kHit[0])}»: arriba va el ranking por estilo propio.`, `I couldn't use the AI here. Simple search found "${kl(kHit[0])}": the ranking by own style is above.`)
    : coaches.length ? L('No pude usar la IA en esta vista. Esto es lo que encontré por nombre:', "I couldn't use the AI here. This is what I found by name:")
      : L('No pude usar la IA en esta vista y no encontré un DT ni un indicador con esas palabras.', "I couldn't use the AI here and found no coach or indicator with those words.")
  const m: Msg = { role: 'assistant', text, cards, local: true }
  if (kHit) distP().then(D => {
    const e = D.kpis[kHit[0]]; const ids = Object.keys(e.a).map(Number).sort((x, y) => e.a[y] - e.a[x]).slice(0, 5)
    cards.unshift({ t: 'rank', title: kl(kHit[0]), unit: '', rows: ids.map(id => ({ id, v: e.v[id], a: e.a[id] })), measure: 'propio', liga: e.liga })
    window.dispatchEvent(new Event('coachdna:chat-refresh'))
  })
  return m
}

/* ------------------------------------------------------------ mascota: balón con ojos */
export type Mood = 'idle' | 'curious' | 'think' | 'happy' | 'oops'
// cinco pentágonos simétricos sobre el perímetro (un vértice mira al centro) y costuras que los unen
const SKIN = (() => {
  const C = 32, D = 27.4, R = 8.2, cs: { cx: number; cy: number; v: [number, number][] }[] = []
  for (let k = 0; k < 5; k++) {
    const th = ((-90 + 72 * k) * Math.PI) / 180, cx = C + D * Math.cos(th), cy = C + D * Math.sin(th)
    cs.push({ cx, cy, v: Array.from({ length: 5 }, (_, j) => { const a = th + Math.PI + (j * 2 * Math.PI) / 5; return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as [number, number] }) })
  }
  const near = (p: (typeof cs)[number], tx: number, ty: number) => p.v.reduce((m, q) => (Math.hypot(q[0] - tx, q[1] - ty) < Math.hypot(m[0] - tx, m[1] - ty) ? q : m))
  const f = (n: number) => n.toFixed(2)
  const pent = cs.map(p => `M${p.v.map(q => `${f(q[0])} ${f(q[1])}`).join(' L')} Z`).join(' ')
  const seam = cs.map((p, k) => { const n = cs[(k + 1) % 5], a = near(p, n.cx, n.cy), b = near(n, p.cx, p.cy); return `M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])}` }).join(' ')
  return { pent, seam }
})()
const BROW: Record<Mood, [string, string, number]> = {   // [ceja izq, ceja der, opacidad]
  idle: ['translate(0px,3px)', 'translate(0px,3px)', 0],
  curious: ['translate(0px,-1.6px) rotate(-5deg)', 'translate(0px,-3.8px) rotate(10deg)', 1],
  think: ['translate(0px,1.4px) rotate(14deg)', 'translate(0px,-2.8px) rotate(-6deg)', 1],
  happy: ['translate(0px,-2.6px) rotate(-3deg)', 'translate(0px,-2.6px) rotate(3deg)', 1],
  oops: ['translate(0px,-.6px) rotate(-17deg)', 'translate(0px,-.6px) rotate(17deg)', 1],
}
const EYES: Record<Mood, { s: string; look?: [number, number] }> = {
  idle: { s: 'scale(1)' }, curious: { s: 'scale(1.15)' }, think: { s: 'scale(1, .84)', look: [-2, -2.6] },
  happy: { s: 'scale(1)' }, oops: { s: 'scale(.9, .8)', look: [0, 1.8] },
}
export function Ball({ size = 44, mood = 'idle', look = [0, 0] }: { size?: number; mood?: Mood; look?: [number, number] }) {
  const id = useId().replace(/:/g, '')
  const [lx, ly] = EYES[mood].look ?? look
  const eye = (cx: number) => (
    <g>
      <ellipse cx={cx} cy="32" rx="4.7" ry="6.5" fill="#14201a" />
      <circle cx={cx + 1.6} cy="29.2" r="1.9" fill="#fff" /><circle cx={cx - 1.3} cy="34.4" r="0.95" fill="#fff" opacity=".85" />
    </g>
  )
  return (
    <svg className={`ball ball-${mood}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id={`bg${id}`} cx="38%" cy="32%" r="70%"><stop offset="0" stopColor="#fff" /><stop offset=".72" stopColor="#eef1ee" /><stop offset="1" stopColor="#c9d1cc" /></radialGradient>
        <radialGradient id={`bs${id}`} cx="42%" cy="36%" r="62%"><stop offset=".55" stopColor="#14201a" stopOpacity="0" /><stop offset="1" stopColor="#14201a" stopOpacity=".22" /></radialGradient>
        <clipPath id={`bc${id}`}><circle cx="32" cy="32" r="29" /></clipPath>
      </defs>
      <circle cx="32" cy="32" r="29" fill={`url(#bg${id})`} />
      <g clipPath={`url(#bc${id})`}>
        <g className="ball-skin"><path d={SKIN.pent} fill="#1d2a24" strokeLinejoin="round" stroke="#1d2a24" strokeWidth=".8" /><path d={SKIN.seam} fill="none" stroke="#1d2a24" strokeWidth="1.3" strokeLinecap="round" opacity=".8" /></g>
        <circle cx="32" cy="32" r="29" fill={`url(#bs${id})`} />
        <ellipse cx="22" cy="14.5" rx="8" ry="4" fill="#fff" opacity=".42" transform="rotate(-32 22 14.5)" />
      </g>
      <circle cx="32" cy="32" r="29" fill="none" stroke="#1d2a24" strokeWidth="2" />
      <g className="ball-face" style={{ transform: `translate(${lx}px, ${ly}px)` }}>
        <g className="ball-eyes" style={{ transform: EYES[mood].s, opacity: mood === 'happy' ? 0 : 1 }}><g className="ball-blink">{eye(24.5)}{eye(39.5)}</g></g>
        <g style={{ opacity: mood === 'happy' ? 1 : 0, transition: 'opacity .18s' }} fill="none" stroke="#14201a" strokeWidth="3.3" strokeLinecap="round">
          <path d="M19.6 35 Q24.5 26.4 29.4 35" /><path d="M34.6 35 Q39.5 26.4 44.4 35" />
        </g>
        <g fill="none" stroke="#14201a" strokeWidth="2.3" strokeLinecap="round" style={{ opacity: BROW[mood][2], transition: 'opacity .2s' }}>
          <path className="ball-brow" d="M19.2 23.4 Q24.4 20.4 29.6 23.2" style={{ transform: BROW[mood][0] }} />
          <path className="ball-brow" d="M34.4 23.2 Q39.6 20.4 44.8 23.4" style={{ transform: BROW[mood][1] }} />
        </g>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------ texto con marcas [[dt:ID]] [[club:X]] **negritas** */
function Rich({ text, streaming }: { text: string; streaming?: boolean }) {
  let s = text
  if (streaming) s = s.replace(/\[\[[^\]]*$/, '')
  const parts: ReactNode[] = []
  const re = /\[\[(dt|club):([^\]]+)\]\]|\*\*([^*]+)\*\*/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index))
    if (m[1] === 'dt') {
      const id = Number(m[2])
      parts.push(DT_BY_ID.has(id)
        ? <button key={i++} className="chip-dt" onClick={() => go(id, 'resumen')}>{dtFoto(id) ? <img src={dtFoto(id)!} alt="" /> : <i>{dtName(id)[0]}</i>}{dtName(id)}</button>
        : m[2])
    } else if (m[1] === 'club') parts.push(<span key={i++} className="chip-club"><ClubLogo club={m[2]} media={media} size={16} />{m[2]}</span>)
    else parts.push(<b key={i++}>{m[3]}</b>)
    last = re.lastIndex
  }
  parts.push(s.slice(last))
  return <>{parts}</>
}

/* ------------------------------------------------------------ tarjetas */
function CardView({ c }: { c: Card }) {
  if (c.t === 'rank') {
    const vals = c.rows.map(r => (c.measure === 'propio' ? r.a : r.v))
    const max = Math.max(...vals.map(Math.abs), 1e-6)
    return (
      <div className="cc cc-rank">
        <div className="cc-h">{c.title}<em>{c.measure === 'propio' ? L('estilo propio', 'own style') : L('observado', 'observed')}</em></div>
        {c.rows.map((r, i) => (
          <button key={r.id} className="cc-rank-row" style={{ ['--i' as string]: i }} onClick={() => go(r.id, 'resumen')}>
            <span className="cc-pos">{i + 1}</span>
            <Face id={r.id} size={28} />
            <span className="cc-name">{dtName(r.id)}<small><ClubLogo club={dtClub(r.id)} media={media} size={12} />{dtClub(r.id)}</small></span>
            <span className="cc-bar"><i style={{ width: `${(Math.abs(vals[i]) / max) * 100}%` }} /></span>
            <b className="mono">{c.measure === 'propio' ? `${r.a > 0 ? '+' : ''}${fmt(r.a, 2)}σ` : fmt(r.v, 1)}</b>
          </button>
        ))}
        <div className="cc-foot">{L('Liga', 'League')}: {fmt(c.liga, 1)}</div>
      </div>
    )
  }
  if (c.t === 'coach') return (
    <div className="cc cc-coach">
      <button className="cc-coach-h" onClick={() => go(c.id, 'resumen')}>
        <Face id={c.id} size={46} />
        <span><b>{dtName(c.id)}</b><small><ClubLogo club={dtClub(c.id)} media={media} size={13} />{DT_BY_ID.get(c.id)?.clubes.map((x: Any) => x.club).join(' → ')}</small></span>
      </button>
      <div className="cc-stats">{c.stats.map(([k, v], i) => <div key={k} style={{ ['--i' as string]: i }}><span>{k}</span><b>{v}</b></div>)}</div>
      {c.traits.length > 0 && <div className="cc-traits">{c.traits.map(t => <span key={t}>{t}</span>)}</div>}
    </div>
  )
  if (c.t === 'matches') return (
    <div className="cc cc-matches">
      <div className="cc-h">{c.title}{c.summary && <em>{c.summary}</em>}</div>
      {c.rows.length === 0 && <div className="cc-foot">{L('Sin partidos con ese filtro.', 'No matches for that filter.')}</div>}
      {c.rows.map((r: Any, i: number) => (
        <div key={`${r.fecha}-${r.local}`} className="cc-match" style={{ ['--i' as string]: i }}>
          <span className="cc-date">{r.fecha.slice(8, 10)}/{r.fecha.slice(5, 7)}<br />{r.fecha.slice(0, 4)}</span>
          <span className="cc-team r"><span className="cc-tn">{r.local}</span><ClubLogo club={r.local} media={media} size={18} /></span>
          <b className="cc-score">{r.gl}<i>–</i>{r.gv}</b>
          <span className="cc-team"><ClubLogo club={r.visita} media={media} size={18} /><span className="cc-tn">{r.visita}</span></span>
          <span className="cc-dt r">{r.dtl ? dtName(r.dtl) : ''}</span>
          <span className="cc-xg">xG {fmt(r.xgl, 1)}–{fmt(r.xgv, 1)}</span>
          <span className="cc-dt">{r.dtv ? dtName(r.dtv) : ''}</span>
        </div>
      ))}
    </div>
  )
  if (c.t === 'compare') {
    const pos = (v: number) => `${Math.max(3, Math.min(97, ((v + 1.5) / 3) * 100))}%`
    const sg = (v: number) => `${v > 0.004 ? '+' : v < -0.004 ? '−' : ''}${fmt(Math.abs(v), 2)}σ`
    const row = (d: CmpRow, i: number) => (
      <div key={d.k} className="cc-cmp" style={{ ['--i' as string]: i }}>
        <b className="cc-n a">{sg(d.a)}<small>{d.va != null ? fmt(d.va, 1) : ''}</small></b>
        <div className="cc-cmp-mid">
          <span className="cc-cmp-l">{kl(d.k)}</span>
          <span className="cc-cmp-track">
            <i className="zero" />
            <i className="link" style={{ left: pos(Math.min(d.a, d.b)), width: `calc(${pos(Math.max(d.a, d.b))} - ${pos(Math.min(d.a, d.b))})` }} />
            <i className="dot a" style={{ left: pos(d.a) }} /><i className="dot b" style={{ left: pos(d.b) }} />
          </span>
        </div>
        <b className="cc-n b">{sg(d.b)}<small>{d.vb != null ? fmt(d.vb, 1) : ''}</small></b>
      </div>
    )
    return (
      <div className="cc cc-compare">
        <div className="cc-vs">
          <button onClick={() => go(c.a, 'resumen')}><Face id={c.a} size={44} ring="var(--c-dt)" /><span className="a">{dtName(c.a)}</span></button>
          <div className="cc-sim"><b>{c.sim}</b><span>{L('de 100 parecido', 'of 100 alike')}</span></div>
          <button onClick={() => go(c.b, 'resumen')}><Face id={c.b} size={44} ring="var(--c-plantilla)" /><span className="b">{dtName(c.b)}</span></button>
        </div>
        <div className="cc-note">{L('Estilo propio en σ (0 = media de la liga) y, debajo, el valor que se vio en sus partidos.', 'Own style in σ (0 = league average) and, below, the value seen in his matches.')}</div>
        {c.same.length > 0 && <div className="cc-sec">{L('Se parecen en', 'Alike in')}</div>}
        {c.same.map(row)}
        <div className="cc-sec">{L('Más distintos', 'Most different')}</div>
        {c.diffs.map((d, i) => row(d, i + c.same.length))}
      </div>
    )
  }
  return (
    <button className="cc cc-go" onClick={() => go(c.coach, c.view)}>
      {c.coach != null ? <Face id={c.coach} size={26} /> : <span className="cc-go-map">◎</span>}
      <span>{c.coach != null ? `${dtName(c.coach)} · ` : ''}{VIEW_NAMES[c.view] ?? c.view}</span>
      <b>→</b>
    </button>
  )
}

function Face({ id, size, ring }: { id: number; size: number; ring?: string }) {
  const [bad, setBad] = useState(false)
  const src = dtFoto(id)
  const color = ring ?? media.clubes?.[dtClub(id)]?.color ?? 'var(--c-dt)'
  return (
    <span className="face" style={{ width: size, height: size, ['--ring' as string]: color }}>
      {src && !bad ? <img src={src} alt="" onError={() => setBad(true)} /> : <i style={{ fontSize: size * 0.38 }}>{dtName(id).split(' ').map(w => w[0]).slice(0, 2).join('')}</i>}
    </span>
  )
}

/* ------------------------------------------------------------ componente */
const SUGGEST = () => [
  L('¿Quién es el DT que más tiene el balón?', 'Which coach keeps the ball the most?'),
  L('¿Cuánto xG por partido genera Almada?', "What is Almada's xG per match?"),
  L('¿Cómo le fue a Tigres contra Monterrey?', 'How did Tigres do against Monterrey?'),
  L('¿En qué se parecen Almada y Torrent?', 'How alike are Almada and Torrent?'),
]

export default function Chat({ coach, view }: { coach: number | null; view: string }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [, force] = useState(0)
  const [look, setLook] = useState<[number, number]>([0, 0])
  const sampleRef = useRef<Any>(undefined)          // undefined: aún no se sabe; null: sin IA
  const ctl = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [aiOff, setAiOff] = useState(false)
  const [hover, setHover] = useState(false)
  const [flashMood, setFlashMood] = useState<Mood | null>(null)
  const flashT = useRef<number>(0)
  const flash = (m: Mood) => { setFlashMood(m); window.clearTimeout(flashT.current); flashT.current = window.setTimeout(() => setFlashMood(null), m === 'happy' ? 2600 : 3200) }

  useEffect(() => {
    const c = (window as Any).claude
    if (!c?.use) { sampleRef.current = null; return }
    c.use('sample').then((s: Any) => { sampleRef.current = s ?? null }, () => { sampleRef.current = null })
  }, [])
  useEffect(() => { const f = () => force(x => x + 1); window.addEventListener('coachdna:chat-refresh', f); return () => window.removeEventListener('coachdna:chat-refresh', f) }, [])
  // los ojos del balón siguen al cursor
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const b = fabRef.current?.getBoundingClientRect(); if (!b) return
      const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2), d = Math.hypot(dx, dy) || 1
      setLook([(dx / d) * Math.min(2.6, d / 80), (dy / d) * Math.min(2.2, d / 80)])
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [msgs])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250) }, [open])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [])

  const update = (fn: (m: Msg) => Msg) => setMsgs(ms => { const c = ms.slice(); c[c.length - 1] = fn(c[c.length - 1]); return c })

  const ask = async (q: string) => {
    q = q.trim(); if (!q || busy) return
    setInput('')
    const history = msgs.filter(m => !m.local && !m.error && m.text).slice(-8).map(m => ({
      role: m.role,
      content: m.role === 'assistant' && m.memo ? `${m.text}\n\n[datos de la respuesta anterior (contexto interno, no los cites):\n${m.memo}]` : m.text,
    }))
    setMsgs(ms => [...ms, { role: 'user', text: q }, { role: 'assistant', text: '', cards: [], status: L('Pensando…', 'Thinking…') }])
    setBusy(true)
    // espera breve a que el visor diga si hay IA
    for (let i = 0; i < 20 && sampleRef.current === undefined; i++) await new Promise(r => setTimeout(r, 100))
    const sample = sampleRef.current
    if (!sample) { setAiOff(true); setMsgs(ms => [...ms.slice(0, -1), localAnswer(q)]); setBusy(false); return }
    const cards: Card[] = []
    const memo: string[] = []
    const push = (c: Card) => { cards.push(c); update(m => ({ ...m, cards: [...cards] })) }
    const status = (s: string) => update(m => ({ ...m, status: s }))
    // cada herramienta deja su resultado resumido: en la siguiente pregunta el modelo ve qué datos usó (y no los inventa)
    const tools = makeTools(push, status).map(t => ({ ...t, execute: async (input: Any, c: Any) => {
      const out = await (t.execute as Any)(input, c)
      memo.push(`${t.name}(${JSON.stringify(input)}) → ${JSON.stringify(out).slice(0, 900)}`)
      update(m => ({ ...m, memo: memo.join('\n') }))
      return out
    } }))
    ctl.current = new AbortController()
    try {
      await sample([{ role: 'user', content: rules(view, coach) }, ...history, { role: 'user', content: q }], {
        modelTier: 'quick', signal: ctl.current.signal, tools,
        onText: ({ text }: Any) => update(m => ({ ...m, text: text.replace(/\n{3,}/g, '\n\n'), status: undefined })),
      })
      update(m => ({ ...m, status: undefined }))
      flash('happy')
    } catch (e: Any) {
      const off = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'tools_unavailable'].includes(e?.code)
      if (off) { setAiOff(true); setMsgs(ms => [...ms.slice(0, -1), localAnswer(q)]) }
      else { if (e?.code !== 'cancelled') flash('oops'); update(m => ({
        ...m, status: undefined, text: e?.code === 'refused' ? '' : e?.text ?? m.text,
        error: e?.code === 'cancelled' ? undefined : e?.code === 'rate_limited' ? L('Demasiadas preguntas seguidas. Espera un momento.', 'Too many questions in a row. Wait a moment.') : L('Se cortó la respuesta. Intenta de nuevo.', 'The answer was cut off. Try again.'),
      })) }
    } finally { setBusy(false); ctl.current = null }
  }

  const empty = msgs.length === 0
  const typing = open && !busy && input.trim().length > 0
  const mood: Mood = busy ? 'think' : flashMood ?? (typing || hover ? 'curious' : 'idle')
  const ctxName = coach != null ? dtName(coach) : null
  const sugg = useMemo(() => {
    const s = SUGGEST()
    if (ctxName) s[1] = L(`¿Cuánto xG por partido genera ${ctxName}?`, `What is ${ctxName}'s xG per match?`)
    return s
  }, [ctxName])

  return (
    <>
      <button ref={fabRef} className={`ai-fab${open ? ' is-open' : ''}`} data-mood={mood} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={L('Abrir el chat con IA', 'Open the AI chat')}>
        <span className="ai-fab-ball"><Ball size={46} mood={mood} look={look} /></span>
        <span className="ai-fab-txt"><b>{L('Pregúntale a la IA', 'Ask the AI')}</b><small>{L('chat sobre los datos', 'chat about the data')}</small></span>
        <span className="ai-fab-badge">IA</span>
      </button>
      <section className={`ai-panel${open ? ' is-open' : ''}`} aria-hidden={!open} aria-label={L('Chat con IA', 'AI chat')}>
        <header className="ai-head">
          <Ball size={38} mood={mood} look={look} />
          <div><b>{L('Asistente IA', 'AI assistant')}<span className="ai-spark">✦</span></b><small>{L('Responde sólo con los datos de Coach DNA y te lleva a la vista', 'Answers only from Coach DNA data and takes you to the view')}</small></div>
          {msgs.length > 0 && <button className="ai-x ai-new" onClick={() => { ctl.current?.abort(); setMsgs([]) }} title={L('Nueva conversación', 'New chat')}>↺</button>}
          <button className="ai-x" onClick={() => setOpen(false)} aria-label={L('Cerrar', 'Close')}>×</button>
        </header>
        <div className="ai-list" ref={listRef}>
          {empty && (
            <div className="ai-hello">
              <p>{L('¡Hola! Pregúntame por cualquier DT, indicador o resultado de la Liga MX desde 2021.', 'Hi! Ask me about any coach, indicator or Liga MX result since 2021.')}</p>
              <div className="ai-sugg">{sugg.map((s, i) => <button key={s} style={{ ['--i' as string]: i }} onClick={() => ask(s)}>{s}</button>)}</div>
            </div>
          )}
          {msgs.map((m, i) => m.role === 'user'
            ? <div key={i} className="ai-msg ai-user">{m.text}</div>
            : (
              <div key={i} className="ai-msg ai-bot">
                {m.cards?.map((c, j) => <CardView key={j} c={c} />)}
                {m.text && <div className="ai-text"><Rich text={m.text} streaming={busy && i === msgs.length - 1} />{busy && i === msgs.length - 1 && <span className="ai-caret" />}</div>}
                {m.status && <div className="ai-status"><span className="ai-dots"><i /><i /><i /></span>{m.status}</div>}
                {m.error && <div className="ai-err">{m.error}</div>}
              </div>
            ))}
        </div>
        {aiOff && <div className="ai-off">{L('La IA no está disponible aquí (ábrelo en claude.ai y permite el uso de Claude). Mientras, uso búsqueda simple.', 'The AI is not available here (open it on claude.ai and allow Claude). For now I use simple search.')}</div>}
        <form className="ai-form" onSubmit={e => { e.preventDefault(); ask(input) }}>
          <textarea ref={inputRef} rows={1} value={input} placeholder={ctxName ? L(`Pregunta sobre ${ctxName}…`, `Ask about ${ctxName}…`) : L("Pregunta lo que quieras…", "Ask anything…")}
            onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }} />
          {busy
            ? <button type="button" className="ai-send ai-stop" onClick={() => ctl.current?.abort()} aria-label={L('Detener', 'Stop')}><span /></button>
            : <button type="submit" className="ai-send" disabled={!input.trim()} aria-label={L('Enviar', 'Send')}><svg viewBox="0 0 24 24"><path d="M4 12 L20 4 L14 20 L11.5 13 Z" /></svg></button>}
        </form>
      </section>
    </>
  )
}
