// /promesas: las promesas de Dios y su cumplimiento, como arcos que van del Antiguo Testamento a Cristo.
import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Appear from '@/components/Appear';
import ArcoPromesas from '@/components/ArcoPromesas';
import { PromiseIcon } from '@/components/icons';
import { HiloCard, abrirHilo } from '@/components/Promesas';
import { Book, getBooks } from '@/lib/data';
import { FUENTE_PROMESAS, HILOS, ORDEN_TEMAS, TEMAS, Tema, espera } from '@/lib/promesas';
import { verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function Promesas() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const dos = width >= 820;
  const [books, setBooks] = useState<Book[]>([]);
  const [tema, setTema] = useState<Tema | undefined>();

  useEffect(() => {
    getBooks().then(setBooks, () => {});
  }, []);

  const citadas = HILOS.filter((h) => h.citado).length;
  const siglos = useMemo(() => {
    const años = HILOS.filter((h) => h.tema !== 'historia' && h.tema !== 'esperanza')
      .map(espera)
      .filter((a): a is number => a != null);
    return Math.round(años.reduce((s, a) => s + a, 0) / años.length / 100);
  }, []);
  const temas = tema ? [tema] : ORDEN_TEMAS;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Promesa y cumplimiento' }} />

      <Appear style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heroHead}>
          <View style={[styles.heroIcon, { backgroundColor: colors.warmSoft }]}>
            <PromiseIcon color={colors.warm} size={24} />
          </View>
          <Text style={[styles.kicker, { color: colors.warm }]}>PROMESA Y CUMPLIMIENTO</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Todas las promesas de Dios son en él Sí</Text>
        <Pressable
          onPress={() => navigate(() => router.push(verseHref('2co', 1, 20)), 'forward')}
          hitSlop={6}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>2 Corintios 1:20 ›</Text>
        </Pressable>
        <Text style={[styles.lead, { color: colors.text }]}>
          Cada arco sale de una promesa y cae donde se cumplió. Mira cómo casi todos convergen en Cristo.
        </Text>
        <ArcoPromesas hilos={HILOS} colors={colors} tema={tema} onHilo={abrirHilo} alto={dos ? 210 : 176} />
        <View style={styles.stats}>
          <Stat value={String(HILOS.length)} label="hilos" colors={colors} />
          <Stat value={String(citadas)} label="citados por el NT" colors={colors} />
          <Stat value={`${siglos} siglos`} label="de espera, en promedio" colors={colors} />
        </View>
      </Appear>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsWrap}>
        <Chip label="Todas" on={!tema} color={colors.accent} colors={colors} onPress={() => setTema(undefined)} />
        {ORDEN_TEMAS.map((t) => (
          <Chip key={t} label={TEMAS[t].corto} on={tema === t} color={TEMAS[t].color} colors={colors} onPress={() => setTema(tema === t ? undefined : t)} />
        ))}
      </ScrollView>

      {temas.map((t) => {
        const lista = HILOS.filter((h) => h.tema === t);
        return (
          <View key={t} style={{ marginTop: 22 }}>
            <View style={styles.seccion}>
              <View style={[styles.punto, { backgroundColor: TEMAS[t].color }]} />
              <Text style={[styles.h2, { color: colors.text }]}>{TEMAS[t].titulo}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{lista.length}</Text>
            </View>
            {t === 'esperanza' && (
              <Text style={[styles.aviso, { color: colors.muted }]}>
                Sin fechas ni cálculos: «del día y hora nadie sabe» (Mateo 24:36). Cada promesa ya cumplida es la garantía de estas.
              </Text>
            )}
            <View style={[styles.grid, dos && styles.gridDos]}>
              {lista.map((h) => (
                <View key={h.id} style={dos ? styles.celda : undefined}>
                  <HiloCard hilo={h} books={books} colors={colors} />
                </View>
              ))}
            </View>
          </View>
        );
      })}

      <Text style={[styles.source, { color: colors.muted }]}>{FUENTE_PROMESAS}</Text>
    </ScrollView>
  );
}

function Stat({ value, label, colors }: { value: string; label: string; colors: Colors }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.text, fontFamily: serif, fontSize: 21, fontWeight: '600' }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function Chip({ label, on, color, colors, onPress }: { label: string; on: boolean; color: string; colors: Colors; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: on ? color : colors.border, backgroundColor: on ? colors.surface : 'transparent' },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.chipPunto, { backgroundColor: color }]} />
      <Text style={{ color: on ? colors.text : colors.muted, fontWeight: on ? '700' : '500', fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 56, maxWidth: 980, width: '100%', alignSelf: 'center' },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, padding: 18, paddingBottom: 14 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  heroIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontFamily: serif, fontSize: 27, lineHeight: 33, fontWeight: '600' },
  lead: { fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 6, opacity: 0.85 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 6 },
  stat: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  chipsWrap: { marginTop: 16, flexGrow: 0 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  chipPunto: { width: 8, height: 8, borderRadius: 4 },
  seccion: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  h2: { fontFamily: serif, fontSize: 21, fontWeight: '600', flexShrink: 1 },
  aviso: { fontSize: 13, lineHeight: 19, marginTop: -4, marginBottom: 12 },
  grid: { gap: 10 },
  gridDos: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 0 },
  celda: { width: '49.2%' },
  source: { fontSize: 12, lineHeight: 17, marginTop: 36, textAlign: 'center' },
});
