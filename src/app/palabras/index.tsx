// /palabras: «La historia de una palabra». La palabra de la semana arriba y, debajo, los temas del catálogo, cada uno
// con su palabra hebrea (Antiguo Testamento) y su palabra griega (Nuevo Testamento).
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import Appear from '@/components/Appear';
import { ChevronRightIcon, WordJourneyIcon } from '@/components/icons';
import { getPalabrasIndex } from '@/lib/data';
import { type Palabra, TEMAS, palabraDeLaSemana, palabraHref } from '@/lib/palabras';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Hover = { pressed: boolean; hovered?: boolean };
type Counts = Record<string, [number, number, number]>;

const open = (id: string) => navigate(() => router.push(palabraHref(id) as never), 'forward');

export default function Palabras() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const columns = width >= 1000 ? 3 : width >= 680 ? 2 : 1;
  const [counts, setCounts] = useState<Counts>({});
  const semana = palabraDeLaSemana();

  useEffect(() => {
    getPalabrasIndex().then(setCounts).catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'La historia de una palabra' }} />
      <ScrollView contentContainerStyle={[styles.content, { maxWidth: columns === 3 ? 1080 : 760 }]}>
        <Appear style={styles.head}>
          <View style={styles.kicker}>
            <WordJourneyIcon color={colors.accent} size={15} strokeWidth={2} />
            <Text style={[styles.kickerText, { color: colors.accent }]}>PALABRAS DEL ORIGINAL</Text>
          </View>
          <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>La historia de una palabra</Text>
          <Text style={[styles.intro, { color: colors.muted }]}>
            Sigue una palabra del hebreo o del griego por toda la Biblia: dónde aparece, cómo se traduce y qué va mostrando de
            un pasaje a otro.
          </Text>
        </Appear>

        <Appear delay={50}>
          <Pressable
            onPress={() => open(semana.id)}
            accessibilityRole="link"
            accessibilityLabel={`Palabra de la semana: ${semana.nombre}`}
            style={({ pressed, hovered }: Hover) => [
              styles.feature,
              { backgroundColor: colors.surface, borderColor: colors.border },
              (hovered || pressed) && { borderColor: colors.muted },
              pressed && { transform: [{ scale: 0.99 }] },
            ]}
          >
            <Text style={[styles.featureKicker, { color: colors.warm }]}>PALABRA DE LA SEMANA · {semana.tema.toUpperCase()}</Text>
            <View style={styles.featureRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.featureOriginal, { color: colors.greek, fontFamily: serif }]}>{semana.original}</Text>
                <Text style={[styles.featureNombre, { color: colors.text, fontFamily: serif }]}>{semana.nombre}</Text>
                <Text style={[styles.featureResumen, { color: colors.muted }]}>{semana.resumen}</Text>
              </View>
              <Journey count={counts[semana.id]?.[0]} colors={colors} />
            </View>
            <View style={[styles.featureCta, { backgroundColor: colors.accent }]}>
              <Text style={{ color: colors.background, fontWeight: '700', fontSize: 14 }}>Seguir su historia</Text>
              <ChevronRightIcon color={colors.background} size={16} strokeWidth={2.2} />
            </View>
          </Pressable>
        </Appear>

        <Text style={[styles.sectionTitle, { color: colors.muted }]}>{`${TEMAS.length} TEMAS · HEBREO Y GRIEGO`}</Text>
        <View style={styles.grid}>
          {TEMAS.map((t, i) => (
            <Appear key={t.tema} delay={80 + Math.min(i, 8) * 25} style={{ width: columns === 1 ? '100%' : columns === 2 ? '48.8%' : '32.2%' }}>
              <View style={[styles.tema, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.temaTitle, { color: colors.text, fontFamily: serif }]}>{t.tema}</Text>
                {t.palabras.map((p, j) => (
                  <WordRow key={p.id} palabra={p} count={counts[p.id]?.[0]} first={j === 0} colors={colors} />
                ))}
              </View>
            </Appear>
          ))}
        </View>

        <Text style={[styles.credit, { color: colors.muted, borderColor: colors.border }]}>
          Palabras, glosas y apariciones del hebreo (TAHOT) y del griego (TAGNT) de STEPBible.org, Tyndale House (CC BY 4.0),
          con el texto de la Reina-Valera 1909.
        </Text>
      </ScrollView>
    </View>
  );
}

