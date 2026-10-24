import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import Appear from '@/components/Appear';
import StudyPanel from '@/components/StudyPanel';
import { ChevronLeftIcon, HeartIcon, OpenBookIcon, SunIcon } from '@/components/icons';
import { playChapter, useAudioSelect } from '@/lib/audio';
import { lecturaPendiente } from '@/lib/avisos';
import { useAccount } from '@/lib/comunidad';
import { greeting, questionOfTheDay, verseOfTheDay } from '@/lib/daily';
import { Book, getBooks, getChapter } from '@/lib/data';
import { VOLUMEN, VOLUMEN_BAJO, empezarMusica, pararMusica, useDespertador, useMusicaSonando, volumenMusica } from '@/lib/despertar';
import { ModoDespertar } from '@/lib/despertarTexto';
import { callar, narrar } from '@/lib/narrador';
import { todayKey, usePlans } from '@/lib/planes';
import { getLastRead, isDark, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Cuánto suena la música sola antes de que empiece la voz. */
const PRELUDIO_MS = 7000;

/**
 * «Despertar con la Biblia»: lo que se abre al tocar el despertador (o desde una rutina del teléfono que abra
 * /despertar). Amanece en la pantalla, la música sube de a poco y, según lo elegido, se lee el versículo del día
 * o empieza el capítulo que toca. Si el navegador no deja sonar sin un toque, se ofrece «Toca para empezar».
 */
export default function DespertarScreen() {
  const colors = useColors();
  const dark = isDark(colors);
  const { settings } = useSettings();
  const { usuario } = useAccount();
  const despertador = useDespertador();
  const params = useLocalSearchParams<{ modo?: string }>();
  const plans = usePlans();
  const sonando = useMusicaSonando();
  const capitulo = useAudioSelect((s) => s.open && s.kind === 'lectura');
  const { width } = useWindowDimensions();
  const wide = width >= 820;

  const [books, setBooks] = useState<Book[]>([]);
  const [last, setLast] = useState<{ book: string; chapter: number } | null>(null);
  const [verseText, setVerseText] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [devocional, setDevocional] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());
  const empezado = useRef(false);

  const daily = verseOfTheDay();
  const modo: ModoDespertar = (['versiculo', 'lectura', 'musica'] as const).find((m) => m === params.modo) ?? despertador.modo;

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
    getLastRead().then(setLast);
    const t = setInterval(() => setAhora(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    getChapter(daily.book, daily.chapter, settings.version)
      .catch(() => getChapter(daily.book, daily.chapter))
      .then((verses) => setVerseText(verses.find(([n]) => n === daily.verse)?.[1] ?? null))
      .catch(() => setVerseText(null));
  }, [daily.book, daily.chapter, daily.verse, settings.version]);

  // Al salir, la música se apaga despacio y la voz se calla (el capítulo, si suena, sigue en su barra).
  useEffect(
    () => () => {
      callar();
      pararMusica(1.5);
    },
    [],
  );

  const name = (id: string) => books.find((b) => b.id === id)?.name ?? '';
  const ref = books.length ? `${name(daily.book)} ${daily.chapter}:${daily.verse}` : '';
  const lectura = useMemo(() => (books.length ? lecturaPendiente(plans, books, last, todayKey()) : null), [plans, books, last]);
  const lecturaTitulo = lectura ? `${name(lectura[0])} ${lectura[1]}` : null;
  const saludo = `${greeting(ahora)}${usuario?.nombre ? `, ${usuario.nombre.split(' ')[0]}` : ''}`;

  const leerVersiculo = () => {
    if (!verseText) return;
    setLeyendo(true);
    volumenMusica(VOLUMEN_BAJO);
    narrar([`${saludo}. El versículo de hoy está en ${ref}.`, verseText], (i) => {
      if (i !== null) return;
      setLeyendo(false);
      volumenMusica(VOLUMEN, 4);
    });
  };

  const escucharCapitulo = () => {
    if (!lectura || !lecturaTitulo) return;
    callar();
    setLeyendo(false);
    volumenMusica(VOLUMEN_BAJO * 0.7);
    playChapter(lectura[0], lectura[1], lecturaTitulo);
  };

  // La secuencia de la mañana: música; después de un momento, la voz.
  const empezar = async () => {
    if (empezado.current) return;
    const ok = await empezarMusica();
    if (!ok) {
      setBloqueado(true);
      return;
    }
    empezado.current = true;
    setBloqueado(false);
    if (modo === 'musica') return;
    setTimeout(() => {
      if (!empezado.current) return;
      if (modo === 'lectura' && lectura) escucharCapitulo();
      else leerVersiculo();
    }, PRELUDIO_MS);
  };

  // Empieza solo en cuanto tiene el versículo (y el capítulo que toca, si es lo elegido).
  const listo = despertador.ready && Boolean(verseText) && books.length > 0;
  useEffect(() => {
    if (listo) empezar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);

  const toggleMusica = () => {
    if (sonando) {
      empezado.current = true;
      pararMusica();
    } else {
      empezarMusica(4).then((ok) => ok && setBloqueado(false));
    }
  };

  const hora = ahora.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' }).replace(/\s?([ap])\.?\s?m\.?/i, '');
  const fecha = ahora.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const ink = dark ? '#F3EEE6' : '#2A2622';
  const soft = dark ? '#C9C0B3' : '#6A5E50';
  const book = books.find((b) => b.id === daily.book);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false, title: 'Despertar' }} />
      <Amanecer dark={dark} />

      <ScrollView contentContainerStyle={[styles.page, wide && { paddingTop: 40 }]}>
        <View style={styles.top}>
          <Pressable
            onPress={() => navigate(() => (router.canGoBack() ? router.back() : router.replace('/')), 'back')}
            style={({ pressed }) => [styles.chip, chipBg(dark), pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Ir a Hoy"
          >
            <ChevronLeftIcon color={ink} size={18} />
            <Text style={{ color: ink, fontWeight: '600', fontSize: 14 }}>Hoy</Text>
          </Pressable>
          <Pressable
            onPress={toggleMusica}
            style={({ pressed }) => [styles.chip, chipBg(dark), pressed && styles.pressed]}
            accessibilityRole="switch"
            accessibilityState={{ checked: sonando }}
            accessibilityLabel="Música de amanecer"
            testID="musica"
          >
            <Barras color={sonando ? (dark ? '#E2A868' : '#A8641F') : soft} activo={sonando} />
            <Text style={{ color: ink, fontWeight: '600', fontSize: 14 }}>{sonando ? 'Amanecer' : 'Música'}</Text>
          </Pressable>
        </View>

        <Appear>
          <View style={styles.clockWrap} accessibilityRole="header">
            <Text style={[styles.clock, { color: ink }]} testID="reloj">
              {hora}
            </Text>
            <Text style={[styles.date, { color: soft }]}>{fecha[0].toUpperCase() + fecha.slice(1)}</Text>
          </View>
        </Appear>

        <Appear delay={120}>
          <Text style={[styles.hello, { color: ink }]}>{saludo}</Text>
          <Text style={[styles.lead, { color: soft }]}>
            {modo === 'lectura' && lecturaTitulo
              ? `Respira. En un momento empieza ${lecturaTitulo}.`
              : modo === 'musica'
                ? 'Respira. Unos minutos de quietud antes de empezar.'
                : 'Respira. En un momento te leemos el versículo de hoy.'}
          </Text>
        </Appear>

        <Appear delay={220}>
          <View style={[styles.card, cardBg(dark)]} testID="versiculo-despertar">
            <View style={styles.cardHead}>
              <Text style={[styles.kicker, { color: dark ? '#E2A868' : '#A8641F' }]}>Versículo del día</Text>
              {leyendo && <Text style={[styles.reading, { color: soft }]}>Leyendo…</Text>}
            </View>
            <Text style={[styles.verse, { color: ink }]}>{verseText ? `«${verseText}»` : ' '}</Text>
            <Text style={[styles.ref, { color: soft }]}>{ref}</Text>
            <View style={[styles.question, { borderColor: dark ? '#FFFFFF1F' : '#2A262214' }]}>
              <Text style={[styles.qKicker, { color: soft }]}>PARA PENSAR HOY</Text>
              <Text style={{ color: ink, fontSize: 15, lineHeight: 21 }}>{questionOfTheDay()}</Text>
            </View>
          </View>
        </Appear>

        <Appear delay={300}>
          <View style={[styles.actions, wide && { flexDirection: 'row' }]}>
            {lecturaTitulo && (
              <Accion
                dark={dark}
                primary
                icon={<OpenBookIcon color={dark ? '#1A1714' : '#FBF8F3'} size={20} />}
                title={capitulo ? `Escuchando ${lecturaTitulo}` : `Escuchar ${lecturaTitulo}`}
                detail="Lo que toca hoy, leído en voz alta"
                onPress={escucharCapitulo}
              />
            )}
            <Accion
              dark={dark}
              icon={<HeartIcon color={ink} size={20} />}
              title="Haz el devocional"
              detail="10 minutos con el versículo de hoy"
              onPress={() => setDevocional(true)}
            />
            <Accion
              dark={dark}
              icon={<SunIcon color={ink} size={20} />}
              title={leyendo ? 'Leyendo el versículo…' : 'Volver a leer el versículo'}
              detail="Con la voz del teléfono"
              onPress={() => (leyendo ? undefined : (empezarMusica(2), leerVersiculo()))}
            />
          </View>
        </Appear>

        <Pressable
          onPress={() => navigate(() => router.push('/despertador' as never), 'forward')}
          accessibilityRole="link"
          style={({ pressed }) => [styles.settings, pressed && styles.pressed]}
        >
          <Text style={{ color: soft, fontSize: 13 }}>Cambiar la hora o lo que suena ›</Text>
        </Pressable>
      </ScrollView>

      {bloqueado && <TocaParaEmpezar dark={dark} saludo={saludo} onPress={empezar} />}

      {devocional && book && (
        <StudyPanel book={book} chapter={daily.chapter} verse={daily.verse} enfoque="devocional" onClose={() => setDevocional(false)} />
      )}
    </View>
  );
}

