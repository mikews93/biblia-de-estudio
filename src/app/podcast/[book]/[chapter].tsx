// /podcast/juan/3: resumen del capítulo en audio, como una conversación entre Ana y Tomás
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackIcon, ForwardIcon, PauseIcon, PlayIcon } from '@/components/audioIcons';

import { PodcastGrabado } from '@/components/PodcastGrabado';
import { Sources } from '@/components/StudyPanel';
import { ToolFooter, ToolState } from '@/components/ToolState';
import { Book, getBooks, parseRef } from '@/lib/data';
import { useHerramienta } from '@/lib/herramientas';
import { closeAudio, playSpeech, recordingId, toggle, useAudio, useCatalog } from '@/lib/audio';
import { Line, SPEAKERS, minutes, parseScript } from '@/lib/podcast';
import { bookIdFromParam, verseHref } from '@/lib/routes';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function Podcast() {
  const params = useLocalSearchParams<{ book: string; chapter: string }>();
  const bookId = bookIdFromParam(params.book);
  const chapter = Number(params.chapter);
  const colors = useColors();
  const [book, setBook] = useState<Book | null>(null);
  const tool = useHerramienta('podcast', bookId, chapter);
  const lines = useMemo(() => parseScript(tool.text), [tool.text]);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<number, number>>({});
  const listY = useRef(0);

  useEffect(() => {
    getBooks().then((bs) => setBook(bs.find((b) => b.id === bookId) ?? null));
  }, [bookId]);

  const title = book ? `${book.name} ${chapter}` : '';
  const ready = tool.done && lines.length > 0;
  const player = useSpeechPlayer(bookId, chapter, title, lines);
  const recorded = useCatalog().podcast.includes(recordingId(bookId, chapter));
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
      <Stack.Screen options={{ title: 'Resumen en audio' }} />
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.kicker, { color: colors.accent }]}>🎧 RESUMEN EN AUDIO</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>{title}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          Ana y Tomás conversan sobre el capítulo{ready ? ` · unos ${minutes(lines)} min` : ''}
        </Text>

        <PodcastGrabado book={bookId} chapter={chapter} title={title} inApp={recorded} scriptReady={ready} />

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
            {player.playing ? (
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
            {player.index + 1} de {lines.length} · voz del dispositivo
          </Text>
        )}

        <ToolState
          colors={colors}
          busy={tool.busy}
          error={tool.error}
          waiting={lines.length ? null : 'Escribiendo la conversación con el texto, el griego y las referencias…'}
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
          onRegenerate={() => {
            player.stop();
            tool.regenerate();
          }}
        />
      </ScrollView>
    </View>
  );
}

/** El pódcast leído suena en el reproductor único; esta pantalla solo muestra y mueve la intervención actual. */
function useSpeechPlayer(book: string, chapter: number, title: string, lines: Line[]) {
  const audio = useAudio();
  const mine = audio.open && audio.kind === 'podcast' && audio.book === book && audio.chapter === chapter ? audio.speech : null;
  const jump = (i: number) => playSpeech(book, chapter, title, lines, Math.max(0, Math.min(lines.length - 1, i)));
  return {
    index: mine?.index ?? 0,
    playing: mine?.playing ?? false,
    toggle: () => (mine ? toggle() : jump(0)),
    jump,
    stop: () => mine && closeAudio(),
  };
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
