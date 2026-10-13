import type React from 'react'
import { useEffect, useState } from 'react'
import { dataUrl, getJSON, type Any } from '../lib'
import { loadRD, type RD } from './data'
import { Cover, Ideas, Separar } from './pagesA'
import { Jugadas, Formaciones, Contexto } from './pagesB'
import { Jugadores, BalonParado, Lab, Vs, Metodo } from './pagesC'
import { Bp2Page, PlanPage, TiempoPage, ValPage } from './pagesD'
import './report.css'
import { makeHtml, makePdf } from './Export'

export type PageKey = 'cover' | 'ideas' | 'separar' | 'jugadas' | 'formaciones' | 'contexto' | 'tiempo' | 'jugadores' | 'bp' | 'bp2' | 'plan' | 'lab' | 'vs' | 'metodo' | 'validacion'
type PC = (p: { rd: RD; n: number; total: number }) => React.JSX.Element
const REG: Partial<Record<PageKey, PC>> = { cover: Cover, ideas: Ideas, separar: Separar, jugadas: Jugadas, formaciones: Formaciones, contexto: Contexto, jugadores: Jugadores, bp: BalonParado, lab: Lab, vs: Vs, metodo: Metodo, tiempo: TiempoPage, bp2: Bp2Page, plan: PlanPage, validacion: ValPage }
export const registerPages = (m: Partial<Record<PageKey, PC>>) => Object.assign(REG, m)

/** Conjuntos de páginas: el informe general y el de cada pestaña. */
export const SETS: Record<string, PageKey[]> = {
  general: ['cover', 'ideas', 'separar', 'jugadas', 'formaciones', 'contexto', 'tiempo', 'jugadores', 'bp', 'bp2', 'plan', 'lab', 'vs', 'metodo', 'validacion'],
  resumen: ['cover', 'ideas', 'plan'], separar: ['separar'], juego: ['jugadas', 'formaciones', 'contexto', 'tiempo'], jugadores: ['jugadores'], bp: ['bp', 'bp2'], plan: ['plan'], lab: ['lab'], vs: ['vs'], metodo: ['metodo', 'validacion'],
}

export function ReportPages({ rd, keys }: { rd: RD; keys: PageKey[] }) {
  return <div className="rp">{keys.filter(k => REG[k]).map((k, i) => { const C = REG[k]!; return <C key={k} rd={rd} n={i + 1} total={keys.filter(x => REG[x]).length} /> })}</div>
}

/** Vista de prueba: ?report=<id>&pages=cover,ideas (se usa para revisar el diseño). */
export function ReportPreview({ id, keys }: { id: number; keys: PageKey[] }) {
  const [rd, setRd] = useState<RD | null>(null)
  useEffect(() => { (window as Any).__rep = { makeHtml, makePdf } }, [])
  useEffect(() => { getJSON(dataUrl(`dt_${id}.json`)).then((art: Any) => loadRD(art)).then(setRd) }, [id])
  if (!rd) return <div style={{ padding: 20 }}>…</div>
  return <ReportPages rd={rd} keys={keys} />
}
