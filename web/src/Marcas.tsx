import isac from './assets/isac.svg?raw'
import { asset } from './lib'
import { L } from './settings'

/** Sello del evento: ISAC × Club América (el SVG de ISAC toma el color del texto, así se lee en ambos temas). */
export default function Marcas({ h = 22, label = true }: { h?: number; label?: boolean }) {
  return (
    <span className="marcas" style={{ ['--mh' as string]: `${h}px` }}>
      {label && <span className="marcas-l">{L('Hackathon', 'Hackathon')}</span>}
      <span className="marcas-isac" role="img" aria-label="ISAC · ITAM Sports Analytics Conference" dangerouslySetInnerHTML={{ __html: isac }} />
      <span className="marcas-x" aria-hidden>×</span>
      <img className="marcas-ame" src={asset('media/marcas/america.png') ?? undefined} alt="Club América" />
    </span>
  )
}
