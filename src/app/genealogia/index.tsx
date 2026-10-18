// /genealogia: buscar a una persona de la Biblia y abrir su árbol familiar
import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DESTACADAS, FUENTE_GENEALOGIA, Persona, Personas, descripcion, getPersonas, personaHref } from '@/lib/genealogia';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export default function Genealogias() {
  const colors = useColors();
  const [all, setAll] = useState<Personas | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getPersonas().then(setAll, () => {});
  }, []);

  const results = useMemo(() => {
    if (!all) return [];
    const q = plain(query.trim());
    if (!q) return DESTACADAS.map((id) => all.get(id)).filter((p): p is Persona => !!p);
    return [...all.values()]
      .filter((p) => plain(p.nombre).includes(q))
      .sort((a, b) => Number(!plain(a.nombre).startsWith(q)) - Number(!plain(b.nombre).startsWith(q)) || b.versiculos - a.versiculos)
      .slice(0, 40);
  }, [all, query]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Genealogías' }} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Busca una persona: Rut, Isaí, Zorobabel…"
        placeholderTextColor={colors.muted}
        autoFocus
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <Text style={[styles.section, { color: colors.muted }]}>{query.trim() ? 'RESULTADOS' : 'PARA EMPEZAR'}</Text>
      {!all ? (
        <ActivityIndicator color={colors.accent} />
      ) : !results.length ? (
        <Text style={{ color: colors.muted }}>No hay nadie con ese nombre entre las personas con familia conocida.</Text>
      ) : (
        results.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => navigate(() => router.push(personaHref(p) as never), 'forward')}
            style={[styles.row, { borderColor: colors.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontFamily: serif, fontSize: 18 }}>{p.nombre}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{descripcion(p, all)}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{p.versiculos} vv. ›</Text>
          </Pressable>
        ))
      )}
      <Text style={[styles.source, { color: colors.muted }]}>{FUENTE_GENEALOGIA}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 20, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  source: { fontSize: 12, lineHeight: 17, marginTop: 32, textAlign: 'center' },
});
