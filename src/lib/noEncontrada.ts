// Direcciones que no existen: limpiar lo que se pega al copiar un enlace de un mensaje («zarzabiblia.com/instalar.»)
// y, si aun así no hay pantalla, proponer la más parecida. Lo usan src/app/+not-found.tsx y el lector;
// public/index.html repite limpiarRuta en JavaScript simple para corregir la dirección antes de cargar la app.

import { BOOK_SLUGS } from '@/lib/routes';

/** Signos que suelen quedar pegados al final de un enlace copiado de una frase. */
const COLA = /[.,;:!?¡¿)\]}»”’"'…]+$/;

/** La ruta sin la puntuación del final, o null si no sobraba nada. Respeta la portada («/»). */
export function limpiarRuta(path: string): string | null {
  let p = path;
  try {
    p = decodeURIComponent(path);
  } catch {}
  const limpia = p.replace(/\/+$/, '').replace(COLA, '').replace(/\/+$/, '') || '/';
  return limpia === p.replace(/\/+$/, '') || limpia === p ? null : limpia;
}

/** Pantallas del primer nivel de src/app a las que tiene sentido llevar (src/lib/noEncontrada.test.ts lo comprueba). */
export const PANTALLAS = [
  'acerca', 'buscar', 'circulo', 'comunidades', 'concordancia', 'conexiones', 'cuenta', 'descargas', 'despertador',
  'diario', 'entrar', 'eventos', 'exportar', 'genealogia', 'gracias', 'grupos', 'historia', 'hombres', 'iglesia',
  'instalar', 'invitar', 'jovenes', 'libros', 'mi-ano', 'mis-temas', 'modo', 'ninos', 'notas', 'notificaciones',
  'ocasiones', 'palabras', 'pareja', 'planes', 'preguntar', 'privacidad', 'promesas', 'recibidos', 'recorridos',
  'registro', 'recuperar', 'repaso', 'sellos', 'semana', 'sostener', 'taller', 'terminos', 'todo', 'vivo', 'vuelta',
] as const;

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Letras de más, de menos, cambiadas o dos vecinas al revés («jaun» → «juan» es una). */
function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

/** La palabra conocida más cercana, si se parece lo bastante (una letra de más, de menos o cambiada cada cuatro). */
function cercana(palabra: string, conocidas: readonly string[]): string | null {
  const w = sinAcentos(palabra);
  if (!w) return null;
  let mejor: string | null = null;
  let menor = Infinity;
  for (const c of conocidas) {
    const d = c.startsWith(w) && w.length >= 4 ? 0.5 : distancia(w, c);
    if (d < menor) [mejor, menor] = [c, d];
  }
  return menor <= Math.max(1, Math.floor(w.length / 4)) ? mejor : null;
}

/** Adónde llevar; con «libro» (código interno) la pantalla escribe el nombre del libro con sus acentos. */
export type Sugerencia = { href: string; nombre: string; libro?: string };

/** Lo que probablemente se quiso abrir: otra pantalla («/instala» → Instalar) o un libro («/jaun/3» → Juan 3). */
export function sugerirRuta(path: string): Sugerencia | null {
  const limpia = limpiarRuta(path) ?? path;
  const [primera = '', ...resto] = limpia.split('/').filter(Boolean);
  if (!primera) return null;
  const libros = Object.values(BOOK_SLUGS);
  const libro = cercana(primera, libros);
  // Un libro con capítulo («/jaun/3») o una palabra que solo se parece a un libro.
  if (libro && (/^\d+$/.test(resto[0] ?? '') || !cercana(primera, PANTALLAS))) {
    const capitulo = /^\d+$/.test(resto[0] ?? '') ? resto[0] : '1';
    const versiculo = /^\d+$/.test(resto[1] ?? '') ? `/${resto[1]}` : '';
    const id = Object.keys(BOOK_SLUGS).find((k) => BOOK_SLUGS[k] === libro)!;
    return { href: `/${libro}/${capitulo}${versiculo}`, nombre: `${capitulo}${versiculo ? `:${resto[1]}` : ''}`, libro: id };
  }
  const pantalla = cercana(primera, PANTALLAS);
  if (pantalla && pantalla !== primera) return { href: `/${pantalla}`, nombre: `zarzabiblia.com/${pantalla}` };
  return null;
}
