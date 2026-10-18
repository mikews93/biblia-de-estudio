// /historia?libro=2ki&cap=18: línea de tiempo de la historia bíblica junto a lo que pasaba en el mundo
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Book, formatRef, getBooks } from '@/lib/data';
import {
  ERAS,
  EVENTOS,
  Evento,
  FUENTE_HISTORIA,
  PERIODOS,
  Periodo,
  REGION_COLORS,
  fechaEvento,
  fechaPeriodo,
  periodoDe,
} from '@/lib/historia';
import { chapterHref, verseHref } from '@/lib/routes';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Item = { kind: 'biblia'; desde: number; p: Periodo } | { kind: 'mundo'; desde: number; e: Evento };

export default function Historia() {
  const params = useLocalSearchParams<{ libro?: string; cap?: string }>();
  const colors = useColors();
  const [books, setBooks] = useState<Book[]>([]);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef<Record<string, number>>({});
  const scrolled = useRef(false);
  const actual = params.libro ? periodoDe(params.libro, Number(params.cap) || 1) : undefined;

  useEffect(() => {
    getBooks().then(setBooks, () => {});
  }, []);

  const eras = useMemo(
    () =>
      ERAS.map((era, i) => {
        const last = i === ERAS.length - 1;
        const inEra = (y: number) => y >= era.desde && (last ? y <= era.hasta + 200 : y < era.hasta);
        const items: Item[] = [
          ...Object.values(PERIODOS)
            .filter((p) => !p.sinFecha && inEra(p.desde))
            .map((p) => ({ kind: 'biblia' as const, desde: p.desde, p })),
          ...EVENTOS.filter((e) => inEra(e.desde)).map((e) => ({ kind: 'mundo' as const, desde: e.desde, e })),
        ].sort((a, b) => a.desde - b.desde || Number(a.kind === 'mundo') - Number(b.kind === 'mundo'));
        return { era, items };
      }),
    [],
  );

  const eraActual = actual
    ? (ERAS.find((e) => !actual.sinFecha && actual.desde >= e.desde && actual.desde < e.hasta) ?? ERAS[0])
    : undefined;

  const go = (href: string) => navigate(() => router.push(href as never), 'forward');
  const openRef = (ref: string) => {
    const [b, c, v] = ref.split('.');
    go(v ? verseHref(b, Number(c), Number(v)) : chapterHref(b, Number(c)));
  };
  // Posición de cada era en la lista y de cada fila dentro de su era
  const eraKey = (titulo: string) => `era-${titulo}`;
  const owner = useRef<Record<string, string>>({});
  const jump = (key: string) => {
    const parent = owner.current[key];
    const y = offsets.current[key];
    if (y == null || (parent && offsets.current[parent] == null)) return false;
    scroll.current?.scrollTo({ y: Math.max(0, y + (parent ? offsets.current[parent] : 0) - 8), animated: true });
    return true;
  };
  const onMeasured = (key: string, y: number, parent?: string) => {
    offsets.current[key] = y;
    if (parent) owner.current[key] = parent;
    const target = actual && !actual.sinFecha ? `p-${actual.id}` : undefined;
    if (!scrolled.current && target) setTimeout(() => !scrolled.current && jump(target) && (scrolled.current = true), 80);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Línea de tiempo' }} />
      <View style={[styles.eraBar, { borderColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.eraBarContent}
        >
          {ERAS.map((era) => {
            const on = era === eraActual;
            return (
              <Pressable
                key={era.titulo}
                onPress={() => jump(eraKey(era.titulo))}
                style={[styles.eraChip, { borderColor: era.color, backgroundColor: on ? era.color : 'transparent' }]}
              >
                <Text style={{ color: on ? '#fff' : colors.text, fontSize: 13 }}>{era.titulo}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.text }]}>La Biblia y el mundo, siglo a siglo</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dotBig, { marginTop: 0, backgroundColor: colors.accent, borderColor: colors.accent }]} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>Historia bíblica: toca para leer</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { marginTop: 0, borderColor: colors.muted }]} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>Lo que pasaba en el mundo</Text>
          </View>
        </View>
        {eras.map(({ era, items }) => (
          <View key={era.titulo} onLayout={(e) => onMeasured(eraKey(era.titulo), e.nativeEvent.layout.y)}>
            <View style={[styles.eraHeader, { backgroundColor: `${era.color}1F`, borderColor: era.color }]}>
              <Text style={[styles.eraKicker, { color: era.color }]}>
                {fechaPeriodo({ id: '', titulo: '', ref: '', desde: era.desde, hasta: Math.min(era.hasta, 100) })}
              </Text>
              <Text style={[styles.eraTitle, { color: colors.text }]}>{era.titulo}</Text>
            </View>
            {era.titulo === ERAS[0].titulo && (
              <Pressable onPress={() => openRef(PERIODOS.origenes.ref)} style={[styles.note, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{PERIODOS.origenes.nota}</Text>
                <Text style={{ color: colors.accent, fontWeight: '600', marginTop: 4 }}>Génesis 1–11 ›</Text>
              </Pressable>
            )}
            {items.map((item, i) => {
              const isLast = i === items.length - 1;
              if (item.kind === 'biblia') {
                const p = item.p;
                const here = p.id === actual?.id;
                return (
                  <Pressable
                    key={`p-${p.id}`}
                    onLayout={(e) => onMeasured(`p-${p.id}`, e.nativeEvent.layout.y, eraKey(era.titulo))}
                    onPress={() => openRef(p.ref)}
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={[styles.year, { color: colors.text, fontWeight: '600' }]}>{fechaPeriodo(p)}</Text>
                    <Rail color={era.color} filled last={isLast} line={`${era.color}55`} />
                    <View
                      style={[
                        styles.bibleCard,
                        {
                          backgroundColor: here ? colors.accentSoft : colors.surface,
                          borderColor: here ? colors.accent : colors.border,
                          borderLeftColor: era.color,
                        },
                      ]}
                    >
                      {here && <Text style={[styles.here, { color: colors.accent }]}>AQUÍ ESTÁS</Text>}
                      <Text style={[styles.bibleTitle, { color: colors.text }]}>{p.titulo}</Text>
                      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                        {books.length ? formatRef(`${p.ref}.1`, books).replace(/:1$/, '') : p.ref} ›
                      </Text>
                    </View>
                  </Pressable>
                );
              }
              const e = item.e;
              const color = REGION_COLORS[e.region];
              return (
                <View key={`e-${e.titulo}`} style={styles.row}>
                  <Text style={[styles.year, { color: colors.muted }]}>{fechaEvento(e)}</Text>
                  <Rail color={color} last={isLast} line={`${era.color}55`} />
                  <View style={{ flex: 1, paddingBottom: 18, paddingTop: 2 }}>
                    <Text style={{ color, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>
                      {e.region.toUpperCase()}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{e.titulo}</Text>
                    <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>{e.texto}</Text>
                    {e.ref && (
                      <Pressable
                        onPress={() => openRef(e.ref!)}
                        hitSlop={6}
                        style={[styles.refPill, { backgroundColor: colors.accentSoft }]}
                      >
                        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                          {books.length ? formatRef(e.ref, books) : e.ref} ›
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        <Text style={[styles.source, { color: colors.muted }]}>{FUENTE_HISTORIA}</Text>
      </ScrollView>
    </View>
  );
}

function Rail({ color, filled, last, line }: { color: string; filled?: boolean; last?: boolean; line: string }) {
  return (
    <View style={styles.rail}>
      <View style={[styles.railLine, { backgroundColor: line }, last && { bottom: '60%' }]} />
      <View
        style={[
          filled ? styles.dotBig : styles.dot,
          { borderColor: color, backgroundColor: filled ? color : 'transparent' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  eraBar: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  eraBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  eraChip: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  content: { padding: 16, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  intro: { fontSize: 24, fontFamily: serif, fontWeight: '600', marginTop: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eraHeader: { borderLeftWidth: 4, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 28, marginBottom: 14 },
  eraKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  eraTitle: { fontSize: 22, fontFamily: serif, fontWeight: '600', marginTop: 1 },
  bibleCard: { flex: 1, borderWidth: 1, borderLeftWidth: 4, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  here: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 2 },
  refPill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  note: { borderRadius: 12, padding: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 4 },
  year: { width: 92, fontSize: 12, paddingTop: 3, textAlign: 'right' },
  rail: { width: 28, alignItems: 'center' },
  railLine: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: 6 },
  dotBig: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 14 },
  bibleTitle: { fontSize: 17, fontFamily: serif, fontWeight: '600' },
  source: { fontSize: 12, lineHeight: 17, marginTop: 32, textAlign: 'center' },
});
