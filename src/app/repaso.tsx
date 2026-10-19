// /repaso: las tarjetas que tocan hoy (todas, o solo las de un capítulo con ?libro=jhn&capitulo=3)
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { IconText } from '@/components/comunidad/ui';
import { CardsIcon, CheckIcon } from '@/components/icons';
import { Book, getBooks } from '@/lib/data';
import { chapterHref, verseHref } from '@/lib/routes';
import { Card, Grade, SESSION_SIZE, dueCards, grade, intervalLabel, removeCards, schedule, useCards } from '@/lib/tarjetas';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const GRADES: { grade: Grade; label: string }[] = [
  { grade: 'otra', label: 'Otra vez' },
  { grade: 'dificil', label: 'Difícil' },
  { grade: 'bien', label: 'Bien' },
  { grade: 'facil', label: 'Fácil' },
];

export default function Review() {
  const params = useLocalSearchParams<{ libro?: string; capitulo?: string }>();
  const book = params.libro;
  const chapter = params.capitulo ? Number(params.capitulo) : undefined;
  const colors = useColors();
  const deck = useCards();
  const [books, setBooks] = useState<Book[]>([]);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [shown, setShown] = useState(false);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  // La sesión se arma una vez, cuando ya cargaron las tarjetas
  const total = Object.keys(deck).length;
  useEffect(() => {
    if (queue === null && total > 0) setQueue(dueCards(deck, book, chapter).slice(0, SESSION_SIZE).map((c) => c.id));
  }, [deck, total, queue, book, chapter]);

  const card: Card | undefined = queue?.length ? deck[queue[0]] : undefined;
  const name = (id: string) => books.find((b) => b.id === id)?.name ?? '';
  const upcoming = useMemo(
    () => Object.values(deck).filter((c) => !book || (c.book === book && c.chapter === chapter)).sort((a, b) => a.due.localeCompare(b.due))[0],
    [deck, book, chapter],
  );

  const answer = async (g: Grade) => {
    if (!card || !queue) return;
    await grade(card.id, g);
    setShown(false);
    setReviewed((r) => new Set(r).add(card.id));
    // «Otra vez» la deja al final de la sesión para verla de nuevo
    setQueue(g === 'otra' ? [...queue.slice(1), card.id] : queue.slice(1));
  };

  const remove = async () => {
    if (!card || !queue) return;
    await removeCards([card.id]);
    setShown(false);
    setQueue(queue.slice(1));
  };

  const scope = book && chapter ? `${name(book)} ${chapter}` : 'Todas tus tarjetas';

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Repaso' }} />
      <IconText icon={CardsIcon} color={colors.accent} size={14}>
        <Text style={[styles.kicker, { color: colors.accent }]}>REPASO · {scope.toUpperCase()}</Text>
      </IconText>
      {queue && queue.length > 0 && (
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          {queue.length} {queue.length === 1 ? 'tarjeta pendiente' : 'tarjetas pendientes'}
        </Text>
      )}

      {total === 0 ? (
        <Empty colors={colors} />
      ) : card ? (
        <Appear key={`${card.id}-${queue?.length}`}>
          <Pressable
            onPress={() => setShown(true)}
            disabled={shown}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityHint={shown ? undefined : 'Mostrar la respuesta'}
          >
            <Text style={[styles.label, { color: colors.accent }]}>
              {card.kind === 'versiculo' ? 'MEMORIZAR' : 'PREGUNTA'} · {card.label}
            </Text>
            <Text style={[styles.front, { color: colors.text, fontFamily: serif }]}>{card.front}</Text>
            {shown ? (
              <View style={[styles.back, { borderColor: colors.border }]}>
                <Text style={[styles.backText, { color: colors.text, fontFamily: card.kind === 'versiculo' ? serif : undefined }]}>
                  {card.back}
                </Text>
                {card.verse && (
                  <Pressable onPress={() => navigate(() => router.push(verseHref(card.book, card.chapter, card.verse!)), 'forward')}>
                    <Text style={{ color: colors.accent, fontWeight: '600', marginTop: 10 }}>
                      Leer {name(card.book)} {card.chapter}:{card.verse} ›
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text style={[styles.tap, { color: colors.muted }]}>
                {card.kind === 'versiculo' ? 'Dilo de memoria y toca para comprobar' : 'Piensa la respuesta y toca para verla'}
              </Text>
            )}
          </Pressable>

          {shown && (
            <>
              <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 18, fontSize: 13 }}>¿Cómo te fue?</Text>
              <View style={styles.grades}>
                {GRADES.map((g) => {
                  const next = schedule(card, g.grade).interval;
                  return (
                    <Pressable
                      key={g.grade}
                      onPress={() => answer(g.grade)}
                      style={({ pressed }) => [
                        styles.grade,
                        { borderColor: g.grade === 'bien' ? colors.accent : colors.border, backgroundColor: colors.surface },
                        g.grade === 'bien' && { backgroundColor: colors.accentSoft },
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${g.label}: volver a verla ${next === 0 ? 'ahora' : `en ${intervalLabel(next)}`}`}
                    >
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{g.label}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                        {next === 0 ? 'ahora' : intervalLabel(next)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={remove} style={{ alignSelf: 'center', marginTop: 18 }} hitSlop={8}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>Quitar esta tarjeta</Text>
              </Pressable>
            </>
          )}
        </Appear>
      ) : (
        queue && (
          <Appear>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center' }]}>
              <View style={[styles.done, { backgroundColor: colors.accentSoft }]}>
                <CheckIcon color={colors.accent} size={30} strokeWidth={2.2} />
              </View>
              <Text style={[styles.front, { color: colors.text, fontFamily: serif, textAlign: 'center' }]}>
                {reviewed.size ? '¡Repaso terminado!' : 'Nada pendiente por hoy'}
              </Text>
              <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
                {reviewed.size ? `Repasaste ${reviewed.size} ${reviewed.size === 1 ? 'tarjeta' : 'tarjetas'}. ` : ''}
                {upcoming ? `La próxima tarjeta toca ${upcomingLabel(upcoming.due)}.` : ''}
              </Text>
              {book && chapter && (
                <Pressable onPress={() => navigate(() => router.push(chapterHref(book, chapter)), 'back')} style={{ marginTop: 14 }}>
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>Volver a {name(book)} {chapter} ›</Text>
                </Pressable>
              )}
            </View>
          </Appear>
        )
      )}
    </ScrollView>
  );
}

function upcomingLabel(due: string) {
  const [y, m, d] = due.split('-').map(Number);
  const days = Math.round((new Date(y, m - 1, d).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'mañana';
  return `en ${intervalLabel(days)}`;
}

function Empty({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.front, { color: colors.text, fontFamily: serif }]}>Todavía no tienes tarjetas</Text>
      <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 21 }}>
        Al leer un capítulo, toca «Tarjetas» para que la IA prepare preguntas de repaso, o elige un versículo y toca
        «Memorizar». Aquí te las mostraremos cuando toque repasarlas.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  done: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 64, maxWidth: 620, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 22, marginTop: 18, minHeight: 220 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  front: { fontSize: 22, lineHeight: 30, marginTop: 10 },
  tap: { marginTop: 'auto', paddingTop: 24, fontSize: 13, textAlign: 'center' },
  back: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 16 },
  backText: { fontSize: 18, lineHeight: 27 },
  grades: { flexDirection: 'row', gap: 8, marginTop: 10 },
  grade: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: 14, paddingVertical: 10 },
});
