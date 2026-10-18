// /genealogia: buscar a una persona de la Biblia y abrir su árbol familiar
import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, TreeIcon } from '@/components/Avatar';
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
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}>
          <TreeIcon color={colors.accent} size={26} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Las familias de la Biblia</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            {all ? `${all.size.toLocaleString('es')} personas` : 'Personas'} con sus padres, hijos y linaje.
          </Text>
        </View>
      </View>
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
            style={({ pressed }) => [
              styles.row,
              { borderColor: colors.border, backgroundColor: colors.surface },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Avatar persona={p} colors={colors} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontFamily: serif, fontSize: 18 }}>{p.nombre}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={2}>
                {descripcion(p, all)}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>{p.versiculos} vv.</Text>
            </View>
          </Pressable>
        ))
      )}
      <Text style={[styles.source, { color: colors.muted }]}>{FUENTE_GENEALOGIA}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 24, fontWeight: '600' },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  source: { fontSize: 12, lineHeight: 17, marginTop: 32, textAlign: 'center' },
});
