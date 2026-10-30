// /concordancia/G0026: todas las veces que aparece una palabra griega o hebrea (por su número de Strong), cómo se
// traduce, en qué libros y cada versículo con la RV1909. ?desde=jhn.3.16 marca el versículo del que se vino.
// En pantallas anchas el resumen queda a la izquierda y la lista a la derecha; en el teléfono, uno debajo del otro.
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import Appear from '@/components/Appear';
import { TextSkeleton } from '@/components/Comparar';
import { CloseIcon, ConcordanceIcon } from '@/components/icons';
import {
  type Concordance,
  type Occurrence,
  type Summary,
  concordanceHref,
  displayStrong,
  isHebrew,
  markGloss,
  normalizeStrong,
  occurrences,
  summarize,
} from '@/lib/concordancia';
import { Book, getBooks, getChapter, getConcordance } from '@/lib/data';
import { verseHref } from '@/lib/routes';
import { huellaPalabra } from '@/lib/sellos';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const PAGE = 30;
const GLOSSES_SHOWN = 8;
const BOOKS_SHOWN = 8;

type Hover = { pressed: boolean; hovered?: boolean };

export default function ConcordanciaScreen() {
  const params = useLocalSearchParams<{ strong: string; desde?: string }>();
  const strong = normalizeStrong(params.strong ?? '');
  // Con key, otra palabra empieza de cero (sin los filtros de la anterior)
  return <Concordancia key={strong ?? ''} strong={strong} from={params.desde ?? null} />;
}

function Concordancia({ strong, from }: { strong: string | null; from: string | null }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [books, setBooks] = useState<Book[]>([]);
  const [loaded, setLoaded] = useState<Concordance | null | undefined>(undefined);
  const [book, setBookState] = useState<string | null>(null);
  const [gloss, setGlossState] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const data = strong ? loaded : null;
  const setBook = (b: string | null) => {
    setBookState(b);
    setShown(PAGE);
  };
  const setGloss = (g: string | null) => {
    setGlossState(g);
    setShown(PAGE);
  };

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);
  useEffect(() => {
    if (!strong) return;
    huellaPalabra(strong);
    getConcordance(strong)
      .then(setLoaded)
      .catch(() => setLoaded(null));
  }, [strong]);

  const summary = useMemo(() => (data && books.length ? summarize(data.uses, books) : null), [data, books]);
  const list = useMemo(() => (data && books.length ? occurrences(data.uses, books, { book, gloss }) : []), [data, books, book, gloss]);

  const hebrew = strong ? isHebrew(strong) : false;
  const names = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  // El lema va aislado (U+2068…U+2069) para que el hebreo, de derecha a izquierda, no dé la vuelta al título
  const title = data?.lemma ? `\u2068${data.lemma}\u2069 · Concordancia` : 'Concordancia';

  if (data === null)
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Concordancia' }} />
        <ConcordanceIcon color={colors.muted} size={36} />
        <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: serif }]}>No encontramos esta palabra</Text>
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          Abre la concordancia desde el interlineal: toca una palabra griega o hebrea y elige «Todas las veces en la Biblia».
        </Text>
      </View>
    );

  const head = (
    <Head
      strong={strong ?? ''}
      data={data}
      summary={summary}
      hebrew={hebrew}
      colors={colors}
      wide={wide}
    />
  );
  const filters = summary && data && (
    <Filters
      summary={summary}
      related={data.related}
      names={names}
      book={book}
      gloss={gloss}
      onBook={(b) => setBook(b === book ? null : b)}
      onGloss={(g) => setGloss(g === gloss ? null : g)}
      colors={colors}
      wide={wide}
    />
  );
  const results = (
    <Results
      list={list}
      shown={shown}
      onMore={() => setShown(shown + PAGE)}
      names={names}
      from={from}
      hebrew={hebrew}
      loading={!summary}
      book={book}
      gloss={gloss}
      onClear={() => {
        setBook(null);
        setGloss(null);
      }}
      colors={colors}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title }} />
      {wide ? (
        <View style={styles.columns}>
          <ScrollView style={[styles.side, { borderColor: colors.border }]} contentContainerStyle={styles.sideContent}>
            {head}
            {filters}
          </ScrollView>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.mainContent}>
            {results}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {head}
          {filters}
          {results}
        </ScrollView>
      )}
    </View>
  );
}

