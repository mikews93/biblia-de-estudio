import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { NOMBRE, Proveedor } from '@/lib/proveedores';
import { isDark, useColors } from '@/lib/theme';

import { AppleLogo, FacebookLogo, GoogleLogo } from './icons';

/** El logo de cada proveedor; el de Apple toma el color del texto de su botón. */
export function ProviderLogo({ proveedor, size = 22, color }: { proveedor: Proveedor; size?: number; color?: string }) {
  if (proveedor === 'google') return <GoogleLogo size={size} />;
  if (proveedor === 'apple') return <AppleLogo size={size} color={color} />;
  return <FacebookLogo size={size} />;
}

/**
 * «Continuar con Google / Apple / Facebook», uno debajo de otro. Apple va en negro (blanco en modo oscuro), como
 * pide su guía; Google y Facebook en botones claros con su logo en color.
 */
export default function ProviderButtons({
  proveedores,
  busy,
  onPress,
}: {
  proveedores: Proveedor[];
  /** El proveedor cuyo viaje está en curso, o null. */
  busy: Proveedor | null;
  onPress: (p: Proveedor) => void;
}) {
  const colors = useColors();
  const dark = isDark(colors);
  return (
    <View style={{ gap: 10 }}>
      {proveedores.map((p) => {
        const solid = p === 'apple';
        const bg = solid ? (dark ? '#FFFFFF' : '#000000') : colors.surface;
        const fg = solid ? (dark ? '#000000' : '#FFFFFF') : colors.text;
        return (
          <Pressable
            key={p}
            // Se puede volver a tocar mientras espera, por si se cerró la ventana del proveedor.
            onPress={() => onPress(p)}
            accessibilityRole="button"
            accessibilityLabel={`Continuar con ${NOMBRE[p]}`}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: bg, borderColor: solid ? bg : colors.border },
              pressed && { opacity: 0.85 },
              busy && busy !== p && { opacity: 0.55 },
            ]}
          >
            <View style={styles.logo}>{busy === p ? <ActivityIndicator color={fg} size="small" /> : <ProviderLogo proveedor={p} color={fg} />}</View>
            <Text style={[styles.label, { color: fg }]}>Continuar con {NOMBRE[p]}</Text>
            <View style={styles.logo} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 24,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  logo: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 15, letterSpacing: 0.1 },
});