function WordRow({ palabra, count, first, colors }: { palabra: Palabra; count?: number; first: boolean; colors: Colors }) {
  const hebreo = palabra.strongs[0].startsWith('H');
  return (
    <Pressable
      onPress={() => open(palabra.id)}
      accessibilityRole="link"
      accessibilityLabel={`${palabra.nombre}, ${hebreo ? 'hebreo' : 'griego'}${count ? `, ${count} veces` : ''}`}
      style={({ pressed, hovered }: Hover) => [
        styles.word,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        (hovered || pressed) && { backgroundColor: colors.accentSoft },
      ]}
    >
      <Text style={[styles.wordOriginal, { color: colors.greek, fontFamily: serif }]} numberOfLines={1}>
        {palabra.original}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.wordNombre, { color: colors.text, fontFamily: serif }]} numberOfLines={1}>
          {palabra.nombre}
        </Text>
        <Text style={[styles.wordMeta, { color: colors.muted }]} numberOfLines={1}>
          {hebreo ? 'AT' : 'NT'}
          {count ? ` · ${count.toLocaleString('es')} veces` : ''}
        </Text>
      </View>
      <ChevronRightIcon color={colors.muted} size={16} strokeWidth={2} />
    </Pressable>
  );
}

/** Un camino de puntos que sube: la palabra que recorre la Biblia. Debajo, cuántas veces aparece. */
function Journey({ count, colors }: { count?: number; colors: Colors }) {
  const dots = [0, 1, 2, 3, 4];
  return (
    <View style={styles.journey} aria-hidden>
      <View style={styles.journeyDots}>
        {dots.map((d) => (
          <View
            key={d}
            style={[
              styles.journeyDot,
              { backgroundColor: d === dots.length - 1 ? colors.warm : colors.greek, opacity: 0.35 + d * 0.16, marginBottom: d * 9 },
            ]}
          />
        ))}
      </View>
      {count !== undefined && (
        <Text style={[styles.journeyCount, { color: colors.text, fontFamily: serif }]}>
          {count.toLocaleString('es')}
          <Text style={{ fontSize: 12, color: colors.muted, fontFamily: undefined }}> veces</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 72, width: '100%', alignSelf: 'center' },
  head: { paddingTop: 20 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kickerText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.8 },
  title: { fontSize: 32, fontWeight: '600', marginTop: 8, lineHeight: 38 },
  intro: { fontSize: 16, lineHeight: 23, marginTop: 8, maxWidth: 560 },
  feature: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 20, marginTop: 22 },
  featureKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 6 },
  featureOriginal: { fontSize: 54, lineHeight: 70 },
  featureNombre: { fontSize: 24, fontStyle: 'italic', marginTop: -6 },
  featureResumen: { fontSize: 15, lineHeight: 21, marginTop: 4 },
  featureCta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 20, paddingLeft: 16, paddingRight: 12, height: 38, marginTop: 16 },
  journey: { alignItems: 'flex-end', gap: 10, paddingBottom: 4 },
  journeyDots: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  journeyDot: { width: 10, height: 10, borderRadius: 5 },
  journeyCount: { fontSize: 22, fontWeight: '700' },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 30, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, justifyContent: 'space-between' },
  tema: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingTop: 14, paddingBottom: 4, overflow: 'hidden' },
  temaTitle: { fontSize: 18, fontWeight: '600', paddingHorizontal: 16, marginBottom: 4 },
  word: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  wordOriginal: { fontSize: 24, lineHeight: 34, width: 112, textAlign: 'right' },
  wordNombre: { fontSize: 16.5, fontStyle: 'italic' },
  wordMeta: { fontSize: 12, marginTop: 1 },
  credit: { fontSize: 11.5, lineHeight: 16, marginTop: 30, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
