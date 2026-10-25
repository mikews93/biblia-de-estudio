// La pantalla del servicio (src/lib/servicio.ts): un cielo de noche que se llena de estrellas, más mientras más se
// ha servido. En el centro, el dibujo del nivel (la toalla, los talentos, el cayado, las manos que dan, las estrellas)
// con una corona de estrellas que gira. Desde el cuarto nivel cruzan estrellas fugaces y, en el último, la cuenta
// sube con un destello. Es la pareja del resplandor de la racha (components/Resplandor.tsx): aquel es fuego, este es
// luz de estrellas. Con «reducir movimiento» queda quieta.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import type { Cuenta, Nivel } from '@/lib/servicio';
import { serif } from '@/lib/theme';

const native = Platform.OS !== 'web';
// Colores propios del cielo: no cambian con el tema.
const NOCHE = '#0D0E13';
const ORO = '#F2C46A';
const PLATA = '#E9ECF5';
const BLANCO = '#FFF8E6';

type Props = { nivel: Nivel; cuenta: Cuenta & { total: number }; onClose: () => void };

export default function Lucero({ nivel, cuenta, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const [quieto, setQuieto] = useState(false);
  const entra = useRef(new Animated.Value(0)).current;
  const giro = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(0)).current;
  const brillo = useRef([0, 1, 2].map(() => new Animated.Value(0.5))).current;
  const destello = useRef(new Animated.Value(0)).current;
  const contar = useRef(new Animated.Value(0)).current;
  const n = nivel.nivel;
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
          contar.setValue(cuenta.total);
          return;
        }
        const t = (v: Animated.Value, toValue: number, duration: number, easing = Easing.out(Easing.cubic)) =>
          Animated.timing(v, { toValue, duration, easing, useNativeDriver: native });
        t(entra, 1, 1200).start();
        Animated.timing(contar, { toValue: cuenta.total, duration: 1800, easing: Easing.out(Easing.exp), useNativeDriver: false }).start();
        if (n >= 5) Animated.sequence([Animated.delay(500), t(destello, 0.85, 220), t(destello, 0, 1800, Easing.out(Easing.quad))]).start();
        Animated.loop(t(giro, 1, 90_000 / (1 + n * 0.3), Easing.linear)).start();
        Animated.loop(Animated.sequence([t(pulso, 1, 2200, Easing.inOut(Easing.sin)), t(pulso, 0, 2200, Easing.inOut(Easing.sin))])).start();
        // Tres capas de estrellas que titilan a destiempo (una animación por capa, no por estrella).
        brillo.forEach((b, i) =>
          Animated.loop(
            Animated.sequence([
              Animated.delay(i * 700),
              t(b, 1, 1300 + i * 400, Easing.inOut(Easing.sin)),
              t(b, 0.25, 1300 + i * 400, Easing.inOut(Easing.sin)),
            ]),
          ).start(),
        );
      });
    return () => {
      vivo = false;
    };
  }, [entra, giro, pulso, brillo, destello, contar, n, cuenta.total]);

  const rotar = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const latido = pulso.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] });
  const halo = lado * (0.8 + n * 0.12);
  const corona = Math.min(260, lado * 0.62);

  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={`${nivel.titulo}. Toca para cerrar`}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: NOCHE, opacity: entra.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]}
        />

        {/* El cielo: más estrellas con cada nivel */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: entra }]} pointerEvents="none">
          {brillo.map((b, i) => (
            <Animated.View key={i} style={[StyleSheet.absoluteFill, { opacity: quieto ? 0.8 : b }]}>
              <Cielo capa={i} cuantas={Math.round((24 + n * 26) / 3)} ancho={width} alto={height} />
            </Animated.View>
          ))}
        </Animated.View>
        {n >= 4 && !quieto && <Fugaces ancho={width} alto={height} cuantas={n >= 5 ? 4 : 2} />}

        <View style={styles.centro} pointerEvents="none">
          <Animated.View style={{ position: 'absolute', opacity: entra, transform: [{ scale: Animated.multiply(entra, latido) }] }}>
            <Svg width={halo} height={halo} viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="cielo" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={BLANCO} stopOpacity={0.45 + n * 0.08} />
                  <Stop offset="0.3" stopColor={ORO} stopOpacity={0.18 + n * 0.05} />
                  <Stop offset="0.65" stopColor="#7C86B8" stopOpacity={0.08 + n * 0.02} />
                  <Stop offset="1" stopColor="#7C86B8" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={50} cy={50} r={50} fill="url(#cielo)" />
            </Svg>
          </Animated.View>

          {/* La corona de estrellas: una estrella más por nivel en cada vuelta */}
          <Animated.View style={{ position: 'absolute', opacity: entra, transform: [{ rotate: rotar }] }}>
            <Corona lado={corona} cuantas={4 + n * 4} />
          </Animated.View>

          <Animated.View style={{ opacity: entra, transform: [{ scale: latido }] }}>
            <Centro tipo={nivel.centro} size={Math.min(150, lado * 0.36)} />
          </Animated.View>
        </View>

        <Animated.View
          style={[styles.textos, { opacity: entra, transform: [{ translateY: entra.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}
          pointerEvents="none"
        >
          <Cifra valor={contar} />
          <Text style={styles.kicker}>VECES SIRVIENDO</Text>
          <Text style={styles.titulo}>{nivel.titulo}</Text>
          <Text style={styles.verso}>«{nivel.versiculo.texto}»</Text>
          <Text style={styles.ref}>{nivel.versiculo.ref}</Text>
          <Text style={styles.desglose}>{desglose(cuenta)}</Text>
          <Text style={styles.cerrar}>Toca para seguir</Text>
        </Animated.View>

        {n >= 5 && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: BLANCO, opacity: destello }]} />}
      </Pressable>
    </Modal>
  );
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** «34 estudios profundos · 5 mensajes · 12 veces guiando», sin lo que está en cero. */
export const desglose = (c: Cuenta) =>
  [
    c.profundos ? plural(c.profundos, 'estudio profundo', 'estudios profundos') : '',
    c.escritos ? plural(c.escritos, 'mensaje preparado', 'mensajes preparados') : '',
    c.guiados ? plural(c.guiados, 'vez guiando', 'veces guiando') : '',
  ]
    .filter(Boolean)
    .join(' · ');

