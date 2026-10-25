import { router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import Appear from '@/components/Appear';
import { IconText } from '@/components/comunidad/ui';
import { CheckIcon, HeartIcon, type IconProps, ListenIcon, LockIcon, PencilIcon, PrayIcon, RefreshIcon, ShareIcon, SunIcon } from '@/components/icons';
import { Markdown, Sources } from '@/components/StudyText';
import VerseImage from '@/components/VerseImage';
import { playChapter } from '@/lib/audio';
import { Book, Verse, getChapter } from '@/lib/data';
import { parseDevocional, saveEntrada } from '@/lib/diario';
import { useRacha } from '@/lib/racha';
import { diasLabel, fechaLocal, siguienteHito } from '@/lib/rachaTexto';
import { resplandorNuevo } from '@/lib/resplandor';
import Resplandor from '@/components/Resplandor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RachaChip } from '@/components/Racha';
import { Source } from '@/lib/estudio';
import { studyKeep, useKept } from '@/lib/recordado';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
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
  /** Al tocar un número ⟦n⟧ de una cita. */
  onCite?: (source: Source) => void;
  /** Al cambiar de paso, para volver arriba. */
  onStep?: () => void;
  /** Último versículo de un pasaje (con `verse` como el primero): se lee entero en vez del versículo y su contexto. */
  hasta?: number;
  /** Dónde se recuerda el paso y lo escrito, si no es el estudio del pasaje (un día de la semana del sermón). */
  keepKey?: string;
  /** Al guardar en el diario, con el id de la entrada. */
  onSaved?: (entrada: string) => void;
  /** Lo que se muestra al final, debajo del resumen (por ejemplo, el día siguiente). */
  after?: ReactNode;
  /** La versión libre con la que se lee el pasaje (la misma que cita la IA). Sin ella, la RV1909. */
  version?: { id: string; abbr: string };
};

const STEPS = [
  { key: 'quietud', label: 'Aquiétate', title: 'Aquiétate', hint: 'Prepara el corazón', min: 1 },
  { key: 'lee', label: 'Lee', title: 'Lee despacio', hint: 'Dos veces, sin prisa', min: 2 },
  { key: 'medita', label: 'Medita', title: 'Medita', hint: 'Qué dice el texto y qué te dice a ti', min: 4 },
  { key: 'vive', label: 'Vive', title: 'Llévalo a tu día', hint: 'Un paso pequeño y concreto', min: 2 },
  { key: 'ora', label: 'Ora', title: 'Habla con Dios', hint: 'Con tus propias palabras', min: 3 },
] as const;

const ORA: Record<string, { icon: (p: IconProps) => ReactNode; hint: string }> = {
  Adora: { icon: SunIcon, hint: 'Quién es Dios' },
  Confiesa: { icon: RefreshIcon, hint: 'Lo que reconoces' },
  Agradece: { icon: HeartIcon, hint: 'Lo que te ha dado' },
  Pide: { icon: PrayIcon, hint: 'Lo que necesitas' },
};

/** Contexto que se lee alrededor del versículo, para no sacarlo de su capítulo. */
const AROUND = 3;
const native = Platform.OS !== 'web';

/**
 * Devocional guiado en cinco pasos: aquietarse, leer despacio, meditar con preguntas, elegir un paso
 * para hoy y orar con pistas del texto. La IA abre el texto y pregunta; lo que la persona escribe es suyo
 * y se guarda en su diario.
 */
