import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import PlanIcon from '@/components/PlanIcon';
import {
  BellIcon,
  BooksIcon,
  DownloadIcon,
  HeartIcon,
  MicIcon,
  PencilIcon,
  PeopleIcon,
  PersonIcon,
  PlansIcon,
  SearchIcon,
  SparkIcon,
  type IconProps,
} from '@/components/icons';
import PlanCard from '@/components/PlanCard';
import { Avatar } from '@/components/comunidad/ui';
import StudyPanel from '@/components/StudyPanel';
import VerseImage from '@/components/VerseImage';
import { useAccount } from '@/lib/comunidad';
import { Book, Version, getBooks, getChapter, getVersions } from '@/lib/data';
import { cerrarInvitacion, soporte, useAvisos } from '@/lib/avisos';
import { greeting, questionOfTheDay, verseOfTheDay } from '@/lib/daily';
import { PLANS, dateKey, nextSeason, usePlans, useWords } from '@/lib/planes';
import { WEEKLY_GOAL, useProgress, weekDays } from '@/lib/progress';
import { seasonTint } from '@/lib/retos';
import { chapterHref, verseHref } from '@/lib/routes';
import { dueCards, useCards } from '@/lib/tarjetas';
import { getLastRead, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { voiceSupported } from '@/lib/voz';

/** Inicio («Hoy»): seguir leyendo, el versículo del día, la semana y accesos. */
export default function Today() {
  const colors = useColors();
  const { usuario } = useAccount();
  const { settings } = useSettings();
  const progress = useProgress();
  const plans = usePlans();
  const words = useWords();
  const due = dueCards(useCards()).length;
  const [books, setBooks] = useState<Book[]>([]);
  const [last, setLast] = useState<{ book: string; chapter: number } | null>(null);
  const [verseText, setVerseText] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [sharing, setSharing] = useState(false);
  const [devotional, setDevotional] = useState(false);
  const daily = verseOfTheDay();
  const avisos = useAvisos();
  const [canNotify, setCanNotify] = useState(false);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
    getLastRead().then(setLast);
    getVersions().then(setVersions).catch(() => {});
    const s = soporte();
    setCanNotify(s === 'si' || s === 'ios-instalar');
  }, []);

  useEffect(() => {
    getChapter(daily.book, daily.chapter, settings.version)
      .then((verses) => setVerseText(verses.find(([n]) => n === daily.verse)?.[1] ?? null))
      .catch(() => setVerseText(null));
  }, [daily.book, daily.chapter, daily.verse, settings.version]);

  const name = (id: string) => books.find((b) => b.id === id)?.name ?? '';
  const dailyRef = `${name(daily.book)} ${daily.chapter}:${daily.verse}`;
  const week = weekDays(progress.days);
  const daysThisWeek = week.filter((d) => d.read).length;
  const chaptersRead = Object.values(progress.chapters).reduce((s, c) => s + c.length, 0);
  const continueTo = last ?? { book: 'jhn', chapter: 1 };
  // Los planes que aún no empiezan (un reto de temporada) aparecen tres semanas antes
  const soon = dateKey(new Date(Date.now() + 21 * 86_400_000));
  const activePlans = plans.filter((p) => !p.finished && p.started <= soon);
  // El próximo reto de temporada se anuncia desde un mes antes, si la persona aún no se unió
  const upcoming = PLANS.filter((p) => p.season)
    .map((def) => ({ def, season: nextSeason(def)! }))
    .sort((a, b) => a.season.start.localeCompare(b.season.start))
    .find(({ def, season }) => season.daysToStart <= 30 && !plans.some((p) => p.id === `${def.id}-${season.year}`));
  const upcomingTint = upcoming ? seasonTint(upcoming.def.season!, colors) : null;


  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false, title: 'Hoy' }} />

      <Appear>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.date, { color: colors.muted }]}>
              {capitalize(new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }))}
            </Text>
            <Text style={[styles.hello, { color: colors.text, fontFamily: serif }]}>{greeting()}</Text>
          </View>
          {canNotify && (
            <Pressable
              onPress={() => navigate(() => router.push('/notificaciones' as never), 'forward')}
              style={({ pressed }) => [styles.bell, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Notificaciones"
            >
              <BellIcon color={colors.accent} />
              {avisos.endpoint && <View style={[styles.bellDot, { backgroundColor: colors.accent, borderColor: colors.surface }]} />}
            </Pressable>
          )}
          <Pressable
            onPress={() => navigate(() => router.push('/cuenta'), 'forward')}
            style={({ pressed }) => [styles.bell, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Tu perfil"
          >
            {usuario ? <Avatar name={usuario.nombre} foto={usuario.foto} size={38} /> : <PersonIcon color={colors.accent} />}
          </Pressable>
        </View>
      </Appear>

      <Appear delay={20}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={() => navigate(() => router.push('/buscar'), 'forward')}
            style={styles.searchField}
            accessibilityRole="search"
            accessibilityLabel="Buscar una cita, unas palabras o una idea"
          >
            <SearchIcon color={colors.muted} size={18} />
            <Text style={{ color: colors.muted, fontSize: 15 }} numberOfLines={1}>
              Buscar una cita o un versículo
            </Text>
          </Pressable>
          {voiceSupported() && (
            <Pressable
              onPress={() => navigate(() => router.push('/buscar?voz=1' as never), 'forward')}
              style={styles.searchMic}
              accessibilityRole="button"
              accessibilityLabel="Dictar la búsqueda"
            >
              <MicIcon color={colors.accent} />
            </Pressable>
          )}
        </View>
      </Appear>

      <Appear delay={40}>
        <Pressable
          onPress={() => navigate(() => router.push(chapterHref(continueTo.book, continueTo.chapter)), 'forward')}
          style={({ pressed }) => [styles.continue, { backgroundColor: colors.accent }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.kicker, { color: colors.accentSoft }]}>{last ? 'Seguir leyendo' : 'Empieza aquí'}</Text>
          <Text style={[styles.continueTitle, { color: colors.surface, fontFamily: serif }]}>
            {name(continueTo.book)} {continueTo.chapter}
          </Text>
          <Text style={{ color: colors.accentSoft, marginTop: 4 }}>Abrir el capítulo ›</Text>
        </Pressable>
      </Appear>

      <Appear delay={80}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.accent }]}>Versículo del día</Text>
          <Text style={[styles.verse, { color: colors.text, fontFamily: serif }]}>
            {verseText ? `«${verseText}»` : ' '}
          </Text>
          <Text style={[styles.ref, { color: colors.muted }]}>{dailyRef}</Text>
          {books.length > 0 && (
            <Pressable
              onPress={() => setDevotional(true)}
              style={({ pressed }) => [styles.devotional, { backgroundColor: colors.accent }, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={styles.devotionalLabel}>
                <HeartIcon color={colors.surface} size={18} strokeWidth={2} />
                <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>Haz el devocional de hoy</Text>
              </View>
              <Text style={{ color: colors.accentSoft, fontSize: 13 }}>10 min</Text>
            </Pressable>
          )}
          <View style={styles.row}>
            <SmallButton
              label="Leer el capítulo"
              colors={colors}
              onPress={() => navigate(() => router.push(verseHref(daily.book, daily.chapter, daily.verse)), 'forward')}
            />
            {verseText && <SmallButton label="Compartir" colors={colors} onPress={() => setSharing(true)} />}
          </View>
          <View style={[styles.question, { borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>PARA PENSAR HOY</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{questionOfTheDay()}</Text>
          </View>
        </View>
      </Appear>

      {activePlans.map((p, i) => (
        <Appear key={p.id} delay={100 + i * 20}>
          <PlanCard plan={p} books={books} words={words} colors={colors} />
        </Appear>
      ))}

      {due > 0 && (
        <Appear delay={105}>
          <Pressable
            onPress={() => navigate(() => router.push('/repaso' as never), 'forward')}
            style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={[styles.kicker, { color: colors.accent }]}>Repaso de hoy</Text>
            <Text style={{ color: colors.text, fontSize: 17, marginTop: 6 }}>
              {due} {due === 1 ? 'tarjeta te espera' : 'tarjetas te esperan'} para no olvidar lo que estudiaste.
            </Text>
            <Text style={{ color: colors.accent, fontWeight: '700', marginTop: 10 }}>Repasar ›</Text>
          </Pressable>
        </Appear>
      )}

      {upcoming && upcomingTint && (
        <Appear delay={110}>
          <Pressable
            onPress={() => navigate(() => router.push(`/planes/${upcoming.def.id}`), 'forward')}
            style={({ pressed }) => [styles.card, styles.reto, { backgroundColor: upcomingTint.soft, borderColor: upcomingTint.soft }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.retoGlyph} aria-hidden>
              <PlanIcon icono={upcoming.def.icono} color={upcomingTint.accent} size={150} strokeWidth={1.2} />
            </View>
            <Text style={[styles.kicker, { color: upcomingTint.accent }]}>
              {upcoming.season.running
                ? `Reto de ${upcomingTint.name} · en curso`
                : upcoming.season.daysToStart === 1
                  ? `Reto de ${upcomingTint.name} · empieza mañana`
                  : `Reto de ${upcomingTint.name} · empieza en ${upcoming.season.daysToStart} días`}
            </Text>
            <Text style={[styles.continueTitle, { color: colors.text, fontFamily: serif, fontSize: 22 }]}>{upcoming.def.title}</Text>
            <Text style={{ color: colors.text, marginTop: 6, opacity: 0.85 }}>{upcoming.def.description}</Text>
            <View style={[styles.retoButton, { backgroundColor: upcomingTint.accent }]}>
              <Text style={{ color: upcomingTint.soft, fontWeight: '700' }}>Ver el reto ›</Text>
            </View>
          </Pressable>
        </Appear>
      )}

      {canNotify && avisos.ready && !avisos.endpoint && !avisos.invitacionVista && (
        <Appear delay={115}>
          <View style={[styles.card, styles.invite, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="invitacion-avisos">
            <View style={[styles.inviteIcon, { backgroundColor: colors.accentSoft }]}>
              <BellIcon color={colors.accent} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>¿Te recordamos leer cada día?</Text>
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
                Elige una hora y te avisamos con tu lectura, tus tarjetas y el día del desafío.
              </Text>
              <View style={[styles.row, { marginTop: 12 }]}>
                <SmallButton
                  label="Elegir hora"
                  colors={colors}
                  onPress={() => navigate(() => router.push('/notificaciones' as never), 'forward')}
                />
                <Pressable onPress={cerrarInvitacion} style={styles.small} accessibilityRole="button">
                  <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>Ahora no</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Appear>
      )}

      <Appear delay={120}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.accent }]}>Tu semana</Text>
          <View style={styles.week}>
            {week.map((d, i) => (
              <View key={i} style={{ alignItems: 'center' }}>
                <View
                  style={[
                    styles.dot,
                    { borderColor: d.isToday ? colors.accent : colors.border },
                    d.read && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                />
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{d.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.text, fontSize: 14, marginTop: 10, textAlign: 'center' }}>
            {daysThisWeek >= WEEKLY_GOAL
              ? `¡Meta cumplida! ${daysThisWeek} días con la Palabra esta semana.`
              : `${daysThisWeek} de ${WEEKLY_GOAL} días esta semana · ${chaptersRead} capítulos leídos en total`}
          </Text>
        </View>
      </Appear>

      <Appear delay={160} style={styles.grid}>
        <Tile icon={BooksIcon} label="Libros" colors={colors} onPress={() => navigate(() => router.push('/libros'))} />
        <Tile
          icon={PlansIcon}
          label={activePlans.length ? 'Planes' : 'Elegir un plan'}
          colors={colors}
          onPress={() => navigate(() => router.push('/planes'), 'forward')}
        />
        <Tile icon={PencilIcon} label="Mis notas" colors={colors} onPress={() => navigate(() => router.push('/notas'), 'forward')} />
        <Tile icon={HeartIcon} label="Mi diario" colors={colors} onPress={() => navigate(() => router.push('/diario' as never), 'forward')} />
        <Tile
          icon={SparkIcon}
          label="Estudiar con IA"
          colors={colors}
          onPress={() => navigate(() => router.push(chapterHref(continueTo.book, continueTo.chapter)), 'forward')}
        />
        <Tile
          icon={PeopleIcon}
          label="Comunidad"
          colors={colors}
          onPress={() => navigate(() => router.push('/comunidades' as never), 'forward')}
        />
        <Tile icon={DownloadIcon} label="Sin conexión" colors={colors} onPress={() => navigate(() => router.push('/descargas' as never), 'forward')} />
      </Appear>
      {devotional && books.find((b) => b.id === daily.book) && (
        <StudyPanel
          book={books.find((b) => b.id === daily.book)!}
          chapter={daily.chapter}
          verse={daily.verse}
          enfoque="devocional"
          onClose={() => setDevotional(false)}
        />
      )}
      {sharing && verseText && (
        <VerseImage
          verse={{
            book: daily.book,
            chapter: daily.chapter,
            verse: daily.verse,
            text: verseText,
            reference: dailyRef,
            version: versions.find((v) => v.id === settings.version)?.abbr ?? 'RV1909',
          }}
          onClose={() => setSharing(false)}
        />
      )}
    </ScrollView>
  );
}

type C = ReturnType<typeof useColors>;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function SmallButton({ label, colors, onPress }: { label: string; colors: C; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.small, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function Tile({ icon: Icon, label, colors, onPress }: { icon: (p: IconProps) => React.ReactNode; label: string; colors: C; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.tileIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon color={colors.accent} size={22} />
      </View>
      <Text style={{ color: colors.text, fontWeight: '600', marginTop: 8 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 48, paddingBottom: 64, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  invite: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  inviteIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  date: { fontSize: 14 },
  hello: { fontSize: 34, marginTop: 2 },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, marginTop: 16, paddingRight: 6 },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  searchMic: { paddingHorizontal: 10, paddingVertical: 8 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  continue: { borderRadius: 20, padding: 20 },
  continueTitle: { fontSize: 28, marginTop: 6 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  reto: { overflow: 'hidden' },
  retoGlyph: { position: 'absolute', right: -14, top: -18, opacity: 0.12 },
  retoButton: { alignSelf: 'flex-start', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9, marginTop: 14 },
  verse: { fontSize: 21, lineHeight: 31, marginTop: 10 },
  ref: { marginTop: 8, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  small: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  question: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 14 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  devotional: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 14,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  devotionalLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tile: { flexGrow: 1, flexBasis: '28%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 16, alignItems: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
