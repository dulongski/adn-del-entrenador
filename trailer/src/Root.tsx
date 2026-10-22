import { Composition } from 'remotion'
import { Trailer } from './Trailer'
import { Demo, DEMO_TOTAL } from './Demo'
import { FPS } from './theme'

export const Root = () => (
  <>
    <Composition id="Trailer" component={Trailer} durationInFrames={26 * FPS} fps={FPS} width={1920} height={1080} />
    <Composition id="Demo" component={Demo} durationInFrames={DEMO_TOTAL} fps={FPS} width={1920} height={1080} />
  </>
)
