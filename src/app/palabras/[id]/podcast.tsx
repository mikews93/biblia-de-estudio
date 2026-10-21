// /palabras/jesed/podcast: Ana y Tomás cuentan la historia de una palabra por la Biblia. Se escucha con la voz del
// dispositivo o, si alguien ya la grabó, con voces naturales (/api/podcast-grabado con «palabra»).
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PodcastView from '@/components/PodcastView';
import { usePalabraIA } from '@/lib/herramientas';
import { palabraAudioId, palabraHref, palabraPorId, palabrasHref } from '@/lib/palabras';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function PalabraPodcast() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palabra = palabraPorId(id);
  const colors = useColors();
  if (!palabra) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.replace(palabrasHref())} accessibilityRole="link">
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver todas las palabras ›</Text>
        </Pressable>
      </View>
    );
  }
  return <Podcast key={palabra.id} id={palabra.id} />;
}

function Podcast({ id }: { id: string }) {
  const palabra = palabraPorId(id)!;
  const colors = useColors();
  const tool = usePalabraIA(palabra.id, 'podcast');
  const title = `La historia de ${palabra.nombre}`;
  return (
    <>
      <Stack.Screen options={{ title: 'Pódcast de la palabra' }} />
      <PodcastView
        book={palabraAudioId(palabra.id)}
        chapter={0}
        title={title}
        kicker="PÓDCAST · LA HISTORIA DE UNA PALABRA"
        subtitle={`Ana y Tomás siguen ${palabra.nombre} por la Biblia`}
        tool={tool}
        recorded={false}
        palabra={palabra.id}
        waiting={`Escribiendo la conversación con el léxico, la concordancia y la RV1909…`}
        header={
          <Pressable
            onPress={() => navigate(() => router.push(palabraHref(palabra.id) as never), 'back')}
            accessibilityRole="link"
            accessibilityLabel={`Volver a la historia de ${palabra.nombre}`}
            style={({ pressed }) => [styles.word, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.75 }]}
          >
            <Text style={[styles.original, { color: colors.greek, fontFamily: serif }]}>{palabra.original}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
              {palabra.resumen}
            </Text>
          </Pressable>
        }
        disclaimer="Guion preparado con IA solo a partir del léxico breve y la concordancia de STEPBible (Tyndale House, CC BY 4.0) y de la Reina-Valera 1909. Los números llevan a la fuente de cada idea."
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  word: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16, maxWidth: '100%' },
  original: { fontSize: 28, lineHeight: 38 },
});
