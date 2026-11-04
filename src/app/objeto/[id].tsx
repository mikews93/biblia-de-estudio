// /objeto/flora-5.2.4: una planta, un animal o un objeto de la Biblia según los manuales de las Sociedades Bíblicas
// Unidas (src/lib/objetos.ts): qué era, cómo se usaba y sus pasajes. Se traduce una vez y queda guardado para todos.
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Rich } from '@/components/Commentary';
import { openRef } from '@/components/Preguntar';
import { Book, formatRef, getBooks } from '@/lib/data';
import { FUENTE_OBJETOS, Objeto, TIPO_OBJETO, getObjeto, getObjetoTexto, separarTitulo, traducirObjeto } from '@/lib/objetos';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const PASAJES = 12;

export default function ObjetoScreen() {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();
  const oid = String(id ?? '');
  return <ObjetoView key={oid} oid={oid} glosa={nombre ? String(nombre) : undefined} />;
}

function ObjetoView({ oid, glosa }: { oid: string; glosa?: string }) {
  const colors = useColors();
  const [books, setBooks] = useState<Book[]>([]);
  const [objeto, setObjeto] = useState<Objeto | null | undefined>(undefined);
  const [texto, setTexto] = useState('');
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');
  const [todos, setTodos] = useState(false);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    getObjeto(oid).then(setObjeto, () => setObjeto(null));
    getObjetoTexto(oid)
      .then((r) => {
        if (r.texto) return r.texto;
        return traducirObjeto(oid, setTexto, ctrl.signal).then((t) => t.texto);
      })
      .then(
        (t) => {
          setTexto(t);
          setListo(true);
        },
        (e: Error) => !ctrl.signal.aborted && setError(e.message),
      );
    return () => ctrl.abort();
  }, [oid]);

  const { titulo, cuerpo } = separarTitulo(texto);
  const nombre = titulo ?? (glosa ? glosa.charAt(0).toUpperCase() + glosa.slice(1) : listo ? objeto?.t : null);
  const refs = objeto?.refs ?? [];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: nombre ?? '' }} />
      {objeto === null ? (
        <Text style={[styles.vacio, { color: colors.muted }]}>No encontramos esta entrada.</Text>
      ) : (
        <Appear>
          <Text style={[styles.overline, { color: colors.warm }]}>{objeto ? TIPO_OBJETO[objeto.tipo] : ' '}</Text>
          {nombre ? (
            <Text style={[styles.title, { color: colors.text }]}>{nombre}</Text>
          ) : (
            <View style={[styles.skeleton, { backgroundColor: colors.border, width: '55%', height: 30, marginTop: 8 }]} />
          )}
          {refs.length > 0 && (
            <View style={styles.chips}>
              {(todos ? refs : refs.slice(0, PASAJES)).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => openRef(r)}
                  accessibilityRole="link"
                  style={({ pressed }) => [styles.chip, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13.5 }}>{books.length ? formatRef(r, books) : r}</Text>
                </Pressable>
              ))}
              {refs.length > PASAJES && !todos && (
                <Pressable onPress={() => setTodos(true)} accessibilityRole="button" style={[styles.chip, { borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13.5 }}>+{refs.length - PASAJES}</Text>
                </Pressable>
              )}
            </View>
          )}
          <View style={{ marginTop: 16 }}>
            {cuerpo ? (
              <Rich text={cuerpo} books={books} colors={colors} onRef={openRef} />
            ) : error ? null : (
              <View style={{ gap: 10 }} accessibilityLabel="Preparando la explicación">
                {(['94%', '88%', '91%', '60%'] as const).map((w) => (
                  <View key={w} style={[styles.skeleton, { backgroundColor: colors.border, width: w }]} />
                ))}
                <Text style={{ color: colors.muted, fontSize: 13 }}>Se prepara en español la primera vez que alguien la abre.</Text>
              </View>
            )}
            {!listo && !!cuerpo && !error && <ActivityIndicator color={colors.accent} style={{ alignSelf: 'flex-start' }} />}
            {!!error && <Text style={{ color: colors.muted, fontSize: 15, marginTop: 8 }}>{error}</Text>}
          </View>
        </Appear>
      )}
      <Pressable onPress={() => navigate(() => router.push('/fuentes' as never), 'forward')} accessibilityRole="link">
        <Text style={[styles.credit, { color: colors.muted }]}>
          {FUENTE_OBJETOS} <Text style={{ color: colors.accent, fontWeight: '600' }}>Fuentes y créditos</Text>
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  overline: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 },
  title: { fontFamily: serif, fontSize: 32, lineHeight: 38, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  chip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  skeleton: { height: 14, borderRadius: 7 },
  vacio: { fontSize: 15, textAlign: 'center', marginTop: 30 },
  credit: { fontSize: 12, lineHeight: 18, marginTop: 28 },
});
