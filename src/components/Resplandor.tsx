// El huevo de pascua de la racha devocional (src/lib/resplandor.ts): una luz que llena la pantalla, más intensa
// mientras más larga es la racha. Rayos que giran despacio, chispas que suben y, en el centro, el dibujo de la meta
// (la chispa, la llama, el corazón que arde, el rostro de Moisés, la zarza, la gloria). Con «reducir movimiento»,
// la luz queda quieta.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

import type { Resplandor as Nivel } from '@/lib/resplandor';
import { diasLabel } from '@/lib/rachaTexto';
import { serif } from '@/lib/theme';

const native = Platform.OS !== 'web';
// Colores propios de la luz: no cambian con el tema (es de noche y arde).
const NOCHE = '#120D0B';
const ORO = '#F2B45A';
const BRASA = '#E07B2E';
const BLANCO = '#FFF6DE';

type Props = { nivel: Nivel; dias: number; onClose: () => void };

export default function Resplandor({ nivel, dias, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const [quieto, setQuieto] = useState(false);
  const entra = useRef(new Animated.Value(0)).current;
  const giro = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(0)).current;
  const destello = useRef(new Animated.Value(0)).current;
  const n = nivel.intensidad;
  const lado = Math.min(width, height);

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reducir) => {
        if (!vivo) return;
        setQuieto(reducir);
        if (reducir) {
          entra.setValue(1);
          pulso.setValue(0.5);
          return;
        }
        Animated.timing(entra, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
        // Desde los 40 días, un destello de luz al abrirse (el rostro que resplandece).
        if (n >= 4) {
          Animated.sequence([
            Animated.timing(destello, { toValue: 1, duration: 260, useNativeDriver: native }),
            Animated.timing(destello, { toValue: 0, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: native }),
          ]).start();
        }
        Animated.loop(Animated.timing(giro, { toValue: 1, duration: 60_000 / (1 + n * 0.25), easing: Easing.linear, useNativeDriver: native })).start();
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulso, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
            Animated.timing(pulso, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
          ]),
        ).start();
      });
    return () => {
      vivo = false;
    };
  }, [entra, giro, pulso, destello, n]);

  const luz = lado * (0.7 + n * 0.12);
  const rotar = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const latido = pulso.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });

  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={`${nivel.titulo}. Toca para cerrar`}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: NOCHE, opacity: entra.interpolate({ inputRange: [0, 1], outputRange: [0, 0.97] }) }]} />

        <View style={styles.centro} pointerEvents="none">
          {/* El halo */}
          <Animated.View style={{ position: 'absolute', opacity: entra, transform: [{ scale: Animated.multiply(entra, latido) }] }}>
            <Svg width={luz} height={luz} viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="halo" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={BLANCO} stopOpacity={0.55 + n * 0.07} />
                  <Stop offset="0.25" stopColor={ORO} stopOpacity={0.35 + n * 0.06} />
                  <Stop offset="0.6" stopColor={BRASA} stopOpacity={0.12 + n * 0.03} />
                  <Stop offset="1" stopColor={BRASA} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={50} cy={50} r={50} fill="url(#halo)" />
            </Svg>
          </Animated.View>

          {/* Los rayos: más y más largos con la racha */}
          {n >= 2 && (
            <Animated.View style={{ position: 'absolute', opacity: entra, transform: [{ rotate: rotar }] }}>
              <Rayos lado={luz * 1.15} cuantos={6 + n * 4} intensidad={n} />
            </Animated.View>
          )}

          {!quieto && <Chispas cuantas={4 + n * 5} ancho={width} alto={height} intensidad={n} />}

          {/* El dibujo de la meta */}
          <Animated.View style={{ opacity: entra, transform: [{ scale: latido }] }}>
            <Centro tipo={nivel.centro} size={Math.min(150, lado * 0.36)} />
          </Animated.View>
        </View>

        <Animated.View
          style={[styles.textos, { opacity: entra, transform: [{ translateY: entra.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}
          pointerEvents="none"
        >
          <Text style={styles.kicker}>{diasLabel(dias).toUpperCase()} SEGUIDOS</Text>
          <Text style={styles.titulo}>{nivel.titulo}</Text>
          <Text style={styles.verso}>«{nivel.versiculo.texto}»</Text>
          <Text style={styles.ref}>{nivel.versiculo.ref}</Text>
          <Text style={styles.cerrar}>Toca para seguir</Text>
        </Animated.View>

        {n >= 4 && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: BLANCO, opacity: destello }]} />}
      </Pressable>
    </Modal>
  );
}

