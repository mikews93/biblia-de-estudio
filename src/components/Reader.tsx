import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import ChapterEnd from '@/components/ChapterEnd';
import NoteEditor from '@/components/NoteEditor';
import ReaderSettings from '@/components/ReaderSettings';
import StudyPanel from '@/components/StudyPanel';
import StudyVerse from '@/components/StudyVerse';
import VersionPicker from '@/components/VersionPicker';
import VerseImage from '@/components/VerseImage';
import VersePanel, { Tab } from '@/components/VersePanel';
import WordCard from '@/components/WordCard';
import {
  Book,
  CrossRef,
  Verse,
  Version,
  Word,
  getBooks,
  getChapter,
  getCrossRefs,
  getInterlinear,
  getParagraphEnds,
  getVersions,
  original,
} from '@/lib/data';
import { playChapter } from '@/lib/audio';
import { sans, saveLastRead, serif, useColors, useSettings } from '@/lib/theme';
import { HIGHLIGHT_COLORS, HighlightColor, setHighlight, useChapterHighlights } from '@/lib/highlights';
import { useChapterNotes } from '@/lib/notas';
import { BOOK_SLUGS, bookIdFromParam, chapterHref } from '@/lib/routes';
import { addCards, useCards, verseCardId } from '@/lib/tarjetas';
import { usePageSwipe } from '@/lib/pageSwipe';
import { fixedInTransition, navigate } from '@/lib/transition';
import SearchIcon from '@/components/SearchIcon';

