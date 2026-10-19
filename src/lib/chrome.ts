import { useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

// Barras que se apartan al leer: la cabecera del lector, la píldora de capítulos y la barra de abajo.
// Un solo valor animado para todas (0 = a la vista, 1 = ocultas), así se mueven a la vez. Sin el driver
// nativo porque la barra de abajo anima su altura.
export const chrome = new Animated.Value(0);

let hidden = false;
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((r) => (reduceMotion = r))
  .catch(() => {});

export function setChromeHidden(next: boolean) {
  if (next === hidden) return;
  hidden = next;
  Animated.timing(chrome, {
    toValue: next ? 1 : 0,
    duration: reduceMotion ? 0 : next ? 240 : 200,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: false,
  }).start();
}

/**
 * Oculta las barras al bajar leyendo y las devuelve al subir un poco, cerca del principio o al llegar
 * al final del capítulo. Se acumula el recorrido en un sentido para que un temblor del dedo no las mueva.
 */
export function useAutoHide() {
  const last = useRef(0);
  const run = useRef(0);
  const pausedUntil = useRef(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const dy = y - last.current;
    last.current = y;
    if (Date.now() < pausedUntil.current) {
      run.current = 0;
      return;
    }
    run.current = Math.sign(dy) === Math.sign(run.current) ? run.current + dy : dy;

    const nearEnd = y + layoutMeasurement.height >= contentSize.height - 120;
    if (y < 60 || nearEnd) setChromeHidden(false);
    else if (run.current > 24) setChromeHidden(true);
    else if (run.current < -16) setChromeHidden(false);
  };

  /** Para un salto hecho por la app (abrir en un versículo): ese desplazamiento no oculta nada. */
  const pause = () => {
    pausedUntil.current = Date.now() + 500;
  };

  return { onScroll, pause };
}
