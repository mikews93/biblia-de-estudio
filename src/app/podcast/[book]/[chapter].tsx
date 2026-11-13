// /podcast/juan/3: resumen del capítulo en audio, como una conversación entre Ana y Tomás. Con ?seguir=1 (se llegó
// desde el capítulo de al lado) empieza a sonar en cuanto está listo.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import PodcastView from '@/components/PodcastView';
import { cargarCatalogo, recordingId, useCatalog } from '@/lib/audio';
import { Book, getBooks } from '@/lib/data';
import { useHerramienta, useVersionPodcast } from '@/lib/herramientas';
import { versionesGrabadas } from '@/lib/podcastGrabado';
import { elegirVersionPodcast } from '@/lib/podcastVersion';
import { bookIdFromParam } from '@/lib/routes';
import { useColors } from '@/lib/theme';

export default function Podcast() {
  const params = useLocalSearchParams<{ book: string; chapter: string; seguir?: string }>();
  const bookId = bookIdFromParam(params.book);
  const chapter = Number(params.chapter);
  const [books, setBooks] = useState<Book[]>([]);
  const book = books.find((b) => b.id === bookId) ?? null;
  const colors = useColors();
  const preferida = useVersionPodcast();
  // Las grabaciones que vienen con la app (public/audio/podcast) son de la RV1909
  const catalog = useCatalog();
  const enLaApp = catalog.podcast.includes(recordingId(bookId, chapter));
  const grabadas = useGrabadas(bookId, chapter);

  useEffect(() => {
    getBooks().then(setBooks);
  }, []);

  // Un solo pódcast grabado por capítulo: si ya lo está en otra versión, se escucha ese en vez de grabar otro.
  const elegida = grabadas && elegirVersionPodcast(preferida.id, grabadas);

  return (
    <>
      <Stack.Screen options={{ title: 'Resumen en audio' }} />
      {elegida ? (
        <PodcastCapitulo
          key={`${bookId}-${chapter}-${elegida}`}
          bookId={bookId}
          chapter={chapter}
          title={book ? `${book.name} ${chapter}` : ''}
          version={elegida}
          recorded={elegida === 'rv1909' && enLaApp}
          seguir={params.seguir === '1'}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.accent} accessibilityLabel="Buscando el pódcast del capítulo" />
        </View>
      )}
    </>
  );
}

/**
 * Las versiones en que el capítulo ya está grabado (en el servidor o, la RV1909, con la app); null mientras se pregunta.
 * Sin servidor, ninguna.
 */
function useGrabadas(book: string, chapter: number): string[] | null {
  const [grabadas, setGrabadas] = useState<{ clave: string; versiones: string[] } | null>(null);
  const clave = `${book}-${chapter}`;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([versionesGrabadas(book, chapter, controller.signal).catch(() => []), cargarCatalogo()]).then(([versiones, catalogo]) => {
      if (controller.signal.aborted) return;
      const enLaApp = catalogo.podcast.includes(recordingId(book, chapter));
      setGrabadas({ clave, versiones: enLaApp ? [...versiones, 'rv1909'] : versiones });
    });
    return () => controller.abort();
  }, [book, chapter, clave]);
  return grabadas?.clave === clave ? grabadas.versiones : null;
}

function PodcastCapitulo({
  bookId,
  chapter,
  title,
  version: id,
  recorded,
  seguir,
}: {
  bookId: string;
  chapter: number;
  title: string;
  version: string;
  recorded: boolean;
  seguir: boolean;
}) {
  const version = useVersionPodcast(id);
  const tool = useHerramienta('podcast', bookId, chapter, version.id);
  return (
    <PodcastView
      key={`${bookId}-${chapter}`}
      book={bookId}
      chapter={chapter}
      title={title}
      subtitle="Ana y Tomás conversan sobre el capítulo"
      tool={tool}
      version={version}
      recorded={recorded}
      waiting="Escribiendo la conversación con el texto, el griego y las referencias…"
      seguir={seguir}
      disclaimer={`Generado con IA solo a partir de la ${version.sigla}, el texto original de STEPBible y las referencias de OpenBible.info. Los números llevan a la fuente de cada idea.`}
    />
  );
}