export default function Reader() {
  const params = useLocalSearchParams<{ book: string; chapter: string; verse?: string; v?: string }>();
  const bookId = bookIdFromParam(params.book);
  const chapter = Number(params.chapter);
  const verseParam = params.verse ?? params.v; // ?v= es el formato antiguo
  const target = verseParam ? Number(verseParam) : null;

  const colors = useColors();
  const { settings, update } = useSettings();
  const fontFamily = settings.font === 'serif' ? serif : sans;
  const size = settings.fontSize;

  const [books, setBooks] = useState<Book[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [showVersions, setShowVersions] = useState(false);
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
  const [sharing, setSharing] = useState(false);
  const [study, setStudy] = useState<{ verse?: number } | null>(null);
  const [writing, setWriting] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const paragraphHeight = useRef(0);

  useEffect(() => {
    getBooks().then(setBooks).catch((e) => setError(String(e.message)));
    getVersions().then(setVersions).catch(() => {});
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
    getChapter(bookId, chapter, settings.version)
      .then(setVerses)
      .catch((e) => setError(String(e.message)));
    getCrossRefs(bookId, chapter).then(setXrefs).catch(() => {});
    getParagraphEnds(bookId, chapter).then(setParagraphEnds).catch(() => {});
    saveLastRead(bookId, chapter);
  }, [bookId, chapter, target, settings.version]);

  const index = books.findIndex((b) => b.id === bookId);
  const book = books[index];

  useEffect(() => {
    if (settings.study && book?.interlinear) getInterlinear(bookId, chapter).then(setInterlinear).catch(() => {});
  }, [settings.study, book, bookId, chapter]);

  /** Capítulo siguiente (1) o anterior (-1), saltando de libro; null en el principio o el final de la Biblia. */
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
    return chapterHref(books[i].id, ch);
  };

  const go = (delta: 1 | -1) => {
    const href = neighbor(delta);
    if (href) navigate(() => router.replace(href), delta > 0 ? 'turn-forward' : 'turn-back');
  };

  usePageSwipe(neighbor);

  const select = (n: number) => setSelected(selected === n ? null : n);
  const scrollToY = (y: number) => scroll.current?.scrollTo({ y: Math.max(0, y - 80), animated: false });

  // En modo párrafo no hay posición por versículo: se estima por la proporción de texto anterior
  const scrollToTargetInParagraph = () => {
    if (!target || !verses) return;
    const total = verses.reduce((s, [, t]) => s + t.length, 0);
    const before = verses.filter(([n]) => n < target).reduce((s, [, t]) => s + t.length, 0);
    scrollToY(140 + (before / total) * paragraphHeight.current);
  };

  const marks = useChapterHighlights(bookId, chapter);
  const mark = (n: number) => (marks[n] ? HIGHLIGHT_COLORS[marks[n]] : undefined);
  const paint = (color: HighlightColor) => {
    if (selected === null) return;
    setHighlight(bookId, chapter, selected, marks[selected] === color ? null : color);
    setSelected(null);
  };

  const notes = useChapterNotes(bookId, chapter);
  const deck = useCards();
  const memorizing = selected !== null && !!deck[verseCardId(bookId, chapter, selected)];
  const memorize = () => {
    if (selected === null || !book) return;
    if (memorizing) {
      navigate(() => router.push('/repaso'), 'forward');
      return;
    }
    const reference = `${book.name} ${chapter}:${selected}`;
    const words = selectedText.split(/\s+/);
    addCards([
      {
        id: verseCardId(bookId, chapter, selected),
        kind: 'versiculo',
        book: bookId,
        chapter,
        verse: selected,
        label: reference,
        front: words.length > 7 ? `${reference}\n«${words.slice(0, 4).join(' ')}…»` : reference,
        back: selectedText,
      },
    ]);
  };
  // Herramientas del capítulo inspiradas en NotebookLM
  const tool = (path: 'podcast' | 'mapa-mental' | 'tarjetas') =>
    navigate(() => router.push(`/${path}/${BOOK_SLUGS[bookId] ?? bookId}/${chapter}` as never), 'forward');
  const noteMark = (n: number) =>
    notes[n] ? <Text style={{ fontSize: size * 0.7, color: colors.accent }} accessibilityLabel="Tiene nota">{' ✎'}</Text> : null;

  const verseBlocks = settings.study || settings.layout === 'versiculo';
  const selectedText = verses?.find(([n]) => n === selected)?.[1] ?? '';
  const title = book ? `${book.name} ${chapter}` : '';
  const version = versions.find((v) => v.id === settings.version);


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
              <Pressable onPress={() => navigate(() => router.push('/buscar'), 'forward')} accessibilityRole="search" accessibilityLabel="Buscar">
                <SearchIcon color={colors.text} size={21} />
              </Pressable>
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
      <View style={[styles.progressTrack, { backgroundColor: colors.border }, fixedInTransition('progreso')]}>
        <View style={[styles.progressBar, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} />
      </View>

      <ScrollView
        ref={scroll}
        // En la web el gesto horizontal es para pasar la hoja (usePageSwipe): el navegador solo desplaza en vertical.
        style={Platform.OS === 'web' ? ({ touchAction: 'pan-y pinch-zoom' } as object) : undefined}
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
            <View style={styles.headPills}>
              <Pressable
                onPress={() => setShowVersions(true)}
                style={({ pressed }) => [styles.pill, { borderColor: colors.border }, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Versión: ${version?.name ?? 'Reina-Valera 1909'}. Cambiar versión`}
              >
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{version?.abbr ?? 'RV1909'} ▾</Text>
              </Pressable>
              <Pressable
                onPress={() => setStudy({})}
                style={({ pressed }) => [
                  styles.pill,
                  { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>✦ Estudiar este capítulo</Text>
              </Pressable>
              <Pressable
                onPress={() => playChapter(bookId, chapter, title)}
                style={({ pressed }) => [styles.pill, { borderColor: colors.border }, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Escuchar el capítulo dramatizado"
              >
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>▶ Escuchar</Text>
              </Pressable>
            </View>
            <View style={styles.tools}>
              {(
                [
                  ['podcast', '🎧 Pódcast', 'Resumen del capítulo en audio, como una conversación'],
                  ['mapa-mental', '◉ Mapa mental', 'Mapa mental del capítulo'],
                  ['tarjetas', '▤ Tarjetas', 'Tarjetas de repaso del capítulo'],
                ] as const
              ).map(([path, label, hint]) => (
                <Pressable
                  key={path}
                  onPress={() => tool(path)}
                  style={({ pressed }) => [styles.toolPill, { borderColor: colors.border }, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={hint}
                >
                  <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 12.5 }}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {settings.study && (
              <Text style={[styles.studyHint, { color: colors.muted }]}>
                {`Toca una ${original(book).word} para ver su significado y gramática.`}
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
                {group.map(([n, text, label], i) => (
                  <Text
                    key={n}
                    onPress={() => select(n)}
                    style={
                      n === selected
                        ? {
                            backgroundColor: mark(n) ?? colors.highlight,
                            textDecorationLine: 'underline',
                            textDecorationColor: colors.accent,
                          }
                        : { backgroundColor: mark(n) }
                    }
                  >
                    <Text style={{ fontSize: size * 0.6, color: colors.accent, fontWeight: '700' }}>
                      {i === 0 ? '' : ' '}
                      {label ?? n}
                      {'\u2009'}
                    </Text>
                    {text}
                    {noteMark(n)}
                  </Text>
                ))}
              </Text>
            ))}
          </View>
        )}

        {verses &&
          verseBlocks &&
          verses.map(([n, text, label]) =>
            settings.study ? (
              <View key={n} onLayout={(e) => n === target && scrollToY(e.nativeEvent.layout.y)}>
                <StudyVerse
                  n={n}
                  text={text}
                  words={interlinear[String(n)]}
                  rtl={original(book).rtl}
                  refCount={xrefs[String(n)]?.length ?? 0}
                  selected={n === selected}
                  mark={mark(n)}
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
                style={[
                  styles.verseLine,
                  { backgroundColor: mark(n) },
                  n === selected && { backgroundColor: colors.highlight },
                ]}
              >
                <Text style={{ fontFamily, fontSize: size, lineHeight: size * 1.6, color: colors.text }}>
                  <Text style={{ fontSize: size * 0.6, color: colors.accent, fontWeight: '700' }}>{label ?? n} </Text>
                  {text}
                  {noteMark(n)}
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
        <Text style={[styles.credit, { color: colors.muted }]}>
          {version?.credit ?? 'Reina-Valera 1909 · dominio público'}
        </Text>
      </ScrollView>

      {selected !== null && book && verses ? (
        <Appear key="actions" style={[styles.actionBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.actionHead}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>
              {book.name} {chapter}:{selected}
            </Text>
            <View style={styles.swatches}>
              {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => paint(c)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={marks[selected] === c ? `Quitar resaltado ${c}` : `Resaltar en ${c}`}
                  style={({ pressed }) => [
                    styles.swatch,
                    { backgroundColor: HIGHLIGHT_COLORS[c], borderColor: marks[selected] === c ? colors.accent : colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  {marks[selected] === c && <Text style={{ color: colors.text, fontSize: 11 }}>✕</Text>}
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setSelected(null)} accessibilityLabel="Quitar selección" hitSlop={12}>
              <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          {/* Con ocho acciones no caben los nombres en un teléfono: la fila se desliza */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionsScroll} contentContainerStyle={styles.actions}>
            <Action label="Estudiar" icon="✦" colors={colors} onPress={() => setStudy({ verse: selected })} />
            {book.interlinear && (
              <Action label="Original" icon={original(book).icon} colors={colors} onPress={() => setPanelTab('interlineal')} />
            )}
            <Action
              label="Referencias"
              icon="↗"
              badge={xrefs[String(selected)]?.length}
              colors={colors}
              onPress={() => setPanelTab('referencias')}
            />
            <Action label="Comentario" icon="¶" colors={colors} onPress={() => setPanelTab('comentario')} />
            <Action label={notes[selected] ? 'Mi nota' : 'Nota'} icon="✎" colors={colors} onPress={() => setWriting(true)} />
            <Action label="Compartir" icon="⇪" colors={colors} onPress={() => setSharing(true)} />
            <Action label={memorizing ? 'En repaso' : 'Memorizar'} icon={memorizing ? '✓' : '▤'} colors={colors} onPress={memorize} />
            <Action
              label="Preparar"
              icon="✎"
              colors={colors}
              onPress={() =>
                navigate(() => router.push(`/taller?libro=${book.id}&capitulo=${chapter}&versiculo=${selected}`), 'forward')
              }
            />
          </ScrollView>
        </Appear>
      ) : (
        verses && (
          <Appear key="nav" style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }, fixedInTransition('capitulos')]}>
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
          study={{ book, chapter, verse: word.verse, index: word.index }}
          onClose={() => setWord(null)}
        />
      )}
      {study && book && (
        <StudyPanel book={book} chapter={chapter} verse={study.verse} onClose={() => setStudy(null)} />
      )}
      {sharing && book && selected !== null && (
        <VerseImage
          verse={{
            book: book.id,
            chapter,
            verse: selected,
            text: selectedText,
            reference: `${book.name} ${chapter}:${selected}`,
            version: version?.abbr ?? 'RV1909',
          }}
          onClose={() => setSharing(false)}
        />
      )}
      {writing && book && selected !== null && (
        <NoteEditor
          book={book.id}
          chapter={chapter}
          verse={selected}
          reference={`${book.name} ${chapter}:${selected}`}
          text={selectedText}
          onClose={() => setWriting(false)}
        />
      )}
      {showSettings && <ReaderSettings onClose={() => setShowSettings(false)} />}
      {showVersions && <VersionPicker versions={versions} onClose={() => setShowVersions(false)} />}
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
      <Text style={{ color: colors.text, fontSize: 10.5, letterSpacing: -0.2, marginTop: 4 }} numberOfLines={1}>
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
  headPills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  pill: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 },
  toolPill: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 4 },
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
  actionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  swatches: { flexDirection: 'row', gap: 10, marginLeft: 'auto', marginRight: 8 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  actionsScroll: { marginTop: 12, marginHorizontal: -14 },
  actions: { flexDirection: 'row', flexGrow: 1, justifyContent: 'space-around', paddingHorizontal: 6 },
  action: { alignItems: 'center', width: 64 },
  badge: { position: 'absolute', top: -2, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

/** Agrupa los versículos en párrafos según los finales de párrafo del griego o del hebreo (sin datos: un solo párrafo). */
function paragraphs(verses: Verse[], ends: number[]): Verse[][] {
  const groups: Verse[][] = [[]];
  for (const v of verses) {
    groups[groups.length - 1].push(v);
    if (ends.includes(v[0]) && v !== verses[verses.length - 1]) groups.push([]);
  }
  return groups;
}
