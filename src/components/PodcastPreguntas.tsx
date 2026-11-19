// Preguntar mientras se escucha el pódcast: una entrada en el reproductor de abajo («Pregúntale a Ana y Tomás») que
// pausa el audio y abre una hoja con la misma IA del Estudio. Arriba queda lo que sonaba al pausar; abajo, la caja de
// preguntar con micrófono. «Seguir escuchando» (o cerrar) vuelve al pódcast donde se quedó. La conversación vive en
// src/lib/podcastPreguntas.ts: cerrar la hoja no corta la respuesta.
import { router } from 'expo-router';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import AskBar from '@/components/AskBar';
import { PauseIcon, PlayIcon } from '@/components/audioIcons';
import Welcome from '@/components/comunidad/Welcome';
import { ChevronRightIcon, CloseIcon, CommentIcon, SparkIcon } from '@/components/icons';
import Investigacion from '@/components/Investigacion';
import { Markdown, SourcePeek, Sources } from '@/components/StudyText';
import { NeedsConnection } from '@/components/SinConexion';
import { mainPlaying, pauseAudio, toggle } from '@/lib/audio';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { NEEDS_CONNECTION } from '@/lib/conexion';
import { parseRef } from '@/lib/data';
import type { Source } from '@/lib/estudio';
import { type Line, SPEAKERS } from '@/lib/podcast';
import { conversacionPodcast, momentoDe, usePreguntasPodcast } from '@/lib/podcastPreguntas';
import { verseHref } from '@/lib/routes';
import { useTecladoPanel } from '@/lib/teclado';
import { Colors, isDark, serif, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Props = {
  book: string;
  chapter: number;
  title: string;
  lines: Line[];
  /** La intervención que suena ahora (la que quedará en pausa al abrir la hoja). */
  index: number | null;
  colors: Colors;
};

const SUGERENCIAS = ['Explícamelo más sencillo', '¿Dónde más aparece esto en la Biblia?', '¿Cómo lo aplico hoy?'];

/** La entrada en el reproductor: parece una caja de preguntar y abre la hoja. */
export default function PodcastPreguntas({ book, chapter, title, lines, index, colors }: Props) {
  const [abierta, setAbierta] = useState(false);
  // Lo que sonaba cuando se abrió: no cambia aunque el reproductor avance después.
  const [pausa, setPausa] = useState<{ index: number | null; sonaba: boolean }>({ index: null, sonaba: false });
  const c = useMemo(() => conversacionPodcast(book, chapter), [book, chapter]);
  const estado = usePreguntasPodcast(c);
  const hechas = estado.turns.filter((t, i) => i > 0 && t.role === 'user').length;

  const abrir = () => {
    const sonaba = mainPlaying();
    if (sonaba) pauseAudio();
    setPausa({ index, sonaba });
    setAbierta(true);
  };

  return (
    <>
      <Pressable
        onPress={abrir}
        accessibilityRole="button"
        accessibilityLabel="Pausar y preguntar sobre lo que escuchas"
        style={({ pressed }) => [styles.entrada, { backgroundColor: colors.background, borderColor: colors.border }, pressed && styles.pressed]}
      >
        <View style={[styles.entradaIcono, { backgroundColor: colors.warmSoft }]}>
          <SparkIcon color={colors.warm} size={14} />
        </View>
        <Text style={[styles.entradaTexto, { color: colors.muted }]} numberOfLines={1}>
          Pregunta sobre lo que oyes
        </Text>
        {estado.working ? (
          <ActivityIndicator color={colors.warm} size="small" />
        ) : hechas > 0 ? (
          <View style={[styles.cuenta, { borderColor: colors.border }]}>
            <CommentIcon color={colors.muted} size={12} />
            <Text style={[styles.cuentaTexto, { color: colors.muted }]}>{hechas}</Text>
          </View>
        ) : (
          <Text style={[styles.entradaPista, { color: colors.muted }]}>IA del Estudio</Text>
        )}
      </Pressable>
      {abierta && (
        <Hoja
          title={title}
          lines={lines}
          pausa={pausa.index}
          colors={colors}
          c={c}
          onClose={(seguir) => {
            setAbierta(false);
            if (seguir && pausa.sonaba && !mainPlaying()) toggle();
          }}
        />
      )}
    </>
  );
}

function Hoja({
  title,
  lines,
  pausa,
  colors,
  c,
  onClose,
}: {
  title: string;
  lines: Line[];
  pausa: number | null;
  colors: Colors;
  c: ReturnType<typeof conversacionPodcast>;
  /** seguir: volver a sonar donde se quedó (si sonaba al abrir). */
  onClose: (seguir: boolean) => void;
}) {
  const teclado = useTecladoPanel();
  const { settings } = useSettings();
  const estado = usePreguntasPodcast(c);
  const [texto, setTexto] = useState('');
  const [peek, setPeek] = useState<Source | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const linea = pausa == null ? undefined : lines[pausa];
  const momento = momentoDe(lines, pausa);
  const conversacion = estado.turns.slice(1);
  const ultima = conversacion[conversacion.length - 1];

  // Cada respuesta que llega se sigue hasta abajo.
  useEffect(() => {
    if (estado.working) scroll.current?.scrollToEnd({ animated: true });
  }, [estado.working, conversacion.length]);

  const preguntar = (q: string) => {
    const t = q.trim();
    if (!t || estado.working) return;
    setTexto('');
    setPeek(null);
    c.preguntar(lines, t, momento);
  };
  const reintentar = () => c.preguntar(lines, null, momento);

  const abrirCita = (ref: string) => {
    const { start } = parseRef(ref);
    // La hoja se cierra para leer el versículo; el pódcast sigue en pausa en la barra.
    onClose(false);
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  const problema =
    estado.error === NEEDS_CONNECTION ? (
      <NeedsConnection title="Preguntar necesita internet" intro="La IA responde desde el servidor. Sin conexión puedes seguir escuchando el pódcast." />
    ) : estado.error === NEEDS_ACCOUNT ? (
      <Welcome
        kind="ia"
        title="Pregunta mientras escuchas"
        intro="Pausa el pódcast y pregunta lo que no entendiste: la IA del Estudio te responde con el capítulo, el original, los comentarios y lo que dijeron Ana y Tomás. Solo necesitas una cuenta gratuita."
        onReady={reintentar}
      />
    ) : estado.error ? (
      <View style={styles.error}>
        <Text style={{ color: colors.text, textAlign: 'center', fontSize: 14.5, lineHeight: 20 }}>{estado.error}</Text>
        <Pressable onPress={reintentar} style={({ pressed }) => [styles.retry, { borderColor: colors.accent }, pressed && styles.pressed]}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Reintentar</Text>
        </Pressable>
      </View>
    ) : null;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={() => onClose(true)}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTop} onPress={() => onClose(true)} accessibilityLabel="Cerrar y seguir escuchando" />
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, minHeight: 0, paddingBottom: teclado }}>
            <View style={[styles.header, { borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.kickerRow}>
                  <SparkIcon color={colors.warm} size={13} />
                  <Text style={[styles.kicker, { color: colors.warm }]}>PREGUNTAR EN EL PÓDCAST</Text>
                </View>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              <Pressable
                onPress={() => onClose(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Seguir escuchando"
                style={({ pressed }) => [styles.seguirMini, { backgroundColor: colors.accent }, pressed && styles.pressed]}
              >
                <PlayIcon color={colors.surface} size={13} />
                <Text style={[styles.seguirMiniTexto, { color: colors.surface }]}>Seguir</Text>
              </Pressable>
              <Pressable onPress={() => onClose(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar sin seguir escuchando">
                <CloseIcon color={colors.muted} size={22} />
              </Pressable>
            </View>

            <ScrollView ref={scroll} style={{ flex: 1, minHeight: 0 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {linea && (
                <View
                  style={[
                    styles.pausa,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    !isDark(colors) && { boxShadow: '0 1px 2px rgba(40, 30, 20, 0.04), 0 6px 18px rgba(40, 30, 20, 0.05)' },
                  ]}
                  accessibilityLabel={`En pausa cuando ${SPEAKERS[linea.speaker]} decía: ${linea.text}`}
                >
                  <View style={styles.pausaHead}>
                    <View style={[styles.pausaIcono, { backgroundColor: colors.accentSoft }]}>
                      <PauseIcon color={colors.text} size={11} />
                    </View>
                    <Text style={[styles.pausaKicker, { color: colors.muted }]}>
                      En pausa · habla{' '}
                      <Text style={{ color: linea.speaker === 'ana' ? colors.accent : colors.greek, fontWeight: '800' }}>{SPEAKERS[linea.speaker]}</Text>
                    </Text>
                  </View>
                  <Text style={[styles.pausaTexto, { color: colors.text }]} numberOfLines={4}>
                    «{linea.text}»
                  </Text>
                </View>
              )}

              {conversacion.length === 0 && !estado.error && (
                <Appear>
                  <Text style={[styles.intro, { color: colors.muted }]}>
                    Pregunta lo que no entendiste o lo que te despertó curiosidad. Te responde la IA del Estudio con el capítulo, el
                    original y los comentarios, y sabe lo que dijeron Ana y Tomás.
                  </Text>
                  <View style={styles.sugerencias}>
                    {[...(linea ? [`¿Qué quiso decir ${SPEAKERS[linea.speaker]} con eso?`] : []), ...SUGERENCIAS].map((s, i) => (
                      <Pressable
                        key={s}
                        onPress={() => preguntar(s)}
                        style={({ pressed }) => [
                          styles.chip,
                          i === 0 && linea
                            ? { borderColor: colors.warm, backgroundColor: colors.warmSoft }
                            : { borderColor: colors.border, backgroundColor: colors.surface },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={{ color: i === 0 && linea ? colors.warm : colors.text, fontSize: 13.5, fontWeight: i === 0 && linea ? '700' : '500' }}>
                          {s}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Appear>
              )}

              {conversacion.map((turn, i) => {
                const enCurso = estado.working && i === conversacion.length - 1;
                return turn.role === 'user' ? (
                  <Appear key={i} style={[styles.pregunta, { backgroundColor: colors.accentSoft }]}>
                    <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{turn.text}</Text>
                  </Appear>
                ) : (
                  <View key={i} style={{ marginTop: 6 }}>
                    {!!turn.pasos?.length && <Investigacion pasos={turn.pasos} working={!turn.text && enCurso} colors={colors} />}
                    {turn.text ? (
                      <Markdown text={turn.text} colors={colors} escribiendo={enCurso} sources={turn.sources} onCite={setPeek} onOpenRef={abrirCita} />
                    ) : (
                      !turn.pasos?.length &&
                      enCurso && (
                        <View style={styles.pensando}>
                          <ActivityIndicator color={colors.warm} />
                          <Text style={{ color: colors.muted, fontSize: 14 }}>Pensando por dónde buscar…</Text>
                        </View>
                      )
                    )}
                    {!!turn.text && !enCurso && (
                      <Appear>
                        <Sources sources={turn.sources} text={turn.text} colors={colors} onOpen={abrirCita} />
                      </Appear>
                    )}
                  </View>
                );
              })}

              {problema && <View style={{ marginTop: 16 }}>{problema}</View>}

              {!estado.working && ultima?.role === 'assistant' && !!ultima.text && (
                <Appear>
                  <Pressable
                    onPress={() => onClose(true)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.seguir, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
                  >
                    <View style={[styles.seguirIcono, { backgroundColor: colors.accent }]}>
                      <PlayIcon color={colors.surface} size={16} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.seguirTitulo, { color: colors.text }]}>Seguir escuchando</Text>
                      <Text style={[styles.seguirPista, { color: colors.muted }]}>
                        {linea ? `Desde donde ${SPEAKERS[linea.speaker]} se quedó. ` : ''}Tus preguntas quedan guardadas aquí.
                      </Text>
                    </View>
                    <ChevronRightIcon color={colors.muted} size={18} />
                  </Pressable>
                </Appear>
              )}

              {conversacion.length > 0 && !estado.working && (
                <Pressable onPress={() => c.borrar()} hitSlop={8} accessibilityRole="button" style={styles.borrar}>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '600' }}>Borrar mis preguntas de este pódcast</Text>
                </Pressable>
              )}

              <Text style={[styles.nota, { color: colors.muted }]}>
                Responde con la IA a partir del capítulo y las fuentes de la app. Puede equivocarse: toca los números para ver de
                dónde sale cada idea. Tus preguntas solo las ves tú.
              </Text>
            </ScrollView>

            {peek && <SourcePeek source={peek} version={settings.version} colors={colors} onOpen={abrirCita} onClose={() => setPeek(null)} />}

            <AskBar
              value={texto}
              onChange={setTexto}
              onSend={() => preguntar(texto)}
              placeholder="¿Qué quieres preguntar?"
              busy={estado.working}
              onStop={() => c.detener()}
              colors={colors}
            />
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  entrada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingLeft: 6,
    paddingRight: 14,
    height: 42,
    marginTop: 8,
  },
  entradaIcono: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  entradaTexto: { flex: 1, fontSize: 14 },
  entradaPista: { fontSize: 11.5, fontWeight: '600' },
  cuenta: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  cuentaTexto: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  backdropTop: { height: '10%', minHeight: 40 },
  sheet: {
    flex: 1,
    minHeight: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { fontSize: 21, fontFamily: serif, marginTop: 2 },
  seguirMini: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, borderRadius: 16, paddingHorizontal: 12 },
  seguirMiniTexto: { fontSize: 13, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  pausa: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 8 },
  pausaHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pausaIcono: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pausaKicker: { fontSize: 12.5, fontWeight: '600' },
  pausaTexto: { fontFamily: serif, fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  intro: { fontSize: 14.5, lineHeight: 21, marginTop: 18 },
  sugerencias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  pregunta: { alignSelf: 'flex-end', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginTop: 20, maxWidth: '85%' },
  pensando: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 },
  error: { alignItems: 'center', paddingVertical: 12 },
  retry: { marginTop: 12, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  seguir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    marginTop: 22,
  },
  seguirIcono: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  seguirTitulo: { fontSize: 15.5, fontWeight: '700' },
  seguirPista: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  borrar: { alignSelf: 'center', marginTop: 18, paddingVertical: 4 },
  nota: { fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 16 },
});
