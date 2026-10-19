import { StyleSheet, Text, View } from 'react-native';

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

export { GlobeIcon, TreeIcon } from './icons';

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