function Cifra({ valor }: { valor: Animated.Value }) {
  const [numero, setNumero] = useState(0);
  useEffect(() => {
    const id = valor.addListener(({ value }) => setNumero(Math.round(value)));
    return () => valor.removeListener(id);
  }, [valor]);
  return <Text style={styles.cifra}>{numero}</Text>;
}

/** Una capa del cielo: estrellas fijas en lugares que no cambian entre una vez y otra. */
function Cielo({ capa, cuantas, ancho, alto }: { capa: number; cuantas: number; ancho: number; alto: number }) {
  const estrellas = useMemo(
    () =>
      Array.from({ length: cuantas }, (_, i) => {
        const k = i * 3 + capa;
        return { x: ((k * 7919) % 1000) / 10, y: ((k * 6271) % 1000) / 10, r: 0.12 + ((k * 37) % 10) / 40, oro: k % 5 === 0 };
      }),
    [capa, cuantas],
  );
  return (
    <Svg width={ancho} height={alto} viewBox="0 0 100 100" preserveAspectRatio="none">
      {estrellas.map((e, i) => (
        <Circle key={i} cx={e.x} cy={e.y} r={e.r} fill={e.oro ? ORO : PLATA} />
      ))}
    </Svg>
  );
}

const ESTRELLA = (cx: number, cy: number, r: number) => {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    p.push(`${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${p.join('L')}Z`;
};

function Corona({ lado, cuantas }: { lado: number; cuantas: number }) {
  return (
    <Svg width={lado} height={lado} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={44} fill="none" stroke={ORO} strokeOpacity={0.25} strokeWidth={0.6} />
      {Array.from({ length: cuantas }, (_, i) => {
        const a = (i / cuantas) * Math.PI * 2;
        const grande = i % 2 === 0;
        return <Path key={i} d={ESTRELLA(50 + Math.cos(a) * 44, 50 + Math.sin(a) * 44, grande ? 3.2 : 2)} fill={grande ? ORO : PLATA} />;
      })}
    </Svg>
  );
}

/** Estrellas fugaces que cruzan el cielo, cada una a su tiempo. */
function Fugaces({ ancho, alto, cuantas }: { ancho: number; alto: number; cuantas: number }) {
  const fugaces = useMemo(
    () =>
      Array.from({ length: cuantas }, (_, i) => ({
        y: alto * (0.08 + i * 0.13),
        x: ancho * (0.15 + ((i * 37) % 50) / 100),
        delay: 900 + i * 1700,
        t: new Animated.Value(0),
      })),
    [cuantas, ancho, alto],
  );
  useEffect(() => {
    const loops = fugaces.map((f) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(f.delay),
          Animated.timing(f.t, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: native }),
          Animated.delay(4200),
          Animated.timing(f.t, { toValue: 0, duration: 0, useNativeDriver: native }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [fugaces]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {fugaces.map((f, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: f.x,
            top: f.y,
            width: 90,
            height: 2,
            borderRadius: 2,
            backgroundColor: PLATA,
            opacity: f.t.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.6, 0] }),
            transform: [{ rotate: '-28deg' }, { translateX: f.t.interpolate({ inputRange: [0, 1], outputRange: [0, ancho * 0.45] }) }],
          }}
        />
      ))}
    </View>
  );
}

