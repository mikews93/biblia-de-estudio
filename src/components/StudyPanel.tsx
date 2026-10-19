import { router, useIsFocused } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Appear from '@/components/Appear';
import Devotional from '@/components/Devotional';
import StudyContext from '@/components/StudyContext';
import { Book, original, parseRef } from '@/lib/data';
import Welcome from '@/components/comunidad/Welcome';
import { NeedsConnection } from '@/components/SinConexion';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { NEEDS_CONNECTION } from '@/lib/conexion';
import { Enfoque, Turn, askStudy } from '@/lib/estudio';
import { Colors, serif, useColors, useSettings } from '@/lib/theme';
import { BOOK_SLUGS, verseHref } from '@/lib/routes';
import { navigate } from '@/lib/transition';
import StudyBackground from '@/components/StudyBackground';
import { Markdown, Sources } from '@/components/StudyText';

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

/** Estudio generado con IA a partir de las fuentes de la app, con citas y preguntas de seguimiento. */
export default function StudyPanel({ book, chapter, verse, word, onClose, enfoque: initial }: Props) {
  const colors = useColors();
  const { settings, update } = useSettings();
  // «¿Por qué esta palabra?» siempre es estudio profundo.
  const [chosen, setChosen] = useState<Enfoque>(initial ?? settings.enfoque);
  const mode: Enfoque = word ? 'profundo' : chosen;
  // Al ir a /entrar o /registro desde aquí, la ventana se oculta para no tapar esa pantalla y vuelve al regresar.
  const focused = useIsFocused();
  const [turns, setTurns] = useState<Turn[]>([]);
  // Lo ya generado en cada modo, para cambiar de uno a otro sin volver a pedirlo.
  const saved = useRef<Partial<Record<Enfoque, Turn[]>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const abort = useRef<AbortController | null>(null);
  const lastHistory = useRef<Turn[]>([]);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const passage = verse ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`;
  const title = word ? `${word.greek} en ${passage}` : passage;

  const run = async (history: Turn[], enfoque: Enfoque = mode) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    lastHistory.current = history;
    setBusy(true);
    setError(null);
    setTurns([...history, { role: 'assistant', text: '', sources: [] }]);
    try {
      const answer = await askStudy(
        { book: book.id, chapter, verse, word: word?.index, messages: history, enfoque },
        (text, sources) => setTurns([...history, { role: 'assistant', text, sources }]),
        controller.signal,
      );
      const done: Turn[] = [...history, { role: 'assistant', ...answer }];
      saved.current[enfoque] = done;
      setTurns(done);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'No se pudo generar el estudio.');
      // Si falló sin escribir nada, se quita la respuesta vacía para poder reintentar.
      setTurns((t) => (t[t.length - 1]?.text ? t : history));
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };

  useEffect(() => {
    saved.current = {};
    run([]);
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, chapter, verse, word?.index]);

  const switchMode = (next: Enfoque) => {
    if (next === mode) return;
    setChosen(next);
    update({ enfoque: next });
    setError(null);
    const cached = saved.current[next];
    if (cached) {
      abort.current?.abort();
      setBusy(false);
      setTurns(cached);
    } else run([], next);
  };

  const ask = (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion('');
    run([...turns, { role: 'user', text }]);
  };

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    onClose();
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  const openMap = () => {
    onClose();
    navigate(() => router.push(`/mapa/${BOOK_SLUGS[book.id] ?? book.id}/${chapter}` as never), 'forward');
  };

  const context = (
    <StudyContext book={book.id} chapter={chapter} verse={verse} onOpen={open} onOpenMap={openMap} />
  );
  const first = turns[0];
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
                    onReady={() => run(lastHistory.current)}
                  />
                </View>
              ) : error && (
                <View style={styles.waiting}>
                  <Text style={{ color: colors.text, textAlign: 'center' }}>{error}</Text>
                  <Pressable
                    onPress={() => run(lastHistory.current)}
                    style={[styles.retry, { borderColor: colors.accent }]}
                  >
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Reintentar</Text>
                  </Pressable>
                </View>
              );
  const waiting = busy && !turns[turns.length - 1]?.text;

  return (
    <Modal transparent animationType="slide" visible={focused} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTop} onPress={onClose} accessibilityLabel="Cerrar estudio" />
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, minHeight: 0 }}
          >
            <View style={[styles.header, { borderColor: colors.border }, !word && { borderBottomWidth: 0, paddingBottom: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kicker, { color: colors.accent }]}>
                  {word ? '✦ ¿POR QUÉ ESTA PALABRA?' : mode === 'devocional' ? '♡ DEVOCIONAL' : '✦ ESTUDIO PROFUNDO'}
                </Text>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar estudio">
                <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>
            {!word && <ModeSwitch mode={mode} onChange={switchMode} colors={colors} />}

            <ScrollView
              ref={scroll}
              style={{ flex: 1, minHeight: 0 }}
              contentContainerStyle={styles.body}
              onContentSizeChange={() => turns.length > 1 && (mode === 'profundo' || busy) && scroll.current?.scrollToEnd({ animated: true })}
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
                  onClose={onClose}
                  onStep={() => scroll.current?.scrollTo({ y: 0, animated: true })}
                />
              ) : null}
              {mode === 'devocional' && turns.length > 1 && (
                <View style={[styles.followUps, { borderColor: colors.border }]}>
                  <Text style={[styles.followKicker, { color: colors.accent }]}>TUS PREGUNTAS</Text>
                  {turns.slice(1).map((turn, i) =>
                    turn.role === 'user' ? (
                      <Appear key={i} style={[styles.question, { backgroundColor: colors.accentSoft }]}>
                        <Text style={{ color: colors.text, fontSize: 15 }}>{turn.text}</Text>
                      </Appear>
                    ) : (
                      <View key={i}>
                        {turn.text ? (
                          <Markdown text={turn.text} colors={colors} />
                        ) : (
                          <View style={styles.waiting}>
                            <ActivityIndicator color={colors.accent} />
                          </View>
                        )}
                        {!!turn.sources?.length && (busy ? i < turns.length - 2 : true) && (
                          <Sources sources={turn.sources} colors={colors} onOpen={open} />
                        )}
                      </View>
                    ),
                  )}
                </View>
              )}
              {mode === 'devocional' && turns.length > 1 && problem}
              {mode === 'devocional' ? null : (
              <>
              {!word && (
                <StudyBackground book={book.id} bookName={book.name} chapter={chapter} verse={verse} onClose={onClose} />
              )}
              {turns.map((turn, i) =>
                turn.role === 'user' ? (
                  <Appear key={i} style={[styles.question, { backgroundColor: colors.accentSoft }]}>
                    <Text style={{ color: colors.text, fontSize: 15 }}>{turn.text}</Text>
                  </Appear>
                ) : (
                  <View key={i}>
                    {turn.text ? <Markdown text={turn.text} colors={colors} ornate /> : null}
                    {!!turn.sources?.length && (busy ? i < turns.length - 1 : true) && (
                      <Appear>
                        <Sources sources={turn.sources} colors={colors} onOpen={open} />
                      </Appear>
                    )}
                    {i === 0 && turn.text && (busy ? turns.length > 1 : true) && context}
                  </View>
                ),
              )}

              {waiting && (
                <View style={styles.waiting}>
                  <ActivityIndicator color={colors.accent} />
                  <Text
                    style={{
                      color: colors.muted,
                      marginTop: 10,
                      textAlign: 'center',
                    }}
                  >
                    {turns.length > 1
                      ? 'Buscando en las fuentes…'
                      : word
                        ? `Comparando el ${original(book).name} con la traducción y buscando dónde más aparece…`
                        : `Preparando el estudio con el texto, el ${original(book).name} y las referencias…`}
                  </Text>
                </View>
              )}

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
                      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>♡ Hacer el devocional de este pasaje</Text>
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

            {(mode === 'profundo' || !!first?.text) && (
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                onSubmitEditing={() => ask(question)}
                placeholder={
                  word
                    ? `Pregunta sobre ${word.greek}`
                    : mode === 'devocional'
                      ? `¿Algo que no entiendas de ${title}?`
                      : `Pregunta sobre ${title}`
                }
                placeholderTextColor={colors.muted}
                maxLength={600}
                editable={!busy && !!first?.text}
                returnKeyType="send"
                style={[styles.input, { color: colors.text }]}
              />
              <Pressable
                onPress={() => ask(question)}
                disabled={busy || !question.trim()}
                accessibilityLabel="Enviar pregunta"
                style={[
                  styles.send,
                  {
                    backgroundColor: busy || !question.trim() ? colors.border : colors.accent,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.surface,
                    fontSize: 18,
                    fontWeight: '700',
                  }}
                >
                  ↑
                </Text>
              </Pressable>
            </View>
            )}
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const MODES: { value: Enfoque; icon: string; label: string; hint: string }[] = [
  { value: 'devocional', icon: '♡', label: 'Devocional', hint: 'Lee, medita, vive y ora · unos 10 minutos' },
  { value: 'profundo', icon: '✦', label: 'Profundo', hint: 'Texto original, contexto y pasajes relacionados' },
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
              <Text style={[styles.modeLabel, { color: on ? colors.surface : colors.text }]} numberOfLines={1}>
                <Text style={{ fontFamily: serif }}>{m.icon}</Text>  {m.label}
              </Text>
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
  followKicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
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
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 24,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 8, paddingVertical: 8 },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
