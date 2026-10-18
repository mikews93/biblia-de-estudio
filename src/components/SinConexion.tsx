import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OfflineIcon } from '@/components/comunidad/icons';
import { Button, text } from '@/components/comunidad/ui';
import { useOnline } from '@/lib/conexion';
import { isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const toDownloads = () => navigate(() => router.push('/descargas' as never), 'forward');

/** Aviso en lo que necesita internet (la IA, la comunidad): qué pasa y qué sí se puede hacer sin conexión. */
export function NeedsConnection({ title, intro }: { title: string; intro: string }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        !isDark(colors) && { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' },
      ]}
      accessibilityRole="alert"
    >
      <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
        <OfflineIcon color={colors.accent} size={26} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[text.body, styles.intro, { color: colors.muted }]}>{intro}</Text>
      <Button label="Ver lo que puedes leer sin conexión" kind="outline" onPress={toDownloads} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

/** Franja sobre las pestañas cuando no hay internet. */
export function OfflineBanner() {
  const colors = useColors();
  const online = useOnline();
  const path = usePathname();
  if (online || path.endsWith('/presentar')) return null;
  const here = path === '/descargas';
  return (
    <Pressable
      onPress={here ? undefined : toDownloads}
      disabled={here}
      style={[styles.banner, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}
      accessibilityRole={here ? 'text' : 'link'}
      accessibilityLabel="Sin conexión. Ver lo descargado"
    >
      <OfflineIcon color={colors.accent} size={16} />
      <Text style={{ color: colors.text, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
        <Text style={{ fontWeight: '700' }}>Sin conexión</Text> · lees lo guardado
      </Text>
      {!here && <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13, flexShrink: 0 }} numberOfLines={1}>Descargas ›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  emblem: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  intro: { textAlign: 'center', maxWidth: 420, marginBottom: 4 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
