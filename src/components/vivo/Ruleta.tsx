// La ruleta de preguntas: doce casillas (cuatro categorías en tres niveles) que giran igual en todos los teléfonos.
// El servidor elige la casilla; aquí solo se anima hasta ella y luego aparece la pregunta.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { CATEGORIAS, type Categoria, NIVELES, RULETA } from '@/lib/repaso';
import { isDark, serif, useColors } from '@/lib/theme';
import { TONOS } from '@/lib/vivo';

/** El color de cada categoría, igual en la ruleta, la leyenda y la pregunta. */
export const TONO_CATEGORIA: Record<Categoria, (typeof TONOS)[number]> = {
  texto: TONOS[0],
  sentido: TONOS[2],
  tema: TONOS[4],
  vida: TONOS[1],
};

const GIRO_MS = 2600;
const ANGULO = 360 / RULETA.length;

function sector(r: number, i: number) {
  const a0 = ((i * ANGULO - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * ANGULO - 90) * Math.PI) / 180;
  const p = (a: number) => `${r + r * Math.cos(a)} ${r + r * Math.sin(a)}`;
  return `M ${r} ${r} L ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)} Z`;
}

/**
 * La ruleta. `giro` cuenta las vueltas: cuando cambia, gira (unas vueltas y frena en `casilla`) y al terminar
 * avisa con `onParada`. Al abrir la sala a mitad de juego se queda en la casilla, sin girar.
 */
export function Rueda({ casilla, giro, size = 230, onParada }: { casilla: number | null; giro: number; size?: number; onParada?: () => void }) {
  const colors = useColors();
  const dark = isDark(colors);
  const destino = (c: number | null) => (c === null ? 0 : -(c * ANGULO + ANGULO / 2));
  const [angulo] = useState(() => new Animated.Value(destino(casilla)));
  const vueltas = useRef(0);
  const visto = useRef(giro);
  const parada = useRef(onParada);
  useEffect(() => {
    parada.current = onParada;
  }, [onParada]);

  useEffect(() => {
    if (giro === visto.current || casilla === null) return;
    visto.current = giro;
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((quieto) => {
        if (!vivo) return;
        vueltas.current += 5;
        const fin = vueltas.current * 360 + destino(casilla);
        if (quieto) {
          angulo.setValue(fin);
          parada.current?.();
          return;
        }
        Animated.timing(angulo, { toValue: fin, duration: GIRO_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => parada.current?.());
      });
    return () => {
      vivo = false;
    };
  }, [giro, casilla]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = size / 2;
  const rotate = angulo.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'], extrapolate: 'extend' });
  return (
    <View style={{ width: size, height: size + 10, alignSelf: 'center' }} accessibilityLabel="Ruleta de preguntas">
      <Animated.View style={{ width: size, height: size, marginTop: 10, transform: [{ rotate }] }}>
        <Svg width={size} height={size}>
          {RULETA.map((c, i) => {
            const tono = TONO_CATEGORIA[c.categoria];
            const mid = (((i + 0.5) * ANGULO - 90) * Math.PI) / 180;
            const tx = r + r * 0.68 * Math.cos(mid);
            const ty = r + r * 0.68 * Math.sin(mid);
            return (
              <G key={i}>
                <Path d={sector(r, i)} fill={dark ? tono.dark : tono.light} stroke={colors.surface} strokeWidth={2} />
                <SvgText
                  x={tx}
                  y={ty + 5}
                  fill={dark ? '#FFFFFF' : tono.ink}
                  fontSize={c.nivel === 3 ? 15 : 13}
                  fontWeight="800"
                  textAnchor="middle"
                  transform={`rotate(${(i + 0.5) * ANGULO} ${tx} ${ty})`}
                >
                  {c.puntos}
                </SvgText>
              </G>
            );
          })}
          <Circle cx={r} cy={r} r={r * 0.2} fill={colors.surface} stroke={colors.border} strokeWidth={1} />
          <Circle cx={r} cy={r} r={r * 0.07} fill={colors.warm} />
        </Svg>
      </Animated.View>
      {/* La flecha, fija arriba */}
      <View style={[styles.pointer, { left: r - 11 }]}>
        <Svg width={22} height={22}>
          <Path d="M 2 2 L 20 2 L 11 20 Z" fill={colors.text} stroke={colors.surface} strokeWidth={1.5} />
        </Svg>
      </View>
    </View>
  );
}

/** Los colores de las cuatro categorías. */
export function Leyenda() {
  const colors = useColors();
  const dark = isDark(colors);
  return (
    <View style={styles.legend}>
      {CATEGORIAS.map((c) => (
        <View key={c.id} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: dark ? TONO_CATEGORIA[c.id].ink : TONO_CATEGORIA[c.id].light, borderColor: TONO_CATEGORIA[c.id].ink }]} />
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '600' }}>{c.nombre}</Text>
        </View>
      ))}
    </View>
  );
}

/** La casilla en que cayó: categoría, nivel y puntos, arriba de la pregunta. */
export function CasillaPill({ casilla }: { casilla: number }) {
  const colors = useColors();
  const dark = isDark(colors);
  const c = RULETA[casilla];
  if (!c) return null;
  const tono = TONO_CATEGORIA[c.categoria];
  const nombre = CATEGORIAS.find((x) => x.id === c.categoria)?.nombre;
  return (
    <View style={[styles.pill, { backgroundColor: dark ? tono.dark : tono.light }]}>
      <Text style={{ color: dark ? '#FFFFFF' : tono.ink, fontWeight: '800', fontSize: 13 }}>
        {nombre} · {NIVELES[c.nivel - 1]}
      </Text>
      <Text style={{ color: dark ? '#FFFFFF' : tono.ink, fontFamily: serif, fontWeight: '700', fontSize: 16 }}>{c.puntos} pts</Text>
    </View>
  );
}

/** Si la ruleta de este teléfono ya paró en el giro de ahora (para no mostrar la pregunta antes). */
export function useParada(giro: number) {
  const [parado, setParado] = useState(giro);
  return { parado: parado === giro, parar: () => setParado(giro) };
}

const styles = StyleSheet.create({
  pointer: { position: 'absolute', top: 0 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 14 },
});
