// /promesas/virgen: un hilo de promesa, paso a paso, del anuncio a su cumplimiento, con el texto de cada pasaje.
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, ClockIcon, PromiseIcon, StarIcon } from '@/components/icons';
import { HiloCard, etiquetaRef } from '@/components/Promesas';
import { Book, getBooks, getChapter, parseRef } from '@/lib/data';
import {
  FUENTE_PROMESAS,
  HILOS,
  Paso,
  ROLES,
  TEMAS,
  añoPaso,
  espera,
  fechaPaso,
  hiloPorId,
  periodoPaso,
  textoEspera,
} from '@/lib/promesas';
import { verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Linea = [number, string];

export default function Promesa() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const hilo = hiloPorId(String(id));
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    getBooks().then(setBooks, () => {});
  }, []);

  if (!hilo) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Promesa' }} />
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40, padding: 16 }}>No encontramos esta promesa.</Text>
      </View>
    );
  }

  const tema = TEMAS[hilo.tema];
  const años = espera(hilo);
  const otros = HILOS.filter((h) => h.tema === hilo.tema && h.id !== hilo.id).slice(0, 4);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: hilo.titulo }} />
      <Appear>
        <View style={styles.kickerFila}>
          <View style={[styles.punto, { backgroundColor: tema.color }]} />
          <Text style={[styles.kicker, { color: tema.color }]}>{tema.titulo.toUpperCase()}</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{hilo.titulo}</Text>
        <Text style={[styles.resumen, { color: colors.text }]}>{hilo.resumen}</Text>
        <View style={styles.pills}>
          {hilo.tema === 'esperanza' ? (
            <Pill colors={colors} fondo={colors.accentSoft} color={colors.text} icon={<StarIcon color={colors.text} size={14} />}>
              Aún por cumplirse, sin fechas
            </Pill>
          ) : (
            (hilo.esperaTexto || años != null) && (
              <Pill colors={colors} fondo={colors.accentSoft} color={colors.text} icon={<ClockIcon color={colors.text} size={14} />}>
                Se cumplió {hilo.esperaTexto ?? textoEspera(años!)}
              </Pill>
            )
          )}
          {hilo.citado && (
            <Pill colors={colors} fondo={colors.warmSoft} color={colors.warm} icon={<CheckIcon color={colors.warm} size={14} />}>
              El Nuevo Testamento lo cita
            </Pill>
          )}
        </View>
      </Appear>

      <View style={styles.hilo}>
        {hilo.pasos.map((p, i) => {
          const antes = hilo.pasos[i - 1];
          const salto = antes ? saltoEntre(antes, p) : undefined;
          return (
            <Fragment key={`${p.ref ?? p.titulo}-${i}`}>
              {salto && <Salto texto={salto} colors={colors} color={tema.color} />}
              <Appear delay={60 + i * 50}>
                <PasoCard paso={p} books={books} colors={colors} temaColor={tema.color} ultimo={i === hilo.pasos.length - 1} primero={i === 0} />
              </Appear>
            </Fragment>
          );
        })}
      </View>

      {!!hilo.reflexion && (
        <View style={[styles.reflexion, { backgroundColor: colors.warmSoft }]}>
          <Text style={[styles.kicker, { color: colors.warm }]}>PARA PENSAR</Text>
          <Text style={[styles.reflexionTexto, { color: colors.text }]}>{hilo.reflexion}</Text>
        </View>
      )}

      {otros.length > 0 && (
        <View style={{ marginTop: 30 }}>
          <Text style={[styles.h2, { color: colors.text }]}>Sigue el hilo</Text>
          <View style={{ gap: 10, marginTop: 10 }}>
            {otros.map((h) => (
              <HiloCard key={h.id} hilo={h} books={books} colors={colors} />
            ))}
          </View>
        </View>
      )}
      <Pressable
        onPress={() => navigate(() => router.push('/promesas' as never), 'forward')}
        style={({ pressed }) => [styles.todas, { borderColor: colors.accent }, pressed && { opacity: 0.7 }]}
      >
        <PromiseIcon color={colors.accent} size={18} />
        <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver todas las promesas</Text>
      </Pressable>
      <Text style={[styles.source, { color: colors.muted }]}>{FUENTE_PROMESAS}</Text>
    </ScrollView>
  );
}

