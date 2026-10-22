import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, text } from '@/components/comunidad/ui';
import { LINEAS_AYUDA, emergencias, paisDe, telefonoBonito } from '@/lib/pareja';
import { serif, useColors } from '@/lib/theme';

const localeDelTelefono = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
};

/**
 * Ayuda si alguien se siente inseguro en su relación. Es privada: no avisa a la pareja, no se guarda en el
 * historial de la app ni pasa por el servidor. «Salir rápido» vuelve a Hoy reemplazando esta pantalla.
 */
export default function AyudaScreen() {
  const colors = useColors();
  const [pais, setPais] = useState<string | null>(() => paisDe(localeDelTelefono()));
  const [eligiendo, setEligiendo] = useState(false);
  const linea = LINEAS_AYUDA.find((l) => l.pais === pais);
  const salir = () => router.replace('/');
  const llamar = (tel: string) => Linking.openURL(`tel:${tel}`).catch(() => {});

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen
        options={{
          title: 'Ayuda',
          headerRight: () => (
            <Pressable onPress={salir} hitSlop={8} style={[styles.salir, { backgroundColor: colors.accent }]} accessibilityRole="button" accessibilityLabel="Salir rápido">
              <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 13 }}>Salir rápido</Text>
            </Pressable>
          ),
        }}
      />
      <Text style={[styles.title, { color: colors.text }]}>No estás solo ni sola</Text>
      <Text style={[text.body, { color: colors.text, marginTop: 10 }]}>
        Si alguien te lastima, te amenaza, te controla o te da miedo, eso no es tu culpa, y no es algo que se arregle orando más o
        sometiéndose más. Dios no quiere que vivas con miedo.
      </Text>
      <Text style={[text.body, { color: colors.text, marginTop: 10 }]}>
        Cuando hay abuso, la consejería de pareja no es segura. Busca primero ayuda para ti.
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {linea ? (
          <>
            <Text style={[styles.kicker, { color: colors.muted }]}>{linea.nombre.toUpperCase()}</Text>
            <Text style={[styles.linea, { color: colors.text }]}>{linea.linea}</Text>
            <Text style={[styles.numero, { color: colors.accent }]}>{telefonoBonito(linea.tel)}</Text>
            {linea.nota && <Text style={[text.small, { color: colors.muted, marginTop: 4 }]}>{linea.nota}</Text>}
            <Button label={`Llamar al ${telefonoBonito(linea.tel)}`} onPress={() => llamar(linea.tel)} style={{ marginTop: 14 }} />
          </>
        ) : (
          <Text style={[text.body, { color: colors.text }]}>Elige tu país para ver la línea de ayuda gratuita.</Text>
        )}
        {linea?.tel !== emergencias(pais ?? '') && (
          <Button
            label={`Si estás en peligro ahora: ${emergencias(pais ?? '')}`}
            kind="outline"
            onPress={() => llamar(emergencias(pais ?? ''))}
            style={{ marginTop: 10 }}
          />
        )}
        <Pressable onPress={() => setEligiendo(!eligiendo)} hitSlop={6} style={{ marginTop: 14, alignSelf: 'center' }}>
          <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>{eligiendo ? 'Cerrar la lista' : linea ? 'Otro país' : 'Elegir país'}</Text>
        </Pressable>
        {eligiendo && (
          <View style={styles.paises}>
            {LINEAS_AYUDA.map((l) => (
              <Pressable
                key={l.pais}
                onPress={() => {
                  setPais(l.pais);
                  setEligiendo(false);
                }}
                style={[styles.pais, { borderColor: l.pais === pais ? colors.accent : colors.border }]}
              >
                <Text style={{ color: colors.text, fontSize: 14 }}>{l.nombre}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Text style={[text.body, { color: colors.text, marginTop: 20 }]}>
        También puedes hablar con un pastor, una consejera o una persona de confianza que no sea tu pareja.
      </Text>
      <Text style={[text.small, { color: colors.muted, marginTop: 20, lineHeight: 19 }]}>
        Esta pantalla no avisa a tu pareja, no queda en lo que comparten y no se guarda en la app. «Salir rápido» te lleva a la
        pantalla de inicio.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 16, paddingBottom: 64, maxWidth: 560, width: '100%', alignSelf: 'center' },
  salir: { marginRight: 14, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  title: { fontFamily: serif, fontSize: 28, lineHeight: 34 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 20, marginTop: 22 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  linea: { fontFamily: serif, fontSize: 21, marginTop: 4 },
  numero: { fontSize: 34, fontWeight: '700', letterSpacing: 1, marginTop: 6, fontVariant: ['tabular-nums'] },
  paises: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pais: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
});
