// /diccionario/635420: un artículo del diccionario bíblico de Tyndale en español (pipeline/build_fuentes_abiertas.py),
// con sus versículos y los enlaces a otros artículos que se pueden tocar. Es el texto de la editorial, sin IA.
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Rich } from '@/components/Commentary';
import { ChevronRightIcon, DictionaryIcon } from '@/components/icons';
import { openRef } from '@/components/Preguntar';
import { Articulo, Book, getArticulo, getBooks } from '@/lib/data';
import { DICCIONARIO_TYNDALE, TIPOS, diccionarioHref } from '@/lib/fuentesAbiertas';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function ArticuloScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const aid = String(id ?? '').replace(/\D/g, '');
  const colors = useColors();
  const [books, setBooks] = useState<Book[]>([]);
  const [loaded, setLoaded] = useState<{ id: string; articulo: Articulo | null; error?: boolean } | null>(null);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);
  useEffect(() => {
    let vivo = true;
    getArticulo(aid).then(
      (articulo) => vivo && setLoaded({ id: aid, articulo }),
      () => vivo && setLoaded({ id: aid, articulo: null, error: true }),
    );
    return () => {
      vivo = false;
    };
  }, [aid]);

  const actual = loaded?.id === aid ? loaded : null;
  const a = actual?.articulo;
  const ir = (href: string) => navigate(() => router.push(href as never), 'forward');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: a?.t ?? 'Diccionario bíblico' }} />
      {!actual ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : !a ? (
        <Text style={[styles.intro, { color: colors.muted }]}>
          {actual.error ? 'No se pudo cargar el artículo. Revisa la conexión.' : 'No encontramos este artículo.'}
        </Text>
      ) : (
        <Appear>
          <Text style={[styles.overline, { color: colors.warm }]}>{TIPOS[a.tipo] ?? 'Diccionario bíblico'}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{a.t}</Text>
          <View style={{ marginTop: 14 }}>
            <Rich text={a.x} books={books} colors={colors} onRef={openRef} onDic={(d) => ir(diccionarioHref(d))} />
          </View>
        </Appear>
      )}

      <Pressable
        onPress={() => ir('/diccionario')}
        accessibilityRole="link"
        style={({ pressed }) => [styles.buscar, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.75 }]}
      >
        <DictionaryIcon color={colors.text} size={18} />
        <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>Buscar otro artículo</Text>
        <ChevronRightIcon color={colors.muted} size={16} />
      </Pressable>
      <Pressable onPress={() => ir('/fuentes')} accessibilityRole="link">
        <Text style={[styles.credit, { color: colors.muted }]}>
          {DICCIONARIO_TYNDALE.credito} <Text style={{ color: colors.accent, fontWeight: '600' }}>Fuentes y créditos</Text>
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  overline: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 },
  title: { fontFamily: serif, fontSize: 32, lineHeight: 38, marginTop: 4 },
  intro: { fontSize: 16, lineHeight: 24, marginTop: 20, textAlign: 'center' },
  buscar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 24 },
  credit: { fontSize: 12, lineHeight: 18, marginTop: 18 },
});
