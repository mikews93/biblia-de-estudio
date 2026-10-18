import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import Welcome from '@/components/comunidad/Welcome';
import { Button, Card, ErrorText, text, useAction } from '@/components/comunidad/ui';
import { TipoGrupo, api, refreshGroups, tipoLabel, useAccount } from '@/lib/comunidad';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Invitation = { nombre: string; tipo: TipoGrupo; miembros: number };

/** Página del enlace de invitación: muestra el grupo y deja unirse (creando la cuenta si hace falta). */
export default function Join() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  useEffect(() => {
    api<{ grupo: Invitation }>('verInvitacion', { codigo })
      .then((r) => setInvitation(r.grupo))
      .catch((e) => setNotFound(e.message));
  }, [codigo]);

  const join = () =>
    run(async () => {
      const { id } = await api<{ id: string }>('unirse', { codigo });
      await refreshGroups();
      navigate(() => router.replace(`/grupos/${id}`), 'forward');
    });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Invitación' }} />
      {notFound ? (
        <>
          <Text style={[text.body, { color: colors.text }]}>{notFound}</Text>
          <Text style={[text.body, { color: colors.muted, marginTop: 8 }]}>Pide a quien te invitó el enlace nuevo.</Text>
          <Button label="Ir a mis grupos" kind="outline" onPress={() => router.replace('/grupos')} style={{ marginTop: 20 }} />
        </>
      ) : !invitation || !ready ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <>
          <Card>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
              TE INVITARON A UN GRUPO · {tipoLabel(invitation.tipo).toUpperCase()}
            </Text>
            <Text style={[styles.name, { color: colors.text }]}>{invitation.nombre}</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>
              {invitation.miembros} {invitation.miembros === 1 ? 'persona' : 'personas'} leyendo juntas
            </Text>
          </Card>
          <View style={{ marginTop: 24 }}>
            {usuario ? (
              <>
                <Button label={`Unirme como ${usuario.nombre}`} onPress={join} busy={busy} />
                <ErrorText>{error}</ErrorText>
              </>
            ) : (
              <Welcome intro="Para unirte, dinos cómo te llamas. Solo te verán las personas del grupo." />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  name: { fontFamily: serif, fontSize: 26, fontWeight: '700', marginTop: 6 },
});
