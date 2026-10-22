import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { IconText } from '@/components/comunidad/ui';
import { CheckIcon, ChevronRightIcon, LockIcon, PencilIcon } from '@/components/icons';
import { Ruta } from '@/components/SemanaSermon';
import { DIAS, type Dia, type Semana, borrarSemana, diaDeHoy, fechaDia, hechos, siguiente, useSemanas } from '@/lib/semanas';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Una semana del sermón: el resumen, los cinco días y las notas del domingo. */
export default function SemanaScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { semanas, ready } = useSemanas();
  const s = semanas.find((w) => w.id === id);
  const [notas, setNotas] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (!s) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: '' }} />
        {ready ? <Text style={{ color: colors.muted }}>No encontramos esta semana.</Text> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  const hoy = diaDeHoy(s);
  const sig = siguiente(s);
  const hecho = hechos(s);
  const abrir = (i: number) => navigate(() => router.push(`/semana/${s.id}/${i + 1}` as never), 'forward');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: '' }} />

      <Appear style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.kicker, { color: colors.warm }]}>
          SERMÓN · {s.referencia.toUpperCase()}
        </Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>{s.titulo}</Text>
        {!!s.predicador && <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>Predicó {s.predicador}</Text>}
        <View style={{ marginTop: 20 }}>
          <Ruta semana={s} colors={colors} />
        </View>
        {sig !== null ? (
          <Pressable
            onPress={() => abrir(sig)}
            style={({ pressed }) => [styles.next, { backgroundColor: colors.accent }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.accentSoft, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>
                {hecho === 0 ? 'EMPIEZA AQUÍ' : sig === hoy ? 'TE TOCA HOY' : 'SIGUE CON'}
              </Text>
              <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 16, marginTop: 2 }} numberOfLines={1}>
                Día {sig + 1} · {s.dias[sig].titulo}
              </Text>
            </View>
            <Text style={{ color: colors.accentSoft, fontSize: 13 }}>10 min ›</Text>
          </Pressable>
        ) : (
          <View style={[styles.complete, { backgroundColor: colors.accentSoft }]}>
            <CheckIcon color={colors.accent} size={18} strokeWidth={2.4} />
            <Text style={{ color: colors.text, flex: 1, fontSize: 15 }}>
              Terminaste la semana. Lo que escribiste cada día está en tu diario.
            </Text>
          </View>
        )}
      </Appear>

      <Text style={[styles.section, { color: colors.muted }]}>
        TUS {DIAS} DÍAS · {hecho} {hecho === 1 ? 'HECHO' : 'HECHOS'}
      </Text>
      {s.dias.map((d, i) => (
        <Appear key={i} delay={60 + i * 50}>
          <DiaCard semana={s} dia={d} i={i} hoy={hoy === i} colors={colors} onPress={() => abrir(i)} last={i === s.dias.length - 1} />
        </Appear>
      ))}

      <Appear delay={320} style={[styles.notas, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable onPress={() => setNotas(!notas)} style={styles.notasHead} accessibilityRole="button" accessibilityState={{ expanded: notas }}>
          <IconText icon={PencilIcon} color={colors.accent} size={15}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Tus notas del domingo</Text>
          </IconText>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>{notas ? 'Ocultar' : 'Ver'}</Text>
        </Pressable>
        {notas && <Text style={[styles.notasText, { color: colors.text }]}>{s.notas}</Text>}
      </Appear>

      <View style={styles.footer}>
        <IconText icon={LockIcon} color={colors.muted} size={12}>
          <Text style={{ color: colors.muted, fontSize: 12, flexShrink: 1 }}>Preparada con IA a partir de tus notas y del texto · Solo tú la ves</Text>
        </IconText>
        <Pressable
          onPress={async () => {
            if (!confirm) return setConfirm(true);
            await borrarSemana(s.id);
            navigate(() => (router.canGoBack() ? router.back() : router.replace('/semana' as never)), 'back');
          }}
          onBlur={() => setConfirm(false)}
          hitSlop={6}
          accessibilityRole="button"
        >
          <Text style={{ color: confirm ? '#B3261E' : colors.muted, fontSize: 13, fontWeight: confirm ? '700' : '500' }}>
            {confirm ? 'Toca otra vez para borrar la semana' : 'Borrar esta semana'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function DiaCard({
  semana,
  dia,
  i,
  hoy,
  colors,
  onPress,
  last,
}: {
  semana: Semana;
  dia: Dia;
  i: number;
  hoy: boolean;
  colors: Colors;
  onPress: () => void;
  last: boolean;
}) {
  const fecha = fechaDia(semana, i);
  const hecho = !!semana.hechos[i];
  return (
    <View style={styles.diaRow}>
      {/* La línea del camino une los días, como la ruta de arriba. */}
      <View style={styles.rail}>
        <View
          style={[
            styles.railDot,
            {
              backgroundColor: hecho ? colors.accent : colors.background,
              borderColor: hecho || hoy ? colors.accent : colors.border,
              borderWidth: hoy && !hecho ? 2 : 1.5,
            },
          ]}
        >
          {hecho ? (
            <CheckIcon color={colors.surface} size={13} strokeWidth={2.6} />
          ) : (
            <Text style={{ color: hoy ? colors.accent : colors.muted, fontFamily: serif, fontSize: 14 }}>{i + 1}</Text>
          )}
        </View>
        {!last && <View style={[styles.railLine, { backgroundColor: colors.border }]} />}
      </View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.dia,
          { backgroundColor: colors.surface, borderColor: hoy && !hecho ? colors.accent : colors.border },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Día ${i + 1}, ${dia.titulo}${hecho ? ', hecho' : hoy ? ', hoy' : ''}`}
      >
        <View style={styles.diaHead}>
          <Text style={[styles.diaKicker, { color: hoy ? colors.accent : colors.muted }]}>
            {cap(fecha.toLocaleDateString('es', { weekday: 'long', day: 'numeric' })).toUpperCase()}
            {hoy ? ' · HOY' : ''}
          </Text>
          {hecho && (
            <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>HECHO</Text>
            </View>
          )}
        </View>
        <Text style={[styles.diaTitle, { color: colors.text }]}>{dia.titulo}</Text>
        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 2 }}>{dia.referencia}</Text>
        {!!dia.domingo && (
          <View style={[styles.quote, { borderColor: colors.warm }]}>
            <Text style={[styles.quoteText, { color: colors.muted }]} numberOfLines={2}>
              «{dia.domingo}»
            </Text>
          </View>
        )}
        <View style={styles.diaGo}>
          <ChevronRightIcon color={colors.muted} size={18} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 22 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  heroTitle: { fontFamily: serif, fontSize: 30, lineHeight: 37, marginTop: 8 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, marginTop: 20 },
  complete: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14, marginTop: 20 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginTop: 28, marginBottom: 12 },
  diaRow: { flexDirection: 'row', gap: 12 },
  rail: { width: 30, alignItems: 'center' },
  railDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  railLine: { width: 2, flex: 1, marginTop: 4, marginBottom: -16 },
  dia: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 16, paddingRight: 36, marginBottom: 12 },
  diaHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  diaKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  badge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  diaTitle: { fontFamily: serif, fontSize: 20, lineHeight: 26, marginTop: 6 },
  quote: { borderLeftWidth: 2, paddingLeft: 10, marginTop: 10 },
  quoteText: { fontFamily: serif, fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  diaGo: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  notas: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 16, marginTop: 14 },
  notasHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notasText: { fontFamily: serif, fontSize: 16, lineHeight: 25, marginTop: 12 },
  footer: { alignItems: 'center', gap: 14, marginTop: 22 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
