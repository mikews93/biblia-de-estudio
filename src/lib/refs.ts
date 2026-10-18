// Referencias del tipo 'rom.5.8' o '1jn.4.9-1jn.4.10'. Sin dependencias de React Native: también lo usa la función del servidor.

type NamedBook = { id: string; name: string };

export type RefTarget = { book: string; chapter: number; verse: number };

/** 'rom.5.8' o '1jn.4.9-1jn.4.10' */
export function parseRef(ref: string): { start: RefTarget; end: RefTarget } {
  const [a, b = a] = ref.split('-');
  const part = (s: string) => {
    const [book, chapter, verse] = s.split('.');
    return { book, chapter: Number(chapter), verse: Number(verse) };
  };
  return { start: part(a), end: part(b) };
}

export function formatRef(ref: string, books: NamedBook[]): string {
  const { start, end } = parseRef(ref);
  const name = books.find((b) => b.id === start.book)?.name ?? start.book;
  let label = `${name} ${start.chapter}:${start.verse}`;
  if (end.book !== start.book) {
    const endName = books.find((b) => b.id === end.book)?.name ?? end.book;
    label += ` – ${endName} ${end.chapter}:${end.verse}`;
  } else if (end.chapter !== start.chapter) {
    label += `–${end.chapter}:${end.verse}`;
  } else if (end.verse !== start.verse) {
    label += `-${end.verse}`;
  }
  return label;
}

