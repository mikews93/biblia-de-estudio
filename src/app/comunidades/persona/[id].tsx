import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import Post from '@/components/comunidad/Post';
import { confirm } from '@/components/comunidad/confirm';
import { Avatar, Button, ErrorText, SectionTitle, text, useAction } from '@/components/comunidad/ui';
import { CheckIcon } from '@/components/icons';
import { Persona, Publicacion, answerFriend, askFriend, getPerson, removeFriend } from '@/lib/social';
import { serif, useColors } from '@/lib/theme';

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
  }[person.relacion ?? 'none'];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: person.nombre }} />
      <View style={styles.head}>
        <Avatar name={person.nombre} size={72} filled />
        <Text style={[styles.name, { color: colors.text }]}>{person.nombre}</Text>
        <Text style={{ color: colors.muted }}>
          {person.amigos} {person.amigos === 1 ? 'amigo' : 'amigos'}
        </Text>
        {action && <View style={{ alignSelf: 'stretch', marginTop: 8 }}>{action}</View>}
        <ErrorText>{error}</ErrorText>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  head: { alignItems: 'center', gap: 6 },
  name: { fontFamily: serif, fontSize: 24, fontWeight: '700', marginTop: 6 },
});
