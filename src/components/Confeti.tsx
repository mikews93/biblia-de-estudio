// Confeti que cae desde arriba o fuegos artificiales que se abren en lo alto, sobre toda la app y sin recibir
// toques. Los colores salen del tema (el ámbar, el dorado y los tonos suaves), así se ven bien en claro, sepia y
// oscuro. Con «reducir movimiento» no se dibuja nada. Se lanza con lanzarConfeti (src/lib/confeti.ts).
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { alLanzar, type Lanzamiento } from '@/lib/confeti';
import { isDark, useColors, type Colors } from '@/lib/theme';

const NATIVO = Platform.OS !== 'web';

export default function Confeti() {
  const [activos, setActivos] = useState<Lanzamiento[]>([]);
  useEffect(
    () =>
      alLanzar((l) => {
        AccessibilityInfo.isReduceMotionEnabled()
          .catch(() => false)
          .then((reduce) => {
            if (!reduce) setActivos((a) => [...a, l]);
          });
      }),
    [],
  );
  if (!activos.length) return null;
  const quitar = (id: number) => setActivos((a) => a.filter((x) => x.id !== id));
  return (
    // overflow hidden: los papeles que salen por los lados o caen más abajo de la pantalla no deben ensanchar la
    // página. En el Chrome de Android eso agrandaba el área de la página y la app se veía alejada y descuadrada.
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 60, overflow: 'hidden' }]} testID="confeti">
      {activos.map((l) =>
        l.estilo === 'fuegos' ? <Fuegos key={l.id} onFin={() => quitar(l.id)} /> : <Lluvia key={l.id} onFin={() => quitar(l.id)} />,
      )}
    </View>
  );
}

/** Los tonos de la fiesta: el ámbar de los acentos, dorados y un toque del azul de las lenguas originales. */
function paleta(c: Colors) {
  return isDark(c)
    ? [c.warm, '#F2D28B', '#E8B98A', c.greek, '#F4EBDD', '#C98A4B']
    : [c.warm, '#D9A441', '#E7C27A', c.greek, '#C9772E', '#8C5A2B'];
}

const azar = (a: number, b: number) => a + Math.random() * (b - a);

// ——— Confeti ———

type Papel = { x: number; fin: number; vaiven: number; giro: number; ancho: number; alto: number; color: string; retraso: number; redondo: boolean };

