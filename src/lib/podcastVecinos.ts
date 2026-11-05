// El pódcast del capítulo de al lado (cruzando de libro si hace falta). Lo usan la pantalla del pódcast y el
// reproductor de abajo: se abre su pantalla con ?seguir=1, se prepara si todavía no está y empieza a sonar solo.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Book, getBooks } from '@/lib/data';
import { chapterHref } from '@/lib/routes';

export type Vecino = { label: string; href: string };

export const podcastHref = (book: string, chapter: number) => `/podcast${chapterHref(book, chapter)}`;

export function vecinoDe(books: Book[], book: string, chapter: number, step: 1 | -1): Vecino | undefined {
  const i = books.findIndex((b) => b.id === book);
  if (i < 0 || chapter < 1) return undefined;
  let to = books[i];
  let ch = chapter + step;
  if (ch < 1 || ch > to.chapters) {
    to = books[i + step];
    if (!to) return undefined;
    ch = step > 0 ? 1 : to.chapters;
  }
  return { label: `${to.name} ${ch}`, href: `${podcastHref(to.id, ch)}?seguir=1` };
}

/** El anterior y el siguiente del capítulo (sin nada para el pódcast de una palabra, que va con capítulo 0). */
export function useVecinos(book: string | null, chapter: number): { anterior?: Vecino; siguiente?: Vecino } {
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => {
    if (book && chapter > 0) getBooks().then(setBooks, () => {});
  }, [book, chapter]);
  if (!book || chapter < 1) return {};
  return { anterior: vecinoDe(books, book, chapter, -1), siguiente: vecinoDe(books, book, chapter, 1) };
}

/** Desde la pantalla de un pódcast se reemplaza (atrás vuelve al lector); desde otra pantalla se abre encima. */
export function irAlVecino(v: Vecino, desdePodcast: boolean) {
  if (desdePodcast) router.replace(v.href as never);
  else router.push(v.href as never);
}
