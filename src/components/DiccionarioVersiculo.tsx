// Pestaña «Diccionario» del panel del versículo: los artículos del diccionario bíblico de Tyndale (en español) que
// tratan este versículo, con su primera línea. Al tocar uno se abre entero en /diccionario/<id>.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { ChevronRightIcon, DictionaryIcon } from '@/components/icons';
import { Articulo, Book, getArticulo, getDiccionarioCap, getDiccionarioIndice } from '@/lib/data';
import { DICCIONARIO_TYNDALE, TIPOS, buscarArticulos, diccionarioHref, resumen } from '@/lib/fuentesAbiertas';
import { Colors, serif } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Props = { book: Book; chapter: number; verse: number; colors: Colors; onNavigate: () => void };

export default function DiccionarioVersiculo({ book, chapter, verse, colors, onNavigate }: Props) {
  const clave = `${book.id}.${chapter}.${verse}`;
  const [loaded, setLoaded] = useState<{ clave: string; articulos: Articulo[] } | null>(null);

  useEffect(() => {
    let vivo = true;
    getDiccionarioCap(book.id, chapter)
      .then((cap) => Promise.all((cap[String(verse)] ?? []).map(([id]) => getArticulo(id))))
      .then(
        (as) => vivo && setLoaded({ clave, articulos: as.filter((a): a is Articulo => !!a) }),
        () => vivo && setLoaded({ clave, articulos: [] }),
      );
    return () => {
      vivo = false;
    };
  }, [book.id, chapter, verse, clave]);

  const abrir = (href: string) => {
    onNavigate();
    navigate(() => router.push(href as never), 'forward');
  };

  if (!loaded || loaded.clave !== clave) return <ActivityIndicator color={colors.accent} />;

  return (
    <View>
      {loaded.articulos.length ? (
        loaded.articulos.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => abrir(diccionarioHref(a.id))}
            accessibilityRole="link"
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.row,
              { borderColor: colors.border },
              (pressed || hovered) && { backgroundColor: colors.accentSoft },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{a.t}</Text>
              {!!TIPOS[a.tipo] && <Text style={[styles.tipo, { color: colors.muted }]}>{TIPOS[a.tipo]}</Text>}
              <Text style={[styles.resumen, { color: colors.text }]} numberOfLines={3}>
                {resumen(a.x)}
              </Text>
            </View>
            <ChevronRightIcon color={colors.muted} size={18} />
          </Pressable>
        ))
      ) : (
        <Text style={{ color: colors.muted }}>El diccionario no tiene artículos sobre este versículo.</Text>
      )}
      <Pressable
        onPress={() => abrir('/diccionario')}
        accessibilityRole="link"
        style={({ pressed }) => [styles.buscar, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.7 }]}
      >
        <DictionaryIcon color={colors.text} size={18} />
        <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>Buscar en el diccionario bíblico</Text>
        <ChevronRightIcon color={colors.muted} size={16} />
      </Pressable>
      <Text style={[styles.credit, { color: colors.muted }]}>{DICCIONARIO_TYNDALE.nombre} (Tyndale House, Mission Mutual) · CC BY-SA 4.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontFamily: serif, fontSize: 17, fontWeight: '700' },
  tipo: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  resumen: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  buscar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 16 },
  credit: { fontSize: 11, marginTop: 14 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingVertical: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
});

/** En el buscador: los artículos del diccionario cuyo título responde a lo buscado («efod», «Getsemaní»). */
export function DiccionarioBusqueda({ q, colors }: { q: string; colors: Colors }) {
  const [loaded, setLoaded] = useState<{ q: string; articulos: Articulo[] } | null>(null);

  useEffect(() => {
    let vivo = true;
    getDiccionarioIndice()
      .then((indice) => Promise.all(buscarArticulos(indice, q, 3).map(([id]) => getArticulo(id))))
      .then(
        (as) => vivo && setLoaded({ q, articulos: as.filter((a): a is Articulo => !!a) }),
        () => vivo && setLoaded({ q, articulos: [] }),
      );
    return () => {
      vivo = false;
    };
  }, [q]);

  if (!loaded || loaded.q !== q || !loaded.articulos.length) return null;
  const ir = (href: string) => navigate(() => router.push(href as never), 'forward');
  return (
    <Appear>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHead}>
          <DictionaryIcon color={colors.warm} size={15} />
          <Text style={[styles.kicker, { color: colors.warm }]}>Diccionario bíblico Tyndale</Text>
        </View>
        {loaded.articulos.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => ir(diccionarioHref(a.id))}
            accessibilityRole="link"
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.row,
              { borderColor: colors.border },
              (pressed || hovered) && { backgroundColor: colors.accentSoft },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{a.t}</Text>
              <Text style={[styles.resumen, { color: colors.text }]} numberOfLines={2}>
                {resumen(a.x)}
              </Text>
            </View>
            <ChevronRightIcon color={colors.muted} size={18} />
          </Pressable>
        ))}
        <Pressable onPress={() => ir(`/diccionario?q=${encodeURIComponent(q)}`)} accessibilityRole="link" hitSlop={6}>
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14, marginTop: 10 }}>Más en el diccionario ›</Text>
        </Pressable>
      </View>
    </Appear>
  );
}