function Lluvia({ onFin }: { onFin: () => void }) {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const [t] = useState(() => new Animated.Value(0));
  const [papeles] = useState<Papel[]>(() => {
    const tonos = paleta(colors);
    const n = Math.round(Math.min(90, Math.max(50, width / 7)));
    return Array.from({ length: n }, (_, i) => {
      const redondo = i % 5 === 0;
      const ancho = redondo ? azar(6, 8) : azar(5, 8);
      return {
        x: azar(-0.05, 1.05) * width,
        fin: azar(0.65, 1.08) * height,
        vaiven: azar(14, 42) * (i % 2 ? 1 : -1),
        giro: azar(360, 1080) * (i % 3 ? 1 : -1),
        ancho,
        alto: redondo ? ancho : azar(9, 14),
        color: tonos[i % tonos.length],
        retraso: azar(0, 0.22),
        redondo,
      };
    });
  });

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: NATIVO }).start(onFin);
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {papeles.map((p, i) => {
        const r = p.retraso;
        const tramo = (k: number) => r + (1 - r) * k;
        const translateY = t.interpolate({
          inputRange: [0, r, tramo(0.35), 1],
          outputRange: [-24, -24, p.fin * 0.42, p.fin],
          extrapolate: 'clamp',
        });
        const translateX = t.interpolate({
          inputRange: [0, r, tramo(0.25), tramo(0.5), tramo(0.75), 1],
          outputRange: [0, 0, p.vaiven, -p.vaiven * 0.6, p.vaiven * 0.8, 0],
          extrapolate: 'clamp',
        });
        const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.giro}deg`] });
        // Girar sobre sí mismo: el papel se ve de canto y de frente, como el confeti de verdad
        const scaleX = t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.2, 1, 0.3, 1] });
        const opacity = t.interpolate({ inputRange: [0, r, r + 0.02, 0.8, 1], outputRange: [0, 0, 1, 1, 0], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: 0,
              width: p.ancho,
              height: p.alto,
              borderRadius: p.redondo ? p.ancho / 2 : 1.5,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }, { scaleX: p.redondo ? 1 : scaleX }],
            }}
          />
        );
      })}
    </>
  );
}

// ——— Fuegos artificiales ———

type Chispa = { dx: number; dy: number; color: string; tam: number };
type Estallido = { x: number; y: number; retraso: number; chispas: Chispa[]; color: string };

function Fuegos({ onFin }: { onFin: () => void }) {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const [t] = useState(() => new Animated.Value(0));
  const [estallidos] = useState<Estallido[]>(() => {
    const tonos = paleta(colors);
    const centros: [number, number, number][] = [
      [0.28, 0.24, 0],
      [0.72, 0.18, 0.16],
      [0.5, 0.34, 0.32],
    ];
    const radio = Math.min(140, width * 0.26);
    return centros.map(([cx, cy, retraso], k) => {
      const color = tonos[(k * 2) % tonos.length];
      const n = 26;
      return {
        x: cx * width,
        y: cy * Math.min(height, 900),
        retraso,
        color,
        chispas: Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + azar(-0.08, 0.08);
          const d = radio * azar(0.7, 1);
          return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, color: i % 4 === 0 ? tonos[(k * 2 + 1) % tonos.length] : color, tam: azar(4, 6.5) };
        }),
      };
    });
  });

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: NATIVO }).start(onFin);
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {estallidos.map((e, k) => {
        const r = e.retraso;
        const largo = 0.62;
        // Un destello en el centro al abrirse
        const flash = t.interpolate({ inputRange: [0, r, r + 0.04, r + 0.16, 1], outputRange: [0, 0, 0.55, 0, 0], extrapolate: 'clamp' });
        const flashScale = t.interpolate({ inputRange: [0, r, r + 0.16, 1], outputRange: [0.2, 0.2, 1.5, 1.5], extrapolate: 'clamp' });
        return (
          <View key={k} style={{ position: 'absolute', left: e.x, top: e.y }}>
            <Animated.View style={[styles.flash, { backgroundColor: e.color, opacity: flash, transform: [{ scale: flashScale }] }]} />
            {e.chispas.map((c, i) => {
              // Sale rápido, se frena y cae un poco con la gravedad mientras se apaga
              const translateX = t.interpolate({
                inputRange: [0, r, r + largo * 0.3, r + largo],
                outputRange: [0, 0, c.dx * 0.82, c.dx],
                extrapolate: 'clamp',
              });
              const translateY = t.interpolate({
                inputRange: [0, r, r + largo * 0.3, r + largo],
                outputRange: [0, 0, c.dy * 0.82, c.dy + 46],
                extrapolate: 'clamp',
              });
              const opacity = t.interpolate({
                inputRange: [0, r, r + 0.02, r + largo * 0.55, r + largo],
                outputRange: [0, 0, 1, 0.9, 0],
                extrapolate: 'clamp',
              });
              const scale = t.interpolate({ inputRange: [0, r, r + largo], outputRange: [1, 1, 0.35], extrapolate: 'clamp' });
              return (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: -c.tam / 2,
                    top: -c.tam / 2,
                    width: c.tam,
                    height: c.tam,
                    borderRadius: c.tam / 2,
                    backgroundColor: c.color,
                    opacity,
                    transform: [{ translateX }, { translateY }, { scale }],
                  }}
                />
              );
            })}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  flash: { position: 'absolute', left: -14, top: -14, width: 28, height: 28, borderRadius: 14 },
});
