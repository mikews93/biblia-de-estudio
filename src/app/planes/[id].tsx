import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CheckIcon, ChevronRightIcon } from '@/components/icons';
import PlanCard, { readingsLabel, shortDate } from '@/components/PlanCard';
import PlanIcon from '@/components/PlanIcon';
import Reto from '@/components/Reto';
import { confirm } from '@/components/comunidad/confirm';
import { Button, Card, Chips, SectionTitle, text } from '@/components/comunidad/ui';
import { Book, getBooks } from '@/lib/data';
import { useAllHighlights } from '@/lib/highlights';
import { useNotes } from '@/lib/notas';
import {
  DAYS_OPTIONS,
  MINUTE_OPTIONS,
  MyPlan,
  PlanDay,
  dayMinutes,
  expand,
  parseDate,
  planDays,
  planDef,
  planStatus,
  removePlan,
  splitByTime,
  startPlan,
  todayKey,
  updatePlan,
  usePlans,
  useWords,
} from '@/lib/planes';
import { WEEKLY_GOAL } from '@/lib/progress';
import { chapterHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function PlanScreen() {
  const { id, dia } = useLocalSearchParams<{ id: string; dia?: string }>();
  const colors = useColors();
  const plans = usePlans();
  const words = useWords();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [minutes, setMinutes] = useState(10);
  const [daysPerWeek, setDaysPerWeek] = useState(WEEKLY_GOAL);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => setBooks([]));
  }, []);

  if (!books) return <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />;
  const def = planDef(id, books);
  if (!def) return <Text style={{ color: colors.muted, padding: 24 }}>No encontramos este plan.</Text>;

  // Los retos de temporada tienen su propia pantalla, con el calendario del año cristiano
  if (def.season) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: '' }} />
        <Reto def={def} books={books} focus={dia ? Number(dia) - 1 : undefined} />
      </ScrollView>
    );
  }

  const mine = plans.find((p) => p.def === id);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: '' }} />
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
        <PlanIcon icono={def.icono} color={colors.accent} size={30} />
      </View>
      <Text style={[text.title, { color: colors.text }]}>{def.title}</Text>
      <Text style={[text.body, { color: colors.muted, marginTop: 6 }]}>{def.description}</Text>

      {mine ? (
        <Active plan={mine} books={books} colors={colors} />
      ) : (
        <Setup
          def={def}
          books={books}
          minutes={minutes}
          setMinutes={setMinutes}
          daysPerWeek={daysPerWeek}
          setDaysPerWeek={setDaysPerWeek}
          colors={colors}
          words={words}
        />
      )}
    </ScrollView>
  );
}

