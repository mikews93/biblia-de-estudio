// El fondo del versículo del día en Hoy: la luz de la hora. De mañana el resplandor sale abajo a la izquierda, de
// tarde arriba a la derecha y de noche es un brillo pequeño con estrellas. Los rayos finos recuerdan las hojas en
// abanico de la llama de Zarza. Solo usa los colores del tema (grafito y ámbar), así que funciona en claro y oscuro.
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { Colors } from '@/lib/theme';

export type Hora = 'manana' | 'tarde' | 'noche';

export function horaDelDia(date = new Date()): Hora {
  const h = date.getHours();
  return h >= 5 && h < 12 ? 'manana' : h >= 12 && h < 19 ? 'tarde' : 'noche';
}

// Dónde nace la luz (en una caja de 100 × 100) y cuánto brilla.
const LUZ: Record<Hora, { x: number; y: number; r: number; fuerza: number }> = {
  manana: { x: 8, y: 92, r: 85, fuerza: 1 },
  tarde: { x: 94, y: 4, r: 80, fuerza: 0.9 },
  noche: { x: 88, y: 10, r: 48, fuerza: 0.75 },
};

// Estrellas fijas (siempre las mismas, para que la tarjeta no cambie al volver a la pantalla).
const ESTRELLAS: [number, number, number][] = [
  [52, 3, 0.9], [61, 9, 0.6], [70, 4, 0.8], [77, 13, 0.5], [66, 17, 0.4], [57, 13, 0.5], [83, 7, 0.6], [46, 8, 0.4],
];

/** Si el tema es oscuro, mirando el fondo (así sirve para claro, sepia y oscuro sin preguntar al ajuste). */
export function esOscuro(colors: Colors) {
  const n = parseInt(colors.background.slice(1, 7), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum < 128;
}

export default function CieloHoy({ colors, hora }: { colors: Colors; hora: Hora }) {
  const oscuro = esOscuro(colors);
  const luz = LUZ[hora];
  const brillo = (oscuro ? 0.34 : 0.26) * luz.fuerza;
  const rayos = Array.from({ length: 9 }, (_, i) => {
    // Un abanico de rayos que sale de la luz hacia el centro de la tarjeta.
    const base = Math.atan2(50 - luz.y, 50 - luz.x);
    const a = base + (i - 4) * 0.13;
    return { x2: luz.x + Math.cos(a) * 80, y2: luz.y + Math.sin(a) * 80, o: 0.5 - Math.abs(i - 4) * 0.1 };
  });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="hoy-fondo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surface} />
            <Stop offset="1" stopColor={oscuro ? colors.background : colors.warmSoft} stopOpacity={oscuro ? 1 : 0.55} />
          </LinearGradient>
          <RadialGradient id="hoy-luz" cx={luz.x} cy={luz.y} r={luz.r} fx={luz.x} fy={luz.y} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.warm} stopOpacity={brillo} />
            <Stop offset="0.45" stopColor={colors.warm} stopOpacity={brillo * 0.35} />
            <Stop offset="1" stopColor={colors.warm} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#hoy-fondo)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#hoy-luz)" />
        <G>
          {rayos.map((r, i) => (
            <Line key={i} x1={luz.x} y1={luz.y} x2={r.x2} y2={r.y2} stroke={colors.warm} strokeWidth={1} strokeOpacity={r.o * (oscuro ? 0.24 : 0.2)} vectorEffect="non-scaling-stroke" />
          ))}
        </G>
      </Svg>
      {hora === 'noche' && oscuro && (
        // Aparte, sin estirar, para que las estrellas queden redondas.
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMin slice">
          {ESTRELLAS.map(([x, y, o], i) => (
            <Circle key={i} cx={x} cy={y} r={0.32} fill={oscuro ? colors.text : colors.warm} opacity={o * (oscuro ? 0.5 : 0.35)} />
          ))}
        </Svg>
      )}
    </View>
  );
}
