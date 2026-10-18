import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import VerseImage from '@/components/VerseImage';
import { Book, Version, getBooks, getChapter, getVersions } from '@/lib/data';
import { greeting, questionOfTheDay, verseOfTheDay } from '@/lib/daily';
import { WEEKLY_GOAL, useProgress, weekDays } from '@/lib/progress';
import { chapterHref, verseHref } from '@/lib/routes';
import { getLastRead, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Inicio («Hoy»): seguir leyendo, el versículo del día, la semana y accesos. */
export default function Today() {
  const colors = useColors();
  const { settings } = useSettings();
  const progress = useProgress();
  const [books, setBooks] = useState<Book[]>([]);
  const [last, setLast] = useState<{ book: string; chapter: number } | null>(null);
  const [verseText, setVerseText] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [sharing, setSharing] = useState(false);
  const daily = verseOfTheDay();

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
    getLastRead().then(setLast);
    getVersions().then(setVersions).catch(() => {});
  }, []);

  useEffect(() => {
    getChapter(daily.book, daily.chapter, settings.version)
      .then((verses) => setVerseText(verses.find(([n]) => n === daily.verse)?.[1] ?? null))
      .catch(() => setVerseText(null));
  }, [daily.book, daily.chapter, daily.verse, settings.version]);

  const name = (id: string) => books.find((b) => b.id === id)?.name ?? '';
  const dailyRef = `${name(daily.book)} ${daily.chapter}:${daily.verse}`;
  const week = weekDays(progress.days);
  const daysThisWeek = week.filter((d) => d.read).length;
  const chaptersRead = Object.values(progress.chapters).reduce((s, c) => s + c.length, 0);
  const continueTo = last ?? { book: 'jhn', chapter: 1 };


  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false, title: 'Hoy' }} />

      <Appear>
        <Text style={[styles.date, { color: colors.muted }]}>
          {capitalize(new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }))}
        </Text>
        <Text style={[styles.hello, { color: colors.text, fontFamily: serif }]}>{greeting()}</Text>
      </Appear>

      <Appear delay={40}>
        <Pressable
          onPress={() => navigate(() => router.push(chapterHref(continueTo.book, continueTo.chapter)), 'forward')}
          style={({ pressed }) => [styles.continue, { backgroundColor: colors.accent }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.kicker, { color: colors.accentSoft }]}>{last ? 'Seguir leyendo' : 'Empieza aquí'}</Text>
          <Text style={[styles.continueTitle, { color: colors.surface, fontFamily: serif }]}>
            {name(continueTo.book)} {continueTo.chapter}
          </Text>
          <Text style={{ color: colors.accentSoft, marginTop: 4 }}>Abrir el capítulo →</Text>
        </Pressable>
      </Appear>

      <Appear delay={80}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.accent }]}>Versículo del día</Text>
          <Text style={[styles.verse, { color: colors.text, fontFamily: serif }]}>
            {verseText ? `«${verseText}»` : ' '}
          </Text>
          <Text style={[styles.ref, { color: colors.muted }]}>{dailyRef}</Text>
          <View style={styles.row}>
            <SmallButton
              label="Leer el capítulo"
              colors={colors}
              onPress={() => navigate(() => router.push(verseHref(daily.book, daily.chapter, daily.verse)), 'forward')}
            />
            {verseText && <SmallButton label="Compartir" colors={colors} onPress={() => setSharing(true)} />}
          </View>
          <View style={[styles.question, { borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>PARA PENSAR HOY</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{questionOfTheDay()}</Text>
          </View>
        </View>
      </Appear>

      <Appear delay={120}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.accent }]}>Tu semana</Text>
          <View style={styles.week}>
            {week.map((d, i) => (
              <View key={i} style={{ alignItems: 'center' }}>
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
          <Text style={{ color: colors.text, fontSize: 14, marginTop: 10, textAlign: 'center' }}>
            {daysThisWeek >= WEEKLY_GOAL
              ? `¡Meta cumplida! ${daysThisWeek} días con la Palabra esta semana.`
              : `${daysThisWeek} de ${WEEKLY_GOAL} días esta semana · ${chaptersRead} capítulos leídos en total`}
          </Text>
        </View>
      </Appear>

      <Appear delay={160} style={styles.grid}>
        <Tile icon="☰" label="Libros" colors={colors} onPress={() => navigate(() => router.push('/libros'))} />
        <Tile
          icon="✦"
          label="Estudiar con IA"
          colors={colors}
          onPress={() => navigate(() => router.push(chapterHref(continueTo.book, continueTo.chapter)), 'forward')}
        />
        <Tile
          icon="◎"
          label="Comunidades"
          colors={colors}
          onPress={() => navigate(() => router.push('/comunidades' as never), 'forward')}
        />
      </Appear>
      {sharing && verseText && (
        <VerseImage
          verse={{
            book: daily.book,
            chapter: daily.chapter,
            verse: daily.verse,
            text: verseText,
            reference: dailyRef,
            version: versions.find((v) => v.id === settings.version)?.abbr ?? 'RV1909',
          }}
          onClose={() => setSharing(false)}
        />
      )}
    </ScrollView>
  );
}

type C = ReturnType<typeof useColors>;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function SmallButton({ label, colors, onPress }: { label: string; colors: C; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.small, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function Tile({ icon, label, colors, onPress }: { icon: string; label: string; colors: C; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <Text style={{ color: colors.accent, fontSize: 22, fontFamily: serif }}>{icon}</Text>
      <Text style={{ color: colors.text, fontWeight: '600', marginTop: 6 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 48, paddingBottom: 64, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  date: { fontSize: 14 },
  hello: { fontSize: 34, marginTop: 2 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  continue: { borderRadius: 20, padding: 20 },
  continueTitle: { fontSize: 28, marginTop: 6 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  verse: { fontSize: 21, lineHeight: 31, marginTop: 10 },
  ref: { marginTop: 8, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  small: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  question: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 14 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  grid: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 16, alignItems: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