/** «unos 700 años» entre dos pasos, solo si el salto es grande. */
function saltoEntre(a: Paso, b: Paso) {
  const x = añoPaso(a);
  const y = añoPaso(b);
  if (x == null || y == null || y - x < 40) return undefined;
  return textoEspera(y - x - (x < 0 && y > 0 ? 1 : 0)).replace(/ después$/, '');
}

function Salto({ texto, colors, color }: { texto: string; colors: Colors; color: string }) {
  return (
    <View style={styles.salto}>
      <View style={styles.rail}>
        <View style={[styles.railPunteado, { backgroundColor: color }]} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, fontStyle: 'italic' }}>{texto}</Text>
    </View>
  );
}

function PasoCard({
  paso,
  books,
  colors,
  temaColor,
  primero,
  ultimo,
}: {
  paso: Paso;
  books: Book[];
  colors: Colors;
  temaColor: string;
  primero: boolean;
  ultimo: boolean;
}) {
  const [lineas, setLineas] = useState<Linea[] | null>(paso.ref ? null : []);
  const periodo = periodoPaso(paso);
  const fecha = fechaPaso(paso);
  const cumple = paso.rol === 'cumple';
  const espera = paso.rol === 'espera';
  const color = cumple ? colors.warm : espera ? TEMAS.esperanza.color : temaColor;

  useEffect(() => {
    if (!paso.ref) return;
    let vivo = true;
    const { start, end } = parseRef(paso.ref);
    getChapter(start.book, start.chapter)
      .then((vs) => {
        if (vivo) setLineas(vs.filter(([n]) => n >= start.verse && n <= end.verse).map(([n, t]) => [n, t]));
      })
      .catch(() => vivo && setLineas([]));
    return () => {
      vivo = false;
    };
  }, [paso.ref]);

  const abrir = () => {
    if (!paso.ref) return;
    const { start } = parseRef(paso.ref);
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };
  const verHistoria = () => {
    if (!paso.ref) return;
    const { start } = parseRef(paso.ref);
    navigate(() => router.push(`/historia?libro=${start.book}&cap=${start.chapter}` as never), 'forward');
  };

  return (
    <View style={styles.paso}>
      <View style={styles.rail}>
        <View style={[styles.railLinea, { backgroundColor: colors.border }, primero && { top: 22 }, ultimo && { height: 22 }]} />
        <View
          style={[
            styles.nodo,
            cumple
              ? { backgroundColor: color, borderColor: color }
              : { backgroundColor: colors.background, borderColor: color, borderStyle: espera || paso.rol === 'figura' ? 'dashed' : 'solid' },
            paso.rol === 'eco' && styles.nodoChico,
          ]}
        >
          {cumple && <CheckIcon color={colors.surface} size={13} strokeWidth={2.4} />}
        </View>
      </View>
      <View
        style={[
          styles.pasoCard,
          { backgroundColor: colors.surface, borderColor: cumple ? colors.warm : colors.border },
          cumple && styles.pasoCumple,
        ]}
      >
        <Text style={[styles.rol, { color }]}>{ROLES[paso.rol].toUpperCase()}</Text>
        <Text style={[styles.pasoTitulo, { color: colors.text }]}>{paso.titulo}</Text>
        <View style={styles.pasoMeta}>
          {paso.ref ? (
            <Pressable onPress={abrir} hitSlop={6} accessibilityRole="link">
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>{etiquetaRef(paso.ref, books)}</Text>
            </Pressable>
          ) : (
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Fuera de la Biblia</Text>
          )}
          {!!fecha && <Text style={{ color: colors.muted, fontSize: 12.5 }}>· {fecha}</Text>}
        </View>

        {paso.ref &&
          (lineas === null ? (
            <ActivityIndicator color={colors.muted} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
          ) : (
            lineas.length > 0 && (
              <View style={[styles.cita, { borderColor: color }]}>
                <Text style={[styles.citaTexto, { color: colors.text }]}>
                  {lineas.map(([n, t], i) => (
                    <Text key={n}>
                      {lineas.length > 1 && <Text style={[styles.num, { color: colors.muted }]}>{n} </Text>}
                      {t}
                      {i < lineas.length - 1 ? ' ' : ''}
                    </Text>
                  ))}
                </Text>
              </View>
            )
          ))}
        {!!paso.nota && <Text style={[styles.nota, { color: colors.muted }]}>{paso.nota}</Text>}

        {paso.ref && (
          <View style={styles.acciones}>
            <Accion label="Leer en contexto" onPress={abrir} colors={colors} principal />
            {periodo && !periodo.sinFecha && <Accion label={`Línea de tiempo · ${corto(periodo.titulo)}`} onPress={verHistoria} colors={colors} />}
          </View>
        )}
      </View>
    </View>
  );
}

