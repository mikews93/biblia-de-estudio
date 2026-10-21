// /comparar/juan/3: el capítulo en varias versiones. En pantallas anchas, en columnas paralelas con los versículos
// alineados; en el teléfono, versículo por versículo con cada versión debajo. ?v=16 lleva a ese versículo.
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import Appear from '@/components/Appear';
import {
  DiffText,
  LicenseNote,
  MarksToggle,
  TextSkeleton,
  VersionChips,
  compareHref,
  useChapters,
  useCompareVersions,
} from '@/components/Comparar';
import { ChevronLeftIcon, ChevronRightIcon, CompareIcon, GlobeIcon } from '@/components/icons';
import { findVerse } from '@/lib/comparar';
import { Book, Verse, Version, getBooks } from '@/lib/data';
import { bookIdFromParam, verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function Comparar() {
  const params = useLocalSearchParams<{ book: string; chapter: string; v?: string }>();
  const bookId = bookIdFromParam(params.book);
  const chapter = Number(params.chapter);
  const target = params.v ? Number(params.v) : null;
  const colors = useColors();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [books, setBooks] = useState<Book[]>([]);
  const [marks, setMarks] = useState(true);
  const { all, chosen, toggle, reading } = useCompareVersions();
  const chapters = useChapters(bookId, chapter, chosen);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);
  useEffect(() => {
    scrolled.current = false;
  }, [bookId, chapter, target]);

  const index = books.findIndex((b) => b.id === bookId);
  const book = books[index];
  const title = book ? `${book.name} ${chapter}` : '';

  const neighbor = (delta: 1 | -1) => {
    if (!book) return null;
    let i = index;
    let ch = chapter + delta;
    if (ch < 1) {
      if (i === 0) return null;
      i -= 1;
      ch = books[i].chapters;
    } else if (ch > book.chapters) {
      if (i === books.length - 1) return null;
      i += 1;
      ch = 1;
    }
    return compareHref(books[i].id, ch);
  };
  const go = (delta: 1 | -1) => {
    const href = neighbor(delta);
    if (href) navigate(() => router.replace(href as never), delta > 0 ? 'turn-forward' : 'turn-back');
  };

  // Números de versículo de todas las versiones (alguna puede tener uno más o unir varios)
  const loaded = chosen.map((v) => chapters(v.id));
  const set = new Set<number>();
  for (const { verses } of loaded) verses?.forEach(([n]) => set.add(n));
  const numbers = [...set].sort((a, b) => a - b);
  const baseVerses = chapters(reading).verses;

  const onRow = (n: number, y: number) => {
    if (n !== target || scrolled.current) return;
    scrolled.current = true;
    // En columnas, la fila de títulos queda fija arriba y tapa unos 80 px
    scroll.current?.scrollTo({ y: Math.max(0, y - (wide ? 96 : 24)), animated: false });
  };
  const open = (n: number) => navigate(() => router.push(verseHref(bookId, chapter, n)), 'forward');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Comparar versiones' }} />
      <ScrollView ref={scroll} contentContainerStyle={[styles.content, wide && styles.contentWide]} stickyHeaderIndices={wide ? [1] : undefined}>
        <View style={styles.head}>
          <View style={styles.kicker}>
            <CompareIcon color={colors.accent} size={15} strokeWidth={2} />
            <Text style={[styles.kickerText, { color: colors.accent }]}>COMPARAR VERSIONES</Text>
          </View>
          <View style={styles.titleRow}>
            <NavArrow dir={-1} colors={colors} disabled={!neighbor(-1)} onPress={() => go(-1)} />
            <Text style={[styles.title, { color: colors.text, fontFamily: serif }]} numberOfLines={1}>
              {title}
            </Text>
            <NavArrow dir={1} colors={colors} disabled={!neighbor(1)} onPress={() => go(1)} />
          </View>
          <View style={styles.chipsBox}>
            <VersionChips all={all} chosen={chosen} reading={reading} colors={colors} onToggle={toggle} />
          </View>
          <View style={styles.bar}>
            <Text style={[styles.hint, { color: colors.muted }]}>
              {chosen.length > 1
                ? `Marcadas, las palabras que cambian respecto a la ${chosen[0]?.abbr ?? ''}.`
                : 'Elige otra versión para comparar.'}
            </Text>
            <MarksToggle on={marks} colors={colors} onPress={() => setMarks(!marks)} />
          </View>
        </View>

        {wide ? (
          <View style={[styles.columnsHead, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.gutter} />
            {chosen.map((v) => (
              <ColumnTitle key={v.id} version={v} base={v.id === reading} colors={colors} />
            ))}
          </View>
        ) : (
          <View />
        )}

        {!numbers.length && (
          <View style={{ gap: 18, marginTop: 8 }}>
            {[0, 1, 2].map((i) => (
              <TextSkeleton key={i} colors={colors} lines={3} />
            ))}
          </View>
        )}

        {numbers.map((n) => {
          const baseText = baseVerses ? (findVerse(baseVerses, n)?.[1] ?? null) : null;
          const selected = n === target;
          return wide ? (
            <View
              key={n}
              onLayout={(e) => onRow(n, e.nativeEvent.layout.y)}
              style={[styles.row, { borderColor: colors.border }, selected && { backgroundColor: colors.accentSoft, borderColor: 'transparent' }]}
            >
              <VerseNumber n={n} colors={colors} onPress={() => open(n)} />
              {chosen.map((v, i) => (
                <View key={v.id} style={styles.cell}>
                  <Cell n={n} first={n === numbers[0]} version={v} loaded={loaded[i]} base={v.id === reading ? null : baseText} marks={marks} colors={colors} />
                </View>
              ))}
            </View>
          ) : (
            <View
              key={n}
              onLayout={(e) => onRow(n, e.nativeEvent.layout.y)}
              style={[styles.block, { borderColor: colors.border }, selected && { backgroundColor: colors.accentSoft, borderColor: 'transparent' }]}
            >
              <VerseNumber n={n} colors={colors} onPress={() => open(n)} />
              <View style={{ gap: 10, flex: 1 }}>
                {chosen.map((v, i) => (
                  <View key={v.id} style={styles.stacked}>
                    <View style={styles.stackedHead}>
                      <Text style={[styles.stackedAbbr, { color: v.id === reading ? colors.accent : colors.muted }]}>{v.abbr}</Text>
                      {v.licensed && <GlobeIcon color={colors.muted} size={10} strokeWidth={2} />}
                    </View>
                    <Cell n={n} first={n === numbers[0]} version={v} loaded={loaded[i]} base={v.id === reading ? null : baseText} marks={marks} colors={colors} />
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        {numbers.length > 0 && (
          <Appear style={[styles.credits, { borderColor: colors.border }]}>
            <Text style={[styles.creditsTitle, { color: colors.muted }]}>Versiones</Text>
            {chosen.map((v, i) =>
              v.licensed ? (
                <LicenseNote key={v.id} version={v} colors={colors} extras={loaded[i].extras} />
              ) : (
                <Text key={v.id} style={[styles.credit, { color: colors.muted }]}>
                  {v.credit}
                </Text>
              ),
            )}
            {chosen.some((v) => v.licensed) && (
              <Text style={[styles.credit, { color: colors.muted, marginTop: 6 }]}>
                Las versiones con permiso de sus editores se leen con conexión y no se usan en la IA ni en el audio.
              </Text>
            )}
          </Appear>
        )}
      </ScrollView>
    </View>
  );
}

function Cell({
  n,
  version,
  loaded,
  first,
  base,
  marks,
  colors,
}: {
  n: number;
  first: boolean;
  version: Version;
  loaded: { verses: Verse[] | null; error: string | null };
  base: string | null;
  marks: boolean;
  colors: Colors;
}) {
  if (loaded.error) return first ? <Text style={[styles.missing, { color: colors.muted }]}>{loaded.error}</Text> : null;
  if (!loaded.verses) return <TextSkeleton colors={colors} />;
  const found = findVerse(loaded.verses, n);
  if (!found) return <Text style={[styles.missing, { color: colors.muted }]}>—</Text>;
  // Versión que une versículos: el texto va en el primero y los demás lo señalan
  if (found[0] !== n)
    return <Text style={[styles.missing, { color: colors.muted }]}>{`En el versículo ${found[2]} (${version.abbr} los une)`}</Text>;
  return <DiffText base={base} text={found[1]} marks={marks} colors={colors} style={[styles.text, { color: colors.text }]} />;
}

function VerseNumber({ n, colors, onPress }: { n: number; colors: Colors; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`Abrir el versículo ${n} en el lector`}
      hitSlop={6}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.gutter,
        styles.number,
        { backgroundColor: hovered || pressed ? colors.accentSoft : 'transparent' },
      ]}
    >
      <Text style={[styles.numberText, { color: colors.accent, fontFamily: serif }]}>{n}</Text>
    </Pressable>
  );
}

function ColumnTitle({ version, base, colors }: { version: Version; base: boolean; colors: Colors }) {
  return (
    <View style={styles.cell}>
      <View style={styles.colTitleRow}>
        <Text style={[styles.colAbbr, { color: base ? colors.accent : colors.text, fontFamily: serif }]}>{version.abbr}</Text>
        {base && (
          <View style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.tagText, { color: colors.accent }]}>Estás leyendo</Text>
          </View>
        )}
        {version.licensed && <GlobeIcon color={colors.muted} size={12} strokeWidth={2} />}
      </View>
      <Text style={[styles.colName, { color: colors.muted }]} numberOfLines={1}>
        {version.name}
      </Text>
    </View>
  );
}

function NavArrow({ dir, colors, disabled, onPress }: { dir: 1 | -1; colors: Colors; disabled: boolean; onPress: () => void }) {
  const Icon = dir > 0 ? ChevronRightIcon : ChevronLeftIcon;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={dir > 0 ? 'Capítulo siguiente' : 'Capítulo anterior'}
      hitSlop={6}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.arrow,
        { borderColor: colors.border, backgroundColor: hovered || pressed ? colors.accentSoft : colors.surface },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Icon color={colors.text} size={18} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  contentWide: { maxWidth: 1320, paddingHorizontal: 32 },
  head: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kickerText: { fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  title: { fontSize: 34, lineHeight: 42, fontWeight: '600', flexShrink: 1 },
  arrow: { width: 34, height: 34, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  chipsBox: { alignSelf: 'stretch', alignItems: 'center', marginTop: 16 },
  bar: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  hint: { fontSize: 12.5, flexShrink: 1, lineHeight: 17 },
  columnsHead: { flexDirection: 'row', gap: 20, paddingHorizontal: 10, marginHorizontal: -10, paddingTop: 22, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  colTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colAbbr: { fontSize: 17, fontWeight: '700' },
  colName: { fontSize: 12, marginTop: 1 },
  tag: { borderRadius: 10, paddingHorizontal: 8, height: 20, justifyContent: 'center' },
  tagText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  gutter: { width: 34 },
  row: { flexDirection: 'row', gap: 20, paddingVertical: 12, paddingHorizontal: 10, marginHorizontal: -10, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  cell: { flex: 1, minWidth: 0 },
  block: { flexDirection: 'row', gap: 10, paddingVertical: 16, paddingHorizontal: 10, marginHorizontal: -10, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  number: { height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  numberText: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  stacked: { gap: 2 },
  stackedHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stackedAbbr: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  text: { fontFamily: serif, fontSize: 16.5, lineHeight: 25 },
  missing: { fontSize: 13, fontStyle: 'italic', lineHeight: 20 },
  credits: { marginTop: 28, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  creditsTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  credit: { fontSize: 11.5, lineHeight: 16 },
});
