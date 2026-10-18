// /genealogia/994-david: árbol familiar de una persona, su linaje y su familia
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import FamilyTree from '@/components/FamilyTree';
import { Book, formatRef, getBooks, parseRef } from '@/lib/data';
import {
  FUENTE_GENEALOGIA,
  JESUS,
  Persona,
  Personas,
  descripcion,
  getPersonas,
  hermanosDe,
  linaje,
  personaHref,
} from '@/lib/genealogia';
import { verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Generaciones del linaje que se muestran antes de «Ver todas». */
const LINAJE_CORTO = 8;

export default function Genealogia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = parseInt(String(id), 10);
  const colors = useColors();
  const [all, setAll] = useState<Personas | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState(false);
  const [entero, setEntero] = useState(false);

  useEffect(() => {
    getPersonas().then(setAll, () => setError(true));
    getBooks().then(setBooks, () => {});
  }, []);
  useEffect(() => setEntero(false), [pid]);

  const persona = all?.get(pid);
  const select = (other: number) => {
    const p = all?.get(other);
    if (p) navigate(() => router.push(personaHref(p) as never), 'forward');
  };

  if (error) return <Message text="No se pudieron cargar las genealogías." colors={colors} />;
  if (!all) return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
  if (!persona) return <Message text="No encontramos a esta persona." colors={colors} />;

  const line = linaje(persona, all);
  const shownLine = entero || line.length <= LINAJE_CORTO + 2 ? line : [...line.slice(0, LINAJE_CORTO), null, line[line.length - 1]];
  const { start } = parseRef(persona.cita);
  const sub = descripcion(persona, all);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `Familia de ${persona.nombre}` }} />
      <Text style={[styles.kicker, { color: colors.accent }]}>GENEALOGÍA</Text>
      <Text style={[styles.title, { color: colors.text }]}>{persona.nombre}</Text>
      {!!sub && <Text style={{ color: colors.muted, fontSize: 15 }}>{sub}</Text>}
      <Pressable
        onPress={() => navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward')}
        style={styles.citaRow}
      >
        <Text style={{ color: colors.accent, fontWeight: '600' }}>
          Primera mención: {books.length ? formatRef(persona.cita, books) : persona.cita} ›
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {persona.versiculos === 1 ? 'Aparece en 1 versículo' : `Aparece en ${persona.versiculos} versículos`}
        </Text>
      </Pressable>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <FamilyTree persona={persona} all={all} colors={colors} onSelect={select} />
        <Text style={[styles.hint, { color: colors.muted }]}>Toca a cualquier persona para ver su familia.</Text>
      </View>

      {line.length > 2 && (
        <View style={{ marginTop: 28 }}>
          <Text style={[styles.h2, { color: colors.text }]}>Linaje</Text>
          <Text style={{ color: colors.muted, marginBottom: 12 }}>
            {line.length - 1} generaciones hasta {line[line.length - 1].nombre}, de padre a hijo según el texto bíblico.
            {persona.id === JESUS ? ' Sigue la genealogía de Mateo 1, por José; Lucas 3 da la línea por Natán.' : ''}
          </Text>
          {shownLine.map((p, i) =>
            p ? (
              <Pressable
                key={p.id}
                onPress={() => p.id !== persona.id && select(p.id)}
                style={styles.lineRow}
                accessibilityLabel={p.nombre}
              >
                <View style={styles.rail}>
                  <View style={[styles.railLine, { backgroundColor: colors.border }, i === 0 && { top: 14 }, i === shownLine.length - 1 && { bottom: 14 }]} />
                  <View
                    style={[
                      styles.dot,
                      { borderColor: colors.accent, backgroundColor: i === 0 ? colors.accent : colors.background },
                    ]}
                  />
                </View>
                <Text style={[styles.lineName, { color: colors.text, fontWeight: i === 0 ? '700' : '400' }]}>
                  {p.nombre}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {i === 0 ? '' : persona.id === JESUS && i === 1 ? 'padre legal' : generacion(line.indexOf(p))}
                </Text>
              </Pressable>
            ) : (
              <Pressable key="mas" onPress={() => setEntero(true)} style={styles.lineRow}>
                <View style={styles.rail}>
                  <View style={[styles.railLine, { backgroundColor: colors.border, opacity: 0.5 }]} />
                </View>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>
                  Ver las {line.length - LINAJE_CORTO - 1} generaciones intermedias
                </Text>
              </Pressable>
            ),
          )}
        </View>
      )}

      <Group title="Padres" ids={[...persona.padres, ...persona.madres]} all={all} colors={colors} onSelect={select} />
      <Group title="Cónyuges" ids={persona.conyuges} all={all} colors={colors} onSelect={select} />
      <Group title="Hermanos" ids={hermanosDe(persona, all)} all={all} colors={colors} onSelect={select} />
      <Group title="Hijos" ids={persona.hijos} all={all} colors={colors} onSelect={select} />

      <Text style={[styles.source, { color: colors.muted }]}>
        {FUENTE_GENEALOGIA} Algunas personas con el mismo nombre pueden estar unidas o separadas de forma discutible.
      </Text>
    </ScrollView>
  );
}

function generacion(n: number) {
  if (n === 1) return 'padre';
  if (n === 2) return 'abuelo';
  return `${n} generaciones`;
}

function Group({
  title,
  ids,
  all,
  colors,
  onSelect,
}: {
  title: string;
  ids: number[];
  all: Personas;
  colors: Colors;
  onSelect: (id: number) => void;
}) {
  const people = ids.map((id) => all.get(id)).filter((p): p is Persona => !!p);
  if (!people.length) return null;
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={[styles.h2, { color: colors.text }]}>
        {title} <Text style={{ color: colors.muted, fontSize: 15 }}>({people.length})</Text>
      </Text>
      <View style={styles.chips}>
        {people.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onSelect(p.id)}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={{ color: colors.text, fontFamily: serif, fontSize: 15 }}>{p.nombre}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Message({ text, colors }: { text: string; colors: Colors }) {
  return <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40, padding: 16 }}>{text}</Text>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 30, fontFamily: serif, marginTop: 2 },
  citaRow: { marginTop: 10, marginBottom: 18, gap: 2 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingVertical: 12 },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  h2: { fontSize: 20, fontFamily: serif, fontWeight: '600', marginBottom: 6 },
  lineRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36, gap: 12 },
  rail: { width: 20, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  railLine: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  lineName: { fontFamily: serif, fontSize: 17, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  source: { fontSize: 12, lineHeight: 17, marginTop: 32, textAlign: 'center' },
});
