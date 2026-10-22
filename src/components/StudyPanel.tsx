import { router, useIsFocused } from 'expo-router';
import { ComponentRef, ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Appear from '@/components/Appear';
import { IconText } from '@/components/comunidad/ui';
import AskBar from '@/components/AskBar';
import Devotional from '@/components/Devotional';
import { ArrowDownIcon, CloseIcon, HeartIcon, type IconProps, SparkIcon } from '@/components/icons';
import StudyContext from '@/components/StudyContext';
import StudySignals from '@/components/StudySignals';
import { Book, original, parseRef } from '@/lib/data';
import Welcome from '@/components/comunidad/Welcome';
import { NeedsConnection } from '@/components/SinConexion';
import { slide, useAutoHide } from '@/lib/chrome';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { NEEDS_CONNECTION } from '@/lib/conexion';
import { useConversations } from '@/lib/conversaciones';
import { Enfoque, Source, askStudy } from '@/lib/estudio';
import { conversationKey, forgetConversation, saveConversation, savedConversation } from '@/lib/misPreguntas';
import { forgetKept, studyKeep } from '@/lib/recordado';
import { Colors, serif, useColors, useSettings } from '@/lib/theme';
import { BOOK_SLUGS, verseHref } from '@/lib/routes';
import { navigate } from '@/lib/transition';
import StudyBackground from '@/components/StudyBackground';
import { Markdown, SourcePeek, Sources } from '@/components/StudyText';

export { Markdown, Sources };

type Props = {
  book: Book;
  chapter: number;
  verse?: number;
  /** «¿Por qué esta palabra?»: posición de la palabra griega en el versículo y cómo se muestra. */
  word?: { index: number; greek: string };
  onClose: () => void;
  /** Modo con el que se abre; si no, el último que eligió la persona. */
  enfoque?: Enfoque;
};

const SUGGESTIONS = ['Explícamelo más sencillo', '¿Cómo lo aplico hoy?', '¿Qué aportan los pasajes relacionados?'];
const WORD_SUGGESTIONS = ['Explícamelo más sencillo', '¿Por qué no se tradujo de otra forma?', '¿Cómo lo aplico hoy?'];
// Cuánto deja quieta la cabecera tras un desplazamiento que hace la app al seguir una respuesta.
const FOLLOW_PAUSE = 1200;

/**
 * Estudio generado con IA a partir de las fuentes de la app, con citas y preguntas de seguimiento.
 * El estudio del pasaje es el mismo para todos; las preguntas de cada persona se guardan solo en su
 * dispositivo (src/lib/misPreguntas.ts). Al seguir un enlace la ventana se oculta y, al volver atrás,
 * reaparece donde estaba.
 */
export default function StudyPanel({ book, chapter, verse, word, onClose, enfoque: initial }: Props) {
  const colors = useColors();
  const { settings, update } = useSettings();
  // «¿Por qué esta palabra?» siempre es estudio profundo.
  const [chosen, setChosen] = useState<Enfoque>(initial ?? settings.enfoque);
  const mode: Enfoque = word ? 'profundo' : chosen;
  // Al seguir un enlace o ir a /entrar, la ventana se oculta para no tapar esa pantalla y vuelve al regresar.
  const focused = useIsFocused();
  const [question, setQuestion] = useState('');
  const [peek, setPeek] = useState<Source | null>(null);
  const [clearing, setClearing] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const passage = verse ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`;
  const title = word ? `${word.greek} en ${passage}` : passage;
  const passageKey = `${book.id}.${chapter}.${verse ?? ''}.${word?.index ?? ''}`;
  const storeKey = (e: Enfoque) => conversationKey(e, book.id, chapter, verse, word?.index);

  // Una conversación por modo: cambiar de Devocional a Profundo no vuelve a pedir nada ni detiene al otro.
  const convs = useConversations<Enfoque>(
    (enfoque, history, onUpdate, signal) =>
      askStudy({ book: book.id, chapter, verse, word: word?.index, messages: history, enfoque }, onUpdate, signal),
    (enfoque, done) => {
      if (done.some((t) => t.role === 'user')) saveConversation(storeKey(enfoque), done);
    },
  );
  const { turns, busy, error } = convs.get(mode);
  const starting = useRef(new Set<string>());

  /** Abre un modo: lo guardado en el dispositivo si la persona ya preguntó aquí; si no, el estudio de todos. */
  const start = async (enfoque: Enfoque) => {
    const id = `${passageKey}:${enfoque}`;
    if (starting.current.has(id)) return;
    starting.current.add(id);
    const saved = await savedConversation(storeKey(enfoque));
    if (!starting.current.has(id)) return; // cambió el pasaje mientras se leía
    if (saved) convs.set(enfoque, saved);
    else convs.run(enfoque, []);
  };

  useEffect(() => {
    convs.reset();
    starting.current.clear();
    setPeek(null);
    start(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passageKey]);

  // Lo recordado del devocional y del trasfondo se olvida al cerrar el estudio de verdad.
  useEffect(() => () => forgetKept(studyKeep(book.id, chapter, verse)), [book.id, chapter, verse]);

  const switchMode = (next: Enfoque) => {
    if (next === mode) return;
    setChosen(next);
    update({ enfoque: next });
    setPeek(null);
    setClearing(false);
    if (!convs.started(next)) start(next);
  };

  const ask = (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion('');
    setPeek(null);
    setClearing(false);
    convs.run(mode, [...turns, { role: 'user', text }]);
  };

  const clearMine = () => {
    forgetConversation(storeKey(mode));
    convs.set(mode, turns.slice(0, 1));
    setClearing(false);
  };

  // Seguir un enlace no cierra el estudio: se oculta (focused) y al volver atrás sigue donde estaba.
  const open = (ref: string) => {
    const { start: s } = parseRef(ref);
    navigate(() => router.push(verseHref(s.book, s.chapter, s.verse)), 'forward');
  };

  const openMap = () => {
    navigate(() => router.push(`/mapa/${BOOK_SLUGS[book.id] ?? book.id}/${chapter}` as never), 'forward');
  };

  // La cabecera (título y modos) se aparta al bajar leyendo y vuelve al subir, como las barras del lector.
  const [bar] = useState(() => new Animated.Value(0));
  const barHidden = useRef(false);
  const [barHeight, setBarHeight] = useState(0);
  const setBarHidden = (hide: boolean) => {
    if (hide === barHidden.current) return;
    barHidden.current = hide;
    slide(bar, hide);
  };
  const autoHide = useAutoHide(setBarHidden, false);

  // Al volver de un enlace el contenido se monta de nuevo: se vuelve a la misma altura.
  const scrollY = useRef(0);
  const viewHeight = useRef(0);
  const restore = useRef<number | null>(null);
  useEffect(() => {
    if (focused && scrollY.current > 0) restore.current = scrollY.current;
  }, [focused]);

  // Mientras llega la respuesta a una pregunta, la app va bajando hasta el final: la cabecera vuelve al
  // preguntar (para cambiar de modo o cerrar) y ese desplazamiento, ni lo que queda de la animación al
  // terminar, no la aparta.
  const following = busy && turns.length > 1;
  // Si la persona toca o arrastra mientras llega la respuesta, la app deja de bajar sola: puede quedarse
  // leyendo donde va. «Ir al final» vuelve a seguir el texto; cada pregunta nueva empieza siguiéndolo.
  const [detached, setDetached] = useState(false);
  const detachedRef = useRef(false);
  const setDetach = (on: boolean) => {
    if (on === detachedRef.current) return;
    detachedRef.current = on;
    setDetached(on);
  };
  const grab = () => {
    if (following) setDetach(true);
  };
  const toEnd = () => {
    setDetach(false);
    autoHide.pause(FOLLOW_PAUSE);
    scroll.current?.scrollToEnd({ animated: true });
  };
  useEffect(() => {
    autoHide.pause(FOLLOW_PAUSE);
    if (following) setBarHidden(false);
    setDetach(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [following]);

  const onContentSizeChange = (_: number, height: number) => {
    if (restore.current !== null) {
      if (height - viewHeight.current >= restore.current - 4) {
        autoHide.pause();
        scroll.current?.scrollTo({ y: restore.current, animated: false });
        restore.current = null;
      }
      return;
    }
    // Mientras llega la respuesta a una pregunta, se sigue el final. Ese desplazamiento lo hace la app:
    // no aparta la cabecera (con ella, el botón de cerrar).
    if (following && !detachedRef.current) {
      autoHide.pause(FOLLOW_PAUSE);
      scroll.current?.scrollToEnd({ animated: true });
    }
  };

  const context = (
    <StudyContext book={book.id} chapter={chapter} verse={verse} onOpen={open} onOpenMap={openMap} />
  );
  const first = turns[0];
  const retry = () => convs.retry(mode);
  // «Me ayudó», «Algo suena raro» y las preguntas que otros hicieron, cuando el estudio de todos ya está completo.
  const signals = !!first?.text && (busy ? turns.length > 1 : true) && (
    <StudySignals
      key={mode}
      pasaje={{ book: book.id, chapter, verse, word: word?.index, enfoque: mode }}
      frecuentes={settings.modo === 'general' && !word}
      colors={colors}
      onOpen={open}
      onCite={setPeek}
    />
  );
  const problem =
    error === NEEDS_CONNECTION ? (
                <View style={styles.waiting}>
                  <NeedsConnection title="Estudiar con IA necesita internet" intro="La IA prepara el estudio en el servidor. Sin conexión puedes seguir leyendo, ver el texto original y las referencias que descargaste." />
                </View>
              ) : error === NEEDS_ACCOUNT ? (
                <View style={styles.waiting}>
                  <Welcome
                    kind="ia"
                    title={mode === 'devocional' ? 'Devocional guiado' : 'Estudia con IA'}
                    intro={
                      mode === 'devocional'
                        ? 'Te ayuda a meditar el pasaje con preguntas, pistas para orar y un paso para hoy, sacados del texto. Solo necesitas una cuenta gratuita.'
                        : 'Te explica el pasaje con el texto original y las referencias, y responde tus preguntas. Solo necesitas una cuenta gratuita.'
                    }
                    onReady={retry}
                  />
                </View>
              ) : error && (
                <View style={styles.waiting}>
                  <Text style={{ color: colors.text, textAlign: 'center' }}>{error}</Text>
                  <Pressable
                    onPress={retry}
                    style={[styles.retry, { borderColor: colors.accent }]}
                  >
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Reintentar</Text>
                  </Pressable>
                </View>
              );
  const waiting = busy && !turns[turns.length - 1]?.text;

  // Las preguntas de la persona y sus respuestas, en los dos modos, bajo «Tus preguntas».
  const mine = turns.length > 1 && (
    <View style={[styles.followUps, { borderColor: colors.border }]}>
      <View style={styles.mineHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.followKicker, { color: colors.accent }]}>TUS PREGUNTAS</Text>
          <Text style={[styles.mineHint, { color: colors.muted }]}>Se guardan en este dispositivo: solo tú las ves.</Text>
        </View>
        {!busy &&
          (clearing ? (
            <View style={styles.confirm}>
              <Pressable onPress={clearMine} hitSlop={6} accessibilityRole="button" accessibilityLabel="Sí, borrar mis preguntas">
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Borrar</Text>
              </Pressable>
              <Pressable onPress={() => setClearing(false)} hitSlop={6} accessibilityRole="button">
                <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>Cancelar</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setClearing(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Borrar mis preguntas"
              style={({ pressed }) => [styles.clear, { borderColor: colors.border }, pressed && { opacity: 0.6 }]}
            >
              <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 12.5 }}>Borrar</Text>
            </Pressable>
          ))}
      </View>
      {turns.slice(1).map((turn, j) => {
        const i = j + 1;
        return turn.role === 'user' ? (
          <Appear key={i} style={[styles.question, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.text, fontSize: 15 }}>{turn.text}</Text>
          </Appear>
        ) : (
          <View key={i}>
            {turn.text ? (
              <Markdown text={turn.text} colors={colors} sources={turn.sources} onCite={setPeek} />
            ) : (
              <View style={styles.waiting}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>Buscando en las fuentes…</Text>
              </View>
            )}
            {!!turn.sources?.length && (busy ? i < turns.length - 1 : true) && (
              <Appear>
                <Sources sources={turn.sources} colors={colors} onOpen={open} />
              </Appear>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <Modal transparent animationType="slide" visible={focused} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTop} onPress={onClose} accessibilityLabel="Cerrar estudio" />
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, minHeight: 0 }}
          >
            <Animated.View
              style={
                barHeight
                  ? {
                      height: bar.interpolate({ inputRange: [0, 1], outputRange: [barHeight, 0] }),
                      opacity: bar.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' }),
                      overflow: 'hidden',
                    }
                  : undefined
              }
            >
              <View onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
                <View style={[styles.header, { borderColor: colors.border }, !word && { borderBottomWidth: 0, paddingBottom: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <IconText icon={!word && mode === 'devocional' ? HeartIcon : SparkIcon} color={colors.accent} size={13}>
                      <Text style={[styles.kicker, { color: colors.accent }]}>
                        {word ? '¿POR QUÉ ESTA PALABRA?' : mode === 'devocional' ? 'DEVOCIONAL' : 'ESTUDIO PROFUNDO'}
                      </Text>
                    </IconText>
                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                  </View>
                  <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar estudio">
                    <CloseIcon color={colors.muted} size={22} />
                  </Pressable>
                </View>
                {!word && <ModeSwitch mode={mode} onChange={switchMode} colors={colors} />}
              </View>
            </Animated.View>

            <View style={{ flex: 1, minHeight: 0 }}>
            <ScrollView
              ref={scroll}
              style={{ flex: 1, minHeight: 0 }}
              contentContainerStyle={styles.body}
              scrollEventThrottle={16}
              onLayout={(e) => (viewHeight.current = e.nativeEvent.layout.height)}
              onTouchStart={grab}
              onScrollBeginDrag={grab}
              {...(Platform.OS === 'web' ? ({ onWheel: grab } as object) : null)}
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                // Subir con la barra o el teclado también suelta el seguimiento: la app solo baja.
                if (following && y < scrollY.current - 2) setDetach(true);
                scrollY.current = y;
                if (following && !detachedRef.current) autoHide.pause(FOLLOW_PAUSE);
                autoHide.onScroll(e);
              }}
              onContentSizeChange={onContentSizeChange}
            >
              {mode === 'devocional' ? (
                <Devotional
                  key={`${book.id}.${chapter}.${verse}`}
                  book={book}
                  chapter={chapter}
                  verse={verse}
                  text={first?.text ?? ''}
                  sources={first?.sources ?? []}
                  busy={busy && turns.length <= 1}
                  problem={turns.length <= 1 ? problem : null}
                  onOpen={open}
                  onCite={setPeek}
                  onStep={() => scroll.current?.scrollTo({ y: 0, animated: true })}
                />
              ) : null}
              {mode === 'devocional' && signals}
              {mode === 'devocional' && mine}
              {mode === 'devocional' && turns.length > 1 && problem}
              {mode === 'devocional' ? null : (
              <>
              {!word && (
                <StudyBackground book={book.id} bookName={book.name} chapter={chapter} verse={verse} />
              )}
              {first?.text ? (
                <View>
                  <Markdown text={first.text} colors={colors} ornate sources={first.sources} onCite={setPeek} />
                  {!!first.sources?.length && (busy ? turns.length > 1 : true) && (
                    <Appear>
                      <Sources sources={first.sources} colors={colors} onOpen={open} />
                    </Appear>
                  )}
                  {(busy ? turns.length > 1 : true) && context}
                  {signals}
                </View>
              ) : null}

              {waiting && turns.length <= 1 && (
                <View style={styles.waiting}>
                  <ActivityIndicator color={colors.accent} />
                  <Text
                    style={{
                      color: colors.muted,
                      marginTop: 10,
                      textAlign: 'center',
                    }}
                  >
                    {word
                      ? `Comparando el ${original(book).name} con la traducción y buscando dónde más aparece…`
                      : `Preparando el estudio con el texto, el ${original(book).name} y las referencias…`}
                  </Text>
                </View>
              )}

              {mine}

              {problem}

              {error && !first?.text && context}

              {first?.text && !busy && turns.length === 1 && (
                <View style={styles.suggestions}>
                  {(word ? WORD_SUGGESTIONS : SUGGESTIONS).map((s) => (
                    <Pressable key={s} onPress={() => ask(s)} style={[styles.chip, { borderColor: colors.border }]}>
                      <Text style={{ color: colors.text, fontSize: 13 }}>{s}</Text>
                    </Pressable>
                  ))}
                  {!word && (
                    <Pressable
                      onPress={() => switchMode('devocional')}
                      style={[styles.chip, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}
                    >
                      <IconText icon={HeartIcon} color={colors.accent} size={14}>
                        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Hacer el devocional de este pasaje</Text>
                      </IconText>
                    </Pressable>
                  )}
                </View>
              )}
              </>
              )}

              {mode === 'profundo' && (
              <Text style={[styles.disclaimer, { color: colors.muted }]}>
                Generado con IA solo a partir de la Reina-Valera 1909, el {original(book).name} de STEPBible y las referencias de
                OpenBible.info. Toca los números para ver de dónde sale cada idea.
              </Text>
              )}
            </ScrollView>
            {following && detached && (
              <Appear style={styles.toEndWrap}>
                <Pressable
                  onPress={toEnd}
                  style={({ pressed }) => [
                    styles.toEnd,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Ir al final de la respuesta"
                >
                  <ArrowDownIcon color={colors.background} size={14} />
                  <Text style={[styles.toEndText, { color: colors.background }]}>Ir al final</Text>
                </Pressable>
              </Appear>
            )}
            </View>

            {peek && <SourcePeek source={peek} colors={colors} onOpen={open} onClose={() => setPeek(null)} />}

            {settings.modo === 'general' && !!first?.text && turns.length <= 1 && (
              <View style={[styles.shareRow, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                <Text style={[styles.shareText, { color: colors.muted }]}>
                  {settings.compartirPreguntas
                    ? 'Tus preguntas pueden ayudar a otros a estudiar este pasaje: se guardan limpias y sin tu nombre.'
                    : 'Tus preguntas no se comparten.'}
                </Text>
                <Pressable
                  onPress={() => update({ compartirPreguntas: !settings.compartirPreguntas })}
                  hitSlop={8}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: settings.compartirPreguntas }}
                >
                  <Text style={[styles.shareText, { color: colors.accent, fontWeight: '700' }]}>
                    {settings.compartirPreguntas ? 'No compartir' : 'Compartir'}
                  </Text>
                </Pressable>
              </View>
            )}

            {(mode === 'profundo' || !!first?.text) && (
              <AskBar
                value={question}
                onChange={setQuestion}
                onSend={() => ask(question)}
                placeholder={
                  word
                    ? `Pregunta sobre ${word.greek}`
                    : mode === 'devocional'
                      ? `¿Algo que no entiendas de ${title}?`
                      : `Pregunta sobre ${title}`
                }
                busy={busy}
                onStop={turns.length > 1 ? () => convs.stop(mode) : undefined}
                disabled={!first?.text}
                colors={colors}
              />
            )}
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const MODES: { value: Enfoque; icon: (p: IconProps) => ReactNode; label: string; hint: string }[] = [
  { value: 'devocional', icon: HeartIcon, label: 'Devocional', hint: 'Lee, medita, vive y ora · unos 10 minutos' },
  { value: 'profundo', icon: SparkIcon, label: 'Profundo', hint: 'Texto original, contexto y pasajes relacionados' },
];

/** Selector entre el devocional guiado y el estudio profundo: una píldora con el modo activo resaltado. */
function ModeSwitch({ mode, onChange, colors }: { mode: Enfoque; onChange: (m: Enfoque) => void; colors: Colors }) {
  return (
    <View style={[styles.modeWrap, { borderColor: colors.border }]}>
      <View style={[styles.modes, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="tablist">
        {MODES.map((m) => {
          const on = m.value === mode;
          return (
            <Pressable
              key={m.value}
              onPress={() => onChange(m.value)}
              style={({ pressed }) => [styles.mode, on && { backgroundColor: colors.accent }, pressed && !on && { opacity: 0.6 }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${m.label}: ${m.hint}`}
            >
              <IconText icon={m.icon} color={on ? colors.surface : colors.text} size={15}>
                <Text style={[styles.modeLabel, { color: on ? colors.surface : colors.text }]} numberOfLines={1}>
                  {m.label}
                </Text>
              </IconText>
            </Pressable>
          );
        })}
      </View>
      {/* El devocional ya muestra su paso y su tiempo; el profundo dice qué trae. */}
      {mode === 'profundo' && <Text style={[styles.modeHint, { color: colors.muted }]}>{MODES[1].hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  toEndWrap: { position: 'absolute', bottom: 12, left: 0, right: 0, alignItems: 'center' },
  toEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  toEndText: { fontSize: 13, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  backdropTop: { height: '6%', minHeight: 32 },
  sheet: {
    flex: 1,
    minHeight: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modeWrap: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  modes: { flexDirection: 'row', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 3, gap: 3 },
  mode: { flex: 1, borderRadius: 19, paddingVertical: 9, alignItems: 'center' },
  modeLabel: { fontSize: 14, fontWeight: '700' },
  modeHint: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 22, fontFamily: serif, marginTop: 2 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  question: {
    alignSelf: 'flex-end',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 20,
    maxWidth: '85%',
  },
  waiting: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  followUps: { marginTop: 28, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth },
  followKicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  mineHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  mineHint: { fontSize: 12, marginTop: 2 },
  clear: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  confirm: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  retry: {
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  shareText: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 24,
    textAlign: 'center',
  },
});
