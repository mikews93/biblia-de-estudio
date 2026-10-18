import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import AudioBar from '@/components/AudioBar';
import TabBar from '@/components/TabBar';
import { SettingsProvider, isDark, useColors } from '@/lib/theme';

function AppStack() {
  const colors = useColors();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark(colors) ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="[book]/[chapter]/index" options={{ title: '' }} />
        <Stack.Screen name="[book]/[chapter]/[verse]" options={{ title: '' }} />
        <Stack.Screen name="mapa/[book]/[chapter]" options={{ title: 'Lugares' }} />
        <Stack.Screen name="buscar" options={{ title: 'Buscar' }} />
        <Stack.Screen name="libros" options={{ title: 'Libros', presentation: 'modal' }} />
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
