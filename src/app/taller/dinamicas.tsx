import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Catalogo } from '@/components/taller/Dinamicas';
import { text } from '@/components/comunidad/ui';
import { useColors } from '@/lib/theme';

/** El catálogo de dinámicas para encuentros, todas sin materiales. */
export default function DinamicasScreen() {
  const colors = useColors();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Dinámicas' }} />
      <Text style={[text.title, { color: colors.text }]}>Dinámicas para grupos</Text>
      <Text style={[text.body, { color: colors.muted, marginTop: 6, marginBottom: 16 }]}>
        Todas se hacen sin materiales: solo personas, Biblias o teléfonos y conversación. Están escritas con palabras propias;
        cuando la idea viene de otra colección, se enlaza.
      </Text>
      <Catalogo />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 80, maxWidth: 640, width: '100%', alignSelf: 'center' },
});
