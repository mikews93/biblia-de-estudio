import { Stack, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { Button, ErrorText, Field, IconText } from '@/components/comunidad/ui';
import { CheckIcon, LockIcon, MicIcon, PencilIcon, SparkIcon } from '@/components/icons';
import { Ruta } from '@/components/SemanaSermon';
import { NEEDS_ACCOUNT, useAccount } from '@/lib/comunidad';
import { Book, Verse, getBooks, getChapter } from '@/lib/data';
import {
  DIAS,
  type Dia,
  MAX_NOTAS,
  MIN_NOTAS,
  borrarBorrador,
  diaCompleto,
  guardarBorrador,
  guardarSemana,
  leerBorrador,
  prepararSemana,
} from '@/lib/semanas';
import { type Pasaje, enPasaje, parsePasaje, pasajeLabel } from '@/lib/taller';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { listen, voiceSupported } from '@/lib/voz';

// Pistas para empezar a escribir: añaden una línea con su nombre al final de las notas.
const PISTAS = ['La idea principal', 'Un versículo que me tocó', 'Una pregunta que me quedó', 'Algo para hacer'];

/** Del sermón a tu semana: escribir o dictar las notas del domingo y preparar cinco días con ellas. */
export default function NuevaSemana() {
  const colors = useColors();
  const { usuario, ready } = useAccount();
  const [books, setBooks] = useState<Book[]>([]);
  const [input, setInput] = useState('');
  const [pasaje, setPasaje] = useState<Pasaje | null>(null);
  const [pasajeError, setPasajeError] = useState<string | null>(null);
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [predicador, setPredicador] = useState('');
  const [notas, setNotas] = useState('');
  const [cargado, setCargado] = useState(false);
  const [preparando, setPreparando] = useState<{ titulo: string; dias: Dia[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
    return () => abort.current?.abort();
  }, []);

  // El borrador vuelve al entrar (y puede venir relleno desde otra pantalla).
  useEffect(() => {
    if (!books.length || cargado) return;
    leerBorrador().then((b) => {
      if (b) {
        setInput(b.pasaje);
        setNotas(b.notas);
        setPredicador(b.predicador);
        const p = b.pasaje ? parsePasaje(b.pasaje, books) : null;
        if (p) {
          setPasaje(p);
          setInput(pasajeLabel(p, books));
        }
      }
      setCargado(true);
    });
  }, [books, cargado]);

  useEffect(() => {
    if (cargado) guardarBorrador({ pasaje: input, notas, predicador });
  }, [cargado, input, notas, predicador]);

  useEffect(() => {
    setVerses(null);
    if (pasaje) getChapter(pasaje.book, pasaje.chapter).then((v) => setVerses(v.filter(([n]) => enPasaje(pasaje, n)))).catch(() => {});
  }, [pasaje]);

  const apply = () => {
    if (!input.trim()) {
      setPasaje(null);
      return;
    }
    const p = parsePasaje(input, books);
    if (!p) {
      setPasajeError('No reconozco ese pasaje. Prueba con «Juan 3:1-16» o «Salmos 23».');
      return;
    }
    setPasajeError(null);
    setPasaje(p);
    setInput(pasajeLabel(p, books));
  };

  const listo = !!pasaje && notas.trim().length >= MIN_NOTAS;

  const preparar = async () => {
    if (!pasaje || !listo) return;
    setError(null);
    setPreparando({ titulo: '', dias: [] });
    abort.current = new AbortController();
    try {
      const semana = await prepararSemana({ pasaje, notas: notas.trim(), predicador: predicador.trim() }, books, setPreparando, abort.current.signal);
      await guardarSemana(semana);
      await borrarBorrador();
      navigate(() => router.replace(`/semana/${semana.id}` as never), 'forward');
    } catch (e) {
      if (abort.current?.signal.aborted) return;
      setPreparando(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const cancelar = () => {
    abort.current?.abort();
    setPreparando(null);
  };

  if (preparando) return <Preparando parcial={preparando} referencia={pasajeLabel(pasaje, books)} colors={colors} onCancel={cancelar} />;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Del sermón a tu semana' }} />

      <Appear style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.kicker, { color: colors.warm }]}>DEL SERMÓN A TU SEMANA</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Que el domingo te acompañe toda la semana</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>
          Escribe o dicta lo que anotaste del sermón. Con tus notas preparamos cinco días para volver a ese pasaje: lees,
          meditas, oras y das un paso pequeño.
        </Text>
        <View style={{ marginTop: 18 }}>
          <Ruta colors={colors} />
        </View>
      </Appear>

      <Appear delay={60}>
        <Numero n={1} title="¿Qué pasaje predicaron?" colors={colors} />
        <Field
          value={input}
          onChangeText={(t) => {
            setInput(t);
            setPasajeError(null);
          }}
          onBlur={apply}
          onSubmitEditing={apply}
          placeholder="Por ejemplo, Lucas 15:11-32"
          autoCapitalize="words"
          returnKeyType="done"
          accessibilityLabel="Pasaje del sermón"
        />
        <ErrorText>{pasajeError}</ErrorText>
        {pasaje && (
          <View style={[styles.preview, { borderColor: colors.accent }]}>
            {verses ? (
              <Text style={[styles.previewText, { color: colors.text }]} numberOfLines={3}>
                {verses.map(([n, t]) => (
                  <Text key={n}>
                    <Text style={{ color: colors.accent, fontSize: 11 }}>{n} </Text>
                    {t}{' '}
                  </Text>
                ))}
              </Text>
            ) : (
              <ActivityIndicator color={colors.accent} />
            )}
          </View>
        )}
        <View style={{ marginTop: 14 }}>
          <Field
            label="¿Quién predicó? (opcional)"
            value={predicador}
            onChangeText={setPredicador}
            placeholder="Nombre o iglesia"
            maxLength={80}
          />
        </View>
      </Appear>

      <Appear delay={120}>
        <Numero n={2} title="Tus notas del sermón" colors={colors} />
        <Notas value={notas} onChange={setNotas} colors={colors} />
        <View style={styles.pistas}>
          {PISTAS.map((p) => (
            <Pressable
              key={p}
              onPress={() => setNotas((n) => `${n.trimEnd()}${n.trim() ? '\n\n' : ''}${p}: `)}
              style={({ pressed }) => [styles.pista, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`Añadir «${p}» a las notas`}
            >
              <Text style={{ color: colors.text, fontSize: 13 }}>
                <Text style={{ color: colors.accent, fontWeight: '700' }}>＋ </Text>
                {p}
              </Text>
            </Pressable>
          ))}
        </View>
      </Appear>

      <Appear delay={180} style={{ marginTop: 26 }}>
        {ready && !usuario ? (
          <Welcome
            kind="ia"
            title="Prepara tu semana"
            intro="La IA lee tus notas y el pasaje, y prepara cinco devocionales con preguntas y pistas para orar. Solo necesitas una cuenta gratuita; tus notas quedan guardadas en ella."
          />
        ) : (
          <>
            {error === NEEDS_ACCOUNT ? (
              <Welcome kind="ia" title="Prepara tu semana" intro="Para usar la IA necesitas una cuenta gratuita." onReady={preparar} />
            ) : (
              <ErrorText>{error}</ErrorText>
            )}
            <Button label="Preparar mi semana" icon={SparkIcon} onPress={preparar} disabled={!listo} style={{ marginTop: 6 }} />
            <Text style={[styles.foot, { color: colors.muted }]}>
              {!pasaje
                ? 'Elige el pasaje para empezar.'
                : notas.trim().length < MIN_NOTAS
                  ? 'Escribe al menos una frase de lo que escuchaste.'
                  : 'La IA solo pregunta y sugiere a partir del texto; no escribe sermones ni oraciones por ti.'}
            </Text>
          </>
        )}
      </Appear>
    </ScrollView>
  );
}

function Numero({ n, title, colors }: { n: number; title: string; colors: Colors }) {
  return (
    <View style={styles.numero}>
      <View style={[styles.numeroDot, { backgroundColor: colors.accentSoft }]}>
        <Text style={{ color: colors.accent, fontFamily: serif, fontSize: 15, fontWeight: '700' }}>{n}</Text>
      </View>
      <Text style={[styles.numeroTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

/** El cuaderno de notas: escribir o dictar. El dictado sigue escuchando frase tras frase hasta que se detiene. */
function Notas({ value, onChange, colors }: { value: string; onChange: (t: string | ((t: string) => string)) => void; colors: Colors }) {
  const [focus, setFocus] = useState(false);
  const [dictando, setDictando] = useState(false);
  const [oyendo, setOyendo] = useState('');
  const [problema, setProblema] = useState<string | null>(null);
  const activo = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  const puedeDictar = voiceSupported();

  const escuchar = () => {
    stop.current = listen({
      onPartial: setOyendo,
      onFinal: ([t]) => {
        setOyendo('');
        if (t) onChange((n) => `${n}${n && !/\s$/.test(n) ? ' ' : ''}${t.charAt(0).toUpperCase()}${t.slice(1)}.`.slice(0, MAX_NOTAS));
      },
      onError: (m) => {
        setProblema(m);
        activo.current = false;
      },
      onEnd: () => {
        if (activo.current) escuchar();
        else {
          setDictando(false);
          setOyendo('');
        }
      },
    });
  };

  const alternar = () => {
    if (dictando) {
      activo.current = false;
      stop.current?.();
      setDictando(false);
      return;
    }
    setProblema(null);
    activo.current = true;
    setDictando(true);
    escuchar();
  };

  useEffect(
    () => () => {
      activo.current = false;
      stop.current?.();
    },
    [],
  );

  return (
    <View>
      <View style={[styles.cuaderno, { borderColor: focus || dictando ? colors.accent : colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.cuadernoHead}>
          <IconText icon={PencilIcon} color={colors.accent} size={14}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Lo que escuchaste y te tocó</Text>
          </IconText>
          <IconText icon={LockIcon} color={colors.muted} size={11} gap={4}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Solo tú</Text>
          </IconText>
        </View>
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={'Las ideas del sermón, frases que anotaste, versículos que citaron, lo que Dios te mostró…'}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={MAX_NOTAS}
          style={[styles.cuadernoInput, { color: colors.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          accessibilityLabel="Tus notas del sermón"
        />
        {!!oyendo && <Text style={[styles.oyendo, { color: colors.muted }]}>{oyendo}…</Text>}
        <View style={[styles.cuadernoFoot, { borderColor: colors.border }]}>
          {puedeDictar ? (
            <Pressable
              onPress={alternar}
              style={({ pressed }) => [
                styles.dictar,
                { backgroundColor: dictando ? colors.accent : colors.accentSoft },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={dictando ? 'Dejar de dictar' : 'Dictar las notas'}
            >
              <MicIcon color={dictando ? colors.surface : colors.accent} size={16} />
              <Text style={{ color: dictando ? colors.surface : colors.accent, fontWeight: '700', fontSize: 13 }}>
                {dictando ? 'Escuchando… · Detener' : 'Dictar'}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>También puedes dictar con el micrófono del teclado.</Text>
          )}
          <Text style={{ color: value.length > MAX_NOTAS * 0.9 ? colors.warm : colors.muted, fontSize: 12 }}>
            {value.length.toLocaleString('es')} / {MAX_NOTAS.toLocaleString('es')}
          </Text>
        </View>
      </View>
      <ErrorText>{problema}</ErrorText>
    </View>
  );
}

/** Mientras la IA prepara la semana: los cinco días se van llenando según llegan. */
function Preparando({
  parcial,
  referencia,
  colors,
  onCancel,
}: {
  parcial: { titulo: string; dias: Dia[] };
  referencia: string;
  colors: Colors;
  onCancel: () => void;
}) {
  const listos = parcial.dias.filter(diaCompleto).length;
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Del sermón a tu semana' }} />
      <Appear style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center' }]}>
        <Text style={[styles.kicker, { color: colors.warm }]}>{referencia.toUpperCase()}</Text>
        <Text style={[styles.heroTitle, { color: colors.text, textAlign: 'center' }]}>
          {parcial.titulo || 'Preparando tu semana…'}
        </Text>
        <Text style={[styles.lead, { color: colors.muted, textAlign: 'center' }]}>
          La IA lee tus notas junto al pasaje, el texto original y los comentarios. Tarda un minuto o dos.
        </Text>
        <View style={[styles.meter, { backgroundColor: colors.accentSoft }]}>
          <View style={[styles.meterFill, { backgroundColor: colors.accent, width: `${Math.max(6, (listos / DIAS) * 100)}%` }]} />
        </View>
      </Appear>
      {Array.from({ length: DIAS }, (_, i) => {
        const d = parcial.dias[i];
        const hecho = d && diaCompleto(d);
        const ahora = !hecho && (i === 0 ? true : !!parcial.dias[i - 1] && diaCompleto(parcial.dias[i - 1]));
        return (
          <View key={i} style={[styles.prepRow, { borderColor: colors.border, opacity: hecho || ahora ? 1 : 0.45 }]}>
            <View style={[styles.prepDot, { backgroundColor: hecho ? colors.accent : colors.accentSoft }]}>
              {hecho ? (
                <CheckIcon color={colors.surface} size={14} strokeWidth={2.6} />
              ) : ahora ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text style={{ color: colors.accent, fontFamily: serif }}>{i + 1}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prepKicker, { color: colors.muted }]}>DÍA {i + 1}</Text>
              <Text style={{ color: colors.text, fontFamily: serif, fontSize: 18 }} numberOfLines={1}>
                {d?.titulo || (ahora ? 'Escribiendo…' : 'En espera')}
              </Text>
              {d?.domingo ? (
                <Text style={{ color: colors.muted, fontSize: 13, fontStyle: 'italic', marginTop: 2 }} numberOfLines={1}>
                  «{d.domingo}»
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
      <Button label="Cancelar" kind="quiet" onPress={onCancel} style={{ marginTop: 12, alignSelf: 'center' }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 22, marginBottom: 6 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  heroTitle: { fontFamily: serif, fontSize: 27, lineHeight: 34, marginTop: 8 },
  lead: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  numero: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26, marginBottom: 12 },
  numeroDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numeroTitle: { fontFamily: serif, fontSize: 20 },
  preview: { borderLeftWidth: 3, paddingLeft: 12, marginTop: 12 },
  previewText: { fontFamily: serif, fontSize: 15, lineHeight: 24 },
  cuaderno: { borderWidth: 1, borderRadius: 18, paddingTop: 14, paddingHorizontal: 16 },
  cuadernoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cuadernoInput: { fontFamily: serif, fontSize: 17, lineHeight: 27, minHeight: 200, textAlignVertical: 'top', paddingVertical: 4 },
  oyendo: { fontFamily: serif, fontSize: 16, fontStyle: 'italic', marginBottom: 8 },
  cuadernoFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    marginTop: 6,
  },
  dictar: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  pistas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pista: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  foot: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10 },
  meter: { height: 6, borderRadius: 3, overflow: 'hidden', alignSelf: 'stretch', marginTop: 18 },
  meterFill: { height: 6, borderRadius: 3 },
  prepRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
  prepDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  prepKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
});
