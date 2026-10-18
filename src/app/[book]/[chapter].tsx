import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import VersePanel from '@/components/VersePanel';
import { Book, Verse, getBooks, getChapter } from '@/lib/data';
import { serif, useColors, useFontSize } from '@/lib/theme';

export default function Reader() {
  const params = useLocalSearchParams<{ book: string; chapter: string; v?: string }>();
  const bookId = params.book;
  const chapter = Number(params.chapter);
  const target = params.v ? Number(params.v) : null;

  const colors = useColors();
  const { size, setSize } = useFontSize();
  const [books, setBooks] = useState<Book[]>([]);
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef<Record<number, number>>({});

  useEffect(() => {
    getBooks().then(setBooks).catch((e) => setError(String(e.message)));
  }, []);

  useEffect(() => {
    setVerses(null);
    setError(null);
    offsets.current = {};
    getChapter(bookId, chapter)
      .then(setVerses)
      .catch((e) => setError(String(e.message)));
  }, [bookId, chapter]);

  const index = books.findIndex((b) => b.id === bookId);
  const book = books[index];

  const go = (delta: number) => {
    if (!book) return;
    let i = index;
    let ch = chapter + delta;
    if (ch < 1) {
      if (i === 0) return;
      i -= 1;
      ch = books[i].chapters;
    } else if (ch > book.chapters) {
      if (i === books.length - 1) return;
      i += 1;
      ch = 1;
    }
    router.replace(`/${books[i].id}/${ch}`);
  };

  const title = book ? `${book.name} ${chapter}` : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title,
          headerTitle: () => (
            <Pressable onPress={() => router.push('/libros')} accessibilityRole="button" accessibilityLabel="Elegir libro y capítulo">
              <Text style={[styles.headerTitle, { color: colors.text }]}>{title} ▾</Text>
            </Pressable>
          ),
          headerRight: () => (
            <View style={styles.fontButtons}>
              <Pressable onPress={() => setSize(Math.max(14, size - 2))} accessibilityLabel="Letra más pequeña">
                <Text style={[styles.fontButton, { color: colors.muted }]}>A−</Text>
              </Pressable>
              <Pressable onPress={() => setSize(Math.min(30, size + 2))} accessibilityLabel="Letra más grande">
                <Text style={[styles.fontButton, { color: colors.muted, fontSize: 20 }]}>A+</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        {error && <Text style={{ color: colors.muted }}>{error}</Text>}
        {!verses && !error && <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />}
        {verses?.map(([n, text]) => (
          <Pressable
            key={n}
            onPress={() => setSelected(n)}
            onLayout={(e) => {
              offsets.current[n] = e.nativeEvent.layout.y;
              if (n === target) scroll.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 24), animated: false });
            }}
            style={[styles.verse, (n === selected || n === target) && { backgroundColor: colors.highlight }]}
          >
            <Text style={{ fontFamily: serif, fontSize: size, lineHeight: size * 1.6, color: colors.text }}>
              <Text style={{ fontSize: size * 0.6, color: colors.accent, fontWeight: '700' }}>{n} </Text>
              {text}
            </Text>
          </Pressable>
        ))}
        {verses && (
          <View style={styles.nav}>
            <Pressable onPress={() => go(-1)} style={[styles.navButton, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>‹ Anterior</Text>
            </Pressable>
            <Pressable onPress={() => go(1)} style={[styles.navButton, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>Siguiente ›</Text>
            </Pressable>
          </View>
        )}
        <Text style={[styles.credit, { color: colors.muted }]}>Reina-Valera 1909 · dominio público</Text>
      </ScrollView>
      {book && selected !== null && verses && (
        <VersePanel
          book={book}
          books={books}
          chapter={chapter}
          verse={selected}
          text={verses.find(([n]) => n === selected)?.[1] ?? ''}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: { fontSize: 18, fontWeight: '600' },
  fontButtons: { flexDirection: 'row', alignItems: 'baseline', gap: 16, paddingHorizontal: 8 },
  fontButton: { fontSize: 15, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 64, maxWidth: 720, width: '100%', alignSelf: 'center' },
  verse: { borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2, marginHorizontal: -4 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 },
  navButton: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  credit: { fontSize: 12, textAlign: 'center', marginTop: 24 },
});
