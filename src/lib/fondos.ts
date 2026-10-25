import { useEffect, useState } from 'react';

// Fondos y tipos de letra para la imagen de un versículo.
//
// Las ilustraciones son dibujos propios hechos en código (SVG), así que no hay licencias de fotos que cuidar: el mismo
// SVG se pinta con react-native-svg en la vista previa del teléfono y, en la web, se dibuja en el canvas de la imagen.
// Las letras son de Google Fonts con licencia libre SIL Open Font License (paquetes @expo-google-fonts/*) y se cargan
// solo al abrir la hoja de compartir.

export type GrupoFondo = 'ilustracion' | 'color';

export type Fondo = {
  /** Nombre visible; las publicaciones del muro lo guardan para dibujarse igual. */
  name: string;
  grupo: GrupoFondo;
  /** Color de fondo (el de la muestra y el que se ve mientras carga el dibujo). */
  background: string;
  text: string;
  accent: string;
  muted: string;
  /** El dibujo del fondo, en un lienzo de w × h. */
  svg?: (w: number, h: number) => string;
  /** Sombra suave bajo la letra, para leerse bien sobre un dibujo. */
  sombra?: string;
};

/** Números pseudoaleatorios repetibles: las estrellas quedan en el mismo sitio en la vista previa y en la imagen. */
function azar(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);
const svgDoc = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

const lineal = (id: string, stops: [number, string, number?][], vertical = true) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</linearGradient>`;

const radial = (id: string, cx: number, cy: number, r: number, color: string, a: number) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${color}" stop-opacity="${a}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

/** Una línea de montes: ondas suaves entre `y` y `y - alto`. */
function montes(w: number, h: number, y: number, alto: number, picos: number, semilla: number, color: string) {
  const r = azar(semilla);
  const paso = w / picos;
  let d = `M0 ${f(y - r() * alto * 0.4)}`;
  for (let i = 0; i < picos; i++) {
    const x1 = i * paso + paso * 0.5;
    const top = y - alto * (0.55 + r() * 0.45);
    const x2 = (i + 1) * paso;
    const base = y - alto * r() * 0.35;
    d += ` Q${f(x1)} ${f(top)} ${f(x2)} ${f(base)}`;
  }
  return `<path d="${d} L${w} ${h} L0 ${h} Z" fill="${color}"/>`;
}

function estrellas(w: number, h: number, n: number, hasta: number, semilla: number) {
  const r = azar(semilla);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h * hasta;
    const s = 0.8 + r() * 2.6;
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="#FFF8E7" opacity="${f(0.35 + r() * 0.6)}"/>`;
  }
  return out;
}

/** Una rama de olivo dibujada con línea, desde (x, y) en el ángulo dado: hojas largas a los dos lados y dos aceitunas. */
function ramaOlivo(x: number, y: number, largo: number, angulo: number, color: string) {
  const hojas = 10;
  const trazo = f(largo / 150);
  let out = `<g transform="translate(${f(x)} ${f(y)}) rotate(${angulo})" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round">`;
  out += `<path d="M0 0 Q${f(largo * 0.5)} ${f(-largo * 0.06)} ${f(largo)} ${f(-largo * 0.02)}" fill="none"/>`;
  for (let i = 0; i < hojas; i++) {
    const t = 0.1 + (i / hojas) * 0.85;
    const px = largo * t;
    const py = -largo * 0.06 * 4 * t * (1 - t);
    const lado = i % 2 ? 1 : -1;
    const l = largo * 0.24 * (1 - t * 0.4);
    // Cada hoja es una elipse que sale del tallo en diagonal hacia la punta.
    out += `<ellipse cx="${f(px + l * 0.55)}" cy="${f(py)}" rx="${f(l * 0.55)}" ry="${f(l * 0.19)}" transform="rotate(${lado * 38} ${f(px)} ${f(py)})" fill="${color}" fill-opacity="0.3"/>`;
  }
  out += `<ellipse cx="${f(largo * 0.55)}" cy="${f(largo * 0.07)}" rx="${f(largo * 0.032)}" ry="${f(largo * 0.042)}" fill="${color}" fill-opacity="0.55" stroke="none"/>`;
  out += `<ellipse cx="${f(largo * 0.34)}" cy="${f(largo * 0.06)}" rx="${f(largo * 0.028)}" ry="${f(largo * 0.038)}" fill="${color}" fill-opacity="0.45" stroke="none"/>`;
  return out + '</g>';
}

