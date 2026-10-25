// El aro de luz de la racha devocional alrededor de la foto de perfil en la comunidad. Sube con cada meta del
// resplandor (src/lib/resplandor.ts): un aro tibio a los 3 días; brasa que late a los 7; lenguas de fuego a los 21;
// rayos de luz dorada que giran a los 40 (el rostro de Moisés); una corona de fuego a los 100; fuego y rayos con
// corona a los 365; y a los siete años, luz blanca con un sol. Todo se dibuja detrás de la foto (no la tapa) y no
// cambia el tamaño que ocupa. Con «reducir movimiento» queda quieto.
import { ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { useColors } from '@/lib/theme';

const native = Platform.OS !== 'web';
const ORO = '#F2B45A';
const BRASA = '#E07B2E';
const BLANCO = '#FFF6DE';
const ORO_HONDO = '#C88A2C';

// Un solo reloj para todos los aros de la pantalla (puede haber decenas en el muro).
let reloj: { giro: Animated.Value; pulso: Animated.Value } | null = null;
function useReloj() {
  const [r] = useState(() => {
    if (!reloj) {
      reloj = { giro: new Animated.Value(0), pulso: new Animated.Value(0.5) };
      const { giro, pulso } = reloj;
      AccessibilityInfo.isReduceMotionEnabled()
        .catch(() => false)
        .then((reducir) => {
          if (reducir) return;
          Animated.loop(Animated.timing(giro, { toValue: 1, duration: 40_000, easing: Easing.linear, useNativeDriver: native })).start();
          Animated.loop(
            Animated.sequence([
              Animated.timing(pulso, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
              Animated.timing(pulso, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
            ]),
          ).start();
        });
    }
    return reloj;
  });
  return r;
}

/** Cuánto sale la luz más allá de la foto, por nivel (fracción del tamaño de la foto). */
const ALCANCE = [0, 0.1, 0.16, 0.27, 0.3, 0.36, 0.42, 0.48];

type Props = { size: number; intensidad: number; racha: number; children: ReactNode };

export default function AroDeLuz({ size, intensidad: n, racha, children }: Props) {
  const colors = useColors();
  const { giro, pulso } = useReloj();
  const [id] = useState(() => `aro${Math.random().toString(36).slice(2, 8)}`);
  const k = ALCANCE[n] ?? 0.48;
  const total = size * (1 + 2 * k);
  const escala = 100 / total;
  const R = 50 / (1 + 2 * k);
  const ancho = (Math.max(2.5, Math.min(5, size / 13)) + n * 0.35) * escala;
  const rr = R + ancho / 2;
  const base = rr + ancho / 2 - 0.5;
  const claro = n >= 7;

  const llamas = n === 3 ? 10 : n === 5 ? 16 : n === 6 ? 18 : n >= 7 ? 12 : 0;
  const rayos = n === 4 ? 16 : n === 6 ? 24 : n >= 7 ? 32 : 0;
  const altoLlama = (50 - base) * (n === 3 ? 0.6 : n === 5 ? 0.92 : 0.8);
  const p = (r: number, a: number) => `${(50 + Math.cos(a) * r).toFixed(2)} ${(50 + Math.sin(a) * r).toFixed(2)}`;

  const anillo =
    n === 1 ? [colors.warm, colors.warm] : n <= 3 ? [BRASA, ORO, BRASA] : claro ? ['#FFFFFF', ORO, '#FFFFFF'] : [ORO, BLANCO, ORO_HONDO];
  const brillo = n === 1 ? 0 : 0.28 + n * 0.08;
  const colorBrillo = n <= 3 ? BRASA : claro ? '#FFE7A8' : ORO;

  const latido = pulso.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.05] });
  const rotar = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const capa = { position: 'absolute' as const, left: -size * k, top: -size * k, width: total, height: total };
  const chico = Math.max(15, size * 0.32);

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`Racha devocional de ${racha} días`} testID="aro-de-luz">
      {/* El resplandor que late */}
      {brillo > 0 && (
        <Animated.View pointerEvents="none" style={[capa, { opacity: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }), transform: [{ scale: latido }] }]}>
          <Svg width={total} height={total} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={`${id}b`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                <Stop offset={R / 50} stopColor={colorBrillo} stopOpacity={Math.min(0.95, brillo)} />
                <Stop offset={(R / 50 + 1) / 2} stopColor={colorBrillo} stopOpacity={brillo * 0.35} />
                <Stop offset="1" stopColor={colorBrillo} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={50} cy={50} r={50} fill={`url(#${id}b)`} />
          </Svg>
        </Animated.View>
      )}

      {/* Rayos y lenguas de fuego: giran despacio desde los 40 días */}
      {(llamas > 0 || rayos > 0) && (
        <Animated.View pointerEvents="none" style={[capa, n >= 4 && { transform: [{ rotate: rotar }] }]}>
          <Svg width={total} height={total} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={`${id}f`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                <Stop offset={base / 50} stopColor={BLANCO} />
                <Stop offset={(base / 50 + 1) / 2} stopColor={ORO} />
                <Stop offset="1" stopColor={claro ? ORO : BRASA} />
              </RadialGradient>
              <RadialGradient id={`${id}r`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                <Stop offset={base / 50} stopColor={claro ? '#FFFFFF' : BLANCO} stopOpacity={0.95} />
                <Stop offset="1" stopColor={ORO} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {Array.from({ length: rayos }, (_, i) => {
              const a = (i / rayos) * Math.PI * 2;
              const d = 0.07 - (i % 2) * 0.03;
              const largo = i % 2 ? base + (49 - base) * 0.6 : 49;
              return <Path key={`r${i}`} d={`M${p(base, a - d)}L${p(largo, a)}L${p(base, a + d)}Z`} fill={`url(#${id}r)`} />;
            })}
            {Array.from({ length: llamas }, (_, i) => {
              const a = (i / llamas) * Math.PI * 2 + (rayos ? Math.PI / llamas : 0);
              const d = (Math.PI / llamas) * 0.62;
              const h = altoLlama * (i % 2 ? 0.7 : 1);
              const punta = a + (i % 3 === 0 ? 0.08 : -0.05);
              return (
                <Path
                  key={`l${i}`}
                  d={`M${p(base, a - d)}Q${p(base + h * 0.5, a - d * 1.15)} ${p(base + h, punta)}Q${p(base + h * 0.5, a + d * 1.15)} ${p(base, a + d)}Z`}
                  fill={`url(#${id}f)`}
                />
              );
            })}
          </Svg>
        </Animated.View>
      )}

      {/* El aro */}
      <View pointerEvents="none" style={capa}>
        <Svg width={total} height={total} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
              {anillo.map((c, i) => (
                <Stop key={i} offset={i / (anillo.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Circle cx={50} cy={50} r={rr} fill="none" stroke={`url(#${id}a)`} strokeWidth={ancho} />
          {n >= 6 && <Circle cx={50} cy={50} r={rr + ancho / 2 + 0.8} fill="none" stroke={claro ? ORO_HONDO : BLANCO} strokeWidth={Math.max(0.8, ancho * 0.25)} strokeOpacity={0.9} />}
        </Svg>
      </View>

      {/* Fondo liso bajo la foto: las iniciales no tienen fondo y la luz se vería a través */}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }}>{children}</View>

      {n >= 5 && size >= 30 && (
        <View
          pointerEvents="none"
          style={[styles.insignia, { width: chico, height: chico, borderRadius: chico / 2, backgroundColor: claro ? '#FFFFFF' : n >= 6 ? ORO_HONDO : ORO, borderColor: colors.surface }]}
        >
          <Svg width={chico * 0.66} height={chico * 0.66} viewBox="0 0 24 24">
            {n === 5 && (
              <Path
                d="M12 21c-3.8 0-6.5-2.7-6.5-6.3 0-2.5 1.4-4.3 2.9-5.9.3 1.5.9 2.6 1.9 3.2-.2-3.4 1.1-6.2 3.6-8.5.3 2.8 1.6 4.6 3 6.2 1 1.2 1.6 2.6 1.6 4.3 0 4-2.7 7-6.5 7z"
                fill={BLANCO}
              />
            )}
            {n === 6 && <Path d="M3 18.5h18l-1.6-10-4.6 4.2L12 5.5l-2.8 7.2-4.6-4.2z" fill={BLANCO} />}
            {claro && (
              <>
                <Circle cx={12} cy={12} r={9} fill={ORO} />
                <Path d="M10.5 6h3v4h4v3h-4v5h-3v-5h-4v-3h4z" fill="#FFFFFF" />
              </>
            )}
          </Svg>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  insignia: { position: 'absolute', right: -4, bottom: -4, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
