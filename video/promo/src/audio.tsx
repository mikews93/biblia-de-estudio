import {getStaticFiles, Html5Audio, interpolate, Sequence, staticFile} from 'remotion';
import raw from '../script.json';
import timingRaw from './vo-timing.json';

/**
 * El sonido de los dos cortes: la voz de Abel (script.json → public/vo/, de scripts/vo.ts) sobre la música
 * compuesta para el video (public/music/zarza-promo.mp3, de scripts/musica.ts), que baja bajo la voz como
 * en el demo de DeusRex. El volumen final lo ajusta la exportación (−16 LUFS).
 */
export type VoWord = {w: string; start: number; end: number};
export type VoTiming = {duration: number; speechStart: number; speechEnd: number; method: string; words: VoWord[]};
export const script = raw as {fps: number; lines: {id: string; at: number; text: string}[]};
export const voTiming = timingRaw as Record<string, VoTiming>;

export type Cue = {id: string; at: number};
const FPS = 30;
export const MUSIC = 'music/zarza-promo.mp3';
/** Si falta la música compuesta, el pad de piano de la app (sin licencias). */
export const MUSIC_FALLBACK = 'music/piano.mp3';
const has = (path: string) => getStaticFiles().some((x) => x.name === path);

/** Cada frase empieza en su segundo de script.json. */
export const FILM_VO: Cue[] = script.lines.map(({id, at}) => ({id, at: Math.round(at * FPS)}));

const speaking = (cues: Cue[]) =>
  cues.map(({id, at}) => {
    const t = voTiming[id];
    return [at + t.speechStart * FPS, at + t.speechEnd * FPS] as const;
  });

const BED = 0.6;
const DUCKED = BED * 0.32;
const ATTACK = 4;
const RELEASE = 15;

export const bedVolume = (f: number, cues: Cue[], total: number, fadeIn = 4, fadeOut = 24) => {
  let duck = 0;
  for (const [a, b] of speaking(cues)) {
    const into = interpolate(f, [a - ATTACK, a], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const out = interpolate(f, [b, b + RELEASE], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    duck = Math.max(duck, Math.min(into, out));
  }
  const fade = interpolate(f, [0, fadeIn, total - fadeOut, total - 1], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (BED - (BED - DUCKED) * duck) * fade;
};

export const Soundtrack = ({cues, total}: {cues: Cue[]; total: number}) => {
  const music = has(MUSIC) ? MUSIC : has(MUSIC_FALLBACK) ? MUSIC_FALLBACK : null;
  return (
    <>
      {music && <Html5Audio src={staticFile(music)} volume={(f) => bedVolume(f, cues, total)} />}
      {cues.map(({id, at}) =>
        has(`vo/${id}.mp3`) ? (
          <Sequence key={id} from={at} durationInFrames={Math.ceil(voTiming[id].duration * FPS) + 2} layout="none">
            <Html5Audio src={staticFile(`vo/${id}.mp3`)} />
          </Sequence>
        ) : null,
      )}
    </>
  );
};
