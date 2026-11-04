// /diccionario: buscar en los 5.800 artículos del diccionario bíblico de Tyndale en español, o recorrerlos por letra.
// ?q=gracia abre con la búsqueda hecha (así llega desde el buscador).
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Appear from '@/components/Appear';
import { ChevronRightIcon, SearchIcon } from '@/components/icons';
import { FilaDiccionario, getDiccionarioIndice } from '@/lib/data';
import { DICCIONARIO_TYNDALE, TIPOS, buscarArticulos, diccionarioHref } from '@/lib/fuentesAbiertas';
import { sinAcentos } from '@/lib/preguntarTexto';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const PARA_EMPEZAR = ['Gracia', 'Pacto', 'Tabernáculo', 'Fariseos', 'Getsemaní', 'Efod', 'Sinagoga', 'Pentecostés', 'Maná', 'Jubileo'];
const LETRAS = 'ABCDEFGHIJLMNÑOPQRSTUVYZ'.split('');
const PAGINA = 60;

const inicial = (t: string) => {
  const c = t.trim()[0]?.toUpperCase() ?? '';
  return c === 'Ñ' ? 'Ñ' : sinAcentos(c);
};

export default function DiccionarioScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const colors = useColors();
  const [indice, setIndice] = useState<FilaDiccionario[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState(String(params.q ?? ''));
  const [letra, setLetra] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(PAGINA);

  useEffect(() => {
    getDiccionarioIndice().then(setIndice, () => setError(true));
  }, []);

  const resultados = useMemo(() => (indice && q.trim() ? buscarArticulos(indice, q, 40) : []), [indice, q]);
  const deLetra = useMemo(() => (indice && letra ? indice.filter((f) => inicial(f[1]) === letra) : []), [indice, letra]);
  const empezar = useMemo(
    () =>
      indice
        ? PARA_EMPEZAR.map((t) => indice.find((f) => sinAcentos(f[1].toLowerCase()) === sinAcentos(t.toLowerCase()))).filter(
            (f): f is FilaDiccionario => !!f,
          )
        : [],
    [indice],
  );

  const abrir = (id: string) => navigate(() => router.push(diccionarioHref(id) as never), 'forward');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Diccionario bíblico' }} />
      <Appear>
        <Text style={[styles.overline, { color: colors.warm }]}>Tyndale · en español</Text>
        <Text style={[styles.title, { color: colors.text }]}>Diccionario bíblico</Text>
        <Text style={[styles.intro, { color: colors.muted }]}>
          Personas, lugares, costumbres, objetos y palabras clave de la Biblia, explicados por especialistas evangélicos con
          sus versículos.
        </Text>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SearchIcon color={colors.muted} />
          <TextInput
            value={q}
            onChangeText={(t) => {
              setQ(t);
              setLetra(null);
            }}
            placeholder="Busca: gracia, efod, Getsemaní…"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text }]}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar en el diccionario"
          />
        </View>
      </Appear>

      {!indice && !error && <ActivityIndicator color={colors.accent} style={{ marginTop: 30 }} />}
      {error && <Text style={[styles.vacio, { color: colors.muted }]}>No se pudo cargar el diccionario. Revisa la conexión.</Text>}

      {indice && q.trim().length > 0 && (
        <View style={{ marginTop: 18 }}>
          {resultados.length ? (
            resultados.map((f) => <Fila key={f[0]} f={f} colors={colors} onPress={() => abrir(f[0])} />)
          ) : (
            <Text style={[styles.vacio, { color: colors.muted }]}>
              {q.trim().length < 3 ? 'Escribe al menos tres letras.' : `No hay artículos con «${q.trim()}».`}
            </Text>
          )}
        </View>
      )}

      {indice && !q.trim() && (
        <>
          {!letra && empezar.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <Text style={[styles.seccion, { color: colors.muted }]}>Para empezar</Text>
              <View style={styles.chips}>
                {empezar.map((f) => (
                  <Pressable
                    key={f[0]}
                    onPress={() => abrir(f[0])}
                    accessibilityRole="link"
                    style={({ pressed }) => [styles.chip, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{f[1]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <Text style={[styles.seccion, { color: colors.muted, marginTop: 24 }]}>Por letra</Text>
          <View style={styles.letras}>
            {LETRAS.map((l) => (
              <Pressable
                key={l}
                onPress={() => {
                  setLetra(letra === l ? null : l);
                  setMostrar(PAGINA);
                }}
                accessibilityRole="button"
                aria-selected={letra === l}
                style={({ pressed }) => [
                  styles.letra,
                  { borderColor: colors.border },
                  letra === l && { backgroundColor: colors.text, borderColor: colors.text },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: letra === l ? colors.background : colors.text, fontWeight: '700' }}>{l}</Text>
              </Pressable>
            ))}
          </View>
          {letra && (
            <View style={{ marginTop: 12 }}>
              {deLetra.slice(0, mostrar).map((f) => (
                <Fila key={f[0]} f={f} colors={colors} onPress={() => abrir(f[0])} />
              ))}
              {deLetra.length > mostrar && (
                <Pressable
                  onPress={() => setMostrar(mostrar + PAGINA)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.mas, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Ver más ({deLetra.length - mostrar})</Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}

      <Pressable onPress={() => navigate(() => router.push('/fuentes' as never), 'forward')} accessibilityRole="link">
        <Text style={[styles.credit, { color: colors.muted }]}>
          {DICCIONARIO_TYNDALE.credito} <Text style={{ color: colors.accent, fontWeight: '600' }}>Fuentes y créditos</Text>
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Fila({ f, colors, onPress }: { f: FilaDiccionario; colors: Colors; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.fila,
        { borderColor: colors.border },
        (pressed || hovered) && { backgroundColor: colors.accentSoft },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.filaTitulo, { color: colors.text }]}>{f[1]}</Text>
        {!!TIPOS[f[2]] && <Text style={[styles.tipo, { color: colors.muted }]}>{TIPOS[f[2]]}</Text>}
      </View>
      <ChevronRightIcon color={colors.muted} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  overline: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 },
  title: { fontFamily: serif, fontSize: 32, lineHeight: 38, marginTop: 4 },
  intro: { fontSize: 16, lineHeight: 24, marginTop: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, marginTop: 18 },
  input: { flex: 1, fontSize: 17, paddingVertical: 13, outlineStyle: 'none' } as object,
  seccion: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  letras: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  letra: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filaTitulo: { fontFamily: serif, fontSize: 17 },
  tipo: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  mas: { borderWidth: 1, borderRadius: 24, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  vacio: { fontSize: 15, textAlign: 'center', marginTop: 20 },
  credit: { fontSize: 12, lineHeight: 18, marginTop: 32 },
});
