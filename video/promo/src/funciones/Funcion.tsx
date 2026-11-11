import {AbsoluteFill, Html5Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {VoTiming} from '../audio';
import {Llama} from '../components/Llama';
import {ease, glide, progress} from '../motion';
import {c, fonts} from '../theme';
import {Headline, Phone, phoneSize, Screens, type Shot, Sky} from '../film/kit';
import {FUNCIONES, type Funcion as Datos} from './datos';

/**
 * Un video vertical (9:16) por función de Zarza, para pasarlo por Rvela (subtítulos, música y marca):
 * la llama y una pregunta, el teléfono con las pantallas reales mientras Abel explica, y el cierre.
 * Sin música ni subtítulos propios: los pone Rvela.
 */
const FPS = 30;
const GAP = 0.55; // aire entre frases (s)
const START = 0.4;

/** Cuándo empieza cada frase (cuadro), una detrás de otra. */
export const plan = (d: Datos) => {
  const ids = Object.keys(d.timing);
  const at: Record<string, number> = {};
  let t = START;
  for (const id of ids) {
    at[id] = Math.round(t * FPS);
    t += d.timing[id].speechEnd + GAP;
  }
  const last = ids[ids.length - 1];
  const total = at[last] + Math.ceil((d.timing[last].duration + 1.6) * FPS);
  return {ids, at, total, cta: at[last]};
};

const wordAt = (t: VoTiming, word: string) => t.words.find((w) => w.w === word)?.start ?? 0;

export const duracion = (id: string) => plan(FUNCIONES[id]).total;

// Rvela pone su logo arriba a la derecha y los subtítulos a media altura: el titular va bajo el logo, y
// el gancho y el cierre dejan libre el centro.
const SCREEN_H = 1240;
const PHONE_Y = 1235;

export const Funcion = ({id}: {id: string}) => {
  const d = FUNCIONES[id];
  const f = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const {ids, at, cta} = plan(d);
  const phoneIn = at[ids[1]] - 8;
  const leave = progress(f, cta - 6, 20, ease.exitIn);
  const enter = glide(f, fps, phoneIn);
  const ph = phoneSize(SCREEN_H);
  const py = PHONE_Y + (1 - enter) * height * 0.75 + leave * height * 0.3;
  const breathe = 1 + Math.min(1, Math.max(0, (f - phoneIn) / 900)) * 0.035;

  const shots: Shot[] = d.pantallas.map((p) => {
    const base = at[p.line] + Math.round((p.word ? wordAt(d.timing[p.line], p.word) : 0) * FPS) + (p.delay ?? 0);
    return {at: base, src: `funciones/${id}/${p.src}`, tap: d.taps[p.src] ?? undefined};
  });
  shots[0] = {...shots[0], at: phoneIn};
  // El último toque no lleva a otra pantalla: se quita.
  shots[shots.length - 1] = {...shots[shots.length - 1], tap: undefined};

  const glowOn = progress(f, phoneIn, 40) - progress(f, cta, 30);
  const titulares = d.titulares.map((h, i) => {
    const from = at[h.line] - 4;
    const next = d.titulares[i + 1] ? at[d.titulares[i + 1].line] - 8 : cta - 6;
    return {...h, from, to: next};
  });

  return (
    <AbsoluteFill style={{overflow: 'hidden', fontFamily: fonts.sans}}>
      <Sky glowX={width / 2} glowY={interpolate(glowOn, [0, 1], [height * 0.42, py])} glow={1} />
      {f < phoneIn + 30 && <Hook d={d} start={at[ids[0]]} out={phoneIn} />}
      {f >= phoneIn - 2 && f < cta + 30 && (
        <Phone screenH={SCREEN_H} style={{left: width / 2 - ph.w / 2, top: py - ph.h / 2, opacity: 1 - leave, transform: `scale(${breathe}) rotate(${(1 - enter) * 4}deg)`, zIndex: 3}}>
          <Screens shots={shots} screenH={SCREEN_H} />
        </Phone>
      )}
      <div style={{position: 'absolute', left: 0, right: 0, top: 400, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'center', zIndex: 5}}>
        {titulares.map((h) => (
          <Headline key={h.line} eyebrow={h.eyebrow} title={h.title} from={h.from} to={h.to} size={68} align="center" maxWidth={900} />
        ))}
      </div>
      {f >= cta && <Cta at={cta} />}
      {ids.map((line) => (
        <Sequence key={line} from={at[line]} durationInFrames={Math.ceil(d.timing[line].duration * FPS) + 2} layout="none">
          <Html5Audio src={staticFile(`vo/funciones/${id}/${line}.mp3`)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** La llama sola, arriba: la pregunta la dice Abel y la escriben los subtítulos de Rvela. */
const Hook = ({out: outAt}: {d: Datos; start: number; out: number}) => {
  const f = useCurrentFrame();
  const out = progress(f, outAt - 14, 20, ease.exitIn);
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 330, opacity: 1 - out, transform: `translateY(${-out * 60}px)`}}>
      <div style={{transform: `scale(${1 + f * 0.0006})`}}>
        <Llama size={420} start={2} />
      </div>
    </AbsoluteFill>
  );
};

const Cta = ({at: start}: {at: number}) => {
  const f = useCurrentFrame();
  const at = start + 6;
  const name = progress(f, at + 14, 22, ease.expoOut);
  const motto = progress(f, at + 34, 22, ease.expoOut);
  const store = progress(f, at + 56, 20, ease.quintOut);
  return (
    <AbsoluteFill style={{alignItems: 'center', flexDirection: 'column', paddingTop: 230}}>
      <Llama size={300} start={at} glow={1.3} />
      <div style={{overflow: 'hidden', marginTop: 20}}>
        <div style={{fontFamily: fonts.display, fontSize: 160, color: c.text, letterSpacing: -3, lineHeight: 1.1, transform: `translateY(${(1 - name) * 105}%)`}}>Zarza</div>
      </div>
      <div style={{fontFamily: fonts.display, fontStyle: 'italic', fontSize: 52, color: c.warm, opacity: motto, transform: `translateY(${(1 - motto) * 20}px)`, marginTop: 4}}>
        La Biblia de estudio
      </div>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, position: 'absolute', top: 1330, opacity: store, transform: `translateY(${(1 - store) * 24}px)`}}>
        <div style={{fontFamily: fonts.sans, fontWeight: 600, fontSize: 40, color: c.night, background: c.warm, padding: '22px 44px', borderRadius: 999}}>Gratis en Google Play</div>
        <div style={{fontFamily: fonts.sans, fontWeight: 500, fontSize: 40, color: c.text, letterSpacing: 0.5}}>zarzabiblia.com</div>
      </div>
    </AbsoluteFill>
  );
};
