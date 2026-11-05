// El pódcast de Ana y Tomás: un reproductor (con voces naturales si ya está grabado; si no, con la voz del dispositivo
// y la opción de grabarlo) y la transcripción, que se ilumina y avanza con lo que suena. Lo usan el resumen de un
// capítulo (/podcast/juan/3) y la historia de una palabra (/palabras/jesed/podcast).
import { router } from 'expo-router';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlayIcon } from '@/components/audioIcons';

import { TalkIcon } from '@/components/icons';
import { Sources } from '@/components/StudyPanel';
import { ToolFooter, ToolState } from '@/components/ToolState';
import { IconText } from '@/components/comunidad/ui';
import { parseRef } from '@/lib/data';
import { VersionPodcast, useHerramienta } from '@/lib/herramientas';
import {
  RemoteRecording,
  chapterTime,
  closeAudio,
  currentVerse,
  getPlayer,
  playRecordedPodcast,
  playSpeech,
  seekChapter,
  toggle,
  useAudio,
} from '@/lib/audio';
import { Line, SPEAKERS, minutes, parseScript } from '@/lib/podcast';
import { usePodcastGrabado } from '@/lib/podcastGrabado';
import { publicarExtras, retirarExtras } from '@/lib/podcastExtras';
import { verseHref } from '@/lib/routes';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Props = {
  /** Clave en el reproductor: el libro («jhn») o, para una palabra, «palabra:jesed» con capítulo 0. */
  book: string;
  chapter: number;
  title: string;
  kicker?: string;
  subtitle: string;
  tool: ReturnType<typeof useHerramienta>;
  /** En qué versión se escribió y se graba (cada versión libre tiene su guion y su grabación). */
  version: VersionPodcast;
  /** Grabado con voces naturales y guardado en la app (public/audio/podcast). */
  recorded: boolean;
  palabra?: string;
  waiting: string;
  /** Lo que va arriba del título (por ejemplo, la palabra en el original). */
  header?: React.ReactNode;
  /** De dónde salió el guion, debajo de las fuentes. */
  disclaimer?: string;
  /** Se llegó desde el capítulo de al lado: empieza a sonar en cuanto está listo. */
  seguir?: boolean;
};

