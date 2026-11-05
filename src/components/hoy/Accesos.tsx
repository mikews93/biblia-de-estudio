// Los accesos de Hoy en «bento»: el tamaño dice la importancia. La función más usada va en grande con la luz ámbar
// del versículo del día, las cuatro siguientes en pequeño y «Todo en Zarza» abajo para el resto. El orden sale del uso
// de cada persona, contado en su dispositivo (src/lib/usoFunciones.ts).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ArrowRightIcon, GridIcon, type IconProps } from '@/components/icons';
import { ICONOS } from '@/components/iconosFuncion';
import type { Funcion } from '@/lib/todo';
import { CORTO } from '@/lib/usoFunciones';
import { serif, type Colors } from '@/lib/theme';

export type Acceso = { icon: (p: IconProps) => React.ReactNode; label: string; detalle?: string; go: () => void };

type Props = { funciones: Funcion[]; abrir: (f: Funcion) => void; todo: () => void; colors: Colors };

const acceso = (f: Funcion, abrir: (f: Funcion) => void, corto = true): Acceso => ({
  icon: ICONOS[f.icono],
  label: (corto && CORTO[f.id]) || f.titulo,
  detalle: f.detalle,
  go: () => abrir(f),
});

export default function Accesos({ funciones, abrir, todo, colors }: Props) {
  if (funciones.length < 5) return null;
  const grande = acceso(funciones[0], abrir, false);
  const [a, b, c, d] = funciones.slice(1, 5).map((f) => acceso(f, abrir));
  const pequeno = (t: Acceso) => (
    <Pressable
      key={t.label}
      onPress={t.go}
      style={({ pressed }) => [s.pequeno, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && s.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t.label}
    >
      <t.icon color={colors.text} size={22} />
      <Text style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: 14 }} numberOfLines={2}>
        {t.label}
      </Text>
    </Pressable>
  );
  return (
    <View>
      <Text style={[s.kicker, { color: colors.muted }]}>Accesos</Text>
      <View style={s.fila}>
        <Pressable
          onPress={grande.go}
          style={({ pressed }) => [s.grande, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLabel={grande.label}
        >
          <Luz colors={colors} />
          <grande.icon color={colors.warm} size={30} />
          <View>
            <Text style={{ color: colors.text, fontFamily: serif, fontSize: 24, lineHeight: 28 }} numberOfLines={2}>
              {grande.label}
            </Text>
            {!!grande.detalle && (
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 }} numberOfLines={2}>
                {grande.detalle}
              </Text>
            )}
          </View>
        </Pressable>
        <View style={s.columna}>
          {pequeno(a)}
          {pequeno(b)}
        </View>
      </View>
      <View style={[s.fila, { marginTop: 10 }]}>
        <View style={{ flex: 1 }}>{pequeno(c)}</View>
        <View style={{ flex: 1 }}>{pequeno(d)}</View>
      </View>
      <Pressable
        onPress={todo}
        style={({ pressed }) => [s.todo, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && s.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Todo en Zarza"
      >
        <GridIcon color={colors.warm} size={20} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Todo en Zarza</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>Más de 40 funciones, por grupos</Text>
        </View>
        <ArrowRightIcon color={colors.warm} size={18} />
      </Pressable>
    </View>
  );
}

/** Un resplandor ámbar suave en la esquina, el mismo lenguaje que el versículo del día. */
function Luz({ colors }: { colors: Colors }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="accesos-luz" cx="100" cy="0" r="110" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.warm} stopOpacity={0.22} />
            <Stop offset="1" stopColor={colors.warm} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#accesos-luz)" />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  fila: { flexDirection: 'row', gap: 10 },
  columna: { flex: 1, gap: 10 },
  grande: { flex: 1.15, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 18, justifyContent: 'space-between', minHeight: 170, overflow: 'hidden' },
  pequeno: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 16 },
  todo: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 14 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
