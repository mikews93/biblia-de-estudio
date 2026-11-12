import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ease, glide, progress} from '../motion';
import {c, fonts} from '../theme';

/* ── Fondo: grafito con la luz cálida de la llama ──────────────────────── */

export const Sky = ({glowX, glowY, glow}: {glowX: number; glowY: number; glow: number}) => (
  <AbsoluteFill style={{background: c.night}}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 55% 60% at ${glowX}px ${glowY}px, rgba(226,168,104,${0.16 * glow}), rgba(148,86,26,${0.06 * glow}) 45%, transparent 75%)`,
      }}
    />
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)'}} />
  </AbsoluteFill>
);

/* ── El teléfono y sus pantallas reales ────────────────────────────────── */

/** Las capturas son de un Pixel 7 (412×915 a 2,625×). */
export const SHOT_W = 1082;
export const SHOT_H = 2402;
export const BEZEL = 12;

/** Una pantalla en el tiempo: `at` = cuadro en que aparece; `scroll` baja la captura (px de la captura); `tap` = dónde se toca antes de la siguiente. */
export type Shot = {at: number; src: string; scroll?: number; tap?: {x: number; y: number}};

export const phoneSize = (screenH: number) => {
  const w = (screenH * SHOT_W) / SHOT_H;
  return {w: w + BEZEL * 2, h: screenH + BEZEL * 2, screenW: w, screenH};
};

export const Phone = ({screenH, style, children}: {screenH: number; style?: CSSProperties; children: ReactNode}) => {
  const s = phoneSize(screenH);
  return (
    <div
      style={{
        position: 'absolute',
        width: s.w,
        height: s.h,
        borderRadius: s.w * 0.13,
        padding: BEZEL,
        background: 'linear-gradient(160deg, #3A3835, #1A1918 40%, #0B0A0A)',
        boxShadow: '0 60px 120px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(255,255,255,0.07) inset',
        ...style,
      }}
    >
      <div style={{width: '100%', height: '100%', borderRadius: s.w * 0.11, overflow: 'hidden', background: c.background, position: 'relative'}}>{children}</div>
    </div>
  );
};

const TAP_LEAD = 18;

/** Las pantallas de un teléfono: cada una entra subiendo un poco sobre la anterior; antes de cambiar, un toque ámbar. */
export const Screens = ({shots, screenH}: {shots: Shot[]; screenH: number}) => {
  const f = useCurrentFrame();
  const scale = screenH / SHOT_H;
  return (
    <>
      {shots.map((s, i) => {
        const next = shots[i + 1]?.at ?? Infinity;
        if (f < s.at - 1 || f > next + 14) return null;
        const t = i === 0 ? 1 : progress(f, s.at, 14, ease.quintOut);
        const scrolled = s.scroll ? progress(f, s.at + 12, Math.max(20, Math.min(next, s.at + 140) - s.at - 24), ease.quintInOut) * s.scroll : 0;
        return (
          <div key={s.src + s.at} style={{position: 'absolute', inset: 0, opacity: t, transform: `translateY(${(1 - t) * 4}%)`}}>
            <Img
              src={staticFile(`capturas/${s.src}.png`)}
              style={s.scroll ? {width: '100%', display: 'block', transform: `translateY(${-scrolled * scale}px)`} : {width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block'}}
            />
            {s.tap && <Tap x={s.tap.x * scale} y={(s.tap.y - (s.scroll ?? 0)) * scale} at={next - TAP_LEAD} />}
          </div>
        );
      })}
    </>
  );
};

/** El dedo: un punto que se aprieta y una onda que se abre. */
const Tap = ({x, y, at}: {x: number; y: number; at: number}) => {
  const f = useCurrentFrame();
  if (f < at - 8 || f > at + 22) return null;
  const press = interpolate(f, [at - 8, at, at + 6, at + 14], [0, 1, 0.85, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ring = progress(f, at, 20, ease.expoOut);
  return (
    <>
      <div style={{position: 'absolute', left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: 34, background: 'rgba(236,234,230,0.28)', transform: `scale(${0.6 + press * 0.4})`, opacity: press}} />
      <div style={{position: 'absolute', left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: 34, border: `3px solid ${c.warm}`, transform: `scale(${0.8 + ring * 1.4})`, opacity: (1 - ring) * (f >= at ? 1 : 0)}} />
    </>
  );
};

/* ── Titulares ─────────────────────────────────────────────────────────── */

/** Un antetítulo en versalitas ámbar y un título que sube palabra por palabra desde su máscara. */
export const Headline = ({eyebrow, title, from, to, size, align, maxWidth}: {eyebrow: string; title: string; from: number; to: number; size: number; align: 'left' | 'center'; maxWidth: number}) => {
  const f = useCurrentFrame();
  if (f < from || f > to + 2) return null;
  const words = title.split(' ');
  const out = progress(f, to - 10, 10, ease.exitIn);
  const e = progress(f, from, 16, ease.expoOut);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', gap: size * 0.32, maxWidth}}>
      <div style={{overflow: 'hidden'}}>
        <div style={{fontFamily: fonts.sans, fontWeight: 600, fontSize: size * 0.27, letterSpacing: size * 0.06, color: c.warm, transform: `translateY(${(1 - e) * 110 + out * -110}%)`, display: 'flex', alignItems: 'center', gap: 14}}>
          <span style={{width: size * 0.42, height: 2, background: c.warm, display: 'inline-block', transform: `scaleX(${e})`, transformOrigin: 'left'}} />
          {eyebrow}
        </div>
      </div>
      <div style={{fontFamily: fonts.display, fontWeight: 400, fontSize: size, lineHeight: 1.06, letterSpacing: -size * 0.02, color: c.text, display: 'flex', flexWrap: 'wrap', columnGap: size * 0.24, justifyContent: align === 'center' ? 'center' : 'flex-start'}}>
        {words.map((w, i) => {
          const t = progress(f, from + 4 + i * 3, 18, ease.expoOut);
          return (
            <span key={i} style={{overflow: 'hidden', display: 'inline-block', paddingBottom: size * 0.14, marginBottom: -size * 0.14}}>
              <span style={{display: 'inline-block', transform: `translateY(${(1 - t) * 110 + out * -110}%)`}}>{w}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Sube con la curva de la interfaz (sin rebote). */
export const useGlide = (start: number) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return glide(f, fps, start);
};
