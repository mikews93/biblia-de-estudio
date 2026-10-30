import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { text } from '@/components/comunidad/ui';
import { HeartIcon, LampIcon } from '@/components/icons';
import { lanzarConfeti } from '@/lib/confeti';
import { marcarAporta } from '@/lib/sembrar';
import { CORREO_SOSTENER, ENLACE_CANCELAR } from '@/lib/sostener';
import { isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/**
 * Gracias: a donde vuelve Stripe después de un aporte (zarzabiblia.com/gracias). Solo agradece, sin pedir más:
 * desde aquí, a esta persona no se le vuelve a invitar a sembrar en este dispositivo.
 */
export default function Gracias() {
  const colors = useColors();
  useEffect(() => {
    marcarAporta();
    lanzarConfeti('fuegos');
  }, []);
  const cancelar = () => Linking.openURL(ENLACE_CANCELAR ?? `mailto:${CORREO_SOSTENER}?subject=${encodeURIComponent('Cambiar mi aporte a Zarza')}`);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Gracias' }} />
      <Appear>
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.surface, borderColor: colors.border },
            !isDark(colors) && { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' },
          ]}
          testID="gracias"
        >
          <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
            <LampIcon color={colors.accent} size={32} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Gracias por sembrar</Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center', maxWidth: 440 }]}>
            Con tu aporte, alguien que no puede pagar sigue estudiando la Biblia con todo abierto. Eres parte de lo que mantiene
            encendida la lámpara.
          </Text>
          <View style={[styles.verse, { borderColor: colors.border }]}>
            <Text style={[styles.verseText, { color: colors.text }]}>
              «Cada uno dé como propuso en su corazón: no con tristeza, ni por necesidad, porque Dios ama al dador alegre».
            </Text>
            <Text style={[text.small, { color: colors.muted, marginTop: 6 }]}>2 Corintios 9:7</Text>
          </View>
        </View>
      </Appear>

      <Appear delay={80}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            'Stripe te manda el recibo a tu correo.',
            'En Sostén Zarza contamos en qué se usa lo que llega.',
            'No te volveremos a invitar a aportar. Ya eres parte.',
          ].map((p) => (
            <View key={p} style={styles.point}>
              <HeartIcon color={colors.accent} size={16} />
              <Text style={[text.body, { color: colors.text, flex: 1 }]}>{p}</Text>
            </View>
          ))}
        </View>
      </Appear>

      <Appear delay={140}>
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => navigate(() => router.replace('/'), 'back')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, { backgroundColor: colors.accent }, pressed && { opacity: 0.8 }]}
          >
            <Text style={{ color: colors.background, fontWeight: '700', fontSize: 15 }}>Volver a Hoy</Text>
          </Pressable>
          <Pressable
            onPress={() => navigate(() => router.push('/sostener'), 'forward')}
            accessibilityRole="link"
            style={({ pressed }) => [styles.button, { borderColor: colors.accent, borderWidth: 1 }, pressed && { opacity: 0.8 }]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>Ver en qué se usa</Text>
          </Pressable>
          <Pressable onPress={cancelar} accessibilityRole="link" style={styles.cancel}>
            <Text style={[text.small, { color: colors.muted, textAlign: 'center' }]}>
              ¿Quieres cambiar o cancelar tu aporte mensual? Puedes hacerlo cuando quieras, sin explicar nada.{' '}
              <Text style={{ color: colors.accent, fontWeight: '700' }}>{ENLACE_CANCELAR ? 'Abrir mi aporte' : 'Escríbenos'}</Text>
            </Text>
          </Pressable>
        </View>
      </Appear>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 64, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 12, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  emblem: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 30, fontWeight: '700', textAlign: 'center' },
  verse: { alignSelf: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginTop: 4, alignItems: 'center' },
  verseText: { fontFamily: serif, fontSize: 17, lineHeight: 25, textAlign: 'center', fontStyle: 'italic' },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 12 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  button: { borderRadius: 24, paddingVertical: 13, alignItems: 'center' },
  cancel: { paddingVertical: 8, paddingHorizontal: 8 },
});
