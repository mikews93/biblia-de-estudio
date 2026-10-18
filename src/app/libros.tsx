import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { parseCita } from '@/lib/cita';
import { Book, getBooks, original } from '@/lib/data';
import { useColors } from '@/lib/theme';
import { chapterHref, verseHref } from '@/lib/routes';
import { navigate } from '@/lib/transition';

export default function BookPicker() {
  const colors = useColors();
  const [books, setBooks] = useState<Book[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matches = (b: Book) => !query || norm(b.name).includes(norm(query));
  // «1 re 2:5» o «jn 3 16»: se abre directo. Con versión («… nbla») va al buscador, que dice si está en la app.
  const cita = /\d/.test(query) && books.length ? parseCita(query, books) : null;

  useEffect(() => {
    getBooks().then(setBooks);
  }, []);

  const section = (testament: Book['testament'], title: string) => (
    <View key={testament}>
      <Text style={[styles.section, { color: colors.muted }]}>{title}</Text>
      {books
        .filter((b) => b.testament === testament && matches(b))
        .map((b) => (
          <View key={b.id} style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
            <Pressable onPress={() => setOpen(open === b.id ? null : b.id)} style={styles.book}>
              <Text style={[styles.bookName, { color: colors.text }]}>{b.name}</Text>
              {b.interlinear && <Text style={[styles.badge, { color: colors.accent }]}>{original(b).name}</Text>}
            </Pressable>
            {(open === b.id || (query.length > 1 && books.filter(matches).length === 1)) && (
              <View style={styles.grid}>
                {Array.from({ length: b.chapters }, (_, i) => i + 1).map((ch) => (
                  <Pressable
                    key={ch}
                    onPress={() => navigate(() => router.dismissTo(chapterHref(b.id, ch)))}
                    style={[styles.chapter, { backgroundColor: colors.accentSoft }]}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>{ch}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar libro o cita (Jn 3:16)"
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        style={[styles.search, { backgroundColor: colors.accentSoft, color: colors.text }]}
      />
      {cita && !cita.problem && (
        <Pressable
          onPress={() =>
            cita.version
              ? navigate(() => router.push(`/buscar?q=${encodeURIComponent(query.trim())}` as never), 'forward')
              : navigate(() =>
                  router.dismissTo(cita.verse === undefined ? chapterHref(cita.book, cita.chapter) : verseHref(cita.book, cita.chapter, cita.verse!)),
                )
          }
          style={[styles.idea, { borderColor: colors.border }]}
          accessibilityRole="link"
        >
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 16 }}>
            Abrir {books.find((b) => b.id === cita.book)?.name} {cita.chapter}
            {cita.verse !== undefined ? `:${cita.verse}` : ''} ›
          </Text>
        </Pressable>
      )}
      <Pressable
        onPress={() =>
          navigate(() => router.push((query.trim() && !books.some(matches) ? `/buscar?q=${encodeURIComponent(query.trim())}` : '/buscar') as never), 'forward')
        }
        style={[styles.idea, { borderColor: colors.border }]}
        accessibilityRole="link"
      >
        <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 15 }}>
          {query.trim() && !books.some(matches) && !cita ? `✦ Buscar «${query.trim()}» por palabras o idea ›` : '✦ Buscar por cita, palabras o idea ›'}
        </Text>
      </Pressable>
      {section('AT', 'Antiguo Testamento')}
      {section('NT', 'Nuevo Testamento')}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  search: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  idea: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 4 },
  book: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  bookName: { fontSize: 18 },
  badge: { fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  chapter: { width: 48, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
