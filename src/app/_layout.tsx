import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import AudioBar from '@/components/AudioBar';
import AvisosSync from '@/components/AvisosSync';
import SincroniaCuenta from '@/components/Sincronia';
import { OfflineBanner } from '@/components/SinConexion';
import TabBar from '@/components/TabBar';
import { init as initDownloads } from '@/lib/descargas';
import { fixedInTransition } from '@/lib/transition';
import { SettingsProvider, isDark, useColors } from '@/lib/theme';

// La cabecera queda quieta en las transiciones (src/lib/transition.ts). headerStyle descarta los estilos
// que no conoce, así que se fija cada parte por separado; el Stack de la web pasa estas opciones a Header
// aunque los tipos de NativeStack no las declaren.
const fixedHeader = {
  headerBackgroundContainerStyle: fixedInTransition('cabecera'),
  headerLeftContainerStyle: fixedInTransition('cabecera-izq'),
  headerTitleContainerStyle: fixedInTransition('cabecera-titulo'),
  headerRightContainerStyle: fixedInTransition('cabecera-der'),
};

function AppStack() {
  const colors = useColors();

  // Fondo de la página con el color del tema: lo que se ve debajo durante las transiciones. Si quedaba
  // blanco, el fundido entre pantallas destellaba (sobre todo en modo oscuro y sepia).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.backgroundColor = colors.background;
    document.documentElement.style.setProperty('--papel', colors.background);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.background);
  }, [colors.background]);

  useEffect(() => {
    if (Platform.OS === 'web') hidePortadaWhenReady();
  }, []);

  // Lee qué hay descargado y, en la web, mantiene al día la copia de la app para abrirla sin conexión.
  useEffect(() => {
    initDownloads().catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark(colors) ? 'light' : 'dark'} />
      <View nativeID="pantallas" style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            ...fixedHeader,
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="[book]/[chapter]/index" options={{ title: '' }} />
          <Stack.Screen name="[book]/[chapter]/[verse]" options={{ title: '' }} />
          <Stack.Screen name="mapa/[book]/[chapter]" options={{ title: 'Lugares' }} />
          <Stack.Screen name="podcast/[book]/[chapter]" options={{ title: 'Resumen en audio' }} />
          <Stack.Screen name="comparar/[book]/[chapter]" options={{ title: 'Comparar versiones' }} />
          <Stack.Screen name="concordancia/[strong]" options={{ title: 'Concordancia' }} />
          <Stack.Screen name="mapa-mental/[book]/[chapter]" options={{ title: 'Mapa mental' }} />
          <Stack.Screen name="tarjetas/[book]/[chapter]" options={{ title: 'Tarjetas de repaso' }} />
          <Stack.Screen name="repaso" options={{ title: 'Repaso' }} />
          <Stack.Screen name="buscar" options={{ title: '' }} />
          <Stack.Screen name="libros" options={{ title: 'Libros', presentation: 'modal' }} />
          <Stack.Screen name="genealogia/index" options={{ title: 'Genealogías' }} />
          <Stack.Screen name="genealogia/[id]" options={{ title: '' }} />
          <Stack.Screen name="ficha/[id]" options={{ title: '' }} />
          <Stack.Screen name="historia" options={{ title: 'Línea de tiempo' }} />
          <Stack.Screen name="promesas/index" options={{ title: 'Promesa y cumplimiento' }} />
          <Stack.Screen name="promesas/[id]" options={{ title: '' }} />
          <Stack.Screen name="comunidades/index" options={{ title: 'Comunidad' }} />
          <Stack.Screen name="comunidades/amigos" options={{ title: 'Amigos' }} />
          <Stack.Screen name="comunidades/publicar" options={{ title: 'Publicar' }} />
          <Stack.Screen name="comunidades/publicacion/[id]" options={{ title: '' }} />
          <Stack.Screen name="comunidades/persona/[id]" options={{ title: '' }} />
          <Stack.Screen name="amigo/[codigo]" options={{ title: 'Amistad' }} />
          <Stack.Screen name="grupos/index" options={{ title: 'Planes en grupo' }} />
          <Stack.Screen name="grupos/[id]" options={{ title: '' }} />
          <Stack.Screen name="grupos/nuevo" options={{ title: 'Nuevo grupo' }} />
          <Stack.Screen name="cuenta" options={{ title: 'Tu cuenta' }} />
          <Stack.Screen name="notificaciones" options={{ title: 'Notificaciones' }} />
          <Stack.Screen name="entrar" options={{ title: '' }} />
          <Stack.Screen name="registro" options={{ title: '' }} />
          <Stack.Screen name="unirse/[codigo]" options={{ title: 'Invitación' }} />
          <Stack.Screen name="planes/index" options={{ title: 'Planes de lectura' }} />
          <Stack.Screen name="planes/[id]" options={{ title: '' }} />
          <Stack.Screen name="notas" options={{ title: 'Mis resaltados y notas' }} />
          <Stack.Screen name="diario" options={{ title: 'Mi diario' }} />
          <Stack.Screen name="descargas" options={{ title: 'Sin conexión' }} />
          <Stack.Screen name="taller/index" options={{ title: 'Taller' }} />
          <Stack.Screen name="taller/dinamicas" options={{ title: 'Dinámicas' }} />
          <Stack.Screen name="taller/[id]/index" options={{ title: '' }} />
          <Stack.Screen name="taller/[id]/presentar" options={{ headerShown: false }} />
          <Stack.Screen name="semana/index" options={{ title: 'Del sermón a tu semana' }} />
          <Stack.Screen name="semana/nueva" options={{ title: 'Del sermón a tu semana' }} />
          <Stack.Screen name="semana/[id]/index" options={{ title: '' }} />
          <Stack.Screen name="semana/[id]/[dia]" options={{ title: '' }} />
          <Stack.Screen name="eventos" options={{ title: 'Eventos' }} />
          <Stack.Screen name="evento/[codigo]/index" options={{ title: '' }} />
          <Stack.Screen name="evento/[codigo]/proyectar" options={{ headerShown: false }} />
        </Stack>
      </View>
      <AudioBar />
      <OfflineBanner />
      <TabBar />
      {Platform.OS === 'web' && <AvisosSync />}
      <SincroniaCuenta />
      {Platform.OS === 'web' && (
        <>
          <View nativeID="pliegue-sombra" pointerEvents="none" style={fixedInTransition('pliegue-sombra')} />
          <View nativeID="pliegue" pointerEvents="none" style={fixedInTransition('pliegue')} />
          <View nativeID="pliegue-brillo" pointerEvents="none" style={fixedInTransition('pliegue-brillo')} />
        </>
      )}
    </View>
  );
}

// En la web cada pantalla llega en su propio archivo de código. La portada de public/index.html sigue a la vista
// hasta que la primera pantalla tiene algo que mostrar; si no, se veía un momento la barra de abajo sola.
function hidePortadaWhenReady() {
  const portada = document.getElementById('portada');
  if (!portada) return;
  const started = Date.now();
  const check = () => {
    const screens = document.getElementById('pantallas');
    if (screens?.innerText.trim() || Date.now() - started > 8000) {
      portada.classList.add('fuera');
      setTimeout(() => portada.remove(), 300);
    } else requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AppStack />
    </SettingsProvider>
  );
}
