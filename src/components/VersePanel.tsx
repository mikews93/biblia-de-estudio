import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Book,
  CrossRef,
  Place,
  Word,
  formatRef,
  getChapter,
  getCrossRefs,
  getInterlinear,
  getPlaces,
  original,
  parseRef,
} from '@/lib/data';
import Commentary from '@/components/Commentary';
import GroupNotes from '@/components/comunidad/GroupNotes';
import PlaceMap from '@/components/PlaceMap';
import StudyPanel from '@/components/StudyPanel';
import { WhyButton } from '@/components/WordCard';
import { describeMorph } from '@/lib/morph';
import { Colors, serif, useColors } from '@/lib/theme';
import { verseHref } from '@/lib/routes';
import { navigate } from '@/lib/transition';

export type Tab = 'interlineal' | 'referencias' | 'mapa' | 'comentario' | 'grupo';

type Props = {
  book: Book;
  books: Book[];
  chapter: number;
  verse: number;
  text: string;
  initialTab?: Tab;
  onClose: () => void;
};

export default function VersePanel({ book, books, chapter, verse, text, initialTab, onClose }: Props) {
  const colors = useColors();
  // Al ir a /entrar o /registro desde aquí, la ventana se oculta para no tapar esa pantalla y vuelve al regresar.
  const focused = useIsFocused();
  const [tab, setTab] = useState<Tab>(initialTab ?? (book.interlinear ? 'interlineal' : 'referencias'));

  const tabs: [Tab, string][] = [
    ['interlineal', 'Interlineal'],
    ['referencias', 'Referencias'],
    ['mapa', 'Mapa'],
    ['comentario', 'Comentario'],
    ['grupo', 'Grupo'],
  ];

  return (
    <Modal transparent animationType="slide" visible={focused} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>
        <Text style={[styles.ref, { color: colors.accent }]}>
          {book.name} {chapter}:{verse}
        </Text>
        <Text style={[styles.verseText, { color: colors.text }]} numberOfLines={3}>
          {text}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabs, { borderColor: colors.border }]}
          contentContainerStyle={{ flexGrow: 0 }}
        >
          {tabs.map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, tab === key && { borderBottomColor: colors.accent }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
            >
              <Text style={{ color: tab === key ? colors.text : colors.muted, fontWeight: '600' }}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={styles.body}>
          {tab === 'interlineal' && <Interlinear book={book} chapter={chapter} verse={verse} colors={colors} />}
          {tab === 'referencias' && (
            <CrossRefs book={book} books={books} chapter={chapter} verse={verse} colors={colors} onNavigate={onClose} />
          )}
          {tab === 'mapa' && <Places book={book} chapter={chapter} verse={verse} colors={colors} onNavigate={onClose} />}
          {tab === 'comentario' && (
            <Commentary book={book} books={books} chapter={chapter} verse={verse} colors={colors} onNavigate={onClose} />
          )}
          {tab === 'grupo' && <GroupNotes book={book} books={books} chapter={chapter} verse={verse} onNavigate={onClose} />}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Interlinear({ book, chapter, verse, colors }: { book: Book; chapter: number; verse: number; colors: Colors }) {
  const [words, setWords] = useState<Word[] | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [why, setWhy] = useState(false);

  const lang = original(book);

  useEffect(() => {
    getInterlinear(book.id, chapter).then((c) => setWords(c[String(verse)] ?? []));
  }, [book, chapter, verse]);

  if (!words) return <ActivityIndicator color={colors.accent} />;
  if (!words.length) return <Text style={{ color: colors.muted }}>No hay datos del {lang.name} para este versículo.</Text>;

  const w = active !== null ? words[active] : null;

  return (
    <View>
      {w ? (
        <View style={[styles.detail, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.greek, lang.rtl && styles.hebrew, { color: colors.text }]}>{w[4]}</Text>
          <Text style={{ color: colors.text, marginTop: 4 }}>
            Significado: {w[5]} · Traducción aquí: {w[2] || w[3]}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 4, fontSize: 13 }}>
            {describeMorph(w[7])} · Strong {w[6]}
          </Text>
          <WhyButton onPress={() => setWhy(true)} />
        </View>
      ) : (
        <Text style={[styles.hint, { color: colors.muted }]}>Toca una palabra para ver su lema, significado y gramática.</Text>
      )}
      <View style={[styles.words, lang.rtl && styles.rtl]}>
        {words.map(([greek, translit, es], i) => (
          <Pressable
            key={i}
            onPress={() => setActive(active === i ? null : i)}
            style={[styles.word, { borderColor: active === i ? colors.accent : colors.border }]}
          >
            <Text style={[styles.greek, lang.rtl && styles.hebrew, { color: colors.greek }]}>{greek}</Text>
            <Text style={[styles.translit, { color: colors.muted }]}>{translit}</Text>
            <Text style={[styles.gloss, { color: colors.accent }]}>{es || '—'}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.credit, { color: colors.muted }]}>
        {lang.credit}
      </Text>
      {why && w && active !== null && (
        <StudyPanel
          book={book}
          chapter={chapter}
          verse={verse}
          word={{ index: active, greek: w[0] }}
          onClose={() => setWhy(false)}
        />
      )}
    </View>
  );
}

