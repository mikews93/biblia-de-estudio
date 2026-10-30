// /conexiones: todas las referencias cruzadas de la Biblia como arcos, de Génesis a Apocalipsis. Se elige un libro en
// la fila de libros (o con ?libro=isaias&cap=53, desde la barra del capítulo) y sus arcos se encienden en ámbar.
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Appear from '@/components/Appear';
import ArcosBiblia, { LeyendaDistancia } from '@/components/ArcosBiblia';
import { ArcsIcon, ArrowRightIcon, CloseIcon, OpenBookIcon, PromiseIcon } from '@/components/icons';
import {
  FUENTE_CONEXIONES,
  type FilasLibro,
  type Resumen,
  arcosDe,
  capituloEn,
  eje,
  getArcosLibro,
  getResumen,
  librosVecinos,
  masConectados,
  masFuertes,
  miles,
} from '@/lib/conexiones';
import { Book, type CrossRef, formatRef, getBooks, getCrossRefs, parseRef } from '@/lib/data';
import { BOOK_SLUGS, bookIdFromParam, chapterHref, verseHref } from '@/lib/routes';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function Conexiones() {
  const colors = useColors();
  const oscuro = isDark(colors);
  const { width } = useWindowDimensions();
  const ancho = width >= 820;
  const params = useLocalSearchParams<{ libro?: string; cap?: string }>();
  const [books, setBooks] = useState<Book[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [libro, setLibro] = useState<number | undefined>();
  const [cap, setCap] = useState<number | undefined>();
  // Lo cargado se guarda con su clave: así, al cambiar de libro o capítulo, lo anterior no se muestra mientras llega
  const [cargadas, setCargadas] = useState<{ id: string; filas: FilasLibro } | null>(null);
  const [cargadasRefs, setCargadasRefs] = useState<{ id: string; refs: Record<string, CrossRef[]> } | null>(null);

  useEffect(() => {
    Promise.all([getBooks(), getResumen()]).then(
      ([b, r]) => {
        setBooks(b);
        setResumen(r);
        const id = params.libro ? bookIdFromParam(params.libro) : undefined;
        const i = id ? b.findIndex((x) => x.id === id) : -1;
        if (i >= 0) {
          setLibro(i);
          const c = Number(params.cap);
          if (c >= 1 && c <= b[i].chapters) setCap(c);
        }
      },
      (e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las conexiones.'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const book = libro != null ? books[libro] : undefined;
  const claveRefs = book && cap ? `${book.id}.${cap}` : '';
  useEffect(() => {
    if (book) getArcosLibro(book.id).then((filas) => setCargadas({ id: book.id, filas }), () => {});
  }, [book]);
  useEffect(() => {
    if (!book || !cap) return;
    const id = `${book.id}.${cap}`;
    getCrossRefs(book.id, cap).then(
      (refs) => setCargadasRefs({ id, refs }),
      () => setCargadasRefs({ id, refs: {} }),
    );
  }, [book, cap]);
  const filas = book && cargadas?.id === book.id ? cargadas.filas : null;
  const refs = claveRefs && cargadasRefs?.id === claveRefs ? cargadasRefs.refs : null;

  const { inicio, total } = useMemo(() => eje(books), [books]);
  const arcos = useMemo(() => (filas && libro != null ? arcosDe(filas, inicio[libro], cap) : []), [filas, libro, cap, inicio]);

  const elegir = (l: number | undefined, c?: number) => {
    setLibro(l);
    setCap(c);
    const b = l != null ? books[l] : undefined;
    router.setParams({ libro: b ? (BOOK_SLUGS[b.id] ?? b.id) : undefined, cap: c ? String(c) : undefined });
  };
  const abrir = (href: string) => navigate(() => router.push(href as never), 'forward');

  if (error)
    return (
      <View style={[styles.centro, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Conexiones' }} />
        <Text style={{ color: colors.muted, textAlign: 'center' }}>{error}</Text>
      </View>
    );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Conexiones' }} />

      <Appear style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heroHead}>
          <View style={[styles.heroIcon, { backgroundColor: colors.warmSoft }]}>
            <ArcsIcon color={colors.warm} size={24} />
          </View>
          <Text style={[styles.kicker, { color: colors.warm }]}>REFERENCIAS CRUZADAS</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Toda la Biblia, conectada</Text>
        <Text style={[styles.lead, { color: colors.text }]}>
          Cada arco une dos capítulos que se citan o se explican uno al otro.
          {resumen ? ` Son ${miles(resumen.versiculos)} conexiones, de Génesis a Apocalipsis.` : ''}
        </Text>

        <View style={styles.grafico}>
          {resumen && books.length ? (
            <ArcosBiblia
              books={books}
              inicio={inicio}
              total={total}
              colors={colors}
              oscuro={oscuro}
              arcos={arcos}
              libro={libro}
              capitulo={libro != null && cap ? inicio[libro] + cap - 1 : undefined}
              onLibro={(l) => elegir(l === libro && cap == null ? undefined : l)}
            />
          ) : (
            <View style={[styles.centro, { height: 200 }]}>
              <ActivityIndicator color={colors.muted} />
            </View>
          )}
        </View>

        <View style={styles.pie}>
          <LeyendaDistancia colors={colors} oscuro={oscuro} />
          <Text style={[styles.ayuda, { color: colors.muted }]}>
            {libro == null ? 'Toca o desliza sobre la fila de libros' : 'Toca otro libro, o el mismo para ver todos'}
          </Text>
        </View>

        {resumen && libro == null && (
          <View style={styles.stats}>
            <Stat value={miles(resumen.versiculos)} label="conexiones" colors={colors} />
            <Stat value={miles(resumen.pares)} label="arcos entre capítulos" colors={colors} />
            <Stat value={miles(total)} label="capítulos" colors={colors} />
          </View>
        )}
      </Appear>

      {resumen && books.length > 0 && (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {book && libro != null ? (
            <Libro
              key={book.id}
              book={book}
              libro={libro}
              books={books}
              resumen={resumen}
              filas={filas}
              inicio={inicio}
              cap={cap}
              refs={refs}
              ancho={ancho}
              colors={colors}
              onCap={(c) => elegir(libro, c === cap ? undefined : c)}
              onCerrar={() => elegir(undefined)}
              onLibro={(l) => elegir(l)}
              abrir={abrir}
            />
          ) : (
            <MasConectados books={books} resumen={resumen} inicio={inicio} colors={colors} onCap={(l, c) => elegir(l, c)} />
          )}
        </View>
      )}

      <Pressable
        onPress={() => abrir('/promesas')}
        accessibilityRole="link"
        style={({ pressed }) => [styles.enlace, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.enlaceIcono, { backgroundColor: colors.accentSoft }]}>
          <PromiseIcon color={colors.text} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.enlaceTitulo, { color: colors.text }]}>Promesa y cumplimiento</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>Los hilos elegidos, uno por uno, de la promesa a Cristo</Text>
        </View>
        <ArrowRightIcon color={colors.muted} size={18} />
      </Pressable>

      <Text style={[styles.source, { color: colors.muted }]}>{FUENTE_CONEXIONES}</Text>
    </ScrollView>
  );
}

type LibroProps = {
  book: Book;
  libro: number;
  books: Book[];
  resumen: Resumen;
  filas: FilasLibro | null;
  inicio: number[];
  cap?: number;
  refs: Record<string, CrossRef[]> | null;
  ancho: boolean;
  colors: Colors;
  onCap: (c: number) => void;
  onCerrar: () => void;
  onLibro: (l: number) => void;
  abrir: (href: string) => void;
};

function Libro({ book, libro, books, resumen, filas, inicio, cap, refs, ancho, colors, onCap, onCerrar, onLibro, abrir }: LibroProps) {
  const porCap = resumen.capitulos.slice(inicio[libro], inicio[libro] + book.chapters);
  const totalLibro = porCap.reduce((s, n) => s + n, 0);
  const vecinos = librosVecinos(resumen, libro);
  const conLibros = resumen.libros[libro].filter((n, i) => n > 0 && i !== libro).length;
  const maxCap = Math.max(1, ...porCap);
  const maxVecino = vecinos[0]?.[1] ?? 1;

  const fila = cap && filas ? filas[cap - 1] : undefined;
  const librosCap = fila ? new Set(fila.filter((_, k) => k % 2 === 0).map((i) => capituloEn(books, inicio, i).libro)).size : 0;
  const fuertes = refs ? masFuertes(refs) : [];

  const detalle = cap ? (
    <View style={[styles.capitulo, { backgroundColor: colors.background }]}>
      <Text style={[styles.capTitulo, { color: colors.text }]}>
        {book.name} {cap}
      </Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        {fila
          ? `${miles(resumen.capitulos[inicio[libro] + cap - 1])} conexiones con ${miles(fila.length / 2)} capítulos de ${librosCap} ${librosCap === 1 ? 'libro' : 'libros'}`
          : ' '}
      </Text>
      <Text style={[styles.h3, { color: colors.muted }]}>LAS MÁS FUERTES</Text>
      {!refs ? (
        <ActivityIndicator color={colors.muted} style={{ marginVertical: 12 }} />
      ) : fuertes.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 14 }}>Este capítulo no tiene referencias en el lector.</Text>
      ) : (
        fuertes.map(([v, ref]) => {
          const { start } = parseRef(ref);
          return (
            <Pressable
              key={`${v}-${ref}`}
              onPress={() => abrir(verseHref(start.book, start.chapter, start.verse))}
              accessibilityRole="link"
              style={({ pressed }) => [styles.ref, { borderColor: colors.border }, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.refDesde, { color: colors.muted }]}>
                {cap}:{v}
              </Text>
              <ArrowRightIcon color={colors.warm} size={14} />
              <Text style={[styles.refHasta, { color: colors.text }]} numberOfLines={1}>
                {formatRef(ref, books)}
              </Text>
            </Pressable>
          );
        })
      )}
      <Pressable
        onPress={() => abrir(chapterHref(book.id, cap))}
        accessibilityRole="button"
        style={({ pressed }) => [styles.leer, { backgroundColor: colors.accent }, pressed && { opacity: 0.8 }]}
      >
        <OpenBookIcon color={colors.background} size={18} />
        <Text style={{ color: colors.background, fontWeight: '700', fontSize: 15 }}>
          Leer {book.name} {cap}
        </Text>
      </Pressable>
    </View>
  ) : null;

  const capitulos = (
    <View>
      <Text style={[styles.h3, { color: colors.muted }]}>{cap ? 'OTRO CAPÍTULO' : 'ELIGE UN CAPÍTULO'}</Text>
      <View style={styles.caps}>
        {porCap.map((n, k) => {
          const on = cap === k + 1;
          const calor = 0.06 + 0.4 * Math.sqrt(n / maxCap);
          return (
            <Pressable
              key={k}
              onPress={() => onCap(k + 1)}
              accessibilityRole="button"
              accessibilityLabel={`${book.name} ${k + 1}: ${n} conexiones`}
              aria-selected={on}
              style={({ pressed }) => [
                styles.capChip,
                { borderColor: on ? colors.warm : colors.border },
                on && { backgroundColor: colors.warm },
                pressed && { opacity: 0.7 },
              ]}
            >
              {!on && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.warm, opacity: calor, borderRadius: 9 }]} />}
              <Text style={{ color: on ? colors.background : colors.text, fontWeight: on ? '700' : '500', fontSize: 13 }}>{k + 1}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.nota, { color: colors.muted }]}>Más intenso, más conectado.</Text>
    </View>
  );

  return (
    <View>
      <View style={styles.libroHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.libroTitulo, { color: colors.text }]}>{book.name}</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {miles(totalLibro)} conexiones · conversa con {conLibros} libros
          </Text>
        </View>
        <Pressable
          onPress={onCerrar}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ver toda la Biblia"
          style={({ pressed }) => [styles.cerrar, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.6 }]}
        >
          <CloseIcon color={colors.text} size={16} />
        </Pressable>
      </View>

      <View style={[styles.columnas, ancho && styles.columnasAncho]}>
        <View style={ancho ? styles.col : undefined}>
          {detalle}
          {!cap && (
            <>
              <Text style={[styles.h3, { color: colors.muted }]}>CON QUIÉN CONVERSA MÁS</Text>
              {vecinos.map(([i, n]) => (
                <Pressable
                  key={i}
                  onPress={() => onLibro(i)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.vecino, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[styles.vecinoNombre, { color: colors.text }]} numberOfLines={1}>
                    {books[i].name}
                  </Text>
                  <View style={[styles.vecinoBarra, { backgroundColor: colors.accentSoft }]}>
                    <View style={{ width: `${(n / maxVecino) * 100}%`, height: '100%', borderRadius: 4, backgroundColor: colors.warm, opacity: 0.75 }} />
                  </View>
                  <Text style={[styles.vecinoN, { color: colors.muted }]}>{miles(n)}</Text>
                </Pressable>
              ))}
            </>
          )}
        </View>
        <View style={ancho ? styles.col : undefined}>{capitulos}</View>
      </View>
    </View>
  );
}

