import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import Appear from '@/components/Appear';
import { CheckIcon, LockIcon } from '@/components/icons';
import { Estrellas, IconoRuta, Medalla, tinte } from '@/components/jovenes/arte';
import { Book, getBooks } from '@/lib/data';
import { abierta, claveMision, completadas, estrellas, sellosJovenes, siguiente, useJovenes } from '@/lib/jovenes';
import { useSellos } from '@/lib/sellos';
import { RUTAS } from '@/lib/jovenesRutas';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

// El camino de una ruta: las seis misiones como paradas en zigzag y, al final, el sello.
const FILA = 138;
const NODO = 68;
const X = [0.5, 0.74, 0.5, 0.26, 0.5, 0.74, 0.5];

export default function RutaScreen() {
  const { ruta: id } = useLocalSearchParams<{ ruta: string }>();
  const colors = useColors();
  const s = useJovenes();
  const album = useSellos();
  const [ancho, setAncho] = useState(0);
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const ruta = RUTAS.find((r) => r.id === id);
  if (!ruta) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={{ color: colors.muted }}>Esta ruta no existe.</Text>
      </View>
    );
  }

  const t = tinte(ruta, colors);
  const n = completadas(ruta, s);
  const next = siguiente(ruta, s);
  const sello = sellosJovenes().find((x) => x.id === `jovenes-ruta-${ruta.id}`)!;
  const selloGanado = !!album.ganados[sello.id];
  const centro = (i: number) => ({ x: ancho * X[i], y: NODO / 2 + 8 + i * FILA });
  const nombre = (book: string) => books.find((b) => b.id === book)?.name ?? '';

  // Curvas suaves entre paradas: llenas hasta donde se llegó, punteadas el resto.
  const tramos = Array.from({ length: ruta.misiones.length }, (_, i) => {
    const a = centro(i);
    const b = centro(i + 1);
    const my = (a.y + b.y) / 2;
    return { d: `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`, hecho: i < n };
  });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: '' }} />

      <Appear>
        <View style={[styles.banner, { backgroundColor: t.soft }]}>
          <View style={styles.glifo} aria-hidden>
            <IconoRuta icono={ruta.id} color={t.accent} size={140} strokeWidth={1.1} />
          </View>
          <Text style={[styles.kicker, { color: t.accent }]}>{next === null ? 'Ruta terminada' : `${n} de ${ruta.misiones.length} misiones`}</Text>
          <Text style={[styles.titulo, { color: colors.text, fontFamily: serif }]}>{ruta.titulo}</Text>
          <Text style={{ color: colors.text, opacity: 0.85, marginTop: 4, fontSize: 15, lineHeight: 21 }}>{ruta.lema}</Text>
        </View>
      </Appear>

      <View
        style={{ height: NODO + 16 + ruta.misiones.length * FILA + 40, marginTop: 8 }}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      >
        {ancho > 0 && (
          <>
            <Svg width={ancho} height={NODO + 16 + ruta.misiones.length * FILA} style={StyleSheet.absoluteFill}>
              {tramos.map((tr, i) => (
                <Path
                  key={i}
                  d={tr.d}
                  stroke={tr.hecho ? t.accent : colors.border}
                  strokeWidth={tr.hecho ? 4 : 3}
                  strokeDasharray={tr.hecho ? undefined : '2 9'}
                  strokeLinecap="round"
                  fill="none"
                />
              ))}
            </Svg>

            {ruta.misiones.map((m, i) => {
              const c = centro(i);
              const reg = s[claveMision(ruta.id, m.id)];
              const libre = abierta(ruta, i, s);
              const esSiguiente = i === next;
              return (
                <View key={m.id} style={[styles.parada, { left: c.x - 80, top: c.y - NODO / 2 }]}>
                  <Pressable
                    disabled={!libre}
                    onPress={() => navigate(() => router.push(`/jovenes/${ruta.id}/${m.id}` as never), 'forward')}
                    style={({ pressed }) => [pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Misión ${i + 1}: ${m.titulo}${reg ? ', hecha' : libre ? '' : ', bloqueada'}`}
                    testID={`mision-${m.id}`}
                  >
                    {esSiguiente && <Pulso color={t.accent} />}
                    <View
                      style={[
                        styles.nodo,
                        reg
                          ? { backgroundColor: t.accent, borderColor: t.accent }
                          : esSiguiente
                            ? { backgroundColor: colors.surface, borderColor: t.accent, borderWidth: 4 }
                            : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      {reg ? (
                        <CheckIcon color={t.soft} size={30} strokeWidth={2.4} />
                      ) : libre ? (
                        <Text style={{ color: t.accent, fontSize: 24, fontWeight: '800', fontFamily: serif }}>{i + 1}</Text>
                      ) : (
                        <LockIcon color={colors.muted} size={22} />
                      )}
                    </View>
                  </Pressable>
                  <View style={[styles.etiqueta, { backgroundColor: colors.background }]}>
                    {reg ? (
                      <Estrellas n={estrellas(reg)} color={colors.warm} vacio={colors.border} size={14} />
                    ) : esSiguiente ? (
                      <View style={[styles.chip, { backgroundColor: t.accent }]}>
                        <Text style={{ color: t.soft, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>{n === 0 ? 'EMPIEZA AQUÍ' : 'SIGUIENTE'}</Text>
                      </View>
                    ) : null}
                    <Text style={[styles.mTitulo, { color: libre ? colors.text : colors.muted }]} numberOfLines={1}>
                      {m.titulo}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                      {nombre(m.book)} {m.chapter}:{m.from}-{m.to}
                    </Text>
                  </View>
                </View>
              );
            })}

            <View style={[styles.final, { top: centro(ruta.misiones.length).y - 40 }]}>
              <Medalla sello={sello} colors={colors} size={80} nombre={false} />
              <Text style={{ color: selloGanado ? colors.text : colors.muted, fontWeight: '700', marginTop: 4 }}>Sello «{ruta.sello}»</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{selloGanado ? '¡Lo ganaste!' : 'Al terminar la ruta'}</Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

/** Un halo que late detrás de la parada que sigue. Respeta «reducir movimiento». */
function Pulso({ color }: { color: string }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) return;
        loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1600, useNativeDriver: Platform.OS !== 'web' }));
        loop.start();
      });
    return () => loop?.stop();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulso,
        { borderColor: color, opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, maxWidth: 560, width: '100%', alignSelf: 'center' },
  banner: { borderRadius: 22, padding: 20, overflow: 'hidden' },
  glifo: { position: 'absolute', right: -16, top: -12, opacity: 0.13 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  titulo: { fontSize: 28, marginTop: 6 },
  parada: { position: 'absolute', width: 160, alignItems: 'center' },
  nodo: { width: NODO, height: NODO, borderRadius: NODO / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pulso: { position: 'absolute', width: NODO, height: NODO, borderRadius: NODO / 2, borderWidth: 3 },
  etiqueta: { alignItems: 'center', marginTop: 6, gap: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  chip: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 2 },
  mTitulo: { fontSize: 14, fontWeight: '700' },
  final: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
});
