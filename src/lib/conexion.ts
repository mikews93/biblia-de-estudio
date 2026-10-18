import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Si hay internet. En la web lo dice el navegador (navigator.onLine y los eventos online/offline); en el
// teléfono se supone que sí hasta que haya paquetes sin conexión nativos.

/** Error que lanzan las funciones con IA o comunidad sin conexión; las pantallas lo cambian por <NeedsConnection>. */
export const NEEDS_CONNECTION = 'Esto necesita conexión a internet.';

export const isOnline = () => Platform.OS !== 'web' || typeof navigator === 'undefined' || navigator.onLine !== false;

/** Lanza NEEDS_CONNECTION sin llamar al servidor cuando el dispositivo está sin conexión. */
export function requireConnection() {
  if (!isOnline()) throw new Error(NEEDS_CONNECTION);
}

export function useOnline() {
  const [online, setOnline] = useState(isOnline);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setOnline(isOnline());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