function Head({
  strong,
  data,
  summary,
  hebrew,
  colors,
  wide,
}: {
  strong: string;
  data: Concordance | undefined;
  summary: Summary | null;
  hebrew: boolean;
  colors: Colors;
  wide: boolean;
}) {
  const top = summary?.glosses.slice(0, 3).map((g) => g.key) ?? [];
  return (
    <View style={[styles.head, wide && styles.headWide]}>
      <View style={styles.kicker}>
        <ConcordanceIcon color={colors.accent} size={15} strokeWidth={2} />
        <Text style={[styles.kickerText, { color: colors.accent }]}>CONCORDANCIA</Text>
      </View>
      {data ? (
        <Appear style={[styles.headBody, wide && { alignItems: 'flex-start' }]}>
          <Text
            style={[styles.lemma, { color: colors.greek, fontFamily: serif, writingDirection: hebrew ? 'rtl' : 'ltr' }]}
            accessibilityLanguage={hebrew ? 'he' : 'grc'}
          >
            {data.lemma || displayStrong(strong)}
          </Text>
          {!!data.translit && <Text style={[styles.translit, { color: colors.muted }]}>{data.translit}</Text>}
          {top.length > 0 && (
            <Text style={[styles.means, { color: colors.text, textAlign: wide ? 'left' : 'center' }]}>
              {top.map((g, i) => (
                <Text key={g}>
                  {i > 0 && <Text style={{ color: colors.muted }}>{' · '}</Text>}«{g}»
                </Text>
              ))}
            </Text>
          )}
          <View style={[styles.tags, wide && { justifyContent: 'flex-start' }]}>
            <Tag colors={colors}>{hebrew ? 'Hebreo' : 'Griego'}</Tag>
            <Tag colors={colors}>{`Strong ${displayStrong(strong)}`}</Tag>
            {!!data.meaning && <Tag colors={colors} muted>{`Léxico: ${data.meaning}`}</Tag>}
          </View>
        </Appear>
      ) : (
        <View style={{ alignSelf: 'stretch', alignItems: wide ? 'flex-start' : 'center', gap: 10, marginTop: 14 }}>
          <View style={[styles.skelBig, { backgroundColor: colors.border }]} />
          <View style={[styles.skelSmall, { backgroundColor: colors.border }]} />
        </View>
      )}
      {summary && (
        <Appear delay={60} style={styles.stats}>
          <Stat n={summary.total} label={summary.total === 1 ? 'vez' : 'veces'} colors={colors} />
          <Stat n={summary.verses} label={summary.verses === 1 ? 'versículo' : 'versículos'} colors={colors} />
          <Stat n={summary.books.length} label={summary.books.length === 1 ? 'libro' : 'libros'} colors={colors} />
        </Appear>
      )}
    </View>
  );
}

