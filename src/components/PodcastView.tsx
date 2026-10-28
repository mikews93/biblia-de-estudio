// El pódcast de Ana y Tomás: un reproductor (con voces naturales si ya está grabado; si no, con la voz del dispositivo
// y la opción de grabarlo) y la transcripción, que se ilumina y avanza con lo que suena. Lo usan el resumen de un
// capítulo (/podcast/juan/3) y la historia de una palabra (/palabras/jesed/podcast).
import { router } from 'expo-router';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackIcon, ForwardIcon, PauseIcon, PlayIcon } from '@/components/audioIcons';

import { TalkIcon } from '@/components/icons';
import { PodcastGrabado } from '@/components/PodcastGrabado';
import { Sources } from '@/components/StudyPanel';
import { ToolFooter, ToolState } from '@/components/ToolState';
import VocesPodcast from '@/components/VocesPodcast';
import { IconText } from '@/components/comunidad/ui';
import { parseRef } from '@/lib/data';
import { useHerramienta } from '@/lib/herramientas';
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
import { verseHref } from '@/lib/routes';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Props = {
  /** Clave en el reproductor: el libro («jhn») o, para una palabra, «palabra:jesed» con capítulo 0. */
  book: string;
  chapter: number;
  title: string;
  kicker: string;
  subtitle: string;
  tool: ReturnType<typeof useHerramienta>;
  /** Grabado con voces naturales y guardado en la app (public/audio/podcast). */
  recorded: boolean;
  palabra?: string;
  waiting: string;
  /** Lo que va arriba del título (por ejemplo, la palabra en el original). */
  header?: React.ReactNode;
  /** De dónde salió el guion, debajo de las fuentes. */
  disclaimer?: string;
};

export default function PodcastView({ book: bookId, chapter, title, kicker, subtitle, tool, recorded, palabra, waiting, header, disclaimer }: Props) {
  const colors = useColors();
  const lines = useMemo(() => parseScript(tool.text), [tool.text]);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<number, number>>({});
  const listY = useRef(0);

  const grabado = usePodcastGrabado(bookId, chapter, palabra);
  // Ya grabado con voces naturales (en la app o bajo demanda): el reproductor suena con esas voces y no con las del
  // dispositivo. Mientras se pregunta al servidor, el botón espera para no cambiar de voz a mitad.
  const natural = recorded ? {} : grabado.estado === 'listo' ? { remote: grabado } : null;
  const ready = tool.done && lines.length > 0 && (recorded || grabado.estado !== 'cargando');
  const player = usePodcastPlayer(bookId, chapter, title, lines, natural);
  const colorOf = (speaker: string) => (speaker === 'ana' ? colors.accent : colors.greek);
  const tint = ready ? colors.text : colors.border;

  // Sigue la intervención que suena
  useEffect(() => {
    const y = positions.current[player.index];
    if (player.playing && y !== undefined && player.index > 0) scroll.current?.scrollTo({ y: Math.max(0, listY.current + y - 160), animated: true });
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
        <IconText icon={TalkIcon} color={colors.accent} size={14}>
          <Text style={[styles.kicker, { color: colors.accent }]}>{kicker}</Text>
        </IconText>
        <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>{title}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          {subtitle}
          {ready ? ` · unos ${minutes(lines)} min` : ''}
        </Text>

        {!natural && <PodcastGrabado grabado={grabado} scriptReady={ready} />}

        <View style={[styles.player, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={() => player.jump(player.index - 1)}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Intervención anterior"
            hitSlop={8}
            style={({ pressed }) => [styles.side, pressed && styles.pressed]}
          >
            <BackIcon color={tint} size={26} />
          </Pressable>
          <Pressable
            onPress={player.toggle}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel={player.playing ? 'Pausar' : 'Escuchar'}
            style={({ pressed }) => [styles.play, { backgroundColor: ready ? colors.accent : colors.border }, pressed && styles.pressed]}
          >
            {player.loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : player.playing ? (
              <PauseIcon color={colors.surface} size={26} />
            ) : (
              <PlayIcon color={colors.surface} size={30} />
            )}
          </Pressable>
          <Pressable
            onPress={() => player.jump(player.index + 1)}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Intervención siguiente"
            hitSlop={8}
            style={({ pressed }) => [styles.side, pressed && styles.pressed]}
          >
            <ForwardIcon color={tint} size={26} />
          </Pressable>
        </View>
        {ready && (
          <Text style={[styles.progress, { color: colors.muted }]}>
            {player.index + 1} de {lines.length} · {natural ? 'voces naturales' : 'voz del dispositivo'}
          </Text>
        )}
        {!natural && <VocesPodcast />}

        <ToolState
          colors={colors}
          busy={tool.busy}
          error={tool.error}
          waiting={lines.length ? null : waiting}
          onRetry={tool.retry}
        />

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
                <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24, flex: 1 }}>
                  {line.text}
                  {line.cites.map((n) => (
                    <Text key={n} style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>
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
      playing: speech?.playing ?? false,
      loading: false,
      toggle: () => (speech ? toggle() : jump(0)),
      jump,
      stop: () => speech && closeAudio(),
    };
  }
  const jump = (i: number) => {
    const to = clamp(i, lines);
    if (!recording) return playRecordedPodcast(book, chapter, title, { remote: natural.remote, lines, from: to });
    seekChapter(recording.timestamps[to]?.[1] ?? 0);
    if (!getPlayer().playing) getPlayer().play();
  };
  return {
    index: recording ? at.index : 0,
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
  content: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 30, marginTop: 4 },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    marginTop: 20,
  },
  side: { padding: 6 },
  play: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  progress: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  line: { flexDirection: 'row', gap: 10, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginHorizontal: -10 },
  speaker: { width: 52, fontWeight: '700', fontSize: 13, marginTop: 3 },
});
