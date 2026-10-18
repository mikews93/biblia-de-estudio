// Piezas comunes de las pantallas de comunidades, con los colores del tema.
import { ReactNode, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { initials } from '@/lib/comunidad';
import { Colors, sans, serif, useColors } from '@/lib/theme';

export function Button({
  label,
  onPress,
  kind = 'primary',
  busy,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'outline' | 'quiet';
  busy?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={[
        styles.button,
        kind === 'primary' && { backgroundColor: colors.accent },
        kind === 'outline' && { borderWidth: 1.5, borderColor: colors.accent },
        kind === 'quiet' && styles.quiet,
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={kind === 'primary' ? colors.surface : colors.accent} />
      ) : (
        <Text style={{ color: kind === 'primary' ? colors.surface : colors.accent, fontWeight: '700', fontSize: 15 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  trailing,
  ...props
}: TextInputProps & { label?: string; /** Algo a la derecha dentro del campo, como «Mostrar». */ trailing?: ReactNode }) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ alignSelf: 'stretch' }}>
      {label && <Text style={[styles.label, { color: focused ? colors.accent : colors.muted }]}>{label}</Text>}
      <View>
        <TextInput
          placeholderTextColor={colors.muted}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            styles.input,
            { color: colors.text, borderColor: focused ? colors.accent : colors.border, backgroundColor: colors.surface },
            Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
            focused && { boxShadow: `0 0 0 3px ${colors.accentSoft}` },
            props.multiline && { minHeight: 80, textAlignVertical: 'top' },
            trailing ? { paddingRight: 84 } : null,
            props.style,
          ]}
        />
        {trailing && <View style={styles.trailing}>{trailing}</View>}
      </View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

export function Avatar({ name, filled, size = 40 }: { name: string; filled?: boolean; size?: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, borderColor: filled ? colors.accent : colors.border },
        filled && { backgroundColor: colors.accent },
      ]}
    >
      <Text style={{ color: filled ? colors.surface : colors.muted, fontWeight: '700', fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.chip, { borderColor: on ? colors.accent : colors.border }, on && { backgroundColor: colors.accentSoft }]}
          >
            <Text style={{ color: on ? colors.accent : colors.text, fontWeight: on ? '700' : '500' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.section, { color: colors.muted }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <Text style={{ color: '#B3412E', marginTop: 8 }}>{children}</Text> : null;
}

/** Ejecuta una acción con indicador de carga y guarda el mensaje de error, si lo hay. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

/** Barra de la meta compartida. */
export function Meter({ value, max, colors }: { value: number; max: number; colors: Colors }) {
  return (
    <View style={[styles.bar, { backgroundColor: colors.accentSoft }]}>
      <View style={[styles.barFill, { backgroundColor: colors.accent, width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }]} />
    </View>
  );
}

export const text = StyleSheet.create({
  title: { fontFamily: serif, fontSize: 26, fontWeight: '700' },
  body: { fontFamily: sans, fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13 },
});

const styles = StyleSheet.create({
  button: { borderRadius: 24, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  quiet: { paddingVertical: 8, paddingHorizontal: 8, minHeight: 0 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  trailing: { position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  avatar: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 28, marginBottom: 10 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', alignSelf: 'stretch' },
  barFill: { height: 8, borderRadius: 4 },
});