function Filters({
  summary,
  related,
  names,
  book,
  gloss,
  onBook,
  onGloss,
  colors,
  wide,
}: {
  summary: Summary;
  related: string[];
  names: Map<string, Book>;
  book: string | null;
  gloss: string | null;
  onBook: (b: string) => void;
  onGloss: (g: string) => void;
  colors: Colors;
  wide: boolean;
}) {
  const [allGlosses, setAllGlosses] = useState(false);
  const [allBooks, setAllBooks] = useState(wide);
  const glosses = allGlosses ? summary.glosses : summary.glosses.slice(0, GLOSSES_SHOWN);
  const max = Math.max(...summary.books.map((b) => b.count));
  const tooMany = summary.books.length > BOOKS_SHOWN + 2;
  // Recogido, quedan los libros donde más aparece (y el elegido), en el orden de la Biblia
  const keep = new Set(
    [...summary.books]
      .sort((a, b) => b.count - a.count)
      .slice(0, BOOKS_SHOWN)
      .map((b) => b.id)
      .concat(book ?? []),
  );
  const rows = allBooks || !tooMany ? summary.books : summary.books.filter((b) => keep.has(b.id));

  return (
    <Appear delay={120} style={styles.filters}>
      <Section title="Se traduce como" colors={colors}>
        <View style={styles.chips}>
          {glosses.map((g) => {
            const on = g.key === gloss;
            return (
              <Pressable
                key={g.key}
                onPress={() => onGloss(g.key)}
                accessibilityRole="button"
                aria-selected={on}
                accessibilityLabel={`${g.key}, ${g.count} veces`}
                style={({ pressed, hovered }: Hover) => [
                  styles.chip,
                  {
                    backgroundColor: on ? colors.accent : hovered || pressed ? colors.accentSoft : colors.surface,
                    borderColor: on ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: on ? colors.background : colors.text }]}>{g.key}</Text>
                <Text style={[styles.chipCount, { color: on ? colors.background : colors.muted }]}>{g.count}</Text>
              </Pressable>
            );
          })}
          {summary.glosses.length > GLOSSES_SHOWN && (
            <Pressable onPress={() => setAllGlosses(!allGlosses)} style={styles.more} accessibilityRole="button">
              <Text style={[styles.moreText, { color: colors.muted }]}>
                {allGlosses ? 'Menos' : `+${summary.glosses.length - GLOSSES_SHOWN} más`}
              </Text>
            </Pressable>
          )}
        </View>
      </Section>

      <Section title="Dónde aparece" colors={colors} right={summary.ot && summary.nt ? `AT ${summary.ot} · NT ${summary.nt}` : undefined}>
        <View style={{ gap: 2 }}>
          {rows.map(({ id, count }) => {
            const on = id === book;
            const b = names.get(id);
            return (
              <Pressable
                key={id}
                onPress={() => onBook(id)}
                accessibilityRole="button"
                aria-selected={on}
                accessibilityLabel={`${b?.name ?? id}: ${count} veces`}
                style={({ pressed, hovered }: Hover) => [
                  styles.bookRow,
                  { backgroundColor: on ? colors.accentSoft : hovered || pressed ? colors.accentSoft : 'transparent' },
                ]}
              >
                <Text style={[styles.bookName, { color: on ? colors.text : colors.muted, fontWeight: on ? '700' : '500' }]} numberOfLines={1}>
                  {b?.name ?? id}
                </Text>
                <View style={[styles.track, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.bar,
                      { width: `${Math.max(4, (count / max) * 100)}%`, backgroundColor: on ? colors.warm : colors.greek, opacity: on ? 1 : 0.75 },
                    ]}
                  />
                </View>
                <Text style={[styles.bookCount, { color: on ? colors.text : colors.muted }]}>{count}</Text>
              </Pressable>
            );
          })}
          {tooMany && (
            <Pressable onPress={() => setAllBooks(!allBooks)} style={[styles.more, { alignSelf: 'flex-start', marginTop: 4 }]} accessibilityRole="button">
              <Text style={[styles.moreText, { color: colors.muted }]}>
                {allBooks ? 'Ver solo donde más aparece' : `Ver los ${summary.books.length} libros`}
              </Text>
            </Pressable>
          )}
        </View>
      </Section>

      {related.length > 0 && (
        <Section title="Otras acepciones del mismo número" colors={colors}>
          <View style={styles.chips}>
            {related.map((r) => (
              <Pressable
                key={r}
                onPress={() => router.replace(concordanceHref(r) as never)}
                accessibilityRole="link"
                style={({ pressed, hovered }: Hover) => [
                  styles.chip,
                  { borderColor: colors.border, backgroundColor: hovered || pressed ? colors.accentSoft : colors.surface },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{displayStrong(r)}</Text>
              </Pressable>
            ))}
          </View>
        </Section>
      )}
    </Appear>
  );
}

function Results({
  list,
  shown,
  onMore,
  names,
  from,
  hebrew,
  loading,
  book,
  gloss,
  onClear,
  colors,
}: {
  list: Occurrence[];
  shown: number;
  onMore: () => void;
  names: Map<string, Book>;
  from: string | null;
  hebrew: boolean;
  loading: boolean;
  book: string | null;
  gloss: string | null;
  onClear: () => void;
  colors: Colors;
}) {
  if (loading)
    return (
      <View style={{ gap: 22, marginTop: 24 }}>
        {[0, 1, 2, 3].map((i) => (
          <TextSkeleton key={i} colors={colors} lines={2} />
        ))}
      </View>
    );

  const visible = list.slice(0, shown);
  const filtered = book || gloss;
  // El versículo del que se vino, arriba: es el que se estaba leyendo
  const here = from ? list.find((o) => o.ref === from) : undefined;
  return (
    <View style={styles.results}>
      {here && (
        <View style={styles.hereBox}>
          <Row o={here} name={names.get(here.book)?.name ?? here.book} here hebrew={hebrew} colors={colors} />
        </View>
      )}
      <View style={[styles.resultsHead, { borderColor: colors.border }]}>
        <Text style={[styles.resultsTitle, { color: colors.text, fontFamily: serif }]}>
          {list.length} {list.length === 1 ? 'versículo' : 'versículos'}
        </Text>
        {filtered && (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Quitar el filtro"
            style={({ pressed, hovered }: Hover) => [
              styles.filterPill,
              { backgroundColor: hovered || pressed ? colors.border : colors.accentSoft },
            ]}
          >
            <Text style={[styles.filterText, { color: colors.text }]} numberOfLines={1}>
              {[book && (names.get(book)?.name ?? book), gloss && `«${gloss}»`].filter(Boolean).join(' · ')}
            </Text>
            <CloseIcon color={colors.muted} size={13} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>

      {visible.map((o, i) => {
        const newBook = i === 0 || visible[i - 1].book !== o.book;
        return (
          <View key={o.ref}>
            {newBook && (
              <Text style={[styles.bookHead, { color: colors.muted }]}>{(names.get(o.book)?.name ?? o.book).toUpperCase()}</Text>
            )}
            <Row o={o} name={names.get(o.book)?.name ?? o.book} here={false} hebrew={hebrew} colors={colors} />
          </View>
        );
      })}

      {list.length > shown && (
        <Pressable
          onPress={onMore}
          accessibilityRole="button"
          style={({ pressed, hovered }: Hover) => [
            styles.moreButton,
            { borderColor: colors.border, backgroundColor: hovered || pressed ? colors.accentSoft : colors.surface },
          ]}
        >
          <Text style={[styles.moreButtonText, { color: colors.text }]}>
            Mostrar {Math.min(PAGE, list.length - shown)} más
          </Text>
          <Text style={[styles.moreButtonSub, { color: colors.muted }]}>
            {shown} de {list.length}
          </Text>
        </Pressable>
      )}

      <Text style={[styles.credit, { color: colors.muted, borderColor: colors.border }]}>
        {hebrew ? 'Hebreo: TAHOT' : 'Griego: TAGNT'} de STEPBible.org, Tyndale House (CC BY 4.0). Glosas en español
        {hebrew ? ' propias' : ' de STEPBible'}; texto de la Reina-Valera 1909.
      </Text>
    </View>
  );
}

function Row({ o, name, here, hebrew, colors }: { o: Occurrence; name: string; here: boolean; hebrew: boolean; colors: Colors }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getChapter(o.book, o.chapter)
      .then((vs) => alive && setText(vs.find(([n]) => n === o.verse)?.[1] ?? ''))
      .catch(() => alive && setText(''));
    return () => {
      alive = false;
    };
  }, [o.book, o.chapter, o.verse]);

  const forms = [...new Set(o.forms)];
  return (
    <Pressable
      onPress={() => navigate(() => router.push(verseHref(o.book, o.chapter, o.verse)), 'forward')}
      accessibilityRole="link"
      accessibilityLabel={`${name} ${o.chapter}:${o.verse}`}
      style={({ pressed, hovered }: Hover) => [
        styles.row,
        { borderColor: colors.border },
        here && { backgroundColor: colors.warmSoft, borderColor: 'transparent' },
        !here && (hovered || pressed) && { backgroundColor: colors.accentSoft },
      ]}
    >
      <View style={styles.rowHead}>
        <Text style={[styles.rowRef, { color: colors.text }]}>
          {name} {o.chapter}:{o.verse}
        </Text>
        {here && (
          <View style={[styles.hereTag, { backgroundColor: colors.warm }]}>
            <Text style={[styles.hereText, { color: colors.background }]}>Estás aquí</Text>
          </View>
        )}
        {o.forms.length > 1 && <Text style={[styles.times, { color: colors.muted }]}>×{o.forms.length}</Text>}
        <View style={{ flex: 1 }} />
        <Text
          style={[styles.rowForm, { color: colors.greek, fontFamily: serif, writingDirection: hebrew ? 'rtl' : 'ltr' }]}
          numberOfLines={1}
        >
          {forms.join(' · ')}
        </Text>
      </View>
      {text === null ? (
        <TextSkeleton colors={colors} />
      ) : text ? (
        <Text style={[styles.rowText, { color: colors.text, fontFamily: serif }]}>
          {markGloss(text, o.glosses).map((p, i) =>
            p.mark ? (
              <Text key={i} style={{ backgroundColor: colors.highlight, fontWeight: '600' }}>
                {p.text}
              </Text>
            ) : (
              p.text
            ),
          )}
        </Text>
      ) : null}
      <Text style={[styles.rowGloss, { color: colors.muted }]}>
        Glosa: {[...new Set(o.glosses)].map((g) => `«${g}»`).join(', ')}
      </Text>
    </Pressable>
  );
}

function Section({ title, right, colors, children }: { title: string; right?: string; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title.toUpperCase()}</Text>
        {right && <Text style={[styles.sectionRight, { color: colors.muted }]}>{right}</Text>}
      </View>
      {children}
    </View>
  );
}

function Stat({ n, label, colors }: { n: number; label: string; colors: Colors }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statN, { color: colors.text, fontFamily: serif }]}>{n.toLocaleString('es')}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function Tag({ children, colors, muted }: { children: string; colors: Colors; muted?: boolean }) {
  return (
    <View style={[styles.tag, { backgroundColor: muted ? 'transparent' : colors.accentSoft, borderColor: colors.border, borderWidth: muted ? StyleSheet.hairlineWidth : 0 }]}>
      <Text style={[styles.tagText, { color: muted ? colors.muted : colors.text }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  columns: { flex: 1, flexDirection: 'row', maxWidth: 1240, width: '100%', alignSelf: 'center' },
  side: { width: 380, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth },
  sideContent: { paddingHorizontal: 28, paddingBottom: 48 },
  mainContent: { paddingHorizontal: 36, paddingBottom: 64, maxWidth: 760 },
  head: { alignItems: 'center', paddingTop: 12 },
  headWide: { alignItems: 'flex-start', paddingTop: 20 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kickerText: { fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  headBody: { alignItems: 'center', alignSelf: 'stretch' },
  lemma: { fontSize: 50, lineHeight: 64, marginTop: 6 },
  translit: { fontStyle: 'italic', fontSize: 17, marginTop: -2 },
  means: { fontSize: 17, fontWeight: '600', marginTop: 10, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 12 },
  tag: { borderRadius: 10, paddingHorizontal: 9, height: 22, justifyContent: 'center', maxWidth: 260 },
  tagText: { fontSize: 11.5, fontWeight: '600' },
  skelBig: { width: 140, height: 44, borderRadius: 10 },
  skelSmall: { width: 200, height: 14, borderRadius: 7 },
  stats: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 20 },
  stat: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, alignItems: 'center' },
  statN: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  statLabel: { fontSize: 12, marginTop: 1 },
  filters: { marginTop: 8 },
  section: { marginTop: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  sectionRight: { fontSize: 11.5, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, height: 32 },
  chipText: { fontSize: 14, fontWeight: '600' },
  chipCount: { fontSize: 12, fontWeight: '600' },
  more: { height: 32, justifyContent: 'center', paddingHorizontal: 6 },
  moreText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 8 },
  bookName: { width: 112, fontSize: 13.5 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  bookCount: { width: 38, textAlign: 'right', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  results: { marginTop: 28 },
  hereBox: { marginBottom: 18 },
  resultsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  resultsTitle: { fontSize: 22, fontWeight: '600' },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingLeft: 12, paddingRight: 9, height: 28, flexShrink: 1 },
  filterText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  bookHead: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 22, marginBottom: 4 },
  row: { paddingVertical: 14, paddingHorizontal: 12, marginHorizontal: -12, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 10, gap: 6 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowRef: { fontSize: 14.5, fontWeight: '700' },
  hereTag: { borderRadius: 9, paddingHorizontal: 7, height: 18, justifyContent: 'center' },
  hereText: { fontSize: 10.5, fontWeight: '800' },
  times: { fontSize: 12, fontWeight: '700' },
  rowForm: { fontSize: 18, flexShrink: 1 },
  rowText: { fontSize: 16.5, lineHeight: 25 },
  rowGloss: { fontSize: 12.5 },
  moreButton: { alignSelf: 'center', alignItems: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 22, paddingVertical: 10, marginTop: 22 },
  moreButtonText: { fontSize: 14.5, fontWeight: '700' },
  moreButtonSub: { fontSize: 11.5, marginTop: 1 },
  credit: { fontSize: 11.5, lineHeight: 16, marginTop: 28, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 22, fontWeight: '600', textAlign: 'center' },
  emptyText: { fontSize: 14.5, lineHeight: 21, textAlign: 'center', maxWidth: 360 },
});
