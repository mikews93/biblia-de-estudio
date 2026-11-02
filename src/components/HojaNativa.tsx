import { type ComponentRef, type RefObject, useRef, useState } from 'react';
import { Animated, Easing, Image, type LayoutChangeEvent, PanResponder, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import type { Swap } from '@/lib/pageSwipe';

/** Distancia antes de decidir que el gesto es horizontal, y cuánto arrastre pasa la hoja entera (como en la web). */
const SLOP = 12;
const FULL = 0.8;
const DURATION = 560;

type Hoja = { uri: string; delta: 1 | -1 };

type Opciones = {
  /** El lector entero: de él se saca la foto que hace de hoja. */
  pagina: RefObject<ComponentRef<typeof View> | null>;
  /** Cambia de capítulo en el mismo lector (el mismo swap que usa la web), o null si no se puede. */
  swap: Swap;
  /** Si un toque que empieza en (x, y) puede pasar la hoja (fuera de la cabecera, de la barra del versículo...). */
  puedeEmpezar: (x: number, y: number) => boolean;
};

/**
 * Pasar la hoja en el teléfono (Android e iPhone), con el dedo o con las flechas del lector.
 *
 * La web usa View Transitions, que no existen en la app nativa. Aquí, al empezar, se saca una foto del lector
 * (react-native-view-shot), se pone encima como la hoja y debajo se cambia de capítulo en el mismo lector. La
 * hoja gira sobre el lomo (el borde izquierdo al ir hacia adelante, el derecho al volver), se oscurece al
 * levantarse y deja ver el capítulo nuevo con su sombra. Con el dedo la hoja sigue el gesto; al soltar termina
 * de pasar si se arrastró lo bastante o se lanzó rápido, y si no vuelve a su sitio y el capítulo de antes
 * regresa debajo. Solo usa JavaScript y módulos que ya están en la app, así que llega con una actualización.
 */
export function useHojaNativa({ pagina, swap, puedeEmpezar }: Opciones) {
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const t = useRef(new Animated.Value(0)).current;
  const ancho = useRef(0);
  const latest = useRef({ swap, puedeEmpezar });
  latest.current = { swap, puedeEmpezar };

  /** El gesto en curso: lo que se sabe hasta que la foto está lista y la hoja puesta encima. */
  const turno = useRef<Turno | null>(null);
  type Turno = {
    delta: 1 | -1;
    progress: number;
    lista: boolean;
    /** Cambio de capítulo hecho (o pendiente de hacer al cargar la foto). */
    swapped: { go: () => void; back: () => void } | null;
    /** Al soltar antes de tener la hoja lista: si pasa o vuelve. */
    soltado: boolean | null;
    alCargar: (() => void) | null;
  };

  const terminar = (pasa: boolean, velocidad = 0) => {
    const g = turno.current;
    if (!g) return;
    if (!g.lista) {
      g.soltado = pasa;
      return;
    }
    const destino = pasa ? 1 : 0;
    const resto = Math.abs(destino - g.progress);
    Animated.timing(t, {
      toValue: destino,
      // Con un lanzamiento rápido la hoja acaba antes; desde la mitad, la mitad de tiempo.
      duration: Math.max(160, (DURATION * resto) / Math.max(1, Math.abs(velocidad) * 1.5)),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      if (pasa) {
        turno.current = null;
        setHoja(null);
        return;
      }
      // La hoja vuelve a tapar todo: debajo regresa el capítulo de antes y se quita en cuanto se ha pintado.
      g.swapped?.back();
      setTimeout(() => {
        turno.current = null;
        setHoja(null);
      }, 260);
    });
  };

  /** Empieza a pasar la hoja: foto del lector, la hoja encima y, ya tapado, el capítulo nuevo debajo. */
  const empezar = (delta: 1 | -1, conDedo: boolean): boolean => {
    if (turno.current) return false;
    const swapped = latest.current.swap(delta);
    if (!swapped || !pagina.current) return false;
    const g: Turno = { delta, progress: 0, lista: false, swapped, soltado: null, alCargar: null };
    turno.current = g;
    t.setValue(0);
    captureRef(pagina, { format: 'jpg', quality: 0.92, result: 'tmpfile' })
      .then((uri) => {
        if (turno.current !== g) return;
        g.alCargar = () => {
          g.alCargar = null;
          g.swapped?.go();
          g.lista = true;
          t.setValue(g.progress);
          if (!conDedo) terminar(true);
          else if (g.soltado !== null) terminar(g.soltado);
        };
        setHoja({ uri, delta });
      })
      .catch(() => {
        // Sin foto no hay hoja: se cambia de capítulo como siempre (salvo que se soltara sin pasarla).
        if (turno.current !== g) return;
        turno.current = null;
        if (!conDedo || g.soltado !== false) swapped.go();
      });
    return true;
  };

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (e, s) => {
        if (turno.current || !ancho.current) return false;
        if (Math.abs(s.dx) < SLOP || Math.abs(s.dx) < Math.abs(s.dy) * 1.4) return false;
        // x0/y0 solo se llenan al conceder el gesto: el punto de partida es donde está el dedo menos lo recorrido.
        if (!latest.current.puedeEmpezar(e.nativeEvent.pageX - s.dx, e.nativeEvent.pageY - s.dy)) return false;
        return empezar(s.dx < 0 ? 1 : -1, true);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, s) => {
        const g = turno.current;
        if (!g) return;
        g.progress = Math.min(1, Math.max(0, (g.delta > 0 ? -s.dx : s.dx) / (ancho.current * FULL)));
        if (g.lista) t.setValue(g.progress);
      },
      onPanResponderRelease: (_, s) => {
        const g = turno.current;
        if (!g) return;
        const v = g.delta > 0 ? -s.vx : s.vx;
        terminar(g.progress > 0.4 || (v > 0.5 && g.progress > 0.05), v);
      },
      onPanResponderTerminate: () => terminar(false),
    }),
  ).current;

  const rotacion = t.interpolate({ inputRange: [0, 1], outputRange: hoja?.delta === -1 ? ['0deg', '90deg'] : ['0deg', '-90deg'] });
  const capa = hoja && (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* La sombra que la hoja proyecta sobre el capítulo nuevo se aclara a medida que se levanta. */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0] }) }]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transformOrigin: hoja.delta > 0 ? 'left' : 'right',
            transform: [{ perspective: 1400 }, { rotateY: rotacion }],
            backfaceVisibility: 'hidden',
          },
        ]}
      >
        <Image
          source={{ uri: hoja.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="stretch"
          fadeDuration={0}
          onLoad={() => turno.current?.alCargar?.()}
          onError={() => turno.current?.alCargar?.()}
        />
        {/* El doblez se oscurece desde el lomo hacia el borde que se levanta. */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.75, 1] }) }]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="doblez" x1={hoja.delta > 0 ? '0' : '1'} y1="0" x2={hoja.delta > 0 ? '1' : '0'} y2="0">
                <Stop offset="0" stopColor="#000" stopOpacity={0.05} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.4} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#doblez)" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );

  return {
    /** Para la vista del lector: el gesto con el dedo y su ancho. Solo en el teléfono; en la web lo hace usePageSwipe. */
    props:
      Platform.OS === 'web'
        ? {}
        : {
            ...responder.panHandlers,
            collapsable: false,
            onLayout: (e: LayoutChangeEvent) => {
              ancho.current = e.nativeEvent.layout.width;
            },
          },
    /** La hoja que se pasa, encima de todo el lector. */
    capa,
    /** Pasar la hoja con los botones del lector; false si no se pudo (ahí se navega como siempre). */
    pasar: (delta: 1 | -1) => Platform.OS !== 'web' && empezar(delta, false),
  };
}
