import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { type Any } from '../lib'
import { L } from '../settings'
import { loadRD } from './data'
import { ReportPages, SETS, type PageKey } from './Report'

/* Exportar a PDF: cada página se dibuja fuera de pantalla (A4 horizontal, 1123 × 794 px), se fotografía con html-to-image y se arma con jsPDF.
   Las dos librerías se cargan al pedir el PDF (no pesan en la carga de la web). */
const W = 1123, H = 794
const CDN = { img: 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js', pdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js' }
const loaded: Record<string, Promise<void>> = {}
const loadScript = (src: string) => (loaded[src] ??= new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(); s.onerror = () => { delete loaded[src]; no(new Error(src)) }; document.head.appendChild(s) }))

/** CSS de las tipografías con los archivos incrustados: dentro de la «foto» SVG la página no puede usar sus propias fuentes. */
let fontCss: Promise<string> | null = null
const toData = (b: Blob) => new Promise<string>(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(b) })
function embedFonts(): Promise<string> {
  return (fontCss ??= (async () => {
    const link = [...document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]')].find(l => l.href.includes('fonts.googleapis.com'))
    if (!link) return ''
    let css = await (await fetch(link.href)).text()
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))]
    const data = await Promise.all(urls.map(async u => { try { return await toData(await (await fetch(u)).blob()) } catch { return u } }))
    urls.forEach((u, i) => { css = css.split(u).join(data[i]) })
    return css
  })().catch(() => { fontCss = null; return '' }))
}

export type Progress = (done: number, total: number, msg: string) => void

export async function makePdf(art: Any, set: string, onProgress: Progress): Promise<Blob> {
  const keys: PageKey[] = SETS[set] ?? SETS.general
  onProgress(0, keys.length, L('Cargando herramientas…', 'Loading tools…'))
  await Promise.all([loadScript(CDN.img), loadScript(CDN.pdf)])
  const w = window as Any
  const rd = await loadRD(art)
  const fontEmbedCSS = await embedFonts()
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-${W + 400}px;top:0;width:${W}px;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(<ReportPages rd={rd} keys={keys} />)
    await new Promise(r => setTimeout(r, 400))
    await (document as Any).fonts?.ready
    const pages = [...host.querySelectorAll<HTMLElement>('.rp-page')]
    await Promise.all([...host.querySelectorAll('img')].map(i => (i.complete ? null : new Promise(r => { i.onload = i.onerror = () => r(null) }))))
    await new Promise(r => setTimeout(r, 500))
    const pdf = new w.jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H], compress: true, hotfixes: ['px_scaling'] })
    for (let i = 0; i < pages.length; i++) {
      onProgress(i, pages.length, L(`Página ${i + 1} de ${pages.length}`, `Page ${i + 1} of ${pages.length}`))
      const jpg: string = await w.htmlToImage.toJpeg(pages[i], { pixelRatio: 2, quality: 0.93, width: W, height: H, backgroundColor: '#faf6ec', cacheBust: false, fontEmbedCSS })
      if (i) pdf.addPage([W, H], 'landscape')
      pdf.addImage(jpg, 'JPEG', 0, 0, W, H, undefined, 'FAST')
    }
    onProgress(pages.length, pages.length, L('Listo', 'Done'))
    return pdf.output('blob') as Blob
  } finally { root.unmount(); host.remove() }
}