function Rayos({ lado, cuantos, intensidad }: { lado: number; cuantos: number; intensidad: number }) {
  const largo = 30 + intensidad * 3;
  return (
    <Svg width={lado} height={lado} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="rayo" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0.15" stopColor={BLANCO} stopOpacity={0.5} />
          <Stop offset="1" stopColor={ORO} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G>
        {Array.from({ length: cuantos }, (_, i) => {
          const a = (i / cuantos) * Math.PI * 2;
          const ancho = (i % 2 ? 0.035 : 0.06) * (1 + intensidad * 0.08);
          const r = i % 2 ? largo * 0.75 : largo + 12;
          const p = (ang: number, rr: number) => `${(50 + Math.cos(ang) * rr).toFixed(2)} ${(50 + Math.sin(ang) * rr).toFixed(2)}`;
          return <Path key={i} d={`M${p(a - ancho, 8)} L${p(a, r)} L${p(a + ancho, 8)} Z`} fill="url(#rayo)" />;
        })}
      </G>
    </Svg>
  );
}

/** Chispas que suben desde abajo y se apagan, cada una a su ritmo. */
function Chispas({ cuantas, ancho, alto, intensidad }: { cuantas: number; ancho: number; alto: number; intensidad: number }) {
  const chispas = useMemo(
    () =>
      Array.from({ length: cuantas }, (_, i) => ({
        x: ((i * 37) % 100) / 100,
        size: 3 + ((i * 13) % 5) + intensidad * 0.4,
        dur: 2600 + ((i * 557) % 2400),
        delay: (i * 233) % 2200,
        deriva: (((i * 71) % 40) - 20) * 1.5,
        t: new Animated.Value(0),
      })),
    [cuantas, intensidad],
  );
  useEffect(() => {
    const loops = chispas.map((c) =>
      Animated.loop(Animated.sequence([Animated.delay(c.delay), Animated.timing(c.t, { toValue: 1, duration: c.dur, easing: Easing.out(Easing.quad), useNativeDriver: native })])),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [chispas]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {chispas.map((c, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: c.x * ancho,
            top: alto * 0.78,
            width: c.size,
            height: c.size,
            borderRadius: c.size,
            backgroundColor: i % 3 ? ORO : BLANCO,
            opacity: c.t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 0.6, 0] }),
            transform: [
              { translateY: c.t.interpolate({ inputRange: [0, 1], outputRange: [0, -alto * (0.45 + intensidad * 0.05)] }) },
              { translateX: c.t.interpolate({ inputRange: [0, 1], outputRange: [0, c.deriva] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const LLAMA = 'M50 92c-17 0-29-12-29-28 0-11 6-19 13-26 1 7 4 12 9 15-1-15 5-28 16-38 1 12 7 20 13 28 5 6 7 12 7 20 0 17-12 29-29 29z';
const LLAMA_DENTRO = 'M50 92c-7 0-12-5-12-12 0-6 4-11 9-15 1 4 4 7 7 8 2-3 3-7 2-11 6 4 10 10 10 18 0 7-6 12-16 12z';

/** El dibujo del centro, en luz: línea blanca cálida sobre el resplandor. */
// Los rayos que salen de la cabeza de Moisés (Éxodo 34:29), en abanico por arriba.
const RAYOS_ROSTRO = [-165, -140, -115, -90, -65, -40, -15].map((g, i) => {
  const a = (g * Math.PI) / 180;
  const r1 = 18;
  const r2 = i % 2 ? 25 : 30;
  const p = (r: number) => `${(50 + r * Math.cos(a)).toFixed(1)} ${(34 + r * Math.sin(a)).toFixed(1)}`;
  return `M${p(r1)}L${p(r2)}`;
});

function Centro({ tipo, size }: { tipo: Nivel['centro']; size: number }) {
  const trazo = { stroke: BLANCO, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {tipo === 'chispa' && <Path d="M50 18c3 20 10 27 30 32-20 3-27 10-30 32-3-22-10-29-30-32 20-5 27-12 30-32z" fill={BLANCO} />}
      {tipo === 'llama' && (
        <>
          <Path d={LLAMA} fill={ORO} />
          <Path d={LLAMA_DENTRO} fill={BLANCO} />
        </>
      )}
      {tipo === 'corazon' && (
        <>
          <Path d="M50 86S16 66 16 41a17 17 0 0 1 34-8 17 17 0 0 1 34 8c0 25-34 45-34 45z" fill={BRASA} fillOpacity={0.5} {...{ stroke: BLANCO, strokeWidth: 3 }} />
          <Path d="M50 72c-7 0-11-4-11-10 0-5 3-8 7-12 1 3 3 5 5 6 1-3 2-6 1-9 5 3 9 8 9 14 0 7-4 11-11 11z" fill={BLANCO} />
        </>
      )}
      {tipo === 'rostro' && (
        <>
          {/* Moisés bajando del monte: el rostro que resplandece, con las dos tablas en los brazos */}
          {RAYOS_ROSTRO.map((d, i) => (
            <Path key={i} d={d} {...trazo} strokeWidth={i % 2 ? 2 : 3} />
          ))}
          <Path d="M22 94c0-22 12-37 28-37s28 15 28 37z" fill={BRASA} />
          <Circle cx={50} cy={34} r={12.5} fill={BLANCO} />
          <Path d="M31 92V68a8.5 8.5 0 0 1 17 0v24zM52 92V68a8.5 8.5 0 0 1 17 0v24z" fill={BLANCO} />
          <Path d="M35 70h9M35 76h9M35 82h9M56 70h9M56 76h9M56 82h9" stroke={ORO} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
      {tipo === 'zarza' && (
        <>
          <Path d={LLAMA} fill={BRASA} transform="translate(-14 -6) scale(0.8)" />
          <Path d={LLAMA} fill={ORO} transform="translate(22 -4) scale(0.72)" />
          <Path d={LLAMA} fill={ORO} transform="translate(5 -12) scale(0.95)" />
          <Path d={LLAMA_DENTRO} fill={BLANCO} transform="translate(5 -12) scale(0.95)" />
          <Path d="M50 92V74M50 82l-10-8M50 78l11-9M38 92h24" {...trazo} />
        </>
      )}
      {tipo === 'gloria' && (
        <>
          <Path d="M22 88V52L50 30l28 22v36z" {...trazo} />
          <Path d="M42 88V68h16v20" {...trazo} />
          <Path d="M50 12v10M30 18l5 8M70 18l-5 8M18 34l8 4M82 34l-8 4" {...trazo} strokeWidth={2.4} />
          <Circle cx={50} cy={52} r={6} fill={BLANCO} />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  centro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: '28%' },
  textos: { position: 'absolute', left: 24, right: 24, bottom: '9%', alignItems: 'center', maxWidth: 520, alignSelf: 'center' },
  kicker: { color: ORO, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  titulo: { color: BLANCO, fontFamily: serif, fontSize: 30, textAlign: 'center', marginTop: 8 },
  verso: { color: '#F3E6CF', fontFamily: serif, fontStyle: 'italic', fontSize: 17, lineHeight: 26, textAlign: 'center', marginTop: 14 },
  ref: { color: ORO, fontSize: 13, fontWeight: '700', marginTop: 8 },
  cerrar: { color: '#BBA88C', fontSize: 12, marginTop: 22 },
});
