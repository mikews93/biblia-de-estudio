import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, ChevronRightIcon, MoonIcon, PeopleIcon, StarIcon } from '@/components/icons';
import { readingsLabel, shortDate } from '@/components/PlanCard';
import PlanIcon from '@/components/PlanIcon';
import { confirm } from '@/components/comunidad/confirm';
import { Button, Field, IconText, SectionTitle, text } from '@/components/comunidad/ui';
import { shareMessage } from '@/lib/compartir';
import { useAccount } from '@/lib/comunidad';
import { Book } from '@/lib/data';
import { useAllHighlights } from '@/lib/highlights';
import {
  MyPlan,
  PlanDef,
  dayMinutes,
  parseDate,
  planDays,
  removePlan,
  saveReflection,
  startPlan,
  todayKey,
  usePlans,
  useWords,
} from '@/lib/planes';
import { CELEBRATIONS, CalendarCell, Tint, calendarWeeks, focusDay, retoProgress, seasonTint } from '@/lib/retos';
import { chapterHref } from '@/lib/routes';
import { nextSeason, parseRetoId, seasonRun } from '@/lib/temporadas';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const monthShort = (d: string) => parseDate(d).toLocaleDateString('es', { month: 'short' }).replace('.', '');
const longDay = (d: string) => parseDate(d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
const range = (from: string, to: string) => {
  const a = parseDate(from);
  const b = parseDate(to);
  const month = (d: Date) => d.toLocaleDateString('es', { month: 'short' }).replace('.', '');
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${month(b)}`
    : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
};

/** Pantalla de un reto de temporada: el calendario del año cristiano, la pregunta de cada día, los hitos y la compañía. */
export default function Reto({ def, books, focus }: { def: PlanDef; books: Book[]; focus?: number }) {
  const colors = useColors();
  const tint = seasonTint(def.season!, colors);
  const plans = usePlans();
  const upcoming = nextSeason(def)!;
  // El reto al que ya se unió la persona (aunque sea de una edición anterior sin terminar), o la próxima edición
  const mine =
    plans.find((p) => p.def === def.id && !p.finished && parseRetoId(p.id)?.year === upcoming.year) ??
    plans.find((p) => p.def === def.id && !p.finished) ??
    plans.find((p) => p.id === `${def.id}-${upcoming.year}`);
  const run = mine ? seasonRun(def, parseRetoId(mine.id)!.year) : upcoming;
  const today = todayKey();

  return (
    <>
      <Hero def={def} tint={tint} colors={colors} run={run} plan={mine} today={today} />
      {mine ? (
        <Joined def={def} plan={mine} books={books} tint={tint} colors={colors} dates={run.dates} focus={focus} />
      ) : (
        <Invitation def={def} books={books} tint={tint} colors={colors} dates={run.dates} running={run.running} />
      )}
    </>
  );
}

function Hero({
  def,
  tint,
  colors,
  run,
  plan,
  today,
}: {
  def: PlanDef;
  tint: Tint;
  colors: Colors;
  run: ReturnType<typeof seasonRun>;
  plan?: MyPlan;
  today: string;
}) {
  const index = run.dates.indexOf(today);
  const status = plan?.finished
    ? `Terminado el ${shortDate(plan.finished)}`
    : run.end < today
      ? `Terminó el ${shortDate(run.end)}`
      : run.start > today
        ? run.daysToStart === 1
          ? 'Empieza mañana'
          : `Empieza en ${run.daysToStart} días`
        : index >= 0
          ? `Hoy es el día ${index + 1} de ${run.dates.length}`
          : 'Hoy es día de descanso';
  return (
    <Appear>
      <View style={[styles.hero, { backgroundColor: tint.soft }]}>
        <View style={styles.heroGlyph} aria-hidden>
          <PlanIcon icono={def.icono} color={tint.accent} size={200} strokeWidth={1.1} />
        </View>
        <View style={[styles.badge, { backgroundColor: tint.accent }]}>
          <PlanIcon icono={def.icono} color={tint.soft} size={26} />
        </View>
        <Text style={[styles.kicker, { color: tint.accent, marginTop: 16 }]}>
          Reto de temporada · {tint.name} {run.year}
        </Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>{def.title}</Text>
        <Text style={[text.body, { color: colors.text, marginTop: 8, opacity: 0.85 }]}>{def.description}</Text>
        <View style={styles.facts}>
          <Fact label={range(run.start, run.end)} tint={tint} colors={colors} />
          <Fact label={`${run.dates.length} lecturas`} tint={tint} colors={colors} />
          <Fact label="~5 min al día" tint={tint} colors={colors} />
        </View>
        <Text style={[styles.status, { color: tint.accent }]}>{status}</Text>
        <Text style={[styles.meaning, { color: colors.muted }]}>{tint.meaning}</Text>
      </View>
    </Appear>
  );
}

function Fact({ label, tint, colors }: { label: string; tint: Tint; colors: Colors }) {
  return (
    <View style={[styles.fact, { backgroundColor: colors.surface, borderColor: tint.accent + '33' }]}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function Invitation({
  def,
  books,
  tint,
  colors,
  dates,
  running,
}: {
  def: PlanDef;
  books: Book[];
  tint: Tint;
  colors: Colors;
  dates: string[];
  running: boolean;
}) {
  const steps = [
    ['1', 'Un capítulo al día, unos cinco minutos, con la misma fecha para todos los que se unen.'],
    ['2', 'Una pregunta para pensar cada día. Lo que respondas se queda solo en tu dispositivo.'],
    ['3', 'Si un día no puedes, la lectura te espera. Aquí no se pierde nada ni se compite con nadie.'],
  ];
  return (
    <Appear delay={40}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
        <Text style={[styles.kicker, { color: tint.accent }]}>Cómo funciona</Text>
        {steps.map(([n, t]) => (
          <View key={n} style={styles.step}>
            <View style={[styles.stepN, { backgroundColor: tint.soft }]}>
              <Text style={{ color: tint.accent, fontWeight: '700' }}>{n}</Text>
            </View>
            <Text style={[text.body, { color: colors.text, flex: 1 }]}>{t}</Text>
          </View>
        ))}
        {running && (
          <Text style={[text.small, { color: colors.muted, marginTop: 12 }]}>
            Ya empezó, pero puedes unirte hoy y leer a tu paso: las lecturas anteriores te esperan.
          </Text>
        )}
        <Pressable
          onPress={() => startPlan(def, books, { minutes: 5, daysPerWeek: 7 })}
          style={({ pressed }) => [styles.primary, { backgroundColor: tint.accent }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={{ color: tint.soft, fontWeight: '700', fontSize: 16 }}>Unirme al reto</Text>
        </Pressable>
        <Pressable
          onPress={() => navigate(() => router.push(`/grupos/nuevo?reto=${def.id}` as never), 'forward')}
          style={({ pressed }) => [styles.secondary, { borderColor: tint.accent }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={{ color: tint.accent, fontWeight: '700', fontSize: 15 }}>Hacerlo con mi grupo</Text>
        </Pressable>
      </View>

      <SectionTitle>El camino</SectionTitle>
      <Calendar dates={dates} tint={tint} colors={colors} />
      <View style={{ marginTop: 8 }}>
        {def.days!.slice(0, 3).map((title, i) => (
          <Text key={i} style={[text.small, { color: colors.muted, marginTop: 4 }]}>
            Día {i + 1} · <Text style={{ color: colors.text, fontFamily: serif, fontSize: 15 }}>{title}</Text> ·{' '}
            {books.find((b) => b.id === def.spec[i][0])?.name} {def.spec[i][1]}
          </Text>
        ))}
        <Text style={[text.small, { color: colors.muted, marginTop: 4 }]}>y {def.days!.length - 3} días más.</Text>
      </View>
    </Appear>
  );
}

function Joined({
  def,
  plan,
  books,
  tint,
  colors,
  dates,
  focus,
}: {
  def: PlanDef;
  plan: MyPlan;
  books: Book[];
  tint: Tint;
  colors: Colors;
  dates: string[];
  focus?: number;
}) {
  const words = useWords();
  const marks = useAllHighlights();
  const { grupos } = useAccount();
  const progress = retoProgress(plan, { dates });
  const [selected, setSelected] = useState(() => (focus !== undefined && focus < dates.length ? focus : focusDay(progress)));
  const days = planDays(plan, def, words);
  const chapters = new Set(plan.readings.map(([b, c]) => `${b}.${c}.`));
  const markCount = Object.keys(marks).filter((k) => chapters.has(k.slice(0, k.lastIndexOf('.') + 1))).length;
  const daysRead = new Set(Object.values(plan.done)).size;
  const together = (grupos ?? []).filter((g) => g.lectura?.reto === plan.id);
  const celebration = progress.celebrate ? CELEBRATIONS[progress.celebrate] : null;

  const leave = async () => {
    if (await confirm('¿Dejar este reto?', 'Se borrará tu avance y tus respuestas del reto. Tus notas y capítulos leídos se quedan.', 'Dejar'))
      removePlan(plan.id);
  };

  return (
    <>
      {celebration && (
        <Appear delay={20}>
          <View style={[styles.celebrate, { backgroundColor: tint.accent }]}>
            <IconText icon={StarIcon} color={tint.soft} size={13}>
              <Text style={[styles.kicker, { color: tint.soft }]}>{progress.celebrate}</Text>
            </IconText>
            <Text style={{ color: tint.soft, fontSize: 16, lineHeight: 23, marginTop: 6 }}>{celebration.text}</Text>
            <Text style={{ color: tint.soft, fontFamily: serif, fontSize: 17, lineHeight: 25, marginTop: 10, fontStyle: 'italic' }}>
              «{celebration.verse}»
            </Text>
            <Text style={{ color: tint.soft, fontSize: 13, fontWeight: '600', marginTop: 4, opacity: 0.85 }}>{celebration.ref}</Text>
          </View>
        </Appear>
      )}

      <Appear delay={40}>
        <View style={styles.sectionHead}>
          <SectionTitle>Tu camino</SectionTitle>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 18 }}>
            {progress.done} de {progress.total}
          </Text>
        </View>
        <Calendar dates={dates} plan={plan} progress={progress} selected={selected} onSelect={setSelected} tint={tint} colors={colors} />
        {progress.behind > 0 && !plan.finished && (
          <Text style={[text.small, { color: colors.muted, marginTop: 10, textAlign: 'center' }]}>
            {progress.behind === 1
              ? 'Una lectura de días anteriores te espera.'
              : `${progress.behind} lecturas de días anteriores te esperan.`}{' '}
            Léelas cuando puedas, sin prisa.
          </Text>
        )}
      </Appear>

      <Appear delay={60}>
        <DayCard
          key={selected}
          index={selected}
          def={def}
          plan={plan}
          books={books}
          tint={tint}
          colors={colors}
          date={dates[selected]}
          minutes={dayMinutes(plan, days[selected], words)}
          state={progress.state(selected)}
        />
      </Appear>

      <SectionTitle>Hitos</SectionTitle>
      <View style={styles.marks}>
        {progress.marks.map((m) => (
          <View
            key={m.at}
            style={[
              styles.mark,
              { borderColor: m.reached ? tint.accent : colors.border, backgroundColor: m.reached ? tint.soft : colors.surface },
            ]}
            accessibilityLabel={`${m.label}${m.reached ? ', alcanzado' : ''}`}
          >
            <StarIcon color={m.reached ? tint.accent : colors.muted} size={20} filled={m.reached} />
            <Text style={{ color: m.reached ? colors.text : colors.muted, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
              {m.label}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{m.at === 1 ? '1 lectura' : `${m.at} lecturas`}</Text>
          </View>
        ))}
      </View>

      <View style={styles.stats}>
        <Stat value={daysRead} label={daysRead === 1 ? 'día con la Palabra' : 'días con la Palabra'} tint={tint} colors={colors} />
        <Stat value={progress.reflections} label={progress.reflections === 1 ? 'respuesta escrita' : 'respuestas escritas'} tint={tint} colors={colors} />
        <Stat value={markCount} label={markCount === 1 ? 'versículo resaltado' : 'versículos resaltados'} tint={tint} colors={colors} />
      </View>

      <SectionTitle>En compañía</SectionTitle>
      <Company def={def} plan={plan} together={together} tint={tint} colors={colors} />

      <Button label={plan.finished ? 'Quitar de mis planes' : 'Dejar este reto'} kind="quiet" onPress={leave} style={{ marginTop: 28 }} />
    </>
  );
}

function Calendar({
  dates,
  plan,
  progress,
  selected,
  onSelect,
  tint,
  colors,
}: {
  dates: string[];
  plan?: MyPlan;
  progress?: ReturnType<typeof retoProgress>;
  selected?: number;
  onSelect?: (i: number) => void;
  tint: Tint;
  colors: Colors;
}) {
  const weeks = calendarWeeks(dates);
  const today = todayKey();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingHorizontal: 10 }]}>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={[styles.weekday, { color: colors.muted }]}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.weekRow}>
          {week.map((cell) => (
            <Cell
              key={cell.date}
              cell={cell}
              state={cell.index !== null && progress ? progress.state(cell.index) : cell.date === today ? 'hoy' : 'futuro'}
              selected={cell.index !== null && cell.index === selected}
              onPress={cell.index !== null && onSelect ? () => onSelect(cell.index!) : undefined}
              tint={tint}
              colors={colors}
              plan={plan}
            />
          ))}
        </View>
      ))}
      <View style={styles.legend}>
        <Legend swatch={<View style={[styles.legendDot, { backgroundColor: tint.accent }]} />} label="Leído" colors={colors} />
        <Legend swatch={<View style={[styles.legendDot, { borderWidth: 2, borderColor: tint.accent }]} />} label="Hoy" colors={colors} />
        <Legend
          swatch={<View style={[styles.legendDot, { borderWidth: 1.5, borderColor: colors.muted, borderStyle: 'dashed' }]} />}
          label="Te espera"
          colors={colors}
        />
        {weeks.some((w) => w.some((c) => c.index === null && !c.outside)) && (
          <Legend swatch={<MoonIcon color={colors.muted} size={14} />} label="Descanso" colors={colors} />
        )}
      </View>
    </View>
  );
}

function Cell({
  cell,
  state,
  selected,
  onPress,
  tint,
  colors,
  plan,
}: {
  cell: CalendarCell;
  state: ReturnType<ReturnType<typeof retoProgress>['state']>;
  selected: boolean;
  onPress?: () => void;
  tint: Tint;
  colors: Colors;
  plan?: MyPlan;
}) {
  const n = parseDate(cell.date).getDate();
  if (cell.outside) {
    return (
      <View style={styles.cell}>
        <Text style={{ color: colors.border, fontSize: 12 }}>{n}</Text>
      </View>
    );
  }
  if (cell.index === null) {
    return (
      <View style={styles.cell} accessibilityLabel={`${longDay(cell.date)}: descanso`}>
        <MoonIcon color={colors.muted} size={14} />
      </View>
    );
  }
  const done = state === 'hecho';
  const label = `Día ${cell.index + 1}, ${longDay(cell.date)}${done ? ', leído' : state === 'pendiente' ? ', te espera' : state === 'hoy' ? ', hoy' : ''}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={styles.cell}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={onPress ? { selected } : undefined}
    >
      <View
        style={[
          styles.circle,
          { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth * 2 },
          state === 'pendiente' && { borderColor: colors.muted, borderWidth: 1.5, borderStyle: 'dashed' },
          state === 'hoy' && { borderColor: tint.accent, borderWidth: 2.5 },
          done && { backgroundColor: tint.accent, borderColor: tint.accent },
          selected && { boxShadow: `0 0 0 3px ${tint.soft}, 0 0 0 5px ${tint.accent}55` },
        ]}
      >
        <Text style={{ color: done ? tint.soft : state === 'hoy' ? tint.accent : colors.text, fontWeight: done || state === 'hoy' ? '700' : '500', fontSize: 14 }}>
          {n}
        </Text>
      </View>
      {plan?.reflections?.[cell.index] && <View style={[styles.reflDot, { backgroundColor: tint.accent }]} />}
      {/* Al cambiar de mes, el nombre del mes nuevo */}
      {n === 1 && <Text style={[styles.month, { color: colors.muted }]}>{monthShort(cell.date)}</Text>}
    </Pressable>
  );
}

