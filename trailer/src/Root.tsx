import { Composition } from 'remotion'
import { Trailer } from './Trailer'
import { FPS } from './theme'

export const Root = () => (
  <Composition id="Trailer" component={Trailer} durationInFrames={26 * FPS} fps={FPS} width={1920} height={1080} />
)
