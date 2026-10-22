// /recorrido/hechos/13: el mapa que sigue la lectura. Mientras suena el capítulo (lectura o dramatizado) la cámara va
// a cada lugar que se nombra; en los recorridos (el Éxodo, los viajes de Pablo, Jesús en Galilea) un marcador sigue
// el camino parada por parada. Sin audio se avanza a mano.
import { useAudioPlayerStatus } from 'expo-audio';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Appear from '@/components/Appear';
import JourneyMap from '@/components/JourneyMap';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, DramaIcon, ListenIcon, PauseIcon, PlayIcon, RouteIcon } from '@/components/icons';
import {
  chapterDuration,
  chapterTime,
  closeAudio,
  currentVerse,
  getPlayer,
  playChapter,
  playDramatized,
  recordingId,
  seekChapter,
  toggle,
  useAudio,
  useCatalog,
} from '@/lib/audio';
import { Book, Place, Verse, getBasemap, getBooks, getChapter, getPlaces } from '@/lib/data';
import {
  ResolvedStop,
  distanceKm,
  estimateVerse,
  formatKm,
  journeyAt,
  journeysFor,
  recorridoHref,
  resolveStops,
  splitPlaces,
  stopIndexAt,
} from '@/lib/recorridos';
import { bookIdFromParam, verseHref } from '@/lib/routes';
import { huella, huellaLugar } from '@/lib/sellos';
import { Colors, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export default function Recorrido() {
  const params = useLocalSearchParams<{ book: string; chapter: string; v?: string }>();
  const bookId = bookIdFromParam(params.book);
  const chapter = Number(params.chapter);
  const colors = useColors();
  const { settings } = useSettings();
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;

  const [books, setBooks] = useState<Book[]>([]);
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [resolved, setResolved] = useState<Record<string, ResolvedStop[]>>({});
  const journeys = useMemo(() => journeysFor(bookId, chapter), [bookId, chapter]);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);
  useEffect(() => {
    setVerses(null);
    setPlaces(null);
    getChapter(bookId, chapter, settings.version)
      .catch(() => getChapter(bookId, chapter))
      .then(setVerses)
      .catch(() => setVerses([]));
    getPlaces(bookId, chapter).then(setPlaces);
  }, [bookId, chapter, settings.version]);
  useEffect(() => {
    if (!journeys.length) return;
    getBasemap()
      .then((b) => b.land)
      .catch(() => [])
      .then((land) => Promise.all(journeys.map(async (j) => [j.id, await resolveStops(j, land)] as const)))
      .then((list) => setResolved(Object.fromEntries(list)));
  }, [journeys]);

  const book = books.find((b) => b.id === bookId);
  const title = book ? `${book.name} ${chapter}` : '';

  // El versículo que se sigue: el que suena si el reproductor está en este capítulo; si no, el que se elige a mano.
  const audio = useAudio();
  const catalog = useCatalog();
  const status = useAudioPlayerStatus(getPlayer());
  const following = audio.open && audio.book === bookId && audio.chapter === chapter && audio.kind !== 'podcast' && !!audio.audio;
  const now = following ? chapterTime(status.currentTime) : 0;
  const total = following ? chapterDuration(status.duration) : 0;
  const stamps = following ? audio.audio!.timestamps : [];
  const live = following
    ? (currentVerse(now) ?? (verses && total ? estimateVerse(now / total, verses) : null))
    : null;

  const firstVerse = () => {
    if (params.v) return Number(params.v);
    const inChapter = journeys.flatMap((j) => j.stops).filter((st) => st.book === bookId && st.chapter === chapter);
    if (inChapter.length) return Math.min(...inChapter.map((st) => st.verse));
    return places?.length ? Math.min(...places.flatMap((p) => p.verses)) : 1;
  };
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [bookId, chapter]);
  useEffect(() => {
    if (live) setPicked(live);
  }, [live]);
  const verse = live ?? picked ?? firstVerse();

  const journey = journeyAt(journeys, bookId, chapter, verse);
  const stops = journey ? resolved[journey.id] : undefined;
  const current = stops ? stopIndexAt(stops, bookId, chapter, verse) : -1;
  const stop = stops && current >= 0 ? stops[current] : null;
  const inVerse = (places ?? []).filter((p) => p.verses.includes(verse));
  const text = verses?.find(([n]) => n === verse)?.[1] ?? '';

  const hasDrama = catalog.dramatizado.includes(recordingId(bookId, chapter));
  const playing = following && status.playing;
  const [trackWidth, setTrackWidth] = useState(0);

  /** Ir a un versículo: si suena el capítulo, el audio salta allí; si no, el mapa avanza a mano. */
  const goTo = (n: number) => {
    if (following) {
      const at = stamps.find(([v]) => v === n)?.[1];
      if (at !== undefined) return seekChapter(at);
      if (verses && total) {
        const all = verses.reduce((s, [, t]) => s + t.length, 0);
        const before = verses.filter(([v]) => v < n).reduce((s, [, t]) => s + t.length, 0);
        return seekChapter((before / all) * total);
      }
    }
    setPicked(n);
  };
  const openChapter = (b: string, ch: number, v: number) =>
    navigate(() => router.replace(recorridoHref(b, ch, v) as never), 'forward');
  const goStop = (i: number) => {
    if (!stops?.[i]) return;
    const st = stops[i];
    if (st.book !== bookId || st.chapter !== chapter) return openChapter(st.book, st.chapter, st.verse);
    goTo(st.verse);
  };

  // Sin recorrido: los versículos que nombran algún lugar, en orden
  const placeVerses = useMemo(() => [...new Set((places ?? []).flatMap((p) => p.verses))].sort((a, b) => a - b), [places]);
  const step = (dir: 1 | -1) => {
    if (stops?.length) {
      // Paradas distintas en el mismo versículo (Hechos 14:21) se recorren solas mientras suena
      let i = current + dir;
      while (stops[i] && stops[i].book === bookId && stops[i].chapter === chapter && stops[i].verse === verse) i += dir;
      if (i < 0) i = 0;
      return goStop(Math.min(i, stops.length - 1));
    }
    const list = dir > 0 ? placeVerses.filter((v) => v > verse) : placeVerses.filter((v) => v < verse).reverse();
    if (list.length) goTo(list[0]);
  };
  const canBack = stops?.length ? current > 0 : placeVerses.some((v) => v < verse);
  const canNext = stops?.length ? current < stops.length - 1 : placeVerses.some((v) => v > verse);

  // Paradas que caen en un mismo versículo: mientras suena ese versículo el marcador las recorre una tras otra.
  const [sub, setSub] = useState(0);
  const sameVerse = stops ? stops.filter((st) => st.book === bookId && st.chapter === chapter && st.verse === verse).length : 0;
  useEffect(() => {
    setSub(0);
    if (sameVerse < 2) return;
    const id = setInterval(() => setSub((x) => Math.min(sameVerse - 1, x + 1)), 2600);
    return () => clearInterval(id);
  }, [verse, sameVerse]);
  const shown = stops && current >= 0 && sameVerse > 1 ? current - (sameVerse - 1) + sub : current;
  const shownStop = stops && shown >= 0 ? stops[shown] : stop;

  const km = stops && shown > 0 ? distanceKm(stops, shown) : 0;
  const totalKm = stops ? distanceKm(stops) : 0;
  const names = [...(stops ?? []).map((st) => st.name), ...(places ?? []).map((p) => p.name.replace(/ \(.*\)$/, ''))];

  const mapHeight = wide ? Math.max(460, height - 150) : Math.round(Math.min(Math.max(300, height * 0.42), 480));
  const nextChapter = stops && shown === stops.length - 1 ? null : stops?.find((st, i) => i > shown && (st.book !== bookId || st.chapter !== chapter));
  const lastInChapter = stops ? !stops.some((st, i) => i > shown && st.book === bookId && st.chapter === chapter) : false;

  // El pasaporte de Mis sellos: los lugares por los que pasa la lectura, y el recorrido seguido hasta el final
  const lugaresAqui = [...inVerse.map((p) => p.name), ...(shownStop ? [shownStop.name] : [])].join('|');
  useEffect(() => {
    if (lugaresAqui) lugaresAqui.split('|').forEach(huellaLugar);
  }, [lugaresAqui]);
  const viajeCompleto = !!journey && !!stops?.length && shown === stops.length - 1 ? journey.id : null;
  useEffect(() => {
    if (viajeCompleto) huella('viaje', viajeCompleto);
  }, [viajeCompleto]);

  const map = (
    <View>
      <JourneyMap
        colors={colors}
        height={mapHeight}
        stops={stops}
        current={shown}
        places={journey ? [] : (places ?? [])}
        highlighted={inVerse.map((p) => p.id)}
        onStop={goStop}
        onPlace={(p) => goTo(p.verses.find((v) => v >= verse) ?? p.verses[0])}
      />
      <Appear style={styles.overlay} key={journey?.id ?? 'lugares'}>
        <View style={[styles.overlayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.warm }]} numberOfLines={1}>
            {journey ? `${journey.title}${stops && shown >= 0 ? `  ·  ${shown + 1} de ${stops.length}` : ''}` : `Lugares de ${title}`}
          </Text>
          <Text style={[styles.overlayName, { color: colors.text, fontFamily: serif }]} numberOfLines={1}>
            {journey
              ? (shownStop?.name ?? 'Antes de partir')
              : inVerse.length
                ? inVerse.map((p) => p.name.replace(/ \(.*\)$/, '')).join(', ')
                : `${places?.length ?? 0} lugares en el capítulo`}
          </Text>
          {journey && shownStop && shown >= 0 ? (
            <Text style={[styles.overlayNote, { color: colors.muted }]} numberOfLines={2}>
              {shownStop.note}
            </Text>
          ) : !journey && !inVerse.length ? (
            <Text style={[styles.overlayNote, { color: colors.muted }]} numberOfLines={2}>
              Este versículo no nombra lugares.
            </Text>
          ) : null}
        </View>
      </Appear>
    </View>
  );

  const itinerary = stops && stops.length > 0 && (
    <Itinerary stops={stops} current={shown} colors={colors} vertical={wide} onStop={goStop} here={{ book: bookId, chapter }} />
  );

  const card = (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHead}>
        <LiveDot on={playing} colors={colors} />
        <Text style={[styles.liveText, { color: following ? colors.warm : colors.muted }]} numberOfLines={1}>
          {following
            ? `${playing ? 'Siguiendo' : 'En pausa'} · ${audio.kind === 'dramatizado' ? 'audio dramatizado' : 'lectura'}`
            : 'A tu ritmo'}
        </Text>
        <Text style={[styles.ref, { color: colors.muted }]}>
          {book ? `${book.abbr ?? book.name} ${chapter}:${verse}` : ''}
        </Text>
      </View>
      <Text
        style={[styles.verse, { color: colors.text, fontFamily: serif }]}
        accessibilityLiveRegion="polite"
        key={verse}
      >
        {splitPlaces(text, names).map((part, i) =>
          part.place ? (
            <Text key={i} style={{ color: colors.warm, fontWeight: '700' }}>
              {part.text}
            </Text>
          ) : (
            part.text
          ),
        )}
      </Text>
      <View style={styles.controls}>
        <RoundButton disabled={!canBack} onPress={() => step(-1)} colors={colors} label={stops?.length ? 'Parada anterior' : 'Lugar anterior'}>
          <ChevronLeftIcon color={canBack ? colors.text : colors.border} size={22} />
        </RoundButton>
        <Pressable
          onPress={() => (following ? toggle() : hasDrama ? playDramatized(bookId, chapter, title) : playChapter(bookId, chapter, title))}
          style={({ pressed }) => [styles.play, { backgroundColor: colors.accent }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pausa' : following ? 'Seguir escuchando' : hasDrama ? 'Escuchar el capítulo dramatizado' : 'Escuchar el capítulo'}
        >
          {playing ? <PauseIcon color={colors.surface} size={18} /> : <PlayIcon color={colors.surface} size={18} />}
          <Text style={[styles.playText, { color: colors.surface }]}>
            {playing ? 'Pausa' : following ? 'Seguir' : hasDrama ? 'Escuchar dramatizado' : 'Escuchar y seguir'}
          </Text>
        </Pressable>
        <RoundButton disabled={!canNext} onPress={() => step(1)} colors={colors} label={stops?.length ? 'Parada siguiente' : 'Lugar siguiente'}>
          <ChevronRightIcon color={canNext ? colors.text : colors.border} size={22} />
        </RoundButton>
      </View>
      {following && (
        <View style={styles.progressRow}>
          <Text style={[styles.time, { color: colors.muted }]}>{clock(now)}</Text>
          <Pressable
            style={styles.trackHit}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            onPress={(e) => trackWidth && total && seekChapter((e.nativeEvent.locationX / trackWidth) * total)}
            accessibilityRole="adjustable"
            accessibilityLabel={`Posición ${clock(now)} de ${clock(total)}`}
          >
            <View style={[styles.track, { backgroundColor: colors.border }]}>
              <View style={[styles.fill, { backgroundColor: colors.warm, width: `${total ? Math.min(1, now / total) * 100 : 0}%` }]} />
            </View>
          </Pressable>
          <Text style={[styles.time, { color: colors.muted, textAlign: 'right' }]}>{clock(total)}</Text>
          <Pressable onPress={closeAudio} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dejar de escuchar" style={styles.stop}>
            <CloseIcon color={colors.muted} size={16} />
          </Pressable>
        </View>
      )}
      {!following && hasDrama && (
        <Pressable onPress={() => playChapter(bookId, chapter, title)} style={styles.alt} accessibilityRole="button">
          <ListenIcon color={colors.muted} size={15} />
          <Text style={[styles.altText, { color: colors.muted }]}>O escucha la lectura sin dramatizar</Text>
        </Pressable>
      )}
      {following && audio.kind === 'lectura' && hasDrama && (
        <Pressable onPress={() => playDramatized(bookId, chapter, title)} style={styles.alt} accessibilityRole="button">
          <DramaIcon color={colors.muted} size={15} />
          <Text style={[styles.altText, { color: colors.muted }]}>Cambiar al audio dramatizado</Text>
        </Pressable>
      )}
    </View>
  );

  const details = (
    <>
      {journey && stops && (
        <View style={styles.section}>
          <View style={styles.stats}>
            <Stat value={`${Math.max(0, shown + 1)}`} label={`de ${stops.length} paradas`} colors={colors} />
            <Stat value={`${formatKm(km)} km`} label={`de unos ${formatKm(totalKm)} km`} colors={colors} />
          </View>
          <Text style={[styles.small, { color: colors.muted }]}>Distancias en línea recta entre paradas; el camino real era más largo.</Text>
          <Text style={[styles.intro, { color: colors.text }]}>{journey.intro}</Text>
        </View>
      )}
      {nextChapter && lastInChapter && (
        <Pressable
          onPress={() => openChapter(nextChapter.book, nextChapter.chapter, nextChapter.verse)}
          style={({ pressed }) => [styles.next, { backgroundColor: colors.warmSoft }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.nextKicker, { color: colors.warm }]}>El viaje continúa</Text>
            <Text style={[styles.nextTitle, { color: colors.text, fontFamily: serif }]}>
              {books.find((b) => b.id === nextChapter.book)?.name} {nextChapter.chapter} · {nextChapter.name}
            </Text>
          </View>
          <ChevronRightIcon color={colors.warm} size={22} />
        </Pressable>
      )}
      <View style={styles.links}>
        <Pressable
          onPress={() => navigate(() => router.push(verseHref(bookId, chapter, verse) as never), 'forward')}
          style={({ pressed }) => [styles.link, { borderColor: colors.border }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.linkText, { color: colors.text }]}>Leer {title}:{verse}</Text>
        </Pressable>
        <Pressable
          onPress={() => navigate(() => router.push('/recorridos' as never), 'forward')}
          style={({ pressed }) => [styles.link, { borderColor: colors.border }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <RouteIcon color={colors.text} size={16} />
          <Text style={[styles.linkText, { color: colors.text }]}>Todos los recorridos</Text>
        </Pressable>
      </View>
      <Text style={[styles.credit, { color: colors.muted }]}>
        Lugares: OpenBible.info Bible Geocoding Data (CC BY 4.0). Costas: Natural Earth. Ríos y lagos: © colaboradores de
        OpenStreetMap (ODbL). Las ubicaciones discutidas siguen la identificación más aceptada.
      </Text>
    </>
  );

  const empty = places && !places.length && !journeys.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: journey ? journey.title : title ? `${title} en el mapa` : 'En el mapa' }} />
      {empty ? (
        <View style={styles.emptyBox}>
          <RouteIcon color={colors.muted} size={36} />
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: serif }]}>{title} no nombra lugares</Text>
          <Text style={[styles.small, { color: colors.muted, textAlign: 'center' }]}>
            Prueba con un recorrido: el Éxodo, Jesús en Galilea o los viajes de Pablo.
          </Text>
          <Pressable onPress={() => router.replace('/recorridos' as never)} style={[styles.link, { borderColor: colors.border, marginTop: 16 }]}>
            <Text style={[styles.linkText, { color: colors.text }]}>Ver los recorridos</Text>
          </Pressable>
        </View>
      ) : wide ? (
        <View style={styles.wide}>
          <View style={{ flex: 1.55 }}>{map}</View>
          <ScrollView style={styles.side} contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
            {card}
            {itinerary}
            {details}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {map}
          {itinerary}
          {card}
          {details}
        </ScrollView>
      )}
    </View>
  );
}

