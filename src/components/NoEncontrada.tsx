import { Stack, router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { text } from '@/components/comunidad/ui';
import { ArrowRightIcon, CompassIcon, HomeIcon, SearchIcon } from '@/components/icons';
import { getBooks } from '@/lib/data';
import { type Sugerencia, sugerirRuta } from '@/lib/noEncontrada';
import { isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/**
 * Una dirección que no lleva a ninguna pantalla (src/app/+not-found.tsx) o a un libro o capítulo que no existe
 * (src/components/Reader.tsx). Dice qué dirección llegó, propone la más parecida si la hay y deja volver a Hoy
 * o buscar en la Biblia, en vez de quedarse en blanco.
 */
export default function NoEncontrada({ path: dada, sugerencia: propuesta }: { path?: string; sugerencia?: Sugerencia }) {
  const colors = useColors();
  const actual = usePathname();
  const path = dada ?? actual;
  const sugerencia = propuesta ?? sugerirRuta(path);
  const nombre = useNombre(sugerencia);

  // Google no debe guardar estas direcciones como páginas.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = 'Página no encontrada · Zarza';
    return () => {
      meta.remove();
      document.title = antes;
    };
  }, []);

  let mostrada = path;
  try {
    mostrada = decodeURIComponent(path);
  } catch {}

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} testID="no-encontrada">
      <Stack.Screen options={{ title: '' }} />
      <Appear>
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.surface, borderColor: colors.border },
            !isDark(colors) && { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' },
          ]}
        >
          <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
            <CompassIcon color={colors.accent} size={32} />
          </View>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            Esta página no existe
          </Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center', maxWidth: 420 }]}>
            Puede que el enlace esté incompleto o tenga una letra de más. Lo demás de Zarza sigue aquí.
          </Text>
          <View style={[styles.address, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text selectable numberOfLines={2} style={[styles.mono, { color: colors.muted }]}>
              zarzabiblia.com{mostrada}
            </Text>
          </View>
        </View>
      </Appear>

      {sugerencia && (
        <Appear delay={80}>
          <Pressable
            onPress={() => navigate(() => router.replace(sugerencia.href as never), 'forward')}
            accessibilityRole="link"
            accessibilityLabel={`Abrir ${nombre}`}
            testID="no-encontrada-sugerencia"
            style={({ pressed }) => [
              styles.suggestion,
              { backgroundColor: colors.surface, borderColor: colors.accent },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.small, { color: colors.muted }]}>¿Querías abrir…?</Text>
              <Text style={[styles.suggestionName, { color: colors.text }]}>{nombre}</Text>
            </View>
            <ArrowRightIcon color={colors.accent} size={20} />
          </Pressable>
        </Appear>
      )}

      <Appear delay={sugerencia ? 140 : 80}>
        <View style={styles.actions}>
          <Pressable
            onPress={() => navigate(() => router.replace('/'), 'back')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, { backgroundColor: colors.accent }, pressed && { opacity: 0.8 }]}
          >
            <HomeIcon color={colors.background} size={18} />
            <Text style={{ color: colors.background, fontWeight: '700', fontSize: 15 }}>Volver a Hoy</Text>
          </Pressable>
          <Pressable
            onPress={() => navigate(() => router.replace('/buscar'), 'forward')}
            accessibilityRole="link"
            style={({ pressed }) => [styles.button, { borderColor: colors.accent, borderWidth: 1 }, pressed && { opacity: 0.8 }]}
          >
            <SearchIcon color={colors.accent} size={18} />
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>Buscar en la Biblia</Text>
          </Pressable>
        </View>
      </Appear>

      <Appear delay={sugerencia ? 200 : 140}>
        <View style={styles.verse}>
          <Text style={[styles.verseText, { color: colors.muted }]}>
            «Porque el Hijo del hombre vino á buscar y á salvar lo que se había perdido».
          </Text>
          <Text style={[text.small, { color: colors.muted, marginTop: 4, opacity: 0.8 }]}>Lucas 19:10</Text>
        </View>
      </Appear>
    </ScrollView>
  );
}

/** «Juan 3:16» con el nombre de books.json; mientras carga, la dirección propuesta. */
function useNombre(s: Sugerencia | null) {
  const [libros, setLibros] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!s?.libro) return;
    getBooks()
      .then((b) => setLibros(Object.fromEntries(b.map((x) => [x.id, x.name]))))
      .catch(() => {});
  }, [s?.libro]);
  if (!s) return '';
  if (!s.libro) return s.nombre;
  return libros[s.libro] ? `${libros[s.libro]} ${s.nombre}` : s.href;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingBottom: 96, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 12, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  emblem: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  address: { alignSelf: 'stretch', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 14, marginTop: 4 },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }),
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 18 },
  suggestionName: { fontFamily: serif, fontSize: 19, fontWeight: '700' },
  actions: { gap: 10 },
  button: { flexDirection: 'row', gap: 8, justifyContent: 'center', borderRadius: 24, paddingVertical: 13, alignItems: 'center' },
  verse: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  verseText: { fontFamily: serif, fontSize: 15.5, lineHeight: 23, textAlign: 'center', fontStyle: 'italic' },
});
