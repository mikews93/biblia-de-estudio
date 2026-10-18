import { router } from 'expo-router';
import { ComponentRef, ReactNode, useEffect, useRef, useState } from 'react';
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
import { Book, parseRef } from '@/lib/data';
import { Source, Turn, askStudy } from '@/lib/estudio';
import { Colors, serif, useColors } from '@/lib/theme';
import { verseHref } from '@/lib/routes';
import { navigate } from '@/lib/transition';

type Props = {
  book: Book;
  chapter: number;
  verse?: number;
  onClose: () => void;
};

const SUGGESTIONS = ['Explícamelo más sencillo', '¿Cómo lo aplico hoy?', '¿Qué aportan los pasajes relacionados?'];

/** Estudio generado con IA a partir de las fuentes de la app, con citas y preguntas de seguimiento. */
export default function StudyPanel({ book, chapter, verse, onClose }: Props) {
  const colors = useColors();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const abort = useRef<AbortController | null>(null);
  const lastHistory = useRef<Turn[]>([]);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const title = verse ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`;

  const run = async (history: Turn[]) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    lastHistory.current = history;
    setBusy(true);
    setError(null);
    setTurns([...history, { role: 'assistant', text: '', sources: [] }]);
    try {
      const answer = await askStudy(
        { book: book.id, chapter, verse, messages: history },
        (text, sources) => setTurns([...history, { role: 'assistant', text, sources }]),
        controller.signal,
      );
      setTurns([...history, { role: 'assistant', ...answer }]);
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
    run([]);
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, chapter, verse]);

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

  const first = turns[0];
  const waiting = busy && !turns[turns.length - 1]?.text;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTop} onPress={onClose} accessibilityLabel="Cerrar estudio" />
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, minHeight: 0 }}
          >
            <View style={[styles.header, { borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kicker, { color: colors.accent }]}>✦ ESTUDIO</Text>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar estudio">
                <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              ref={scroll}
              style={{ flex: 1, minHeight: 0 }}
              contentContainerStyle={styles.body}
              onContentSizeChange={() => turns.length > 1 && scroll.current?.scrollToEnd({ animated: true })}
            >
              {turns.map((turn, i) =>
                turn.role === 'user' ? (
                  <Appear key={i} style={[styles.question, { backgroundColor: colors.accentSoft }]}>
                    <Text style={{ color: colors.text, fontSize: 15 }}>{turn.text}</Text>
                  </Appear>
                ) : (
                  <View key={i}>
                    {turn.text ? <Markdown text={turn.text} colors={colors} /> : null}
                    {!!turn.sources?.length && (busy ? i < turns.length - 1 : true) && (
                      <Appear>
                        <Sources sources={turn.sources} colors={colors} onOpen={open} />
                      </Appear>
                    )}
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
                      : 'Preparando el estudio con el texto, el griego y las referencias…'}
                  </Text>
                </View>
              )}

              {error && (
                <View style={styles.waiting}>
                  <Text style={{ color: colors.text, textAlign: 'center' }}>{error}</Text>
                  <Pressable
                    onPress={() => run(lastHistory.current)}
                    style={[styles.retry, { borderColor: colors.accent }]}
                  >
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Reintentar</Text>
                  </Pressable>
                </View>
              )}

              {first?.text && !busy && turns.length === 1 && (
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <Pressable key={s} onPress={() => ask(s)} style={[styles.chip, { borderColor: colors.border }]}>
                      <Text style={{ color: colors.text, fontSize: 13 }}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={[styles.disclaimer, { color: colors.muted }]}>
                Generado con IA solo a partir de la Reina-Valera 1909, el griego de STEPBible y las referencias de
                OpenBible.info. Toca los números para ver de dónde sale cada idea.
              </Text>
            </ScrollView>

            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                onSubmitEditing={() => ask(question)}
                placeholder={`Pregunta sobre ${title}`}
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
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

export function Sources({ sources, colors, onOpen }: { sources: Source[]; colors: Colors; onOpen: (ref: string) => void }) {
  return (
    <View style={[styles.sources, { borderColor: colors.border }]}>
      <Text style={[styles.sourcesTitle, { color: colors.muted }]}>FUENTES</Text>
      {sources.map((s) => (
        <Pressable key={s.n} onPress={() => s.ref && onOpen(s.ref)} style={styles.sourceRow} disabled={!s.ref}>
          <Text style={[styles.sourceNumber, { color: colors.accent }]}>{s.n}</Text>
          <Text style={{ color: colors.text, flex: 1 }}>{s.label}</Text>
          {s.ref && <Text style={{ color: colors.muted }}>›</Text>}
        </Pressable>
      ))}
    </View>
  );
}

/** Markdown mínimo: títulos ##, listas con -, **negritas** y marcas de cita ⟦n⟧. */
export function Markdown({ text, colors }: { text: string; colors: Colors }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <View>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (!lines.length) return null;
        if (lines.length === 1 && /^#{1,3} /.test(lines[0])) {
          return (
            <Text key={i} style={[styles.h2, { color: colors.text }]}>
              {inline(lines[0].replace(/^#{1,3} /, ''), colors)}
            </Text>
          );
        }
        return lines.map((line, j) => {
          if (/^#{1,3} /.test(line)) {
            return (
              <Text key={`${i}-${j}`} style={[styles.h2, { color: colors.text }]}>
                {inline(line.replace(/^#{1,3} /, ''), colors)}
              </Text>
            );
          }
          const bullet = /^\s*[-*] /.test(line);
          return (
            <View key={`${i}-${j}`} style={bullet ? styles.bulletRow : undefined}>
              {bullet && <Text style={[styles.p, { color: colors.accent, width: 16 }]}>•</Text>}
              <Text style={[styles.p, { color: colors.text, flex: bullet ? 1 : undefined }]}>
                {inline(line.replace(/^\s*[-*] /, ''), colors)}
              </Text>
            </View>
          );
        });
      })}
    </View>
  );
}

function inline(text: string, colors: Colors): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|⟦\d+⟧)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    const cite = part.match(/^⟦(\d+)⟧$/);
    if (cite) {
      return (
        <Text key={i} style={[styles.cite, { color: colors.accent }]}>
          {' '}
          {cite[1]}
        </Text>
      );
    }
    return part;
  });
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
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 22, fontFamily: serif, marginTop: 2 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  h2: {
    fontSize: 19,
    fontFamily: serif,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 6,
  },
  p: { fontSize: 16, lineHeight: 25, marginBottom: 8 },
  bulletRow: { flexDirection: 'row' },
  cite: { fontSize: 11, fontWeight: '700', lineHeight: 16 },
  question: {
    alignSelf: 'flex-end',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 20,
    maxWidth: '85%',
  },
  waiting: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  retry: {
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  sources: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 10,
  },
  sourcesTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  sourceNumber: { fontWeight: '700', width: 20, textAlign: 'right' },
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