function Legend({ swatch, label, colors }: { swatch: ReactNode; label: string; colors: Colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {swatch}
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function DayCard({
  index,
  def,
  plan,
  books,
  tint,
  colors,
  date,
  minutes,
  state,
}: {
  index: number;
  def: PlanDef;
  plan: MyPlan;
  books: Book[];
  tint: Tint;
  colors: Colors;
  date: string;
  minutes: number;
  state: ReturnType<ReturnType<typeof retoProgress>['state']>;
}) {
  const saved = plan.reflections?.[index] ?? '';
  const [draft, setDraft] = useState(saved);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => setDraft(saved), [saved]);
  const [b, c] = plan.readings[index];
  const label = readingsLabel(plan, [index], books);
  const done = state === 'hecho';
  const changed = draft.trim() !== saved;

  const store = async () => {
    await saveReflection(plan.id, index, draft);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  return (
    <View style={[styles.card, styles.day, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.dayStripe, { backgroundColor: tint.accent }]} />
      <Text style={[styles.kicker, { color: tint.accent }]}>
        Día {index + 1} · {state === 'hoy' ? 'hoy' : longDay(date)}
      </Text>
      <Text style={[styles.dayTitle, { color: colors.text }]}>{def.days?.[index]}</Text>
      <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>
        {label} · {minutes} min
      </Text>
      {done && (
        <IconText icon={CheckIcon} color={tint.accent} size={15} gap={5} style={{ marginTop: 8 }}>
          <Text style={{ color: tint.accent, fontSize: 13, fontWeight: '600' }}>Leído el {shortDate(plan.done[index])}</Text>
        </IconText>
      )}
      <Pressable
        onPress={() => navigate(() => router.push(chapterHref(b, c)), 'forward')}
        style={({ pressed }) => [
          done ? styles.secondary : styles.primary,
          done ? { borderColor: tint.accent } : { backgroundColor: tint.accent },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
      >
        <Text style={{ color: done ? tint.accent : tint.soft, fontWeight: '700', fontSize: 15 }}>
          {done ? `Volver a leer ${label}` : `Leer ${label}`}
        </Text>
      </Pressable>

      {def.questions?.[index] && (
        <View style={[styles.think, { borderColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.muted }]}>Para pensar</Text>
          <Text style={[styles.question, { color: colors.text }]}>{def.questions[index]}</Text>
          <View style={{ marginTop: 12 }}>
            <Field
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribe lo que Dios te muestra… (solo tú lo verás)"
              multiline
              maxLength={2000}
              accessibilityLabel="Tu respuesta"
            />
          </View>
          {(changed || justSaved || saved) && (
            <View style={styles.saveRow}>
              <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
                {justSaved ? 'Guardado en tu dispositivo.' : saved && !changed ? 'Tu respuesta está guardada.' : ' '}
              </Text>
              {changed && (
                <Pressable
                  onPress={store}
                  style={({ pressed }) => [styles.save, { backgroundColor: tint.soft }, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: tint.accent, fontWeight: '700' }}>Guardar respuesta</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Company({
  def,
  plan,
  together,
  tint,
  colors,
}: {
  def: PlanDef;
  plan: MyPlan;
  together: NonNullable<ReturnType<typeof useAccount>['grupos']>;
  tint: Tint;
  colors: Colors;
}) {
  const [copied, setCopied] = useState(false);
  const origin = Platform.OS === 'web' && typeof location !== 'undefined' ? location.origin : 'https://zarzabiblia.com';
  const url = `${origin}/planes/${def.id}`;
  const message = `Te invito a hacer conmigo el reto «${def.title}»: un capítulo al día y una pregunta para pensar. ${url}`;
  const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator);
  const invite = async () => {
    if (canShare) return shareMessage(message);
    await Clipboard.setStringAsync(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {together.length > 0 ? (
        together.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => navigate(() => router.push(`/grupos/${g.id}`), 'forward')}
            style={({ pressed }) => [styles.groupRow, { borderColor: colors.border }, pressed && styles.pressed]}
            accessibilityRole="link"
          >
            <View style={[styles.groupIcon, { backgroundColor: tint.soft }]}>
              <PeopleIcon color={tint.accent} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{g.nombre}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {g.lectura?.estado === 'activo'
                  ? `${g.leyeronHoy} de ${g.miembros} leyeron la lectura de hoy`
                  : `${g.miembros} ${g.miembros === 1 ? 'persona' : 'personas'} en el reto`}
              </Text>
            </View>
            <ChevronRightIcon color={colors.muted} size={18} />
          </Pressable>
        ))
      ) : (
        <Text style={[text.body, { color: colors.text }]}>
          Los retos se disfrutan más acompañados. Hazlo con tu célula o tu familia y conversen cada semana sobre las preguntas.
        </Text>
      )}
      <View style={styles.companyActions}>
        <Pressable
          onPress={() => navigate(() => router.push(`/grupos/nuevo?reto=${def.id}` as never), 'forward')}
          style={({ pressed }) => [styles.secondary, styles.flex, { borderColor: tint.accent, marginTop: 0 }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={{ color: tint.accent, fontWeight: '700' }}>Crear un grupo para el reto</Text>
        </Pressable>
        <Pressable
          onPress={invite}
          style={({ pressed }) => [styles.secondary, styles.flex, { borderColor: tint.accent, marginTop: 0 }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={{ color: tint.accent, fontWeight: '700' }}>{copied ? 'Invitación copiada' : 'Invitar a alguien'}</Text>
        </Pressable>
      </View>
      {plan.finished && (
        <Text style={[text.small, { color: colors.muted, marginTop: 12 }]}>
          ¿Quién te acompañó en el camino? Cuéntale lo que más te habló estos días.
        </Text>
      )}
    </View>
  );
}

function Stat({ value, label, tint, colors }: { value: number; label: string; tint: Tint; colors: Colors }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={{ color: tint.accent, fontSize: 24, fontFamily: serif }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 24, padding: 22, overflow: 'hidden' },
  heroGlyph: { position: 'absolute', right: -24, top: -26, opacity: 0.1 },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { fontFamily: serif, fontSize: 28, lineHeight: 34, fontWeight: '700', marginTop: 4 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  fact: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  status: { fontSize: 15, fontWeight: '700', marginTop: 16 },
  meaning: { fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 14 },
  stepN: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { borderRadius: 24, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  secondary: { borderRadius: 24, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', borderWidth: 1.5, marginTop: 10 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  celebrate: { borderRadius: 20, padding: 20, marginTop: 16 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  weekday: { width: 40, textAlign: 'center', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  cell: { width: 40, height: 46, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  month: { position: 'absolute', top: -4, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  reflDot: { width: 5, height: 5, borderRadius: 3, position: 'absolute', bottom: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  day: { marginTop: 16, paddingTop: 22, overflow: 'hidden' },
  dayStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  dayTitle: { fontFamily: serif, fontSize: 23, lineHeight: 29, marginTop: 6 },
  think: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 16 },
  question: { fontFamily: serif, fontSize: 18, lineHeight: 27, marginTop: 6 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, minHeight: 36 },
  save: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  marks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mark: { flexGrow: 1, flexBasis: '22%', minWidth: 120, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'center', gap: 3 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  groupIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  companyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  flex: { flexGrow: 1, flexBasis: 200 },
});