export default function PodcastView({
  book: bookId,
  chapter,
  title,
  kicker,
  subtitle,
  tool,
  version,
  recorded,
  palabra,
  waiting,
  header,
  disclaimer,
  seguir,
}: Props) {
  const colors = useColors();
  const lines = useMemo(() => parseScript(tool.text), [tool.text]);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<number, number>>({});
  const listY = useRef(0);

  const grabado = usePodcastGrabado(bookId, chapter, palabra, version.id, tool.done ? tool.text : undefined);
  // Ya grabado con voces naturales (en la app o bajo demanda): el reproductor suena con esas voces y no con las del
  // dispositivo. Mientras se pregunta al servidor, el botón espera para no cambiar de voz a mitad.
  const natural = recorded ? {} : grabado.estado === 'listo' ? { remote: grabado } : null;
  const ready = tool.done && lines.length > 0 && (recorded || grabado.estado !== 'cargando');
  const player = usePodcastPlayer(bookId, chapter, title, lines, natural);
  const colorOf = (speaker: string) => (speaker === 'ana' ? colors.accent : colors.greek);

  // Al pasar de capítulo, el nuevo empieza solo en cuanto su guion (y su grabación, si la hay) está listo.
  const arranco = useRef(false);
  useEffect(() => {
    if (!seguir || !ready || arranco.current) return;
    arranco.current = true;
    player.jump(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seguir, ready]);

  // El reproductor de abajo ofrece grabarlo con voces naturales mientras suena con la voz del dispositivo.
  const { record } = grabado;
  const errorGrabado = grabado.estado === 'error' ? grabado.error : '';
  useEffect(() => {
    if (recorded || !ready) return;
    const estado =
      grabado.estado === 'error'
        ? { estado: 'error' as const, error: errorGrabado }
        : grabado.estado === 'listo'
          ? null
          : { estado: grabado.estado };
    if (!estado) return;
    publicarExtras({ book: bookId, chapter, grabado: estado, record });
    return () => retirarExtras(bookId, chapter);
  }, [bookId, chapter, recorded, ready, grabado.estado, errorGrabado, record]);

  // Si termina de grabarse con voces naturales mientras suena con la voz del dispositivo, sigue en la grabación desde la
  // misma intervención.
  const remota = natural?.remote;
  const audioAhora = useAudio();
  const conVozDelDispositivo =
    audioAhora.open && audioAhora.kind === 'podcast' && audioAhora.book === bookId && audioAhora.chapter === chapter && audioAhora.speech;
  useEffect(() => {
    if (!remota || !conVozDelDispositivo) return;
    playRecordedPodcast(bookId, chapter, title, { remote: remota, lines, from: conVozDelDispositivo.index });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remota?.url]);

  // Sigue la intervención que suena
  useEffect(() => {
    const y = positions.current[player.index];
    if (player.playing && y !== undefined && player.index > 0)
      scroll.current?.scrollTo({
        y: Math.max(0, listY.current + y - 160),
        animated: true,
      });
  }, [player.index, player.playing]);

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    // El pódcast sigue sonando en la barra mientras se lee el versículo.
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        {header}
        {kicker && (
          <IconText icon={TalkIcon} color={colors.accent} size={14}>
            <Text style={[styles.kicker, { color: colors.accent }]}>{kicker}</Text>
          </IconText>
        )}
        <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>{title}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          {subtitle}
          {` · ${version.sigla}`}
          {ready ? ` · unos ${minutes(lines)} min` : ''}
        </Text>

        {/* El reproductor es la barra de abajo; aquí solo se empieza. Mientras suena, la transcripción lo sigue. */}
        {!player.started && (
          <Pressable
            onPress={player.toggle}
            disabled={!ready || player.loading}
            accessibilityRole="button"
            accessibilityLabel="Escuchar"
            style={({ pressed }) => [styles.start, { backgroundColor: ready ? colors.accent : colors.border }, pressed && styles.pressed]}
          >
            {!ready || player.loading ? <ActivityIndicator color={colors.surface} /> : <PlayIcon color={colors.surface} size={22} />}
            <View>
              <Text style={[styles.startText, { color: colors.surface }]}>{ready ? 'Escuchar' : 'Preparando…'}</Text>
              {ready && (
                <Text style={[styles.startDetail, { color: colors.surface }]}>
                  {natural
                    ? 'Con voces naturales'
                    : grabado.estado === 'grabando'
                      ? 'Grabándose con voces naturales'
                      : 'Con la voz del teléfono'}
                </Text>
              )}
            </View>
          </Pressable>
        )}

        <ToolState colors={colors} busy={tool.busy} error={tool.error} waiting={lines.length ? null : waiting} onRetry={tool.retry} />

        <View style={{ marginTop: 16 }} onLayout={(e) => (listY.current = e.nativeEvent.layout.y)}>
          {lines.map((line, i) => {
            const on = ready && i === player.index;
            return (
              <Pressable
                key={i}
                onPress={() => ready && player.jump(i)}
                onLayout={(e) => (positions.current[i] = e.nativeEvent.layout.y)}
                style={[styles.line, on && { backgroundColor: colors.accentSoft }]}
                accessibilityHint="Escuchar desde aquí"
              >
                <Text style={[styles.speaker, { color: colorOf(line.speaker) }]}>{SPEAKERS[line.speaker]}</Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    lineHeight: 24,
                    flex: 1,
                  }}
                >
                  {line.text}
                  {line.cites.map((n) => (
                    <Text
                      key={n}
                      style={{
                        color: colors.accent,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {' '}
                      {n}
                    </Text>
                  ))}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tool.done && !!tool.sources.length && <Sources sources={tool.sources} colors={colors} onOpen={open} />}
        <ToolFooter
          colors={colors}
          done={tool.done}
          text={disclaimer}
          onRegenerate={() => {
            player.stop();
            tool.regenerate();
          }}
        />
      </ScrollView>
    </View>
  );
}

/**
 * El pódcast suena en el reproductor único; esta pantalla solo muestra y mueve la intervención actual. Con voces
 * naturales es una grabación (la intervención sale de sus tiempos); si no, lo lee la voz del dispositivo.
 */
function usePodcastPlayer(book: string, chapter: number, title: string, lines: Line[], natural: { remote?: RemoteRecording } | null) {
  const audio = useAudio();
  const here = audio.open && audio.kind === 'podcast' && audio.book === book && audio.chapter === chapter;
  const speech = here ? audio.speech : null;
  const file = here && !speech && natural ? audio : null;
  const recording = file?.audio ?? null;
  const at = useRecordingLine(!!recording);

  if (!natural) {
    const jump = (i: number) => playSpeech(book, chapter, title, lines, clamp(i, lines));
    return {
      index: speech?.index ?? 0,
      started: !!speech,
      playing: speech?.playing ?? false,
      loading: false,
      toggle: () => (speech ? toggle() : jump(0)),
      jump,
      stop: () => speech && closeAudio(),
    };
  }
  const jump = (i: number) => {
    const to = clamp(i, lines);
    if (!recording)
      return playRecordedPodcast(book, chapter, title, {
        remote: natural.remote,
        lines,
        from: to,
      });
    seekChapter(recording.timestamps[to]?.[1] ?? 0);
    if (!getPlayer().playing) getPlayer().play();
  };
  return {
    index: recording ? at.index : 0,
    started: !!recording,
    playing: !!recording && at.playing,
    loading: !!file?.loading,
    toggle: () => (recording ? toggle() : !file?.loading && jump(0)),
    jump,
    stop: () => file && closeAudio(),
  };
}

const clamp = (i: number, lines: Line[]) => Math.max(0, Math.min(lines.length - 1, i));

/** La intervención que suena en la grabación. Solo cambia de estado cuando cambia de intervención o se pausa. */
function useRecordingLine(active: boolean) {
  const [at, setAt] = useState({ index: 0, playing: false });
  useEffect(() => {
    if (!active) return;
    const p = getPlayer();
    const update = () => {
      const index = currentVerse(chapterTime(p.currentTime)) ?? 0;
      setAt((prev) => (prev.index === index && prev.playing === p.playing ? prev : { index, playing: p.playing }));
    };
    update();
    const sub = p.addListener('playbackStatusUpdate', update);
    return () => sub.remove();
  }, [active]);
  return at;
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 64,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 30, marginTop: 4 },
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'flex-start',
    height: 56,
    paddingLeft: 18,
    paddingRight: 24,
    borderRadius: 28,
    marginTop: 18,
  },
  startText: { fontSize: 16, fontWeight: '700' },
  startDetail: { fontSize: 12, opacity: 0.8 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  line: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: -10,
  },
  speaker: { width: 52, fontWeight: '700', fontSize: 13, marginTop: 3 },
});