function MasConectados({
  books,
  resumen,
  inicio,
  colors,
  onCap,
}: {
  books: Book[];
  resumen: Resumen;
  inicio: number[];
  colors: Colors;
  onCap: (libro: number, cap: number) => void;
}) {
  const lista = masConectados(resumen, 8);
  const max = lista[0]?.[1] ?? 1;
  return (
    <View>
      <Text style={[styles.libroTitulo, { color: colors.text }]}>Los capítulos más conectados</Text>
      <Text style={[styles.sub, { color: colors.muted, marginBottom: 10 }]}>Toca uno para ver sus arcos y sus referencias más fuertes</Text>
      {lista.map(([i, n]) => {
        const { libro, chapter } = capituloEn(books, inicio, i);
        return (
          <Pressable
            key={i}
            onPress={() => onCap(libro, chapter)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.vecino, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.vecinoNombre, { color: colors.text, width: 128 }]} numberOfLines={1}>
              {books[libro].name} {chapter}
            </Text>
            <View style={[styles.vecinoBarra, { backgroundColor: colors.accentSoft }]}>
              <View style={{ width: `${(n / max) * 100}%`, height: '100%', borderRadius: 4, backgroundColor: colors.warm, opacity: 0.75 }} />
            </View>
            <Text style={[styles.vecinoN, { color: colors.muted }]}>{miles(n)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stat({ value, label, colors }: { value: string; label: string; colors: Colors }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.text, fontFamily: serif, fontSize: 19, fontWeight: '600' }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 56, maxWidth: 980, width: '100%', alignSelf: 'center' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, padding: 18, paddingBottom: 14 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  heroIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontFamily: serif, fontSize: 27, lineHeight: 33, fontWeight: '600' },
  lead: { fontSize: 15, lineHeight: 22, marginTop: 8, opacity: 0.85 },
  grafico: { marginTop: 14, marginHorizontal: -8 },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  ayuda: { fontSize: 12 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 18, marginTop: 14 },
  libroHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  libroTitulo: { fontFamily: serif, fontSize: 23, fontWeight: '600' },
  sub: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  cerrar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  columnas: { gap: 4 },
  columnasAncho: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  col: { flex: 1 },
  h3: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginTop: 18, marginBottom: 8 },
  vecino: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  vecinoNombre: { width: 104, fontSize: 14.5, fontWeight: '500' },
  vecinoBarra: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  vecinoN: { width: 52, textAlign: 'right', fontSize: 12.5, fontVariant: ['tabular-nums'] },
  caps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  capChip: { minWidth: 38, height: 34, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  nota: { fontSize: 11.5, marginTop: 8 },
  capitulo: { borderRadius: 16, padding: 14, marginTop: 14 },
  capTitulo: { fontFamily: serif, fontSize: 20, fontWeight: '600' },
  ref: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  refDesde: { width: 52, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  refHasta: { flex: 1, fontSize: 15, fontWeight: '500' },
  leer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 12, marginTop: 12 },
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 14, marginTop: 14 },
  enlaceIcono: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  enlaceTitulo: { fontSize: 15.5, fontWeight: '600' },
  source: { fontSize: 12, lineHeight: 17, marginTop: 30, textAlign: 'center' },
});
