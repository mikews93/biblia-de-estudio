// Léxicos de las Sociedades Bíblicas Unidas (hebreo y griego) y el diccionario bíblico de Tyndale, los dos ya en
// español y con licencia CC BY-SA 4.0 (pipeline/build_fuentes_abiertas.py). Se leen sin IA: el texto es el de la
// editorial. Sin dependencias de React Native: también lo usa el servidor.

import { sinAcentos } from './preguntarTexto';

/** [glosas, definición, comentario, campo de significado, {libro: "c.v c.v"}] */
export type Sentido = [string[], string, string, string, Record<string, string>];
export type EntradaLexico = { l: string; s: Sentido[] };

/** [id, título, tipo] */
export type FilaDiccionario = [string, string, string];
export type Articulo = { id: string; t: string; x: string; tipo: string };

export const LEXICO_UBS = {
  nombre: 'Diccionario de las Sociedades Bíblicas Unidas',
  credito:
    'UBS Dictionary of Biblical Hebrew y UBS Dictionary of the Greek New Testament, edición en español © Sociedades Bíblicas Unidas, 2023 (el griego adapta el léxico de Louw y Nida). CC BY-SA 4.0. Sin cambios en el texto.',
  url: 'https://github.com/ubsicap/ubs-open-license',
};

export const DICCIONARIO_TYNDALE = {
  nombre: 'Diccionario bíblico Tyndale',
  credito:
    'Aquifer Open Bible Dictionary en español © 2026 Mission Mutual, adaptación del Tyndale Open Bible Dictionary © 2023 Tyndale House Publishers. CC BY-SA 4.0. Con cambios: formato y enlaces a la Biblia.',
  url: 'https://github.com/BibleAquifer/AquiferOpenBibleDictionary',
};

/** «H2617A» o «G26» → «H2617» / «G0026», como se llaman los archivos del léxico. */
export function claveLexico(strong: string): string | null {
  const m = /^([GH])0*(\d{1,4})[A-Za-z]?$/i.exec(strong.trim());
  return m ? `${m[1].toUpperCase()}${m[2].padStart(4, '0')}` : null;
}

/** El sentido de la palabra en ese versículo, si UBS lo marca; si no, -1. */
export function sentidoEn(sentidos: Sentido[], libro: string, capitulo: number, versiculo: number): number {
  const cv = `${capitulo}.${versiculo}`;
  return sentidos.findIndex(([, , , , refs]) => (refs[libro] ?? '').split(' ').includes(cv));
}

/** Cuántas veces aparece un sentido. */
export const vecesSentido = (s: Sentido) => Object.values(s[4]).reduce((n, v) => n + (v ? v.split(' ').length : 0), 0);

export const diccionarioHref = (id: string) => `/diccionario/${id}`;

export const TIPOS: Record<string, string> = {
  person: 'Persona',
  place: 'Lugar',
  group: 'Pueblo o grupo',
  realia: 'Objeto o costumbre',
  keyterm: 'Término clave',
  deity: 'Dios y dioses',
  flora: 'Planta',
  fauna: 'Animal',
};

const norm = (t: string) =>
  sinAcentos(t.toLowerCase())
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Los artículos que mejor responden a lo que se busca: el título igual, luego los que empiezan así, luego los que lo
 * tienen como palabra. Las palabras sueltas cortas («de», «la») no cuentan. */
export function buscarArticulos(indice: FilaDiccionario[], q: string, max = 8): FilaDiccionario[] {
  const n = norm(q);
  if (n.length < 3) return [];
  const re = new RegExp(`(^| )${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($| )`);
  const puntos = (t: string) => {
    const nt = norm(t);
    const cabeza = nt.split(' ').slice(0, Math.max(1, n.split(' ').length)).join(' ');
    if (nt === n || cabeza === n) return 0;
    if (nt.startsWith(n)) return 1;
    if (re.test(nt)) return 2;
    return -1;
  };
  return indice
    .map((f) => [puntos(f[1]), f] as const)
    .filter(([p]) => p >= 0)
    .sort((a, b) => a[0] - b[0] || a[1][1].length - b[1][1].length)
    .slice(0, max)
    .map(([, f]) => f);
}

/** La primera oración del artículo, sin marcas, para la vista previa. */
export function resumen(texto: string, max = 180): string {
  const p = texto.split(/\n{2,}/).find((x) => !x.startsWith('## ')) ?? '';
  const limpio = p
    .replace(/⟦d:\d+\|([^⟧]*)⟧/g, '$1')
    .replace(/⟦[^⟧]*⟧/g, '')
    .replace(/\*\*?([^*]+)\*\*?/g, '$1')
    .replace(/\(\s*[,;]?\s*\)/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(' '), max - 20))}…`;
}
