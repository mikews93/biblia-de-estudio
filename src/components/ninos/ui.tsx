// Piezas del Espacio Niños: botones grandes (dedos pequeños), el botón de escuchar y el marco de las escenas.
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import Escena from './Escena';
import { ListenIcon, PauseIcon } from '@/components/icons';
import { useColors } from '@/lib/theme';

export function BotonGrande({ label, onPress, disabled, kind = 'lleno', testID }: { label: string; onPress: () => void; disabled?: boolean; kind?: 'lleno' | 'suave'; testID?: string }) {
  const colors = useColors();
  const lleno = kind === 'lleno';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.grande,
        { backgroundColor: lleno ? colors.warm : colors.warmSoft, opacity: disabled ? 0.4 : 1 },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Text style={{ color: lleno ? colors.surface : colors.warm, fontWeight: '800', fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}

/** Botón redondo para escuchar (o parar) lo que se lee. */
export function Escuchar({ sonando, onPress, size = 52, label = 'Escuchar' }: { sonando: boolean; onPress: () => void; size?: number; label?: string }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.escuchar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: sonando ? colors.warm : colors.warmSoft },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={sonando ? 'Parar' : label}
      hitSlop={6}
    >
      {sonando ? <PauseIcon color={colors.surface} size={size * 0.42} /> : <ListenIcon color={colors.warm} size={size * 0.48} />}
    </Pressable>
  );
}

/** Una escena en un marco redondeado, con o sin borde. */
export function Cuadro({ id, titulo, radio = 24, style }: { id: string; titulo?: string; radio?: number; style?: ViewStyle }) {
  const colors = useColors();
  return (
    <View style={[{ borderRadius: radio, overflow: 'hidden', backgroundColor: colors.accentSoft }, style]}>
      <Escena id={id} colors={colors} titulo={titulo} />
    </View>
  );
}

/** La ilustración de una historia recortada en círculo. */
export function Medallon({ id, size = 108, borde, grueso = 3, apagado }: { id: string; size?: number; borde: string; grueso?: number; apagado?: boolean }) {
  const colors = useColors();
  const ancho = size * 1.6;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: grueso, borderColor: borde, overflow: 'hidden', backgroundColor: colors.surface }}>
      <View style={{ width: ancho, height: size, marginLeft: -(ancho - size) / 2 - grueso, marginTop: -grueso, opacity: apagado ? 0.45 : 1 }}>
        <Escena id={id} colors={colors} style={{ width: ancho, height: size, aspectRatio: undefined }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grande: { borderRadius: 22, paddingVertical: 18, alignItems: 'center', marginTop: 20 },
  escuchar: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
