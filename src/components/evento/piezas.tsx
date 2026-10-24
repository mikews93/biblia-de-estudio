// Piezas de las pantallas de eventos de iglesia (src/app/evento, src/app/eventos.tsx): seguir el evento en vivo,
// el punto que late de «En vivo» y los versículos que se abren dentro del punto.
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, ChurchIcon } from '@/components/icons';
import { CreditoVersion, useVersion } from '@/components/vivo/Guion';
import { useAccount } from '@/lib/comunidad';
import { Book, getChapter } from '@/lib/data';
import { Evento, EstadoEvento, EventoError, leerCita, recordarEvento, useMisEventos, verEvento, verMiEvento } from '@/lib/eventos';
import { verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Cada cuánto se pregunta en qué va el evento, según su estado (en ms; null: ya no se pregunta). */
const CADA: Record<EstadoEvento, number | null> = { 'en-vivo': 4000, pronto: 15000, terminado: null };

/**
 * El evento al día: se pide al abrir y luego cada pocos segundos mientras está en vivo (no con la app en segundo
 * plano). Quien lo publicó lo pide sin la caché del CDN, para ver al instante lo que mueve desde otro dispositivo.
 */
export function useEventoEnVivo(codigo: string) {
  const { usuario } = useAccount();
  const { eventos: mios } = useMisEventos(!!usuario);
  const propio = !!mios?.some((e) => e.codigo === codigo);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [error, setError] = useState<EventoError | null>(null);
  const [activa, setActiva] = useState(true);
  const ultimo = useRef<string | null>(null);

  const aplicar = useCallback((e: Evento) => {
    // Las respuestas pueden llegar desordenadas: nunca se vuelve a una más vieja.
    if (ultimo.current && e.actualizado < ultimo.current) return;
    ultimo.current = e.actualizado;
    setEvento(e);
    setError(null);
    recordarEvento(e);
  }, []);

  const pedir = useCallback(
    () =>
      (propio ? verMiEvento(codigo) : verEvento(codigo)).then(aplicar).catch((e) => {
        // Sin red se deja lo último que llegó y se vuelve a intentar en la siguiente vuelta (la red de la iglesia).
        if (e instanceof EventoError && e.status !== 0) setError(e);
      }),
    [codigo, propio, aplicar],
  );

  useEffect(() => {
    pedir();
  }, [pedir]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActiva(s === 'active'));
    if (Platform.OS !== 'web' || typeof document === 'undefined') return () => sub.remove();
    const vis = () => setActiva(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', vis);
    return () => {
      sub.remove();
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  // Mientras la congregación responde algo, más seguido: así el conteo y lo revelado llegan casi al instante.
  const cada = evento ? (evento.interaccion && evento.estado === 'en-vivo' ? 2500 : CADA[evento.estado]) : null;
  useEffect(() => {
    if (!cada || !activa) return;
    pedir();
    const t = setInterval(pedir, cada);
    return () => clearInterval(t);
  }, [cada, activa, pedir]);

  return { evento, error, propio, aplicar, recargar: pedir };
}

/** El punto que late junto a «EN VIVO». */
export function LiveDot({ color, size = 8 }: { color: string; size?: number }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ width: size * 2.2, height: size * 2.2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 2.2,
          height: size * 2.2,
          borderRadius: size * 1.1,
          backgroundColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.3] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.1] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

/** La etiqueta del estado: «En vivo», «Empieza pronto» o «Terminó». */
export function EstadoPill({ estado, colors }: { estado: EstadoEvento; colors: Colors }) {
  const vivo = estado === 'en-vivo';
  return (
    <View style={[styles.pill, { backgroundColor: vivo ? colors.warmSoft : colors.accentSoft }]}>
      {vivo ? <LiveDot color={colors.warm} size={7} /> : <View style={[styles.still, { backgroundColor: colors.muted }]} />}
      <Text style={{ color: vivo ? colors.warm : colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
        {vivo ? 'EN VIVO' : estado === 'pronto' ? 'EMPIEZA PRONTO' : 'TERMINÓ'}
      </Text>
    </View>
  );
}

/**
 * Una cita del punto: al tocarla se abren sus versículos ahí mismo, con un enlace al capítulo. Se leen en la versión
 * de quien predica (`version`); las con derechos se piden en el momento, como en el lector, y si no se puede, la RV1909.
 */
export function CitaDesplegable({ label, books, size = 16, version = 'rv1909' }: { label: string; books: Book[]; size?: number; version?: string }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  // Lo leído, con la versión que se pidió (para pedirlo otra vez si cambia) y la que llegó.
  const [leido, setLeido] = useState<{ pedida: string; shown: string; verses: [number, string][] } | null>(null);
  const verses = leido?.pedida === version ? leido.verses : null;
  const shown = leido?.pedida === version ? leido.shown : version;
  const { abbr } = useVersion(shown);
  const cita = books.length ? leerCita(label, books) : null;

  useEffect(() => {
    if (!open || !cita || verses) return;
    const elegir = (v: [number, string, string?][]) =>
      v.filter(([n]) => !cita.from || (n >= cita.from && n <= (cita.to ?? cita.from))).map(([n, t]): [number, string] => [n, t]);
    getChapter(cita.book, cita.chapter, version)
      .then((v) => setLeido({ pedida: version, shown: version, verses: elegir(v) }))
      .catch(() => getChapter(cita.book, cita.chapter).then((v) => setLeido({ pedida: version, shown: 'rv1909', verses: elegir(v) })))
      .catch(() => setLeido({ pedida: version, shown: version, verses: [] }));
  }, [open, version, cita?.book, cita?.chapter, cita?.from, cita?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cita) return null;
  const Chevron = open ? ChevronUpIcon : ChevronDownIcon;
  return (
    <View style={[styles.cita, { borderColor: open ? colors.accent : colors.border, backgroundColor: open ? colors.surface : 'transparent' }, open && styles.citaOpen]}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}${open ? ', cerrar' : ', leer'}`}
        style={styles.citaHead}
      >
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>{label}</Text>
        <Chevron color={colors.accent} size={15} strokeWidth={2} />
      </Pressable>
      {open && (
        <View style={styles.citaBody}>
          {verses === null ? (
            <ActivityIndicator color={colors.accent} />
          ) : verses.length === 0 ? (
            <Text style={{ color: colors.muted }}>No se pudo abrir este pasaje.</Text>
          ) : (
            <Text style={{ color: colors.text, fontFamily: serif, fontSize: size, lineHeight: size * 1.55 }}>
              {verses.map(([n, t]) => (
                <Text key={n}>
                  <Text style={{ color: colors.muted, fontSize: size * 0.62, fontWeight: '700' }}>{n} </Text>
                  {t}{' '}
                </Text>
              ))}
            </Text>
          )}
          <Pressable
            onPress={() => navigate(() => router.push(verseHref(cita.book, cita.chapter, cita.from ?? 1)), 'forward')}
            hitSlop={6}
            style={{ marginTop: 10 }}
          >
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>{abbr} · Abrir en la Biblia ›</Text>
          </Pressable>
          <CreditoVersion version={shown} style={{ marginTop: 8 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 14, paddingLeft: 6, paddingRight: 11, paddingVertical: 3 },
  still: { width: 7, height: 7, borderRadius: 4, marginHorizontal: 4.5 },
  cita: { borderWidth: 1, borderRadius: 18, alignSelf: 'flex-start' },
  citaOpen: { alignSelf: 'stretch', width: '100%', borderRadius: 14 },
  citaHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  citaBody: { paddingHorizontal: 14, paddingBottom: 14 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  entryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

/** La entrada a los eventos desde Comunidad: unirse con el código que se ve en la iglesia. */
export function EntradaEventos({ style }: { style?: object }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => navigate(() => router.push('/eventos'), 'forward')}
      accessibilityRole="link"
      style={({ pressed }) => [styles.entry, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.75 }, style]}
    >
      <View style={[styles.entryIcon, { backgroundColor: colors.warmSoft }]}>
        <ChurchIcon color={colors.warm} size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Eventos de la iglesia</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>Sigue el mensaje en vivo con el código de la pantalla</Text>
      </View>
      <ChevronRightIcon color={colors.muted} size={18} />
    </Pressable>
  );
}
