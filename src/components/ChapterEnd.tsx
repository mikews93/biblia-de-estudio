import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAccount } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import { plansWaitingFor, todayKey, usePlans } from '@/lib/planes';
import { WEEKLY_GOAL, markChapterRead, useProgress, weekDays } from '@/lib/progress';
import { Colors, serif } from '@/lib/theme';
import { chapterHref } from '@/lib/routes';
import { navigate } from '@/lib/transition';

type Props = { book: Book; chapter: number; next: string | null; colors: Colors; onNext: () => void };

/** Cierre del capítulo: marcarlo como leído, la semana con su meta flexible y el avance del libro. */
export default function ChapterEnd({ book, chapter, next, colors, onNext }: Props) {
  const progress = useProgress();
  const readInBook = progress.chapters[book.id] ?? [];
  const plans = usePlans();
  // Un capítulo ya leído antes vuelve a ofrecer el botón si un plan lo tiene pendiente
  const done = readInBook.includes(chapter) && plansWaitingFor(plans, book.id, chapter).length === 0;
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);
  const name = (id: string) => books.find((b) => b.id === id)?.name ?? '';
  // Planes en curso con este capítulo, y los que se terminaron hoy
  const myPlans = plans.filter(
    (p) => (!p.finished || p.finished === todayKey()) && p.started <= todayKey() && p.readings.some(([b, c]) => b === book.id && c === chapter),
  );
  const week = weekDays(progress.days);
  const daysThisWeek = week.filter((d) => d.read).length;
  const { grupos } = useAccount();

  return (
    <View style={styles.wrap}>
      <View style={[styles.ornament, { backgroundColor: colors.border }]} />

      {done ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.doneTitle, { color: colors.accent }]}>✓ Capítulo leído</Text>
          <View style={styles.week}>
            {week.map((d, i) => (
              <View key={i} style={styles.day}>
                <View
                  style={[
                    styles.dot,
                    { borderColor: d.isToday ? colors.accent : colors.border },
                    d.read && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                />
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{d.label}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.caption, { color: colors.text }]}>
            {daysThisWeek >= WEEKLY_GOAL
              ? `¡Meta de la semana cumplida! ${daysThisWeek} días con la Palabra.`
              : `${daysThisWeek} de ${WEEKLY_GOAL} días esta semana. Si un día no puedes, no pasa nada.`}
          </Text>
          <View style={[styles.bar, { backgroundColor: colors.accentSoft }]}>
            <View
              style={[
                styles.barFill,
                { backgroundColor: colors.accent, width: `${(readInBook.length / book.chapters) * 100}%` },
              ]}
            />
          </View>
          <Text style={[styles.small, { color: colors.muted }]}>
            {readInBook.length === book.chapters
              ? `Terminaste ${book.name}.`
              : `${readInBook.length} de ${book.chapters} capítulos de ${book.name}`}
          </Text>
          {myPlans.map((p) => {
            const next = p.readings.findIndex((_, i) => !p.done[i]);
            const [nb, nc] = next === -1 ? ['', 0] : p.readings[next];
            return (
              <Pressable
                key={p.id}
                onPress={() =>
                  navigate(
                    () => router.push(next === -1 || (nb === book.id && nc === chapter + 1) ? `/planes/${p.def}` : chapterHref(nb, nc)),
                    'forward',
                  )
                }
                style={[styles.group, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text, fontSize: 13, textAlign: 'center' }}>
                  {p.finished
                    ? `🎉 ¡Terminaste el plan «${p.title}»! Ver tu recorrido ›`
                    : `${p.title}: ${Object.keys(p.done).length} de ${p.readings.length}` +
                      (nb === book.id && nc === chapter + 1 ? ' · ver el plan ›' : ` · Sigue con ${name(nb)} ${nc} ›`)}
                </Text>
              </Pressable>
            );
          })}
          {grupos?.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => navigate(() => router.push(`/comunidades/${g.id}`), 'forward')}
              style={[styles.group, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontSize: 13 }}>
                {g.nombre}: {g.leyeronHoy} de {g.miembros} leyeron hoy ›
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable
          onPress={() => markChapterRead(book.id, chapter)}
          style={[styles.markButton, { borderColor: colors.accent }]}
          accessibilityRole="button"
        >
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>Terminé este capítulo</Text>
        </Pressable>
      )}

      {next && (
        <Pressable onPress={onNext} style={[styles.next, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>SIGUIENTE</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontFamily: serif, marginTop: 2 }}>{next} ›</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 40, gap: 16 },
  ornament: { width: 48, height: 2, borderRadius: 1, marginBottom: 8 },
  markButton: { borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12 },
  card: { alignSelf: 'stretch', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 18, alignItems: 'center' },
  doneTitle: { fontSize: 16, fontWeight: '700' },
  week: { flexDirection: 'row', gap: 12, marginTop: 14 },
  day: { alignItems: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  caption: { fontSize: 14, textAlign: 'center', marginTop: 12 },
  bar: { height: 6, borderRadius: 3, alignSelf: 'stretch', marginTop: 16, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  small: { fontSize: 12, marginTop: 6 },
  group: { alignSelf: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 12, alignItems: 'center' },
  next: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center' },
});
