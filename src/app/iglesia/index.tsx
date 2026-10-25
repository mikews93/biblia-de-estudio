import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { confirm } from '@/components/comunidad/confirm';
import { Button, ErrorText, Field, text, useAction } from '@/components/comunidad/ui';
import { ChurchIcon, PeopleIcon, RefreshIcon, ShareIcon } from '@/components/icons';
import TarjetaIglesia from '@/components/iglesia/TarjetaIglesia';
import { shareMessage } from '@/lib/compartir';
import { useAccount } from '@/lib/comunidad';
import { IglesiaEncargada, IglesiaPublica, enlaceIglesia, miEncargo, miIglesia, nuevoCodigoIglesia, salirIglesia } from '@/lib/iglesias';
import { HAY_SOSTENER } from '@/lib/sostener';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/**
 * Tu iglesia anfitriona: su QR para invitar a otros, o el campo para entrar con el código de la tuya. Quien está
 * encargado de la iglesia ve además cuántos entraron y puede cambiar el código si se filtró.
 */
export default function MiIglesia() {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [mia, setIglesia] = useState<IglesiaPublica | null | undefined>(undefined);
  const [encargada, setEncargada] = useState<IglesiaEncargada | null>(null);
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
    miEncargo()
      .then((r) => setEncargada(r.iglesia))
      .catch(() => setEncargada(null));
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
          {encargada && encargada.nombre === iglesia.nombre ? (
            <Encargo
              colors={colors}
              iglesia={encargada}
              onCodigo={(codigo) => {
                setIglesia({ ...iglesia, codigo });
                setEncargada({ ...encargada, codigo });
              }}
            />
          ) : (
            <View style={{ marginTop: 8 }}>
              <Button label="Salir de esta iglesia" kind="quiet" onPress={salir} busy={leave.busy} />
              <ErrorText>{leave.error}</ErrorText>
            </View>
          )}
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
          <Appear delay={90}>
            <Pressable
              onPress={() => navigate(() => router.push('/iglesia/postular' as never), 'forward')}
              accessibilityRole="link"
              style={[styles.postular, { backgroundColor: colors.surface, borderColor: colors.border }]}
              testID="ir-postular"
            >
              <View style={[styles.postularIcon, { backgroundColor: colors.accentSoft }]}>
                <ChurchIcon color={colors.accent} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>¿Eres pastor o líder?</Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>Postula tu iglesia para que sea anfitriona.</Text>
              </View>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Postular</Text>
            </Pressable>
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

/** Lo que ve quien está encargado de la iglesia: cuántos entraron, si el código está en pausa y cambiarlo. */
function Encargo({ colors, iglesia, onCodigo }: { colors: Colors; iglesia: IglesiaEncargada; onCodigo: (codigo: string) => void }) {
  const cambio = useAction();
  const cambiar = async () => {
    if (!(await confirm('Cambiar el código', 'El código y el QR de ahora dejan de servir. Quienes ya entraron siguen en tu iglesia.', 'Cambiar'))) return;
    cambio.run(async () => onCodigo((await nuevoCodigoIglesia()).codigo));
  };
  return (
    <View style={[styles.encargo, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]} testID="encargo">
      <Text style={[styles.kicker, { color: colors.accent }]}>ERES SU ENCARGADO</Text>
      <View style={styles.stats}>
        <Stat colors={colors} n={iglesia.miembros} label={iglesia.miembros === 1 ? 'persona en total' : 'personas en total'} />
        <Stat colors={colors} n={iglesia.semana} label="entraron esta semana" />
      </View>
      {iglesia.pausa && (
        <View style={[styles.pausa, { backgroundColor: colors.accentSoft }]}>
          <PeopleIcon color={colors.accent} size={18} />
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 }}>
            El código está en revisión: entraron muchas personas en un día. Quienes ya están siguen igual; lo reactivamos pronto.
          </Text>
        </View>
      )}
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
        Si el código circula fuera de tu iglesia, cámbialo: el nuevo reemplaza al de ahora, también en el QR.
      </Text>
      <Button label="Cambiar el código" kind="outline" icon={RefreshIcon} onPress={cambiar} busy={cambio.busy} style={{ alignSelf: 'flex-start' }} />
      <ErrorText>{cambio.error}</ErrorText>
    </View>
  );
}

function Stat({ colors, n, label }: { colors: Colors; n: number; label: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.statN, { color: colors.text }]}>{n}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{label}</Text>
    </View>
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
  postular: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginTop: 24 },
  postularIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  encargo: { gap: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18, marginTop: 20 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, paddingHorizontal: 8 },
  statN: { fontFamily: serif, fontSize: 28, fontWeight: '700' },
  pausa: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 14, padding: 12 },
});
