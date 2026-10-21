import { useAudioPlayerStatus } from 'expo-audio';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AudioKind,
  AudioState,
  chapterDuration,
  chapterTime,
  closeAudio,
  currentVerse,
  getPlayer,
  playChapter,
  playDramatized,
  recordingId,
  seekBy,
  seekChapter,
  setLocation,
  setRate,
  setVersion,
  speakerNow,
  toggle,
  useAudio,
  useCatalog,
} from '@/lib/audio';
import { RouteIcon } from '@/components/icons';
import { getPlaces } from '@/lib/data';
import { journeysFor, recorridoHref } from '@/lib/recorridos';
import { Colors, serif, useColors } from '@/lib/theme';
import { fixedInTransition, navigate } from '@/lib/transition';

import { BackIcon, CloseIcon, DramaIcon, ForwardIcon, ListenIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon, TalkIcon } from './audioIcons';

const RATES = [1, 1.25, 1.5, 0.75];

const KIND_ICON: Record<AudioKind, typeof ListenIcon> = { lectura: ListenIcon, dramatizado: DramaIcon, podcast: TalkIcon };

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Reproductor único, encima de la barra de abajo: lectura, dramatizado y pódcast. Sigue sonando al cambiar de pantalla. */
export default function AudioBar() {
  const audio = useAudio();
  const path = usePathname();

  useEffect(() => setLocation(path), [path]);

  if (!audio.open) return null;
  // El mapa que sigue la lectura ya trae sus controles para el capítulo que suena
  if (audio.book && audio.kind !== 'podcast' && path === recorridoHref(audio.book, audio.chapter)) return null;
  return <Bar />;
}

