// Una fila de la lista del Taller que se desliza a la izquierda para mostrar sus acciones (copia, borrar) y que,
// al mantenerla pulsada (o con clic derecho en el computador), abre todas sus opciones. Funciona igual con el dedo
// en el teléfono y en la app instalada de Chrome.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { IconProps } from '@/components/iconLine';
import { useColors } from '@/lib/theme';

export type AccionFila = { label: string; icon: (p: IconProps) => ReactNode; color: string; fondo: string; onPress: () => void };

const ANCHO = 78;

// Solo una fila abierta a la vez: al abrir otra, la anterior se cierra.
let abiertaAhora: { yo: object; cerrar: () => void } | null = null;

export default function Deslizable({
  acciones,
  onPress,
  onOpciones,
  accessibilityLabel,
  style,
  children,
}: {
  acciones: AccionFila[];
  onPress: () => void;
  /** Mantener pulsado, clic derecho o la acción de accesibilidad «Opciones». */
  onOpciones: () => void;
  accessibilityLabel: string;
  style?: ViewStyle;
  children: ReactNode;
}) {
  const colors = useColors();
  const total = ANCHO * acciones.length;
  const x = useRef(new Animated.Value(0)).current;
  const base = useRef(0);
  const [abierta, setAbierta] = useState(false);
  const cuerpo = useRef<unknown>(null);
  const reduce = useRef(false);
  const yo = useRef({}).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => (reduce.current = r))
      .catch(() => {});
  }, []);

  const ir = (to: number) => {
    base.current = to;
    setAbierta(to !== 0);
    if (to !== 0) {
      if (abiertaAhora && abiertaAhora.yo !== yo) abiertaAhora.cerrar();
      abiertaAhora = { yo, cerrar: () => ir(0) };
    } else if (abiertaAhora?.yo === yo) abiertaAhora = null;
    if (reduce.current) x.setValue(to);
    else Animated.spring(x, { toValue: to, useNativeDriver: Platform.OS !== 'web', bounciness: 3, speed: 18 }).start();
  };
  const cerrar = () => ir(0);

  const pan = useRef(
    PanResponder.create({
      // Solo un gesto claramente horizontal: el vertical sigue siendo para recorrer la lista.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        let v = base.current + g.dx;
        // Más allá de las acciones, o hacia la derecha, cuesta (como un elástico).
        if (v < -total) v = -total + (v + total) / 3;
        if (v > 0) v = v / 4;
        x.setValue(v);
      },
      onPanResponderRelease: (_, g) => {
        const v = base.current + g.dx;
        ir(g.vx < -0.4 || (v < -total / 2 && g.vx < 0.4) ? -total : 0);
      },
      onPanResponderTerminate: () => ir(base.current),
    }),
  ).current;

  // En el navegador: el clic derecho (y la pulsación larga de Chrome en Android) abre las opciones, no el menú del sistema.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = cuerpo.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const menu = (e: Event) => {
      e.preventDefault();
      onOpciones();
    };
    el.addEventListener('contextmenu', menu);
    return () => el.removeEventListener('contextmenu', menu);
  }, [onOpciones]);

  return (
    <View style={[styles.fila, style]}>
      <Animated.View
        style={[styles.acciones, { width: total, opacity: x.interpolate({ inputRange: [-24, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden={!abierta}>
        {acciones.map((a) => {
          const Icon = a.icon;
          return (
            <Pressable
              key={a.label}
              onPress={() => {
                cerrar();
                a.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={({ pressed }) => [styles.accion, { backgroundColor: a.fondo }, pressed && { opacity: 0.8 }]}
            >
              <Icon color={a.color} size={21} strokeWidth={1.9} />
              <Text style={{ color: a.color, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{a.label}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
      <Animated.View
        ref={cuerpo as never}
        {...pan.panHandlers}
        style={[
          { transform: [{ translateX: x }], backgroundColor: colors.background, borderRadius: 16 },
          Platform.OS === 'web' && ({ touchAction: 'pan-y', userSelect: 'none', WebkitTouchCallout: 'none' } as object),
        ]}
      >
        <Pressable
          onPress={() => (abierta ? cerrar() : onPress())}
          onLongPress={() => {
            cerrar();
            onOpciones();
          }}
          delayLongPress={380}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Mantén pulsado o desliza a la izquierda para ver más opciones"
          accessibilityActions={[{ name: 'opciones', label: 'Opciones' }]}
          onAccessibilityAction={(e) => e.nativeEvent.actionName === 'opciones' && onOpciones()}
          style={({ pressed }) => pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { position: 'relative', borderRadius: 16, overflow: 'hidden' },
  acciones: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row', borderRadius: 16, overflow: 'hidden' },
  accion: { width: ANCHO, alignItems: 'center', justifyContent: 'center' },
});
