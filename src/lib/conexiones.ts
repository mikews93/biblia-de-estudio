// Todas las referencias cruzadas de la Biblia como arcos entre capítulos (/conexiones), al estilo del gráfico de
// Chris Harrison y Christoph Römhild. Los datos salen de pipeline/build_data.py (build_arcos) y el fondo con los
// 141 001 arcos se pinta una vez en pipeline/arcos_imagen.mjs: aquí solo se calculan los del libro o capítulo elegido.
import { type CrossRef, load } from './data';

export type Resumen = {
  /** Pares de versículos conectados (cada par una vez, sin contar los del mismo capítulo). */
  versiculos: number;
  /** Pares de capítulos con al menos una conexión: los arcos del fondo. */
  pares: number;
  /** Conexiones de cada capítulo, de Génesis 1 a Apocalipsis 22. */
  capitulos: number[];
  /** Conexiones entre cada par de libros (66 × 66). */
  libros: number[][];
};

/** Por capítulo del libro: [índice del otro capítulo, conexiones, …], de más a menos. */
export type FilasLibro = number[][];

export const getResumen = () => load<Resumen>('arcos/resumen.json');
export const getArcosLibro = (book: string) => load<FilasLibro>(`arcos/${book}.json`);

export const FUENTE_CONEXIONES =
  'Referencias cruzadas de OpenBible.info (CC BY), que parten del Treasury of Scripture Knowledge y de los votos de sus lectores. La idea del gráfico es de Chris Harrison y Christoph Römhild.';

type LibroConCapitulos = { id: string; chapters: number };

/** Dónde empieza cada libro en la fila de 1189 capítulos, y el total. */
export function eje(books: LibroConCapitulos[]) {
  const inicio: number[] = [];
  let total = 0;
  for (const b of books) {
    inicio.push(total);
    total += b.chapters;
  }
  return { inicio, total };
}

/** Libro y capítulo del capítulo número `i` de la Biblia (desde 0). */
export function capituloEn(books: LibroConCapitulos[], inicio: number[], i: number): { libro: number; chapter: number } {
  let libro = 0;
  while (libro + 1 < inicio.length && inicio[libro + 1] <= i) libro++;
  return { libro, chapter: i - inicio[libro] + 1 };
}

/** Libro bajo la posición `f` (de 0 a 1) del eje. */
export function libroEn(inicio: number[], total: number, f: number) {
  const i = Math.max(0, Math.min(total - 1, Math.floor(f * total)));
  let libro = 0;
  while (libro + 1 < inicio.length && inicio[libro + 1] <= i) libro++;
  return libro;
}

export type Arco = { a: number; b: number; n: number };

/**
 * Los arcos de un capítulo o de un libro entero, sin repetir los que unen dos capítulos del mismo libro.
 * Un libro como Salmos tiene decenas de miles: se quedan los `max` más fuertes, que son los que se ven.
 */
export function arcosDe(filas: FilasLibro, inicioLibro: number, capitulo?: number, max = 2500): Arco[] {
  const lista: Arco[] = [];
  const fin = inicioLibro + filas.length;
  filas.forEach((fila, k) => {
    if (capitulo != null && k !== capitulo - 1) return;
    const a = inicioLibro + k;
    for (let j = 0; j < fila.length; j += 2) {
      const b = fila[j];
      // Dentro del libro, cada par aparece en las dos filas: se toma una vez
      if (capitulo == null && b >= inicioLibro && b < fin && b < a) continue;
      lista.push({ a: Math.min(a, b), b: Math.max(a, b), n: fila[j + 1] });
    }
  });
  if (lista.length <= max) return lista;
  return lista.sort((x, y) => y.n - x.n).slice(0, max);
}

/** Con qué libros conversa más un libro: [índice del libro, conexiones], sin contarse a sí mismo. */
export function librosVecinos(resumen: Resumen, libro: number, max = 5): [number, number][] {
  return resumen.libros[libro]
    .map((n, i) => [i, n] as [number, number])
    .filter(([i, n]) => i !== libro && n > 0)
    .sort((x, y) => y[1] - x[1])
    .slice(0, max);
}

/** Los capítulos con más conexiones de toda la Biblia: [índice, conexiones]. */
export function masConectados(resumen: Resumen, max = 8): [number, number][] {
  return resumen.capitulos
    .map((n, i) => [i, n] as [number, number])
    .sort((x, y) => y[1] - x[1])
    .slice(0, max);
}

/** Las referencias más votadas de un capítulo (xrefs del lector): [versículo, referencia, votos]. */
export function masFuertes(refs: Record<string, CrossRef[]>, max = 8): [number, string, number][] {
  const seen = new Set<string>();
  return Object.entries(refs)
    .flatMap(([v, list]) => list.map(([ref, votos]) => [Number(v), ref, votos] as [number, string, number]))
    .sort((x, y) => y[2] - x[2] || x[0] - y[0])
    .filter(([v, ref]) => {
      const k = `${v}>${ref.split('-')[0]}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max);
}

/** Medio círculo sobre la línea base, de x1 a x2 (como en el fondo). */
export const semicirculo = (x1: number, x2: number, base: number) =>
  `M${x1.toFixed(1)},${base}A${((x2 - x1) / 2).toFixed(1)},${((x2 - x1) / 2).toFixed(1)} 0 0 1 ${x2.toFixed(1)},${base}`;

/**
 * Del arco corto al largo: ámbar, rosa, violeta, azul. Igual que en pipeline/arcos_imagen.mjs, que pinta el fondo,
 * para que la leyenda diga lo mismo que la imagen.
 */
export const ESPECTRO = {
  claro: [
    [176, 102, 30],
    [184, 76, 96],
    [112, 84, 168],
    [44, 98, 150],
  ],
  oscuro: [
    [226, 168, 104],
    [222, 120, 140],
    [160, 136, 222],
    [110, 166, 220],
  ],
};

/** Color de un arco según la distancia `f` (de 0 a 1, fracción de la Biblia que cruza). */
export function colorDistancia(f: number, oscuro: boolean) {
  const stops = oscuro ? ESPECTRO.oscuro : ESPECTRO.claro;
  const g = Math.pow(Math.max(0, Math.min(1, f)), 0.6) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(g));
  const t = g - i;
  const [r, gr, b] = stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * t));
  return `rgb(${r},${gr},${b})`;
}

/** 286602 → «286 602». */
export const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
