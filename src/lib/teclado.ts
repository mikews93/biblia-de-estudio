import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Cuánto tapa el teclado la parte de abajo de la pantalla en la web.
 *
 * En Chrome de Android la página pide `interactive-widget=resizes-content` (public/index.html): el teclado encoge la
 * ventana y los paneles a pantalla completa (Estudio, Pregúntale a la Biblia, Taller) se acortan solos, así que aquí
 * sale 0. Donde esa etiqueta no se entiende (Safari de iPhone, navegadores viejos) el teclado solo encoge la parte
 * visible: la diferencia con la ventana es lo que tapa, y se devuelve para dejar ese espacio debajo de la caja.
 * En la app nativa lo hace KeyboardAvoidingView y siempre devuelve 0.
 */
export function useTecladoWeb(): number {
  const [tapa, setTapa] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    let marco = 0;
    const medir = () => {
      cancelAnimationFrame(marco);
      marco = requestAnimationFrame(() => {
        const t = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        // Menos de 80 px es la barra del navegador que aparece o se va, no un teclado.
        setTapa(t >= 80 ? t : 0);
      });
    };
    medir();
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    return () => {
      cancelAnimationFrame(marco);
      vv.removeEventListener('resize', medir);
      vv.removeEventListener('scroll', medir);
    };
  }, []);
  return tapa;
}

/**
 * Si el teclado está abierto, para esconder la barra de pestañas mientras se escribe (como en las apps nativas):
 * con `resizes-content` la ventana encoge y la barra subiría encima del teclado, robando sitio a la caja.
 * En la web se nota porque la ventana (o la parte visible) queda mucho más baja que su alto normal con un campo
 * de texto enfocado; en la app nativa, por los avisos del teclado.
 */
export function useTecladoAbierto(): boolean {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') {
      const a = Keyboard.addListener('keyboardDidShow', () => setAbierto(true));
      const b = Keyboard.addListener('keyboardDidHide', () => setAbierto(false));
      return () => {
        a.remove();
        b.remove();
      };
    }
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    let alto = window.innerHeight;
    let ancho = window.innerWidth;
    const escribiendo = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);
    };
    const medir = () => {
      // Al girar el teléfono cambia el ancho: el alto normal es otro.
      if (window.innerWidth !== ancho) {
        ancho = window.innerWidth;
        alto = window.innerHeight;
      }
      const visible = vv ? Math.min(window.innerHeight, vv.height) : window.innerHeight;
      if (!escribiendo()) alto = Math.max(window.innerHeight, visible);
      else alto = Math.max(alto, window.innerHeight);
      setAbierto(escribiendo() && alto - visible > 150);
    };
    window.addEventListener('resize', medir);
    vv?.addEventListener('resize', medir);
    document.addEventListener('focusin', medir);
    document.addEventListener('focusout', medir);
    return () => {
      window.removeEventListener('resize', medir);
      vv?.removeEventListener('resize', medir);
      document.removeEventListener('focusin', medir);
      document.removeEventListener('focusout', medir);
    };
  }, []);
  return abierto;
}
