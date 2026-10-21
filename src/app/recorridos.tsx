// /recorridos: los viajes que el mapa puede seguir mientras se lee o se escucha.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Appear from '@/components/Appear';
import JourneyMap from '@/components/JourneyMap';
import { ChevronRightIcon, DramaIcon } from '@/components/icons';
import { recordingId, useCatalog } from '@/lib/audio';
import { getBasemap } from '@/lib/data';
import { JOURNEYS, ResolvedStop, distanceKm, formatKm, recorridoHref, resolveStops } from '@/lib/recorridos';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function Recorridos() {
  const colors = useColors();
  const catalog = useCatalog();
  const { width } = useWindowDimensions();
  const columns = width >= 1100 ? 3 : width >= 700 ? 2 : 1;
  const [stops, setStops] = useState<Record<string, ResolvedStop[]>>({});

  useEffect(() => {
    getBasemap()
      .then((b) => b.land)
      .catch(() => [])
      .then((land) => Promise.all(JOURNEYS.map(async (j) => [j.id, await resolveStops(j, land)] as const)))
      .then((list) => setStops(Object.fromEntries(list)));
  }, []);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>El mapa que sigue la lectura</Text>
      <Text style={[styles.lead, { color: colors.muted }]}>
        Escucha el capítulo o avanza a tu ritmo: el mapa va a cada lugar que se nombra y traza el camino parada por parada.
      </Text>
      <View style={[styles.grid, { marginHorizontal: -6 }]}>
        {JOURNEYS.map((j, i) => {
          const first = j.stops[0];
          const list = stops[j.id];
          const drama = [...new Set(j.stops.map((st) => recordingId(st.book, st.chapter)))].some((id) => catalog.dramatizado.includes(id));
          return (
            <Appear key={j.id} delay={i * 40} style={{ width: `${100 / columns}%`, padding: 6 }}>
              <Pressable
                onPress={() => navigate(() => router.push(recorridoHref(first.book, first.chapter, first.verse) as never), 'forward')}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: hovered ? colors.warm : colors.border },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${j.title}. ${j.short}`}
              >
                <View pointerEvents="none">
                  {list ? (
                    <JourneyMap colors={colors} height={150} stops={list} current={list.length - 1} still />
                  ) : (
                    <View style={[styles.placeholder, { backgroundColor: colors.accentSoft }]} />
                  )}
                </View>
                <View style={styles.body}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.text, fontFamily: serif }]}>{j.title}</Text>
                    <Text style={[styles.short, { color: colors.muted }]}>{j.short}</Text>
                    <View style={styles.meta}>
                      <Text style={[styles.metaText, { color: colors.warm }]}>
                        {j.stops.length} paradas{list ? ` · ${formatKm(distanceKm(list))} km` : ''}
                      </Text>
                      {drama && (
                        <View style={[styles.badge, { backgroundColor: colors.warmSoft }]}>
                          <DramaIcon color={colors.warm} size={13} />
                          <Text style={[styles.badgeText, { color: colors.warm }]}>Dramatizado</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <ChevronRightIcon color={colors.muted} size={20} />
                </View>
              </Pressable>
            </Appear>
          );
        })}
      </View>
      <Text style={[styles.credit, { color: colors.muted }]}>
        Cualquier capítulo que nombre lugares también se puede seguir en el mapa: búscalo en las herramientas del capítulo.
        Lugares: OpenBible.info (CC BY 4.0).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 56, maxWidth: 1180, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  lead: { fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 14, maxWidth: 620 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 8, overflow: 'hidden' },
  placeholder: { height: 150, borderRadius: 12 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8 },
  name: { fontSize: 19, fontWeight: '700' },
  short: { fontSize: 13, marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  credit: { fontSize: 12, lineHeight: 18, marginTop: 16 },
});
