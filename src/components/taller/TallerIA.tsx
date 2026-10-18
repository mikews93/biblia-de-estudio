import { router } from 'expo-router';
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

import { Markdown, Sources } from '@/components/StudyPanel';
import { parseRef } from '@/lib/data';
import { TallerRequest, Turn, askStudy } from '@/lib/estudio';
import { verseHref } from '@/lib/routes';
import { Mensaje, borradorParaIA, plantilla } from '@/lib/taller';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export type Modo = TallerRequest['modo'];
export type Paso = TallerRequest['paso'];

const MODOS: { modo: Modo; label: string; hint: string }[] = [
  { modo: 'preguntar', label: 'Pregúntame', hint: 'Preguntas para que lo pienses tú' },
  { modo: 'sugerir', label: 'Sugiéreme', hint: 'Opciones para elegir y escribir con tus palabras' },
  { modo: 'revisar', label: 'Revisa', hint: 'Qué funciona y qué mejorar' },
];

type Props = { mensaje: Mensaje; paso: Paso; modo: Modo; title: string; onClose: () => void };

/** La IA del Taller: pregunta, sugiere o revisa con citas de las fuentes de la app. Nunca escribe el mensaje. */
export default function TallerIA({ mensaje, paso, modo: initialModo, title, onClose }: Props) {
  const colors = useColors();
  const [modo, setModo] = useState<Modo>(initialModo);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const abort = useRef<AbortController | null>(null);
  const lastHistory = useRef<Turn[]>([]);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const p = mensaje.pasaje!;
  const single = p.from && !p.to ? p.from : undefined;

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
        {
          book: p.book,
          chapter: p.chapter,
          verse: single,
          messages: history,
          taller: {
            modo,
            paso,
            tipo: mensaje.tipo,
            plantilla: plantilla(mensaje.plantilla)?.nombre,
            desde: single ? undefined : p.from,
            hasta: single ? undefined : p.to,
            borrador: borradorParaIA(mensaje),
          },
        },
        (text, sources) => setTurns([...history, { role: 'assistant', text, sources }]),
        controller.signal,
      );
      setTurns([...history, { role: 'assistant', ...answer }]);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'No se pudo consultar a la IA.');
      setTurns((t) => (t[t.length - 1]?.text ? t : history));
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };

  useEffect(() => {
    run([]);
    return () => abort.current?.abort();
    // El borrador se lee al abrir o al cambiar de modo, no en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

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

  const waiting = busy && !turns[turns.length - 1]?.text;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTop} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, minHeight: 0 }}>
            <View style={[styles.header, { borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kicker, { color: colors.accent }]}>✦ ACOMPAÑANTE</Text>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
                <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>
            <View style={[styles.modes, { borderColor: colors.border }]}>
              {MODOS.map((m) => {
                const on = m.modo === modo;
                return (
                  <Pressable
                    key={m.modo}
                    onPress={() => !busy && setModo(m.modo)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityHint={m.hint}
                    style={[styles.mode, { borderColor: on ? colors.accent : colors.border }, on && { backgroundColor: colors.accentSoft }]}
                  >
                    <Text style={{ color: on ? colors.accent : colors.text, fontWeight: '700', fontSize: 14 }}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView
              ref={scroll}
              style={{ flex: 1, minHeight: 0 }}
              contentContainerStyle={styles.body}
              onContentSizeChange={() => turns.length > 1 && scroll.current?.scrollToEnd({ animated: true })}
            >
              {turns.map((turn, i) =>
                turn.role === 'user' ? (
                  <View key={i} style={[styles.question, { backgroundColor: colors.accentSoft }]}>
                    <Text style={{ color: colors.text, fontSize: 15 }}>{turn.text}</Text>
                  </View>
                ) : (
                  <View key={i}>
                    {turn.text ? <Markdown text={turn.text} colors={colors} /> : null}
                    {!!turn.sources?.length && (!busy || i < turns.length - 1) && (
                      <Sources sources={turn.sources} colors={colors} onOpen={open} />
                    )}
                  </View>
                ),
              )}
              {waiting && (
                <View style={styles.waiting}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>Leyendo el pasaje y tu borrador…</Text>
                </View>
              )}
              {error && (
                <View style={styles.waiting}>
                  <Text style={{ color: colors.text, textAlign: 'center' }}>{error}</Text>
                  <Pressable onPress={() => run(lastHistory.current)} style={[styles.retry, { borderColor: colors.accent }]}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Reintentar</Text>
                  </Pressable>
                </View>
              )}
              <Text style={[styles.disclaimer, { color: colors.muted }]}>
                La IA pregunta y sugiere a partir de la Reina-Valera 1909, el griego de STEPBible y las referencias de
                OpenBible.info, pero no escribe tu mensaje: la preparación y la oración son tuyas.
              </Text>
            </ScrollView>

            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                onSubmitEditing={() => ask(question)}
                placeholder="Responde o pregunta algo más"
                placeholderTextColor={colors.muted}
                maxLength={600}
                editable={!busy && !!turns[0]?.text}
                returnKeyType="send"
                style={[styles.input, { color: colors.text }]}
              />
              <Pressable
                onPress={() => ask(question)}
                disabled={busy || !question.trim()}
                accessibilityLabel="Enviar"
                style={[styles.send, { backgroundColor: busy || !question.trim() ? colors.border : colors.accent }]}
              >
                <Text style={{ color: colors.surface, fontSize: 18, fontWeight: '700' }}>↑</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 22, fontFamily: serif, marginTop: 2 },
  modes: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  mode: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 10 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  question: { alignSelf: 'flex-end', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginTop: 20, maxWidth: '85%' },
  waiting: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  retry: { marginTop: 12, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  disclaimer: { fontSize: 12, lineHeight: 17, marginTop: 24, textAlign: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 8, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