function Setup({
  def,
  books,
  minutes,
  setMinutes,
  daysPerWeek,
  setDaysPerWeek,
  colors,
  words,
}: {
  def: NonNullable<ReturnType<typeof planDef>>;
  books: Book[];
  minutes: number;
  setMinutes: (n: number) => void;
  daysPerWeek: number;
  setDaysPerWeek: (n: number) => void;
  colors: Colors;
  words: ReturnType<typeof useWords>;
}) {
  const readings = expand(def, books);
  const days = splitByTime(readings, minutes, words).length;
  const weeks = days / daysPerWeek;
  const end = new Date();
  end.setDate(end.getDate() + Math.ceil(weeks * 7) - 1);

  return (
    <>
      <SectionTitle>¿Cuánto tiempo tienes al día?</SectionTitle>
      <Chips options={MINUTE_OPTIONS.map((m) => ({ value: m, label: `${m} min` }))} value={minutes} onChange={setMinutes} />
      <SectionTitle>¿Cuántos días a la semana?</SectionTitle>
      <Chips options={DAYS_OPTIONS.map((d) => ({ value: d, label: d === 7 ? 'Todos' : String(d) }))} value={daysPerWeek} onChange={setDaysPerWeek} />
      <Card style={{ marginTop: 20 }}>
        <Text style={[text.body, { color: colors.text }]}>
          {readings.length} capítulos en {days} {days === 1 ? 'día' : 'días'} de lectura. A este ritmo terminarías hacia el{' '}
          {end.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
          {weeks >= 1 ? ` (unas ${Math.round(weeks)} semanas)` : ''}.
        </Text>
        <Text style={[text.small, { color: colors.muted, marginTop: 8 }]}>
          No hay fechas que cumplir: cada día lees lo siguiente. Puedes cambiar el tiempo cuando quieras.
        </Text>
        <Button label="Empezar el plan" onPress={() => startPlan(def, books, { minutes, daysPerWeek })} style={{ marginTop: 16 }} />
      </Card>
    </>
  );
}

function Active({ plan, books, colors }: { plan: MyPlan; books: Book[]; colors: Colors }) {
  const words = useWords();
  const notes = useNotes();
  const marks = useAllHighlights();
  const [all, setAll] = useState(false);
  const def = planDef(plan.def, books);
  const days = planDays(plan, def, words);
  const status = planStatus(plan, days);
  const today = todayKey();

  // Profundidad, no velocidad: días con la Palabra, notas y resaltados en los capítulos del plan
  const chapters = new Set(plan.readings.map(([b, c]) => `${b}.${c}.`));
  const inPlan = (k: string) => chapters.has(k.slice(0, k.lastIndexOf('.') + 1));
  const daysRead = new Set(Object.values(plan.done)).size;
  const noteCount = Object.keys(notes).filter(inPlan).length;
  const markCount = Object.keys(marks).filter(inPlan).length;

  const from = all ? 0 : Math.max(0, (status.next ?? days.length) - 2);
  const shown = all || days.length <= 45 ? days : days.slice(from, from + 14);
  const offset = all || days.length <= 45 ? 0 : from;

  const leave = async () => {
    if (await confirm('¿Dejar este plan?', 'Se borrará tu avance en el plan. Tus notas y capítulos leídos se quedan.', 'Dejar'))
      removePlan(plan.id);
  };

  return (
    <>
      <View style={{ marginTop: 20 }}>
        <PlanCard plan={plan} books={books} words={words} colors={colors} />
      </View>

      <View style={styles.stats}>
        <Stat value={daysRead} label={daysRead === 1 ? 'día con la Palabra' : 'días con la Palabra'} colors={colors} />
        <Stat value={noteCount} label={noteCount === 1 ? 'nota escrita' : 'notas escritas'} colors={colors} />
        <Stat value={markCount} label={markCount === 1 ? 'versículo resaltado' : 'versículos resaltados'} colors={colors} />
      </View>
      {!plan.finished && !def?.season && (
        <Text style={[text.small, { color: colors.muted, textAlign: 'center', marginTop: 10 }]}>
          A este ritmo terminas hacia el {shortDate(status.estimatedEnd)}.
        </Text>
      )}

      <SectionTitle>Lecturas</SectionTitle>
      {shown.map((d, i) => (
        <DayRow key={offset + i} n={offset + i} day={d} plan={plan} books={books} colors={colors} words={words} today={today} current={status.next === offset + i} />
      ))}
      {days.length > 45 && (
        <Pressable onPress={() => setAll(!all)} style={{ paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>{all ? 'Ver menos' : `Ver los ${days.length} días`}</Text>
        </Pressable>
      )}

      {!plan.finished && !def?.season && (
        <>
          <SectionTitle>Tu ritmo</SectionTitle>
          <Chips
            options={MINUTE_OPTIONS.map((m) => ({ value: m, label: `${m} min` }))}
            value={plan.minutes}
            onChange={(m) => updatePlan(plan.id, { minutes: m })}
          />
          <Text style={[text.small, { color: colors.muted, marginTop: 14, marginBottom: 8 }]}>Días por semana</Text>
          <Chips
            options={DAYS_OPTIONS.map((d) => ({ value: d, label: d === 7 ? 'Todos' : String(d) }))}
            value={plan.daysPerWeek}
            onChange={(d) => updatePlan(plan.id, { daysPerWeek: d })}
          />
        </>
      )}
      <Button label={plan.finished ? 'Quitar de mis planes' : 'Dejar este plan'} kind="quiet" onPress={leave} style={{ marginTop: 28 }} />
    </>
  );
}

function DayRow({
  n,
  day,
  plan,
  books,
  colors,
  words,
  today,
  current,
}: {
  n: number;
  day: PlanDay;
  plan: MyPlan;
  books: Book[];
  colors: Colors;
  words: ReturnType<typeof useWords>;
  today: string;
  current: boolean;
}) {
  const done = day.readings.every((i) => plan.done[i]);
  const target = day.readings.find((i) => !plan.done[i]) ?? day.readings[0];
  const [b, c] = plan.readings[target];
  const isToday = day.date === today;
  return (
    <Pressable
      onPress={() => navigate(() => router.push(chapterHref(b, c)), 'forward')}
      style={({ pressed }) => [
        styles.day,
        { borderColor: colors.border },
        current && { backgroundColor: colors.accentSoft, borderRadius: 12 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.check, { borderColor: done ? colors.accent : colors.border }, done && { backgroundColor: colors.accent }]}>
        {done && <CheckIcon color={colors.surface} size={14} strokeWidth={2.6} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
          DÍA {n + 1}
          {day.date ? ` · ${isToday ? 'HOY' : parseDate(day.date).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}` : ''}
        </Text>
        {day.title && <Text style={{ color: colors.text, fontFamily: serif, fontSize: 16, marginTop: 1 }}>{day.title}</Text>}
        <Text style={{ color: day.title ? colors.muted : colors.text, fontSize: day.title ? 13 : 15, marginTop: 1 }}>
          {readingsLabel(plan, day.readings, books)} · {dayMinutes(plan, day, words)} min
        </Text>
      </View>
      <ChevronRightIcon color={colors.muted} size={18} />
    </Pressable>
  );
}

function Stat({ value, label, colors }: { value: number; label: string; colors: Colors }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={{ color: colors.accent, fontSize: 24, fontFamily: serif }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  icon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  day: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
