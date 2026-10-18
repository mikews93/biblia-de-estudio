import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import Welcome from '@/components/comunidad/Welcome';
import { Avatar, Button, ErrorText, text, useAction } from '@/components/comunidad/ui';
import { useAccount } from '@/lib/comunidad';
import { PersonaBreve, askFriend, personByCode } from '@/lib/social';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Enlace de amistad: /amigo/CODIGO. Quien lo abre puede agregar a esa persona. */
export default function FriendInvite() {
  const colors = useColors();
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const { ready, usuario } = useAccount();
  const [person, setPerson] = useState<PersonaBreve | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  useEffect(() => {
    personByCode(codigo)
      .then(setPerson)
      .catch((e) => setNotFound(e.message));
  }, [codigo]);

  const add = () =>
    run(async () => {
      const r = await askFriend({ codigo });
      navigate(() => router.replace(`/comunidades/persona/${r.id}`), 'forward');
    });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Amistad' }} />
      {notFound ? (
        <>
          <ErrorText>{notFound}</ErrorText>
          <Button label="Ir a Comunidad" kind="outline" onPress={() => router.replace('/comunidades')} style={{ marginTop: 20 }} />
        </>
      ) : !person || !ready ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <View style={{ gap: 16, alignItems: 'center' }}>
          <Avatar name={person.nombre} size={72} filled />
          <Text style={[styles.title, { color: colors.text }]}>{person.nombre} quiere leer la Biblia contigo</Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center' }]}>
            Como amigos verán lo que cada uno lee, los versículos que resaltan y las preguntas que comparten.
          </Text>
          {usuario?.id === person.id ? (
            <Text style={[text.body, { color: colors.text }]}>Este es tu propio enlace. Compártelo con tus amigos.</Text>
          ) : usuario ? (
            <Button label={`Agregar a ${person.nombre}`} onPress={add} busy={busy} style={{ alignSelf: 'stretch' }} />
          ) : (
            <Welcome intro="Para agregar amigos, entra con tu cuenta o crea una gratis." />
          )}
          <ErrorText>{error}</ErrorText>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontFamily: serif, fontSize: 22, fontWeight: '700', textAlign: 'center' },
});
