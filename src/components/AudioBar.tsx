import { useAudioPlayerStatus } from 'expo-audio';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  chapterDuration,
  chapterTime,
  closeAudio,
  currentVerse,
  getPlayer,
  seekBy,
  seekChapter,
  setLocation,
  setRate,
  setVersion,
  toggle,
  useAudio,
} from '@/lib/audio';
import { serif, useColors } from '@/lib/theme';

const RATES = [1, 1.25, 1.5, 0.75];

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Reproductor de la lectura dramatizada, encima de la barra de abajo. Sigue sonando al cambiar de pantalla. */
export default function AudioBar() {
  const audio = useAudio();
  const path = usePathname();

  useEffect(() => setLocation(path), [path]);

  if (!audio.open) return null;
  return <Bar />;
}

function Bar() {
  const colors = useColors();
  const audio = useAudio();
  const status = useAudioPlayerStatus(getPlayer());
  const [width, setWidth] = useState(0);
  const [picking, setPicking] = useState(false);

  const now = audio.audio ? chapterTime(status.currentTime) : 0;
  const total = audio.audio ? chapterDuration(status.duration) : 0;
  const verse = currentVerse(now);
  const others = audio.audio
    ? audio.versions.filter((v) => v.id !== audio.audio!.version.id && v[audio.audio!.testament])
    : [];

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {audio.title}
            {verse ? <Text style={{ color: colors.accent }}>{`  ·  v. ${verse}`}</Text> : null}
          </Text>
          {audio.audio && (
            <Pressable
              onPress={() => others.length && setPicking(!picking)}
              disabled={!others.length}
              accessibilityRole="button"
              accessibilityLabel={`Versión del audio: ${audio.audio.version.name}${others.length ? '. Cambiar' : ''}`}
            >
              <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                {audio.audio.version.name}
                {others.length ? ' ▾' : ''}
              </Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={closeAudio} hitSlop={12} accessibilityLabel="Cerrar el audio">
          <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>

      {picking && (
        <View style={styles.versions}>
          {others.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => {
                setPicking(false);
                setVersion(v.id);
              }}
              style={({ pressed }) => [styles.version, { borderColor: colors.border }, pressed && styles.pressed]}
            >
              <Text style={{ color: colors.text, fontSize: 13 }}>{v.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {audio.error ? (
        <Text style={[styles.message, { color: colors.muted }]}>{audio.error}</Text>
      ) : audio.loading || !audio.audio ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
      ) : (
        <>
          <Pressable
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            onPress={(e) => width && total && seekChapter((e.nativeEvent.locationX / width) * total)}
            style={styles.trackHit}
            accessibilityRole="adjustable"
            accessibilityLabel={`Posición ${clock(now)} de ${clock(total)}`}
          >
            <View style={[styles.track, { backgroundColor: colors.border }]}>
              <View style={[styles.fill, { backgroundColor: colors.accent, width: total ? `${(now / total) * 100}%` : 0 }]} />
            </View>
          </Pressable>
          <View style={styles.controls}>
            <Text style={[styles.time, { color: colors.muted }]}>{clock(now)}</Text>
            <Pressable
              onPress={() => setRate(RATES[(RATES.indexOf(audio.rate) + 1) % RATES.length])}
              hitSlop={8}
              accessibilityLabel={`Velocidad ${audio.rate}×`}
              style={styles.small}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{audio.rate}×</Text>
            </Pressable>
            <Pressable onPress={() => seekBy(-10)} hitSlop={8} accessibilityLabel="Atrás 10 segundos" style={styles.small}>
              <Text style={{ color: colors.text, fontSize: 15 }}>↺ 10</Text>
            </Pressable>
            <Pressable
              onPress={toggle}
              accessibilityLabel={status.playing ? 'Pausa' : 'Reproducir'}
              style={({ pressed }) => [styles.play, { backgroundColor: colors.accent }, pressed && styles.pressed]}
            >
              {status.isBuffering && !status.playing ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={{ color: colors.surface, fontSize: 18, fontFamily: serif }}>{status.playing ? '❚❚' : '▶'}</Text>
              )}
            </Pressable>
            <Pressable onPress={() => seekBy(10)} hitSlop={8} accessibilityLabel="Adelante 10 segundos" style={styles.small}>
              <Text style={{ color: colors.text, fontSize: 15 }}>10 ↻</Text>
            </Pressable>
            <View style={styles.small} />
            <Text style={[styles.time, { color: colors.muted, textAlign: 'right' }]}>{clock(total)}</Text>
          </View>
          <Text style={[styles.credit, { color: colors.muted }]} numberOfLines={2}>
            {audio.audio.credit}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 15, fontWeight: '700' },
  versions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  version: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  message: { fontSize: 13, marginVertical: 10 },
  trackHit: { paddingVertical: 8, marginTop: 4 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: 12, width: 40, fontVariant: ['tabular-nums'] },
  small: { minWidth: 44, alignItems: 'center' },
  play: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  credit: { fontSize: 10, textAlign: 'center', marginTop: 6 },
});
