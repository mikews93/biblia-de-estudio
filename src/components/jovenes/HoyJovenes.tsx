import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Avatar } from '@/components/comunidad/ui';
import { BooksIcon, CheckIcon, ClockIcon, HeartIcon, OpenBookIcon, PeopleIcon, PersonIcon, SearchIcon, StarIcon, type IconProps } from '@/components/icons';
import { IconoRuta, Medalla, tinte } from '@/components/jovenes/arte';
import { useAccount } from '@/lib/comunidad';
import { Book, getBooks, getChapter } from '@/lib/data';
import { greeting, questionOfTheDay, verseOfTheDay } from '@/lib/daily';
import { estrellas, hechaHoy, marcarReto, misionDeHoy, retoPendiente, sellosJovenes, useJovenes } from '@/lib/jovenes';
import { useSellos } from '@/lib/sellos';
import { WEEKLY_GOAL, useProgress, weekDays } from '@/lib/progress';
import { chapterHref, verseHref } from '@/lib/routes';
import { serif, useColors, useLastRead, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Hoy en el Modo Jóvenes: la misión del día, el reto de la semana, la semana, los sellos y el versículo. */
export default function HoyJovenes() {
  const colors = useColors();
  const { usuario } = useAccount();
  const { settings } = useSettings();
  const s = useJovenes();
  const progress = useProgress();
  const last = useLastRead();
  const [books, setBooks] = useState<Book[]>([]);
  const [verseText, setVerseText] = useState<string | null>(null);
  const daily = verseOfTheDay();

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);
  useEffect(() => {
    getChapter(daily.book, daily.chapter, settings.version)
      .then((verses) => setVerseText(verses.find(([n]) => n === daily.verse)?.[1] ?? null))
      .catch(() => setVerseText(null));
  }, [daily.book, daily.chapter, daily.verse, settings.version]);

  const name = (id: string) => books.find((b) => b.id === id)?.name ?? '';
  const hoy = misionDeHoy(s);
  const yaHoy = hechaHoy(s);
  const reto = retoPendiente(s);
  const week = weekDays(progress.days);
  const dias = week.filter((d) => d.read).length;
  const total = Object.values(s).reduce((n, r) => n + estrellas(r), 0);
  const album = useSellos();
  const lista = sellosJovenes();
  const ganados = lista.filter((x) => album.ganados[x.id]).sort((a, b) => album.ganados[b.id].fecha.localeCompare(album.ganados[a.id].fecha));
  // Los sellos ganados más recientes primero y, si faltan, los próximos por ganar.
  const vitrina = [...ganados.slice(0, 3), ...lista.filter((x) => !album.ganados[x.id])].slice(0, 4);
  const t = hoy ? tinte(hoy.ruta, colors) : { accent: colors.accent, soft: colors.accentSoft };
  const go = (href: string) => navigate(() => router.push(href as never), 'forward');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false, title: 'Hoy' }} />

      <Appear>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.date, { color: colors.muted }]}>
              {capitalize(new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }))}
            </Text>
            <Text style={[styles.hello, { color: colors.text, fontFamily: serif }]}>
              {usuario ? `¡Hola, ${usuario.nombre.split(' ')[0]}!` : greeting()}
            </Text>
          </View>
          <Pressable
            onPress={() => go('/jovenes')}
            style={({ pressed }) => [styles.estrellas, { backgroundColor: colors.warmSoft }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${total} estrellas. Ver misiones`}
          >
            <StarIcon filled color={colors.warm} size={16} />
            <Text style={{ color: colors.warm, fontWeight: '800', fontSize: 15 }}>{total}</Text>
          </Pressable>
          <Pressable
            onPress={() => go('/cuenta')}
            style={({ pressed }) => [styles.round, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Tu perfil"
          >
            {usuario ? <Avatar name={usuario.nombre} foto={usuario.foto} size={38} /> : <PersonIcon color={colors.accent} />}
          </Pressable>
        </View>
      </Appear>

      <Appear delay={20}>
        <Pressable
          onPress={() => go('/buscar')}
          style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="search"
          accessibilityLabel="Buscar una cita o un versículo"
        >
          <SearchIcon color={colors.muted} size={18} />
          <Text style={{ color: colors.muted, fontSize: 15 }}>Buscar una cita o un versículo</Text>
        </Pressable>
      </Appear>

      <Appear delay={40}>
        {hoy ? (
          <Pressable
            onPress={() => go(`/jovenes/${hoy.ruta.id}/${hoy.mision.id}`)}
            style={({ pressed }) => [styles.mision, { backgroundColor: t.accent }, pressed && styles.pressed]}
            accessibilityRole="button"
            testID="mision-de-hoy"
          >
            <View style={styles.misionGlifo} aria-hidden>
              <IconoRuta icono={hoy.ruta.id} color={t.soft} size={170} strokeWidth={1} />
            </View>
            <Text style={[styles.kicker, { color: t.soft, opacity: 0.85 }]}>
              {yaHoy ? 'Cumpliste hoy · ¿otra más?' : `Misión de hoy · ${hoy.ruta.titulo}`}
            </Text>
            <Text style={[styles.misionTitulo, { color: t.soft, fontFamily: serif }]}>{hoy.mision.titulo}</Text>
            <Text style={{ color: t.soft, opacity: 0.85, marginTop: 2 }}>
              {name(hoy.mision.book)} {hoy.mision.chapter}:{hoy.mision.from}-{hoy.mision.to}
            </Text>
            <View style={styles.misionPie}>
              <View style={styles.dato}>
                <ClockIcon color={t.soft} size={16} />
                <Text style={{ color: t.soft, fontSize: 13 }}>5 min</Text>
              </View>
              <View style={styles.dato}>
                <StarIcon color={t.soft} size={16} />
                <Text style={{ color: t.soft, fontSize: 13 }}>3 estrellas</Text>
              </View>
              <View style={[styles.empezar, { backgroundColor: t.soft }]}>
                <Text style={{ color: t.accent, fontWeight: '800' }}>{hoy.indice === 0 && !yaHoy ? 'Empezar' : 'Vamos'} ›</Text>
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.warmSoft, borderColor: colors.warmSoft }]}>
            <Text style={[styles.kicker, { color: colors.warm }]}>¡Todas las rutas!</Text>
            <Text style={{ color: colors.text, fontSize: 17, marginTop: 6, lineHeight: 24 }}>
              Terminaste las treinta misiones. Sigue leyendo un plan o vuelve a una misión para escribir o vivir lo que falta.
            </Text>
          </View>
        )}
      </Appear>

      {reto && (
        <Appear delay={60}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="reto-semana">
            <Text style={[styles.kicker, { color: tinte(reto.ruta, colors).accent }]}>Tu reto de la semana</Text>
            <Text style={{ color: colors.text, fontSize: 17, lineHeight: 25, marginTop: 8, fontFamily: serif }}>{reto.mision.vive}</Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => marcarReto(reto.ruta.id, reto.mision.id, true)}
                style={({ pressed }) => [styles.small, { backgroundColor: tinte(reto.ruta, colors).accent }, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <CheckIcon color={tinte(reto.ruta, colors).soft} size={16} strokeWidth={2.4} />
                <Text style={{ color: tinte(reto.ruta, colors).soft, fontWeight: '800', fontSize: 14 }}>¡Lo viví!</Text>
              </Pressable>
              <Text style={{ color: colors.muted, fontSize: 13, flex: 1 }}>De «{reto.mision.titulo}» · +1 estrella</Text>
            </View>
          </View>
        </Appear>
      )}

      <Appear delay={80}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.accent }]}>Tu semana</Text>
          <View style={styles.week}>
            {week.map((d, i) => (
              <View key={i} style={{ alignItems: 'center' }}>
                <View
                  style={[
                    styles.dot,
                    { borderColor: d.isToday ? colors.warm : colors.border },
                    d.read && { backgroundColor: colors.warm, borderColor: colors.warm },
                  ]}
                >
                  {d.read && <CheckIcon color={colors.surface} size={14} strokeWidth={2.6} />}
                </View>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{d.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.text, fontSize: 14, marginTop: 10, textAlign: 'center' }}>
            {dias >= WEEKLY_GOAL ? `¡Meta cumplida! ${dias} días esta semana.` : `${dias} de ${WEEKLY_GOAL} días esta semana. Saltarte un día no borra nada.`}
          </Text>
        </View>
      </Appear>

      <Appear delay={100}>
        <Pressable
          onPress={() => go('/jovenes')}
          style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="tus-sellos"
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={[styles.kicker, { color: colors.accent, flex: 1 }]}>Tus sellos · {ganados.length} de {lista.length}</Text>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Ver todo ›</Text>
          </View>
          <View style={styles.vitrina}>
            {vitrina.map((x) => (
              <Medalla key={x.id} sello={x} colors={colors} size={54} />
            ))}
          </View>
        </Pressable>
      </Appear>

      <Appear delay={120}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.warm }]}>Versículo del día</Text>
          <Text style={[styles.verse, { color: colors.text, fontFamily: serif }]}>{verseText ? `«${verseText}»` : ' '}</Text>
          <Text style={{ color: colors.muted, marginTop: 8, fontSize: 14, fontWeight: '600' }}>
            {name(daily.book)} {daily.chapter}:{daily.verse}
          </Text>
          <View style={[styles.question, { borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>PARA PENSAR HOY</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{questionOfTheDay()}</Text>
          </View>
          <Pressable onPress={() => go(verseHref(daily.book, daily.chapter, daily.verse))} style={styles.link} accessibilityRole="link">
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Leer el capítulo ›</Text>
          </Pressable>
        </View>
      </Appear>

      <Appear delay={140} style={styles.grid}>
        <Tile icon={OpenBookIcon} label="Leer la Biblia" onPress={() => go(chapterHref(last?.book ?? 'mrk', last?.chapter ?? 1))} />
        <Tile icon={(p) => <StarIcon {...p} />} label="Misiones" onPress={() => go('/jovenes')} />
        <Tile icon={HeartIcon} label="Mi diario" onPress={() => go('/diario')} />
        <Tile icon={PeopleIcon} label="Mi grupo" onPress={() => go('/comunidades')} />
        <Tile icon={BooksIcon} label="Libros" onPress={() => navigate(() => router.push('/libros'))} />
      </Appear>

      <Pressable onPress={() => go('/modo')} style={styles.modo} accessibilityRole="link" testID="cambiar-modo">
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Estás en el <Text style={{ fontWeight: '700' }}>Modo Jóvenes</Text> · Cambiar
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Tile({ icon: Icon, label, onPress }: { icon: (p: IconProps) => React.ReactNode; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  date: { fontSize: 14 },
  hello: { fontSize: 32, marginTop: 2 },
  estrellas: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, height: 36 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12 },
  kicker: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  mision: { borderRadius: 24, padding: 22, overflow: 'hidden' },
  misionGlifo: { position: 'absolute', right: -24, top: -18, opacity: 0.14 },
  misionTitulo: { fontSize: 32, marginTop: 8, lineHeight: 38 },
  misionPie: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 5, opacity: 0.9 },
  empezar: { marginLeft: 'auto', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  small: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  vitrina: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  verse: { fontSize: 21, lineHeight: 31, marginTop: 10 },
  question: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 14 },
  link: { marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: '28%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 16, alignItems: 'center' },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modo: { alignSelf: 'center', paddingVertical: 10 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
