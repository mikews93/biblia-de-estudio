import { Stack, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, StarIcon } from '@/components/icons';
import { IconoRuta, Medalla, tinte } from '@/components/jovenes/arte';
import { completadas, estrellas, sellosJovenes, siguiente, useJovenes } from '@/lib/jovenes';
import { useSellos } from '@/lib/sellos';
import { RUTAS } from '@/lib/jovenesRutas';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Misiones del Modo Jóvenes: las estrellas, los sellos y las cinco rutas. */
export default function Misiones() {
  const colors = useColors();
  const s = useJovenes();
  const total = Object.values(s).reduce((sum, r) => sum + estrellas(r), 0);
  const hechas = Object.keys(s).length;
  const todas = RUTAS.reduce((n, r) => n + r.misiones.length, 0);
  const album = useSellos();
  const lista = sellosJovenes();
  const ganado = (id: string) => !!album.ganados[id];
  const ganados = lista.filter((x) => ganado(x.id)).length;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Misiones' }} />

      <Appear>
        <View style={[styles.resumen, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cifras}>
            <Cifra valor={total} etiqueta="estrellas" icono={<StarIcon filled color={colors.warm} size={18} />} />
            <View style={[styles.separador, { backgroundColor: colors.border }]} />
            <Cifra valor={`${hechas}/${todas}`} etiqueta="misiones" />
            <View style={[styles.separador, { backgroundColor: colors.border }]} />
            <Cifra valor={`${ganados}/${lista.length}`} etiqueta="sellos" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sellos}>
            {[...lista.filter((x) => ganado(x.id)), ...lista.filter((x) => !ganado(x.id))].map((x) => (
              <Medalla key={x.id} sello={x} colors={colors} size={58} />
            ))}
          </ScrollView>
          <Text style={[styles.nota, { color: colors.muted }]}>
            Las estrellas miden lo que entiendes, piensas y vives, no lo rápido que vas. Un día sin misión no borra nada.
          </Text>
          <Pressable onPress={() => navigate(() => router.push('/sellos' as never), 'forward')} style={styles.album} accessibilityRole="link">
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Ver el álbum de sellos ›</Text>
          </Pressable>
        </View>
      </Appear>

      <Text style={[styles.titulo, { color: colors.text, fontFamily: serif }]}>Rutas</Text>

      {RUTAS.map((ruta, i) => {
        const t = tinte(ruta, colors);
        const n = completadas(ruta, s);
        const next = siguiente(ruta, s);
        return (
          <Appear key={ruta.id} delay={40 + i * 30}>
            <Pressable
              onPress={() => navigate(() => router.push(`/jovenes/${ruta.id}` as never), 'forward')}
              style={({ pressed }) => [styles.ruta, { backgroundColor: t.soft }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${ruta.titulo}, ${n} de ${ruta.misiones.length} misiones`}
              testID={`ruta-${ruta.id}`}
            >
              <View style={styles.glifo} aria-hidden>
                <IconoRuta icono={ruta.id} color={t.accent} size={150} strokeWidth={1.1} />
              </View>
              <Text style={[styles.kicker, { color: t.accent }]}>
                {next === null ? 'Ruta terminada' : n === 0 ? 'Ruta · 6 misiones' : `Ruta · ${n} de ${ruta.misiones.length}`}
              </Text>
              <Text style={[styles.rutaTitulo, { color: colors.text, fontFamily: serif }]}>{ruta.titulo}</Text>
              <Text style={{ color: colors.text, opacity: 0.85, marginTop: 4, fontSize: 15, lineHeight: 21 }}>{ruta.lema}</Text>
              <View style={styles.pasos}>
                {ruta.misiones.map((m, j) => (
                  <View
                    key={m.id}
                    style={[
                      styles.paso,
                      { backgroundColor: j < n ? t.accent : 'transparent', borderColor: t.accent, opacity: j < n || j === next ? 1 : 0.35 },
                    ]}
                  />
                ))}
              </View>
              <View style={[styles.boton, { backgroundColor: t.accent }]}>
                {next === null && <CheckIcon color={t.soft} size={16} strokeWidth={2.2} />}
                <Text style={{ color: t.soft, fontWeight: '700' }}>
                  {next === null ? `Sello «${ruta.sello}»` : n === 0 ? 'Empezar ›' : 'Seguir ›'}
                </Text>
              </View>
            </Pressable>
          </Appear>
        );
      })}
    </ScrollView>
  );
}

function Cifra({ valor, etiqueta, icono }: { valor: number | string; etiqueta: string; icono?: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icono}
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', fontFamily: serif }}>{valor}</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{etiqueta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  resumen: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 18 },
  cifras: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  separador: { width: StyleSheet.hairlineWidth, height: 34 },
  sellos: { gap: 4, paddingHorizontal: 12, paddingTop: 18 },
  nota: { fontSize: 13, lineHeight: 18, paddingHorizontal: 20, marginTop: 10 },
  album: { paddingHorizontal: 20, paddingTop: 10 },
  titulo: { fontSize: 24, marginTop: 6 },
  ruta: { borderRadius: 22, padding: 20, overflow: 'hidden' },
  glifo: { position: 'absolute', right: -18, top: -14, opacity: 0.13 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  rutaTitulo: { fontSize: 26, marginTop: 6 },
  pasos: { flexDirection: 'row', gap: 6, marginTop: 16 },
  paso: { flex: 1, height: 8, borderRadius: 4, borderWidth: 1.5 },
  boton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9, marginTop: 16 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