export default function Devotional({ book, chapter, verse, text, sources, busy, problem, onOpen, onCite, onStep, hasta, keepKey, onSaved, after, version }: Props) {
  const colors = useColors();
  // El paso y lo escrito sobreviven a seguir un enlace y volver atrás (src/lib/recordado.ts).
  const keep = keepKey ?? `${studyKeep(book.id, chapter, verse)}devocional.`;
  const [step, setStepState] = useKept(`${keep}paso`, 0);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [palabra, setPalabra] = useKept(`${keep}palabra`, '');
  const [oracion, setOracion] = useKept(`${keep}oracion`, '');
  const [paso, setPaso] = useKept(`${keep}hoy`, '');
  const [saved, setSaved] = useKept(`${keep}guardado`, false);
  const [sharing, setSharing] = useState(false);
  const [marked, setMarked] = useKept<number | null>(`${keep}marcado`, null);
  const [id] = useKept(`${keep}id`, () => `${Date.now()}`);
  const d = useMemo(() => parseDevocional(text), [text]);
  const range = !!verse && !!hasta && hasta > verse;
  const passage = verse ? `${book.name} ${chapter}:${verse}${range ? `-${hasta}` : ''}` : `${book.name} ${chapter}`;

  const setStep = (i: number) => {
    setStepState(i);
    onStep?.();
  };

  useEffect(() => {
    getChapter(book.id, chapter, version?.id).then(setVerses, () => {});
  }, [book.id, chapter, version?.id]);

  const reading = range
    ? verses.filter(([n]) => n >= verse && n <= hasta)
    : verse
      ? verses.filter(([n]) => Math.abs(n - verse) <= AROUND)
      : verses;
  const readingRef = verse && reading.length
    ? `${book.name} ${chapter}:${reading[0][0]}-${reading[reading.length - 1][0]}`
    : passage;
  const llevarVerse = verses.find(([n]) => n === (d.llevar ?? verse));
  const ready = !busy && !!d.observa;
  // De noche el paso mira al día que termina, como en el Examen.
  const evening = new Date().getHours() >= 19;

  // El versículo que la persona toca al leer se vuelve su primera respuesta al meditar.
  const quote = (v: number, s: string) => `«${s}» (v. ${v})`;
  const mark = (n: number, t: string) => {
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
    onSaved?.(id);
    onStep?.();
  };

  const openDiario = () => {
    navigate(() => router.push('/diario' as never), 'forward');
  };

  // En el resumen final no se repite la frase si es el mismo versículo que se lleva contigo.
  const frase = llevarVerse && palabra.includes(llevarVerse[1]) ? '' : palabra.trim();
  const meta = STEPS[step];
  const next = STEPS[step + 1];
  const waitingAI = step >= 2 && !d.observa && !problem;

  return (
    <View>
      {!saved && (
        <StepHeader
          step={step}
          onStep={(i) => i < step && setStep(i)}
          colors={colors}
          kicker={`PASO ${step + 1} DE ${STEPS.length} · ${meta.min} MIN`}
          title={meta.title}
          hint={meta.hint}
        />
      )}

      {step === 0 && (
        <Appear key="quietud" style={styles.step}>
          <Sanctuary colors={colors} />
          <Text style={[styles.lead, { color: colors.muted, textAlign: 'center', marginTop: 18 }]}>
            Busca un lugar tranquilo. Respira despacio{'\n'}y pide a Dios que te hable por su Palabra.
          </Text>
        </Appear>
      )}

      {step === 1 && (
        <Appear key="lee" style={styles.step}>
          <View style={[styles.paper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.paperHead}>
              <Text style={[styles.paperRef, { color: colors.accent }]}>{readingRef.toUpperCase()}</Text>
              <Pressable
                onPress={() => playChapter(book.id, chapter, `${book.name} ${chapter}`)}
                style={({ pressed }) => [styles.listen, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`Escuchar ${book.name} ${chapter}`}
              >
                <IconText icon={ListenIcon} color={colors.accent} size={14} gap={5}>
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>Escuchar</Text>
                </IconText>
              </Pressable>
            </View>
            {reading.length ? (
              <Text style={[styles.readingText, { color: colors.text }]}>
                {reading.map(([n, t]) => (
                  <Text
                    key={n}
                    onPress={() => mark(n, t)}
                    style={[
                      verse && !range && n !== verse && marked !== n ? { color: colors.muted } : undefined,
                      marked === n && { backgroundColor: colors.highlight, color: colors.text },
                    ]}
                  >
                    <Text style={[styles.verseNum, { color: colors.accent }]}>{n} </Text>
                    {t}{' '}
                  </Text>
                ))}
              </Text>
            ) : (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
            )}
          </View>
          {marked ? (
            <Appear key={marked} style={[styles.markNote, { backgroundColor: colors.accentSoft }]}>
              <CheckIcon color={colors.accent} size={18} strokeWidth={2.4} />
              <Text style={{ color: colors.text, flex: 1, fontSize: 14, lineHeight: 20 }}>
                El versículo {marked} te detuvo. Lo guardamos para meditarlo.
              </Text>
            </Appear>
          ) : (
            <Text style={[styles.tip, { color: colors.muted }]}>
              Toca el versículo que te llame la atención. La segunda vez, léelo en voz alta si puedes.
            </Text>
          )}
        </Appear>
      )}

      {step >= 2 && problem}

      {waitingAI && (
        <View style={styles.waiting}>
          <Breath colors={colors} size={64} />
          <Text style={{ color: colors.muted, marginTop: 14, textAlign: 'center' }}>Preparando las preguntas…</Text>
        </View>
      )}

      {step === 2 && !!d.observa && (
        <Appear key="medita" style={styles.step}>
          <View style={[styles.insight, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.insightRule, { backgroundColor: colors.accent }]} />
            <View style={{ flex: 1 }}>
              <Label colors={colors}>LO QUE DICE EL TEXTO</Label>
              <Markdown text={d.observa} colors={colors} sources={sources} onCite={onCite} onOpenRef={onOpen} />
            </View>
          </View>
          <Label colors={colors} style={{ marginTop: 22 }}>
            PARA MEDITAR
          </Label>
          {d.medita.map((q, i) => (
            <Appear key={i} delay={i * 90} style={styles.question}>
              <View style={[styles.qNum, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.qNumText, { color: colors.accent }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, paddingTop: 3 }}>
                <Markdown text={q} colors={colors} sources={sources} onCite={onCite} onOpenRef={onOpen} />
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
              <Appear key={i} delay={i * 70}>
                <Pressable
                  onPress={() => setPaso(on ? '' : plain)}
                  style={({ pressed }) => [
                    styles.option,
                    { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface },
                    pressed && { opacity: 0.75 },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <View style={[styles.radio, { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accent : 'transparent' }]}>
                    {on && <CheckIcon color={colors.surface} size={13} strokeWidth={2.6} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Markdown text={v} colors={colors} sources={sources} onCite={onCite} onOpenRef={onOpen} />
                  </View>
                </Pressable>
              </Appear>
            );
          })}
          <Journal
            label={evening ? 'Mi paso para mañana' : 'Mi paso para hoy'}
            placeholder={evening ? 'Mañana voy a…' : 'Hoy voy a…'}
            value={paso}
            onChange={setPaso}
            colors={colors}
          />
        </Appear>
      )}

      {step === 4 && !!d.observa && !saved && (
        <Appear key="ora" style={styles.step}>
          <Text style={[styles.lead, { color: colors.muted }]}>
            Estas pistas salen del texto. No hace falta usarlas todas: son para empezar a hablar con Él.
          </Text>
          <View style={styles.grid}>
            {d.ora.map((o, i) => {
              const info = ORA[o.label];
              return (
                <Appear
                  key={i}
                  delay={i * 70}
                  style={[styles.prayCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  {info && (
                    <View style={styles.prayHead}>
                      <View style={[styles.prayIcon, { backgroundColor: colors.accentSoft }]}>
                        <info.icon color={colors.accent} size={15} strokeWidth={2} />
                      </View>
                      <Text style={[styles.prayLabel, { color: colors.accent }]}>{o.label.toUpperCase()}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{info.hint}</Text>
                    </View>
                  )}
                  <Markdown text={o.text.charAt(0).toUpperCase() + o.text.slice(1)} colors={colors} sources={sources} onCite={onCite} onOpenRef={onOpen} />
                </Appear>
              );
            })}
          </View>
          <Journal label="Tu oración" placeholder="Señor…" value={oracion} onChange={setOracion} colors={colors} tall />
        </Appear>
      )}

      {saved && (
        <View style={styles.done}>
          <Halo colors={colors} />
          <Appear delay={150}>
            <Text style={[styles.doneTitle, { color: colors.text }]}>Amén</Text>
            <Text style={[styles.lead, { color: colors.muted, textAlign: 'center' }]}>
              Tu devocional de {passage} quedó en tu diario. Solo tú lo ves.
            </Text>
          </Appear>
          <RachaAmen colors={colors} />

          {(!!frase || !!paso.trim()) && (
            <Appear delay={260} style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {!!frase && (
                <View>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>LO QUE TE DETUVO</Text>
                  <Text style={[styles.summaryQuote, { color: colors.text }]}>{frase}</Text>
                </View>
              )}
              {!!frase && !!paso.trim() && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              {!!paso.trim() && (
                <View>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>{evening ? 'TU PASO PARA MAÑANA' : 'TU PASO PARA HOY'}</Text>
                  <Text style={{ color: colors.text, fontSize: 16, lineHeight: 23 }}>{paso.trim()}</Text>
                </View>
              )}
            </Appear>
          )}

          {llevarVerse && (
            <Appear delay={360} style={{ alignSelf: 'stretch' }}>
              <Carry colors={colors} book={book} chapter={chapter} verse={llevarVerse} onShare={() => setSharing(true)} />
            </Appear>
          )}
          {after && (
            <Appear delay={420} style={{ alignSelf: 'stretch' }}>
              {after}
            </Appear>
          )}
          <Appear delay={440}>
            <Pressable onPress={openDiario} style={({ pressed }) => [styles.secondary, { borderColor: colors.accent }, pressed && { opacity: 0.7 }]}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver mi diario ›</Text>
            </Pressable>
          </Appear>
        </View>
      )}

      {step >= 2 && ready && sources.length > 0 && <FoldedSources sources={sources} colors={colors} onOpen={onOpen} />}

      {!saved && (
        <View style={styles.nav}>
          {step > 0 ? (
            <Pressable onPress={() => setStep(step - 1)} hitSlop={8} style={styles.back}>
              <Text style={{ color: colors.muted, fontWeight: '600' }}>‹ {STEPS[step - 1].label}</Text>
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
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={[styles.primaryText, { color: colors.surface }]}>
                {step === 0 ? 'Estoy listo · Leer' : step === 1 ? 'Ya lo leí' : next.label} ›
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={save}
              disabled={!ready}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: ready ? colors.accent : colors.border },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={[styles.primaryText, { color: colors.surface }]}>Amén · Guardar</Text>
            </Pressable>
          )}
        </View>
      )}

      {sharing && llevarVerse && (
        <VerseImage
          verse={{
            book: book.id,
            chapter,
            verse: llevarVerse[0],
            text: llevarVerse[1],
            reference: `${book.name} ${chapter}:${llevarVerse[0]}`,
            version: version?.abbr ?? 'RV1909',
          }}
          onClose={() => setSharing(false)}
        />
      )}
    </View>
  );
}

/** Progreso en segmentos y el nombre del paso, grande, como el título de una página de diario. */
function StepHeader({
  step,
  onStep,
  colors,
  kicker,
  title,
  hint,
}: {
  step: number;
  onStep: (i: number) => void;
  colors: Colors;
  kicker: string;
  title: string;
  hint: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.segments} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}>
        {STEPS.map((s, i) => (
          <Pressable
            key={s.key}
            onPress={() => onStep(i)}
            disabled={i >= step}
            style={styles.segmentHit}
            accessibilityLabel={i < step ? `Volver a ${s.label}` : s.label}
          >
            <View style={[styles.segment, { backgroundColor: i <= step ? colors.accent : colors.border, opacity: i < step ? 0.55 : 1 }]} />
            <Text
              style={[
                styles.segmentLabel,
                { color: i === step ? colors.accent : colors.muted, fontWeight: i === step ? '700' : '500' },
              ]}
              numberOfLines={1}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Appear key={title}>
        <Text style={[styles.kicker, { color: colors.muted }]}>{kicker}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 15, marginTop: 2 }}>{hint}</Text>
      </Appear>
    </View>
  );
}

/** Un círculo de luz que respira despacio (4 s al inhalar, 4 s al exhalar). */
function Breath({ colors, size, running = true }: { colors: Colors; size: number; running?: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  const gid = useRef(`glow${Math.random().toString(36).slice(2, 8)}`).current;
  useEffect(() => {
    if (!running) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(t, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, running]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale }], opacity }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity={isDark(colors) ? 0.6 : 0.5} />
            <Stop offset="55%" stopColor={colors.accent} stopOpacity={isDark(colors) ? 0.16 : 0.2} />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

/** El inicio del devocional: la luz que respira, Salmo 119:18 y un minuto de silencio opcional. */
function Sanctuary({ colors }: { colors: Colors }) {
  const [left, setLeft] = useState<number | null>(null);
  const ORB = 150;
  const R = 70;
  const C = 2 * Math.PI * R;

  useEffect(() => {
    if (left === null) return;
    if (left <= 0) {
      setLeft(null);
      return;
    }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <View style={[styles.sanctuary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ width: ORB, height: ORB, alignItems: 'center', justifyContent: 'center' }}>
        <Breath colors={colors} size={ORB} />
        {left !== null && (
          <>
            <Svg width={ORB} height={ORB} style={StyleSheet.absoluteFill}>
              <Circle cx={ORB / 2} cy={ORB / 2} r={R} stroke={colors.border} strokeWidth={2} fill="none" />
              <Circle
                cx={ORB / 2}
                cy={ORB / 2}
                r={R}
                stroke={colors.accent}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${C}`}
                strokeDashoffset={C * (left / 60)}
                transform={`rotate(-90 ${ORB / 2} ${ORB / 2})`}
              />
            </Svg>
            <Text style={[styles.silenceTime, { color: colors.text }]}>
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </Text>
          </>
        )}
      </View>
      <Text style={[styles.quoteText, { color: colors.text }]}>«Abre mis ojos, y miraré las maravillas de tu ley.»</Text>
      <Text style={[styles.quoteRef, { color: colors.accent }]}>SALMO 119:18</Text>
      <Pressable
        onPress={() => setLeft(left === null ? 60 : null)}
        style={({ pressed }) => [styles.silenceBtn, { borderColor: colors.border, backgroundColor: colors.background }, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
      >
        <Text style={{ color: left === null ? colors.text : colors.muted, fontWeight: '600', fontSize: 14 }}>
          {left === null ? 'Un minuto de silencio' : 'Inhala… exhala · Terminar'}
        </Text>
      </Pressable>
    </View>
  );
}

/** Al guardar: un halo que se abre alrededor del ✓. */
function Halo({ colors }: { colors: Colors }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: 1, friction: 6, tension: 60, useNativeDriver: native }).start();
  }, [t]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <View style={styles.halo}>
      <View style={StyleSheet.absoluteFill}>
        <Breath colors={colors} size={140} />
      </View>
      <Animated.View style={[styles.doneMark, { backgroundColor: colors.accent, transform: [{ scale }], opacity: t }]}>
        <CheckIcon color={colors.surface} size={28} strokeWidth={2.6} />
      </Animated.View>
    </View>
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
  const [focus, setFocus] = useState(false);
  return (
    <View
      style={[
        styles.journal,
        { borderColor: focus ? colors.accent : colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.journalHead}>
        <IconText icon={PencilIcon} color={colors.accent} size={14}>
          <Text style={[styles.journalLabel, { color: colors.accent }]}>{label}</Text>
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
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline
        maxLength={2000}
        style={[
          styles.journalInput,
          { color: colors.text, minHeight: tall ? 132 : 72 },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
        ]}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Carry({
  colors,
  book,
  chapter,
  verse,
  onShare,
}: {
  colors: Colors;
  book: Book;
  chapter: number;
  verse: Verse;
  onShare: () => void;
}) {
  return (
    <View style={[styles.carry, { backgroundColor: colors.accentSoft }]}>
      <Text style={[styles.carryKicker, { color: colors.accent }]}>LLÉVALO CONTIGO</Text>
      <Text style={[styles.carryText, { color: colors.text }]}>«{verse[1]}»</Text>
      <View style={styles.carryFoot}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {book.name} {chapter}:{verse[0]}
        </Text>
        <Pressable onPress={onShare} hitSlop={8} accessibilityRole="button">
          <IconText icon={ShareIcon} color={colors.accent} size={14} gap={5}>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Compartir</Text>
          </IconText>
        </Pressable>
      </View>
    </View>
  );
}

/** Las fuentes, plegadas para no distraer: se abren con un toque. */
function FoldedSources({ sources, colors, onOpen }: { sources: Source[]; colors: Colors; onOpen: (ref: string) => void }) {
  const [open, setOpen] = useState(false);
  if (open) return <Sources sources={sources} colors={colors} onOpen={onOpen} />;
  return (
    <Pressable onPress={() => setOpen(true)} style={[styles.fold, { borderColor: colors.border }]} accessibilityRole="button">
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        Preguntas y pistas hechas con IA a partir del texto ·{' '}
        <Text style={{ color: colors.accent, fontWeight: '700' }}>{sources.length} fuentes ›</Text>
      </Text>
    </Pressable>
  );
}

function Label({ children, colors, style }: { children: ReactNode; colors: Colors; style?: object }) {
  return <Text style={[styles.label, { color: colors.muted }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  racha: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14, alignSelf: 'center' },
  header: { paddingTop: 16 },
  segments: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  segmentHit: { flex: 1 },
  segment: { height: 4, borderRadius: 2 },
  segmentLabel: { fontSize: 11, marginTop: 6 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { fontFamily: serif, fontSize: 30, lineHeight: 36, marginTop: 4 },
  step: { paddingTop: 18 },
  lead: { fontSize: 15, lineHeight: 22, marginBottom: 14 },
  sanctuary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  quoteText: { fontFamily: serif, fontSize: 22, lineHeight: 32, textAlign: 'center', fontStyle: 'italic', marginTop: 4 },
  quoteRef: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 10 },
  silenceBtn: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, marginTop: 20 },
  silenceTime: { position: 'absolute', fontSize: 26, fontFamily: serif },
  paper: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 18 },
  paperHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  paperRef: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  listen: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  readingText: { fontFamily: serif, fontSize: 19, lineHeight: 32 },
  verseNum: { fontSize: 11, fontWeight: '700', fontFamily: undefined },
  tip: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
  markNote: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 14, padding: 12, marginTop: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  insight: { flexDirection: 'row', gap: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, paddingLeft: 16 },
  insightRule: { width: 3, borderRadius: 2 },
  question: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  qNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  qNumText: { fontFamily: serif, fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  prayCard: {
    flexGrow: 1,
    flexBasis: 260,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  prayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  prayIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  prayLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  journal: { borderWidth: 1, borderRadius: 18, padding: 16, marginTop: 18 },
  journalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  journalLabel: { fontSize: 13, fontWeight: '700' },
  journalInput: { fontSize: 17, lineHeight: 26, textAlignVertical: 'top', fontFamily: serif, paddingVertical: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 5,
    marginBottom: 10,
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, marginTop: 3, alignItems: 'center', justifyContent: 'center' },
  summary: { alignSelf: 'stretch', borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, marginTop: 20, gap: 0 },
  summaryLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  summaryQuote: { fontFamily: serif, fontSize: 17, lineHeight: 25, fontStyle: 'italic' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  carry: { borderRadius: 20, padding: 20, marginTop: 14 },
  carryKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  carryText: { fontFamily: serif, fontSize: 19, lineHeight: 28, marginTop: 8 },
  carryFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  fold: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 22, paddingTop: 14, alignItems: 'center' },
  waiting: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  back: { paddingVertical: 10, paddingHorizontal: 4 },
  primary: { borderRadius: 26, paddingHorizontal: 24, paddingVertical: 13 },
  primaryText: { fontWeight: '700', fontSize: 15 },
  secondary: { borderWidth: 1.5, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 10, marginTop: 20 },
  done: { alignItems: 'center', paddingTop: 20 },
  halo: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  doneMark: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: serif, fontSize: 34, textAlign: 'center', marginTop: 4, marginBottom: 6 },
});

/** Al terminar: cuántos días seguidos lleva la racha y cuánto falta para la próxima insignia. */
function RachaAmen({ colors }: { colors: Colors }) {
  const racha = useRacha();
  // El día en que la racha llega a una meta, la luz sale sola (una vez).
  const nueva = racha.hoyHecho ? resplandorNuevo(racha.actual) : null;
  const [brilla, setBrilla] = useState(false);
  useEffect(() => {
    if (!nueva) return;
    const clave = `${fechaLocal()}|${nueva.dias}`;
    AsyncStorage.getItem('resplandor-visto')
      .then((visto) => {
        if (visto === clave) return;
        AsyncStorage.setItem('resplandor-visto', clave).catch(() => {});
        setBrilla(true);
      })
      .catch(() => {});
  }, [nueva]);
  if (!racha.hoyHecho) return null;
  const meta = siguienteHito(racha.actual);
  return (
    <Appear delay={220} style={[styles.racha, { backgroundColor: colors.warmSoft }]}>
      <RachaChip dias={racha.actual} hecha colors={colors} />
      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, flexShrink: 1 }}>
        {racha.actual === 1 ? 'Hoy empieza tu racha devocional.' : `${diasLabel(racha.actual)} seguidos con tu devocional.`}
        {meta ? ` ${meta - racha.actual === 1 ? 'Mañana' : `En ${meta - racha.actual} días`} ganas una insignia nueva.` : ''}
      </Text>
      {brilla && nueva && <Resplandor nivel={nueva} dias={racha.actual} onClose={() => setBrilla(false)} />}
    </Appear>
  );
}
