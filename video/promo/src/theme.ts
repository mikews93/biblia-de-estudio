import {continueRender, delayRender, staticFile} from 'remotion';

// Los colores del tema oscuro de la app (src/lib/theme.ts): grafito, con el ámbar solo en lo destacado.
export const c = {
  night: '#0D0C0B',
  background: '#131313',
  surface: '#1C1C1B',
  text: '#ECEAE6',
  muted: '#9D9A94',
  border: '#302F2D',
  warm: '#E2A868',
  warmDeep: '#94561A',
  flameLow: '#B83A12',
  flameMid: '#F08A2C',
  flameHigh: '#FFD27A',
  flameTip: '#FFF1C9',
};

// Las letras van dentro del proyecto (public/fonts, ambas con licencia OFL): el render no depende de la red.
const FACES = [
  new FontFace('Fraunces', `url(${staticFile('fonts/fraunces.woff2')}) format('woff2')`, {weight: '100 900', style: 'normal'}),
  new FontFace('Fraunces', `url(${staticFile('fonts/fraunces-italic.woff2')}) format('woff2')`, {weight: '100 900', style: 'italic'}),
  new FontFace('Inter', `url(${staticFile('fonts/inter.woff2')}) format('woff2')`, {weight: '100 900', style: 'normal'}),
];
const waiting = delayRender('letras');
Promise.all(FACES.map((face) => face.load().then((f) => document.fonts.add(f)))).then(() => continueRender(waiting));

export const fonts = {display: 'Fraunces', sans: 'Inter'};

export type Format = 'landing' | 'reel';
export const per = <T,>(format: Format, v: {landing: T; reel: T}): T => v[format];
