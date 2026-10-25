import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useColors } from '@/lib/theme';

// En el teléfono, la página final de entrar con Google, Apple o Facebook vuelve a la app con bibliadeestudio://vuelta
// (src/lib/proveedores.ts). Esa dirección solo cierra el navegador: si además llega aquí, se vuelve a donde estaba.
export default function Vuelta() {
  const colors = useColors();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
