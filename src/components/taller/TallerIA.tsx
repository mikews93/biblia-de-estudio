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
import { CloseIcon, RefreshIcon, SparkIcon } from '@/components/icons';
import AskBar from '@/components/AskBar';
import Investigacion from '@/components/Investigacion';
import { Markdown, SourcePeek, Sources } from '@/components/StudyText';
import { parseRef } from '@/lib/data';
import Welcome from '@/components/comunidad/Welcome';
import { NeedsConnection } from '@/components/SinConexion';
import Correcciones from '@/components/taller/Correcciones';
import Sugerencias from '@/components/taller/Sugerencias';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { NEEDS_CONNECTION } from '@/lib/conexion';
import { paraGuardar, useConversations } from '@/lib/conversaciones';
import { Source, TallerRequest, Turn, askStudy } from '@/lib/estudio';
import { verseHref } from '@/lib/routes';
import { borradorParaCorregir } from '@/lib/correcciones';
import { Mensaje, borradorParaIA, plantilla } from '@/lib/taller';
import { guardarTallerIa, leerTallerIa } from '@/lib/tallerIa';
import { serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import CitasRevisadas from '@/components/CitasRevisadas';

export type Modo = TallerRequest['modo'];
export type Paso = TallerRequest['paso'];

const MODOS: { modo: Modo; label: string; hint: string }[] = [
  { modo: 'preguntar', label: 'Pregúntame', hint: 'Preguntas para que lo pienses tú' },
  { modo: 'sugerir', label: 'Sugiéreme', hint: 'Opciones para llevar a tu borrador y terminar con tus palabras' },
  { modo: 'revisar', label: 'Revisa', hint: 'Qué funciona y qué mejorar' },
];

type Props = { mensaje: Mensaje; paso: Paso; modo: Modo; title: string; onClose: () => void };

/** La IA del Taller: pregunta, sugiere o revisa con citas de las fuentes de la app. Nunca escribe el mensaje. */
export default function TallerIA({ mensaje, paso, modo: initialModo, title, onClose }: Props) {
  const colors = useColors();
  const { settings } = useSettings();
  // Al ir a /entrar o /registro desde aquí, la ventana se oculta para no tapar esa pantalla y vuelve al regresar.
  const focused = useIsFocused();
  const [modo, setModo] = useState<Modo>(initialModo);
  const [question, setQuestion] = useState('');
  const [peek, setPeek] = useState<Source | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const p = mensaje.pasaje!;
  const single = p.from && !p.to ? p.from : undefined;

  // Una conversación por modo: cambiar de pestaña no la vuelve a pedir ni detiene la que se está escribiendo.
  // Lo que dijo Revisa, para que las correcciones lo apliquen.
  const revision = useRef('');
  // «corregir» no es una pestaña: son las correcciones que propone Revisa, con su propia conversación.
  const convs = useConversations<Modo | 'corregir'>((m, history, onUpdate, signal) =>
    askStudy(
      {
        book: p.book,
        chapter: p.chapter,
        verse: single,
        messages: history,
        version: settings.version,
        taller: {
          modo: m,
          paso,
          tipo: mensaje.tipo,
          plantilla: plantilla(mensaje.plantilla)?.nombre,
          desde: single ? undefined : p.from,
          hasta: single ? undefined : p.to,
          // El borrador se lee al abrir cada modo y en cada pregunta, no en cada tecla.
          borrador: m === 'corregir' ? borradorParaCorregir(mensaje) : borradorParaIA(mensaje),
          revision:
            m === 'corregir'
              ? revision.current || undefined
              : undefined,
          situacion: mensaje.situacion || undefined,
        },
      },
      onUpdate,
      signal,
    ),
  );
  const { turns, busy, error } = convs.get(modo);
  const textoRevision = convs
    .get('revisar')
    .turns.filter((t) => t.role === 'assistant')
    .map((t) => t.text)
    .join('\n\n')
    .slice(-8000);
  useEffect(() => {
    revision.current = textoRevision;
  }, [textoRevision]);
  const retry = () => convs.retry(modo);

  // Las conversaciones se guardan (tallerIa.ts): al volver a abrir, o si la app se cerró, siguen donde estaban.
  const [guardadas, setGuardadas] = useState<Record<string, Turn[]> | null>(null);
  const iniciadas = useRef(new Set<Modo>());
  useEffect(() => {
    leerTallerIa(mensaje.id).then((e) => setGuardadas(e?.convs ?? {}));
  }, [mensaje.id]);

  useEffect(() => {
    if (!guardadas || iniciadas.current.has(modo)) return;
    iniciadas.current.add(modo);
    const saved = guardadas[modo];
    if (saved?.length) convs.set(modo, saved);
    else convs.run(modo, []);
    if (modo === 'revisar' && saved?.length && guardadas.corregir?.length) convs.set('corregir', guardadas.corregir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, guardadas]);

  useEffect(() => {
    if (!guardadas) return;
    guardarTallerIa(mensaje.id, { convs: paraGuardar(convs.all) });
  }, [convs.all, guardadas, mensaje.id]);

  const ask = (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion('');
    setPeek(null);
    convs.ask(modo, text);
  };

  /** Empieza la pestaña de nuevo, leyendo el borrador como está ahora. */
  const deNuevo = () => {
    setPeek(null);
    if (modo === 'revisar') convs.set('corregir', []);
    convs.run(modo, []);
  };
  const last = turns[turns.length - 1];
  const cortada = !busy && !error && last?.role === 'assistant' && last.cortada;
  const corregir = convs.get('corregir');
  const revisionLista = modo === 'revisar' && !busy && !error && last?.role === 'assistant' && !!last.text && !last.cortada;

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    onClose();
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  const waiting = busy && !turns[turns.length - 1]?.text && !turns[turns.length - 1]?.pasos?.length;

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
                    aria-selected={on}
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
                    {!!turn.pasos?.length && <Investigacion pasos={turn.pasos} working={!turn.text && busy && i === turns.length - 1} colors={colors} />}
                    {!turn.text ? null : modo === 'sugerir' ? (
                      <Sugerencias
                        text={turn.text}
                        sources={turn.sources ?? []}
                        mensaje={mensaje}
                        colors={colors}
                        listo={!busy || i < turns.length - 1}
                        onCite={setPeek}
                      />
                    ) : (
                      <Markdown text={turn.text} colors={colors} sources={turn.sources} onCite={setPeek} />
                    )}
                    {!!turn.sources?.length && (!busy || i < turns.length - 1) && (
                      <Sources sources={turn.sources} colors={colors} onOpen={open} />
                    )}
                    {!!turn.text && (!busy || i < turns.length - 1) && (
                      <CitasRevisadas text={turn.text} sources={turn.sources} colors={colors} onOpen={open} />
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
              {revisionLista && (
                <Correcciones
                  mensaje={mensaje}
                  text={corregir.turns[corregir.turns.length - 1]?.text ?? ''}
                  busy={corregir.busy}
                  onPedir={() => convs.run('corregir', [])}
                  colors={colors}
                />
              )}
              {revisionLista && !!corregir.error && corregir.error !== NEEDS_CONNECTION && corregir.error !== NEEDS_ACCOUNT && (
                <View style={styles.waiting}>
                  <Text style={{ color: colors.text, textAlign: 'center' }}>{corregir.error}</Text>
                  <Pressable onPress={() => convs.retry('corregir')} style={[styles.retry, { borderColor: colors.accent }]}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Reintentar</Text>
                  </Pressable>
                </View>
              )}
              {cortada && (
                <View style={[styles.cortada, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.muted, flex: 1, fontSize: 14, lineHeight: 20 }}>La respuesta se cortó antes de terminar.</Text>
                  <Pressable onPress={retry} hitSlop={8} accessibilityRole="button" style={[styles.retry, { borderColor: colors.accent, marginTop: 0 }]}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Continuar</Text>
                  </Pressable>
                </View>
              )}
              {!busy && !!turns[0]?.text && (
                <Pressable
                  onPress={deNuevo}
                  accessibilityRole="button"
                  accessibilityHint="Vuelve a leer tu borrador como está ahora y empieza esta pestaña de nuevo"
                  style={({ pressed }) => [styles.again, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <RefreshIcon color={colors.muted} size={15} />
                  <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>
                    {modo === 'revisar' ? 'Revisar de nuevo mi borrador' : 'Empezar de nuevo con mi borrador actual'}
                  </Text>
                </Pressable>
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
  cortada: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginTop: 16 },
  again: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginTop: 24 },
  disclaimer: { fontSize: 12, lineHeight: 17, marginTop: 24, textAlign: 'center' },
});
