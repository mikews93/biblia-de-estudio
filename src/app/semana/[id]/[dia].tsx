import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AmbienteBoton from '@/components/Ambiente';
import Appear from '@/components/Appear';
import Devotional from '@/components/Devotional';
import { useAmbienteEnPantalla } from '@/lib/ambiente';
import { Book, getBooks } from '@/lib/data';
import { parseRef } from '@/lib/refs';
import { verseHref } from '@/lib/routes';
import { DIAS, fechaDia, marcarHecho, siguiente, useSemanas } from '@/lib/semanas';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Un día de la semana del sermón: la frase del domingo y el devocional guiado de su pasaje. */
export default function DiaScreen() {
  const colors = useColors();
  const { id, dia } = useLocalSearchParams<{ id: string; dia: string }>();
  const { semanas, ready } = useSemanas();
  const [books, setBooks] = useState<Book[]>([]);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useAmbienteEnPantalla();
  const s = semanas.find((w) => w.id === id);
  const i = Number(dia) - 1;
  const d = s?.dias[i];
  const book = d && books.find((b) => b.id === d.pasaje.book);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  if (!s || !d || !book) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: '' }} />
        {ready && (!s || !d) ? <Text style={{ color: colors.muted }}>No encontramos este día.</Text> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  const fecha = fechaDia(s, i).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const open = (ref: string) => {
    const { start } = parseRef(ref);
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };
  // Después de terminar: el día que sigue sin hacer o, si era el último, volver a la semana.
  const despues = siguiente({ ...s, hechos: { ...s.hechos, [i]: s.hechos[i] ?? 'ahora' } });
  const irA = (n: number | null) =>
    navigate(() => router.replace((n === null ? `/semana/${s.id}` : `/semana/${s.id}/${n + 1}`) as never), 'forward');

  return (
    <ScrollView ref={scroll} style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: s.titulo, headerRight: () => <View style={{ marginRight: 12 }}><AmbienteBoton colors={colors} /></View> }} />

      <Appear style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.bannerHead}>
          <Text style={[styles.kicker, { color: colors.warm }]}>
            DÍA {i + 1} DE {s.dias.length} · {fecha.toUpperCase()}
          </Text>
          <View style={styles.dots}>
            {Array.from({ length: Math.min(s.dias.length, DIAS) }, (_, n) => (
              <View
                key={n}
                style={[
                  styles.dot,
                  { backgroundColor: s.hechos[n] ? colors.accent : n === i ? colors.warm : colors.border, width: n === i ? 16 : 6 },
                ]}
              />
            ))}
          </View>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{d.titulo}</Text>
        {!!d.domingo && (
          <View style={[styles.domingo, { borderColor: colors.warm }]}>
            <Text style={[styles.domingoLabel, { color: colors.muted }]}>EL DOMINGO ANOTASTE</Text>
            <Text style={[styles.domingoText, { color: colors.text }]}>«{d.domingo}»</Text>
          </View>
        )}
      </Appear>

      <Devotional
        book={book}
        chapter={d.pasaje.chapter}
        verse={d.pasaje.from}
        hasta={d.pasaje.to}
        text={d.texto}
        sources={s.fuentes}
        busy={false}
        keepKey={`semana:${s.id}:${i}:`}
        onOpen={open}
        onCite={(src) => src.ref && open(src.ref)}
        onStep={() => scroll.current?.scrollTo({ y: 0, animated: true })}
        onSaved={(entrada) => marcarHecho(s.id, i, entrada)}
        after={
          <Pressable
            onPress={() => irA(despues)}
            style={({ pressed }) => [styles.next, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <Text style={[styles.kicker, { color: colors.accent }]}>
              {despues === null ? 'TERMINASTE LA SEMANA' : despues === i + 1 ? 'MAÑANA' : 'TE FALTA'}
            </Text>
            <Text style={{ color: colors.text, fontFamily: serif, fontSize: 19, marginTop: 4 }}>
              {despues === null ? 'Volver a tu semana ›' : `Día ${despues + 1} · ${s.dias[despues].titulo} ›`}
            </Text>
          </Pressable>
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 8, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 18 },
  bannerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, flexShrink: 1 },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  title: { fontFamily: serif, fontSize: 24, lineHeight: 30, marginTop: 8 },
  domingo: { borderLeftWidth: 3, paddingLeft: 12, marginTop: 14 },
  domingoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 3 },
  domingoText: { fontFamily: serif, fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  next: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, marginTop: 14 },
});
