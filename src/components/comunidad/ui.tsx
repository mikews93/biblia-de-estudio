// Piezas comunes de las pantallas de comunidades, con los colores del tema.
import { ReactNode, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from '@/components/iconLine';
import { initials } from '@/lib/comunidad';
import { useCrecer } from '@/lib/crecer';
import { resplandorDe } from '@/lib/resplandor';
import { Colors, sans, serif, useColors } from '@/lib/theme';

/** Un ícono de línea delante de un texto corto (títulos pequeños, enlaces): mismo color, centrados. */
export function IconText({
  icon: Icon,
  color,
  size = 14,
  gap = 6,
  style,
  children,
}: {
  icon: (p: IconProps) => ReactNode;
  color: string;
  size?: number;
  gap?: number;
  style?: ViewStyle;
  children: ReactNode;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      <Icon color={color} size={size} strokeWidth={2} />
      {children}
    </View>
  );
}

export function Button({
  label,
  icon: Icon,
  iconAfter,
  onPress,
  kind = 'primary',
  busy,
  disabled,
  style,
}: {
  label: string;
  /** Ícono de línea (src/components/icons.tsx) junto al texto; con «iconAfter», a la derecha. */
  icon?: (p: IconProps) => ReactNode;
  iconAfter?: boolean;
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
        <View style={styles.buttonRow}>
          {Icon && !iconAfter && <Icon color={kind === 'primary' ? colors.surface : colors.accent} size={17} strokeWidth={2} />}
          <Text style={{ color: kind === 'primary' ? colors.surface : colors.accent, fontWeight: '700', fontSize: 15 }}>{label}</Text>
          {Icon && iconAfter && <Icon color={kind === 'primary' ? colors.surface : colors.accent} size={17} strokeWidth={2} />}
        </View>
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
  // Los de varias líneas crecen a medida que se escribe (en la web hay que medirlos).
  const crecer = useCrecer(typeof props.value === 'string' ? props.value : undefined, !!props.multiline);
  return (
    <View style={{ alignSelf: 'stretch' }}>
      {label && <Text style={[styles.label, { color: focused ? colors.accent : colors.muted }]}>{label}</Text>}
      <View>
        <TextInput
          placeholderTextColor={colors.muted}
          {...props}
          ref={props.multiline ? (crecer.ref as never) : undefined}
          onLayout={(e) => {
            crecer.onLayout?.();
            props.onLayout?.(e);
          }}
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

/** La foto de la persona o, sin foto, sus iniciales en un círculo. */
export function Avatar({
  name,
  foto,
  filled,
  size = 40,
  racha = 0,
}: {
  name: string;
  foto?: string | null;
  filled?: boolean;
  size?: number;
  /** Racha devocional viva: desde 3 días, un aro de luz que crece con la racha (src/lib/resplandor.ts). */
  racha?: number;
}) {
  const colors = useColors();
  const [broken, setBroken] = useState<string | null>(null);
  const round = { width: size, height: size, borderRadius: size / 2 };
  const foto_ =
    foto && broken !== foto ? (
      <Image
        source={{ uri: foto }}
        onError={() => setBroken(foto)}
        accessibilityIgnoresInvertColors
        style={[round, { backgroundColor: colors.accentSoft }, filled && { borderWidth: 2, borderColor: colors.accent }]}
      />
    ) : (
      <View
        style={[
          styles.avatar,
          round,
          { borderColor: filled ? colors.accent : colors.border },
          filled && { backgroundColor: colors.accent },
        ]}
      >
        <Text style={{ color: filled ? colors.surface : colors.muted, fontWeight: '700', fontSize: size * 0.36 }}>
          {initials(name)}
        </Text>
      </View>
    );
  const luz = resplandorDe(racha);
  if (!luz) return foto_;
  return <AroDeLuz size={size} intensidad={luz.intensidad} racha={racha}>{foto_}</AroDeLuz>;
}

const ORO = '#F2B45A';
const BRASA = '#E07B2E';

/**
 * El aro de luz de la racha alrededor de la foto: fino y ámbar a los 3 días; con resplandor desde los 7; dorado y
 * brillante desde los 40 (el rostro de Moisés); con una llamita desde los 100. Ocupa el mismo lugar que la foto.
 */
function AroDeLuz({ size, intensidad: n, racha, children }: { size: number; intensidad: number; racha: number; children: ReactNode }) {
  const colors = useColors();
  const grosor = Math.max(1.5, Math.min(3, size / 22)) + (n >= 4 ? 0.5 : 0);
  const color = n >= 4 ? ORO : n >= 2 ? BRASA : colors.warm;
  const brillo = n >= 2 ? Math.round(size * (0.08 + n * 0.035)) : 0;
  const sombra =
    brillo > 0
      ? Platform.OS === 'web'
        ? ({ boxShadow: `0 0 ${brillo}px ${Math.round(brillo / 3)}px ${n >= 4 ? 'rgba(242,180,90,0.75)' : 'rgba(224,123,46,0.5)'}` } as object)
        : { shadowColor: color, shadowOpacity: n >= 4 ? 0.9 : 0.6, shadowRadius: brillo, shadowOffset: { width: 0, height: 0 }, elevation: 0 }
      : null;
  const llama = n >= 5 && size >= 30;
  const chico = Math.max(14, size * 0.3);
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityLabel={`Racha devocional de ${racha} días`}
      testID="aro-de-luz"
    >
      {children}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, borderWidth: grosor, borderColor: color, margin: -grosor - 1 },
          n >= 6 && { borderStyle: 'solid', outlineColor: 'rgba(255,246,222,0.9)', outlineWidth: 1.5, outlineStyle: 'solid' },
          sombra,
        ]}
      />
      {llama && (
        <View
          pointerEvents="none"
          style={[styles.llamita, { width: chico, height: chico, borderRadius: chico / 2, backgroundColor: ORO, borderColor: colors.surface }]}
        >
          <Svg width={chico * 0.62} height={chico * 0.62} viewBox="0 0 24 24">
            <Path
              d="M12 21c-3.8 0-6.5-2.7-6.5-6.3 0-2.5 1.4-4.3 2.9-5.9.3 1.5.9 2.6 1.9 3.2-.2-3.4 1.1-6.2 3.6-8.5.3 2.8 1.6 4.6 3 6.2 1 1.2 1.6 2.6 1.6 4.3 0 4-2.7 7-6.5 7z"
              fill="#FFF6DE"
            />
          </Svg>
        </View>
      )}
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
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  button: { borderRadius: 24, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  quiet: { paddingVertical: 8, paddingHorizontal: 8, minHeight: 0 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  trailing: { position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  avatar: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  llamita: { position: 'absolute', right: -3, bottom: -3, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 28, marginBottom: 10 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', alignSelf: 'stretch' },
  barFill: { height: 8, borderRadius: 4 },
});
