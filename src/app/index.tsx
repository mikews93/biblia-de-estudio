import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import PlanIcon from '@/components/PlanIcon';
import Sello from '@/components/Sello';
import {
  BellIcon,
  BooksIcon,
  RouteIcon,
  DownloadIcon,
  HeartIcon,
  LecternIcon,
  MicIcon,
  PencilIcon,
  PeopleIcon,
  PersonIcon,
  PlansIcon,
  PromiseIcon,
  SearchIcon,
  SparkIcon,
  WordJourneyIcon,
  StarIcon,
  type IconProps,
} from '@/components/icons';
import PlanCard from '@/components/PlanCard';
import HoyJovenes from '@/components/jovenes/HoyJovenes';
import HoyNinos from '@/components/ninos/HoyNinos';
import { Avatar } from '@/components/comunidad/ui';
import { InvitacionCuenta, NubeEstado, useEstadoNube } from '@/components/Sincronia';
import StudyPanel from '@/components/StudyPanel';
import VerseImage from '@/components/VerseImage';
import { useAccount } from '@/lib/comunidad';
import { Book, Version, getBooks, getChapter, getVersions } from '@/lib/data';
import { cerrarInvitacion, soporte, useAvisos } from '@/lib/avisos';
import { greeting, questionOfTheDay, verseOfTheDay } from '@/lib/daily';
import { Ruta } from '@/components/SemanaSermon';
import { palabraDeLaSemana, palabraHref, palabrasHref } from '@/lib/palabras';
import { PLANS, dateKey, nextSeason, usePlans, useWords } from '@/lib/planes';
import { WEEKLY_GOAL, useProgress, weekDays } from '@/lib/progress';
import { seasonTint } from '@/lib/retos';
import { ganadosRecientes, sellosPara, siguienteSello, useSellos } from '@/lib/sellos';
import { diaDeHoy, semanaActiva, siguiente, useSemanas } from '@/lib/semanas';
import { chapterHref, verseHref } from '@/lib/routes';
import { dueCards, useCards } from '@/lib/tarjetas';
import { serif, useColors, useLastRead, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { voiceSupported } from '@/lib/voz';

/**
 * Inicio («Hoy»). En el Modo Jóvenes, su propio Hoy con la misión del día (src/components/jovenes/HoyJovenes.tsx);
 * en el Espacio Niños, la historia que sigue y el versículo de la semana (src/components/ninos/HoyNinos.tsx).
 */
export default function Hoy() {
  const { settings } = useSettings();
  return settings.modo === 'jovenes' ? <HoyJovenes /> : settings.modo === 'ninos' ? <HoyNinos /> : <Today />;
}

/** Inicio para todos: seguir leyendo, el versículo del día, la semana y accesos. */
function Today() {
  const colors = useColors();
  const { usuario } = useAccount();
  const { settings } = useSettings();
  const progress = useProgress();
  const plans = usePlans();
  const words = useWords();
  const due = dueCards(useCards()).length;
  const semana = semanaActiva(useSemanas().semanas);
  const [books, setBooks] = useState<Book[]>([]);
  const last = useLastRead();
  const nube = useEstadoNube();
  const [verseText, setVerseText] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [sharing, setSharing] = useState(false);
  const [devotional, setDevotional] = useState(false);
  const daily = verseOfTheDay();
  const avisos = useAvisos();
  const [canNotify, setCanNotify] = useState(false);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
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
              {avisos.endpoint && <View style={[styles.bellDot, { backgroundColor: colors.warm, borderColor: colors.surface }]} />}
            </Pressable>
          )}
          <Pressable
            onPress={() => navigate(() => router.push('/cuenta'), 'forward')}
            style={({ pressed }) => [styles.bell, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={nube ? `Tu perfil · ${nube}` : 'Tu perfil'}
          >
            {usuario ? <Avatar name={usuario.nombre} foto={usuario.foto} size={38} /> : <PersonIcon color={colors.accent} />}
            <NubeEstado />
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
          <Text style={[styles.kicker, { color: colors.warm }]}>Versículo del día</Text>
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

      {semana && <SemanaCard semana={semana} colors={colors} />}

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

      <Appear delay={112}>
        <InvitacionCuenta chapters={chaptersRead} />
      </Appear>

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
                    { borderColor: d.isToday ? colors.warm : colors.border },
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

      <Appear delay={130}>
        <SellosCard colors={colors} />
      </Appear>

      <Appear delay={140}>
        <PalabraSemana colors={colors} />
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
          icon={PromiseIcon}
          label="Promesas"
          colors={colors}
          onPress={() => navigate(() => router.push('/promesas' as never), 'forward')}
        />
        <Tile
          icon={PeopleIcon}
          label="Comunidad"
          colors={colors}
          onPress={() => navigate(() => router.push('/comunidades' as never), 'forward')}
        />
        <Tile
          icon={LecternIcon}
          label="Del sermón"
          colors={colors}
          onPress={() => navigate(() => router.push((semana ? `/semana/${semana.id}` : '/semana') as never), 'forward')}
        />
        <Tile icon={RouteIcon} label="Recorridos" colors={colors} onPress={() => navigate(() => router.push('/recorridos' as never), 'forward')} />
        <Tile icon={DownloadIcon} label="Sin conexión" colors={colors} onPress={() => navigate(() => router.push('/descargas' as never), 'forward')} />
        <Tile icon={WordJourneyIcon} label="Palabras" colors={colors} onPress={() => navigate(() => router.push(palabrasHref() as never), 'forward')} />
        <Tile icon={(p) => <StarIcon {...p} />} label="Niños y jóvenes" colors={colors} onPress={() => navigate(() => router.push('/modo' as never), 'forward')} />
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

/** La semana del sermón en curso: el día que toca y el camino de los cinco días. */
function SemanaCard({ semana, colors }: { semana: NonNullable<ReturnType<typeof semanaActiva>>; colors: C }) {
  const sig = siguiente(semana)!;
  const hoy = diaDeHoy(semana);
  return (
    <Appear delay={90}>
      <Pressable
        onPress={() => navigate(() => router.push(`/semana/${semana.id}/${sig + 1}` as never), 'forward')}
        style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={[styles.kicker, { color: colors.warm }]}>Del sermón · {semana.referencia}</Text>
        <Text style={[styles.continueTitle, { color: colors.text, fontFamily: serif, fontSize: 22 }]} numberOfLines={2}>
          Día {sig + 1} · {semana.dias[sig].titulo}
        </Text>
        {!!semana.dias[sig].domingo && (
          <Text style={{ color: colors.muted, fontFamily: serif, fontStyle: 'italic', fontSize: 15, lineHeight: 22, marginTop: 6 }} numberOfLines={2}>
            «{semana.dias[sig].domingo}»
          </Text>
        )}
        <View style={{ marginTop: 16 }}>
          <Ruta semana={semana} colors={colors} size={26} />
        </View>
        <Text style={{ color: colors.accent, fontWeight: '700', marginTop: 14 }}>
          {sig === hoy ? 'Hacer el día de hoy' : `Seguir con el día ${sig + 1}`} · 10 min ›
        </Text>
      </Pressable>
    </Appear>
  );
}

/** Mis sellos: los últimos ganados y el que está más cerca, sin presionar. */
function SellosCard({ colors }: { colors: C }) {
  const estado = useSellos();
  const lista = sellosPara();
  const ganados = ganadosRecientes(estado, lista);
  const proximo = siguienteSello(estado, lista);
  const muestra = ganados.length ? ganados.slice(0, 3) : lista.filter((s) => s.id === 'palabras-10');
  return (
    <Pressable
      onPress={() => navigate(() => router.push('/sellos' as never), 'forward')}
      style={({ pressed }) => [styles.card, styles.sellos, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
      accessibilityRole="button"
      testID="tarjeta-sellos"
    >
      <View style={styles.sellosPila} aria-hidden>
        {muestra.map((s, i) => (
          <View key={s.id} style={{ marginLeft: i ? -30 : 0, zIndex: 3 - i, transform: [{ rotate: `${i * 9 - 4}deg` }] }}>
            <Sello dibujo={s.dibujo} colors={colors} ganado={!!ganados.length} parte={ganados.length ? 1 : (proximo?.parte ?? 0)} size={i ? 50 : 60} />
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.kicker, { color: ganados.length ? colors.warm : colors.accent }]}>Mis sellos</Text>
        <Text style={{ color: colors.text, fontSize: 17, fontFamily: serif, marginTop: 4 }}>
          {ganados.length ? `${ganados.length} de ${lista.length} · el último: ${ganados[0].titulo}` : 'Explora una palabra, un lugar o una promesa'}
        </Text>
        {proximo ? (
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
            Más cerca: {proximo.sello.titulo} ({proximo.n} de {proximo.meta})
          </Text>
        ) : (
          !ganados.length && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>Cada sello celebra lo que vives con la Palabra.</Text>
        )}
      </View>
    </Pressable>
  );
}

/** La palabra de la semana de «La historia de una palabra»: la misma para todos de lunes a domingo. */
function PalabraSemana({ colors }: { colors: C }) {
  const p = palabraDeLaSemana();
  return (
    <Pressable
      onPress={() => navigate(() => router.push(palabraHref(p.id) as never), 'forward')}
      style={({ pressed }) => [styles.card, styles.palabra, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
      accessibilityRole="link"
      accessibilityLabel={`Palabra de la semana: ${p.nombre}. ${p.resumen}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.kicker, { color: colors.accent }]}>Palabra de la semana</Text>
        <Text style={[styles.palabraNombre, { color: colors.text, fontFamily: serif }]}>{p.nombre}</Text>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{p.resumen}</Text>
        <Text style={{ color: colors.accent, fontWeight: '700', marginTop: 10 }}>Seguir su historia ›</Text>
      </View>
      <Text style={[styles.palabraOriginal, { color: colors.greek, fontFamily: serif }]} numberOfLines={1}>
        {p.original}
      </Text>
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
  palabra: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellos: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sellosPila: { flexDirection: 'row', alignItems: 'center', minWidth: 64 },
  palabraNombre: { fontSize: 24, fontStyle: 'italic', marginTop: 4 },
  palabraOriginal: { fontSize: 44, lineHeight: 58, maxWidth: '45%' },
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
