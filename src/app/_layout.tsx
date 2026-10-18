import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SettingsProvider, isDark, useColors } from '@/lib/theme';

function AppStack() {
  const colors = useColors();

  return (
    <>
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
        <Stack.Screen name="[book]/[chapter]" options={{ title: '' }} />
        <Stack.Screen name="libros" options={{ title: 'Libros', presentation: 'modal' }} />
        <Stack.Screen name="comunidades/index" options={{ title: 'Comunidades' }} />
        <Stack.Screen name="comunidades/[id]" options={{ title: '' }} />
        <Stack.Screen name="comunidades/nuevo" options={{ title: 'Nuevo grupo' }} />
        <Stack.Screen name="comunidades/cuenta" options={{ title: 'Tu cuenta' }} />
        <Stack.Screen name="unirse/[codigo]" options={{ title: 'Invitación' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AppStack />
    </SettingsProvider>
  );
}
