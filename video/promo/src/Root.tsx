import {Composition} from 'remotion';
import {Film, FILM_FRAMES} from './film/Film';

export const Root = () => (
  <>
    {/* YouTube y la ficha de Google Play */}
    <Composition id="Promo16x9" component={Film} defaultProps={{format: 'landing' as const}} durationInFrames={FILM_FRAMES} fps={30} width={1920} height={1080} />
    {/* Reels, Shorts e Historias: con subtítulos quemados */}
    <Composition id="Reel9x16" component={Film} defaultProps={{format: 'reel' as const}} durationInFrames={FILM_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
