// /herejias: las herejías que la Iglesia rechazó a lo largo de su historia, por época (src/lib/herejias.ts). Cada una
// dice qué enseñaba, quién la refutó y un pasaje clave; «Leer la explicación» abre su pregunta preparada en
// /preguntar, que la IA responde una vez con las fuentes de historia de la Iglesia y queda guardada para todos.
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { ChevronRightIcon, ScrollIcon, ShieldIcon } from '@/components/icons';
import { openRef, preguntarHref } from '@/components/Preguntar';
import { getBooks, type Book } from '@/lib/data';
import { parseCita } from '@/lib/cita';
import { EPOCAS, HEREJIAS, type Herejia } from '@/lib/herejias';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function HerejiasScreen() {
  const colors = useColors();
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Herejías y concilios' }} />
      <Appear>
        <Text style={[styles.overline, { color: colors.warm }]}>Historia de la Iglesia</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>Herejías y concilios</Text>
        <Text style={[styles.intro, { color: colors.muted }]}>
          Desde los apóstoles, la Iglesia ha tenido que responder a enseñanzas que torcían quién es Dios, quién es Cristo o cómo
          nos salva. Aquí están las principales, en orden: qué enseñaban, quién las refutó con la Escritura y dónde se
          rechazaron.
        </Text>
      </Appear>

      {EPOCAS.map((e, ei) => {
        const lista = HEREJIAS.filter((h) => h.epoca === e.id);
        if (!lista.length) return null;
        return (
          <Appear key={e.id} delay={40 + ei * 30} style={styles.epoca}>
            <View style={styles.epocaHead}>
              <View style={[styles.dot, { backgroundColor: e.id === 'hoy' ? colors.warm : colors.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.siglos, { color: colors.muted }]}>{e.siglos}</Text>
                <Text style={[styles.epocaNombre, { color: colors.text, fontFamily: serif }]}>{e.nombre}</Text>
              </View>
            </View>
            {e.id === 'hoy' && (
              <Text style={[styles.nota, { color: colors.muted, borderColor: colors.border }]}>
                Con respeto por las personas: aquí solo se compara lo que enseñan con lo que la Iglesia ya respondió. La app no
                usa sus materiales.
              </Text>
            )}
            <View style={[styles.rail, { borderColor: colors.border }]}>
              {lista.map((h) => (
                <Tarjeta key={h.id} h={h} colors={colors} books={books} />
              ))}
            </View>
          </Appear>
        );
      })}

      <Text style={[styles.pie, { color: colors.muted }]}>
        Las explicaciones las prepara la IA de la app con la Biblia, los credos antiguos, la Historia de la Iglesia de Philip
        Schaff y los Padres que respondieron a cada error (Ireneo, Tertuliano, Hipólito, Atanasio). Puede equivocarse: revisa
        las citas.
      </Text>
    </ScrollView>
  );
}

function Tarjeta({ h, colors, books }: { h: Herejia; colors: Colors; books: Book[] }) {
  const cita = books.length ? parseCita(h.pasaje, books) : null;
  const ref = cita && !cita.problem && cita.verse !== undefined ? `${cita.book}.${cita.chapter}.${cita.verse}` : null;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.nombre, { color: colors.text, fontFamily: serif }]}>{h.nombre}</Text>
      <Text style={[styles.idea, { color: colors.text }]}>{h.idea}</Text>
      <View style={styles.respuesta}>
        <ShieldIcon color={colors.muted} size={15} />
        <Text style={[styles.respuestaText, { color: colors.muted }]}>{h.respuesta}</Text>
      </View>
      <View style={styles.acciones}>
        <Pressable
          onPress={() => ref && openRef(ref)}
          disabled={!ref}
          accessibilityRole="link"
          accessibilityLabel={`Leer ${h.pasaje}`}
          style={({ pressed }) => [styles.pasaje, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
        >
          <ScrollIcon color={colors.text} size={14} />
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{h.pasaje}</Text>
        </Pressable>
        <Pressable
          onPress={() => navigate(() => router.push(preguntarHref(h.pregunta) as never), 'forward')}
          accessibilityRole="link"
          style={({ pressed }) => [styles.leer, pressed && styles.pressed]}
          hitSlop={6}
        >
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>Leer la explicación</Text>
          <ChevronRightIcon color={colors.accent} size={15} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  overline: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 },
  title: { fontSize: 32, lineHeight: 38, marginTop: 4 },
  intro: { fontSize: 16, lineHeight: 24, marginTop: 10 },
  epoca: { marginTop: 28 },
  epocaHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, marginLeft: 3 },
  siglos: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  epocaNombre: { fontSize: 22, lineHeight: 28 },
  nota: { fontSize: 14, lineHeight: 20, borderLeftWidth: 2, paddingLeft: 12, marginLeft: 26, marginBottom: 12 },
  rail: { borderLeftWidth: 2, marginLeft: 8, paddingLeft: 16, gap: 12 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 8 },
  nombre: { fontSize: 20, lineHeight: 26 },
  idea: { fontSize: 15, lineHeight: 22 },
  respuesta: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  respuestaText: { fontSize: 14, lineHeight: 20, flex: 1 },
  acciones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  pasaje: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  leer: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pressed: { opacity: 0.75 },
  pie: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 32 },
});