/** Las paradas en fila (teléfono) o en columna (escritorio). La actual queda siempre a la vista. */
function Itinerary({
  stops,
  current,
  colors,
  vertical,
  onStop,
  here,
}: {
  stops: ResolvedStop[];
  current: number;
  colors: Colors;
  vertical: boolean;
  onStop: (i: number) => void;
  here: { book: string; chapter: number };
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const spots = useRef<Record<number, number>>({});
  const reveal = (animated: boolean) => {
    const at = spots.current[current];
    if (at === undefined) return;
    scroll.current?.scrollTo(vertical ? { y: Math.max(0, at - 90), animated } : { x: Math.max(0, at - 24), animated });
  };
  useEffect(() => reveal(true));

  const items = stops.map((st, i) => {
    const on = i === current;
    const done = i < current;
    const away = st.book !== here.book || st.chapter !== here.chapter;
    return (
      <Pressable
        key={i}
        onLayout={(e) => {
          spots.current[i] = vertical ? e.nativeEvent.layout.y : e.nativeEvent.layout.x;
          if (i === current) reveal(false);
        }}
        onPress={() => onStop(i)}
        accessibilityRole="button"
        accessibilityLabel={`Parada ${i + 1}: ${st.name}, capítulo ${st.chapter} versículo ${st.verse}`}
        style={({ pressed }) => [
          vertical ? styles.row : styles.chip,
          { borderColor: on ? colors.warm : colors.border, backgroundColor: on ? colors.warmSoft : colors.surface },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.num, { backgroundColor: on || done ? colors.warm : 'transparent', borderColor: on || done ? colors.warm : colors.muted }]}>
          <Text style={[styles.numText, { color: on || done ? colors.surface : colors.muted }]}>{i + 1}</Text>
        </View>
        <View style={vertical ? { flex: 1 } : undefined}>
          <Text style={[styles.chipName, { color: away && !on ? colors.muted : colors.text }]} numberOfLines={1}>
            {st.name}
          </Text>
          <Text style={[styles.chipRef, { color: colors.muted }]} numberOfLines={vertical ? 2 : 1}>
            {vertical ? `${st.chapter}:${st.verse} · ${st.note}` : `${st.chapter}:${st.verse}`}
          </Text>
        </View>
      </Pressable>
    );
  });
  return vertical ? (
    <ScrollView ref={scroll} style={[styles.list, { borderColor: colors.border }]} contentContainerStyle={{ gap: 6, padding: 6 }}>
      {items}
    </ScrollView>
  ) : (
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} style={styles.stripWrap}>
      {items}
    </ScrollView>
  );
}

