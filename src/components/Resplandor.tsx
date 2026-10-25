// El huevo de pascua de la racha devocional (src/lib/resplandor.ts): una luz que llena la pantalla, más intensa
// mientras más larga es la racha. Rayos que giran despacio, chispas que suben y, en el centro, el dibujo de la meta
// (la chispa, la llama, el corazón que arde, el rostro de Moisés, la zarza, la gloria, la cruz). Al año, el fuego
// baja del cielo, estalla y cuenta los días; a los siete años la noche se vuelve luz blanca. Con «reducir
// movimiento», la luz queda quieta.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import type { Resplandor as Nivel } from '@/lib/resplandor';
import { diasLabel } from '@/lib/rachaTexto';
import { serif } from '@/lib/theme';

const native = Platform.OS !== 'web';
// Colores propios de la luz: no cambian con el tema (es de noche y arde).
const NOCHE = '#120D0B';
const ORO = '#F2B45A';
const BRASA = '#E07B2E';
const BLANCO = '#FFF6DE';

// La pantalla de luz clara de la meta casi inalcanzable (la estatura de Cristo): de la noche a la luz blanca.
const LUZ = '#FFF8EA';
const TINTA = '#3B2A12';
const ORO_HONDO = '#B97A1E';

type Props = { nivel: Nivel; dias: number; onClose: () => void };

