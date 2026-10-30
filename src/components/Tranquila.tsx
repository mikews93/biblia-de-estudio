import { Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { MoonIcon } from '@/components/icons';
import { Colors, sans, useSettings } from '@/lib/theme';

/** El interruptor de «Lectura tranquila» (src/lib/tranquila.ts), arriba de Mi actividad. */
export default function Tranquila({ colors }: { colors: Colors }) {
  const { settings, update } = useSettings();
  const on = settings.tranquila;
  return (
    <View style={[styles.card, { backgroundColor: on ? colors.accentSoft : colors.surface, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: on ? colors.surface : colors.accentSoft }]}>
        <MoonIcon color={colors.accent} size={18} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.title, { color: colors.text }]}>Lectura tranquila</Text>
        <Text style={[styles.detail, { color: colors.muted }]}>
          {on
            ? 'Sin rachas, insignias ni porcentajes. Lo que lees y escribes se sigue guardando igual.'
            : 'Quita las rachas, las insignias y los porcentajes, si contar los días te quita la paz.'}
        </Text>
      </View>
      <Switch
        value={on}
        onValueChange={(v) => update({ tranquila: v })}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.surface}
        {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.surface } as object) : {})}
        accessibilityLabel="Lectura tranquila"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, marginBottom: 14 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: sans, fontSize: 15, fontWeight: '700' },
  detail: { fontFamily: sans, fontSize: 13, lineHeight: 18 },
});
