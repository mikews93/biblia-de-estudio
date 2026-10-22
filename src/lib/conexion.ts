import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { nativeOnline, onNativeChange } from './red';

// Si hay internet. En la web lo dice el navegador (navigator.onLine y los eventos online/offline); en el
// teléfono, expo-network (red.native.ts).

/** Error que lanzan las funciones con IA o comunidad sin conexión; las pantallas lo cambian por <NeedsConnection>. */
export const NEEDS_CONNECTION = 'Esto necesita conexión a internet.';

export const isOnline = () =>
  Platform.OS !== 'web' ? nativeOnline() : typeof navigator === 'undefined' || navigator.onLine !== false;

/** Lanza NEEDS_CONNECTION sin llamar al servidor cuando el dispositivo está sin conexión. */
export function requireConnection() {
  if (!isOnline()) throw new Error(NEEDS_CONNECTION);
}

export function useOnline() {
  const [online, setOnline] = useState(isOnline);
  useEffect(() => {
    const update = () => setOnline(isOnline());
    if (Platform.OS !== 'web') {
      update();
      return onNativeChange(update);
    }
    if (typeof window === 'undefined') return;
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
