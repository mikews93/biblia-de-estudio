import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Trenza from '@/components/pareja/Trenza';
import Welcome from '@/components/comunidad/Welcome';
import { Avatar, Button, text } from '@/components/comunidad/ui';
import { useAccount } from '@/lib/comunidad';
import { unirse, verCodigo } from '@/lib/parejaApi';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** El enlace de invitación de una pareja (/pareja/unirse/CODIGO): quién invita y aceptar. */
export default function UnirsePareja() {
  const colors = useColors();
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const { usuario, ready } = useAccount();
  const [quien, setQuien] = useState<{ nombre: string; foto: string | null; esMio: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    verCodigo(codigo)
      .then(setQuien)
      .catch((e: Error) => setError(e.message));
  }, [codigo, usuario]);

  const aceptar = async () => {
    setBusy(true);
    try {
      await unirse(codigo);
      navigate(() => router.replace('/pareja' as never), 'forward');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Invitación' }} />
      {ready && !usuario ? (
        <Welcome intro="Tu pareja te invitó a hacer devocionales juntos. Crea tu cuenta gratuita o entra para aceptar." />
      ) : error ? (
        <View style={{ marginTop: 40 }}>
          <Text style={[text.body, { color: colors.text }]}>{error}</Text>
          <Button label="Ir a En pareja" kind="outline" onPress={() => router.replace('/pareja' as never)} style={{ marginTop: 16 }} />
        </View>
      ) : !quien ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
      ) : (
        <Appear style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.avatars}>
            <Avatar name={quien.nombre} foto={quien.foto} size={60} />
            <View style={[styles.avatarB, { borderColor: colors.surface, backgroundColor: colors.surface }]}>
              <Avatar name={usuario?.nombre ?? 'Tú'} foto={usuario?.foto} size={60} />
            </View>
          </View>
          <Text style={[styles.kicker, { color: colors.warm }]}>DEVOCIONALES EN PAREJA</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {quien.esMio ? 'Esta es tu invitación' : `${quien.nombre.split(' ')[0]} te invita`}
          </Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center', marginTop: 8 }]}>
            {quien.esMio
              ? 'Compártela con tu pareja para que la acepte desde su cuenta.'
              : 'Cinco minutos al día: el mismo pasaje, una pregunta que cada uno responde y oración del uno por el otro. Solo ustedes dos lo verán.'}
          </Text>
          <View style={{ alignSelf: 'stretch', marginVertical: 18 }}>
            <Trenza colors={colors} hechos={[]} decorativa alto={44} />
          </View>
          {!quien.esMio && <Button label="Aceptar la invitación" onPress={aceptar} busy={busy} style={{ alignSelf: 'stretch' }} />}
        </Appear>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 24, paddingBottom: 64, maxWidth: 520, width: '100%', alignSelf: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, padding: 24, alignItems: 'center' },
  avatars: { flexDirection: 'row', marginBottom: 16 },
  avatarB: { marginLeft: -16, borderWidth: 3, borderRadius: 36 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontFamily: serif, fontSize: 28, marginTop: 6, textAlign: 'center' },
});
