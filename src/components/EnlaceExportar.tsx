import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ChevronRightIcon, DocumentIcon } from '@/components/icons';
import { sans, useColors } from '@/lib/theme';

/** Al pie de Mis notas, Mi diario y el Taller: guardar todo lo propio en un documento (src/app/exportar.tsx). */
export default function EnlaceExportar({ texto = 'Guardar todo en un documento' }: { texto?: string }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => router.push('/exportar')}
      accessibilityRole="link"
      style={({ pressed }) => [styles.row, { borderColor: colors.border }, pressed && { opacity: 0.6 }]}
    >
      <DocumentIcon color={colors.accent} size={18} />
      <Text style={[styles.text, { color: colors.text }]}>{texto}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>Word, PDF o texto</Text>
      <ChevronRightIcon color={colors.muted} size={15} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 24 },
  text: { fontFamily: sans, fontSize: 14.5, fontWeight: '600', flex: 1 },
  sub: { fontFamily: sans, fontSize: 12.5 },
});
