import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import StudyPanel from '@/components/StudyPanel';
import { text } from '@/components/comunidad/ui';
import { Book, getBooks } from '@/lib/data';
import { verseOfTheDay } from '@/lib/daily';
import { Entrada, deleteEntrada, toggleHecho, useDiario } from '@/lib/diario';
import { chapterHref, verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** «Mi diario devocional»: lo que la persona escribió al terminar cada devocional, lo más reciente primero. */
export default function Diario() {
  const colors = useColors();
  const entradas = useDiario();
  const [books, setBooks] = useState<Book[]>([]);
  const [today, setToday] = useState(false);
  const daily = verseOfTheDay();

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const pasos = entradas.filter((e) => e.paso);
  const hechos = pasos.filter((e) => e.hecho).length;
  const dailyBook = books.find((b) => b.id === daily.book);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Mi diario devocional' }} />

      {entradas.length === 0 ? (
        <Appear style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontFamily: serif, fontSize: 34, color: colors.accent }}>♡</Text>
          <Text style={[text.title, { color: colors.text, textAlign: 'center', marginTop: 6 }]}>Tu diario está esperando</Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center', marginTop: 8 }]}>
            Al terminar un devocional, lo que escribas (la frase que te detuvo, tu oración y tu paso para hoy) se guarda
            aquí, solo en este dispositivo.
          </Text>
          {dailyBook && (
            <Pressable onPress={() => setToday(true)} style={[styles.cta, { backgroundColor: colors.accent }]}>
              <Text style={{ color: colors.surface, fontWeight: '700' }}>Hacer el devocional de hoy</Text>
            </Pressable>
          )}
        </Appear>
      ) : (
        <>
          <Appear style={styles.summary}>
            <Stat value={entradas.length} label={entradas.length === 1 ? 'devocional' : 'devocionales'} colors={colors} />
            <Stat value={`${hechos}/${pasos.length}`} label="pasos dados" colors={colors} />
            {dailyBook && (
              <Pressable
                onPress={() => setToday(true)}
                style={({ pressed }) => [styles.todayBtn, { backgroundColor: colors.accent }, pressed && { opacity: 0.8 }]}
              >
                <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 13 }}>♡ El de hoy</Text>
              </Pressable>
            )}
          </Appear>
          {entradas.map((e, i) => (
            <Appear key={e.id} delay={Math.min(i, 6) * 40}>
              <EntryCard entrada={e} colors={colors} />
            </Appear>
          ))}
          <Text style={[text.small, { color: colors.muted, marginTop: 8, textAlign: 'center' }]}>
            🔒 Tu diario se guarda solo en este dispositivo.
          </Text>
        </>
      )}

      {today && dailyBook && (
        <StudyPanel
          book={dailyBook}
          chapter={daily.chapter}
          verse={daily.verse}
          enfoque="devocional"
          onClose={() => setToday(false)}
        />
      )}
    </ScrollView>
  );
}

function Stat({ value, label, colors }: { value: number | string; label: string; colors: Colors }) {
  return (
    <View style={{ marginRight: 22 }}>
      <Text style={{ fontFamily: serif, fontSize: 26, color: colors.text }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

function EntryCard({ entrada: e, colors }: { entrada: Entrada; colors: Colors }) {
  const [prayer, setPrayer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const date = new Date(e.created).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const open = () =>
    navigate(
      () => router.push(e.verse ? verseHref(e.book, e.chapter, e.verse) : chapterHref(e.book, e.chapter)),
      'forward',
    );

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.date, { color: colors.muted }]}>{date[0].toUpperCase() + date.slice(1)}</Text>
      <Pressable onPress={open} accessibilityRole="link">
        <Text style={[styles.ref, { color: colors.text }]}>
          {e.reference} <Text style={{ color: colors.accent, fontSize: 16 }}>›</Text>
        </Text>
      </Pressable>

      {!!e.palabra && (
        <View style={[styles.quote, { borderColor: colors.accent }]}>
          <Text style={[styles.quoteText, { color: colors.text }]}>{e.palabra}</Text>
        </View>
      )}

      {!!e.paso && (
        <Pressable
          onPress={() => toggleHecho(e.id)}
          style={[styles.step, { backgroundColor: e.hecho ? colors.accentSoft : colors.background }]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!e.hecho }}
        >
          <View style={[styles.check, { borderColor: colors.accent, backgroundColor: e.hecho ? colors.accent : 'transparent' }]}>
            {e.hecho && <Text style={{ color: colors.surface, fontSize: 12, fontWeight: '800' }}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stepLabel, { color: colors.accent }]}>{e.hecho ? 'PASO DADO' : 'MI PASO'}</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{e.paso}</Text>
          </View>
        </Pressable>
      )}

      {!!e.oracion &&
        (prayer ? (
          <Pressable onPress={() => setPrayer(false)}>
            <Text style={[styles.stepLabel, { color: colors.muted, marginTop: 12 }]}>MI ORACIÓN</Text>
            <Text style={[styles.prayer, { color: colors.text }]}>{e.oracion}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setPrayer(true)} hitSlop={6}>
            <Text style={{ color: colors.accent, fontWeight: '600', marginTop: 12 }}>♡ Ver mi oración</Text>
          </Pressable>
        ))}

      {e.llevar && (
        <Text style={[styles.carry, { color: colors.muted }]}>
          Para llevar: «{e.llevar.text}» (v. {e.llevar.verse})
        </Text>
      )}

      <Pressable
        onPress={() => (confirm ? deleteEntrada(e.id) : setConfirm(true))}
        onBlur={() => setConfirm(false)}
        style={styles.delete}
        hitSlop={6}
      >
        <Text style={{ color: confirm ? '#B3261E' : colors.muted, fontSize: 12, fontWeight: confirm ? '700' : '500' }}>
          {confirm ? 'Toca otra vez para borrar' : 'Borrar'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 28, alignItems: 'center', marginTop: 12 },
  cta: { borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12, marginTop: 20 },
  summary: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  todayBtn: { marginLeft: 'auto', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, marginBottom: 14 },
  date: { fontSize: 12, fontWeight: '600' },
  ref: { fontFamily: serif, fontSize: 22, marginTop: 2 },
  quote: { borderLeftWidth: 3, paddingLeft: 12, marginTop: 12 },
  quoteText: { fontFamily: serif, fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  step: { flexDirection: 'row', gap: 12, borderRadius: 12, padding: 12, marginTop: 12, alignItems: 'flex-start' },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginBottom: 2 },
  prayer: { fontFamily: serif, fontSize: 16, lineHeight: 24 },
  carry: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  delete: { alignSelf: 'flex-end', marginTop: 10 },
});
