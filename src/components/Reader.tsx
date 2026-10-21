import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import ChapterEnd from '@/components/ChapterEnd';
import { compareHref } from '@/components/Comparar';
import NoteEditor from '@/components/NoteEditor';
import ReaderSettings from '@/components/ReaderSettings';
import { NeedsConnection } from '@/components/SinConexion';
import StudyPanel from '@/components/StudyPanel';
import StudyVerse from '@/components/StudyVerse';
import VersionPicker from '@/components/VersionPicker';
import VerseImage from '@/components/VerseImage';
import VersePanel, { Tab } from '@/components/VersePanel';
import WordCard from '@/components/WordCard';
import {
  Book,
  CrossRef,
  NOT_DOWNLOADED,
  Verse,
  Version,
  Word,
  getBooks,
  getChapter,
  getChapterExtras,
  getCrossRefs,
  getInterlinear,
  getParagraphEnds,
  getVersions,
  original,
} from '@/lib/data';
import { playChapter, playDramatized, recordingId, useCatalog } from '@/lib/audio';
import { sans, saveLastRead, serif, useColors, useSettings } from '@/lib/theme';
import { HIGHLIGHT_COLORS, HighlightColor, setHighlight, useChapterHighlights } from '@/lib/highlights';
import { useChapterNotes } from '@/lib/notas';
import { BOOK_SLUGS, bookIdFromParam, chapterHref } from '@/lib/routes';
import { addCards, useCards, verseCardId } from '@/lib/tarjetas';
import { CapituloRow, fichaHref, fichasDelVersiculo, getFichasCapitulo, marcarNombres } from '@/lib/fichas';
import FichaChips from '@/components/FichaChips';
import { usePageSwipe } from '@/lib/pageSwipe';
import { fixedInTransition, navigate } from '@/lib/transition';
import ReaderHeader, { HEADER_HEIGHT } from '@/components/ReaderHeader';
import ToolButton from '@/components/ToolButton';
import {
  CardsIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CommentaryIcon,
  CompareIcon,
  DramaIcon,
  LecternIcon,
  LinkIcon,
  ListenIcon,
  MindMapIcon,
  PencilIcon,
  ShareIcon,
  SparkIcon,
  TalkIcon,
} from '@/components/icons';
import { chrome, setChromeHidden, useAutoHide } from '@/lib/chrome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Reader() {
  const params = useLocalSearchParams<{ book: string; chapter: string; verse?: string; v?: string }>();
  const bookId = bookIdFromParam(params.book);
  const chapter = Number(params.chapter);
  const verseParam = params.verse ?? params.v; // ?v= es el formato antiguo
  const target = verseParam ? Number(verseParam) : null;

  const colors = useColors();
  const { settings, update } = useSettings();
  const catalog = useCatalog();
  const insets = useSafeAreaInsets();
  const autoHide = useAutoHide();
  const fontFamily = settings.font === 'serif' ? serif : sans;
  const size = settings.fontSize;

  const [books, setBooks] = useState<Book[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [verses, setVerses] = useState<Verse[] | null>(null);
  // Versiones con derechos: aviso del editor y notas al pie que hay que mostrar con el texto
  const [extras, setExtras] = useState<{ copyright: string | null; notes: Record<number, string[]> } | null>(null);
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
  const [fichas, setFichas] = useState<CapituloRow[]>([]);
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
    setChromeHidden(false);
    setExtras(null);
    getChapter(bookId, chapter, settings.version)
      .then((v) => {
        setVerses(v);
        getChapterExtras(bookId, chapter, settings.version).then(setExtras, () => {});
      })
      .catch((e) => setError(String(e.message)));
    getCrossRefs(bookId, chapter).then(setXrefs).catch(() => {});
    getParagraphEnds(bookId, chapter).then(setParagraphEnds).catch(() => {});
    setFichas([]);
    getFichasCapitulo(bookId, chapter).then(setFichas).catch(() => {});
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
  const openFicha = (f: { id: string; nombre: string }) => navigate(() => router.push(fichaHref(f) as never), 'forward');
  /** En el versículo elegido, los nombres con ficha se pueden tocar (solo en la RV1909, que es la de los nombres). */
  const withNames = (n: number, text: string) =>
    n !== selected || settings.version !== 'rv1909'
      ? text
      : marcarNombres(text, fichasDelVersiculo(fichas, n)).map((t, i) =>
          t.ficha ? (
            <Text
              key={i}
              onPress={() => openFicha({ id: t.ficha![0], nombre: t.ficha![1] })}
              style={{ color: colors.accent, fontWeight: '700', textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: colors.accent }}
              accessibilityRole="link"
              accessibilityLabel={`Ficha de ${t.ficha[1]}`}
            >
              {t.texto}
            </Text>
          ) : (
            t.texto
          ),
        );
  const scrollToY = (y: number) => {
    autoHide.pause();
    scroll.current?.scrollTo({ y: Math.max(0, y - 80), animated: false });
  };

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

  // Letras de las notas al pie (a, b, c…) en el orden del capítulo
  const footnotes = Object.entries(extras?.notes ?? {})
    .map(([n, texts]) => [Number(n), texts] as const)
    .sort(([a], [b]) => a - b)
    .flatMap(([n, texts]) => texts.map((text) => ({ n, text })))
    .map((f, i) => ({ ...f, letter: i < 26 ? String.fromCharCode(97 + i) : String(i + 1) }));
  const footMark = (n: number) => {
    const letters = footnotes.filter((f) => f.n === n).map((f) => f.letter);
    return letters.length ? (
      <Text style={{ fontSize: size * 0.6, color: colors.accent, fontWeight: '700' }} accessibilityLabel="Tiene nota al pie">
        {'\u2009'}
        {letters.join(',')}
      </Text>
    ) : null;
  };

  const verseBlocks = settings.study || settings.layout === 'versiculo';
  const selectedText = verses?.find(([n]) => n === selected)?.[1] ?? '';
  const title = book ? `${book.name} ${chapter}` : '';
  const version = versions.find((v) => v.id === settings.version);

  const chapterTools = [
    {
      key: 'escuchar',
      label: 'Escuchar',
      hint: 'Escuchar la lectura del capítulo',
      icon: (c: string) => <ListenIcon color={c} size={22} />,
      onPress: () => playChapter(bookId, chapter, title),
    },
    ...(catalog.dramatizado.includes(recordingId(bookId, chapter))
      ? [
          {
            key: 'dramatizado',
            label: 'Dramatizado',
            hint: 'Escuchar el capítulo dramatizado, con voces, efectos y música',
            icon: (c: string) => <DramaIcon color={c} size={22} />,
            onPress: () => playDramatized(bookId, chapter, title),
          },
        ]
      : []),
    {
      key: 'podcast',
      label: 'Pódcast',
      hint: 'Resumen del capítulo en audio, como una conversación',
      icon: (c: string) => <TalkIcon color={c} size={22} />,
      onPress: () => tool('podcast'),
    },
    {
      key: 'mapa',
      label: 'Mapa mental',
      hint: 'Mapa mental del capítulo',
      icon: (c: string) => <MindMapIcon color={c} size={22} />,
      onPress: () => tool('mapa-mental'),
    },
    {
      key: 'tarjetas',
      label: 'Tarjetas',
      hint: 'Tarjetas de repaso del capítulo',
      icon: (c: string) => <CardsIcon color={c} size={22} />,
      onPress: () => tool('tarjetas'),
    },
  ];

  const verseActions =
    selected === null || !book
      ? []
      : [
          { key: 'estudiar', label: 'Estudiar', icon: (c: string) => <SparkIcon color={c} size={21} />, onPress: () => setStudy({ verse: selected }) },
          ...(book.interlinear
            ? [
                {
                  key: 'original',
                  label: 'Original',
                  icon: (c: string) => <Text style={[styles.letter, { color: c }]}>{original(book).icon}</Text>,
                  onPress: () => setPanelTab('interlineal'),
                },
              ]
            : []),
          {
            key: 'versiones',
            label: 'Versiones',
            icon: (c: string) => <CompareIcon color={c} size={21} />,
            onPress: () => setPanelTab('versiones'),
          },
          {
            key: 'referencias',
            label: 'Referencias',
            badge: xrefs[String(selected)]?.length,
            icon: (c: string) => <LinkIcon color={c} size={21} />,
            onPress: () => setPanelTab('referencias'),
          },
          { key: 'comentario', label: 'Comentario', icon: (c: string) => <CommentaryIcon color={c} size={21} />, onPress: () => setPanelTab('comentario') },
          { key: 'nota', label: notes[selected] ? 'Mi nota' : 'Nota', icon: (c: string) => <PencilIcon color={c} size={21} />, onPress: () => setWriting(true) },
          { key: 'compartir', label: 'Compartir', icon: (c: string) => <ShareIcon color={c} size={21} />, onPress: () => setSharing(true) },
          {
            key: 'memorizar',
            label: memorizing ? 'En repaso' : 'Memorizar',
            icon: (c: string) => (memorizing ? <CheckIcon color={c} size={21} /> : <CardsIcon color={c} size={21} />),
            onPress: memorize,
          },
          {
            key: 'preparar',
            label: 'Preparar',
            icon: (c: string) => <LecternIcon color={c} size={21} />,
            onPress: () => navigate(() => router.push(`/taller?libro=${book.id}&capitulo=${chapter}&versiculo=${selected}`), 'forward'),
          },
        ];


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title, headerShown: false }} />
      <ReaderHeader title={title} progress={progress} onSettings={() => setShowSettings(true)} />

      <ScrollView
        ref={scroll}
        // En la web el gesto horizontal es para pasar la hoja (usePageSwipe): el navegador solo desplaza en vertical.
        style={Platform.OS === 'web' ? ({ touchAction: 'pan-y pinch-zoom' } as object) : undefined}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + HEADER_HEIGHT + 10 }]}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const max = contentSize.height - layoutMeasurement.height;
          setProgress(max > 0 ? Math.min(1, Math.max(0, contentOffset.y / max)) : 1);
          autoHide.onScroll(e);
        }}
      >
        {book && (
          <View style={styles.chapterHead}>
            <Text style={[styles.bookName, { color: colors.accent }]}>{book.name}</Text>
            <Text style={[styles.chapterNumber, { color: colors.text, fontFamily: serif }]}>{chapter}</Text>
            <View style={styles.versionRow}>
              <Pressable
                onPress={() => setShowVersions(true)}
                style={({ pressed }) => [styles.version, { borderColor: colors.border }, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Versión: ${version?.name ?? 'Reina-Valera 1909'}. Cambiar versión`}
              >
                <Text style={[styles.versionText, { color: colors.muted }]}>{version?.abbr ?? 'RV1909'}</Text>
                <ChevronDownIcon color={colors.muted} size={14} strokeWidth={2.2} />
              </Pressable>
              <Pressable
                onPress={() => navigate(() => router.push(compareHref(bookId, chapter) as never), 'forward')}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.version,
                  styles.compare,
                  { borderColor: hovered ? colors.accent : colors.border },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Comparar versiones de este capítulo"
              >
                <CompareIcon color={colors.muted} size={15} strokeWidth={2} />
                <Text style={[styles.versionText, { color: colors.muted }]}>Comparar</Text>
              </Pressable>
            </View>

            <Appear delay={40} style={styles.studyWrap}>
              <Pressable
                onPress={() => setStudy({})}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.study,
                  { backgroundColor: colors.accentSoft, borderColor: hovered ? colors.accent : colors.accentSoft },
                  pressed && styles.pressedSoft,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Estudiar este capítulo"
              >
                <View style={[styles.studyIcon, { backgroundColor: colors.accent }]}>
                  <SparkIcon color={colors.surface} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.studyTitle, { color: colors.accent }]}>Estudiar este capítulo</Text>
                  <Text style={[styles.studySub, { color: colors.muted }]} numberOfLines={1}>
                    Contexto, preguntas y fuentes
                  </Text>
                </View>
                <ChevronRightIcon color={colors.accent} size={20} />
              </Pressable>
            </Appear>

            {/* Escuchar y las herramientas del capítulo en una sola fila; en un teléfono estrecho se desliza */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.toolsScroll}
              contentContainerStyle={styles.tools}
            >
              {chapterTools.map((t, i) => (
                <ToolButton key={t.key} index={i + 2} label={t.label} hint={t.hint} icon={t.icon} colors={colors} onPress={t.onPress} />
              ))}
            </ScrollView>
            {settings.study && (
              <Text style={[styles.studyHint, { color: colors.muted }]}>
                {`Toca una ${original(book).word} para ver su significado y gramática.`}
              </Text>
            )}
          </View>
        )}

        {error === NOT_DOWNLOADED ? (
          <Appear style={{ marginTop: 24 }}>
            <NeedsConnection
              title="Este capítulo no está descargado"
              intro={`Sin conexión solo se abre lo que guardaste en este dispositivo. Descarga ${book?.name ?? 'este libro'} o toda la Biblia para leerla en cualquier lugar.`}
            />
          </Appear>
        ) : (
          error && <Text style={{ color: colors.muted }}>{error}</Text>
        )}
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
                    {withNames(n, text)}
                    {footMark(n)}
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
                  {withNames(n, text)}
                  {footMark(n)}
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
        {verses && footnotes.length > 0 && (
          <View style={[styles.footnotes, { borderColor: colors.border }]}>
            <Text style={[styles.footnotesTitle, { color: colors.muted }]}>Notas de la {version?.abbr ?? 'versión'}</Text>
            {footnotes.map((f) => (
              <Text key={f.letter} style={[styles.footnote, { color: colors.text }]}>
                <Text style={{ color: colors.accent, fontWeight: '700' }}>
                  {chapter}:{f.n}
                  {f.letter}
                </Text>
                {'  '}
                {f.text}
              </Text>
            ))}
          </View>
        )}
        {verses && (
          <View style={styles.creditBox}>
            <Text style={[styles.credit, { color: colors.muted }]}>
              {extras?.copyright ?? version?.credit ?? 'Reina-Valera 1909 · dominio público'}
            </Text>
            {version?.links?.length ? (
              <View style={styles.creditLinks}>
                {version.links.map((l) => (
                  <Text
                    key={l.url}
                    style={[styles.creditLink, { color: colors.accent }]}
                    onPress={() => Linking.openURL(l.url)}
                    accessibilityRole="link"
                  >
                    {l.label}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        )}
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
                  {marks[selected] === c && <CloseIcon color={colors.text} size={12} />}
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              accessibilityLabel="Quitar selección"
              hitSlop={8}
              style={({ pressed }) => [styles.close, { backgroundColor: colors.background }, pressed && styles.pressed]}
            >
              <CloseIcon color={colors.muted} size={16} />
            </Pressable>
          </View>
          <FichaChips rows={fichasDelVersiculo(fichas, selected)} colors={colors} onOpen={openFicha} />
          {/* Todas las acciones a la vista, en una rejilla de cuatro columnas */}
          <View style={styles.actions}>
            {verseActions.map((t, i) => (
              <ToolButton key={t.key} index={i} label={t.label} icon={t.icon} badge={t.badge} colors={colors} onPress={t.onPress} width={verseActions.length > 8 ? '20%' : '25%'} />
            ))}
          </View>
        </Appear>
      ) : (
        verses && (
          <Animated.View
            style={[
              styles.navWrap,
              {
                opacity: chrome.interpolate({ inputRange: [0, 0.7], outputRange: [1, 0], extrapolate: 'clamp' }),
                transform: [{ translateY: chrome.interpolate({ inputRange: [0, 1], outputRange: [0, 96] }) }],
              },
            ]}
            pointerEvents="box-none"
          >
            <Appear key="nav" style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }, fixedInTransition('capitulos')]}>
              <Pressable
                onPress={() => go(-1)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Capítulo anterior"
                style={({ pressed }) => [styles.navArrow, pressed && { backgroundColor: colors.accentSoft }]}
              >
                <ChevronLeftIcon color={colors.text} size={20} strokeWidth={2} />
              </Pressable>
              <Pressable onPress={() => navigate(() => router.push('/libros'))} accessibilityRole="button" style={styles.navTitle}>
                <Text style={[styles.navTitleText, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => go(1)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Capítulo siguiente"
                style={({ pressed }) => [styles.navArrow, pressed && { backgroundColor: colors.accentSoft }]}
              >
                <ChevronRightIcon color={colors.text} size={20} strokeWidth={2} />
              </Pressable>
            </Appear>
          </Animated.View>
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

const styles = StyleSheet.create({
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  pressedSoft: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  content: { paddingHorizontal: 24, paddingBottom: 140, maxWidth: 680, width: '100%', alignSelf: 'center' },
  chapterHead: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
  bookName: { fontSize: 13, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' },
  chapterNumber: { fontSize: 64, lineHeight: 72, marginTop: 4 },
  version: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    paddingRight: 9,
  },
  versionRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  compare: { paddingLeft: 10, paddingRight: 12, gap: 5 },
  versionText: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.4, lineHeight: 16 },
  studyWrap: { width: '100%', maxWidth: 420, marginTop: 18 },
  study: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
  },
  studyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  studyTitle: { fontSize: 15, fontWeight: '700' },
  studySub: { fontSize: 12.5, marginTop: 1 },
  toolsScroll: { alignSelf: 'stretch', marginHorizontal: -24, marginTop: 16, flexGrow: 0 },
  tools: { flexGrow: 1, flexDirection: 'row', justifyContent: 'center', gap: 2, paddingHorizontal: 16 },
  studyHint: { fontSize: 13, textAlign: 'center', marginTop: 12, maxWidth: 360 },
  verseLine: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginHorizontal: -6 },
  creditBox: { marginTop: 24, gap: 8, alignItems: 'center' },
  credit: { fontSize: 12, textAlign: 'center' },
  creditLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  creditLink: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  footnotes: { marginTop: 28, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  footnotesTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  footnote: { fontSize: 14, lineHeight: 21 },
  navWrap: { position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  navArrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  navTitle: { height: 38, justifyContent: 'center', paddingHorizontal: 10, minWidth: 96, alignItems: 'center' },
  navTitleText: { fontWeight: '600', fontSize: 15, lineHeight: 20 },
  actionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 20,
    maxWidth: 560,
    alignSelf: 'center',
    marginHorizontal: 'auto',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  actionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  swatches: { flexDirection: 'row', gap: 10, marginLeft: 'auto', marginRight: 4 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, marginTop: 14, marginHorizontal: -6 },
  letter: { fontFamily: serif, fontSize: 21, lineHeight: 24, textAlign: 'center', width: 22, includeFontPadding: false },
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
