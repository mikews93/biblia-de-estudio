import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Guides from '@/components/comunidad/Guides';
import Invite from '@/components/comunidad/Invite';
import Meeting from '@/components/comunidad/Meeting';
import Notes from '@/components/comunidad/Notes';
import Prayer from '@/components/comunidad/Prayer';
import Welcome from '@/components/comunidad/Welcome';
import { confirm } from '@/components/comunidad/confirm';
import EnVivoGrupo from '@/components/vivo/EnVivoGrupo';
import { Avatar, Button, Card, Meter, SectionTitle, text } from '@/components/comunidad/ui';
import { Grupo, Miembro, api, chapterHref, refreshGroups, tipoLabel, useAccount } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import { planById } from '@/lib/planesCatalogo';
import { seasonTint } from '@/lib/retos';
import { parseRetoId } from '@/lib/temporadas';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Tab = 'notas' | 'oracion' | 'reunion';

const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'long' });

export default function GroupScreen() {
  const { id, nuevo } = useLocalSearchParams<{ id: string; nuevo?: string }>();
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [group, setGroup] = useState<Grupo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [tab, setTab] = useState<Tab>('notas');

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!usuario) return;
    api<{ grupo: Grupo }>('grupo', { grupo: id })
      .then((r) => setGroup(r.grupo))
      .catch((e) => setError(e.message));
  }, [id, usuario]);

  // Al volver del lector (o de editar el grupo) se actualiza quién leyó.
  useFocusEffect(load);

  const leave = async (m?: Miembro) => {
    const self = !m || m.soyYo;
    const ok = await confirm(
      self ? '¿Salir del grupo?' : `¿Quitar a ${m!.nombre}?`,
      self ? 'Podrás volver a entrar con el enlace de invitación.' : 'Podrá volver a entrar solo si recibe el enlace nuevo.',
      self ? 'Salir' : 'Quitar',
    );
    if (!ok) return;
    await api('salir', { grupo: id, usuario: self ? undefined : m!.id }).catch((e) => setError(e.message));
    if (self) {
      await refreshGroups().catch(() => {});
      navigate(() => router.replace('/grupos'), 'back');
    } else load();
  };

  const newCode = async () => {
    const ok = await confirm(
      '¿Cambiar el código de invitación?',
      'El enlace anterior dejará de funcionar. Quienes ya están en el grupo siguen dentro.',
      'Cambiar',
    );
    if (!ok) return;
    await api('nuevoCodigo', { grupo: id }).catch((e) => setError(e.message));
    load();
  };

  const makeAdmin = async (m: Miembro) => {
    await api('hacerAdmin', { grupo: id, usuario: m.id }).catch((e) => setError(e.message));
    load();
  };

  if (ready && !usuario) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Stack.Screen options={{ title: 'Grupo' }} />
        <Welcome intro="Entra con tu cuenta para ver este grupo." />
      </ScrollView>
    );
  }
  if (error && !group) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ title: 'Grupo' }} />
        <Text style={[text.body, { color: colors.text }]}>{error}</Text>
        <Button label="Ver mis grupos" kind="outline" onPress={() => router.replace('/grupos')} style={{ marginTop: 16 }} />
      </View>
    );
  }
  if (!group) return <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />;

  const reading = group.lectura;
  const readCount = group.miembros.filter((m) => m.leyoHoy).length;
  const firstChapter = reading?.capitulos[0];
  const weekDone = group.semana.dias >= group.semana.meta && group.semana.meta > 0;
  const retoDef = reading?.reto ? planById(parseRetoId(reading.reto)?.def ?? '') : undefined;
  const reto = retoDef?.season ? { def: retoDef, tint: seasonTint(retoDef.season, colors) } : null;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          title: group.nombre,
          headerRight: () =>
            group.soyAdmin ? (
              <Pressable onPress={() => navigate(() => router.push(`/grupos/nuevo?editar=${group.id}`), 'forward')} hitSlop={8} style={{ marginRight: 16 }}>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Editar</Text>
              </Pressable>
            ) : null,
        }}
      />
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
        {tipoLabel(group.tipo).toUpperCase()}
      </Text>
      <Text style={[text.title, { color: colors.text }]}>{group.nombre}</Text>

      {nuevo && (
        <View style={{ marginTop: 20 }}>
          <Invite name={group.nombre} code={group.codigo} highlight />
        </View>
      )}

      {/* La lectura de hoy y quién ya la leyó */}
      <Card style={{ marginTop: 20, overflow: 'hidden' }}>
        {reto && <View style={[styles.stripe, { backgroundColor: reto.tint.accent }]} />}
        {reto && reading ? (
          <RetoReading reading={reading} reto={reto} start={group.plan.inicio} admin={group.soyAdmin} />
        ) : reading?.estado === 'activo' && firstChapter ? (
          <>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
              LECTURA DE HOY · DÍA {reading.dia} DE {reading.total}
            </Text>
            <Text style={[styles.reading, { color: colors.text }]}>
              {reading.nombre} {reading.capitulos.join('–')}
            </Text>
            <Button
              label={`Leer ${reading.nombre} ${firstChapter}`}
              onPress={() => navigate(() => router.push(chapterHref(reading.libro, firstChapter)), 'forward')}
              style={{ marginTop: 12 }}
            />
          </>
        ) : reading?.estado === 'pronto' && group.plan.inicio ? (
          <Text style={[text.body, { color: colors.text }]}>
            El plan empieza el {longDate(group.plan.inicio)} con {reading.nombre} 1.
          </Text>
        ) : reading?.estado === 'terminado' ? (
          <>
            <Text style={[styles.reading, { color: colors.accent }]}>¡Terminaron {reading.nombre} juntos!</Text>
            <Text style={[text.body, { color: colors.text, marginTop: 6 }]}>
              {group.soyAdmin ? 'Elige el siguiente libro en «Editar».' : 'Quien administra el grupo puede elegir el siguiente libro.'}
            </Text>
          </>
        ) : (
          <Text style={[text.body, { color: colors.text }]}>El grupo no tiene plan: cuenta cualquier capítulo que lean hoy.</Text>
        )}

        <View style={styles.members}>
          {group.miembros.map((m) => (
            <View key={m.id} style={styles.member}>
              <Avatar name={m.nombre} foto={m.foto} filled={m.leyoHoy} />
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                {m.soyYo ? 'Tú' : m.nombre.split(' ')[0]}
              </Text>
            </View>
          ))}
        </View>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {readCount === 0
            ? 'Nadie ha leído todavía hoy.'
            : readCount === group.miembros.length
              ? 'Hoy leyeron todos.'
              : `${readCount} de ${group.miembros.length} ya leyeron hoy.`}
        </Text>
      </Card>

      {/* La lectura en vivo de la reunión: entrar si ya empezó, o empezarla */}
      <EnVivoGrupo
        group={group.id}
        books={books}
        passage={reading?.estado === 'activo' && firstChapter ? { book: reading.libro, chapter: firstChapter } : undefined}
      />

      {/* Meta compartida de la semana: compañía, no competencia */}
      <SectionTitle>Semana en compañía</SectionTitle>
      <Meter value={group.semana.dias} max={group.semana.meta} colors={colors} />
      <Text style={[text.small, { color: colors.text, marginTop: 8 }]}>
        {weekDone
          ? `¡Meta de la semana cumplida entre todos! ${group.semana.dias} días con la Palabra.`
          : `Entre todos llevan ${group.semana.dias} de ${group.semana.meta} días de lectura esta semana (5 por persona).`}
      </Text>

      <View style={[styles.tabs, { borderColor: colors.border }]}>
        {(
          [
            ['notas', 'Notas'],
            ['oracion', 'Oración'],
            ['reunion', 'Reunión'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            style={[styles.tab, tab === key && { borderBottomColor: colors.accent }]}
          >
            <Text style={{ color: tab === key ? colors.text : colors.muted, fontWeight: '700' }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ paddingTop: 16 }}>
        {tab === 'notas' && (
          <Notes
            books={books}
            group={group.id}
            writeTo={[{ id: group.id, nombre: group.nombre }]}
            passage={reading?.estado === 'activo' && firstChapter ? { book: reading.libro, chapter: firstChapter } : undefined}
          />
        )}
        {tab === 'oracion' && <Prayer group={group.id} />}
        {tab === 'reunion' && <Guides group={group.id} admin={group.soyAdmin} />}
        {tab === 'reunion' && (
          <Meeting
            group={group.id}
            books={books}
            suggested={
              reading?.libro
                ? {
                    book: reading.libro,
                    chapters: reading.capitulos.length ? reading.capitulos : [reading.estado === 'terminado' ? reading.total : 1],
                  }
                : undefined
            }
          />
        )}
      </View>

      {!nuevo && (
        <View style={{ marginTop: 36 }}>
          <Invite name={group.nombre} code={group.codigo} />
        </View>
      )}

      <SectionTitle>Personas</SectionTitle>
      {group.miembros.map((m) => (
        <View key={m.id} style={[styles.personRow, { borderColor: colors.border }]}>
          <Avatar name={m.nombre} foto={m.foto} size={32} />
          <Text style={{ color: colors.text, flex: 1 }}>
            {m.nombre}
            {m.soyYo ? ' (tú)' : ''}
            {m.rol === 'admin' ? <Text style={{ color: colors.muted }}> · administra</Text> : null}
          </Text>
          {group.soyAdmin && !m.soyYo && (
            <>
              {m.rol !== 'admin' && (
                <Pressable onPress={() => makeAdmin(m)} hitSlop={8}>
                  <Text style={{ color: colors.accent, fontSize: 13 }}>Hacer admin</Text>
                </Pressable>
              )}
              <Pressable onPress={() => leave(m)} hitSlop={8}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>Quitar</Text>
              </Pressable>
            </>
          )}
        </View>
      ))}
      <View style={styles.footer}>
        {group.soyAdmin && <Button label="Cambiar el código de invitación" kind="quiet" onPress={newCode} />}
        <Button label="Salir del grupo" kind="quiet" onPress={() => leave()} />
      </View>
      {error && <Text style={{ color: '#B3412E' }}>{error}</Text>}
    </ScrollView>
  );
}

/** La lectura de hoy cuando el grupo sigue un reto de temporada: el título del día y la pregunta para conversar. */
function RetoReading({
  reading,
  reto,
  start,
  admin,
}: {
  reading: NonNullable<Grupo['lectura']>;
  reto: { def: NonNullable<ReturnType<typeof planById>>; tint: ReturnType<typeof seasonTint> };
  start: string | null;
  admin: boolean;
}) {
  const colors = useColors();
  const { def, tint } = reto;
  const i = reading.dia - 1;
  const open = (chapter: number) => navigate(() => router.push(chapterHref(reading.libro, chapter)), 'forward');
  const kicker = `Reto de ${tint.name}`.toUpperCase();
  if (reading.estado === 'activo' && reading.capitulos[0]) {
    return (
      <>
        <Text style={[styles.kicker, { color: tint.accent }]}>
          {kicker} · DÍA {reading.dia} DE {reading.total}
        </Text>
        <Text style={[styles.reading, { color: colors.text }]}>{def.days?.[i]}</Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>
          {reading.nombre} {reading.capitulos[0]}
        </Text>
        <Pressable
          onPress={() => open(reading.capitulos[0])}
          style={({ pressed }) => [styles.retoButton, { backgroundColor: tint.accent }, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={{ color: tint.soft, fontWeight: '700', fontSize: 15 }}>
            Leer {reading.nombre} {reading.capitulos[0]}
          </Text>
        </Pressable>
        {def.questions?.[i] && (
          <View style={[styles.talk, { backgroundColor: tint.soft }]}>
            <Text style={{ color: tint.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>PARA CONVERSAR</Text>
            <Text style={{ color: colors.text, fontFamily: serif, fontSize: 17, lineHeight: 25, marginTop: 4 }}>{def.questions[i]}</Text>
          </View>
        )}
      </>
    );
  }
  if (reading.estado === 'pronto') {
    return (
      <>
        <Text style={[styles.kicker, { color: tint.accent }]}>{kicker}</Text>
        <Text style={[styles.reading, { color: colors.text }]}>{def.title}</Text>
        <Text style={[text.body, { color: colors.text, marginTop: 6 }]}>
          Empieza el {start ? longDate(start) : 'pronto'} con {reading.nombre} {reading.siguiente}. Mientras tanto cuenta cualquier capítulo que lean.
        </Text>
      </>
    );
  }
  if (reading.estado === 'descanso') {
    return (
      <>
        <Text style={[styles.kicker, { color: tint.accent }]}>{kicker} · DÍA DE DESCANSO</Text>
        <Text style={[styles.reading, { color: colors.text }]}>Hoy no hay lectura nueva</Text>
        <Text style={[text.body, { color: colors.text, marginTop: 6 }]}>
          Es día para descansar o ponerse al día. Mañana siguen con {reading.nombre} {reading.siguiente}.
        </Text>
      </>
    );
  }
  return (
    <>
      <Text style={[styles.kicker, { color: tint.accent }]}>{kicker}</Text>
      <Text style={[styles.reading, { color: tint.accent }]}>¡Terminaron el reto juntos!</Text>
      <Text style={[text.body, { color: colors.text, marginTop: 6 }]}>
        {admin ? 'Elijan el siguiente plan en «Editar».' : 'Quien administra el grupo puede elegir el siguiente plan.'}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  retoButton: { borderRadius: 24, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  talk: { borderRadius: 14, padding: 14, marginTop: 14 },
  page: { padding: 20, paddingBottom: 80, maxWidth: 640, width: '100%', alignSelf: 'center' },
  reading: { fontFamily: serif, fontSize: 24, fontWeight: '700', marginTop: 4 },
  members: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18, marginBottom: 10 },
  member: { alignItems: 'center', width: 52 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 32 },
  tab: { paddingVertical: 10, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 20 },
});
