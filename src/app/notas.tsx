import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import NoteEditor from '@/components/NoteEditor';
import { Chips, text } from '@/components/comunidad/ui';
import { Book, getBooks, getChapter } from '@/lib/data';
import { HIGHLIGHT_COLORS, HighlightColor, useAllHighlights } from '@/lib/highlights';
import { parseNoteKey, useNotes } from '@/lib/notas';
import { verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Filter = 'todo' | 'notas' | HighlightColor;

/** «Mis resaltados y notas»: todo lo que la persona marcó o escribió, lo más reciente primero. */
export default function MisNotas() {
  const colors = useColors();
  const notes = useNotes();
  const marks = useAllHighlights();
  const [books, setBooks] = useState<Book[]>([]);
  const [filter, setFilter] = useState<Filter>('todo');
  const [editing, setEditing] = useState<{ key: string; reference: string; text: string } | null>(null);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const keys = [...new Set([...Object.keys(notes), ...Object.keys(marks)])]
    .filter((k) => (filter === 'todo' ? true : filter === 'notas' ? notes[k] : marks[k]?.color === filter))
    .sort((a, b) => Math.max(notes[b]?.updated ?? 0, marks[b]?.at ?? 0) - Math.max(notes[a]?.updated ?? 0, marks[a]?.at ?? 0));
  const total = new Set([...Object.keys(notes), ...Object.keys(marks)]).size;
  const name = (id: string) => books.find((b) => b.id === id)?.name ?? '';

  const filters: { value: Filter; label: string }[] = [
    { value: 'todo', label: 'Todo' },
    { value: 'notas', label: `✎ Notas (${Object.keys(notes).length})` },
    ...(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[])
      .filter((c) => Object.values(marks).some((m) => m.color === c))
      .map((c) => ({ value: c, label: `● ${c[0].toUpperCase()}${c.slice(1)}` })),
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Mis resaltados y notas' }} />
      {total === 0 ? (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Text style={[text.title, { color: colors.text }]}>Aún no hay nada aquí</Text>
          <Text style={[text.body, { color: colors.muted }]}>
            Mientras lees, toca un versículo: puedes resaltarlo con un color o escribir una nota con lo que Dios te dice.
            Todo se guarda aquí, solo para ti.
          </Text>
        </View>
      ) : (
        <>
          <Chips options={filters} value={filter} onChange={setFilter} />
          <View style={{ marginTop: 16 }}>
            {keys.map((k) => (
              <Item
                key={k}
                k={k}
                name={name}
                note={notes[k]?.text}
                color={marks[k]?.color}
                colors={colors}
                onEdit={(reference, text) => setEditing({ key: k, reference, text })}
              />
            ))}
          </View>
          <Text style={[text.small, { color: colors.muted, marginTop: 20, textAlign: 'center' }]}>
            🔒 Tus notas y resaltados se guardan solo en este dispositivo.
          </Text>
        </>
      )}
      {editing && (
        <NoteEditor
          {...parseNoteKey(editing.key)}
          reference={editing.reference}
          text={editing.text}
          onClose={() => setEditing(null)}
        />
      )}
    </ScrollView>
  );
}

function Item({
  k,
  name,
  note,
  color,
  colors,
  onEdit,
}: {
  k: string;
  name: (id: string) => string;
  note?: string;
  color?: HighlightColor;
  colors: Colors;
  onEdit: (reference: string, text: string) => void;
}) {
  const { book, chapter, verse } = parseNoteKey(k);
  const [verseText, setVerseText] = useState('');
  const reference = `${name(book)} ${chapter}:${verse}`;

  useEffect(() => {
    getChapter(book, chapter)
      .then((vs) => setVerseText(vs.find(([n]) => n === verse)?.[1] ?? ''))
      .catch(() => {});
  }, [k]);

  return (
    <View style={[styles.item, { borderColor: colors.border }]}>
      <Pressable onPress={() => navigate(() => router.push(verseHref(book, chapter, verse)), 'forward')} accessibilityRole="link">
        <View style={styles.refRow}>
          {color && <View style={[styles.dot, { backgroundColor: HIGHLIGHT_COLORS[color] }]} />}
          <Text style={{ color: colors.accent, fontWeight: '700' }}>{reference}</Text>
        </View>
        <Text
          style={[styles.verse, { color: colors.text, backgroundColor: color ? HIGHLIGHT_COLORS[color] : undefined }]}
          numberOfLines={note ? 2 : 4}
        >
          {verseText}
        </Text>
      </Pressable>
      {note && (
        <Pressable onPress={() => onEdit(reference, verseText)} style={[styles.note, { borderColor: colors.accent }]} accessibilityLabel="Editar nota">
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{note}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  item: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  verse: { fontFamily: serif, fontSize: 16, lineHeight: 24, marginTop: 4, borderRadius: 4 },
  note: { borderLeftWidth: 3, paddingLeft: 12, marginTop: 10 },
});
