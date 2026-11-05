// La pantalla de un pódcast sabe si ya está grabado con voces naturales y cómo pedir la grabación (necesita el guion y
// la versión). Lo deja aquí para que el reproductor de abajo, que es el único, ofrezca «Voces naturales» mientras suena
// ese pódcast con la voz del dispositivo.
import { useSyncExternalStore } from 'react';

import type { EstadoGrabacion } from './podcastGrabado';

export type ExtrasPodcast = {
  book: string;
  chapter: number;
  grabado: EstadoGrabacion;
  record: () => void;
};

let actual: ExtrasPodcast | null = null;
const listeners = new Set<() => void>();

export function publicarExtras(extras: ExtrasPodcast | null) {
  actual = extras;
  listeners.forEach((l) => l());
}

/** Quita lo publicado solo si sigue siendo de ese pódcast (otra pantalla pudo publicar después). */
export function retirarExtras(book: string, chapter: number) {
  if (actual?.book === book && actual.chapter === chapter) publicarExtras(null);
}

export function useExtrasPodcast(book: string | null, chapter: number): ExtrasPodcast | null {
  const extras = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => actual,
    () => actual,
  );
  return extras && extras.book === book && extras.chapter === chapter ? extras : null;
}
