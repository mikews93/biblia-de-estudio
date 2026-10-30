import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useId } from 'react';

/**
 * Deja la pantalla encendida mientras `activa` sea verdadero: al leer (si la persona no lo apagó en «Aa»), mientras
 * suena un audio y al presentar o guiar en vivo. Una queja frecuente de otras apps es que la pantalla se apaga en
 * plena lectura o predicación. En la web usa el Wake Lock del navegador; si no lo hay, no pasa nada.
 */
export function usePantallaEncendida(activa: boolean) {
  const tag = `zarza-${useId()}`;
  useEffect(() => {
    if (!activa) return;
    let viva = true;
    // Si se suelta antes de que el navegador conceda el bloqueo, se suelta en cuanto llega.
    const pedir = () =>
      activateKeepAwakeAsync(tag)
        .then(() => (viva ? undefined : deactivateKeepAwake(tag)))
        .catch(() => {});
    pedir();
    // En la web el navegador suelta el bloqueo al cambiar de pestaña: se pide otra vez al volver.
    const volver = () => {
      if (document.visibilityState === 'visible') pedir();
    };
    const web = typeof document !== 'undefined' && !!document.addEventListener;
    if (web) document.addEventListener('visibilitychange', volver);
    return () => {
      viva = false;
      if (web) document.removeEventListener('visibilitychange', volver);
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [activa, tag]);
}
