import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

// Al abrir la app en el teléfono: la pantalla de arranque nativa (expo-splash-screen, assets/splash-icon.png)
// es una imagen quieta, así que en cuanto se va dibujamos la misma llama, en el mismo sitio y sobre el mismo
// fondo, y la dejamos arder un momento antes de fundirse con la primera pantalla. En la web lo hace la
// portada de public/index.html. Los trazos salen de assets/icono/llama.svg.

const FONDO = '#120D0B';
const LADO = 200; // imageWidth de expo-splash-screen en app.json
const ARDE = 1100; // lo que se queda a la vista antes de fundirse (ms)

// Curvas de las hojas (desde la base, 512 800) y la silueta de cada lengua.
const IZQ = [
  '152 791 -164 619',
  '156 744 -135 532',
  '167 698 -94 450',
  '183 654 -43 374',
  '205 612 17 305',
  '232 573 86 245',
  '264 539 162 194',
  '300 509 244 153',
  '340 484 331 124',
  '383 464 421 106',
];
const DER = [
  '641 464 603 106',
  '684 484 693 124',
  '724 509 780 153',
  '760 539 862 194',
  '792 573 938 245',
  '819 612 1007 305',
  '841 654 1067 374',
  '857 698 1118 450',
  '868 744 1159 532',
  '872 791 1188 619',
];
const SILUETA_IZQ = 'M500 800 C 372 786 292 704 292 584 C 292 466 380 398 430 280 C 468 360 500 432 500 510 Z';
const SILUETA_DER = 'M524 800 C 652 786 732 704 732 584 C 732 432 640 340 600 176 C 556 300 524 400 524 510 Z';

function Lengua({ hojas, silueta, id }: { hojas: string[]; silueta: string; id: string }) {
  return (
    <Svg width={LADO} height={LADO} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id={`${id}-f`} gradientUnits="userSpaceOnUse" x1="0" y1="800" x2="0" y2="180">
          <Stop offset="0" stopColor="#B83A12" />
          <Stop offset="0.45" stopColor="#F08A2C" />
          <Stop offset="0.85" stopColor="#FFD27A" />
          <Stop offset="1" stopColor="#FFF1C9" />
        </LinearGradient>
        <ClipPath id={`${id}-c`}>
          <Path d={silueta} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id}-c)`}>
        {hojas.map((q) => (
          <Path
            key={q}
            d={`M512 800 Q ${q}`}
            stroke={`url(#${id}-f)`}
            strokeWidth={18}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </G>
    </Svg>
  );
}

/** Chisporroteo: saltos cortos y desiguales entre valores de 0 a 1, sin fin (el fuego no oscila parejo). */
function chisporroteo(v: Animated.Value, pasos: number[], ms: number, retraso = 0) {
  const tirones = pasos.map((a, i) =>
    Animated.timing(v, {
      toValue: a,
      duration: ms * (0.7 + ((i * 37) % 7) / 10),
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }),
  );
  return Animated.sequence([Animated.delay(retraso), Animated.loop(Animated.sequence(tirones))]);
}

export default function LlamaArranque() {
  const [visible, setVisible] = useState(true);
  const [izq] = useState(() => new Animated.Value(0.5));
  const [der] = useState(() => new Animated.Value(0.5));
  const [brillo] = useState(() => new Animated.Value(0));
  const [opacidad] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let fuego: Animated.CompositeAnimation | undefined;
    let salida: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((quieta) => {
        if (!quieta) {
          fuego = Animated.parallel([
            chisporroteo(izq, [0.1, 0.45, 0.95, 0.3, 0.8, 0.05, 0.6, 0.5], 375),
            chisporroteo(der, [0.9, 0.35, 0.05, 0.7, 0.15, 1, 0.4, 0.5], 345, 60),
            chisporroteo(brillo, [0.8, 0.2, 1, 0.35, 0.9, 0.1, 0.6, 0], 285),
          ]);
          fuego.start();
        }
        salida = setTimeout(
          () =>
            Animated.timing(opacidad, {
              toValue: 0,
              duration: 280,
              useNativeDriver: true,
            }).start(() => {
              fuego?.stop();
              setVisible(false);
            }),
          quieta ? 150 : ARDE,
        );
      });
    return () => {
      fuego?.stop();
      if (salida) clearTimeout(salida);
    };
  }, [izq, der, brillo, opacidad]);

  if (!visible) return null;

  // Cada lengua gira sobre la base del libro (512, 800 de 1024) y se estira hacia arriba a tirones.
  const origen = { transformOrigin: `${LADO / 2}px ${(LADO * 800) / 1024}px` };
  const mece = (v: Animated.Value, a: [string, string], s: [number, number]) => ({
    transform: [
      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: a }) },
      { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: s }) },
    ],
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fondo, { opacity: opacidad }]}>
      <View style={styles.llama}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: brillo.interpolate({
                inputRange: [0, 1],
                outputRange: [0.45, 1],
              }),
              transform: [
                {
                  scale: brillo.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1.12],
                  }),
                },
              ],
            },
          ]}
        >
          <Svg width={LADO} height={LADO} viewBox="0 0 1024 1024">
            <Defs>
              <RadialGradient id="arranque-halo" cx="512" cy="560" r="340" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#F08A2C" stopOpacity={0.42} />
                <Stop offset="1" stopColor="#F08A2C" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="1024" height="1024" fill="url(#arranque-halo)" />
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, origen, mece(izq, ['-3.5deg', '3.4deg'], [0.92, 1.13])]}>
          <Lengua hojas={IZQ} silueta={SILUETA_IZQ} id="arranque-izq" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, origen, mece(der, ['-3.2deg', '3deg'], [1.15, 0.93])]}>
          <Lengua hojas={DER} silueta={SILUETA_DER} id="arranque-der" />
        </Animated.View>
        <Svg width={LADO} height={LADO} viewBox="0 0 1024 1024" style={StyleSheet.absoluteFill}>
          <Path
            d="M210 812 C 330 782 440 790 512 840 C 584 790 694 782 814 812"
            stroke="#FFF1D6"
            strokeWidth={30}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fondo: {
    backgroundColor: FONDO,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  llama: { width: LADO, height: LADO },
});
