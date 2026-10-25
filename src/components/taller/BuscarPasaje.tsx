// Elegir el pasaje de un mensaje del Taller como en el buscador general (/buscar): una cita («Lc 15:11-32»,
// «primera de Juan 4») se reconoce al escribirla o dictarla; unas palabras o una idea («el hijo que vuelve a casa»,
// «cuando Dios parece tardar») se buscan con IA y se elige uno de los pasajes que encuentra.
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, CloseIcon, MicIcon, SearchIcon, SparkIcon } from '@/components/icons';
import { type IdeaResult, searchByIdea, withVersion } from '@/lib/buscar';
import { citaLabel, parseCita } from '@/lib/cita';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { NEEDS_CONNECTION } from '@/lib/conexion';
import { type Book, getChapter } from '@/lib/data';
import { licensedById } from '@/lib/licenciadas';
import { parseRef } from '@/lib/refs';
import { type Pasaje, pasajeLabel, parsePasaje } from '@/lib/taller';
import { type Colors, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { listen, voiceSupported } from '@/lib/voz';

const IDEAS = ['El hijo que vuelve a casa', 'Cuando Dios parece tardar', 'Perdonar a quien me hirió'];

/** Una cita escrita o dictada, como pasaje del Taller (o el problema, si el capítulo o el versículo no existen). */
function leer(texto: string, books: Book[]): { pasaje: Pasaje } | { problema: string } | null {
  if (!books.length || !texto.trim()) return null;
  const c = parseCita(texto, books);
  if (c?.problem) return { problema: c.problem };
  if (c) return { pasaje: { book: c.book, chapter: c.chapter, from: c.verse, to: c.verseEnd && c.verseEnd !== c.verse ? c.verseEnd : undefined } };
  const p = parsePasaje(texto, books);
  return p ? { pasaje: p } : null;
}

/** «jhn.3.16-jhn.3.18» → Juan 3:16-18. Un resultado que pasa de un capítulo a otro se queda en el primero. */
function pasajeDe(ref: string): Pasaje {
  const { start, end } = parseRef(ref);
  const to = end.chapter === start.chapter && end.verse > start.verse ? end.verse : undefined;
  return { book: start.book, chapter: start.chapter, from: start.verse || undefined, to };
}

export default function BuscarPasaje({ books, pasaje, onElegir }: { books: Book[]; pasaje: Pasaje | null; onElegir: (p: Pasaje) => void }) {
  const colors = useColors();
  const { settings } = useSettings();
  const elegido = pasajeLabel(pasaje, books);
  const [texto, setTexto] = useState(elegido);
  const [focus, setFocus] = useState(false);
  const [oyendo, setOyendo] = useState<string | null>(null);
  const [buscado, setBuscado] = useState('');
  const [resultados, setResultados] = useState<IdeaResult[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const parar = useRef<(() => void) | null>(null);
  const puedeDictar = useMemo(voiceSupported, []);

  // Sin los libros cargados, pasajeLabel daría el código interno («jhn 3:16»): se rellena cuando llegan.
  useEffect(() => {
    if (books.length && pasaje && !texto) setTexto(pasajeLabel(pasaje, books));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length]);
  useEffect(
    () => () => {
      abort.current?.abort();
      parar.current?.();
    },
    [],
  );

  const asentado = useAsentado(texto, 300);
  const cita = useMemo(() => leer(asentado, books), [asentado, books]);
  const cambiado = asentado.trim() !== '' && asentado.trim() !== elegido;
  const citaNueva = cambiado && cita && 'pasaje' in cita ? cita.pasaje : null;

  const usar = (p: Pasaje) => {
    onElegir(p);
    setTexto(pasajeLabel(p, books));
    setResultados(null);
    setBuscado('');
    setError(null);
  };

  const buscar = async (q: string) => {
    const t = q.trim();
    if (t.length < 3) return;
    abort.current?.abort();
    const c = new AbortController();
    abort.current = c;
    setTexto(t);
    setBuscado(t);
    setBuscando(true);
    setError(null);
    setResultados(null);
    const version = settings.version;
    try {
      const r = await searchByIdea(t, version, c.signal);
      const vistos = licensedById(version) ? await withVersion(r.results, version, (b, ch) => getChapter(b, ch, version)) : r.results;
      if (!c.signal.aborted) setResultados(vistos);
    } catch (e) {
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo hacer la búsqueda.');
    } finally {
      if (abort.current === c) setBuscando(false);
    }
  };

  /** Enter o lo dictado: si es una cita, se usa; si no, se busca con IA. Con varias formas (dictado), gana la cita. */
  const enviar = (opciones: string[]) => {
    const cita = opciones.map((o) => leer(o, books)).find((r) => r && 'pasaje' in r);
    if (cita && 'pasaje' in cita) return usar(cita.pasaje);
    const primera = opciones[0] ?? '';
    const r = leer(primera, books);
    if (r && 'problema' in r) return setTexto(primera);
    buscar(primera);
  };

  const dictar = () => {
    if (oyendo !== null) return parar.current?.();
    setError(null);
    setOyendo('');
    parar.current = listen({
      onPartial: setOyendo,
      onFinal: (opciones) => opciones.length && enviar(opciones),
      onError: setError,
      onEnd: () => {
        setOyendo(null);
        parar.current = null;
      },
    });
  };

  const limpiar = () => {
    abort.current?.abort();
    setTexto('');
    setResultados(null);
    setBuscado('');
    setError(null);
    setBuscando(false);
  };

  const sinPasaje = !pasaje && !texto.trim() && !resultados && !buscando;
  const abbr = licensedById(settings.version)?.abbr;

  return (
    <View>
      <Text style={[styles.label, { color: focus ? colors.accent : colors.muted }]}>PASAJE</Text>
      <View style={[styles.campo, { backgroundColor: colors.surface, borderColor: focus || oyendo !== null ? colors.accent : colors.border }, focus && { boxShadow: `0 0 0 3px ${colors.accentSoft}` }]}>
        <SearchIcon color={focus ? colors.accent : colors.muted} size={20} />
        <TextInput
          value={oyendo || texto}
          onChangeText={setTexto}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false);
            // Al salir del campo, una cita que se reconoce se queda; una idea espera a que se busque.
            const r = leer(texto, books);
            if (r && 'pasaje' in r && texto.trim() !== elegido) usar(r.pasaje);
          }}
          onSubmitEditing={() => enviar([texto])}
          placeholder={oyendo !== null ? 'Te escucho…' : 'Una cita o una idea: «Lucas 15» o «el hijo que vuelve»'}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
          maxLength={200}
          accessibilityLabel="Pasaje: escribe una cita, unas palabras o una idea"
          style={[styles.input, { color: colors.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
        />
        {!!texto && oyendo === null && (
          <Pressable onPress={limpiar} hitSlop={8} style={[styles.limpiar, { backgroundColor: colors.border }]} accessibilityLabel="Borrar">
            <CloseIcon color={colors.muted} size={12} strokeWidth={2.6} />
          </Pressable>
        )}
        {puedeDictar && (
          <Pressable
            onPress={dictar}
            style={({ pressed }) => [styles.mic, { backgroundColor: oyendo !== null ? colors.accent : colors.accentSoft }, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={oyendo !== null ? 'Dejar de escuchar' : 'Dictar el pasaje o la idea'}
          >
            <MicIcon color={oyendo !== null ? colors.surface : colors.accent} size={18} />
          </Pressable>
        )}
      </View>

      {sinPasaje && (
        <View style={styles.ideas}>
          <Text style={{ color: colors.muted, fontSize: 13, width: '100%', marginBottom: 2 }}>¿No sabes la cita? Escribe la idea y la IA te busca el pasaje:</Text>
          {IDEAS.map((i) => (
            <Pressable
              key={i}
              onPress={() => buscar(i)}
              style={({ pressed }) => [styles.idea, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && { opacity: 0.75 }]}
            >
              <SparkIcon color={colors.accent} size={13} />
              <Text style={{ color: colors.text, fontSize: 13.5 }}>{i}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {cambiado && cita && 'problema' in cita && <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8 }}>{cita.problema}</Text>}

      {!buscando && !resultados && citaNueva && (
        <Appear>
          <Pressable
            onPress={() => usar(citaNueva)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.sugerida, { borderColor: colors.accent, backgroundColor: colors.accentSoft }, pressed && { opacity: 0.8 }]}
          >
            <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>
              Usar <Text style={{ fontWeight: '700', fontFamily: serif }}>{citaLabel({ book: citaNueva.book, chapter: citaNueva.chapter, verse: citaNueva.from, verseEnd: citaNueva.to }, books)}</Text>
            </Text>
            <CheckIcon color={colors.accent} size={18} strokeWidth={2.4} />
          </Pressable>
        </Appear>
      )}

      {!buscando && !resultados && cambiado && !cita && asentado.trim().length >= 3 && (
        <Appear>
          <Pressable
            onPress={() => buscar(asentado)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.sugerida, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.chispa, { backgroundColor: colors.accentSoft }]}>
              <SparkIcon color={colors.accent} size={16} />
            </View>
            <Text style={{ color: colors.text, fontSize: 15, flex: 1 }} numberOfLines={2}>
              Buscar pasajes sobre <Text style={{ fontWeight: '700' }}>«{asentado.trim()}»</Text>
            </Text>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Con IA</Text>
          </Pressable>
        </Appear>
      )}

      {buscando && <Buscando colors={colors} buscado={buscado} />}

      {!!error && (
        <View style={[styles.aviso, { backgroundColor: colors.accentSoft }]}>
          {error === NEEDS_ACCOUNT ? (
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
              Buscar por idea usa la IA y necesita una cuenta gratuita.{' '}
              <Text onPress={() => navigate(() => router.push('/entrar'), 'forward')} style={{ color: colors.accent, fontWeight: '700' }}>
                Entrar o crear cuenta ›
              </Text>{' '}
              Una cita, como «Lucas 15:11-32», no la necesita.
            </Text>
          ) : (
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
              {error === NEEDS_CONNECTION ? 'Buscar por idea necesita internet. Sin conexión puedes escribir la cita directamente.' : error}
            </Text>
          )}
        </View>
      )}

      {resultados && (
        <View style={{ marginTop: 12 }}>
          <View style={styles.resHead}>
            <Text style={[styles.label, { color: colors.muted, marginBottom: 0, flex: 1 }]}>
              {resultados.length ? `${resultados.length === 1 ? '1 PASAJE' : `${resultados.length} PASAJES`} PARA «${buscado.toUpperCase()}»` : 'SIN PASAJES CLAROS'}
            </Text>
            <Pressable onPress={() => (setResultados(null), setTexto(elegido))} hitSlop={8}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Cerrar</Text>
            </Pressable>
          </View>
          {!resultados.length && (
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>No encontré pasajes para «{buscado}». Prueba a decirlo con otras palabras.</Text>
          )}
          <View style={{ gap: 10 }}>
            {resultados.map((r, i) => {
              const p = pasajeDe(r.ref);
              return (
                <Appear key={r.ref} delay={Math.min(i, 6) * 40}>
                  <Pressable
                    onPress={() => usar(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`Usar ${r.label}`}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                      styles.resultado,
                      { backgroundColor: colors.surface, borderColor: hovered ? colors.accent : colors.border },
                      pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                    ]}
                  >
                    <View style={styles.resHead}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, flex: 1 }}>{r.label}</Text>
                      <View style={[styles.usar, { backgroundColor: colors.accent }]}>
                        <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 12.5 }}>Usar</Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.text, fontFamily: serif, fontSize: 16, lineHeight: 24, marginTop: 6 }} numberOfLines={3}>
                      {r.text}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>{r.reason}</Text>
                  </Pressable>
                </Appear>
              );
            })}
          </View>
          {resultados.length > 0 && (
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 10 }}>
              Búsqueda con IA{abbr ? `: buscó en la RV1909 y ves el texto en tu ${abbr}` : ''}. Tú eliges el pasaje; luego puedes ajustar los versículos.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function Buscando({ colors, buscado }: { colors: Colors; buscado: string }) {
  const pulso = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulso, { toValue: 0, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulso]);
  const opacity = pulso.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const barra = (width: `${number}%`, height = 11) => <View style={{ width, height, borderRadius: 6, backgroundColor: colors.border, marginTop: 9 }} />;
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 19, marginBottom: 10 }}>Buscando pasajes sobre «{buscado}» y leyéndolos para comprobar que responden…</Text>
      {[0, 1].map((i) => (
        <Animated.View key={i} style={[styles.resultado, { backgroundColor: colors.surface, borderColor: colors.border, opacity, marginBottom: 10 }]}>
          {barra('30%', 10)}
          {barra('100%')}
          {barra(i ? '64%' : '82%')}
        </Animated.View>
      ))}
    </View>
  );
}

/** El texto después de `ms` sin cambios; vacío al instante. */
function useAsentado(valor: string, ms: number) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    if (!valor.trim()) return setV(valor);
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  campo: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingLeft: 14, paddingRight: 5, paddingVertical: 4 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, minWidth: 0 },
  limpiar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  mic: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  idea: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  sugerida: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10 },
  chispa: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  aviso: { borderRadius: 12, padding: 12, marginTop: 10 },
  resHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  resultado: { borderRadius: 16, borderWidth: 1, padding: 14 },
  usar: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
});
