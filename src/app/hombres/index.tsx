import { Stack, router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Meter, text } from '@/components/comunidad/ui';
import { CheckIcon, ChevronRightIcon, HammerIcon, LockIcon } from '@/components/icons';
import { fechaCorta } from '@/lib/camino';
import { HOMBRES, SEMANAS_HOMBRES, progresoHombres } from '@/lib/hombres';
import { useHombresDiario } from '@/lib/hombresDiario';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const go = (href: string) => navigate(() => router.push(href as never), 'forward');

/** «Hombres de pie»: ocho semanas para hombres, con un reto por semana. Todo queda en el teléfono. */
export default function HombresScreen() {
  const colors = useColors();
  const { diario } = useHombresDiario();
  const prog = diario ? progresoHombres(Object.keys(diario.hechas).map(Number)) : null;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Hombres de pie' }} />
      <Appear>
        <View style={[styles.hero, shadow(colors), { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}>
            <HammerIcon color={colors.accent} size={24} />
          </View>
          <Text style={[styles.kicker, { color: colors.warm, marginTop: 14 }]}>OCHO SEMANAS PARA HOMBRES</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Hombres de pie</Text>
          <Text style={[styles.verse, { color: colors.muted }]}>«Hierro con hierro se aguza; y el hombre aguza el rostro de su amigo.» Proverbios 27:17</Text>
          <Text style={[text.body, { color: colors.text, marginTop: 14 }]}>
            Fe y trabajo, integridad, construir con otros, caminar de hombre a hombre, proveer y liderar sirviendo. Cada semana
            trae un pasaje, preguntas para responder a solas y un reto concreto. Para solteros y casados.
          </Text>
          <View style={[styles.privado, { backgroundColor: colors.accentSoft }]}>
            <LockIcon color={colors.accent} size={15} strokeWidth={2} />
            <Text style={[text.small, { color: colors.text, flex: 1, lineHeight: 19 }]}>
              Lo que escribes se queda en este teléfono. No hace falta cuenta.
            </Text>
          </View>
        </View>
      </Appear>

      {!diario || !prog ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <>
          <Appear delay={60}>
            <View style={styles.avance}>
              <Text style={[styles.kicker, { color: colors.muted }]}>
                {prog.completo ? 'OCHO SEMANAS TERMINADAS' : `${prog.hechas} DE ${SEMANAS_HOMBRES} SEMANAS`}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Meter value={prog.hechas} max={SEMANAS_HOMBRES} colors={colors} />
              </View>
              <Text style={[text.small, { color: colors.muted, marginTop: 8 }]}>Una por semana, para que el reto tenga tiempo de hacerse vida.</Text>
            </View>
          </Appear>
          <View style={{ gap: 10 }}>
            {HOMBRES.map((s, i) => {
              const fecha = diario.hechas[s.n] ?? null;
              const actual = prog.siguiente === s.n;
              const abierta = !!fecha || actual;
              return (
                <Appear key={s.n} delay={80 + i * 30}>
                  <Pressable
                    onPress={() => go(`/hombres/${s.n}`)}
                    disabled={!abierta}
                    accessibilityRole="link"
                    aria-disabled={!abierta}
                    style={({ pressed }) => [
                      styles.fila,
                      actual && shadow(colors),
                      { backgroundColor: colors.surface, borderColor: actual ? colors.warm : colors.border },
                      !abierta && { opacity: 0.6 },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View
                      style={[
                        styles.num,
                        fecha ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: actual ? colors.warm : colors.border },
                      ]}
                    >
                      {fecha ? (
                        <CheckIcon color={colors.surface} size={16} strokeWidth={2.6} />
                      ) : abierta ? (
                        <Text style={{ color: colors.warm, fontFamily: serif, fontSize: 17 }}>{s.n}</Text>
                      ) : (
                        <LockIcon color={colors.muted} size={14} />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{s.titulo}</Text>
                      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{s.lema}</Text>
                      <Text style={{ color: actual ? colors.warm : colors.muted, fontSize: 12, fontWeight: '600', marginTop: 6 }}>
                        {fecha
                          ? `Terminada el ${fechaCorta(fecha)}${diario.retos[s.n] ? ' · reto cumplido' : ''}`
                          : actual
                            ? 'Tu semana'
                            : 'Después de la anterior'}
                      </Text>
                    </View>
                    {abierta && <ChevronRightIcon color={colors.muted} size={20} />}
                  </Pressable>
                </Appear>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const shadow = (colors: Colors) => (isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.06)' });

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 12, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 22, marginBottom: 18 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  heroTitle: { fontFamily: serif, fontSize: 30, lineHeight: 36, marginTop: 6 },
  verse: { fontFamily: serif, fontStyle: 'italic', fontSize: 15, lineHeight: 22, marginTop: 8 },
  privado: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 12, padding: 12, marginTop: 16 },
  avance: { marginBottom: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 },
  num: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
