import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { FontSizeContext, useColors } from '@/lib/theme';

export default function RootLayout() {
  const colors = useColors();
  const [size, setSize] = useState(19);

  return (
    <FontSizeContext.Provider value={{ size, setSize }}>
      <StatusBar style="auto" />
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
      </Stack>
    </FontSizeContext.Provider>
  );
}
