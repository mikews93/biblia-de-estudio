// /mapa-mental/juan/3: el capítulo de un vistazo, con su idea central, sus partes y sus ideas
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import MindMapView from '@/components/MindMapView';
import { Sources } from '@/components/StudyPanel';
import { ToolFooter, ToolState } from '@/components/ToolState';
import { Book, getBooks, parseRef } from '@/lib/data';
import { useHerramienta } from '@/lib/herramientas';
import { parseMindMap, versesLabel } from '@/lib/mapaMental';
import { bookIdFromParam, verseHref } from '@/lib/routes';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function MindMapScreen() {
  const params = useLocalSearchParams<{ book: string; chapter: string }>();
  const bookId = bookIdFromParam(params.book);
  const chapter = Number(params.chapter);
  const colors = useColors();
  const [book, setBook] = useState<Book | null>(null);
  const [asList, setAsList] = useState(false);
  const tool = useHerramienta('mapa', bookId, chapter);
  const map = useMemo(() => parseMindMap(tool.text), [tool.text]);

  useEffect(() => {
    getBooks().then((bs) => setBook(bs.find((b) => b.id === bookId) ?? null));
  }, [bookId]);

  const openVerse = (v: number) => navigate(() => router.push(verseHref(bookId, chapter, v)), 'forward');
  const open = (ref: string) => {
    const { start } = parseRef(ref);
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };
  const ready = tool.done && map.branches.length > 0;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Mapa mental' }} />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.accent }]}>◉ MAPA MENTAL</Text>
          <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>{book ? `${book.name} ${chapter}` : ''}</Text>
        </View>
        {ready && (
          <View style={[styles.toggle, { borderColor: colors.border }]}>
            {(['Mapa', 'Lista'] as const).map((l) => {
              const on = (l === 'Lista') === asList;
              return (
                <Pressable
                  key={l}
                  onPress={() => setAsList(l === 'Lista')}
                  style={[styles.toggleItem, on && { backgroundColor: colors.accent }]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={{ color: on ? colors.surface : colors.text, fontWeight: '600', fontSize: 13 }}>{l}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <ToolState
        colors={colors}
        busy={tool.busy}
        error={tool.error}
        waiting={ready ? null : 'Ordenando las ideas del capítulo…'}
        onRetry={tool.regenerate}
      />
      {tool.done && !map.branches.length && !tool.error && (
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 24 }}>
          No salió un mapa que se pueda dibujar. Prueba a preparar otra versión.
        </Text>
      )}

      {ready && !asList && (
        <>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 16 }}>
            Toca una idea para leer su versículo.
          </Text>
          <MindMapView map={map} colors={colors} onVerse={openVerse} />
        </>
      )}

      {ready && asList && (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.listTitle, { color: colors.text, fontFamily: serif }]}>{map.title}</Text>
          {map.branches.map((b, i) => (
            <View key={i} style={{ marginTop: 14 }}>
              <Pressable onPress={() => b.from && openVerse(b.from)}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 16 }}>
                  {b.text} <Text style={{ color: colors.muted, fontWeight: '400', fontSize: 13 }}>{versesLabel(b)}</Text>
                </Text>
              </Pressable>
              {b.leaves.map((l, j) => (
                <Pressable key={j} onPress={() => l.from && openVerse(l.from)} style={styles.leaf}>
                  <Text style={{ color: colors.accent }}>•</Text>
                  <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, flex: 1 }}>
                    {l.text} <Text style={{ color: colors.muted, fontSize: 13 }}>{versesLabel(l)}</Text>
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      {ready && !!tool.sources.length && <Sources sources={tool.sources} colors={colors} onOpen={open} />}
      <ToolFooter colors={colors} done={tool.done} onRegenerate={tool.regenerate} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 64, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, maxWidth: 680 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 28, marginTop: 4 },
  toggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  toggleItem: { paddingHorizontal: 12, paddingVertical: 6 },
  listTitle: { fontSize: 21, lineHeight: 28 },
  leaf: { flexDirection: 'row', gap: 8, paddingLeft: 8, paddingVertical: 4 },
});