const chipBg = (dark: boolean) => ({ backgroundColor: dark ? '#FFFFFF14' : '#FFFFFF99', borderColor: dark ? '#FFFFFF1F' : '#2A262214' });
const cardBg = (dark: boolean) => ({
  backgroundColor: dark ? '#1C1A18D9' : '#FFFFFFD9',
  borderColor: dark ? '#FFFFFF1A' : '#2A262212',
  ...(Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(14px)', boxShadow: dark ? '0 18px 50px rgba(0,0,0,.45)' : '0 18px 50px rgba(120,70,20,.14)' } as object)
    : {}),
});

/** El cielo: de la noche (o del papel) a un horizonte ámbar, con un sol que sube despacio. */
function Amanecer({ dark }: { dark: boolean }) {
  const { width, height } = useWindowDimensions();
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) return rise.setValue(1);
        anim = Animated.timing(rise, { toValue: 1, duration: 45_000, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
        anim.start();
      });
    return () => anim?.stop();
  }, [rise]);

  const sky = dark ? ['#0E0E0E', '#15130F', '#2B1D10'] : ['#F9F8F6', '#F8EEDF', '#F2D6AE'];
  const sun = dark ? '#E2A868' : '#EDA457';
  const size = Math.max(width, height) * 1.1;
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [size * 0.32, 0] });
  const opacity = rise.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky[0]} />
            <Stop offset="0.55" stopColor={sky[1]} />
            <Stop offset="1" stopColor={sky[2]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#cielo)" />
      </Svg>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          left: (width - size) / 2,
          top: height - size * 0.42,
          opacity,
          transform: [{ translateY }],
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="sol" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={sun} stopOpacity={dark ? 0.55 : 0.6} />
              <Stop offset="0.12" stopColor={sun} stopOpacity={dark ? 0.32 : 0.38} />
              <Stop offset="0.45" stopColor={sun} stopOpacity={dark ? 0.1 : 0.14} />
              <Stop offset="1" stopColor={sun} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#sol)" />
          <Circle cx="50" cy="50" r="5.5" fill={sun} opacity={dark ? 0.8 : 0.85} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Tres barritas que se mueven mientras suena la música. */
function Barras({ color, activo }: { color: string; activo: boolean }) {
  const v = useRef([0, 1, 2].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    if (!activo) {
      v.forEach((x) => x.setValue(0.4));
      return;
    }
    const loops = v.map((x, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(x, { toValue: 1, duration: 520 + i * 140, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(x, { toValue: 0.3, duration: 520 + i * 140, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [activo, v]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 14 }}>
      {v.map((x, i) => (
        <Animated.View key={i} style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: color, transform: [{ scaleY: x }] }} />
      ))}
    </View>
  );
}

function Accion({
  dark,
  primary,
  icon,
  title,
  detail,
  onPress,
}: {
  dark: boolean;
  primary?: boolean;
  icon: ReactNode;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const bg = primary ? (dark ? '#E6E3DE' : '#2A2826') : dark ? '#FFFFFF12' : '#FFFFFFB3';
  const ink = primary ? (dark ? '#1A1714' : '#FBF8F3') : dark ? '#F3EEE6' : '#2A2622';
  const sub = primary ? (dark ? '#4A443D' : '#D6D1C9') : dark ? '#B5AC9F' : '#6A5E50';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.accion,
        { backgroundColor: bg, borderColor: primary ? 'transparent' : dark ? '#FFFFFF1A' : '#2A262214' },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.accionIcon, { backgroundColor: primary ? (dark ? '#00000014' : '#FFFFFF1A') : dark ? '#FFFFFF0F' : '#2A26220A' }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: ink, fontWeight: '700', fontSize: 15 }}>{title}</Text>
        <Text style={{ color: sub, fontSize: 13, marginTop: 2 }}>{detail}</Text>
      </View>
    </Pressable>
  );
}

/** Cuando el navegador no deja sonar sin un toque: un sol grande para empezar. */
function TocaParaEmpezar({ dark, saludo, onPress }: { dark: boolean; saludo: string; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const sun = dark ? '#E2A868' : '#EDA457';
  return (
    <Pressable
      onPress={onPress}
      style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: dark ? '#0E0E0EE6' : '#F9F5EEEB' }]}
      accessibilityRole="button"
      accessibilityLabel="Toca para empezar"
      testID="toca-para-empezar"
    >
      <Animated.View style={[styles.sunButton, { backgroundColor: sun, transform: [{ scale }] }]}>
        <SunIcon color={dark ? '#1A1714' : '#3A2410'} size={44} strokeWidth={1.8} />
      </Animated.View>
      <Text style={[styles.hello, { color: dark ? '#F3EEE6' : '#2A2622', marginTop: 28, textAlign: 'center' }]}>{saludo}</Text>
      <Text style={{ color: dark ? '#C9C0B3' : '#6A5E50', fontSize: 16, marginTop: 8, textAlign: 'center' }}>
        Toca para empezar con música suave
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 16, paddingBottom: 120, maxWidth: 760, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  clockWrap: { alignItems: 'center', marginTop: 28 },
  clock: { fontFamily: serif, fontSize: 84, lineHeight: 96, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  date: { fontSize: 15, marginTop: 2, letterSpacing: 0.2 },
  hello: { fontFamily: serif, fontSize: 30, textAlign: 'center', marginTop: 26 },
  lead: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 6 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 22, marginTop: 26 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9 },
  reading: { fontSize: 12, fontStyle: 'italic' },
  verse: { fontFamily: serif, fontSize: 23, lineHeight: 34, marginTop: 12 },
  ref: { fontSize: 14, marginTop: 10, fontWeight: '600' },
  question: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 14 },
  qKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  actions: { gap: 10, marginTop: 18 },
  accion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  accionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settings: { alignSelf: 'center', marginTop: 22, padding: 8 },
  overlay: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  sunButton: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
});

