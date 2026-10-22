import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import Appear from '@/components/Appear';
import SelloArte from '@/components/Sello';
import { LockIcon, StarIcon } from '@/components/icons';
import { Estrellas } from '@/components/jovenes/arte';
import { Medallon } from '@/components/ninos/ui';
import { SELLOS_NINOS, estrellasHistoria, historiaAbierta, siguienteHistoria, totalEstrellas, useNinos } from '@/lib/ninos';
import { HISTORIAS } from '@/lib/ninosHistorias';
import { avance, useSellos } from '@/lib/sellos';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

// El camino de historias: las doce como paradas redondas con su ilustración, en zigzag. Se abren en orden; la
// siguiente late un poco, y al final espera el sello «Amigo de la Biblia».
const FILA = 168;
const NODO = 108;
const X = [0.3, 0.7];

export default function CaminoNinos() {
  const colors = useColors();
  const s = useNinos();
  const album = useSellos();
  const [ancho, setAncho] = useState(0);
  const sig = siguienteHistoria(s);
  const hechas = HISTORIAS.filter((h) => s.historias[h.id]).length;
  const centro = (i: number) => ({ x: ancho * X[i % 2], y: NODO / 2 + 10 + i * FILA });
  const final = SELLOS_NINOS.find((x) => x.id === 'ninos-todas')!;
  const { ganado, parte } = avance(album, final);
  const alto = NODO + 20 + HISTORIAS.length * FILA;

  const tramos = HISTORIAS.map((_, i) => {
    const a = centro(i);
    const b = i === HISTORIAS.length - 1 ? { x: ancho / 2, y: a.y + FILA } : centro(i + 1);
    const my = (a.y + b.y) / 2;
    return { d: `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`, hecho: i < hechas };
  });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: '' }} />
      <Appear>
        <View style={[styles.banner, { backgroundColor: colors.warmSoft }]}>
          <Text style={[styles.kicker, { color: colors.warm }]}>{sig === null ? '¡Las escuchaste todas!' : `${hechas} de ${HISTORIAS.length} historias`}</Text>
          <Text style={[styles.titulo, { color: colors.text, fontFamily: serif }]}>Camino de historias</Text>
          <View style={styles.bannerPie}>
            <View style={[styles.pill, { backgroundColor: colors.surface }]}>
              <StarIcon filled color={colors.warm} size={16} />
              <Text style={{ color: colors.text, fontWeight: '800' }}>{totalEstrellas(s)} estrellas</Text>
            </View>
            <Pressable onPress={() => navigate(() => router.push('/sellos'), 'forward')} style={[styles.pill, { backgroundColor: colors.surface }]} accessibilityRole="link">
              <Text style={{ color: colors.text, fontWeight: '800' }}>Mis sellos ›</Text>
            </Pressable>
          </View>
        </View>
      </Appear>

      <View style={{ height: alto + 150, marginTop: 12 }} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
        {ancho > 0 && (
          <>
            <Svg width={ancho} height={alto + 40} style={StyleSheet.absoluteFill}>
              {tramos.map((t, i) => (
                <Path key={i} d={t.d} stroke={t.hecho ? colors.warm : colors.border} strokeWidth={t.hecho ? 6 : 4} strokeDasharray={t.hecho ? undefined : '2 12'} strokeLinecap="round" fill="none" />
              ))}
            </Svg>
            {HISTORIAS.map((h, i) => {
              const c = centro(i);
              const abierta = historiaAbierta(i, s);
              const reg = s.historias[h.id];
              const esSig = i === sig;
              return (
                <View key={h.id} style={[styles.parada, { left: c.x - 90, top: c.y - NODO / 2 }]}>
                  <Pressable
                    disabled={!abierta}
                    onPress={() => navigate(() => router.push(`/ninos/${h.id}` as never), 'forward')}
                    style={({ pressed }) => [pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Historia ${i + 1}: ${h.titulo}${reg ? ', escuchada' : abierta ? '' : ', con candado'}`}
                    testID={`historia-${h.id}`}
                  >
                    <Medallon id={h.id} size={NODO} borde={reg || esSig ? colors.warm : colors.border} grueso={esSig ? 5 : 3} apagado={!abierta} />
                    {!abierta && (
                      <View style={[styles.candado, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <LockIcon color={colors.muted} size={18} />
                      </View>
                    )}
                    {esSig && (
                      <View style={[styles.chip, { backgroundColor: colors.warm }]}>
                        <Text style={{ color: colors.surface, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>{hechas === 0 ? '¡EMPIEZA!' : 'SIGUE'}</Text>
                      </View>
                    )}
                  </Pressable>
                  <View style={[styles.etiqueta, { backgroundColor: colors.background }]}>
                    <Text style={[styles.nombre, { color: abierta ? colors.text : colors.muted }]} numberOfLines={2}>
                      {h.titulo}
                    </Text>
                    {reg && <Estrellas n={estrellasHistoria(reg)} color={colors.warm} vacio={colors.border} size={16} />}
                  </View>
                </View>
              );
            })}
            <View style={[styles.final, { top: alto - 6 }]}>
              <SelloArte dibujo={final.dibujo} colors={colors} ganado={!!ganado} parte={parte} size={96} />
              <Text style={{ color: ganado ? colors.text : colors.muted, fontWeight: '800', fontSize: 16, marginTop: 6 }}>Sello «{final.titulo}»</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{ganado ? '¡Lo ganaste!' : 'Al escuchar las doce'}</Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, maxWidth: 560, width: '100%', alignSelf: 'center' },
  banner: { borderRadius: 26, padding: 20 },
  kicker: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  titulo: { fontSize: 30, marginTop: 4 },
  bannerPie: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  parada: { position: 'absolute', width: 180, alignItems: 'center' },
  candado: { position: 'absolute', right: 2, bottom: 2, width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { position: 'absolute', top: -8, alignSelf: 'center', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  etiqueta: { alignItems: 'center', marginTop: 6, gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  nombre: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  final: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
});
