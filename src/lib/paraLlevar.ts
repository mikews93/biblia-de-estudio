// «Para llevar a casa»: al terminar un mensaje (en el modo presentar y en la página del evento), los versículos
// del sermón quedan como tarjetas listas para compartir. La investigación (investigacion/compartir-versiculos.md)
// mostró que lo que se comparte el domingo por la tarde es justo el versículo que se predicó.

import type { VerseToShare } from './compartir';
import { Book, getChapter } from './data';
import { leerCita } from './eventos';
import type { Pasaje } from './taller';

/** Cómo se ve cada tarjeta, para que las tres no salgan iguales. */
export const ESTILOS_TARJETA = [
  { fondo: 'Amanecer', letra: 'elegante' },
  { fondo: 'Olivo', letra: 'cursiva' },
  { fondo: 'Montes', letra: 'antigua' },
];

/** Las citas del sermón en orden, sin repetir versículo: primero el pasaje y luego las de cada punto. */
export function citasParaLlevar(pasaje: Pasaje | null | undefined, citas: string[], books: Book[], max = 3) {
  const out: { book: string; chapter: number; verse: number }[] = [];
  const poner = (book: string, chapter: number, verse?: number) => {
    if (!verse || out.length >= max) return;
    if (!out.some((x) => x.book === book && x.chapter === chapter && x.verse === verse)) out.push({ book, chapter, verse });
  };
  if (pasaje) poner(pasaje.book, pasaje.chapter, pasaje.from);
  for (const c of citas) {
    const r = leerCita(c, books);
    if (r) poner(r.book, r.chapter, r.from);
  }
  return out;
}

/** Los versículos para llevar con su texto en la RV1909 (dominio público), listos para hacer la imagen. */
export async function versiculosParaLlevar(pasaje: Pasaje | null | undefined, citas: string[], books: Book[]): Promise<VerseToShare[]> {
  const out = await Promise.all(
    citasParaLlevar(pasaje, citas, books).map(async ({ book, chapter, verse }) => {
      const text = (await getChapter(book, chapter).catch(() => [])).find(([n]) => n === verse)?.[1];
      const name = books.find((b) => b.id === book)?.name ?? book;
      const item: VerseToShare | null = text ? { book, chapter, verse, text, reference: `${name} ${chapter}:${verse}`, version: 'RV1909' } : null;
      return item;
    }),
  );
  return out.filter((x): x is VerseToShare => !!x);
}

/** El título del mensaje como dedicatoria de la tarjeta, recortado a lo que cabe (40 letras). */
export function dedicatoriaDe(titulo: string) {
  const t = titulo.trim().replace(/\s+/g, ' ');
  if (t.length <= 40) return t;
  const corto = t.slice(0, 39);
  return `${corto.slice(0, corto.lastIndexOf(' ') > 20 ? corto.lastIndexOf(' ') : 39)}…`;
}
