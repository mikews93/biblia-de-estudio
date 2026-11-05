// /podcast/juan/3: resumen del capítulo en audio, como una conversación entre Ana y Tomás
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import PodcastView from '@/components/PodcastView';
import { recordingId, useCatalog } from '@/lib/audio';
import { Book, getBooks } from '@/lib/data';
import { useHerramienta, useVersionPodcast } from '@/lib/herramientas';
import { bookIdFromParam, chapterHref } from '@/lib/routes';

export default function Podcast() {
  const params = useLocalSearchParams<{ book: string; chapter: string; seguir?: string }>();
  const bookId = bookIdFromParam(params.book);
  const chapter = Number(params.chapter);
  const [books, setBooks] = useState<Book[]>([]);
  const book = books.find((b) => b.id === bookId) ?? null;
  const version = useVersionPodcast();
  const tool = useHerramienta('podcast', bookId, chapter, version.id);
  // Las grabaciones que vienen con la app (public/audio/podcast) son de la RV1909
  const catalog = useCatalog();
  const recorded = version.id === 'rv1909' && catalog.podcast.includes(recordingId(bookId, chapter));

  useEffect(() => {
    getBooks().then(setBooks);
  }, []);

  // El capítulo de al lado, cruzando de libro si hace falta: se abre su pódcast y empieza a sonar solo.
  const vecino = (step: 1 | -1) => {
    const i = books.findIndex((b) => b.id === bookId);
    if (i < 0) return undefined;
    let to = books[i];
    let ch = chapter + step;
    if (ch < 1 || ch > to.chapters) {
      to = books[i + step];
      if (!to) return undefined;
      ch = step > 0 ? 1 : to.chapters;
    }
    return { label: `${to.name} ${ch}`, onPress: () => router.replace(`/podcast${chapterHref(to.id, ch)}?seguir=1` as never) };
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Resumen en audio' }} />
      <PodcastView
        key={`${bookId}-${chapter}`}
        book={bookId}
        chapter={chapter}
        title={book ? `${book.name} ${chapter}` : ''}
        kicker="RESUMEN EN AUDIO"
        subtitle="Ana y Tomás conversan sobre el capítulo"
        tool={tool}
        version={version}
        recorded={recorded}
        waiting="Escribiendo la conversación con el texto, el griego y las referencias…"
        vecinos={{ anterior: vecino(-1), siguiente: vecino(1) }}
        seguir={params.seguir === '1'}
        disclaimer={`Generado con IA solo a partir de la ${version.sigla}, el texto original de STEPBible y las referencias de OpenBible.info. Los números llevan a la fuente de cada idea.`}
      />
    </>
  );
}
