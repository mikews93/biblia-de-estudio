import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, ClockIcon, FlameIcon, HeartIcon, LockIcon, PrayIcon } from '@/components/icons';
import MiActividad from '@/components/MiActividad';
import MiCamino from '@/components/MiCamino';
import { OracionEditor, OracionesVista } from '@/components/Oraciones';
import StudyPanel from '@/components/StudyPanel';
import { IconText, text } from '@/components/comunidad/ui';
import { Book, getBooks } from '@/lib/data';
import { verseOfTheDay } from '@/lib/daily';
import { Entrada, deleteEntrada, toggleHecho, useDiario } from '@/lib/diario';
import { useOraciones } from '@/lib/oraciones';
import { useRacha } from '@/lib/racha';
import { chapterHref, verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import EnlaceExportar from '@/components/EnlaceExportar';

type Vista = 'actividad' | 'devocionales' | 'oraciones' | 'camino';
const VISTAS: { key: Vista; label: string; icon: typeof HeartIcon }[] = [
  { key: 'actividad', label: 'Actividad', icon: FlameIcon },
  { key: 'devocionales', label: 'Devocionales', icon: HeartIcon },
  { key: 'oraciones', label: 'Oraciones', icon: PrayIcon },
  { key: 'camino', label: 'Mi camino', icon: ClockIcon },
];

/**
 * «Mi diario»: toda la actividad día por día con la racha devocional (?hoy=1 abre el devocional de hoy), los devocionales (lo que la persona escribió al terminar cada uno), sus oraciones (con los versículos
 * que la acompañan y lo que Dios respondió) y «Mi camino», todo junto a lo largo de los años.
 */
export default function Diario() {
  const colors = useColors();
  const params = useLocalSearchParams<{ vista?: string; hoy?: string }>();
  const [vista, setVista] = useState<Vista>(VISTAS.some((v) => v.key === params.vista) ? (params.vista as Vista) : 'actividad');
  const { width } = useWindowDimensions();
  const angosto = width < 440;
  const racha = useRacha();
  const [profundo, setProfundo] = useState(false);
  const entradas = useDiario();
  const oraciones = useOraciones();
  const [orarPor, setOrarPor] = useState<Entrada | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  // El aviso de la racha abre Mi diario con el devocional de hoy.
  const [today, setToday] = useState(params.hoy === '1');
  const daily = verseOfTheDay();

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const pasos = entradas.filter((e) => e.paso);
  const hechos = pasos.filter((e) => e.hecho).length;
  const dailyBook = books.find((b) => b.id === daily.book);
  const doneToday = entradas.some((e) => sameDay(e.created, Date.now()));

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Mi diario' }} />

      <View style={[styles.tabs, { backgroundColor: colors.accentSoft }]} accessibilityRole="tablist">
        {VISTAS.map(({ key, label, icon: Icon }) => {
          const on = vista === key;
          return (
            <Pressable
              key={key}
              onPress={() => {
                setVista(key);
                router.setParams({ vista: key === 'actividad' ? undefined : key, hoy: undefined });
              }}
              accessibilityRole="tab"
              aria-selected={on}
              style={[styles.tab, on && [styles.tabOn, { backgroundColor: colors.surface }]]}
            >
              {!angosto && <Icon color={on ? colors.text : colors.muted} size={16} strokeWidth={on ? 2.1 : 1.8} />}
              <Text style={{ color: on ? colors.text : colors.muted, fontWeight: on ? '700' : '600', fontSize: angosto ? 12.5 : 13 }} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {vista === 'actividad' ? (
        <MiActividad colors={colors} onDevocional={() => setToday(true)} onProfundo={() => setProfundo(true)} />
      ) : vista === 'oraciones' ? (
        <OracionesVista />
      ) : vista === 'camino' ? (
        <MiCamino entradas={entradas} oraciones={oraciones} />
      ) : entradas.length === 0 ? (
        <Appear style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <HeartIcon color={colors.accent} size={40} strokeWidth={1.5} />
          <Text style={[text.title, { color: colors.text, textAlign: 'center', marginTop: 6 }]}>Tu diario está esperando</Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center', marginTop: 8 }]}>
            Al terminar un devocional, lo que escribas (la frase que te detuvo, tu oración y tu paso para hoy) se guarda
            aquí. Es privado: solo tú lo ves.
          </Text>
          {dailyBook && (
            <Pressable onPress={() => setToday(true)} style={[styles.cta, { backgroundColor: colors.accent }]}>
              <Text style={{ color: colors.surface, fontWeight: '700' }}>Hacer el devocional de hoy</Text>
            </Pressable>
          )}
        </Appear>
      ) : (
        <>
          <Appear style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.heroKicker, { color: colors.accent }]}>ESTA SEMANA</Text>
            <Week entradas={entradas} colors={colors} />
            <View style={styles.summary}>
              <Stat value={entradas.length} label={entradas.length === 1 ? 'devocional' : 'devocionales'} colors={colors} />
              <Stat value={`${hechos}/${pasos.length}`} label="pasos dados" colors={colors} />
              <Stat value={racha.actual} label={racha.actual === 1 ? 'día de racha' : 'días de racha'} colors={colors} warm={racha.actual > 0} />
            </View>
            {dailyBook && !doneToday && (
              <Pressable
                onPress={() => setToday(true)}
                style={({ pressed }) => [styles.todayBtn, { backgroundColor: colors.accent }, pressed && { opacity: 0.85 }]}
              >
                <IconText icon={HeartIcon} color={colors.surface} size={18} gap={8}>
                  <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>Haz el devocional de hoy</Text>
                </IconText>
                <Text style={{ color: colors.accentSoft, fontSize: 13 }}>10 min</Text>
              </Pressable>
            )}
          </Appear>
          {entradas.map((e, i) => (
            <Appear key={e.id} delay={Math.min(i, 6) * 40}>
              <EntryCard entrada={e} colors={colors} onOrar={() => setOrarPor(e)} />
            </Appear>
          ))}
          <IconText icon={LockIcon} color={colors.muted} size={13} style={{ marginTop: 8, justifyContent: 'center' }}>
            <Text style={[text.small, { color: colors.muted, flexShrink: 1 }]}>Tu diario es privado: solo tú lo ves.</Text>
          </IconText>
          <EnlaceExportar texto="Guardar tu diario y oraciones en un documento" />
        </>
      )}

      {orarPor && (
        <OracionEditor
          inicial={{
            detalle: orarPor.oracion,
            versiculo: orarPor.llevar
              ? {
                  book: orarPor.book,
                  chapter: orarPor.chapter,
                  verse: orarPor.llevar.verse,
                  reference: `${orarPor.reference.replace(/:\d+(-\d+)?$/, '')}:${orarPor.llevar.verse}`,
                  text: orarPor.llevar.text,
                }
              : undefined,
          }}
          onClose={() => setOrarPor(null)}
          onGuardada={() => setVista('oraciones')}
        />
      )}

      {today && dailyBook && (
        <StudyPanel
          book={dailyBook}
          chapter={daily.chapter}
          verse={daily.verse}
          enfoque="devocional"
          onClose={() => setToday(false)}
        />
      )}

      {profundo && dailyBook && (
        <StudyPanel book={dailyBook} chapter={daily.chapter} verse={daily.verse} enfoque="profundo" onClose={() => setProfundo(false)} />
      )}
    </ScrollView>
  );
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Los siete días de la semana (de lunes a domingo), marcados los que tuvieron devocional. */
function Week({ entradas, colors }: { entradas: Entrada[]; colors: Colors }) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return (
    <View style={styles.week}>
      {DAYS.map((label, i) => {
        const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i).getTime();
        const done = entradas.some((e) => sameDay(e.created, day));
        const today = sameDay(day, now.getTime());
        return (
          <View key={label} style={styles.weekDay}>
            <View
              style={[
                styles.weekDot,
                {
                  borderColor: done || today ? colors.accent : colors.border,
                  backgroundColor: done ? colors.accent : 'transparent',
                  borderWidth: today && !done ? 2 : 1.5,
                },
              ]}
            >
              {done && <HeartIcon color={colors.surface} size={14} filled />}
            </View>
            <Text style={{ color: today ? colors.text : colors.muted, fontSize: 12, fontWeight: today ? '700' : '500', marginTop: 6 }}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Stat({ value, label, colors, warm }: { value: number | string; label: string; colors: Colors; warm?: boolean }) {
  return (
    <View style={{ marginRight: 22 }}>
      <Text style={{ fontFamily: serif, fontSize: 26, color: warm ? colors.warm : colors.text }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

function EntryCard({ entrada: e, colors, onOrar }: { entrada: Entrada; colors: Colors; onOrar: () => void }) {
  const [prayer, setPrayer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const created = new Date(e.created);
  const weekday = created.toLocaleDateString('es', { weekday: 'long' });
  const month = created.toLocaleDateString('es', { month: 'short' }).replace('.', '');
  const open = () =>
    navigate(
      () => router.push(e.verse ? verseHref(e.book, e.chapter, e.verse) : chapterHref(e.book, e.chapter)),
      'forward',
    );

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardRow}>
      <View style={[styles.dateCol, { borderColor: colors.border }]}>
        <Text style={[styles.dateDay, { color: colors.accent }]}>{created.getDate()}</Text>
        <Text style={[styles.dateMonth, { color: colors.muted }]}>{month.toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
      <Text style={[styles.date, { color: colors.muted }]}>{weekday[0].toUpperCase() + weekday.slice(1)}</Text>
      <Pressable onPress={open} accessibilityRole="link">
        <Text style={[styles.ref, { color: colors.text }]}>
          {e.reference} <Text style={{ color: colors.accent, fontSize: 16 }}>›</Text>
        </Text>
      </Pressable>

      {!!e.palabra && (
        <View style={[styles.quote, { borderColor: colors.accent }]}>
          <Text style={[styles.quoteText, { color: colors.text }]}>{e.palabra}</Text>
        </View>
      )}

      {!!e.paso && (
        <Pressable
          onPress={() => toggleHecho(e.id)}
          style={[styles.step, { backgroundColor: e.hecho ? colors.accentSoft : colors.background }]}
          accessibilityRole="checkbox"
          aria-checked={!!e.hecho}
        >
          <View style={[styles.check, { borderColor: colors.accent, backgroundColor: e.hecho ? colors.accent : 'transparent' }]}>
            {e.hecho && <CheckIcon color={colors.surface} size={14} strokeWidth={2.6} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stepLabel, { color: colors.accent }]}>{e.hecho ? 'PASO DADO' : 'MI PASO'}</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{e.paso}</Text>
          </View>
        </Pressable>
      )}

      {!!e.oracion &&
        (prayer ? (
          <Pressable onPress={() => setPrayer(false)}>
            <Text style={[styles.stepLabel, { color: colors.muted, marginTop: 12 }]}>MI ORACIÓN</Text>
            <Text style={[styles.prayer, { color: colors.text }]}>{e.oracion}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setPrayer(true)} hitSlop={6}>
            <IconText icon={PrayIcon} color={colors.accent} size={15} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Ver mi oración</Text>
            </IconText>
          </Pressable>
        ))}

      {e.llevar && !e.palabra.includes(e.llevar.text) && (
        <Text style={[styles.carry, { color: colors.muted }]}>
          Para llevar: «{e.llevar.text}» (v. {e.llevar.verse})
        </Text>
      )}

      </View>
      </View>
      <View style={styles.cardFoot}>
      <Pressable onPress={onOrar} hitSlop={6} accessibilityRole="button">
        <IconText icon={PrayIcon} color={colors.muted} size={14}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>Seguir orando por esto</Text>
        </IconText>
      </Pressable>
      <Pressable
        onPress={() => (confirm ? deleteEntrada(e.id) : setConfirm(true))}
        onBlur={() => setConfirm(false)}
        hitSlop={6}
      >
        <Text style={{ color: confirm ? '#B3261E' : colors.muted, fontSize: 12, fontWeight: confirm ? '700' : '500' }}>
          {confirm ? 'Toca otra vez para borrar' : 'Borrar'}
        </Text>
      </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 28, alignItems: 'center', marginTop: 12 },
  cta: { borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12, marginTop: 20 },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 20, marginBottom: 18 },
  heroKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 14 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', flex: 1 },
  weekDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  todayBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 16,
  },
  cardRow: { flexDirection: 'row', gap: 16 },
  dateCol: { alignItems: 'center', width: 44, borderRightWidth: StyleSheet.hairlineWidth, paddingRight: 14 },
  dateDay: { fontFamily: serif, fontSize: 28, lineHeight: 32 },
  dateMonth: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, marginBottom: 14 },
  date: { fontSize: 12, fontWeight: '600' },
  ref: { fontFamily: serif, fontSize: 22, marginTop: 2 },
  quote: { borderLeftWidth: 3, paddingLeft: 12, marginTop: 12 },
  quoteText: { fontFamily: serif, fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  step: { flexDirection: 'row', gap: 12, borderRadius: 12, padding: 12, marginTop: 12, alignItems: 'flex-start' },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginBottom: 2 },
  prayer: { fontFamily: serif, fontSize: 16, lineHeight: 24 },
  carry: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 18 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10 },
  tabOn: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
});
