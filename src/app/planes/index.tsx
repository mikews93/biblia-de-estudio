import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import PlanCard, { shortDate } from '@/components/PlanCard';
import { SectionTitle, text } from '@/components/comunidad/ui';
import { Book, getBooks } from '@/lib/data';
import { PLANS, PlanDef, nextSeason, usePlans, useWords } from '@/lib/planes';
import { seasonTint } from '@/lib/retos';
import type { SeasonRun } from '@/lib/temporadas';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Planes de lectura: los tuyos, los retos de temporada y el catálogo. */
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

      <View style={{ marginTop: 16 }}>
        <PlanRow
          def={{ icon: '◎', title: 'Planes en grupo', description: 'Lee con tu iglesia o tus amigos el mismo plan y comenten juntos.' }}
          colors={colors}
          onPress={() => navigate(() => router.push('/grupos' as never), 'forward')}
        />
      </View>

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

      <SectionTitle>Retos de temporada</SectionTitle>
      <Text style={[text.small, { color: colors.muted, marginTop: -4, marginBottom: 12 }]}>
        Siguen el año cristiano: un capítulo al día con fecha común para todos y una pregunta para pensar.
      </Text>
      <View style={styles.retos}>
        {seasonal.map(({ def, season }) => (
          <RetoTile
            key={def.id}
            def={def}
            season={season}
            joined={plans.some((p) => p.id === `${def.id}-${season.year}` && !p.finished)}
            colors={colors}
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

function PlanRow({
  def,
  note,
  colors,
  onPress,
}: {
  def: Pick<PlanDef, 'icon' | 'title' | 'description'>; note?: string; colors: Colors; onPress: () => void }) {
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

/** Un reto de temporada con el color de su tiempo y cuánto falta. */
function RetoTile({
  def,
  season,
  joined,
  colors,
  onPress,
}: {
  def: PlanDef;
  season: SeasonRun;
  joined: boolean;
  colors: Colors;
  onPress: () => void;
}) {
  const tint = seasonTint(def.season!, colors);
  const when = season.running
    ? `En curso · hasta el ${shortDate(season.end)}`
    : season.daysToStart === 1
      ? 'Empieza mañana'
      : season.daysToStart <= 60
        ? `Empieza en ${season.daysToStart} días`
        : `Desde el ${shortDate(season.start)}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.reto, { backgroundColor: tint.soft }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${def.title}. ${when}${joined ? '. Te uniste' : ''}`}
    >
      <Text style={[styles.retoGlyph, { color: tint.accent }]}>{def.icon}</Text>
      <View style={styles.retoHead}>
        <Text style={[styles.retoKicker, { color: tint.accent }]}>{tint.name}</Text>
        {joined && (
          <View style={[styles.joined, { backgroundColor: tint.accent }]}>
            <Text style={{ color: tint.soft, fontSize: 11, fontWeight: '700' }}>✓ Te uniste</Text>
          </View>
        )}
      </View>
      <Text style={[styles.retoTitle, { color: colors.text }]} numberOfLines={2}>
        {subtitle(def.title)}
      </Text>
      <Text style={{ color: colors.text, opacity: 0.75, fontSize: 13, marginTop: 4 }}>
        {def.spec.length} días · {range(season.start, season.end)}
      </Text>
      <Text style={{ color: tint.accent, fontSize: 13, fontWeight: '700', marginTop: 10 }}>{when}</Text>
    </Pressable>
  );
}

/** «Adviento: la promesa cumplida» → «La promesa cumplida» (el tiempo ya va arriba). */
const subtitle = (title: string) => {
  const rest = title.split(': ')[1];
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : title;
};

const range = (a: string, b: string) => `${shortDate(a)} – ${shortDate(b)}`;

const styles = StyleSheet.create({
  retos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  reto: { flexGrow: 1, flexBasis: '45%', minWidth: 150, borderRadius: 20, padding: 16, overflow: 'hidden', minHeight: 150 },
  retoGlyph: { position: 'absolute', right: 8, bottom: -14, fontSize: 84, fontFamily: serif, opacity: 0.14 },
  retoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  retoKicker: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.9 },
  retoTitle: { fontFamily: serif, fontSize: 18, lineHeight: 23, marginTop: 8 },
  joined: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  page: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  icon: { fontSize: 22, width: 28, textAlign: 'center', fontFamily: serif },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  books: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  book: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  pressed: { opacity: 0.8 },
});