/** Informe HTML autocontenido (CSS e imágenes incrustados): es el entregable «reporte en HTML» del concurso. */
export async function makeHtml(art: Any, set: string, onProgress: Progress): Promise<Blob> {
  const keys: PageKey[] = SETS[set] ?? SETS.general
  onProgress(0, 1, L('Armando el informe…', 'Building the report…'))
  const rd = await loadRD(art)
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-${W + 400}px;top:0;width:${W}px;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(<ReportPages rd={rd} keys={keys} />)
    await new Promise(r => setTimeout(r, 700))
    await Promise.all([...host.querySelectorAll('img')].map(i => (i.complete ? null : new Promise(r => { i.onload = i.onerror = () => r(null) }))))
    for (const img of [...host.querySelectorAll('img')]) { try { img.src = await toData(await (await fetch(img.src)).blob()) } catch { /* se queda la ruta */ } }
    const css = [...document.styleSheets].map(sh => { try { return [...sh.cssRules].map(r => r.cssText).join('\n') } catch { return '' } }).join('\n')
    const fonts = await embedFonts()
    const title = L(`Coach DNA · ${art.nombre}`, `Coach DNA · ${art.nombre}`)
    const html = `<!doctype html><html lang="${L('es', 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${fonts}\n${css}\nbody{margin:0;background:#d9d3c3}.rp{display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px 0}.rp-page{box-shadow:0 6px 30px rgb(0 0 0/.18);flex:none}@media print{body{background:#fff}.rp{gap:0;padding:0}.rp-page{box-shadow:none;break-after:page}@page{size:1123px 794px;margin:0}}</style></head><body>${host.innerHTML}</body></html>`
    onProgress(1, 1, L('Listo', 'Done'))
    return new Blob([html], { type: 'text/html' })
  } finally { root.unmount(); host.remove() }
}

export async function saveFile(blob: Blob, filename: string): Promise<'saved' | 'declined' | 'fallback'> {
  try {
    const dl = await (window as Any).claude?.use?.('downloads')
    if (dl) { await dl.save({ filename, data: blob }); return 'saved' }
  } catch (e: any) { if (e?.code === 'declined') return 'declined' }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return 'fallback'
}

/** Botón «PDF» de la barra del DT: informe completo o sólo el modo en el que está. */
export function PdfMenu({ art, modeK, modeName }: { art: Any; modeK: string; modeName: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f)
  }, [open])
  const own = SETS[modeK] ? modeK : null
  const items: [string, string, string][] = [['general', L('Informe completo (PDF)', 'Full report (PDF)'), L(`Todas las páginas, ${SETS.general.length} hojas`, `Every page, ${SETS.general.length} sheets`)]]
  if (own && own !== 'general') items.push([own, L(`Sólo ${modeName} (PDF)`, `${modeName} only (PDF)`), `${SETS[own].length} ${L(SETS[own].length === 1 ? 'hoja' : 'hojas', SETS[own].length === 1 ? 'sheet' : 'sheets')}`])
  items.push(['html', L('Informe web (HTML)', 'Web report (HTML)'), L('Un solo archivo para enviar o abrir sin internet', 'One file to send or open offline')])
  const go = async (set: string) => {
    const isHtml = set === 'html'
    setBusy(set); setMsg(L('Preparando…', 'Preparing…'))
    try {
      const prog: Progress = (d, t, m) => setMsg(`${m}${t > 1 ? ` · ${Math.round((d / t) * 100)}%` : ''}`)
      const blob = isHtml ? await makeHtml(art, 'general', prog) : await makePdf(art, set, prog)
      const r = await saveFile(blob, `coach-dna_${art.slug ?? art.id}_${isHtml ? 'informe' : set}.${isHtml ? 'html' : 'pdf'}`)
      setMsg(r === 'declined' ? L('Cancelado', 'Cancelled') : L('Listo', 'Ready'))
      setTimeout(() => { setBusy(null); setOpen(false); setMsg('') }, 900)
    } catch (e) {
      console.error(e); setMsg(L('No se pudo crear el archivo', 'Could not create the file')); setTimeout(() => setBusy(null), 2200)
    }
  }
  return (
    <div className="pdf-wrap" ref={ref}>
      <button className="pdf-btn" onClick={() => setOpen(o => !o)} aria-expanded={open} title={L('Descargar informe (PDF o HTML)', 'Download report (PDF or HTML)')}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 20h14" /></svg><span>{L('Informe', 'Report')}</span>
      </button>
      {open && (
        <div className="pdf-pop" role="menu">
          <b>{L('Descargar informe', 'Download report')}</b>
          {items.map(([k, t, s]) => <button key={k} role="menuitem" disabled={!!busy} onClick={() => go(k)}><span>{t}</span><small>{busy === k ? msg : s}</small></button>)}
        </div>
      )}
    </div>
  )
}
