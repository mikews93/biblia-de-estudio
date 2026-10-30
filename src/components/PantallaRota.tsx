import { type ErrorBoundaryProps, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/comunidad/ui';
import { HomeIcon, LampIcon, RefreshIcon } from '@/components/icons';
import { reportarError } from '@/lib/errores';
import { isDark, sans, serif, useColors } from '@/lib/theme';

/**
 * Lo que se ve cuando una pantalla se rompe (el ErrorBoundary de src/app/_layout.tsx), en vez de una página en blanco
 * o de que la app se cierre. Avisa del fallo a quienes cuidan Zarza (src/lib/errores.ts) y deja reintentar o volver a Hoy.
 */
export default function PantallaRota({ error, retry }: ErrorBoundaryProps) {
  const colors = useColors();
  const [detalle, setDetalle] = useState(false);

  useEffect(() => {
    reportarError(error, 'pantalla');
  }, [error]);

  // En la web, volver a Hoy recarga la app desde el principio; en el teléfono se vuelve a armar y se abre Hoy.
  const aHoy = () => {
    if (Platform.OS === 'web') window.location.assign('/');
    else retry().then(() => router.replace('/'));
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <View style={[styles.halo, { backgroundColor: colors.accentSoft }]}>
        <LampIcon color={colors.accent} size={34} />
      </View>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        Esta página tropezó
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        Algo no salió bien al abrirla. Ya les avisamos a quienes cuidan Zarza, sin ningún dato tuyo. Puedes intentarlo otra vez o volver a Hoy.
      </Text>
      <View style={styles.actions}>
        <Button label="Intentar otra vez" icon={RefreshIcon} onPress={retry} />
        <Button label="Volver a Hoy" icon={HomeIcon} kind="outline" onPress={aHoy} />
      </View>
      <Text
        onPress={() => setDetalle(!detalle)}
        accessibilityRole="button"
        accessibilityState={{ expanded: detalle }}
        style={[styles.toggle, { color: colors.muted }]}
      >
        {detalle ? 'Ocultar el detalle' : 'Ver el detalle'}
      </Text>
      {detalle && (
        <View style={[styles.detail, { backgroundColor: isDark(colors) ? colors.surface : colors.accentSoft, borderColor: colors.border }]}>
          <Text selectable style={[styles.mono, { color: colors.text }]}>
            {error.message}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center' },
  halo: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: serif, fontSize: 26, fontWeight: '700', textAlign: 'center' },
  body: { fontFamily: sans, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 },
  toggle: { fontFamily: sans, fontSize: 13.5, fontWeight: '600', textDecorationLine: 'underline', marginTop: 6, padding: 6 },
  detail: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, alignSelf: 'stretch' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }), fontSize: 12.5, lineHeight: 18 },
});
