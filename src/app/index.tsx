import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Bienvenida from '@/components/Bienvenida';
import PlanIcon from '@/components/PlanIcon';
import Sello from '@/components/Sello';
import CieloHoy, { horaDelDia, type Hora } from '@/components/hoy/CieloHoy';
import {
  BellIcon,
  BooksIcon,
  GridIcon,
  HeartIcon,
  LecternIcon,
  InviteIcon,
  MicIcon,
  PencilIcon,
  OpenBookIcon,
  PersonIcon,
  SearchIcon,
  ShareIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  SparkIcon,
  FlameIcon,
  type IconProps,
  PhoneDownloadIcon,
} from '@/components/icons';
import InvitacionSembrar from '@/components/InvitacionSembrar';
import ParaTiHoy from '@/components/ParaTi';
import PlanCard from '@/components/PlanCard';
import HoyJovenes from '@/components/jovenes/HoyJovenes';
import HoyNinos from '@/components/ninos/HoyNinos';
import { Avatar } from '@/components/comunidad/ui';
import { InvitacionCuenta, NubeEstado, useEstadoNube } from '@/components/Sincronia';
import StudyPanel from '@/components/StudyPanel';
import VerseImage from '@/components/VerseImage';
import { dispositivo, OFRECER_APK } from '@/lib/apk';
import { debeVerBienvenida } from '@/lib/bienvenida';
import { useAccount } from '@/lib/comunidad';
import { Book, Version, getBooks, getChapter, getVersions } from '@/lib/data';
import { cerrarInvitacion, soporte, useAvisos } from '@/lib/avisos';
import { greeting, greetingName, questionOfTheDay, verseOfTheDay } from '@/lib/daily';
import { Ruta } from '@/components/SemanaSermon';
import { palabraDeLaSemana, palabraHref } from '@/lib/palabras';
import { PLANS, dateKey, nextSeason, usePlans, useWords } from '@/lib/planes';
import { WEEKLY_GOAL, useProgress, weekDays } from '@/lib/progress';
import { useRacha } from '@/lib/racha';
import { useServicio } from '@/lib/servicioUso';
import { RachaChip } from '@/components/Racha';
import { seasonTint } from '@/lib/retos';
import { ganadosRecientes, sellosPara, siguienteSello, useSellos } from '@/lib/sellos';
import { diaDeHoy, semanaActiva, siguiente, useSemanas } from '@/lib/semanas';
import { chapterHref, verseHref } from '@/lib/routes';
import { dueCards, useCards } from '@/lib/tarjetas';
import { serif, useColors, useLastRead, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { compilacion, etiqueta } from '@/lib/version';
import { voiceSupported } from '@/lib/voz';

/**
 * Inicio («Hoy»). En el Modo Jóvenes, su propio Hoy con la misión del día (src/components/jovenes/HoyJovenes.tsx);
 * en el Espacio Niños, la historia que sigue y el versículo de la semana (src/components/ninos/HoyNinos.tsx).
 */
export default function Hoy() {
  const { settings } = useSettings();
  const { ready, llave } = useAccount();
  const [bienvenida, setBienvenida] = useState(false);
  // La primera vez que se abre Zarza (sin nada leído ni cuenta) sale la bienvenida de tres pasos.
  useEffect(() => {
    if (ready && settings.modo === 'general') debeVerBienvenida(!!llave).then(setBienvenida);
  }, [ready, llave, settings.modo]);
  if (settings.modo === 'jovenes') return <HoyJovenes />;
  if (settings.modo === 'ninos') return <HoyNinos />;
  return (
    <>
      <Today />
      {bienvenida && <Bienvenida onDone={() => setBienvenida(false)} />}
    </>
  );
}

/** Inicio para todos: seguir leyendo, el versículo del día, la semana y accesos. */
function Today() {
  const version = compilacion();
  const colors = useColors();
  const { usuario } = useAccount();
  const saludo = greetingName(usuario);
  const { settings } = useSettings();
  const progress = useProgress();
  const racha = useRacha();
  const servicio = useServicio();
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
  const libroActual = books.find((b) => b.id === continueTo.book);
  const hora = horaDelDia();
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
            <Text style={[styles.hello, { color: colors.text, fontFamily: serif }]} numberOfLines={2}>
              {greeting()}
              {saludo ? (
                <>
                  ,{' '}
                  <Text style={styles.helloName}>{saludo}</Text>
                </>
              ) : null}
            </Text>
          </View>
          {canNotify && (
            <Pressable
              onPress={() => navigate(() => router.push('/notificaciones' as never), 'forward')}
              style={({ pressed }) => [styles.bell, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Notificaciones"
            >
              <BellIcon color={colors.text} size={20} />
            </Pressable>
          )}
          <Pressable
            onPress={() => navigate(() => router.push('/cuenta'), 'forward')}
            style={({ pressed }) => [styles.bell, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={nube ? `Tu perfil · ${nube}` : 'Tu perfil'}
          >
            {usuario ? <Avatar name={usuario.nombre} foto={usuario.foto} racha={settings.tranquila ? 0 : racha.actual} servicio={settings.tranquila ? 0 : servicio.total} size={38} /> : <PersonIcon color={colors.text} />}
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
            <SearchIcon color={colors.muted} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.searchTitle, { color: colors.text }]} numberOfLines={1}>
                Buscar en la Biblia
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
                Una cita, unas palabras o una idea
              </Text>
            </View>
          </Pressable>
          {voiceSupported() && (
            <Pressable
              onPress={() => navigate(() => router.push('/buscar?voz=1' as never), 'forward')}
              style={({ pressed }) => [styles.searchMic, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Dictar la búsqueda"
            >
              <MicIcon color={colors.text} size={20} />
            </Pressable>
          )}
        </View>
      </Appear>

      {/* El versículo del día es la portada de Hoy: la luz de la hora detrás y el devocional como acción principal. */}
      <Appear delay={60}>
        <View style={[styles.hero, { borderColor: colors.border, backgroundColor: colors.surface }]} testID="hoy-versiculo">
          <CieloHoy colors={colors} hora={hora} />
          <View style={styles.heroHead}>
            <Text style={[styles.kicker, { color: colors.warm }]}>Versículo del día</Text>
            <Text style={[styles.heroHora, { color: colors.muted }]}>{HORA_TEXTO[hora]}</Text>
          </View>
          <Text style={[styles.verse, { color: colors.text, fontFamily: serif }]}>{verseText ? `«${verseText}»` : ' '}</Text>
          <View style={styles.refRow}>
            <View style={[styles.refLine, { backgroundColor: colors.warm }]} />
            <Text style={[styles.ref, { color: colors.text }]}>{dailyRef}</Text>
          </View>
          {books.length > 0 && (
            <Pressable
              onPress={() => setDevotional(true)}
              style={({ pressed }) => [
                styles.devotional,
                racha.hoyHecho ? { backgroundColor: colors.accentSoft } : { backgroundColor: colors.warm },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <View style={styles.devotionalLabel}>
                <HeartIcon color={racha.hoyHecho ? colors.text : colors.background} size={18} strokeWidth={2} />
                <Text style={{ color: racha.hoyHecho ? colors.text : colors.background, fontWeight: '700', fontSize: 15 }}>
                  {racha.hoyHecho ? 'Devocional de hoy hecho' : 'Haz el devocional de hoy'}
                </Text>
              </View>
              {racha.actual > 0 ? (
                <RachaChip dias={racha.actual} hecha={racha.hoyHecho} colors={colors} claro={!racha.hoyHecho} />
              ) : (
                <Text style={{ color: colors.background, fontSize: 13, fontWeight: '600', opacity: 0.8 }}>10 min</Text>
              )}
            </Pressable>
          )}
          <View style={styles.row}>
            <SmallButton
              label="Leer el capítulo"
              icon={OpenBookIcon}
              colors={colors}
              onPress={() => navigate(() => router.push(verseHref(daily.book, daily.chapter, daily.verse)), 'forward')}
            />
            {verseText && <SmallButton label="Compartir" icon={ShareIcon} colors={colors} onPress={() => setSharing(true)} />}
          </View>
          <View style={[styles.question, { borderColor: colors.border }]}>
            <Text style={[styles.kicker, { color: colors.muted, fontSize: 11 }]}>Para pensar hoy</Text>
            <Text style={{ color: colors.text, fontSize: 17, lineHeight: 25, marginTop: 6, fontFamily: serif, fontStyle: 'italic' }}>
              {questionOfTheDay()}
            </Text>
          </View>
        </View>
      </Appear>

      {/* Seguir leyendo: una fila tranquila con el avance del libro, para que no compita con el versículo. */}
      <Appear delay={80}>
        <Pressable
          onPress={() => navigate(() => router.push(chapterHref(continueTo.book, continueTo.chapter)), 'forward')}
          style={({ pressed }) => [styles.card, styles.continue, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${last ? 'Seguir leyendo' : 'Empieza aquí'}: ${name(continueTo.book)} ${continueTo.chapter}`}
        >
          <View style={[styles.continueIcon, { backgroundColor: colors.accentSoft }]}>
            <OpenBookIcon color={colors.text} size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: colors.muted, fontSize: 11 }]}>{last ? 'Seguir leyendo' : 'Empieza aquí'}</Text>
            <Text style={[styles.continueTitle, { color: colors.text, fontFamily: serif }]} numberOfLines={1}>
              {name(continueTo.book)} {continueTo.chapter}
            </Text>
            {libroActual && (
              <View style={styles.bookProgress}>
                <View style={[styles.bar, { backgroundColor: colors.accentSoft }]}>
                  <View style={[styles.barFill, { backgroundColor: colors.text, width: `${Math.max(4, Math.round((continueTo.chapter / libroActual.chapters) * 100))}%` }]} />
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Cap. {continueTo.chapter} de {libroActual.chapters}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.continueGo, { backgroundColor: colors.text }]}>
            <ArrowRightIcon color={colors.background} size={20} />
          </View>
        </Pressable>
      </Appear>

      {/* Sin envoltorio: si «Para ti» no tiene nada hoy, no deja un hueco. */}
      {books.length > 0 && <ParaTiHoy books={books} comun={daily} colors={colors} />}

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
            <Text style={[styles.kicker, { color: colors.warm }]}>Repaso de hoy</Text>
            <Text style={{ color: colors.text, fontSize: 17, marginTop: 6 }}>
              {due} {due === 1 ? 'tarjeta te espera' : 'tarjetas te esperan'} para no olvidar lo que estudiaste.
            </Text>
            <Text style={{ color: colors.text, fontWeight: '700', marginTop: 10 }}>Repasar ›</Text>
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

      {/* Las invitaciones van sin envoltorio animado: cuando no toca ninguna, no dejan espacio vacío entre tarjetas. */}
      <InvitacionCuenta chapters={chaptersRead} />
      <InvitacionSembrar chaptersRead={chaptersRead} colors={colors} />

      {canNotify && avisos.ready && !avisos.endpoint && !avisos.invitacionVista && (
        <Appear delay={115}>
          <View style={[styles.card, styles.invite, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="invitacion-avisos">
            <View style={[styles.inviteIcon, { backgroundColor: colors.accentSoft }]}>
              <BellIcon color={colors.text} size={22} />
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

      {/* Tu camino: la semana y los sellos en una sola tarjeta. */}
      <Appear delay={120}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: 6 }]}>
          <View style={styles.cardHead}>
            <Text style={[styles.kicker, { color: colors.muted }]}>Tu semana</Text>
            {daysThisWeek >= WEEKLY_GOAL && <Text style={{ color: colors.warm, fontSize: 12, fontWeight: '700' }}>Meta cumplida</Text>}
          </View>
          <View style={styles.week}>
            {week.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.day,
                  { borderColor: d.isToday ? colors.warm : colors.border },
                  d.read && { backgroundColor: colors.text, borderColor: d.isToday ? colors.warm : colors.text },
                ]}
                accessibilityLabel={`${d.label}${d.read ? ', leído' : ''}${d.isToday ? ', hoy' : ''}`}
              >
                <Text style={{ color: d.read ? colors.background : d.isToday ? colors.warm : colors.muted, fontSize: 12, fontWeight: '700' }}>{d.label}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.bar, { backgroundColor: colors.accentSoft, marginTop: 14 }]}>
            <View style={[styles.barFill, { backgroundColor: colors.warm, width: `${Math.min(100, Math.round((daysThisWeek / WEEKLY_GOAL) * 100))}%` }]} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
            {daysThisWeek >= WEEKLY_GOAL
              ? `¡Meta cumplida! ${daysThisWeek} días con la Palabra esta semana.`
              : `${daysThisWeek} de ${WEEKLY_GOAL} días esta semana · ${chaptersRead} capítulos leídos en total`}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SellosFila colors={colors} />
        </View>
      </Appear>

      <Appear delay={140}>
        <PalabraSemana colors={colors} />
      </Appear>

      {/* Accesos: solo lo que no está en la barra de abajo; lo demás vive en «Todo en Zarza». */}
      <Appear delay={160}>
        <Text style={[styles.kicker, styles.sectionTitle, { color: colors.muted }]}>Accesos</Text>
        <View style={styles.grid}>
          <Tile icon={BooksIcon} label="Libros" colors={colors} onPress={() => navigate(() => router.push('/libros'))} />
          <Tile icon={PencilIcon} label="Mis notas" colors={colors} onPress={() => navigate(() => router.push('/notas'), 'forward')} />
          <Tile icon={HeartIcon} label="Mi diario" colors={colors} onPress={() => navigate(() => router.push('/diario' as never), 'forward')} />
          <Tile
            icon={SparkIcon}
            label="Estudiar con IA"
            colors={colors}
            onPress={() => navigate(() => router.push(chapterHref(continueTo.book, continueTo.chapter)), 'forward')}
          />
          <Tile icon={SearchIcon} label="Preguntar" colors={colors} onPress={() => navigate(() => router.push('/preguntar' as never), 'forward')} />
          <Tile
            icon={LecternIcon}
            label="Del sermón"
            colors={colors}
            onPress={() => navigate(() => router.push((semana ? `/semana/${semana.id}` : '/semana') as never), 'forward')}
          />
          <Tile icon={InviteIcon} label="Invitar" a11y="Invitar amigos" colors={colors} onPress={() => navigate(() => router.push('/invitar' as never), 'forward')} />
          <Tile icon={GridIcon} label="Todo en Zarza" colors={colors} onPress={() => navigate(() => router.push('/todo' as never), 'forward')} destacado />
        </View>
      </Appear>

      {OFRECER_APK && dispositivo() !== 'iphone' && (
        <Pressable
          onPress={() => navigate(() => router.push('/instalar' as never), 'forward')}
          accessibilityRole="link"
          testID="hoy-instalar"
          style={({ pressed }) => [styles.instalar, { borderColor: colors.border }, pressed && { opacity: 0.6 }]}
        >
          <PhoneDownloadIcon color={colors.accent} size={16} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Descarga la app de Android</Text>
        </Pressable>
      )}
      <Pressable
        onPress={() => navigate(() => router.push('/acerca' as never), 'forward')}
        accessibilityRole="link"
        accessibilityLabel={`Acerca de Zarza. Versión ${etiqueta(version)}`}
        hitSlop={8}
        style={({ pressed }) => [styles.version, pressed && { opacity: 0.6 }]}
      >
        <FlameIcon color={colors.muted} size={14} />
        <Text style={{ color: colors.muted, fontSize: 13 }}>Zarza {etiqueta(version)}</Text>
      </Pressable>
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

const HORA_TEXTO: Record<Hora, string> = { manana: 'Para empezar el día', tarde: 'Para la tarde', noche: 'Para cerrar el día' };

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function SmallButton({ label, icon: Icon, colors, onPress }: { label: string; icon?: (p: IconProps) => React.ReactNode; colors: C; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.small, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      {Icon && <Icon color={colors.text} size={16} />}
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
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

/** Mis sellos dentro de «Tu semana»: los últimos ganados y el que está más cerca, sin presionar. */
function SellosFila({ colors }: { colors: C }) {
  const estado = useSellos();
  const lista = sellosPara();
  const ganados = ganadosRecientes(estado, lista);
  const proximo = siguienteSello(estado, lista);
  const muestra = ganados.length ? ganados.slice(0, 3) : lista.filter((s) => s.id === 'palabras-10');
  return (
    <Pressable
      onPress={() => navigate(() => router.push('/sellos' as never), 'forward')}
      style={({ pressed }) => [styles.sellos, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      testID="tarjeta-sellos"
    >
      <View style={styles.sellosPila} aria-hidden>
        {muestra.map((s, i) => (
          <View key={s.id} style={{ marginLeft: i ? -22 : 0, zIndex: 3 - i }}>
            <Sello dibujo={s.dibujo} colors={colors} ganado={!!ganados.length} parte={ganados.length ? 1 : (proximo?.parte ?? 0)} size={i ? 40 : 46} />
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
          {ganados.length ? `Mis sellos · ${ganados.length} de ${lista.length}` : 'Mis sellos'}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
          {proximo
            ? `Más cerca: ${proximo.sello.titulo} (${proximo.n} de ${proximo.meta})`
            : ganados.length
              ? `El último: ${ganados[0].titulo}`
              : 'Cada sello celebra lo que vives con la Palabra.'}
        </Text>
      </View>
      <ChevronRightIcon color={colors.muted} size={18} />
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
      {/* La palabra original, grande y de fondo, en el tono del texto (sin colores fuera de la paleta). */}
      <Text style={[styles.palabraOriginal, { color: colors.text, fontFamily: serif }]} numberOfLines={1} aria-hidden>
        {p.original}
      </Text>
      <Text style={[styles.kicker, { color: colors.muted }]}>Palabra de la semana</Text>
      <Text style={[styles.palabraNombre, { color: colors.text, fontFamily: serif }]}>{p.nombre}</Text>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2, maxWidth: '70%' }}>{p.resumen}</Text>
      <View style={styles.palabraLink}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Seguir su historia</Text>
        <ArrowRightIcon color={colors.warm} size={16} />
      </View>
    </Pressable>
  );
}

function Tile({
  icon: Icon,
  label,
  a11y,
  colors,
  onPress,
  destacado,
}: {
  icon: (p: IconProps) => React.ReactNode;
  label: string;
  a11y?: string;
  colors: C;
  onPress: () => void;
  destacado?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={a11y ?? label}>
      <View
        style={[
          styles.tileIcon,
          destacado ? { backgroundColor: colors.text } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
        ]}
      >
        <Icon color={destacado ? colors.background : colors.text} size={24} />
      </View>
      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 12, marginTop: 8, textAlign: 'center' }} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 44, paddingBottom: 64, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bell: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  invite: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  inviteIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  date: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  hello: { fontSize: 28, lineHeight: 35, marginTop: 2 },
  helloName: { fontStyle: 'italic' },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 30, paddingRight: 8, minHeight: 60 },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  searchTitle: { fontSize: 16, fontWeight: '600' },
  searchMic: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sectionTitle: { marginBottom: 12, marginLeft: 4 },
  hero: { borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, padding: 24, paddingTop: 22, overflow: 'hidden' },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroHora: { fontSize: 12, fontStyle: 'italic' },
  verse: { fontSize: 24, lineHeight: 35, marginTop: 18, letterSpacing: -0.2 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  refLine: { width: 22, height: 2, borderRadius: 1 },
  ref: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  continue: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  continueIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  continueTitle: { fontSize: 22, marginTop: 2 },
  continueGo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bookProgress: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  bar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 16 },
  reto: { overflow: 'hidden' },
  palabra: { overflow: 'hidden', paddingVertical: 22 },
  sellos: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sellosPila: { flexDirection: 'row', alignItems: 'center', minWidth: 58 },
  palabraNombre: { fontSize: 30, fontStyle: 'italic', marginTop: 6 },
  palabraOriginal: { position: 'absolute', right: 18, top: '50%', marginTop: -46, fontSize: 76, lineHeight: 92, opacity: 0.16 },
  palabraLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  retoGlyph: { position: 'absolute', right: -14, top: -18, opacity: 0.12 },
  retoButton: { alignSelf: 'flex-start', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9, marginTop: 14 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  small: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  question: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 20, paddingTop: 16 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  day: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  devotional: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    marginTop: 22,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 },
  devotionalLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tile: { width: '25%', alignItems: 'center', paddingHorizontal: 4 },
  tileIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  instalar: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginTop: 16, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  version: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', marginTop: 8, paddingVertical: 6, paddingHorizontal: 12 },
});
