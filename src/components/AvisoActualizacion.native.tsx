import * as Updates from 'expo-updates';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/lib/theme';

// No vuelve a preguntar a EAS más de una vez cada 15 minutos al volver a la app.
const CADA = 15 * 60 * 1000;

/**
 * Franja sobre las pestañas cuando ya se bajó una versión nueva (EAS Update, .github/workflows/app-actualizar.yml).
 * Antes la novedad se aplicaba sola, pero solo la siguiente vez que se abría la app, y parecía que no llegaba.
 * Busca al abrir (expo-updates) y cada vez que la app vuelve al frente; al tocar, se reinicia con la versión nueva.
 */
export default function AvisoActualizacion() {
  const colors = useColors();
  const path = usePathname();
  const { isUpdatePending } = Updates.useUpdates();
  const [reiniciando, setReiniciando] = useState(false);
  const ultima = useRef(0);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    // Al abrir ya busca expo-updates solo; desde ahí se cuentan los 15 minutos.
    ultima.current = Date.now();
    const sub = AppState.addEventListener('change', async (estado) => {
      if (estado !== 'active' || Date.now() - ultima.current < CADA) return;
      ultima.current = Date.now();
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Sin conexión o EAS no responde: se intenta la próxima vez.
      }
    });
    return () => sub.remove();
  }, []);

  // En Presentar no se interrumpe a quien está guiando.
  if (!Updates.isEnabled || !isUpdatePending || path.endsWith('/presentar')) return null;

  const actualizar = () => {
    setReiniciando(true);
    Updates.reloadAsync().catch(() => setReiniciando(false));
  };

  return (
    <Pressable
      onPress={actualizar}
      disabled={reiniciando}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: colors.accentSoft, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Hay una versión nueva de Zarza. Toca para actualizar"
    >
      <View style={[styles.punto, { backgroundColor: colors.accent }]} />
      <Text style={{ color: colors.text, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
        <Text style={{ fontWeight: '700' }}>Versión nueva lista</Text> · toma un segundo
      </Text>
      {reiniciando ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13, flexShrink: 0 }} numberOfLines={1}>
          Actualizar ›
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  punto: { width: 7, height: 7, borderRadius: 4 },
});