function LiveDot({ on, colors }: { on: boolean; colors: Colors }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => {
      loop.stop();
      t.setValue(0);
    };
  }, [on, t]);
  return (
    <View style={styles.dotWrap}>
      {on && (
        <Animated.View
          style={[
            styles.dotRing,
            {
              borderColor: colors.warm,
              opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
              transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] }) }],
            },
          ]}
        />
      )}
      <View style={[styles.dot, { backgroundColor: on ? colors.warm : colors.border }]} />
    </View>
  );
}

function RoundButton({ children, onPress, disabled, colors, label }: { children: React.ReactNode; onPress: () => void; disabled: boolean; colors: Colors; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

function Stat({ value, label, colors }: { value: string; label: string; colors: Colors }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.text, fontFamily: serif }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 56, maxWidth: 760, width: '100%', alignSelf: 'center', gap: 14 },
  wide: { flex: 1, flexDirection: 'row', gap: 20, padding: 20, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  side: { flex: 1, maxWidth: 440 },
  overlay: { position: 'absolute', left: 12, top: 12, right: 60 },
  overlayCard: {
    alignSelf: 'flex-start',
    maxWidth: 380,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  overlayName: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  overlayNote: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  list: { maxHeight: 330, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  stripWrap: { marginHorizontal: -16 },
  strip: { paddingHorizontal: 16, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingLeft: 8, paddingRight: 12, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  num: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chipName: { fontSize: 14, fontWeight: '700' },
  chipRef: { fontSize: 11.5, marginTop: 1 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveText: { flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  ref: { fontSize: 13, fontWeight: '700' },
  verse: { fontSize: 19, lineHeight: 30, marginTop: 12, minHeight: 60 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 12 },
  round: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  play: { flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  playText: { fontSize: 15, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  time: { fontSize: 11.5, width: 34, fontVariant: ['tabular-nums'] },
  trackHit: { flex: 1, paddingVertical: 8 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  stop: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  alt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  altText: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotRing: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  section: { gap: 10, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, paddingHorizontal: 14 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12.5, marginTop: 2 },
  small: { fontSize: 12, lineHeight: 17 },
  intro: { fontSize: 15.5, lineHeight: 24 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  nextKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  nextTitle: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  linkText: { fontSize: 13.5, fontWeight: '600' },
  credit: { fontSize: 11, lineHeight: 16 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
});