/** Una espiga de trigo vertical con su base en (x, y). */
function espiga(x: number, y: number, alto: number, inclina: number, color: string) {
  const grano = alto * 0.045;
  let out = `<g transform="translate(${f(x)} ${f(y)}) rotate(${inclina})" stroke="${color}" stroke-linecap="round" fill="${color}">`;
  out += `<path d="M0 0 Q${f(alto * 0.04)} ${f(-alto * 0.5)} 0 ${f(-alto)}" fill="none" stroke-width="${f(alto * 0.012)}"/>`;
  for (let i = 0; i < 8; i++) {
    const gy = -alto * (0.68 + i * 0.04);
    out += `<ellipse cx="${f(-grano * 0.9)}" cy="${f(gy)}" rx="${f(grano * 0.5)}" ry="${f(grano)}" transform="rotate(-24 ${f(-grano * 0.9)} ${f(gy)})" stroke="none" opacity="0.85"/>`;
    out += `<ellipse cx="${f(grano * 0.9)}" cy="${f(gy)}" rx="${f(grano * 0.5)}" ry="${f(grano)}" transform="rotate(24 ${f(grano * 0.9)} ${f(gy)})" stroke="none" opacity="0.85"/>`;
  }
  return out + '</g>';
}

function olas(w: number, y: number, alto: number, n: number, color: string, ancho: number, opacidad: number) {
  const paso = w / n;
  let d = `M0 ${f(y)}`;
  for (let i = 0; i < n; i++) d += ` q${f(paso / 4)} ${f(-alto)} ${f(paso / 2)} 0 t${f(paso / 2)} 0`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f(ancho)}" stroke-linecap="round" opacity="${opacidad}"/>`;
}

const SOMBRA_OSCURA = 'rgba(0,0,0,0.35)';

