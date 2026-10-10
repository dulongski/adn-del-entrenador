import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applySettings } from './settings'

applySettings()

const qs = new URLSearchParams(location.search)
const rid = qs.get('report')
if (rid) {
  // vista de prueba del informe PDF (sólo para revisar el diseño)
  import('./report/Report').then(({ ReportPreview, SETS }) => {
    const set = qs.get('pages') ?? 'cover'
    const keys = (SETS[set] ?? set.split(',')) as never
    createRoot(document.getElementById('root')!).render(<ReportPreview id={Number(rid)} keys={keys} />)
  })
} else createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
