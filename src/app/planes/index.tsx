import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import PlanCard, { shortDate } from '@/components/PlanCard';
import { SectionTitle, text } from '@/components/comunidad/ui';
import { Book, getBooks } from '@/lib/data';
import { PLANS, PlanDef, nextSeason, usePlans, useWords } from '@/lib/planes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Planes de lectura: los tuyos, los desafíos de temporada y el catálogo. */
export default function Planes() {
  const colors = useColors();
  const plans = usePlans();
  const words = useWords();
  const [books, setBooks] = useState<Book[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const active = plans.filter((p) => !p.finished);
  const finished = plans.filter((p) => p.finished);
  const seasonal = PLANS.filter((p) => p.season)
    .map((def) => ({ def, season: nextSeason(def)! }))
    .sort((a, b) => a.season.start.localeCompare(b.season.start));
  const open = (id: string) => navigate(() => router.push(`/planes/${id}`), 'forward');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Planes de lectura' }} />
      <Text style={[text.body, { color: colors.muted }]}>
        Dinos cuánto tiempo tienes y el plan se adapta a ti. Si un día no puedes, el plan te espera: aquí no se pierde
        nada.
      </Text>

      {active.length > 0 && (
        <>
          <SectionTitle>Tus planes</SectionTitle>
          <View style={{ gap: 12 }}>
            {active.map((p) => (
              <PlanCard key={p.id} plan={p} books={books} words={words} colors={colors} />
            ))}
          </View>
        </>
      )}

      <SectionTitle>Desafíos de temporada</SectionTitle>
      <View style={{ gap: 10 }}>
        {seasonal.map(({ def, season }) => (
          <PlanRow
            key={def.id}
            def={def}
            colors={colors}
            note={
              season.running
                ? `En curso hasta el ${shortDate(season.end)}`
                : `Empieza el ${shortDate(season.start)}${season.daysToStart <= 60 ? ` · faltan ${season.daysToStart} días` : ''}`
            }
            onPress={() => open(def.id)}
          />
        ))}
      </View>

      <SectionTitle>A tu ritmo</SectionTitle>
      <View style={{ gap: 10 }}>
        {PLANS.filter((p) => !p.season).map((def) => (
          <PlanRow key={def.id} def={def} colors={colors} onPress={() => open(def.id)} />
        ))}
        <Pressable
          onPress={() => setPicking(!picking)}
          style={({ pressed }) => [styles.row, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}
        >
          <Text style={[styles.icon, { color: colors.accent }]}>＋</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Un libro que tú elijas</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Cualquier libro de la Biblia, a tu paso.</Text>
          </View>
        </Pressable>
        {picking && (
          <View style={styles.books}>
            {books.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => open(`libro-${b.id}`)}
                style={({ pressed }) => [styles.book, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
              >
                <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>{b.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {finished.length > 0 && (
        <>
          <SectionTitle>Terminados</SectionTitle>
          <View style={{ gap: 12 }}>
            {finished.map((p) => (
              <PlanCard key={p.id} plan={p} books={books} words={words} colors={colors} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function PlanRow({ def, note, colors, onPress }: { def: PlanDef; note?: string; colors: Colors; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={[styles.icon, { color: colors.accent }]}>{def.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{def.title}</Text>
        {note && <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 1 }}>{note}</Text>}
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
          {def.description}
        </Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  icon: { fontSize: 22, width: 28, textAlign: 'center', fontFamily: serif },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  books: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  book: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  pressed: { opacity: 0.8 },
});