function Centro({ tipo, size }: { tipo: Nivel['centro']; size: number }) {
  const trazo = { stroke: BLANCO, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {tipo === 'toalla' && (
        <>
          {/* El lebrillo con agua y la toalla: lavar los pies los unos a los otros */}
          <Path d="M10 52h80c-2 16-16 28-40 28S12 68 10 52z" fill={ORO} fillOpacity={0.35} {...{ stroke: BLANCO, strokeWidth: 3, strokeLinejoin: 'round' }} />
          <Path d="M20 60c6-3 10 3 16 0s10 3 16 0 10 3 16 0" {...trazo} strokeWidth={2.2} />
          {/* La toalla doblada sobre el borde, con flecos */}
          <Path d="M62 42h18v40l-4.5-3-4.5 3-4.5-3-4.5 3z" fill={ORO} fillOpacity={0.7} {...{ stroke: BLANCO, strokeWidth: 3, strokeLinejoin: 'round' }} />
          <Path d="M62 50h18M62 56h18" {...trazo} strokeWidth={2} />
        </>
      )}
      {tipo === 'talentos' && (
        <>
          {/* Los talentos multiplicados: tres montones de monedas que crecen */}
          {[
            [26, 3],
            [50, 5],
            [74, 7],
          ].map(([x, k]) =>
            Array.from({ length: k }, (_, i) => (
              <Path
                key={`${x}-${i}`}
                d={`M${x - 11} ${80 - i * 7}a11 4 0 0 0 22 0v-4a11 4 0 0 0-22 0z`}
                fill={i === k - 1 ? BLANCO : ORO}
                stroke={BLANCO}
                strokeWidth={1.4}
              />
            )),
          )}
        </>
      )}
      {tipo === 'cayado' && (
        <>
          {/* El cayado del pastor y una oveja */}
          <Path d="M40 90V34a14 14 0 1 1 28 0c0 6-4 9-9 9" {...trazo} strokeWidth={4} />
          <Path d="M58 74a8 8 0 0 1 10-7 8 8 0 0 1 13 2 8 8 0 0 1 7 12 8 8 0 0 1-6 12H62a8 8 0 0 1-5-14z" fill={BLANCO} />
          <Circle cx={56} cy={80} r={4} fill={ORO} />
        </>
      )}
      {tipo === 'manos' && (
        <>
          {/* Las manos abiertas que dan, con la luz que reciben para los otros */}
          <Path d={ESTRELLA(50, 26, 12)} fill={BLANCO} />
          <Path d="M50 84c-10 0-20-4-28-14l-6-14c-1-3 3-5 5-2l8 10V44c0-3 4-3 4 0v16" {...trazo} />
          <Path d="M50 84c10 0 20-4 28-14l6-14c1-3-3-5-5-2l-8 10V44c0-3-4-3-4 0v16" {...trazo} />
          <Path d="M33 52v-6c0-3 4-3 4 0v12M67 52v-6c0-3-4-3-4 0v12" {...trazo} strokeWidth={2.4} />
        </>
      )}
      {tipo === 'estrellas' && (
        <>
          {/* Como las estrellas a perpetua eternidad */}
          <Path d={ESTRELLA(50, 50, 30)} fill={BLANCO} />
          <Path d={ESTRELLA(50, 50, 17)} fill={ORO} />
          <Path d={ESTRELLA(16, 22, 6)} fill={ORO} />
          <Path d={ESTRELLA(84, 20, 5)} fill={PLATA} />
          <Path d={ESTRELLA(86, 82, 7)} fill={ORO} />
          <Path d={ESTRELLA(14, 80, 5)} fill={PLATA} />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  centro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: '30%' },
  textos: { position: 'absolute', left: 24, right: 24, bottom: '7%', alignItems: 'center', maxWidth: 520, alignSelf: 'center' },
  cifra: { color: ORO, fontFamily: serif, fontSize: 54, lineHeight: 60, fontWeight: '700', fontVariant: ['tabular-nums'] },
  kicker: { color: ORO, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  titulo: { color: BLANCO, fontFamily: serif, fontSize: 30, textAlign: 'center', marginTop: 8 },
  verso: { color: '#E4E1D6', fontFamily: serif, fontStyle: 'italic', fontSize: 17, lineHeight: 26, textAlign: 'center', marginTop: 12 },
  ref: { color: ORO, fontSize: 13, fontWeight: '700', marginTop: 8 },
  desglose: { color: '#B9BDCB', fontSize: 13, textAlign: 'center', marginTop: 14 },
  cerrar: { color: '#8E93A3', fontSize: 12, marginTop: 16 },
});
