import { useEffect, useRef, useState } from 'react'
import { FONTS, L, PALETTES, SETTINGS, saveSettings, type Font, type Lang, type Palette } from './settings'
import './styles/settings.css'

// el selector de idioma se muestra cuando la traducción al inglés esté completa
const SHOW_LANG = true

/** Engrane simétrico: 8 dientes trapezoidales alrededor de un anillo, con hueco central. */
const GEAR = (() => {
  const n = 8, R = 10.5, r = 8, hole = 3.4, c = 12
  const p = (a: number, rad: number) => `${(c + rad * Math.cos(a)).toFixed(3)} ${(c + rad * Math.sin(a)).toFixed(3)}`
  const step = (Math.PI * 2) / n, tip = step * 0.22, base = step * 0.3
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = i * step - Math.PI / 2
    d += `${i ? 'L' : 'M'}${p(a - base, r)} L${p(a - tip, R)} L${p(a + tip, R)} L${p(a + base, r)} `
    d += `A ${r} ${r} 0 0 1 ${p(a + step - base, r)} `
  }
  return `${d}Z M${c + hole} ${c} A ${hole} ${hole} 0 1 0 ${c - hole} ${c} A ${hole} ${hole} 0 1 0 ${c + hole} ${c} Z`
})()

/* Menú de ajustes (engrane): paleta, tipografía, idioma y logo. Cada cambio se guarda y recarga la página. */
export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown); window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])
  const S = SETTINGS
  return (
    <div className="cfg" ref={box}>
      <button className="cfg-btn" aria-label={L('Ajustes', 'Settings')} aria-expanded={open} onClick={() => setOpen(o => !o)} title={L('Ajustes: paleta, letra e idioma', 'Settings: palette, font and language')}>
        <svg viewBox="0 0 24 24" aria-hidden><path d={GEAR} fillRule="evenodd" /></svg>
      </button>
      {open && (
        <div className="cfg-panel" role="dialog" aria-label={L('Ajustes', 'Settings')}>
          <div className="cfg-head"><b>{L('Ajustes', 'Settings')}</b><span className="note">{L('Se guarda en este navegador. La página se recarga al cambiar.', 'Saved in this browser. The page reloads on change.')}</span></div>

          <div className="cfg-sec">{L('Paleta', 'Palette')}</div>
          <div className="cfg-pals">
            {PALETTES.map(p => (
              <button key={p.k} className="cfg-pal" aria-pressed={S.palette === p.k} onClick={() => S.palette !== p.k && saveSettings({ palette: p.k as Palette })}>
                <span className="cfg-sw" style={{ background: p.sw[0] }}>
                  <i style={{ background: p.sw[1] }} /><i style={{ background: p.sw[2] }} /><i style={{ background: p.sw[3] }} /><i style={{ background: p.sw[4] }} />
                </span>
                <span>{L(p.es, p.en)}{p.k === 'noche' && <small> · {L('por defecto', 'default')}</small>}</span>
              </button>
            ))}
          </div>

          <div className="cfg-sec">{L('Letra', 'Font')}</div>
          <div className="cfg-fonts">
            {FONTS.map(f => (
              <button key={f.k} className="cfg-font" aria-pressed={S.font === f.k} onClick={() => S.font !== f.k && saveSettings({ font: f.k as Font })} style={{ fontFamily: f.css }}>
                <span className="cfg-aa">Aa</span><span>{f.label}</span>
              </button>
            ))}
          </div>

          {SHOW_LANG && <>
          <div className="cfg-sec">{L('Idioma', 'Language')}</div>
          <div className="seg cfg-lang" role="group">
            {([['es', 'Español'], ['en', 'English']] as [Lang, string][]).map(([k, l]) => (
              <button key={k} aria-pressed={S.lang === k} onClick={() => S.lang !== k && saveSettings({ lang: k })}>{l}</button>
            ))}
          </div>
          </>}

        </div>
      )}
    </div>
  )
}
