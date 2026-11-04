// /fuentes: todas las obras de otros que usa Zarza, con su autor, su licencia y qué aporta (src/lib/fuentesCreditos.ts).
// Junto al contenido basta un enlace corto «Fuentes»: el crédito completo que piden CC BY y CC BY-SA está aquí.
import { Stack } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { type Credito, GRUPOS, LICENCIAS } from '@/lib/fuentesCreditos';
import { Colors, serif, useColors } from '@/lib/theme';

export default function FuentesScreen() {
  const colors = useColors();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Fuentes y créditos' }} />
      <Appear>
        <Text style={[styles.overline, { color: colors.warm }]}>Gracias a quienes las escribieron</Text>
        <Text style={[styles.title, { color: colors.text }]}>Fuentes y créditos</Text>
        <Text style={[styles.intro, { color: colors.muted }]}>
          Zarza se apoya en obras de dominio público y en obras con licencia libre. Las de dominio público se pueden usar
          sin permiso. Las de licencia Creative Commons piden nombrar al autor y decir qué se cambió, y las «CC BY-SA» además
          piden compartir lo derivado con la misma licencia: por eso nuestras traducciones de esas obras también son libres.
        </Text>
      </Appear>
      {GRUPOS.map((g, gi) => (
        <Appear key={g.id} delay={30 + gi * 25} style={{ marginTop: 26 }}>
          <Text style={[styles.grupo, { color: colors.text }]}>{g.titulo}</Text>
          <View style={[styles.lista, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {g.items.map((c, i) => (
              <Item key={c.obra} c={c} colors={colors} primero={i === 0} />
            ))}
          </View>
        </Appear>
      ))}
      <Text style={[styles.pie, { color: colors.muted }]}>
        Las obras con derechos (NBLA, LBLA, NTV, NVI y NIV) se leen con permiso de sus editores y llevan su aviso en cada
        capítulo. Este listado no da permiso sobre ellas. ¿Ves un crédito que falta o está mal? Escríbenos a
        soporte@zarzabiblia.com.
      </Text>
    </ScrollView>
  );
}

function Item({ c, colors, primero }: { c: Credito; colors: Colors; primero: boolean }) {
  const lic = LICENCIAS[c.licencia];
  return (
    <View style={[styles.item, !primero && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
      <Text style={[styles.obra, { color: colors.text }]}>{c.obra}</Text>
      <Text style={[styles.autor, { color: colors.muted }]}>{[c.autor, c.año].filter(Boolean).join(' · ')}</Text>
      <Text style={[styles.uso, { color: colors.text }]}>{c.uso}</Text>
      {!!c.cambios && <Text style={[styles.cambios, { color: colors.muted }]}>{c.cambios}</Text>}
      <View style={styles.acciones}>
        <Pressable
          disabled={!lic}
          onPress={() => lic && Linking.openURL(lic)}
          accessibilityRole={lic ? 'link' : undefined}
          style={[styles.licencia, { backgroundColor: colors.accentSoft }]}
        >
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{c.licencia}</Text>
        </Pressable>
        {!!c.url && (
          <Pressable onPress={() => Linking.openURL(c.url!)} accessibilityRole="link" hitSlop={6}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Ver la obra original ›</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  overline: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 },
  title: { fontFamily: serif, fontSize: 32, lineHeight: 38, marginTop: 4 },
  intro: { fontSize: 15.5, lineHeight: 23, marginTop: 10 },
  grupo: { fontFamily: serif, fontSize: 21, marginBottom: 10 },
  lista: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  item: { padding: 16, gap: 3 },
  obra: { fontSize: 16, fontWeight: '700' },
  autor: { fontSize: 13 },
  uso: { fontSize: 14.5, lineHeight: 21, marginTop: 4 },
  cambios: { fontSize: 13, lineHeight: 19 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, flexWrap: 'wrap' },
  licencia: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pie: { fontSize: 12.5, lineHeight: 19, textAlign: 'center', marginTop: 30 },
});
