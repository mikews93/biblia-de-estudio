// Geometría de la línea de tiempo horizontal (al estilo de la Carta sincronológica de Adams):
// una escala que se estira donde hay más historia y el reparto de las etiquetas en filas sin que se pisen.

export const INICIO = -3200;
export const FIN = 120;
const TRAMO = 50;

export type Escala = {
  /** Píxel de un año. */
  x: (año: number) => number;
  /** Año de un píxel (inversa de x). */
  año: (x: number) => number;
  ancho: number;
  /** Años con marca en el eje, ya espaciados para que sus etiquetas no se pisen. */
  marcas: number[];
};

/**
 * Cada tramo de 50 años mide según cuántas cosas empiezan en él: los siglos tranquilos se encogen y los del
 * reino dividido o del Nuevo Testamento se estiran. Dentro de cada tramo la escala es lineal.
 */
export function crearEscala(inicios: number[], zoom = 1): Escala {
  const n = Math.ceil((FIN - INICIO) / TRAMO);
  const cuenta = new Array<number>(n).fill(0);
  for (const y of inicios) {
    const i = Math.floor((y - INICIO) / TRAMO);
    if (i >= 0 && i < n) cuenta[i]++;
  }
  const anchos = cuenta.map((c) => zoom * Math.min(1100, 28 + 44 * c));
  const bordes = [0];
  for (const w of anchos) bordes.push(bordes[bordes.length - 1] + w);

  const x = (año: number) => {
    const t = (Math.min(FIN, Math.max(INICIO, año)) - INICIO) / TRAMO;
    const i = Math.min(n - 1, Math.floor(t));
    return bordes[i] + (t - i) * anchos[i];
  };
  const año = (px: number) => {
    const p = Math.min(bordes[n], Math.max(0, px));
    let i = 0;
    while (i < n - 1 && bordes[i + 1] <= p) i++;
    return INICIO + (i + (p - bordes[i]) / anchos[i]) * TRAMO;
  };

  const marcas: number[] = [];
  let ultima = -Infinity;
  for (let y = INICIO; y <= FIN; y += TRAMO) {
    const px = x(y);
    // Siglos redondos primero; medio siglo solo donde sobra espacio
    if (y % 100 !== 0 && px - ultima < 140) continue;
    if (px - ultima < 64) continue;
    marcas.push(y);
    ultima = px;
  }
  return { x, año, ancho: x(FIN), marcas };
}

/** «3000 a.C.», «Cristo», «100 d.C.» para el eje. */
export function etiquetaMarca(y: number) {
  if (y === 0) return 'Cristo';
  return y < 0 ? `${-y} a.C.` : `${y} d.C.`;
}

export type Colocado<T> = { item: T; fila: number; x: number; w: number };

/**
 * Reparte cajas en filas: cada una va en la primera fila donde cabe sin tocar la anterior.
 * Con `maxFilas`, cuando no cabe en ninguna se acorta la caja anterior de la fila con más hueco (su texto se
 * corta con «…»), siempre que le queden al menos `minimo` píxeles; si no, se abre otra fila.
 * Las cajas se ordenan por su x; devuelve también cuántas filas hicieron falta.
 */
export function apilar<T>(
  items: T[],
  caja: (t: T) => { x: number; w: number },
  separacion = 8,
  maxFilas = Infinity,
  minimo = 64,
  /** Las que no se pueden acortar (la que marca dónde está el lector). */
  fija: (t: T) => boolean = () => false,
) {
  const ultimos: Colocado<T>[] = [];
  const colocados: Colocado<T>[] = items
    .map((item) => ({ item, ...caja(item) }))
    .sort((a, b) => a.x - b.x)
    .map(({ item, x, w }) => {
      let fila = ultimos.findIndex((u) => u.x + u.w + separacion <= x);
      if (fila < 0 && ultimos.length >= maxFilas) {
        const hueco = (u: Colocado<T>) => (fija(u.item) ? -1 : x - separacion - u.x);
        const mejor = ultimos.reduce((m, u, i) => (hueco(u) > hueco(ultimos[m]) ? i : m), 0);
        if (hueco(ultimos[mejor]) >= minimo) {
          ultimos[mejor].w = hueco(ultimos[mejor]);
          fila = mejor;
        }
      }
      if (fila < 0) fila = ultimos.length;
      const colocado = { item, fila, x, w };
      ultimos[fila] = colocado;
      return colocado;
    });
  return { colocados, filas: Math.max(1, ultimos.length) };
}

/** Ancho aproximado de un texto en una línea (para repartir filas antes de dibujar). */
export const anchoTexto = (texto: string, tamaño: number) => Math.ceil(texto.length * tamaño * 0.56);

/** Filas que hacen falta para lo que se ve entre los píxeles a y b (al menos `minimo`). */
export function filasEn<T>(colocados: Colocado<T>[], a: number, b: number, minimo = 1) {
  let n = minimo;
  for (const c of colocados) if (c.x < b && c.x + c.w > a) n = Math.max(n, c.fila + 1);
  return n;
}
