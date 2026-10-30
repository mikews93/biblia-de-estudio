import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LampIcon } from '@/components/icons';
import { usePlans } from '@/lib/planes';
import { responderInvitacion, useSembrar } from '@/lib/sembrar';
import { invitacionDeHoy } from '@/lib/sembrarTexto';
import { HAY_APORTES, HAY_SOSTENER, mesCubierto } from '@/lib/sostener';
import { todayKey } from '@/lib/temporadas';
import { Colors, serif, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/**
 * La invitación a sembrar en Hoy: una vez al año como mucho, después de un buen momento (src/lib/sembrarTexto.ts).
 * «Quiero sembrar» y «Ahora no» pesan lo mismo, y cualquiera de los dos la guarda por un año.
 */
export default function InvitacionSembrar({ chaptersRead, colors }: { chaptersRead: number; colors: Colors }) {
  const sembrar = useSembrar();
  const plans = usePlans();
  const { settings } = useSettings();
  if (!sembrar.ready) return null;
  const inv = invitacionDeHoy({
    ...sembrar,
    hoy: todayKey(),
    abierto: HAY_SOSTENER && HAY_APORTES,
    tranquila: settings.tranquila,
    mesCubierto: mesCubierto(),
    terminados: plans.flatMap((p) => (p.finished ? [{ title: p.title, finished: p.finished }] : [])),
    chaptersRead,
  });
  if (!inv) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="invitacion-sembrar">
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <LampIcon color={colors.accent} size={20} />
        </View>
        <Text style={[styles.kicker, { color: colors.accent }]}>Sostén Zarza</Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{inv.titulo}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{inv.texto}</Text>
      <View style={styles.buttons}>
        <Pressable
          onPress={() => {
            responderInvitacion();
            navigate(() => router.push('/sostener'), 'forward');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
        >
          <Text style={[styles.label, { color: colors.accent }]}>Quiero sembrar</Text>
        </Pressable>
        <Pressable
          onPress={responderInvitacion}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { borderColor: colors.border, borderWidth: 1 }, pressed && styles.pressed]}
        >
          <Text style={[styles.label, { color: colors.text }]}>Ahora no</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontFamily: serif, fontSize: 21, fontWeight: '700', marginTop: 12 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  button: { flex: 1, borderRadius: 18, paddingVertical: 11, alignItems: 'center' },
  label: { fontWeight: '700', fontSize: 14 },
  pressed: { opacity: 0.75 },
});