export default function Resplandor({ nivel, dias, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const [quieto, setQuieto] = useState(false);
  const entra = useRef(new Animated.Value(0)).current;
  const giro = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(0)).current;
  const destello = useRef(new Animated.Value(0)).current;
  // Solo en las metas grandes (un año y siete años): el fuego que cae, la onda al llegar, la cuenta y el amanecer.
  const caida = useRef(new Animated.Value(0)).current;
  const onda = useRef(new Animated.Value(0)).current;
  const cuenta = useRef(new Animated.Value(0)).current;
  const letras = useRef(new Animated.Value(0)).current;
  const amanece = useRef(new Animated.Value(0)).current;
  const n = nivel.intensidad;
  const grande = n >= 6;
  const claro = n >= 7;
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
          letras.setValue(1);
          cuenta.setValue(dias);
          amanece.setValue(claro ? 1 : 0);
          return;
        }
        const t = (v: Animated.Value, toValue: number, duration: number, easing = Easing.out(Easing.cubic)) =>
          Animated.timing(v, { toValue, duration, easing, useNativeDriver: native });
        // La cuenta va por el hilo de JS (cambia un texto), nunca por el nativo.
        const contar = Animated.timing(cuenta, { toValue: dias, duration: claro ? 2600 : 2000, easing: Easing.out(Easing.exp), useNativeDriver: false });
        const llegar = Animated.parallel([
          t(entra, 1, 900),
          // A los siete años, la noche se vuelve luz detrás del destello blanco (así no pasa por un gris).
          Animated.sequence([t(destello, 1, 200), Animated.delay(claro ? 500 : 0), t(destello, 0, claro ? 2000 : 1600, Easing.out(Easing.quad))]),
          t(onda, 1, 2200, Easing.out(Easing.quad)),
          // El color del texto cambia con el amanecer: va por JS (el hilo nativo no anima colores en todas partes).
          ...(claro ? [Animated.sequence([Animated.delay(220), Animated.timing(amanece, { toValue: 1, duration: 420, useNativeDriver: false })])] : []),
        ]);
        if (grande) {
          // Primero la oscuridad y el fuego (o la luz) que baja del cielo; al llegar al centro, estalla.
          Animated.sequence([
            Animated.delay(250),
            t(caida, 1, 1300, Easing.in(Easing.quad)),
            Animated.parallel([llegar, Animated.sequence([Animated.delay(300), contar]), Animated.sequence([Animated.delay(1700), t(letras, 1, 900)])]),
          ]).start();
        } else {
          llegar.start();
          letras.setValue(1);
          cuenta.setValue(dias);
        }
        Animated.loop(t(giro, 1, 60_000 / (1 + n * 0.25), Easing.linear)).start();
        Animated.loop(
          Animated.sequence([t(pulso, 1, 1600, Easing.inOut(Easing.sin)), t(pulso, 0, 1600, Easing.inOut(Easing.sin))]),
        ).start();
      });
    return () => {
      vivo = false;
    };
  }, [entra, giro, pulso, destello, caida, onda, cuenta, letras, amanece, n, dias, grande, claro]);

  const luz = lado * (0.7 + Math.min(n, 6) * 0.12 + (claro ? 0.3 : 0));
  const rotar = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const contrario = giro.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const latido = pulso.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const textoColor = (oscuro: string, enLuz: string) => (claro ? amanece.interpolate({ inputRange: [0, 1], outputRange: [oscuro, enLuz] }) : oscuro);
  const columna = Math.min(220, lado * 0.5);

  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={`${nivel.titulo}. Toca para cerrar`}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: NOCHE, opacity: grande ? 0.985 : entra.interpolate({ inputRange: [0, 1], outputRange: [0, 0.97] }) },
          ]}
        />
        {claro && <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: LUZ, opacity: amanece }]} />}

        <View style={styles.centro} pointerEvents="none">
          {/* El halo */}
          <Animated.View style={{ position: 'absolute', opacity: entra, transform: [{ scale: Animated.multiply(entra, latido) }] }}>
            <Svg width={luz} height={luz} viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="halo" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={claro ? '#FFFFFF' : BLANCO} stopOpacity={Math.min(1, 0.55 + n * 0.07)} />
                  <Stop offset="0.25" stopColor={ORO} stopOpacity={Math.min(0.85, 0.35 + n * 0.06)} />
                  <Stop offset="0.6" stopColor={claro ? ORO : BRASA} stopOpacity={0.12 + Math.min(n, 6) * 0.03} />
                  <Stop offset="1" stopColor={BRASA} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={50} cy={50} r={50} fill="url(#halo)" />
            </Svg>
          </Animated.View>

          {/* Las ondas de luz que salen al llegar el fuego (metas grandes) */}
          {grande &&
            [0, 0.18, 0.36].map((d, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  width: lado * 0.5,
                  height: lado * 0.5,
                  borderRadius: lado,
                  borderWidth: claro ? 3 : 2.5,
                  borderColor: i === 1 ? ORO : claro ? ORO_HONDO : BLANCO,
                  opacity: onda.interpolate({ inputRange: [0, d + 0.01, d + 0.15, 1], outputRange: [0, 0.95, 0.7, 0] }),
                  transform: [{ scale: onda.interpolate({ inputRange: [0, d, 1], outputRange: [0.2, 0.2, 3.4 - i * 0.5] }) }],
                }}
              />
            ))}

          {/* Los rayos: más y más largos con la racha; en las metas grandes, una segunda corona gira al revés */}
          {n >= 2 && (
            <Animated.View style={{ position: 'absolute', opacity: entra, transform: [{ rotate: rotar }] }}>
              <Rayos lado={luz * 1.15} cuantos={6 + Math.min(n, 6) * 4} intensidad={n} claro={claro} />
            </Animated.View>
          )}
          {grande && (
            <Animated.View style={{ position: 'absolute', opacity: entra, transform: [{ rotate: contrario }] }}>
              <Rayos lado={luz * 0.95} cuantos={claro ? 48 : 36} intensidad={n} claro={claro} finos />
            </Animated.View>
          )}

          {!quieto && <Chispas cuantas={4 + Math.min(n, 6) * 5 + (claro ? 20 : 0)} ancho={width} alto={height} intensidad={n} claro={claro} />}
          {grande && !quieto && <Estallido lado={lado} onda={onda} cuantas={claro ? 56 : 40} claro={claro} />}

          {/* El fuego que desciende de los cielos (2 Crónicas 7:1), o la luz en los siete años */}
          {grande && !quieto && (
            <Animated.View
              style={{
                position: 'absolute',
                width: columna,
                height: height * 0.75,
                opacity: Animated.subtract(1, onda.interpolate({ inputRange: [0, 0.12], outputRange: [0, 1], extrapolate: 'clamp' })),
                transform: [{ translateY: caida.interpolate({ inputRange: [0, 1], outputRange: [-height * 1.2, -height * 0.375] }) }],
              }}
            >
              <Svg width={columna} height={height * 0.75} viewBox="0 0 100 100" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="columna" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={claro ? BLANCO : BRASA} stopOpacity={0} />
                    <Stop offset="0.6" stopColor={claro ? ORO : BRASA} stopOpacity={0.6} />
                    <Stop offset="0.9" stopColor={ORO} stopOpacity={0.95} />
                    <Stop offset="1" stopColor={BLANCO} stopOpacity={1} />
                  </LinearGradient>
                </Defs>
                <Path d="M30 0h40l26 90c0 6-20 10-46 10S4 96 4 90z" fill="url(#columna)" fillOpacity={0.35} />
                <Path d="M38 0h24l14 92c0 5-12 8-26 8s-26-3-26-8z" fill="url(#columna)" />
                <Path d="M46 0h8l6 94c0 3-4 5-10 5s-10-2-10-5z" fill={BLANCO} fillOpacity={0.9} />
              </Svg>
            </Animated.View>
          )}

          {/* El dibujo de la meta */}
          <Animated.View style={{ opacity: entra, transform: [{ scale: grande ? Animated.multiply(latido, entra.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] })) : latido }] }}>
            <Centro tipo={nivel.centro} size={Math.min(grande ? 170 : 150, lado * (grande ? 0.42 : 0.36))} />
          </Animated.View>
        </View>

        <Animated.View
          style={[styles.textos, { opacity: entra, transform: [{ translateY: entra.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}
          pointerEvents="none"
        >
          {grande ? (
            <>
              <Cifra valor={cuenta} style={[styles.cifra, { color: textoColor(ORO, ORO_HONDO) }]} />
              <Animated.Text style={[styles.kicker, { color: textoColor(ORO, ORO_HONDO) }]}>
                {claro ? 'DÍAS SEGUIDOS · SIETE AÑOS' : 'DÍAS SEGUIDOS · UN AÑO'}
              </Animated.Text>
            </>
          ) : (
            <Text style={styles.kicker}>{diasLabel(dias).toUpperCase()} SEGUIDOS</Text>
          )}
          <Animated.View style={{ opacity: letras, alignItems: 'center', transform: [{ translateY: letras.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            <Animated.Text style={[styles.titulo, claro && { color: textoColor(BLANCO, TINTA) }]}>{nivel.titulo}</Animated.Text>
            <Animated.Text style={[styles.verso, claro && { color: textoColor('#F3E6CF', '#5A4320') }]}>«{nivel.versiculo.texto}»</Animated.Text>
            <Animated.Text style={[styles.ref, claro && { color: textoColor(ORO, ORO_HONDO) }]}>{nivel.versiculo.ref}</Animated.Text>
            <Animated.Text style={[styles.cerrar, claro && { color: textoColor('#BBA88C', '#8A7350') }]}>Toca para seguir</Animated.Text>
          </Animated.View>
        </Animated.View>

        {n >= 4 && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: claro ? '#FFFFFF' : BLANCO, opacity: destello }]} />}
      </Pressable>
    </Modal>
  );
}

/** La cuenta de los días, de 0 a la meta. Lleva su propio estado para no volver a dibujar toda la luz en cada número. */
function Cifra({ valor, style }: { valor: Animated.Value; style: object }) {
  const [numero, setNumero] = useState(0);
  useEffect(() => {
    const id = valor.addListener(({ value }) => setNumero(Math.round(value)));
    return () => valor.removeListener(id);
  }, [valor]);
  return <Animated.Text style={style}>{numero}</Animated.Text>;
}

function Rayos({ lado, cuantos, intensidad, claro, finos }: { lado: number; cuantos: number; intensidad: number; claro?: boolean; finos?: boolean }) {
  const largo = 30 + Math.min(intensidad, 6) * 3 + (claro ? 6 : 0);
  const id = finos ? 'rayoFino' : 'rayo';
  return (
    <Svg width={lado} height={lado} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0.15" stopColor={claro ? ORO_HONDO : BLANCO} stopOpacity={claro ? 0.55 : finos ? 0.35 : 0.5} />
          <Stop offset="1" stopColor={ORO} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G>
        {Array.from({ length: cuantos }, (_, i) => {
          const a = (i / cuantos) * Math.PI * 2 + (finos ? Math.PI / cuantos : 0);
          const ancho = (finos ? 0.012 : i % 2 ? 0.035 : 0.06) * (1 + Math.min(intensidad, 6) * 0.08);
          const r = finos ? largo * (i % 3 ? 0.7 : 0.95) : i % 2 ? largo * 0.75 : largo + 12;
          const p = (ang: number, rr: number) => `${(50 + Math.cos(ang) * rr).toFixed(2)} ${(50 + Math.sin(ang) * rr).toFixed(2)}`;
          return <Path key={i} d={`M${p(a - ancho, 8)} L${p(a, r)} L${p(a + ancho, 8)} Z`} fill={`url(#${id})`} />;
        })}
      </G>
    </Svg>
  );
}

/** Chispas que suben desde abajo y se apagan, cada una a su ritmo. */
function Chispas({ cuantas, ancho, alto, intensidad, claro }: { cuantas: number; ancho: number; alto: number; intensidad: number; claro?: boolean }) {
  const chispas = useMemo(
    () =>
      Array.from({ length: cuantas }, (_, i) => ({
        x: ((i * 37) % 100) / 100,
        size: 3 + ((i * 13) % 5) + Math.min(intensidad, 6) * 0.4,
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
            backgroundColor: claro ? (i % 3 ? ORO : ORO_HONDO) : i % 3 ? ORO : BLANCO,
            opacity: c.t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 0.6, 0] }),
            transform: [
              { translateY: c.t.interpolate({ inputRange: [0, 1], outputRange: [0, -alto * (0.45 + Math.min(intensidad, 6) * 0.05)] }) },
              { translateX: c.t.interpolate({ inputRange: [0, 1], outputRange: [0, c.deriva] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** Al llegar el fuego al centro, brasas que salen disparadas hacia todos lados y caen despacio. */
function Estallido({ lado, onda, cuantas, claro }: { lado: number; onda: Animated.Value; cuantas: number; claro?: boolean }) {
  const brasas = useMemo(
    () =>
      Array.from({ length: cuantas }, (_, i) => {
        const a = (i / cuantas) * Math.PI * 2 + ((i * 53) % 10) / 20;
        const lejos = lado * (0.32 + ((i * 29) % 30) / 60);
        return { x: Math.cos(a) * lejos, y: Math.sin(a) * lejos, size: 3 + ((i * 7) % 5), color: i % 4 === 0 ? BLANCO : i % 3 ? ORO : claro ? ORO_HONDO : BRASA };
      }),
    [cuantas, lado, claro],
  );
  return (
    <>
      {brasas.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: b.size,
            height: b.size,
            borderRadius: b.size,
            backgroundColor: b.color,
            opacity: onda.interpolate({ inputRange: [0, 0.02, 0.55, 1], outputRange: [0, 1, 0.8, 0] }),
            transform: [
              { translateX: onda.interpolate({ inputRange: [0, 1], outputRange: [0, b.x] }) },
              { translateY: onda.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, b.y, b.y + lado * 0.12] }) },
            ],
          }}
        />
      ))}
    </>
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
      {tipo === 'cristo' && (
        <>
          {/* La plenitud de Cristo: la cruz dentro de un sol, con doce rayos */}
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const p = (r: number) => `${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`;
            return <Path key={i} d={`M${p(38)}L${p(i % 2 ? 44 : 48)}`} stroke={ORO_HONDO} strokeWidth={3} strokeLinecap="round" />;
          })}
          <Circle cx={50} cy={50} r={33} fill="#FFFFFF" stroke={ORO} strokeWidth={3} />
          <Circle cx={50} cy={50} r={27} fill="none" stroke={ORO} strokeWidth={1.2} strokeOpacity={0.7} />
          <Path d="M45 26h10v14h12v10H55v24H45V50H33V40h12z" fill={ORO_HONDO} />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  centro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: '28%' },
  textos: { position: 'absolute', left: 24, right: 24, bottom: '9%', alignItems: 'center', maxWidth: 520, alignSelf: 'center' },
  kicker: { color: ORO, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  cifra: { fontFamily: serif, fontSize: 64, lineHeight: 70, fontWeight: '700', fontVariant: ['tabular-nums'] },
  titulo: { color: BLANCO, fontFamily: serif, fontSize: 30, textAlign: 'center', marginTop: 8 },
  verso: { color: '#F3E6CF', fontFamily: serif, fontStyle: 'italic', fontSize: 17, lineHeight: 26, textAlign: 'center', marginTop: 14 },
  ref: { color: ORO, fontSize: 13, fontWeight: '700', marginTop: 8 },
  cerrar: { color: '#BBA88C', fontSize: 12, marginTop: 22 },
});
