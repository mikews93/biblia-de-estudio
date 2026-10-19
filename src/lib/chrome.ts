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
  slide(chrome, next);
}

/** Lleva un valor de barras a 1 (ocultas) o a 0 (a la vista), con la misma curva que las del lector. */
export function slide(value: Animated.Value, hide: boolean) {
  Animated.timing(value, {
    toValue: hide ? 1 : 0,
    duration: reduceMotion ? 0 : hide ? 240 : 200,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: false,
  }).start();
}

/**
 * Oculta las barras al bajar leyendo y las devuelve al subir un poco, cerca del principio o al llegar
 * al final del capítulo. Se acumula el recorrido en un sentido para que un temblor del dedo no las mueva.
 * Por omisión mueve las barras del lector; el estudio pasa las suyas y no las saca al final, donde
 * van llegando las respuestas.
 */
export function useAutoHide(setHidden: (hidden: boolean) => void = setChromeHidden, showAtEnd = true) {
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

    const nearEnd = showAtEnd && y + layoutMeasurement.height >= contentSize.height - 120;
    if (y < 60 || nearEnd) setHidden(false);
    else if (run.current > 24) setHidden(true);
    else if (run.current < -16) setHidden(false);
  };

  /** Para un salto hecho por la app (abrir en un versículo): ese desplazamiento no oculta nada. */
  const pause = () => {
    pausedUntil.current = Date.now() + 500;
  };

  return { onScroll, pause };
}
