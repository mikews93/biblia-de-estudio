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

/** Recorrido que debe quedar para ocultar: si al apartar las barras el texto casi no se desplaza, se dejan. */
const ROOM = 320;
/** Al final no se ocultan: las barras ocupan menos que esto, así al volver no se vuelve a «estar lejos» del final. */
const END_HIDE = 240;
const END_SHOW = 120;

/**
 * Oculta las barras al bajar leyendo y las devuelve al subir un poco, cerca del principio o al llegar
 * al final del capítulo. Se acumula el recorrido en un sentido para que un temblor del dedo no las mueva.
 * Por omisión mueve las barras del lector; el estudio pasa las suyas y no las saca al final, donde
 * van llegando las respuestas.
 *
 * Apartar una barra agranda lo que se ve y, pegado al final, el navegador corrige la posición hacia arriba: eso
 * no es el dedo y no cuenta. Antes volvía a mostrar la barra, que volvía a empujar, y la pantalla temblaba arriba
 * y abajo sin parar. Tampoco se ocultan cerca del final ni cuando el contenido apenas se desplaza.
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
    const toEnd = contentSize.height - (y + layoutMeasurement.height);
    // Subir quedando pegado al final: es la corrección del navegador al crecer el área, no un gesto
    if (Date.now() < pausedUntil.current || (dy < 0 && toEnd <= 1)) {
      run.current = 0;
      return;
    }
    run.current = Math.sign(dy) === Math.sign(run.current) ? run.current + dy : dy;

    const room = contentSize.height - layoutMeasurement.height >= ROOM;
    if (y < 60 || (showAtEnd && toEnd <= END_SHOW)) setHidden(false);
    else if (run.current > 24 && room && !(showAtEnd && toEnd <= END_HIDE)) setHidden(true);
    else if (run.current < -16) setHidden(false);
  };

  /** Para un salto hecho por la app (abrir en un versículo): ese desplazamiento no oculta nada. */
  const pause = (ms = 500) => {
    pausedUntil.current = Math.max(pausedUntil.current, Date.now() + ms);
  };

  return { onScroll, pause };
}
