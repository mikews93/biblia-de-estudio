import { router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Appear from '@/components/Appear';
import { Markdown, Sources } from '@/components/StudyText';
import { Book, Verse, getChapter } from '@/lib/data';
import { parseDevocional, saveEntrada } from '@/lib/diario';
import { Source } from '@/lib/estudio';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Props = {
  book: Book;
  chapter: number;
  verse?: number;
  /** Respuesta de la IA, que puede ir llegando mientras la persona se aquieta y lee. */
  text: string;
  sources: Source[];
  busy: boolean;
  /** Lo que se muestra si la IA no pudo responder (error, cuenta). */
  problem?: ReactNode;
  onOpen: (ref: string) => void;
  onClose: () => void;
  /** Al cambiar de paso, para volver arriba. */
  onStep?: () => void;
};

const STEPS = [
  { key: 'quietud', label: 'Aquiétate', icon: '○' },
  { key: 'lee', label: 'Lee', icon: '¶' },
  { key: 'medita', label: 'Medita', icon: '✦' },
  { key: 'vive', label: 'Vive', icon: '→' },
  { key: 'ora', label: 'Ora', icon: '♡' },
] as const;

const ORA_HINTS: Record<string, string> = {
  Adora: 'Quién es Dios',
  Confiesa: 'Lo que reconoces',
  Agradece: 'Lo que te ha dado',
  Pide: 'Lo que necesitas',
};

/** Contexto que se lee alrededor del versículo, para no sacarlo de su capítulo. */
const AROUND = 3;

/**
 * Devocional guiado en cinco pasos: aquietarse, leer despacio, meditar con preguntas, orar con pistas
 * del texto y elegir un paso para hoy. La IA abre el texto y pregunta; lo que la persona escribe es suyo
 * y se guarda en su diario.
 */
export default function Devotional({ book, chapter, verse, text, sources, busy, problem, onOpen, onClose, onStep }: Props) {
  const colors = useColors();
  const [step, setStepState] = useState(0);
  const setStep = (i: number) => {
    setStepState(i);
    onStep?.();
  };
  const [verses, setVerses] = useState<Verse[]>([]);
  const [palabra, setPalabra] = useState('');
  const [oracion, setOracion] = useState('');
  const [paso, setPaso] = useState('');
  const [saved, setSaved] = useState(false);
  const [marked, setMarked] = useState<number | null>(null);
  const id = useRef(`${Date.now()}`).current;
  const d = useMemo(() => parseDevocional(text), [text]);
  const passage = verse ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`;

  useEffect(() => {
    getChapter(book.id, chapter).then(setVerses, () => {});
  }, [book.id, chapter]);

  const reading = verse ? verses.filter(([n]) => Math.abs(n - verse) <= AROUND) : verses;
  const llevarVerse = verses.find(([n]) => n === (d.llevar ?? verse));
  const ready = !busy && !!d.observa;
  // De noche el paso mira al día que termina, como en el Examen.
  const evening = new Date().getHours() >= 19;

  // El versículo que la persona toca al leer se vuelve su primera respuesta al meditar.
  const mark = (n: number, t: string) => {
    const quote = (v: number, s: string) => `«${s}» (v. ${v})`;
    const prev = verses.find(([v]) => v === marked);
    const untouched = !palabra.trim() || (prev && palabra === quote(prev[0], prev[1]));
    if (marked === n) {
      setMarked(null);
      if (untouched) setPalabra('');
      return;
    }
    setMarked(n);
    if (untouched) setPalabra(quote(n, t));
  };

  const save = async () => {
    await saveEntrada({
      id,
      book: book.id,
      chapter,
      verse,
      reference: passage,
      palabra: palabra.trim(),
      oracion: oracion.trim(),
      paso: paso.trim(),
      llevar: llevarVerse ? { verse: llevarVerse[0], text: llevarVerse[1] } : undefined,
      created: Date.now(),
    });
    setSaved(true);
    onStep?.();
  };

  const openDiario = () => {
    onClose();
    navigate(() => router.push('/diario' as never), 'forward');
  };

  const next = STEPS[step + 1];
  const waitingAI = step >= 2 && !d.observa && !problem;

  return (
    <View>
      <Stepper step={saved ? STEPS.length : step} onStep={(i) => i <= step && !saved && setStep(i)} colors={colors} />

      {step === 0 && (
        <Appear key="quietud" style={styles.step}>
          <Text style={[styles.lead, { color: colors.muted }]}>
            Busca un lugar tranquilo. Respira despacio y pide a Dios que te hable por su Palabra.
          </Text>
          <View style={[styles.quote, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.quoteText, { color: colors.text }]}>
              «Abre mis ojos, y miraré las maravillas de tu ley.»
            </Text>
            <Text style={[styles.quoteRef, { color: colors.accent }]}>SALMO 119:18</Text>
          </View>
          <Silence colors={colors} />
        </Appear>
      )}

      {step === 1 && (
        <Appear key="lee" style={styles.step}>
          <Text style={[styles.lead, { color: colors.muted }]}>
            Léelo despacio, dos veces. La segunda, en voz alta si puedes. Toca el versículo que te llame la atención.
          </Text>
          <View style={[styles.reading, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {reading.length ? (
              <Text style={[styles.readingText, { color: colors.text }]}>
                {reading.map(([n, t]) => (
                  <Text
                    key={n}
                    onPress={() => mark(n, t)}
                    style={[
                      verse && n !== verse && marked !== n ? { color: colors.muted } : undefined,
                      marked === n && { backgroundColor: colors.highlight, color: colors.text },
                    ]}
                  >
                    <Text style={[styles.verseNum, { color: colors.accent }]}>{n} </Text>
                    {t}{' '}
                  </Text>
                ))}
              </Text>
            ) : (
              <ActivityIndicator color={colors.accent} />
            )}
          </View>
          <Text style={[styles.credit, { color: colors.muted }]}>
            {verse ? `${book.name} ${chapter}:${reading[0]?.[0] ?? verse}-${reading[reading.length - 1]?.[0] ?? verse}` : passage} ·
            Reina-Valera 1909
          </Text>
        </Appear>
      )}

      {step >= 2 && problem}

      {waitingAI && (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>Preparando las preguntas…</Text>
        </View>
      )}

      {step === 2 && !!d.observa && (
        <Appear key="medita" style={styles.step}>
          <Label colors={colors}>LO QUE DICE EL TEXTO</Label>
          <Markdown text={d.observa} colors={colors} />
          <Label colors={colors}>PARA MEDITAR</Label>
          {d.medita.map((q, i) => (
            <Appear key={i} delay={i * 80} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.cardNum, { color: colors.accent }]}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Markdown text={q} colors={colors} />
              </View>
            </Appear>
          ))}
          <Journal
            label="¿Qué palabra o frase te detuvo?"
            placeholder="Escríbela con tus palabras…"
            value={palabra}
            onChange={setPalabra}
            colors={colors}
          />
        </Appear>
      )}

      {step === 4 && !!d.observa && !saved && (
        <Appear key="ora" style={styles.step}>
          <Text style={[styles.lead, { color: colors.muted }]}>
            Habla con Dios con tus palabras. Estas pistas salen del texto; no hace falta usarlas todas.
          </Text>
          <View style={styles.grid}>
            {d.ora.map((o, i) => (
              <Appear
                key={i}
                delay={i * 70}
                style={[styles.prayCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                {!!o.label && (
                  <Text style={[styles.prayLabel, { color: colors.accent }]}>
                    {o.label.toUpperCase()}
                    <Text style={{ color: colors.muted, fontWeight: '500', letterSpacing: 0 }}>
                      {'  '}
                      {ORA_HINTS[o.label]}
                    </Text>
                  </Text>
                )}
                <Markdown text={o.text.charAt(0).toUpperCase() + o.text.slice(1)} colors={colors} />
              </Appear>
            ))}
          </View>
          <Journal
            label="Tu oración"
            placeholder="Señor…"
            value={oracion}
            onChange={setOracion}
            colors={colors}
            tall
          />
        </Appear>
      )}

      {step === 3 && !!d.observa && (
        <Appear key="vive" style={styles.step}>
          <Text style={[styles.lead, { color: colors.muted }]}>
            {evening
              ? 'Mira tu día: ¿dónde notaste a Dios? Elige un paso pequeño para mañana, o escribe el tuyo.'
              : 'Elige un paso pequeño para hoy, o escribe el tuyo.'}
          </Text>
          {d.vive.map((v, i) => {
            const plain = v.replace(/\s*⟦\d+⟧/g, '').trim();
            const on = paso === plain;
            return (
              <Pressable
                key={i}
                onPress={() => setPaso(on ? '' : plain)}
                style={({ pressed }) => [
                  styles.option,
                  { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface },
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
              >
                <View style={[styles.radio, { borderColor: on ? colors.accent : colors.muted }]}>
                  {on && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Markdown text={v} colors={colors} />
                </View>
              </Pressable>
            );
          })}
          <Journal label={evening ? 'Mi paso para mañana' : 'Mi paso para hoy'} placeholder={evening ? 'Mañana voy a…' : 'Hoy voy a…'} value={paso} onChange={setPaso} colors={colors} />
        </Appear>
      )}

      {saved && (
        <Appear key="hecho" style={[styles.step, styles.done]}>
          <View style={[styles.doneMark, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.accent, fontSize: 26 }}>✓</Text>
          </View>
          <Text style={[styles.doneTitle, { color: colors.text }]}>Amén</Text>
          <Text style={[styles.lead, { color: colors.muted, textAlign: 'center' }]}>
            Guardamos tu devocional de {passage} en tu diario. Solo tú lo ves.
          </Text>
          {llevarVerse && <Carry colors={colors} book={book} chapter={chapter} verse={llevarVerse} />}
          <Pressable onPress={openDiario} style={[styles.secondary, { borderColor: colors.accent }]}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver mi diario</Text>
          </Pressable>
        </Appear>
      )}

      {step >= 2 && ready && sources.length > 0 && <Sources sources={sources} colors={colors} onOpen={onOpen} />}

      {!saved && (
        <View style={styles.nav}>
          {step > 0 ? (
            <Pressable onPress={() => setStep(step - 1)} hitSlop={8} style={styles.back}>
              <Text style={{ color: colors.muted, fontWeight: '600' }}>‹ Atrás</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {next ? (
            <Pressable
              onPress={() => setStep(step + 1)}
              disabled={step >= 2 && !ready}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: step >= 2 && !ready ? colors.border : colors.accent },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.primaryText, { color: colors.surface }]}>
                {step === 0 ? 'Empezar a leer' : step === 1 ? 'Ya lo leí' : `Seguir: ${next.label}`}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={save}
              disabled={!ready}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: ready ? colors.accent : colors.border },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.primaryText, { color: colors.surface }]}>Guardar en mi diario</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function Stepper({ step, onStep, colors }: { step: number; onStep: (i: number) => void; colors: Colors }) {
  return (
    <View style={styles.stepper} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}>
      {STEPS.map((s, i) => {
        const on = i === step;
        const done = i < step;
        return (
          <Pressable key={s.key} onPress={() => onStep(i)} style={styles.stepItem} accessibilityLabel={s.label}>
            <View style={styles.stepTrack}>
              <View
                style={[styles.stepLine, { backgroundColor: i === 0 ? 'transparent' : i <= step ? colors.accent : colors.border }]}
              />
              <View
                style={[
                  styles.stepDot,
                  {
                    borderColor: on || done ? colors.accent : colors.border,
                    backgroundColor: done ? colors.accent : on ? colors.accentSoft : colors.surface,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, color: done ? colors.surface : on ? colors.accent : colors.muted, fontFamily: serif }}>
                  {done ? '✓' : s.icon}
                </Text>
              </View>
              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: i === STEPS.length - 1 ? 'transparent' : i < step ? colors.accent : colors.border },
                ]}
              />
            </View>
            <Text style={[styles.stepLabel, { color: on ? colors.text : colors.muted, fontWeight: on ? '700' : '500' }]}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Un minuto de silencio opcional, con un círculo que respira. */
function Silence({ colors }: { colors: Colors }) {
  const [left, setLeft] = useState<number | null>(null);
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (left === null) return;
    if (left <= 0) {
      setLeft(null);
      return;
    }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  useEffect(() => {
    if (left === null) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(breath, { toValue: 0, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left === null]);

  if (left === null) {
    return (
      <Pressable onPress={() => setLeft(60)} style={[styles.secondary, { borderColor: colors.border, alignSelf: 'center' }]}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>◌ Un minuto de silencio</Text>
      </Pressable>
    );
  }
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  return (
    <Pressable onPress={() => setLeft(null)} style={styles.silence} accessibilityLabel="Terminar el silencio">
      <Animated.View style={[styles.breath, { backgroundColor: colors.accentSoft, transform: [{ scale }] }]} />
      <Text style={[styles.silenceTime, { color: colors.accent }]}>
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>Inhala… exhala. Toca para terminar.</Text>
    </Pressable>
  );
}

function Journal({
  label,
  placeholder,
  value,
  onChange,
  colors,
  tall,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (t: string) => void;
  colors: Colors;
  tall?: boolean;
}) {
  return (
    <View style={[styles.journal, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.journalLabel, { color: colors.accent }]}>✎ {label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline
        maxLength={2000}
        style={[
          styles.journalInput,
          { color: colors.text, minHeight: tall ? 120 : 64 },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
        ]}
        accessibilityLabel={label}
      />
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>🔒 Solo en tu dispositivo</Text>
    </View>
  );
}

function Carry({ colors, book, chapter, verse }: { colors: Colors; book: Book; chapter: number; verse: Verse }) {
  return (
    <View style={[styles.carry, { backgroundColor: colors.accentSoft }]}>
      <Text style={[styles.carryKicker, { color: colors.accent }]}>LLÉVALO CONTIGO HOY</Text>
      <Text style={[styles.carryText, { color: colors.text }]}>«{verse[1]}»</Text>
      <Text style={[styles.carryRef, { color: colors.muted }]}>
        {book.name} {chapter}:{verse[0]}
      </Text>
    </View>
  );
}

function Label({ children, colors }: { children: ReactNode; colors: Colors }) {
  return <Text style={[styles.label, { color: colors.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', marginTop: 14, marginBottom: 6 },
  stepItem: { flex: 1, alignItems: 'center' },
  stepTrack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  stepLine: { flex: 1, height: 1.5 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: { fontSize: 11, marginTop: 5 },
  step: { paddingTop: 14 },
  lead: { fontSize: 15, lineHeight: 22, marginBottom: 14 },
  quote: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingVertical: 26, paddingHorizontal: 22, alignItems: 'center' },
  quoteText: { fontFamily: serif, fontSize: 22, lineHeight: 32, textAlign: 'center', fontStyle: 'italic' },
  quoteRef: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 12 },
  silence: { alignItems: 'center', justifyContent: 'center', marginTop: 22, height: 150 },
  breath: { position: 'absolute', top: 0, width: 110, height: 110, borderRadius: 55 },
  silenceTime: { fontSize: 26, fontFamily: serif, marginTop: 38 },
  reading: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 20 },
  readingText: { fontFamily: serif, fontSize: 19, lineHeight: 32 },
  verseNum: { fontSize: 11, fontWeight: '700', fontFamily: undefined },
  credit: { fontSize: 12, textAlign: 'center', marginTop: 10 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 14, marginBottom: 8 },
  card: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    marginBottom: 10,
  },
  cardNum: { fontFamily: serif, fontSize: 20, lineHeight: 25, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  prayCard: {
    flexGrow: 1,
    flexBasis: 260,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  prayLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: 6 },
  journal: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginTop: 16 },
  journalLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  journalInput: { fontSize: 16, lineHeight: 23, textAlignVertical: 'top', fontFamily: serif, paddingVertical: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    marginBottom: 10,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  carry: { borderRadius: 16, padding: 20, marginTop: 18, alignSelf: 'stretch' },
  carryKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  carryText: { fontFamily: serif, fontSize: 18, lineHeight: 27, marginTop: 8 },
  carryRef: { fontSize: 13, marginTop: 8 },
  waiting: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  back: { paddingVertical: 10, paddingHorizontal: 4 },
  primary: { borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12 },
  primaryText: { fontWeight: '700', fontSize: 15 },
  secondary: { borderWidth: 1.5, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, marginTop: 18 },
  done: { alignItems: 'center', paddingTop: 28 },
  doneMark: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: serif, fontSize: 26, marginTop: 12, marginBottom: 8 },
});
