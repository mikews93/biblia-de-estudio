// /podcast/juan/3: resumen del capítulo en audio, como una conversación entre Ana y Tomás
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import PodcastView from '@/components/PodcastView';
import { recordingId, useCatalog } from '@/lib/audio';
import { Book, getBooks } from '@/lib/data';
import { useHerramienta } from '@/lib/herramientas';
import { bookIdFromParam } from '@/lib/routes';

export default function Podcast() {
  const params = useLocalSearchParams<{ book: string; chapter: string }>();
  const bookId = bookIdFromParam(params.book);
  const chapter = Number(params.chapter);
  const [book, setBook] = useState<Book | null>(null);
  const tool = useHerramienta('podcast', bookId, chapter);
  const recorded = useCatalog().podcast.includes(recordingId(bookId, chapter));

  useEffect(() => {
    getBooks().then((bs) => setBook(bs.find((b) => b.id === bookId) ?? null));
  }, [bookId]);

  return (
    <>
      <Stack.Screen options={{ title: 'Resumen en audio' }} />
      <PodcastView
        book={bookId}
        chapter={chapter}
        title={book ? `${book.name} ${chapter}` : ''}
        kicker="RESUMEN EN AUDIO"
        subtitle="Ana y Tomás conversan sobre el capítulo"
        tool={tool}
        recorded={recorded}
        waiting="Escribiendo la conversación con el texto, el griego y las referencias…"
      />
    </>
  );
}
