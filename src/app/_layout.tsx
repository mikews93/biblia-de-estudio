import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import AudioBar from '@/components/AudioBar';
import TabBar from '@/components/TabBar';
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
    if (Platform.OS === 'web') document.documentElement.style.backgroundColor = colors.background;
  }, [colors.background]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark(colors) ? 'light' : 'dark'} />
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
        <Stack.Screen name="mapa-mental/[book]/[chapter]" options={{ title: 'Mapa mental' }} />
        <Stack.Screen name="tarjetas/[book]/[chapter]" options={{ title: 'Tarjetas de repaso' }} />
        <Stack.Screen name="repaso" options={{ title: 'Repaso' }} />
        <Stack.Screen name="buscar" options={{ title: '' }} />
        <Stack.Screen name="libros" options={{ title: 'Libros', presentation: 'modal' }} />
        <Stack.Screen name="genealogia/index" options={{ title: 'Genealogías' }} />
        <Stack.Screen name="genealogia/[id]" options={{ title: '' }} />
        <Stack.Screen name="historia" options={{ title: 'Línea de tiempo' }} />
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
        <Stack.Screen name="entrar" options={{ title: '' }} />
        <Stack.Screen name="registro" options={{ title: '' }} />
        <Stack.Screen name="unirse/[codigo]" options={{ title: 'Invitación' }} />
        <Stack.Screen name="planes/index" options={{ title: 'Planes de lectura' }} />
        <Stack.Screen name="planes/[id]" options={{ title: '' }} />
        <Stack.Screen name="notas" options={{ title: 'Mis resaltados y notas' }} />
        <Stack.Screen name="taller/index" options={{ title: 'Taller' }} />
        <Stack.Screen name="taller/dinamicas" options={{ title: 'Dinámicas' }} />
        <Stack.Screen name="taller/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="taller/[id]/presentar" options={{ headerShown: false }} />
      </Stack>
      <AudioBar />
      <TabBar />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AppStack />
    </SettingsProvider>
  );
}
