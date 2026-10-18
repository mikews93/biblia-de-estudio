import { type ReactNode, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Colors } from '@/lib/theme';

type Props = {
  label: string;
  /** Lo que lee el lector de pantalla, si es más largo que el nombre. */
  hint?: string;
  icon: (color: string) => ReactNode;
  colors: Colors;
  onPress: () => void;
  /** Destacada: círculo con el color de acento. */
  strong?: boolean;
  badge?: number;
  /** Posición en la fila, para que entren una tras otra. */
  index?: number;
  /** Ancho de cada botón: un número fijo o una fracción de la fila (rejilla). */
  width?: number | `${number}%`;
};

/** Botón redondo con su nombre debajo: herramientas del capítulo y acciones del versículo. Se hunde un poco al tocarlo. */
export default function ToolButton({ label, hint, icon, colors, onPress, strong, badge, index = 0, width = 74 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, speed: 40, bounciness: toValue === 1 ? 10 : 0, useNativeDriver: Platform.OS !== 'web' }).start();

  return (
    <Appear delay={index * 35} from={6} style={{ width }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => spring(0.9)}
        onPressOut={() => spring(1)}
        style={styles.tool}
        accessibilityRole="button"
        accessibilityLabel={hint ?? label}
      >
        {(state) => {
          const hovered = (state as { hovered?: boolean }).hovered;
          return (
            <>
              <Animated.View
                style={[
                  styles.circle,
                  strong
                    ? { backgroundColor: colors.accent }
                    : { backgroundColor: hovered ? colors.accentSoft : colors.surface, borderColor: hovered ? colors.accent : colors.border },
                  !strong && styles.outlined,
                  { transform: [{ scale }] },
                ]}
              >
                <View style={styles.glyph}>{icon(strong ? colors.surface : colors.accent)}</View>
                {!!badge && (
                  <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
                    <Text style={[styles.badgeText, { color: colors.surface }]}>{badge}</Text>
                  </View>
                )}
              </Animated.View>
              <Text style={[styles.label, { color: hovered ? colors.accent : colors.text }]} numberOfLines={1}>
                {label}
              </Text>
            </>
          );
        }}
      </Pressable>
    </Appear>
  );
}

const styles = StyleSheet.create({
  tool: { alignItems: 'center', paddingVertical: 2, paddingHorizontal: 1 },
  circle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  outlined: { borderWidth: StyleSheet.hairlineWidth },
  glyph: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: -0.1, marginTop: 6, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', lineHeight: 12 },
});
