// /buscar?q=…: búsqueda por idea («versículos sobre la ansiedad»)
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Appear from '@/components/Appear';
import { IdeaResult, searchByIdea } from '@/lib/buscar';
import { parseRef } from '@/lib/data';
import { verseHref } from '@/lib/routes';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const IDEAS = ['La ansiedad', 'Cuando Dios parece tardar', 'Perdonar a quien me hirió', 'Dar gracias en la prueba'];

export default function SearchByIdea() {
  const colors = useColors();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [asked, setAsked] = useState('');
  const [results, setResults] = useState<IdeaResult[] | null>(null);
  const [note, setNote] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = async (q: string) => {
    const text = q.trim();
    if (text.length < 3) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setQuery(text);
    setAsked(text);
    setBusy(true);
    setError(null);
    setResults(null);
    router.setParams({ q: text });
    try {
      const r = await searchByIdea(text, controller.signal);
      setResults(r.results);
      setNote(r.note);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo hacer la búsqueda.');
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };

  useEffect(() => {
    if (params.q) run(params.q);
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.lead, { color: colors.muted }]}>
        Escribe una idea, una situación o una pregunta. La IA propone pasajes y después los comprueba uno por uno contra el
        texto de la Reina-Valera 1909.
      </Text>
      <View style={[styles.searchRow, { backgroundColor: colors.accentSoft }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => run(query)}
          placeholder="Por ejemplo: versículos sobre la ansiedad"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          maxLength={200}
          autoFocus={!params.q}
          style={[styles.input, { color: colors.text }]}
        />
        <Pressable
          onPress={() => run(query)}
          disabled={busy || query.trim().length < 3}
          style={[styles.go, { backgroundColor: busy || query.trim().length < 3 ? colors.border : colors.accent }]}
          accessibilityLabel="Buscar"
        >
          <Text style={{ color: colors.surface, fontWeight: '700' }}>Buscar</Text>
        </Pressable>
      </View>

      {!asked && (
        <View style={styles.ideas}>
          {IDEAS.map((i) => (
            <Pressable key={i} onPress={() => run(i)} style={[styles.chip, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 14 }}>{i}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {busy && (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>
            Buscando pasajes y leyéndolos para confirmar que hablan de «{asked}»…
          </Text>
        </View>
      )}

      {error && <Text style={[styles.waiting, { color: colors.text, textAlign: 'center' }]}>{error}</Text>}

      {results && !results.length && (
        <Text style={[styles.waiting, { color: colors.muted, textAlign: 'center' }]}>
          No encontré pasajes que hablen claramente de «{asked}». Prueba a decirlo con otras palabras.
        </Text>
      )}

      {note && results?.length ? (
        <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{note}</Text>
        </View>
      ) : null}

      {results?.map((r) => (
        <Appear key={r.ref}>
          <Pressable onPress={() => open(r.ref)} style={[styles.result, { borderColor: colors.border }]}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{r.label}</Text>
            <Text style={[styles.text, { color: colors.text }]}>{r.text}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6 }}>{r.reason}</Text>
          </Pressable>
        </Appear>
      ))}

      {results?.length ? (
        <Text style={[styles.credit, { color: colors.muted }]}>
          Búsqueda con IA. Los textos son los de la Reina-Valera 1909 tal como están en la app; la IA solo los elige y
          explica por qué responden a tu búsqueda.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  lead: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingLeft: 14, padding: 5 },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  go: { borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  waiting: { alignItems: 'center', marginTop: 32 },
  note: { borderRadius: 10, padding: 12, marginTop: 16 },
  result: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { fontFamily: serif, fontSize: 17, lineHeight: 25, marginTop: 4 },
  credit: { fontSize: 11, marginTop: 20 },
});
