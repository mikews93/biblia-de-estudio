import { Stack, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { IconText } from '@/components/comunidad/ui';
import { LecternIcon, LockIcon, PlusIcon } from '@/components/icons';
import { Ruta } from '@/components/SemanaSermon';
import { DIAS, type Semana, fechaDia, hechos, siguiente, useSemanas } from '@/lib/semanas';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Las semanas preparadas a partir de los sermones, la más reciente primero. */
export default function Semanas() {
  const colors = useColors();
  const { semanas, ready } = useSemanas();
  const nueva = () => navigate(() => router.push('/semana/nueva' as never), 'forward');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Del sermón a tu semana' }} />

      {ready && semanas.length === 0 ? (
        <Appear style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
            <LecternIcon color={colors.accent} size={30} strokeWidth={1.6} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Lleva el sermón del domingo a tu semana</Text>
          <Text style={[styles.lead, { color: colors.muted }]}>
            Escribe o dicta tus notas del sermón y prepara cinco días de devocional sobre ese pasaje, con preguntas,
            pistas para orar y un paso para cada día.
          </Text>
          <View style={{ alignSelf: 'stretch', marginTop: 22 }}>
            <Ruta colors={colors} />
          </View>
          <Pressable onPress={nueva} style={({ pressed }) => [styles.cta, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
            <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>Escribir mis notas del sermón</Text>
          </Pressable>
        </Appear>
      ) : (
        <>
          <Appear>
            <Pressable
              onPress={nueva}
              style={({ pressed }) => [styles.add, { backgroundColor: colors.accent }, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={[styles.addIcon, { backgroundColor: colors.surface }]}>
                <PlusIcon color={colors.accent} size={18} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 16 }}>Nueva semana</Text>
                <Text style={{ color: colors.accentSoft, fontSize: 13, marginTop: 2 }}>Con las notas del último sermón</Text>
              </View>
            </Pressable>
          </Appear>
          {semanas.map((s, i) => (
            <Appear key={s.id} delay={40 + Math.min(i, 6) * 40}>
              <SemanaCard semana={s} colors={colors} />
            </Appear>
          ))}
          <IconText icon={LockIcon} color={colors.muted} size={13} style={{ marginTop: 8, justifyContent: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 13, flexShrink: 1 }}>Tus notas y tus semanas solo las ves tú.</Text>
          </IconText>
        </>
      )}
    </ScrollView>
  );
}

function SemanaCard({ semana: s, colors }: { semana: Semana; colors: Colors }) {
  const sig = siguiente(s);
  const hecho = hechos(s);
  const desde = fechaDia(s, 0).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
  return (
    <Pressable
      onPress={() => navigate(() => router.push(`/semana/${s.id}` as never), 'forward')}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${s.titulo}, ${s.referencia}, ${hecho} de ${s.dias.length} días`}
    >
      <Text style={[styles.kicker, { color: colors.warm }]}>
        {s.referencia.toUpperCase()}
        {s.predicador ? ` · ${s.predicador.toUpperCase()}` : ''}
      </Text>
      <Text style={[styles.title, { color: colors.text }]}>{s.titulo}</Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
        Desde el {desde} ·{' '}
        {sig === null ? 'Semana completa' : `${hecho} de ${Math.min(s.dias.length, DIAS)} días`}
      </Text>
      <View style={{ marginTop: 16 }}>
        <Ruta semana={s} colors={colors} size={28} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center', gap: 14 },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 26, alignItems: 'center', marginTop: 8 },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: serif, fontSize: 25, lineHeight: 32, textAlign: 'center', marginTop: 14 },
  lead: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  cta: { borderRadius: 24, paddingHorizontal: 22, paddingVertical: 13, marginTop: 24 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 16 },
  addIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 18 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontFamily: serif, fontSize: 23, lineHeight: 29, marginTop: 6 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
