import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { Button, ErrorText, text, useAction } from '@/components/comunidad/ui';
import TarjetaIglesia from '@/components/iglesia/TarjetaIglesia';
import { useAccount } from '@/lib/comunidad';
import { IglesiaPublica, unirmeIglesia, verIglesia } from '@/lib/iglesias';
import { useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Lo que abre el QR o el enlace de una iglesia anfitriona: la iglesia y el botón para unirse. */
export default function IglesiaInvitacion() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [data, setData] = useState<{ iglesia: IglesiaPublica; soyMiembro: boolean; otra: string | null } | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (!ready) return;
    verIglesia(codigo)
      .then(setData)
      .catch((e) => setNotFound(e.message));
  }, [codigo, ready, usuario?.id]);

  const join = () =>
    run(async () => {
      await unirmeIglesia(codigo);
      navigate(() => router.replace('/iglesia'), 'forward');
    });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Iglesia anfitriona' }} />
      {notFound ? (
        <Appear>
          <Text style={[text.body, { color: colors.text, textAlign: 'center' }]}>{notFound}</Text>
          <Text style={[text.body, { color: colors.muted, marginTop: 8, textAlign: 'center' }]}>
            Pide a tu iglesia el código o el QR vigente.
          </Text>
          <Button label="Escribir otro código" kind="outline" onPress={() => router.replace('/iglesia')} style={{ marginTop: 20 }} />
        </Appear>
      ) : !data ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <Appear>
          <TarjetaIglesia iglesia={data.iglesia} colors={colors} kicker="IGLESIA ANFITRIONA DE ZARZA">
            <Text style={[text.body, { color: colors.muted, textAlign: 'center', marginTop: 10, maxWidth: 440 }]}>
              Esta iglesia ayuda a sostener Zarza para que siga gratis y sin anuncios. Si eres parte de ella, únete: tendrás{' '}
              {data.iglesia.lampara} preguntas a la IA cada día.
            </Text>
          </TarjetaIglesia>
          <View style={{ marginTop: 20 }}>
            {data.soyMiembro ? (
              <>
                <Text style={[text.body, { color: colors.text, textAlign: 'center' }]}>Ya eres parte de esta iglesia en Zarza.</Text>
                <Button label="Ver mi iglesia" kind="outline" onPress={() => router.replace('/iglesia')} style={{ marginTop: 14 }} />
              </>
            ) : usuario ? (
              <>
                {data.otra && (
                  <Text style={[text.small, { color: colors.muted, textAlign: 'center', marginBottom: 12 }]}>
                    Ahora entras con {data.otra}. Al unirte aquí, dejas esa iglesia.
                  </Text>
                )}
                <Button label={`Unirme como ${usuario.nombre}`} onPress={join} busy={busy} />
                <ErrorText>{error}</ErrorText>
              </>
            ) : (
              <Welcome intro="Para unirte, entra con tu cuenta o crea una gratis. Tu iglesia solo sabe cuántas personas entraron con su código." />
            )}
          </View>
        </Appear>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
});
