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
  View,
} from 'react-native';

import { IconText } from '@/components/comunidad/ui';
import { CloseIcon, SparkIcon } from '@/components/icons';
import AskBar from '@/components/AskBar';
import { Markdown, SourcePeek, Sources } from '@/components/StudyText';
import { parseRef } from '@/lib/data';
import Welcome from '@/components/comunidad/Welcome';
import { NeedsConnection } from '@/components/SinConexion';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { NEEDS_CONNECTION } from '@/lib/conexion';
import { useConversations } from '@/lib/conversaciones';
import { Source, TallerRequest, askStudy } from '@/lib/estudio';
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
  // Al ir a /entrar o /registro desde aquí, la ventana se oculta para no tapar esa pantalla y vuelve al regresar.
  const focused = useIsFocused();
  const [modo, setModo] = useState<Modo>(initialModo);
  const [question, setQuestion] = useState('');
  const [peek, setPeek] = useState<Source | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const p = mensaje.pasaje!;
  const single = p.from && !p.to ? p.from : undefined;

  // Una conversación por modo: cambiar de pestaña no la vuelve a pedir ni detiene la que se está escribiendo.
  const convs = useConversations<Modo>((m, history, onUpdate, signal) =>
    askStudy(
      {
        book: p.book,
        chapter: p.chapter,
        verse: single,
        messages: history,
        taller: {
          modo: m,
          paso,
          tipo: mensaje.tipo,
          plantilla: plantilla(mensaje.plantilla)?.nombre,
          desde: single ? undefined : p.from,
          hasta: single ? undefined : p.to,
          // El borrador se lee al abrir cada modo y en cada pregunta, no en cada tecla.
          borrador: borradorParaIA(mensaje),
        },
      },
      onUpdate,
      signal,
    ),
  );
  const { turns, busy, error } = convs.get(modo);
  const retry = () => convs.retry(modo);

  useEffect(() => {
    if (!convs.started(modo)) convs.run(modo, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  const ask = (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion('');
    setPeek(null);
    convs.run(modo, [...turns, { role: 'user', text }]);
  };

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    onClose();
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  const waiting = busy && !turns[turns.length - 1]?.text;

  return (
    <Modal transparent animationType="slide" visible={focused} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTop} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, minHeight: 0 }}>
            <View style={[styles.header, { borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <IconText icon={SparkIcon} color={colors.accent} size={13}>
                  <Text style={[styles.kicker, { color: colors.accent }]}>ACOMPAÑANTE</Text>
                </IconText>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
                <CloseIcon color={colors.muted} size={22} />
              </Pressable>
            </View>
            <View style={[styles.modes, { borderColor: colors.border }]}>
              {MODOS.map((m) => {
                const on = m.modo === modo;
                return (
                  <Pressable
                    key={m.modo}
                    onPress={() => {
                      setModo(m.modo);
                      setPeek(null);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityHint={m.hint}
                    style={[styles.mode, { borderColor: on ? colors.accent : colors.border }, on && { backgroundColor: colors.accentSoft }]}
                  >
                    <Text style={{ color: on ? colors.accent : colors.text, fontWeight: '700', fontSize: 14 }}>{m.label}</Text>
                    {/* Otra pestaña que sigue escribiendo mientras se mira esta */}
                    {!on && convs.get(m.modo).busy && <View style={[styles.writing, { backgroundColor: colors.accent }]} />}
                  </Pressable>
                );
              })}
            </View>

            <ScrollView
              ref={scroll}
              style={{ flex: 1, minHeight: 0 }}
              contentContainerStyle={styles.body}
              onContentSizeChange={() => busy && turns.length > 1 && scroll.current?.scrollToEnd({ animated: true })}
            >
              {turns.map((turn, i) =>
                turn.role === 'user' ? (
                  <View key={i} style={[styles.question, { backgroundColor: colors.accentSoft }]}>
                    <Text style={{ color: colors.text, fontSize: 15 }}>{turn.text}</Text>
                  </View>
                ) : (
                  <View key={i}>
                    {turn.text ? <Markdown text={turn.text} colors={colors} sources={turn.sources} onCite={setPeek} /> : null}
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
              {error === NEEDS_CONNECTION ? (
                <View style={styles.waiting}>
                  <NeedsConnection title="La IA necesita internet" intro="Tu borrador queda guardado en este dispositivo. Cuando vuelvas a tener conexión, la IA te hará preguntas y sugerencias." />
                </View>
              ) : error === NEEDS_ACCOUNT ? (
                <View style={styles.waiting}>
                  <Welcome kind="ia" title="Prepara con IA" intro="Te hace preguntas y te sugiere ideas a partir del pasaje; el mensaje lo escribes tú. Solo necesitas una cuenta gratuita." onReady={retry} />
                </View>
              ) : error && (
                <View style={styles.waiting}>
                  <Text style={{ color: colors.text, textAlign: 'center' }}>{error}</Text>
                  <Pressable onPress={retry} style={[styles.retry, { borderColor: colors.accent }]}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Reintentar</Text>
                  </Pressable>
                </View>
              )}
              <Text style={[styles.disclaimer, { color: colors.muted }]}>
                La IA pregunta y sugiere a partir de la Reina-Valera 1909, el hebreo y el griego de STEPBible y las referencias de
                OpenBible.info, pero no escribe tu mensaje: la preparación y la oración son tuyas.
              </Text>
            </ScrollView>

            {peek && <SourcePeek source={peek} colors={colors} onOpen={open} onClose={() => setPeek(null)} />}

            <AskBar
              value={question}
              onChange={setQuestion}
              onSend={() => ask(question)}
              placeholder="Responde o pregunta algo más"
              busy={busy}
              onStop={turns.length > 1 ? () => convs.stop(modo) : undefined}
              disabled={!turns[0]?.text}
              sendLabel="Enviar"
              colors={colors}
            />
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
  mode: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 10 },
  writing: { width: 6, height: 6, borderRadius: 3 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  question: { alignSelf: 'flex-end', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginTop: 20, maxWidth: '85%' },
  waiting: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  retry: { marginTop: 12, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  disclaimer: { fontSize: 12, lineHeight: 17, marginTop: 24, textAlign: 'center' },
});
