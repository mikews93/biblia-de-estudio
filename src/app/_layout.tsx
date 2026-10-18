import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

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
        <Stack.Screen name="libros" options={{ title: 'Libros', presentation: 'modal' }} />
      </Stack>
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
