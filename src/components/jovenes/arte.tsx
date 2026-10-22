// Dibujos del Modo Jóvenes: el ícono de cada ruta, el sello (una medalla con el ícono) y las tres estrellas
// de una misión. Usan la misma base de línea que el resto de la app (iconLine.tsx) y el color de cada ruta.
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Path } from 'react-native-svg';
import { useEffect, useState } from 'react';

import SelloArte from '@/components/Sello';
import { CrossIcon, PeopleIcon, StarIcon } from '@/components/icons';
import { Line, type IconProps } from '@/components/iconLine';
import { RUTAS, type Ruta, type RutaId } from '@/lib/jovenesRutas';
import { avance, useSellos, type Sello as SelloDef } from '@/lib/sellos';
import { Colors, isDark } from '@/lib/theme';

export type Tinte = { accent: string; soft: string };

/** El color de una ruta en el tema actual. Los sellos del camino entero usan el toque cálido de la app. */
export function tinte(ruta: Ruta | RutaId | undefined, colors: Colors): Tinte {
  const r = typeof ruta === 'string' ? RUTAS.find((x) => x.id === ruta) : ruta;
  if (!r) return { accent: colors.warm, soft: colors.warmSoft };
  const [accent, soft] = isDark(colors) ? r.tinte.dark : r.tinte.light;
  return { accent, soft };
}

/** Huella digital: quién soy. */
const HuellaIcon = (p: IconProps) => (
  <Line {...p}>
    <Path d="M7.5 18.5c-1-1.8-1.5-3.8-1.5-6a6 6 0 0 1 9.5-4.9" />
    <Path d="M18 10.5c.3.7.4 1.4.4 2.2 0 2.5-.4 4.6-1.2 6.3" />
    <Path d="M10 20c-.8-2-1.2-4.3-1.2-7.2a3.2 3.2 0 0 1 6.4 0c0 2.2-.3 4.3-.9 6.2" />
    <Path d="M12 12.8c0 2.6.3 5 1 7.2" />
  </Line>
);

/** Escudo: valientes. */
const EscudoIcon = (p: IconProps) => (
  <Line {...p}>
    <Path d="M12 3.5 5 6v5.5c0 4.3 2.9 7.8 7 9 4.1-1.2 7-4.7 7-9V6z" />
    <Path d="m9 12 2.2 2.2L15.5 10" />
  </Line>
);

/** Agua tranquila bajo el sol: paz. */
const OlaIcon = (p: IconProps) => (
  <Line {...p}>
    <Path d="M7.5 11a4.5 4.5 0 0 1 9 0" />
    <Path d="M12 3.5v1.6M5.6 6.1l1.1 1.1M18.4 6.1l-1.1 1.1" />
    <Path d="M3 14.5c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1" />
    <Path d="M5 18.5c1.4 0 1.4.9 2.8.9s1.4-.9 2.8-.9 1.4.9 2.8.9 1.4-.9 2.8-.9 1.4.9 2.8.9" />
  </Line>
);

const ICONOS: Record<RutaId, (p: IconProps) => React.ReactNode> = {
  jesus: CrossIcon,
  identidad: HuellaIcon,
  valientes: EscudoIcon,
  paz: OlaIcon,
  amigos: PeopleIcon,
};

export function IconoRuta({ icono, ...p }: IconProps & { icono: RutaId }) {
  const Icon = ICONOS[icono];
  return <Icon {...p} />;
}

/**
 * Un sello del álbum de la app (src/components/Sello.tsx) en la variante del Modo Jóvenes: los de cada ruta llevan
 * el color de su ruta en vez del ámbar. Por ganar, se ve punteado con el arco de lo que lleva.
 */
export function Medalla({ sello, colors, size = 72, nombre = true }: { sello: SelloDef; colors: Colors; size?: number; nombre?: boolean }) {
  const estado = useSellos();
  const { ganado, parte } = avance(estado, sello);
  const ruta = sello.tipo.startsWith('ruta-') ? (sello.tipo.slice(5) as RutaId) : undefined;
  const t = tinte(ruta, colors);
  return (
    <View style={{ alignItems: 'center', width: Math.max(size + 16, 84) }} accessibilityLabel={`${sello.titulo}: ${sello.como}${ganado ? ' Ganado.' : ''}`}>
      <SelloArte dibujo={sello.dibujo} colors={{ ...colors, warm: t.accent, warmSoft: t.soft }} ganado={!!ganado} parte={parte} size={size} />
      {nombre && (
        <Text style={[styles.nombre, { color: ganado ? colors.text : colors.muted }]} numberOfLines={1}>
          {sello.titulo}
        </Text>
      )}
    </View>
  );
}

/** Las tres estrellas de una misión; con «animar», las ganadas aparecen una tras otra. */
export function Estrellas({ n, color, vacio, size = 16, animar }: { n: number; color: string; vacio: string; size?: number; animar?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.15 }} accessibilityLabel={`${n} de 3 estrellas`}>
      {[0, 1, 2].map((i) => (
        <EstrellaUna key={i} on={i < n} color={color} vacio={vacio} size={size} delay={animar ? 250 + i * 220 : 0} />
      ))}
    </View>
  );
}

function EstrellaUna({ on, color, vacio, size, delay }: { on: boolean; color: string; vacio: string; size: number; delay: number }) {
  const [s] = useState(() => new Animated.Value(on && delay ? 0 : 1));
  useEffect(() => {
    if (!on || !delay) return;
    Animated.spring(s, { toValue: 1, delay, speed: 10, bounciness: 14, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [on, delay, s]);
  return (
    <Animated.View style={{ transform: [{ scale: s }] }}>
      <StarIcon filled={on} color={on ? color : vacio} size={size} strokeWidth={on ? 1.6 : 1.4} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  nombre: { fontSize: 13, fontWeight: '700', marginTop: 6, textAlign: 'center' },
});
