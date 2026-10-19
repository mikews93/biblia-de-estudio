import { useEffect, useState } from 'react';

// Las ventanas del estudio (Modal) se ocultan al seguir un enlace y vuelven al regresar, pero el Modal
// desmonta lo que tiene dentro mientras está oculto. Lo que hay que conservar para volver al mismo sitio
// (el paso del devocional, lo escrito, las secciones abiertas) se guarda aquí hasta que la ventana se
// cierra de verdad (forgetKept).

const kept = new Map<string, unknown>();

/** Prefijo de lo recordado en el estudio de un pasaje. */
export const studyKeep = (book: string, chapter: number, verse?: number) => `estudio:${book}.${chapter}.${verse ?? ''}:`;

/** Como useState, pero el valor sobrevive a que el componente se desmonte y se vuelva a montar. */
export function useKept<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() =>
    kept.has(key) ? (kept.get(key) as T) : typeof initial === 'function' ? (initial as () => T)() : initial,
  );
  useEffect(() => {
    kept.set(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}

export function forgetKept(prefix: string) {
  for (const k of [...kept.keys()]) if (k.startsWith(prefix)) kept.delete(k);
}
