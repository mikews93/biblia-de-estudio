import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconText, Meter } from '@/components/comunidad/ui';
import { CheckIcon } from '@/components/icons';
import { Book } from '@/lib/data';
import { MyPlan, Words, dayMinutes, parseDate, planDays, planDef, planStatus, todayKey } from '@/lib/planes';
import { chapterHref } from '@/lib/routes';
import { seasonTint } from '@/lib/retos';
import { Colors, serif } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export const shortDate = (s: string) => parseDate(s).toLocaleDateString('es', { day: 'numeric', month: 'long' });

/** Nombre corto de las lecturas de un día: «Juan 3», «Juan 3–4», «Salmos 1–3 · Proverbios 1». */
export function readingsLabel(plan: MyPlan, indices: number[], books: Book[]) {
  const name = (id: string) => books.find((b) => b.id === id)?.name ?? id;
  const groups: { book: string; from: number; to: number }[] = [];
  for (const i of indices) {
    const [b, c] = plan.readings[i];
    const last = groups[groups.length - 1];
    if (last && last.book === b && last.to === c - 1) last.to = c;
    else groups.push({ book: b, from: c, to: c });
  }
  return groups.map((g) => `${name(g.book)} ${g.from}${g.to > g.from ? `–${g.to}` : ''}`).join(' · ');
}

/** Tarjeta de un plan en curso: lo que toca hoy y el avance. Se usa en Hoy y en Planes. */
export default function PlanCard({ plan, books, words, colors }: { plan: MyPlan; books: Book[]; words: Words | null; colors: Colors }) {
  const def = planDef(plan.def, books);
  const days = planDays(plan, def, words);
  const status = planStatus(plan, days);
  const today = todayKey();
  const waiting = plan.started > today;
  const day = status.next !== null ? days[status.next] : null;
  const firstPending = day?.readings.find((i) => !plan.done[i]);

  // Los retos de temporada llevan el color de su tiempo litúrgico
  const tint = def?.season ? seasonTint(def.season, colors) : null;
  const accent = tint?.accent ?? colors.accent;
  const question = def?.questions && day ? def.questions[day.readings[0]] : null;

  const open = () => navigate(() => router.push(`/planes/${plan.def}`), 'forward');
  const read = () => {
    if (firstPending === undefined) return open();
    const [b, c] = plan.readings[firstPending];
    navigate(() => router.push(chapterHref(b, c)), 'forward');
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {tint && <View style={[styles.stripe, { backgroundColor: accent }]} />}
      <Pressable onPress={open} style={({ pressed }) => pressed && { opacity: 0.7 }} accessibilityRole="button">
      <View style={styles.head}>
        <Text style={[styles.kicker, { color: accent }]}>{tint ? `Reto de ${tint.name}` : 'Tu plan'}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {status.doneDays} de {days.length} {days.length === 1 ? 'día' : 'días'}
        </Text>
      </View>
      <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>{plan.title}</Text>

      {plan.finished ? (
        <IconText icon={CheckIcon} color={colors.accent} size={16} style={{ marginTop: 6 }}>
          <Text style={{ color: colors.text }}>Terminado el {shortDate(plan.finished)}.</Text>
        </IconText>
      ) : waiting ? (
        <Text style={{ color: colors.text, marginTop: 6 }}>Empieza el {shortDate(plan.started)}. Te esperamos.</Text>
      ) : (
        day && (
          <>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 10 }}>
              {day.title ? `DÍA ${status.next! + 1} · ${day.title.toUpperCase()}` : `DÍA ${status.next! + 1}`}
            </Text>
            <Text style={{ color: colors.text, fontSize: 16, marginTop: 2 }}>
              {readingsLabel(plan, day.readings, books)} · {dayMinutes(plan, day, words)} min
            </Text>
            {question && (
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8, fontFamily: serif, fontStyle: 'italic' }}>
                {question}
              </Text>
            )}
          </>
        )
      )}
      {status.behind > 1 && !plan.finished && (
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
          Tienes {status.behind} lecturas por ponerte al día. Sin prisa: lo importante es leer con calma.
        </Text>
      )}
      <View style={{ marginTop: 12 }}>
        <Meter value={status.doneDays} max={days.length} colors={tint ? { ...colors, accent, accentSoft: tint.soft } : colors} />
      </View>
      </Pressable>
      {!plan.finished && !waiting && (
        <Pressable
          onPress={read}
          style={({ pressed }) => [styles.read, { backgroundColor: accent }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={{ color: tint?.soft ?? colors.surface, fontWeight: '700' }}>Leer lo de hoy</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20, overflow: 'hidden' },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 22, marginTop: 4 },
  read: { borderRadius: 20, paddingVertical: 10, alignItems: 'center', marginTop: 14 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