export const FONDOS: Fondo[] = [
  {
    name: 'Amanecer',
    grupo: 'ilustracion',
    background: '#B8695A',
    text: '#FFF8EE',
    accent: '#FFE2B8',
    muted: '#FBE3D2',
    sombra: 'rgba(60,20,20,0.35)',
    svg: (w, h) =>
      svgDoc(
        w,
        h,
        `<defs>${lineal('c', [[0, '#3A3F66'], [0.5, '#B8695A'], [0.8, '#EBA46F'], [1, '#F6D49A']])}${radial('s', w / 2, h * 0.93, w * 0.6, '#FFE6B0', 0.6)}</defs>` +
          `<rect width="${w}" height="${h}" fill="url(#c)"/><rect width="${w}" height="${h}" fill="url(#s)"/>` +
          `<circle cx="${w / 2}" cy="${f(h * 0.93)}" r="${f(w * 0.1)}" fill="#FFF1D0" opacity="0.95"/>` +
          estrellas(w, h, 40, 0.25, 7) +
          montes(w, h, h * 0.95, h * 0.05, 4, 11, '#7A4A4F') +
          montes(w, h, h * 0.99, h * 0.045, 3, 23, '#4E3140'),
      ),
  },
  {
    name: 'Montes',
    grupo: 'ilustracion',
    background: '#5E7389',
    text: '#FFFFFF',
    accent: '#F3D9A4',
    muted: '#DCE5EE',
    sombra: 'rgba(20,30,50,0.4)',
    svg: (w, h) =>
      svgDoc(
        w,
        h,
        `<defs>${lineal('c', [[0, '#8FA5BA'], [0.6, '#C9D4DC'], [1, '#E8E1D6']])}</defs>` +
          `<rect width="${w}" height="${h}" fill="url(#c)"/>` +
          montes(w, h, h * 0.78, h * 0.16, 3, 5, '#9AAABB') +
          montes(w, h, h * 0.86, h * 0.14, 4, 9, '#73879C') +
          montes(w, h, h * 0.93, h * 0.12, 5, 13, '#4E6278') +
          montes(w, h, h * 1.0, h * 0.09, 3, 17, '#33445A') +
          `<rect width="${w}" height="${h}" fill="#1E2B3C" opacity="0.28"/>`,
      ),
  },
  {
    name: 'Mar',
    grupo: 'ilustracion',
    background: '#2C5E6E',
    text: '#F6FBFB',
    accent: '#F2D49B',
    muted: '#C9E0E4',
    sombra: SOMBRA_OSCURA,
    svg: (w, h) => {
      let o = '';
      for (let i = 0; i < 7; i++) o += olas(w, h * (0.78 + i * 0.035), h * 0.008, 6 + i, '#E6F3F2', w * 0.0035, 0.18 + i * 0.05);
      return svgDoc(
        w,
        h,
        `<defs>${lineal('c', [[0, '#173A4C'], [0.55, '#2C5E6E'], [1, '#4F8A8B']])}${radial('l', w * 0.5, h * 0.12, w * 0.8, '#F8E3B5', 0.28)}</defs>` +
          `<rect width="${w}" height="${h}" fill="url(#c)"/><rect width="${w}" height="${h}" fill="url(#l)"/>${o}`,
      );
    },
  },
  {
    name: 'Estrellas',
    grupo: 'ilustracion',
    background: '#141A33',
    text: '#F4EFE3',
    accent: '#E9C37E',
    muted: '#A9B0C8',
    sombra: SOMBRA_OSCURA,
    svg: (w, h) =>
      svgDoc(
        w,
        h,
        `<defs>${lineal('c', [[0, '#0B1026'], [0.7, '#1C2448'], [1, '#33325A']])}${radial('g', w * 0.78, h * 0.12, w * 0.3, '#F7E7B9', 0.35)}</defs>` +
          `<rect width="${w}" height="${h}" fill="url(#c)"/>` +
          estrellas(w, h, Math.round((w * h) / 13000), 1, 3) +
          `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
          `<path d="M${f(w * 0.78)} ${f(h * 0.12 - w * 0.06)} a${f(w * 0.06)} ${f(w * 0.06)} 0 1 0 ${f(w * 0.05)} ${f(w * 0.1)} a${f(w * 0.075)} ${f(w * 0.075)} 0 0 1 ${f(-w * 0.05)} ${f(-w * 0.1)}z" fill="#F7E7B9"/>` +
          montes(w, h, h, h * 0.05, 5, 31, '#090C1C'),
      ),
  },
  {
    name: 'Olivo',
    grupo: 'ilustracion',
    background: '#F3EEE2',
    text: '#2F3326',
    accent: '#6C7A45',
    muted: '#7D7F6E',
    svg: (w, h) =>
      svgDoc(
        w,
        h,
        `<rect width="${w}" height="${h}" fill="#F3EEE2"/>` +
          ramaOlivo(-w * 0.02, w * 0.3, w * 0.44, -36, '#6C7A45') +
          ramaOlivo(w * 1.02, h - w * 0.3, w * 0.44, 144, '#6C7A45') +
          `<rect x="${f(w * 0.04)}" y="${f(w * 0.04)}" width="${f(w * 0.92)}" height="${f(h - w * 0.08)}" fill="none" stroke="#6C7A45" stroke-opacity="0.25" stroke-width="2"/>`,
      ),
  },
  {
    name: 'Trigal',
    grupo: 'ilustracion',
    background: '#E9C88B',
    text: '#3D2A12',
    accent: '#8A5A1E',
    muted: '#6E5532',
    svg: (w, h) => {
      const r = azar(41);
      let campo = '';
      for (let i = 0; i < 22; i++)
        campo += espiga(r() * w, h * (1.02 + r() * 0.04), h * (0.16 + r() * 0.1), -14 + r() * 28, i % 3 ? '#B98838' : '#9C6E27');
      return svgDoc(
        w,
        h,
        `<defs>${lineal('c', [[0, '#F7E9C6'], [0.6, '#EFD39C'], [1, '#D9A95C']])}${radial('s', w * 0.5, h * 0.2, w * 0.7, '#FFF8E2', 0.7)}</defs>` +
          `<rect width="${w}" height="${h}" fill="url(#c)"/><rect width="${w}" height="${h}" fill="url(#s)"/>${campo}`,
      );
    },
  },
  {
    name: 'Luz',
    grupo: 'ilustracion',
    background: '#F7EBDD',
    text: '#3A2C24',
    accent: '#B5652F',
    muted: '#86705F',
    svg: (w, h) => {
      let rayos = '';
      const cx = w / 2;
      const cy = -h * 0.08;
      for (let i = 0; i < 13; i++) {
        const a = Math.PI * (0.12 + (i / 12) * 0.76);
        const a2 = a + 0.035;
        const L = h * 1.4;
        rayos += `<path d="M${f(cx)} ${f(cy)} L${f(cx + Math.cos(a) * L)} ${f(cy + Math.sin(a) * L)} L${f(cx + Math.cos(a2) * L)} ${f(cy + Math.sin(a2) * L)}Z" fill="#FFFFFF" opacity="${i % 2 ? 0.28 : 0.45}"/>`;
      }
      return svgDoc(
        w,
        h,
        `<defs>${lineal('c', [[0, '#FBE7C8'], [1, '#EFD9D2']])}${radial('s', cx, 0, w * 0.75, '#FFFFFF', 0.85)}</defs>` +
          `<rect width="${w}" height="${h}" fill="url(#c)"/>${rayos}<rect width="${w}" height="${h}" fill="url(#s)"/>`,
      );
    },
  },
  {
    name: 'Zarza',
    grupo: 'ilustracion',
    background: '#1A1513',
    text: '#F5EBDD',
    accent: '#F0A65A',
    muted: '#B9A794',
    sombra: SOMBRA_OSCURA,
    svg: (w, h) => {
      const cx = w / 2;
      const base = h * 1.0;
      const s = w * 0.42;
      const llama = (k: number, color: string, a: number) =>
        `<path d="M${f(cx)} ${f(base - s * 1.5 * k)} C${f(cx + s * 0.25 * k)} ${f(base - s * 1.05 * k)} ${f(cx + s * 0.75 * k)} ${f(base - s * 0.85 * k)} ${f(cx + s * 0.6 * k)} ${f(base - s * 0.25 * k)} C${f(cx + s * 0.55 * k)} ${f(base)} ${f(cx - s * 0.55 * k)} ${f(base)} ${f(cx - s * 0.6 * k)} ${f(base - s * 0.25 * k)} C${f(cx - s * 0.75 * k)} ${f(base - s * 0.85 * k)} ${f(cx - s * 0.25 * k)} ${f(base - s * 1.05 * k)} ${f(cx)} ${f(base - s * 1.5 * k)}Z" fill="${color}" opacity="${a}"/>`;
      return svgDoc(
        w,
        h,
        `<defs>${lineal('c', [[0, '#120E0D'], [1, '#2B1D16']])}${radial('g', cx, base - s * 0.4, w * 0.75, '#E07B32', 0.45)}</defs>` +
          `<rect width="${w}" height="${h}" fill="url(#c)"/><rect width="${w}" height="${h}" fill="url(#g)"/>` +
          llama(1, '#B4532A', 0.55) +
          llama(0.72, '#E07B32', 0.6) +
          llama(0.45, '#F6C36B', 0.7),
      );
    },
  },
  {
    name: 'Acuarela',
    grupo: 'ilustracion',
    background: '#F6F0EA',
    text: '#3B3340',
    accent: '#9A5B7A',
    muted: '#7E7382',
    svg: (w, h) => {
      const r = azar(57);
      const tonos = ['#E7B7B0', '#B9CBE3', '#E9D3A6', '#C8D9C0', '#D7BFDC'];
      let manchas = '';
      let defs = '';
      for (let i = 0; i < 9; i++) {
        const borde = i % 2 ? r() * 0.25 : 0.75 + r() * 0.25;
        const x = (i % 3 === 0 ? borde : r()) * w;
        const y = (i % 3 === 0 ? r() : borde) * h;
        const rad = w * (0.25 + r() * 0.25);
        defs += radial(`m${i}`, x, y, rad, tonos[i % tonos.length], 0.6);
        manchas += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad)}" fill="url(#m${i})"/>`;
      }
      return svgDoc(w, h, `<defs>${defs}</defs><rect width="${w}" height="${h}" fill="#F8F3EC"/>${manchas}`);
    },
  },
  // Colores lisos y degradados. Los cuatro primeros son los de siempre (las publicaciones del muro los guardan por nombre).
  { name: 'Pergamino', grupo: 'color', background: '#F4ECD8', text: '#3B2F22', accent: '#8A4B2A', muted: '#7A6A55' },
  { name: 'Noche', grupo: 'color', background: '#151311', text: '#EDE7DE', accent: '#E0A07A', muted: '#A39A8E' },
  { name: 'Terracota', grupo: 'color', background: '#8A4B2A', text: '#FBF5E6', accent: '#F3E6DC', muted: '#EADBC0' },
  { name: 'Azul', grupo: 'color', background: '#2F4A6B', text: '#F4F1EA', accent: '#E8C99A', muted: '#C9D3DF' },
  { name: 'Grafito', grupo: 'color', background: '#1F1F1F', text: '#F2EFEA', accent: '#E8A33D', muted: '#A8A39B' },
  { name: 'Salvia', grupo: 'color', background: '#7B8B6F', text: '#FAF8F1', accent: '#F3E2B3', muted: '#E1E6D8' },
  { name: 'Rosa', grupo: 'color', background: '#EBD3CB', text: '#4A2E2C', accent: '#A4504A', muted: '#7F625D' },
  {
    name: 'Atardecer',
    grupo: 'color',
    background: '#C9706A',
    text: '#FFF8F0',
    accent: '#FFE0B5',
    muted: '#FBE0D6',
    sombra: 'rgba(80,20,30,0.3)',
    svg: (w, h) => svgDoc(w, h, `<defs>${lineal('c', [[0, '#6E4A7E'], [0.55, '#C9706A'], [1, '#F0B27A']])}</defs><rect width="${w}" height="${h}" fill="url(#c)"/>`),
  },
  {
    name: 'Océano',
    grupo: 'color',
    background: '#1F4B66',
    text: '#F2F8FA',
    accent: '#9FE0D4',
    muted: '#BFD6E0',
    svg: (w, h) => svgDoc(w, h, `<defs>${lineal('c', [[0, '#13263F'], [1, '#2C7A86']])}</defs><rect width="${w}" height="${h}" fill="url(#c)"/>`),
  },
];