function Bar() {
  const colors = useColors();
  const audio = useAudio();
  const catalog = useCatalog();
  const status = useAudioPlayerStatus(getPlayer());
  const [width, setWidth] = useState(0);
  const [picking, setPicking] = useState(false);
  const path = usePathname();
  const [mappable, setMappable] = useState(false);
  useEffect(() => {
    setMappable(false);
    if (!audio.book) return;
    if (journeysFor(audio.book, audio.chapter).length) setMappable(true);
    else getPlaces(audio.book, audio.chapter).then((p) => setMappable(p.length > 0), () => {});
  }, [audio.book, audio.chapter]);
  const onMap = path.startsWith('/recorrido/');

  const speech = audio.speech;
  const file = audio.audio;
  const playing = speech ? speech.playing : status.playing;
  const now = file ? chapterTime(status.currentTime) : 0;
  const total = file ? chapterDuration(status.duration) : 0;
  const progress = speech ? (speech.index + 1) / Math.max(1, speech.lines.length) : total ? now / total : 0;
  const verse = audio.kind !== 'podcast' ? currentVerse(now) : null;
  const others =
    audio.kind === 'lectura' && file?.version
      ? audio.versions.filter((v) => v.id !== file.version!.id && v[file.testament ?? 'nt'])
      : [];
  const hasDrama = !!audio.book && catalog.dramatizado.includes(recordingId(audio.book, audio.chapter));
  const ready = !!speech || (!!file && !audio.loading);
  const Icon = KIND_ICON[audio.kind];
  const step = speech ? 1 : 10;

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }, fixedInTransition('audio')]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
          <Icon color={colors.accent} size={18} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text, fontFamily: serif }]} numberOfLines={1}>
            {audio.title}
            {verse ? <Text style={{ color: colors.accent, fontFamily: undefined, fontSize: 13 }}>{`  ·  v. ${verse}`}</Text> : null}
          </Text>
          <Subtitle audio={audio} colors={colors} canPick={others.length > 0} onPick={() => setPicking(!picking)} />
        </View>
        {mappable && !onMap && audio.kind !== 'podcast' && (
          <Pressable
            onPress={() => navigate(() => router.push(recorridoHref(audio.book!, audio.chapter) as never), 'forward')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Seguir en el mapa"
            style={({ pressed }) => [styles.mapBtn, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <RouteIcon color={colors.text} size={17} />
            <Text style={[styles.mapText, { color: colors.text }]}>Mapa</Text>
          </Pressable>
        )}
        <Pressable
          onPress={closeAudio}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar el reproductor"
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <CloseIcon color={colors.muted} size={18} />
        </Pressable>
      </View>

      {hasDrama && (audio.kind === 'lectura' || audio.kind === 'dramatizado') && (
        <View style={[styles.switch, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {(
            [
              ['lectura', 'Lectura', () => playChapter(audio.book!, audio.chapter, audio.title)],
              ['dramatizado', 'Dramatizado', () => playDramatized(audio.book!, audio.chapter, audio.title)],
            ] as const
          ).map(([kind, label, play]) => {
            const on = audio.kind === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => !on && play()}
                accessibilityRole="tab"
                aria-selected={on}
                style={[styles.segment, on && { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={{ color: on ? colors.accent : colors.muted, fontWeight: '700', fontSize: 12.5 }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

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
      ) : !ready ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 14 }} />
      ) : (
        <>
          <Pressable
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            onPress={(e) => !speech && width && total && seekChapter((e.nativeEvent.locationX / width) * total)}
            style={styles.trackHit}
            accessibilityRole="adjustable"
            accessibilityLabel={
              speech ? `Intervención ${speech.index + 1} de ${speech.lines.length}` : `Posición ${clock(now)} de ${clock(total)}`
            }
          >
            <View style={[styles.track, { backgroundColor: colors.border }]}>
              <View style={[styles.fill, { backgroundColor: colors.accent, width: `${Math.min(1, progress) * 100}%` }]} />
            </View>
          </Pressable>
          <View style={styles.controls}>
            <Text style={[styles.time, { color: colors.muted }]}>
              {speech ? `${speech.index + 1}/${speech.lines.length}` : clock(now)}
            </Text>
            <Pressable
              onPress={() => setRate(RATES[(RATES.indexOf(audio.rate) + 1) % RATES.length])}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Velocidad ${audio.rate}×. Cambiar`}
              style={({ pressed }) => [styles.rate, { borderColor: colors.border }, pressed && styles.pressed]}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{audio.rate}×</Text>
            </Pressable>
            <Pressable
              onPress={() => seekBy(-step)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={speech ? 'Intervención anterior' : 'Atrás 10 segundos'}
              style={({ pressed }) => [styles.small, pressed && styles.pressed]}
            >
              {speech ? <BackIcon color={colors.text} size={26} /> : <SkipBackIcon color={colors.text} size={28} />}
            </Pressable>
            <Pressable
              onPress={toggle}
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pausa' : 'Reproducir'}
              style={({ pressed }) => [styles.play, { backgroundColor: colors.accent }, pressed && styles.pressed]}
            >
              {!speech && status.isBuffering && !status.playing ? (
                <ActivityIndicator color={colors.surface} />
              ) : playing ? (
                <PauseIcon color={colors.surface} size={20} />
              ) : (
                <PlayIcon color={colors.surface} size={22} />
              )}
            </Pressable>
            <Pressable
              onPress={() => seekBy(step)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={speech ? 'Intervención siguiente' : 'Adelante 10 segundos'}
              style={({ pressed }) => [styles.small, pressed && styles.pressed]}
            >
              {speech ? <ForwardIcon color={colors.text} size={26} /> : <SkipForwardIcon color={colors.text} size={28} />}
            </Pressable>
            <View style={styles.rateSpacer} />
            <Text style={[styles.time, { color: colors.muted, textAlign: 'right' }]}>{speech ? '' : clock(total)}</Text>
          </View>
          {file?.note && <Text style={[styles.note, { color: colors.muted }]}>{file.note}</Text>}
          <Text style={[styles.credit, { color: colors.muted }]} numberOfLines={2}>
            {speech ? 'Voz del dispositivo · guion preparado con IA a partir de las fuentes de la app' : file?.credit}
          </Text>
        </>
      )}
    </View>
  );
}

/** Debajo del título: la versión (que se puede cambiar en la lectura), «Audio dramatizado» o quién habla en el pódcast. */
function Subtitle({ audio, colors, canPick, onPick }: { audio: AudioState; colors: Colors; canPick: boolean; onPick: () => void }) {
  const text = audio.speech ? `Pódcast · habla ${speakerNow(audio.speech)}` : audio.audio?.label;
  if (!text) return null;
  return (
    <Pressable
      onPress={onPick}
      disabled={!canPick}
      accessibilityRole={canPick ? 'button' : undefined}
      accessibilityLabel={canPick ? `Versión del audio: ${text}. Cambiar` : text}
    >
      <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
        {text}
        {canPick ? ' ▾' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, height: 30 },
  mapText: { fontSize: 12.5, fontWeight: '700' },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  switch: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 2,
    marginTop: 10,
  },
  segment: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  versions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  version: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  message: { fontSize: 13, marginVertical: 10 },
  trackHit: { paddingVertical: 9, marginTop: 4 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: 12, width: 44, fontVariant: ['tabular-nums'] },
  rate: { minWidth: 40, borderWidth: 1, borderRadius: 10, paddingVertical: 3, alignItems: 'center' },
  rateSpacer: { minWidth: 40 },
  small: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  play: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  credit: { fontSize: 10, textAlign: 'center', marginTop: 6 },
});
