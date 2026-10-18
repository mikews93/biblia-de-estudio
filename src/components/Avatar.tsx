import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Persona } from '@/lib/genealogia';
import { Colors, serif } from '@/lib/theme';

/** Color de una persona: azul para varones, terracota para mujeres (los del tema). */
export const personaColor = (p: Pick<Persona, 'sexo'>, colors: Colors) =>
  p.sexo === 'f' ? colors.accent : p.sexo === 'm' ? colors.greek : colors.muted;

/** Círculo con la inicial del nombre. */
export function Avatar({
  persona,
  colors,
  size = 36,
  solid,
}: {
  persona: Pick<Persona, 'nombre' | 'sexo'>;
  colors: Colors;
  size?: number;
  solid?: boolean;
}) {
  const color = personaColor(persona, colors);
  const initial = persona.nombre.replace(/^(Hija?o?s? de |Esposa de |Madre de |Suegra de )/, '').charAt(0);
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: solid ? color : `${color}22` },
      ]}
    >
      <Text style={{ color: solid ? colors.surface : color, fontFamily: serif, fontSize: size * 0.46, fontWeight: '700' }}>
        {initial}
      </Text>
    </View>
  );
}

/** Pequeño globo terráqueo de línea. */
export function GlobeIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" />
    </Svg>
  );
}

/** Árbol genealógico de línea: una persona arriba y dos abajo. */
export function TreeIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6}>
      <Circle cx={12} cy={5} r={2.6} />
      <Circle cx={6} cy={19} r={2.6} />
      <Circle cx={18} cy={19} r={2.6} />
      <Path d="M12 7.6V12M6 16.4V12h12v4.4" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