/**
 * Pone un prefijo a los id del dibujo. En la web todos los SVG de la página comparten los id, y sin esto la muestra
 * de un fondo podía tomar el degradado de otro.
 */
export const idsUnicos = (xml: string, prefijo: string) =>
  xml.replace(/id="([^"]+)"/g, `id="${prefijo}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${prefijo}$1)`);

export const fondoPorNombre = (name?: string) => FONDOS.find((x) => x.name === name) ?? FONDOS.find((x) => x.name === 'Pergamino')!;

export type Letra = {
  id: string;
  name: string;
  /** El nombre con que se carga la letra (fontFamily). `null`: la serif del sistema. */
  family: string | null;
  /** Cuánto crece o se achica respecto a la letra clásica, porque cada letra tiene otro tamaño de ojo. */
  escala: number;
  interlinea: number;
  mayusculas?: boolean;
};

export const LETRAS: Letra[] = [
  { id: 'clasica', name: 'Clásica', family: null, escala: 1, interlinea: 1.4 },
  { id: 'cursiva', name: 'Cursiva', family: 'Lora_400Regular_Italic', escala: 1, interlinea: 1.42 },
  { id: 'elegante', name: 'Elegante', family: 'PlayfairDisplay_400Regular', escala: 0.98, interlinea: 1.38 },
  { id: 'antigua', name: 'Antigua', family: 'CormorantGaramond_500Medium', escala: 1.14, interlinea: 1.3 },
  { id: 'inscripcion', name: 'Inscripción', family: 'Cinzel_400Regular', escala: 0.84, interlinea: 1.45, mayusculas: true },
  { id: 'moderna', name: 'Moderna', family: 'Montserrat_500Medium', escala: 0.88, interlinea: 1.45 },
  { id: 'cartel', name: 'Cartel', family: 'BebasNeue_400Regular', escala: 1.3, interlinea: 1.12, mayusculas: true },
  { id: 'amano', name: 'A mano', family: 'Caveat_500Medium', escala: 1.3, interlinea: 1.25 },
  { id: 'caligrafia', name: 'Caligrafía', family: 'DancingScript_500Medium', escala: 1.12, interlinea: 1.35 },
];

export const letraPorId = (id?: string) => LETRAS.find((l) => l.id === id) ?? LETRAS[0];

/** La letra de la dedicatoria: siempre a mano, como una nota escrita para alguien. */
export const LETRA_DEDICATORIA = 'Caveat_500Medium';

/** Frases para dedicar el versículo a alguien: compartir pensando en una persona concreta. */
export const DEDICATORIAS = ['Oré por ti hoy', 'Pensé en ti', 'Para ti, con cariño', 'Feliz cumpleaños', 'Dios está contigo', 'Gracias por tu vida'];

/** Palabras del versículo, en el orden en que se dibujan (las comillas van pegadas a la primera y la última). */
export function palabras(text: string) {
  const ws = text.trim().split(/\s+/);
  return ws.map((w, i) => `${i === 0 ? '«' : ''}${w}${i === ws.length - 1 ? '»' : ''}`);
}

/** Carga las letras para la imagen (en el teléfono y en la web). Si falla, se usa la serif del sistema. */
let cargadas: Promise<void> | null = null;
let listas = false;
export function cargarLetras() {
  cargadas ??= import('expo-font')
    .then((Font) =>
      Font.loadAsync({
        Lora_400Regular_Italic: require('@expo-google-fonts/lora/400Regular_Italic/Lora_400Regular_Italic.ttf'),
        PlayfairDisplay_400Regular: require('@expo-google-fonts/playfair-display/400Regular/PlayfairDisplay_400Regular.ttf'),
        CormorantGaramond_500Medium: require('@expo-google-fonts/cormorant-garamond/500Medium/CormorantGaramond_500Medium.ttf'),
        Cinzel_400Regular: require('@expo-google-fonts/cinzel/400Regular/Cinzel_400Regular.ttf'),
        Montserrat_500Medium: require('@expo-google-fonts/montserrat/500Medium/Montserrat_500Medium.ttf'),
        BebasNeue_400Regular: require('@expo-google-fonts/bebas-neue/400Regular/BebasNeue_400Regular.ttf'),
        Caveat_500Medium: require('@expo-google-fonts/caveat/500Medium/Caveat_500Medium.ttf'),
        DancingScript_500Medium: require('@expo-google-fonts/dancing-script/500Medium/DancingScript_500Medium.ttf'),
      }),
    )
    .catch(() => {})
    .then(() => {
      listas = true;
    });
  return cargadas;
}

/** Carga las letras cuando hacen falta y avisa cuando están listas, para volver a dibujar con ellas. */
export function useLetras(hacenFalta = true) {
  const [ok, setOk] = useState(listas);
  useEffect(() => {
    if (!hacenFalta || listas) return;
    let vivo = true;
    cargarLetras().then(() => vivo && setOk(true));
    return () => {
      vivo = false;
    };
  }, [hacenFalta]);
  return ok;
}
