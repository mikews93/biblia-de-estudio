// Que un campo de varias líneas crezca a medida que se escribe, en vez de llenarse de barras de desplazamiento.
// En el teléfono (Android e iOS) TextInput ya crece solo; en la web el <textarea> se queda del alto inicial, así que
// aquí se mide su contenido y se le da ese alto cada vez que cambia el texto (o el ancho del campo).
import { type RefObject, useCallback, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';

export function useCrecer(value: string | undefined, activo = true): { ref: RefObject<unknown>; onLayout?: () => void } {
  const ref = useRef<unknown>(null);
  const medir = useCallback(() => {
    if (Platform.OS !== 'web' || !activo) return;
    const el = ref.current as HTMLTextAreaElement | null;
    if (!el || el.tagName !== 'TEXTAREA') return;
    // Con alto 0 el contenido se mide entero; el mínimo del estilo (minHeight) sigue mandando.
    const scroll = window.scrollY;
    el.style.height = '0px';
    const cs = getComputedStyle(el);
    const borde = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    el.style.height = `${el.scrollHeight + borde}px`;
    el.style.overflowY = 'hidden';
    // Achicar el campo un instante podía mover la página: se deja donde estaba.
    if (window.scrollY !== scroll) window.scrollTo({ top: scroll });
  }, [activo]);
  useLayoutEffect(medir, [value, medir]);
  return { ref, onLayout: Platform.OS === 'web' && activo ? medir : undefined };
}
