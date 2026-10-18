// /podcast/juan/3: resumen del capítulo en audio, como una conversación entre Ana y Tomás
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Sources } from '@/components/StudyPanel';
import { ToolFooter, ToolState } from '@/components/ToolState';
import { Book, getBooks, parseRef } from '@/lib/data';
import { useHerramienta } from '@/lib/herramientas';
import { SPEAKERS, minutes, parseScript, usePodcastPlayer } from '@/lib/podcast';
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
  const player = usePodcastPlayer(lines);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<number, number>>({});
  const listY = useRef(0);

  useEffect(() => {
    getBooks().then((bs) => setBook(bs.find((b) => b.id === bookId) ?? null));
  }, [bookId]);

  // Sigue la intervención que suena
  useEffect(() => {
    const y = positions.current[player.index];
    if (player.playing && y !== undefined && player.index > 0) scroll.current?.scrollTo({ y: Math.max(0, listY.current + y - 160), animated: true });
  }, [player.index, player.playing]);

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    player.stop();
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  const title = book ? `${book.name} ${chapter}` : '';
  const ready = tool.done && lines.length > 0;
  const colorOf = (speaker: string) => (speaker === 'ana' ? colors.accent : colors.greek);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Resumen en audio' }} />
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.kicker, { color: colors.accent }]}>🎧 RESUMEN EN AUDIO</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>{title}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          Ana y Tomás conversan sobre el capítulo{ready ? ` · unos ${minutes(lines)} min` : ''}
        </Text>

        <View style={[styles.player, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={() => player.jump(player.index - 1)}
            disabled={!ready}
            accessibilityLabel="Intervención anterior"
            hitSlop={8}
            style={styles.side}
          >
            <Text style={{ color: ready ? colors.text : colors.border, fontSize: 22 }}>⏮</Text>
          </Pressable>
          <Pressable
            onPress={player.toggle}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel={player.playing ? 'Pausar' : 'Escuchar'}
            style={[styles.play, { backgroundColor: ready ? colors.accent : colors.border }]}
          >
            <Text style={{ color: colors.surface, fontSize: 26, marginLeft: player.playing ? 0 : 3 }}>
              {player.playing ? '❚❚' : '▶'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => player.jump(player.index + 1)}
            disabled={!ready}
            accessibilityLabel="Intervención siguiente"
            hitSlop={8}
            style={styles.side}
          >
            <Text style={{ color: ready ? colors.text : colors.border, fontSize: 22 }}>⏭</Text>
          </Pressable>
          <Pressable
            onPress={player.cycleRate}
            accessibilityLabel={`Velocidad ${player.rate}`}
            style={[styles.rate, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{player.rate}×</Text>
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
          onRetry={tool.regenerate}
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
  rate: { position: 'absolute', right: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  progress: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  line: { flexDirection: 'row', gap: 10, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginHorizontal: -10 },
  speaker: { width: 52, fontWeight: '700', fontSize: 13, marginTop: 3 },
});
