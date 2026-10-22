import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import Post from '@/components/comunidad/Post';
import { confirm } from '@/components/comunidad/confirm';
import { ChurchIcon, PeopleIcon, PinIcon } from '@/components/icons';
import { Avatar, Button, ErrorText, SectionTitle, text, useAction } from '@/components/comunidad/ui';
import { CheckIcon } from '@/components/icons';
import { Persona, Publicacion, answerFriend, askFriend, block, getPerson, removeFriend, unblock } from '@/lib/social';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** El perfil de alguien de la comunidad: su nombre, la amistad y lo que comparte contigo. */
export default function PersonScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [person, setPerson] = useState<Persona | null>(null);
  const [posts, setPosts] = useState<Publicacion[]>([]);
  const { busy, error, run, setError } = useAction();

  const load = useCallback(() => {
    getPerson(id)
      .then((r) => {
        setPerson(r.persona);
        setPosts(r.publicaciones);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  const unfriend = async () => {
    if (!(await confirm(`¿Quitar a ${person?.nombre} de tus amigos?`, 'Dejarán de ver lo que comparten solo con amigos.', 'Quitar'))) return;
    run(() => removeFriend(id).then(load));
  };

  const blockPerson = async () => {
    const ok = await confirm(
      `¿Bloquear a ${person?.nombre}?`,
      'Dejarán de verse: sus publicaciones, comentarios y solicitudes no te llegarán, y tampoco verá las tuyas. Si son amigos, la amistad se quita. No se le avisa.',
      'Bloquear',
    );
    if (ok) run(() => block(id).then(load));
  };

  if (!person) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ title: '' }} />
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}
      </View>
    );
  }

  const action = {
    yo: null,
    amigos: <Button label="Amigos" icon={CheckIcon} kind="outline" onPress={unfriend} busy={busy} />,
    enviada: <Button label="Solicitud enviada" kind="outline" onPress={() => run(() => removeFriend(id).then(load))} busy={busy} />,
    recibida: <Button label="Aceptar amistad" onPress={() => run(() => answerFriend(id, true).then(load))} busy={busy} />,
    none: <Button label="Agregar como amigo" onPress={() => run(() => askFriend({ usuario: id }).then(load))} busy={busy} />,
    bloqueada: <Button label="Desbloquear" kind="outline" onPress={() => run(() => unblock(id).then(load))} busy={busy} />,
  }[person.relacion ?? 'none'];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: person.nombre }} />
      <View style={styles.head}>
        <Avatar name={person.nombre} foto={person.foto} size={96} filled />
        <Text style={[styles.name, { color: colors.text }]}>{person.nombre}</Text>
        {person.bio ? <Text style={[styles.bio, { color: colors.text }]}>{person.bio}</Text> : null}
        <View style={styles.facts}>
          {person.iglesia ? (
            <View style={styles.fact}>
              <ChurchIcon color={colors.muted} size={15} />
              <Text style={{ color: colors.muted }}>{person.iglesia}</Text>
            </View>
          ) : null}
          {person.ciudad ? (
            <View style={styles.fact}>
              <PinIcon color={colors.muted} size={15} />
              <Text style={{ color: colors.muted }}>{person.ciudad}</Text>
            </View>
          ) : null}
          <View style={styles.fact}>
            <PeopleIcon color={colors.muted} size={15} />
            <Text style={{ color: colors.muted }}>
              {person.amigos} {person.amigos === 1 ? 'amigo' : 'amigos'}
            </Text>
          </View>
        </View>
        {action && <View style={{ alignSelf: 'stretch', marginTop: 8 }}>{action}</View>}
        {person.relacion === 'yo' && (
          <Button
            label="Editar mi perfil"
            kind="outline"
            onPress={() => navigate(() => router.push('/cuenta'), 'forward')}
            style={{ alignSelf: 'stretch', marginTop: 8 }}
          />
        )}
        <ErrorText>{error}</ErrorText>
      </View>

      {person.relacion === 'bloqueada' ? (
        <Text style={[text.body, styles.blocked, { color: colors.muted }]}>
          Bloqueaste a esta persona. No ves lo que comparte y ella no ve lo tuyo.
        </Text>
      ) : (
        <PersonPosts person={person} posts={posts} />
      )}
      {person.relacion !== 'yo' && person.relacion !== 'bloqueada' && (
        <Button label="Bloquear a esta persona" kind="quiet" onPress={blockPerson} busy={busy} style={styles.block} />
      )}
    </ScrollView>
  );
}

/** Lo que la persona comparte contigo. */
function PersonPosts({ person, posts }: { person: Persona; posts: Publicacion[] }) {
  const colors = useColors();
  return (
    <>
      <SectionTitle>{person.relacion === 'yo' ? 'Lo que has compartido' : 'Lo que comparte'}</SectionTitle>
      {posts.length === 0 ? (
        <Text style={[text.body, { color: colors.muted }]}>
          {person.relacion === 'amigos' || person.relacion === 'yo'
            ? 'Todavía no hay publicaciones.'
            : 'Cuando sean amigos verás lo que lee y comparte con sus amigos.'}
        </Text>
      ) : (
        <View style={{ gap: 14 }}>
          {posts.map((p) => (
            <Post key={p.id} post={p} />
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  head: { alignItems: 'center', gap: 6 },
  name: { fontFamily: serif, fontSize: 26, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  bio: { fontFamily: serif, fontStyle: 'italic', fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 440 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, rowGap: 6, marginTop: 4 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  blocked: { marginTop: 24, textAlign: 'center' },
  block: { alignSelf: 'center', marginTop: 32 },
});
