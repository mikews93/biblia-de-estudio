import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import ChapterEnd from '@/components/ChapterEnd';
import ReaderSettings from '@/components/ReaderSettings';
import StudyPanel from '@/components/StudyPanel';
import StudyVerse from '@/components/StudyVerse';
import VersePanel, { Tab } from '@/components/VersePanel';
import WordCard from '@/components/WordCard';
import { Book, CrossRef, Verse, Word, getBooks, getChapter, getCrossRefs, getInterlinear, getParagraphEnds } from '@/lib/data';
import { sans, saveLastRead, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function Reader() {
  const params = useLocalSearchParams<{ book: string; chapter: string; v?: string }>();
  const bookId = params.book;
  const chapter = Number(params.chapter);
  const target = params.v ? Number(params.v) : null;

  const colors = useColors();
  const { settings, update } = useSettings();
  const fontFamily = settings.font === 'serif' ? serif : sans;
  const size = settings.fontSize;

  const [books, setBooks] = useState<Book[]>([]);
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [xrefs, setXrefs] = useState<Record<string, CrossRef[]>>({});
  const [paragraphEnds, setParagraphEnds] = useState<number[]>([]);
  const [interlinear, setInterlinear] = useState<Record<string, Word[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(target);
  const [panelTab, setPanelTab] = useState<Tab | null>(null);
  const [word, setWord] = useState<{ verse: number; index: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [study, setStudy] = useState<{ verse?: number } | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const paragraphHeight = useRef(0);

  useEffect(() => {
    getBooks().then(setBooks).catch((e) => setError(String(e.message)));
  }, []);

  useEffect(() => {
    setVerses(null);
    setError(null);
    setXrefs({});
    setParagraphEnds([]);
    setInterlinear({});
    setSelected(target);
    setPanelTab(null);
    setProgress(0);
    getChapter(bookId, chapter)
      .then(setVerses)
      .catch((e) => setError(String(e.message)));
    getCrossRefs(bookId, chapter).then(setXrefs).catch(() => {});
    getParagraphEnds(bookId, chapter).then(setParagraphEnds).catch(() => {});
    saveLastRead(bookId, chapter);
  }, [bookId, chapter, target]);

  const index = books.findIndex((b) => b.id === bookId);
  const book = books[index];

  useEffect(() => {
    if (settings.study && book?.interlinear) getInterlinear(bookId, chapter).then(setInterlinear).catch(() => {});
  }, [settings.study, book, bookId, chapter]);

  const go = (delta: number) => {
    if (!book) return;
    let i = index;
    let ch = chapter + delta;
    if (ch < 1) {
      if (i === 0) return;
      i -= 1;
      ch = books[i].chapters;
    } else if (ch > book.chapters) {
      if (i === books.length - 1) return;
      i += 1;
      ch = 1;
    }
    navigate(() => router.replace(`/${books[i].id}/${ch}`), delta > 0 ? 'forward' : 'back');
  };

  const select = (n: number) => setSelected(selected === n ? null : n);
  const scrollToY = (y: number) => scroll.current?.scrollTo({ y: Math.max(0, y - 80), animated: false });

  // En modo párrafo no hay posición por versículo: se estima por la proporción de texto anterior
  const scrollToTargetInParagraph = () => {
    if (!target || !verses) return;
    const total = verses.reduce((s, [, t]) => s + t.length, 0);
    const before = verses.filter(([n]) => n < target).reduce((s, [, t]) => s + t.length, 0);
    scrollToY(140 + (before / total) * paragraphHeight.current);
  };

  const verseBlocks = settings.study || settings.layout === 'versiculo';
  const selectedText = verses?.find(([n]) => n === selected)?.[1] ?? '';
  const title = book ? `${book.name} ${chapter}` : '';

  const copy = async () => {
    if (!book || selected === null) return;
    await Clipboard.setStringAsync(`«${selectedText}» ${book.name} ${chapter}:${selected} (RV1909)`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title,
          headerStyle: { backgroundColor: colors.background },
          headerTitle: () => (
            <Pressable onPress={() => navigate(() => router.push('/libros'))} accessibilityRole="button" accessibilityLabel="Elegir libro y capítulo">
              <Text style={[styles.headerTitle, { color: colors.text }]}>{title} ▾</Text>
            </Pressable>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <Pressable
                onPress={() => update({ study: !settings.study })}
                style={[
                  styles.studyToggle,
                  { borderColor: colors.accent },
                  settings.study && { backgroundColor: colors.accent },
                ]}
                accessibilityRole="switch"
                accessibilityState={{ checked: settings.study }}
                accessibilityLabel="Modo estudio"
              >
                <Text style={{ color: settings.study ? colors.surface : colors.accent, fontWeight: '700', fontSize: 13 }}>
                  Estudio
                </Text>
              </Pressable>
              <Pressable onPress={() => setShowSettings(true)} accessibilityLabel="Ajustes de lectura" style={styles.aa}>
                <Text style={{ color: colors.text, fontSize: 18, fontFamily: serif }}>Aa</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressBar, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} />
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const max = contentSize.height - layoutMeasurement.height;
          setProgress(max > 0 ? Math.min(1, Math.max(0, contentOffset.y / max)) : 1);
        }}
      >
        {book && (
          <View style={styles.chapterHead}>
            <Text style={[styles.bookName, { color: colors.accent }]}>{book.name}</Text>
            <Text style={[styles.chapterNumber, { color: colors.text, fontFamily: serif }]}>{chapter}</Text>
            <Pressable
              onPress={() => setStudy({})}
              style={[styles.studyChapter, { backgroundColor: colors.accentSoft }]}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>✦ Estudiar este capítulo</Text>
            </Pressable>
            {settings.study && (
              <Text style={[styles.studyHint, { color: colors.muted }]}>
                {book.interlinear
                  ? 'Toca una palabra griega para ver su significado y gramática.'
                  : 'El interlineal hebreo llega pronto. Toca las referencias para seguir el hilo.'}
              </Text>
            )}
          </View>
        )}

        {error && <Text style={{ color: colors.muted }}>{error}</Text>}
        {!verses && !error && <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />}

        {verses && !verseBlocks && (
          <View
            onLayout={(e) => {
              paragraphHeight.current = e.nativeEvent.layout.height;
              scrollToTargetInParagraph();
            }}
          >
            {paragraphs(verses, paragraphEnds).map((group) => (
              <Text
                key={group[0][0]}
                style={{ fontFamily, fontSize: size, lineHeight: size * 1.7, color: colors.text, marginBottom: size * 0.8 }}
              >
                {group.map(([n, text], i) => (
                  <Text
                    key={n}
                    onPress={() => select(n)}
                    style={
                      n === selected
                        ? { backgroundColor: colors.highlight, textDecorationLine: 'underline', textDecorationColor: colors.accent }
                        : undefined
                    }
                  >
                    <Text style={{ fontSize: size * 0.6, color: colors.accent, fontWeight: '700' }}>
                      {i === 0 ? '' : ' '}
                      {n}
                      {'\u2009'}
                    </Text>
                    {text}
                  </Text>
                ))}
              </Text>
            ))}
          </View>
        )}

        {verses &&
          verseBlocks &&
          verses.map(([n, text]) =>
            settings.study ? (
              <View key={n} onLayout={(e) => n === target && scrollToY(e.nativeEvent.layout.y)}>
                <StudyVerse
                  n={n}
                  text={text}
                  words={interlinear[String(n)]}
                  refCount={xrefs[String(n)]?.length ?? 0}
                  selected={n === selected}
                  fontSize={size}
                  fontFamily={fontFamily}
                  colors={colors}
                  onSelect={() => select(n)}
                  onWord={(i) => setWord({ verse: n, index: i })}
                  onRefs={() => {
                    setSelected(n);
                    setPanelTab('referencias');
                  }}
                />
              </View>
            ) : (
              <Pressable
                key={n}
                onPress={() => select(n)}
                onLayout={(e) => n === target && scrollToY(e.nativeEvent.layout.y)}
                style={[styles.verseLine, n === selected && { backgroundColor: colors.highlight }]}
              >
                <Text style={{ fontFamily, fontSize: size, lineHeight: size * 1.6, color: colors.text }}>
                  <Text style={{ fontSize: size * 0.6, color: colors.accent, fontWeight: '700' }}>{n} </Text>
                  {text}
                </Text>
              </Pressable>
            ),
          )}

        {verses && book && (
          <ChapterEnd
            book={book}
            chapter={chapter}
            colors={colors}
            next={chapter < book.chapters ? `${book.name} ${chapter + 1}` : books[index + 1] ? `${books[index + 1].name} 1` : null}
            onNext={() => go(1)}
          />
        )}
        <Text style={[styles.credit, { color: colors.muted }]}>Reina-Valera 1909 · dominio público</Text>
      </ScrollView>

      {selected !== null && book && verses ? (
        <Appear key="actions" style={[styles.actionBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.actionHead}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>
              {book.name} {chapter}:{selected}
            </Text>
            <Pressable onPress={() => setSelected(null)} accessibilityLabel="Quitar selección" hitSlop={12}>
              <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Action label="Estudiar" icon="✦" colors={colors} onPress={() => setStudy({ verse: selected })} />
            {book.interlinear && (
              <Action label="Original" icon="α" colors={colors} onPress={() => setPanelTab('interlineal')} />
            )}
            <Action
              label="Referencias"
              icon="↗"
              badge={xrefs[String(selected)]?.length}
              colors={colors}
              onPress={() => setPanelTab('referencias')}
            />
            <Action label="Comentario" icon="¶" colors={colors} onPress={() => setPanelTab('comentario')} />
            <Action label={copied ? 'Copiado' : 'Copiar'} icon="⧉" colors={colors} onPress={copy} />
          </View>
        </Appear>
      ) : (
        verses && (
          <Appear key="nav" style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={() => go(-1)} hitSlop={8} accessibilityLabel="Capítulo anterior" style={styles.navArrow}>
              <Text style={{ color: colors.text, fontSize: 22 }}>‹</Text>
            </Pressable>
            <Pressable onPress={() => navigate(() => router.push('/libros'))}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{title}</Text>
            </Pressable>
            <Pressable onPress={() => go(1)} hitSlop={8} accessibilityLabel="Capítulo siguiente" style={styles.navArrow}>
              <Text style={{ color: colors.text, fontSize: 22 }}>›</Text>
            </Pressable>
          </Appear>
        )
      )}

      {book && selected !== null && panelTab && verses && (
        <VersePanel
          book={book}
          books={books}
          chapter={chapter}
          verse={selected}
          text={selectedText}
          initialTab={panelTab}
          onClose={() => setPanelTab(null)}
        />
      )}
      {word && interlinear[String(word.verse)]?.[word.index] && book && (
        <WordCard
          word={interlinear[String(word.verse)][word.index]}
          reference={`${book.name} ${chapter}:${word.verse}`}
          onClose={() => setWord(null)}
        />
      )}
      {study && book && (
        <StudyPanel book={book} chapter={chapter} verse={study.verse} onClose={() => setStudy(null)} />
      )}
      {showSettings && <ReaderSettings onClose={() => setShowSettings(false)} />}
    </View>
  );
}

type ActionProps = { label: string; icon: string; badge?: number; colors: ReturnType<typeof useColors>; onPress: () => void };

function Action({ label, icon, badge, colors, onPress }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIcon, { backgroundColor: colors.accentSoft }]}>
        <Text style={{ color: colors.accent, fontSize: 18, fontFamily: serif }}>{icon}</Text>
        {!!badge && (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={{ color: colors.surface, fontSize: 10, fontWeight: '700' }}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={{ color: colors.text, fontSize: 11, marginTop: 4 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 },
  studyToggle: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  aa: { paddingHorizontal: 4 },
  progressTrack: { height: 2 },
  progressBar: { height: 2 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 140, maxWidth: 680, width: '100%', alignSelf: 'center' },
  chapterHead: { alignItems: 'center', marginTop: 16, marginBottom: 20 },
  bookName: { fontSize: 13, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' },
  chapterNumber: { fontSize: 64, lineHeight: 72, marginTop: 4 },
  studyChapter: { marginTop: 12, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  studyHint: { fontSize: 13, textAlign: 'center', marginTop: 8, maxWidth: 360 },
  verseLine: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginHorizontal: -6 },
  credit: { fontSize: 12, textAlign: 'center', marginTop: 24 },
  navPill: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  navArrow: { paddingHorizontal: 10 },
  actionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 20,
    maxWidth: 520,
    alignSelf: 'center',
    marginHorizontal: 'auto',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  actionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  action: { alignItems: 'center', flex: 1 },
  badge: { position: 'absolute', top: -2, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

/** Agrupa los versículos en párrafos según los finales de párrafo del griego (sin datos: un solo párrafo). */
function paragraphs(verses: Verse[], ends: number[]): Verse[][] {
  const groups: Verse[][] = [[]];
  for (const v of verses) {
    groups[groups.length - 1].push(v);
    if (ends.includes(v[0]) && v !== verses[verses.length - 1]) groups.push([]);
  }
  return groups;
}
