import {Composition} from 'remotion';
import {Film, FILM_FRAMES} from './film/Film';
import {duracion, Funcion} from './funciones/Funcion';
import {FUNCIONES} from './funciones/datos';

export const Root = () => (
  <>
    {/* YouTube y la ficha de Google Play */}
    <Composition id="Promo16x9" component={Film} defaultProps={{format: 'landing' as const}} durationInFrames={FILM_FRAMES} fps={30} width={1920} height={1080} />
    {/* Reels, Shorts e Historias: con subtítulos quemados */}
    <Composition id="Reel9x16" component={Film} defaultProps={{format: 'reel' as const}} durationInFrames={FILM_FRAMES} fps={30} width={1080} height={1920} />
    {/* Un video vertical por función (para Rvela) */}
    {Object.keys(FUNCIONES).map((id) => (
      <Composition key={id} id={`fn-${id}`} component={Funcion} defaultProps={{id}} durationInFrames={duracion(id)} fps={30} width={1080} height={1920} />
    ))}
  </>
);
