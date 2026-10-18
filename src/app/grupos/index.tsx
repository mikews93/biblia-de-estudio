import { Stack, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import GroupPlans from '@/components/comunidad/GroupPlans';
import { text } from '@/components/comunidad/ui';
import { useAccount } from '@/lib/comunidad';
import { useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Planes en grupo. Mientras no exista la pantalla de planes personales, es la pestaña Planes. */
export default function Grupos() {
  const colors = useColors();
  const { usuario } = useAccount();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen
        options={{
          title: 'Planes en grupo',
          headerRight: () =>
            usuario ? (
              <Pressable onPress={() => navigate(() => router.push('/cuenta'), 'forward')} hitSlop={8} style={{ marginRight: 16 }}>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Tu cuenta</Text>
              </Pressable>
            ) : null,
        }}
      />
      <Text style={[text.title, { color: colors.text, marginBottom: 16 }]}>Leer en grupo</Text>
      <GroupPlans />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
});