function CrossRefs({
  book,
  books,
  chapter,
  verse,
  colors,
  onNavigate,
}: {
  book: Book;
  books: Book[];
  chapter: number;
  verse: number;
  colors: Colors;
  onNavigate: () => void;
}) {
  const [refs, setRefs] = useState<CrossRef[] | null>(null);

  useEffect(() => {
    getCrossRefs(book.id, chapter).then((c) => setRefs(c[String(verse)] ?? []));
  }, [book, chapter, verse]);

  if (!refs) return <ActivityIndicator color={colors.accent} />;
  if (!refs.length) return <Text style={{ color: colors.muted }}>No hay referencias cruzadas para este versículo.</Text>;

  return (
    <View>
      {refs.map(([ref]) => (
        <RefRow key={ref} refId={ref} books={books} colors={colors} onNavigate={onNavigate} />
      ))}
      <Text style={[styles.credit, { color: colors.muted }]}>
        Referencias: OpenBible.info (CC BY), ordenadas por relevancia
      </Text>
    </View>
  );
}

function RefRow({ refId, books, colors, onNavigate }: { refId: string; books: Book[]; colors: Colors; onNavigate: () => void }) {
  const { start, end } = parseRef(refId);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    getChapter(start.book, start.chapter).then((vs) => {
      const t = vs.find(([n]) => n === start.verse)?.[1] ?? '';
      const more = end.verse !== start.verse || end.chapter !== start.chapter;
      setPreview(more ? `${t} …` : t);
    });
  }, [refId]);

  return (
    <Pressable
      onPress={() => {
        onNavigate();
        navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
      }}
      style={[styles.refRow, { borderColor: colors.border }]}
    >
      <Text style={{ color: colors.accent, fontWeight: '600' }}>{formatRef(refId, books)}</Text>
      <Text style={{ color: colors.text, marginTop: 2, fontFamily: serif }} numberOfLines={2}>
        {preview}
      </Text>
    </Pressable>
  );
}

function Places({
  book,
  chapter,
  verse,
  colors,
  onNavigate,
}: {
  book: Book;
  chapter: number;
  verse: number;
  colors: Colors;
  onNavigate: () => void;
}) {
  const [places, setPlaces] = useState<Place[] | null>(null);

  useEffect(() => {
    getPlaces(book.id, chapter).then(setPlaces);
  }, [book, chapter]);

  if (!places) return <ActivityIndicator color={colors.accent} />;
  if (!places.length) return <Text style={{ color: colors.muted }}>Este capítulo no nombra lugares que se puedan ubicar.</Text>;
  const here = places.filter((p) => p.verses.includes(verse));

  return (
    <View>
      <Text style={[styles.hint, { color: colors.muted }]}>
        {here.length
          ? `En este versículo: ${here.map((p) => p.name).join(', ')}. En gris, los demás lugares del capítulo.`
          : 'Este versículo no nombra lugares; estos son los del capítulo.'}
      </Text>
      <PlaceMap
        places={places}
        verse={verse}
        colors={colors}
        onVerse={(v) => {
          onNavigate();
          navigate(() => router.push(verseHref(book.id, chapter, v)), 'forward');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    minHeight: '55%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  handleRow: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  ref: { fontSize: 15, fontWeight: '700' },
  verseText: { fontFamily: serif, fontSize: 16, lineHeight: 24, marginTop: 4 },
  tabs: { flexGrow: 0, flexShrink: 0, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 12 },
  tab: { paddingVertical: 10, marginRight: 18, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  body: { paddingVertical: 16, paddingBottom: 40 },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  word: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 64 },
  greek: { fontSize: 20, fontFamily: serif },
  hebrew: { fontSize: 24, writingDirection: 'rtl' },
  rtl: { flexDirection: 'row-reverse' },
  translit: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  gloss: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  detail: { borderRadius: 8, padding: 12, marginBottom: 12 },
  hint: { fontSize: 13, marginBottom: 12 },
  credit: { fontSize: 11, marginTop: 16 },
  refRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
