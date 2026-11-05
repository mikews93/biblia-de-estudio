// /podcast/juan/3: resumen del capítulo en audio, como una conversación entre Ana y Tomás. Con ?seguir=1 (se llegó
// desde el capítulo de al lado) empieza a sonar en cuanto está listo.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import PodcastView from '@/components/PodcastView';
import { recordingId, useCatalog } from '@/lib/audio';
import { Book, getBooks } from '@/lib/data';
import { useHerramienta, useVersionPodcast } from '@/lib/herramientas';
import { bookIdFromParam } from '@/lib/routes';

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

  return (
    <>
      <Stack.Screen options={{ title: 'Resumen en audio' }} />
      <PodcastView
        key={`${bookId}-${chapter}`}
        book={bookId}
        chapter={chapter}
        title={book ? `${book.name} ${chapter}` : ''}
        subtitle="Ana y Tomás conversan sobre el capítulo"
        tool={tool}
        version={version}
        recorded={recorded}
        waiting="Escribiendo la conversación con el texto, el griego y las referencias…"
        seguir={params.seguir === '1'}
        disclaimer={`Generado con IA solo a partir de la ${version.sigla}, el texto original de STEPBible y las referencias de OpenBible.info. Los números llevan a la fuente de cada idea.`}
      />
    </>
  );
}
