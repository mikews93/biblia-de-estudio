// /tarjetas/juan/3: la IA propone tarjetas de repaso del capítulo; la persona elige cuáles guardar
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Sources } from '@/components/StudyPanel';
import { ToolFooter, ToolState } from '@/components/ToolState';
import { Book, getBooks, parseRef } from '@/lib/data';
import { useHerramienta } from '@/lib/herramientas';
import { bookIdFromParam, verseHref } from '@/lib/routes';
import { addCards, parseCards, questionCardId, useCards } from '@/lib/tarjetas';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function ChapterCards() {
  const params = useLocalSearchParams<{ book: string; chapter: string }>();
  const bookId = bookIdFromParam(params.book);
  const chapter = Number(params.chapter);
  const colors = useColors();
  const [book, setBook] = useState<Book | null>(null);
  const tool = useHerramienta('tarjetas', bookId, chapter);
  const deck = useCards();
  const proposed = useMemo(
    () =>
      parseCards(tool.text, tool.sources, bookId, chapter).map((c) => ({
        ...c,
        id: questionCardId(bookId, chapter, c.front),
        label: c.verse ? `${book?.name ?? ''} ${chapter}:${c.verse}` : c.label || `${book?.name ?? ''} ${chapter}`,
      })),
    [tool.text, tool.sources, bookId, chapter, book],
  );
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  useEffect(() => {
    getBooks().then((bs) => setBook(bs.find((b) => b.id === bookId) ?? null));
  }, [bookId]);

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };
  const fresh = proposed.filter((c) => !deck[c.id]);
  const chosen = fresh.filter((c) => !skipped.has(c.id));
  const inDeck = Object.values(deck).filter((c) => c.book === bookId && c.chapter === chapter).length;
  const review = `/repaso?libro=${bookId}&capitulo=${chapter}`;

  const save = async () => {
    await addCards(chosen);
    navigate(() => router.push(review as never), 'forward');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Tarjetas de repaso' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.kicker, { color: colors.accent }]}>▤ TARJETAS DE REPASO</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>{book ? `${book.name} ${chapter}` : ''}</Text>
        <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>
          Elige las que quieras guardar. Te las mostraremos justo antes de que se te olviden: primero mañana, luego en unos
          días y cada vez más espaciadas.
        </Text>
        {inDeck > 0 && (
          <Pressable onPress={() => navigate(() => router.push(review as never), 'forward')} style={{ marginTop: 10 }}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>
              Ya tienes {inDeck} {inDeck === 1 ? 'tarjeta' : 'tarjetas'} de este capítulo · Repasar ›
            </Text>
          </Pressable>
        )}

        <ToolState
          colors={colors}
          busy={tool.busy}
          error={tool.error}
          waiting={proposed.length ? null : 'Preparando preguntas con el texto, el griego y las referencias…'}
          onRetry={tool.retry}
        />

        <View style={{ marginTop: 16, gap: 10 }}>
          {proposed.map((c) => {
            const saved = !!deck[c.id];
            const on = !saved && !skipped.has(c.id);
            return (
              <Pressable
                key={c.id}
                disabled={saved}
                onPress={() =>
                  setSkipped((s) => {
                    const next = new Set(s);
                    if (next.has(c.id)) next.delete(c.id);
                    else next.add(c.id);
                    return next;
                  })
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on || saved, disabled: saved }}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: on ? colors.accent : colors.border },
                  !on && !saved && { opacity: 0.55 },
                ]}
              >
                <View style={[styles.check, { borderColor: on || saved ? colors.accent : colors.border }, (on || saved) && { backgroundColor: colors.accent }]}>
                  {(on || saved) && <Text style={{ color: colors.surface, fontSize: 12, fontWeight: '700' }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 21 }}>{c.front}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{c.back}</Text>
                  <Text style={{ color: colors.accent, fontSize: 12, marginTop: 4 }}>
                    {c.label}
                    {saved ? ' · ya está en tu repaso' : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {tool.done && !!tool.sources.length && <Sources sources={tool.sources} colors={colors} onOpen={open} />}
        <ToolFooter colors={colors} done={tool.done} onRegenerate={tool.regenerate} />
      </ScrollView>

      {tool.done && fresh.length > 0 && (
        <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={save}
            disabled={!chosen.length}
            style={[styles.save, { backgroundColor: chosen.length ? colors.accent : colors.border }]}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>
              {chosen.length ? `Guardar ${chosen.length} y repasar` : 'Elige alguna tarjeta'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 120, maxWidth: 680, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 30, marginTop: 4 },
  card: { flexDirection: 'row', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, padding: 12, alignItems: 'center' },
  save: { borderRadius: 24, paddingHorizontal: 28, paddingVertical: 13, minWidth: 260, alignItems: 'center' },
});
