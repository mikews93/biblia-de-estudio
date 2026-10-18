import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Book, getBooks } from '@/lib/data';
import { useColors } from '@/lib/theme';

export default function BookPicker() {
  const colors = useColors();
  const [books, setBooks] = useState<Book[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    getBooks().then(setBooks);
  }, []);

  const section = (testament: Book['testament'], title: string) => (
    <View key={testament}>
      <Text style={[styles.section, { color: colors.muted }]}>{title}</Text>
      {books
        .filter((b) => b.testament === testament)
        .map((b) => (
          <View key={b.id} style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
            <Pressable onPress={() => setOpen(open === b.id ? null : b.id)} style={styles.book}>
              <Text style={[styles.bookName, { color: colors.text }]}>{b.name}</Text>
              {b.interlinear && <Text style={[styles.badge, { color: colors.accent }]}>griego</Text>}
            </Pressable>
            {open === b.id && (
              <View style={styles.grid}>
                {Array.from({ length: b.chapters }, (_, i) => i + 1).map((ch) => (
                  <Pressable
                    key={ch}
                    onPress={() => router.dismissTo(`/${b.id}/${ch}`)}
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
      {section('AT', 'Antiguo Testamento')}
      {section('NT', 'Nuevo Testamento')}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 4 },
  book: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  bookName: { fontSize: 18 },
  badge: { fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  chapter: { width: 48, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
