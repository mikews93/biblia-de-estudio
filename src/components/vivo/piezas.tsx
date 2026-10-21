// Piezas comunes de la lectura en vivo: la marca «En vivo» que late, la hoja que sube desde abajo y la fila
// de caras de quienes están.
import { ReactNode, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/comunidad/ui';
import { CloseIcon } from '@/components/icons';
import { serif, useColors } from '@/lib/theme';
import type { Persona } from '@/lib/vivo';

export const LIVE_RED = '#C8462F';

/** Punto que late suavemente: algo está pasando ahora. */
export function Pulse({ color = LIVE_RED, size = 8 }: { color?: string; size?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) return;
        loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1600, useNativeDriver: Platform.OS !== 'web' }));
        loop.start();
      });
    return () => loop?.stop();
  }, [t]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const opacity = t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.45, 0, 0] });
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color, opacity, transform: [{ scale }] }]}
      />
      <View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }]} />
    </View>
  );
}

/** «EN VIVO» con su punto, o «TERMINÓ» cuando la sala ya cerró. */
export function LiveBadge({ live = true }: { live?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[styles.badge, { backgroundColor: live ? 'rgba(200,70,47,0.12)' : colors.accentSoft }]}
      accessibilityLabel={live ? 'En vivo' : 'Terminó'}
    >
      {live && <Pulse />}
      <Text style={[styles.badgeText, { color: live ? LIVE_RED : colors.muted }]}>{live ? 'EN VIVO' : 'TERMINÓ'}</Text>
    </View>
  );
}

/** Las caras de quienes están, encimadas, con «+3» si no caben. */
export function Faces({ people, max = 4, size = 26 }: { people: Persona[]; max?: number; size?: number }) {
  const colors = useColors();
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <View key={p.id} style={[styles.face, { marginLeft: i ? -size * 0.3 : 0, borderColor: colors.background, borderRadius: size }]}>
          <Avatar name={p.nombre} foto={p.foto} size={size} />
        </View>
      ))}
      {rest > 0 && (
        <View
          style={[
            styles.face,
            styles.more,
            { marginLeft: -size * 0.3, width: size + 4, height: size + 4, borderRadius: size, borderColor: colors.background, backgroundColor: colors.accentSoft },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: size * 0.38, fontWeight: '700' }}>+{rest}</Text>
        </View>
      )}
    </View>
  );
}

/** Hoja que sube desde abajo, centrada y más angosta en el computador. */
export function Sheet({
  title,
  kicker,
  onClose,
  children,
  footer,
}: {
  title: string;
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        <View
          style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 12 }]}
          accessibilityViewIsModal
          role="dialog"
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              {kicker && <Text style={[styles.kicker, { color: colors.muted }]}>{kicker}</Text>}
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar" style={[styles.close, { backgroundColor: colors.accentSoft }]}>
              <CloseIcon color={colors.text} size={18} />
            </Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer && <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Pestañas pequeñas dentro de una hoja. */
export function Segmented<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.accentSoft }]} accessibilityRole="tablist">
      {options.map(([key, label]) => {
        const on = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: colors.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }]}
          >
            <Text style={{ color: on ? colors.text : colors.muted, fontWeight: '700', fontSize: 13.5 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const vivoText = StyleSheet.create({
  kicker: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1 },
  serifTitle: { fontFamily: serif, fontWeight: '700' },
});

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  face: { borderWidth: 2 },
  more: { alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '86%',
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, gap: 12 },
  kicker: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  sheetTitle: { fontFamily: serif, fontSize: 22, fontWeight: '700' },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 16 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
});