/** «Cuando se escribió Gálatas» → «Gálatas»: que quepa en el botón. */
const corto = (t: string) => t.replace(/^Cuando se escribi(?:ó|eron) (?:las )?/, '');

function Accion({ label, onPress, colors, principal }: { label: string; onPress: () => void; colors: Colors; principal?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.accion,
        principal ? { backgroundColor: colors.accent } : { backgroundColor: hovered ? colors.border : colors.accentSoft },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={{ color: principal ? colors.background : colors.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Pill({
  children,
  colors,
  fondo,
  color,
  icon,
}: {
  children: React.ReactNode;
  colors: Colors;
  fondo: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: fondo, borderColor: colors.border }]}>
      {icon}
      <Text style={{ color, fontSize: 12.5, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 56, maxWidth: 760, width: '100%', alignSelf: 'center' },
  kickerFila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  punto: { width: 9, height: 9, borderRadius: 5 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { fontFamily: serif, fontSize: 31, lineHeight: 37, fontWeight: '600', marginTop: 6 },
  resumen: { fontSize: 16, lineHeight: 24, marginTop: 8, opacity: 0.88 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  hilo: { marginTop: 22 },
  paso: { flexDirection: 'row', gap: 12 },
  rail: { width: 26, alignItems: 'center' },
  railLinea: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  railPunteado: { position: 'absolute', top: 0, bottom: 0, width: 2, opacity: 0.35 },
  nodo: { width: 24, height: 24, borderRadius: 12, borderWidth: 2.5, marginTop: 16, alignItems: 'center', justifyContent: 'center' },
  nodoChico: { width: 16, height: 16, borderRadius: 8, marginTop: 20 },
  pasoCard: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 14, marginBottom: 12 },
  pasoCumple: { borderWidth: 1.5 },
  rol: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.3 },
  pasoTitulo: { fontFamily: serif, fontSize: 19, lineHeight: 24, fontWeight: '600', marginTop: 3 },
  pasoMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  cita: { borderLeftWidth: 3, paddingLeft: 12, marginTop: 12 },
  citaTexto: { fontFamily: serif, fontSize: 16.5, lineHeight: 26 },
  num: { fontSize: 11, fontFamily: undefined },
  nota: { fontSize: 13, lineHeight: 19, marginTop: 10, fontStyle: 'italic' },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  accion: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '100%' },
  salto: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 34, marginTop: -12 },
  reflexion: { borderRadius: 20, padding: 18, marginTop: 14 },
  reflexionTexto: { fontFamily: serif, fontSize: 17.5, lineHeight: 27, marginTop: 8 },
  h2: { fontFamily: serif, fontSize: 21, fontWeight: '600' },
  todas: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 11,
    marginTop: 24,
  },
  source: { fontSize: 12, lineHeight: 17, marginTop: 24, textAlign: 'center' },
});
