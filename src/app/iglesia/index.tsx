import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { confirm } from '@/components/comunidad/confirm';
import { Button, ErrorText, Field, text, useAction } from '@/components/comunidad/ui';
import { ChurchIcon, ShareIcon } from '@/components/icons';
import TarjetaIglesia from '@/components/iglesia/TarjetaIglesia';
import { shareMessage } from '@/lib/compartir';
import { useAccount } from '@/lib/comunidad';
import { IglesiaPublica, enlaceIglesia, miIglesia, salirIglesia } from '@/lib/iglesias';
import { HAY_SOSTENER } from '@/lib/sostener';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Tu iglesia anfitriona: su QR para invitar a otros, o el campo para entrar con el código de la tuya. */
export default function MiIglesia() {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [mia, setIglesia] = useState<IglesiaPublica | null | undefined>(undefined);
  const [codigo, setCodigo] = useState('');
  const leave = useAction();
  // Sin cuenta no hay iglesia; con cuenta, la que diga el servidor (undefined mientras llega).
  const iglesia = ready && !usuario ? null : mia;
  const userId = usuario?.id;

  useEffect(() => {
    if (!userId) return;
    miIglesia()
      .then((r) => setIglesia(r.iglesia))
      .catch(() => setIglesia(null));
  }, [userId]);

  const entrar = () => {
    const limpio = codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (limpio) navigate(() => router.push(`/iglesia/${limpio}` as never), 'forward');
  };
  const compartir = (i: IglesiaPublica) => {
    const url = enlaceIglesia(i.codigo);
    const message = `Entra a Zarza con el código de ${i.nombre}: ${i.codigo}\n${url}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
      navigator.clipboard?.writeText(message);
      return;
    }
    shareMessage(message);
  };
  const salir = async () => {
    if (!(await confirm('Salir de tu iglesia', 'Vuelves a la lámpara de siempre. Puedes entrar de nuevo con el código cuando quieras.', 'Salir'))) return;
    leave.run(async () => {
      await salirIglesia();
      setIglesia(null);
    });
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Iglesia anfitriona' }} />
      {iglesia === undefined ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : iglesia ? (
        <Appear>
          <TarjetaIglesia iglesia={iglesia} colors={colors} kicker="TU IGLESIA ANFITRIONA" qr />
          <Button label="Compartir el enlace" kind="outline" icon={ShareIcon} onPress={() => compartir(iglesia)} style={{ marginTop: 16 }} />
          <View style={{ marginTop: 8 }}>
            <Button label="Salir de esta iglesia" kind="quiet" onPress={salir} busy={leave.busy} />
            <ErrorText>{leave.error}</ErrorText>
          </View>
        </Appear>
      ) : (
        <>
          <Appear>
            <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
              <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
                <ChurchIcon color={colors.accent} size={30} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>¿Tu iglesia es anfitriona?</Text>
              <Text style={[text.body, { color: colors.muted, textAlign: 'center', maxWidth: 440 }]}>
                Las iglesias que sostienen Zarza dan a sus miembros más preguntas a la IA cada día. Escribe el código que te dieron o
                escanea su QR con la cámara.
              </Text>
            </View>
          </Appear>
          <Appear delay={60}>
            {usuario ? (
              <View style={styles.form}>
                <Field
                  label="Código de tu iglesia"
                  value={codigo}
                  onChangeText={setCodigo}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="Por ejemplo, K7M2QX"
                  onSubmitEditing={entrar}
                  returnKeyType="go"
                  style={{ letterSpacing: 3, fontWeight: '700', fontSize: 18 }}
                />
                <Button label="Entrar con el código" onPress={entrar} disabled={!codigo.trim()} />
              </View>
            ) : (
              <View style={{ marginTop: 20 }}>
                <Welcome intro="Para entrar con el código de tu iglesia necesitas una cuenta gratuita." />
              </View>
            )}
          </Appear>
          {HAY_SOSTENER && (
            <Appear delay={100}>
              <Pressable onPress={() => navigate(() => router.push('/sostener'), 'forward')} accessibilityRole="link" style={styles.more}>
                <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}>
                  ¿Quieres que tu iglesia sea anfitriona? <Text style={{ color: colors.accent, fontWeight: '700' }}>Cómo funciona</Text>
                </Text>
              </Pressable>
            </Appear>
          )}
        </>
      )}
    </ScrollView>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' };

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 10, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  emblem: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 26, fontWeight: '700', textAlign: 'center' },
  form: { gap: 12, marginTop: 20 },
  more: { marginTop: 24, paddingVertical: 8 },
});
