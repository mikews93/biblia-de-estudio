import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Welcome from '@/components/comunidad/Welcome';
import { Button, Chips, ErrorText, Field, SectionTitle, text, useAction } from '@/components/comunidad/ui';
import { Grupo, TIPOS, TipoGrupo, api, refreshGroups, today, useAccount } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import { PLANS } from '@/lib/planesCatalogo';
import { seasonTint } from '@/lib/retos';
import { nextSeason } from '@/lib/temporadas';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

// Libros con los que suele empezar un grupo; el resto se busca por nombre.
const SUGGESTED = ['jhn', 'mrk', 'act', 'php', 'jas', 'rom', 'psa', 'pro', 'gen'];

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const nextMonday = () => {
  const d = new Date();
  return addDays(today(), ((8 - d.getDay()) % 7) || 7);
};

const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'long' });

// Los retos de temporada en su próxima edición, en orden de fecha
const retos = () =>
  PLANS.filter((p) => p.season)
    .map((def) => ({ def, run: nextSeason(def)! }))
    .sort((a, b) => a.run.start.localeCompare(b.run.start));

/** Crear un grupo o, con ?editar=<id>, cambiar su nombre y su plan. Con ?reto=<id> propone ese reto de temporada. */
export default function NewGroup() {
  const colors = useColors();
  const { editar, reto: retoParam } = useLocalSearchParams<{ editar?: string; reto?: string }>();
  const { ready, usuario } = useAccount();
  const [books, setBooks] = useState<Book[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<TipoGrupo>('celula');
  const [bookId, setBookId] = useState<string | null>('jhn');
  const [query, setQuery] = useState('');
  const [perDay, setPerDay] = useState(1);
  const [start, setStart] = useState(today());
  const options = retos();
  const suggested = options.find((o) => o.def.id === retoParam);
  const [kind, setKind] = useState<'libro' | 'reto'>(suggested ? 'reto' : 'libro');
  const [retoId, setRetoId] = useState(() => {
    const pick = suggested ?? options[0];
    return `${pick.def.id}-${pick.run.year}`;
  });
  const { busy, error, run } = useAction();

  // Los parámetros de la ruta pueden llegar después del primer render
  useEffect(() => {
    const pick = retos().find((o) => o.def.id === retoParam);
    if (!pick || editar) return;
    setKind('reto');
    setRetoId(`${pick.def.id}-${pick.run.year}`);
  }, [retoParam, editar]);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editar || !usuario) return;
    api<{ grupo: Grupo }>('grupo', { grupo: editar }).then(({ grupo }) => {
      setName(grupo.nombre);
      setType(grupo.tipo);
      setBookId(grupo.plan.libro);
      setPerDay(grupo.plan.porDia);
      if (grupo.plan.reto) {
        setKind('reto');
        setRetoId(grupo.plan.reto);
      }
      if (grupo.plan.inicio) setStart(grupo.plan.inicio);
    });
  }, [editar, usuario]);

  const book = books.find((b) => b.id === bookId);
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const shown = query.trim()
    ? books.filter((b) => norm(b.name).includes(norm(query.trim()))).slice(0, 12)
    : SUGGESTED.map((id) => books.find((b) => b.id === id)).filter((b): b is Book => !!b);
  if (book && !shown.includes(book)) shown.unshift(book);

  const days = book ? Math.ceil(book.chapters / perDay) : 0;
  const startOptions = [
    { value: today(), label: 'Hoy' },
    { value: addDays(today(), 1), label: 'Mañana' },
    { value: nextMonday(), label: 'El lunes' },
  ];
  if (!startOptions.some((o) => o.value === start)) startOptions.unshift({ value: start, label: longDate(start) });

  const chosen = options.find((o) => `${o.def.id}-${o.run.year}` === retoId) ?? options[0];
  const tint = seasonTint(chosen.def.season!, colors);

  const save = () =>
    run(async () => {
      const body = {
        nombre: name,
        tipo: type,
        plan: kind === 'reto' ? { reto: retoId } : book ? { libro: book.id, inicio: start, porDia: perDay } : null,
      };
      if (editar) {
        await api('editarGrupo', { grupo: editar, ...body });
        await refreshGroups();
        navigate(() => router.back(), 'back');
      } else {
        const { id } = await api<{ id: string }>('crearGrupo', body);
        await refreshGroups();
        navigate(() => router.replace(`/grupos/${id}?nuevo=1`), 'forward');
      }
    });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: editar ? 'Editar grupo' : 'Nuevo grupo' }} />
      {ready && !usuario ? (
        <Welcome intro="Para crear un grupo, entra con tu cuenta o crea una gratis." />
      ) : (
        <>
          <Field label="Nombre del grupo" value={name} onChangeText={setName} placeholder="Célula de los jueves" maxLength={60} />

          <SectionTitle>Es un grupo de</SectionTitle>
          <Chips options={TIPOS.map((t) => ({ value: t.tipo, label: t.label }))} value={type} onChange={setType} />

          <SectionTitle>Plan de lectura en común</SectionTitle>
          <Chips
            options={[
              { value: 'libro', label: 'Un libro de la Biblia' },
              { value: 'reto', label: 'Un reto de temporada' },
            ]}
            value={kind}
            onChange={(k) => setKind(k as 'libro' | 'reto')}
          />
          <View style={{ height: 14 }} />
          {kind === 'reto' ? (
            <>
              <Chips
                options={options.map((o) => ({ value: `${o.def.id}-${o.run.year}`, label: `${seasonTint(o.def.season!, colors).name} ${o.run.year}` }))}
                value={retoId}
                onChange={setRetoId}
              />
              <View style={[styles.reto, { backgroundColor: tint.soft }]}>
                <Text style={{ color: tint.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 }}>
                  {tint.name.toUpperCase()} {chosen.run.year}
                </Text>
                <Text style={[styles.retoTitle, { color: colors.text }]}>{chosen.def.title}</Text>
                <Text style={[text.body, { color: colors.text, marginTop: 6 }]}>
                  Del {longDate(chosen.run.start)} al {longDate(chosen.run.end)}: {chosen.def.spec.length} lecturas, una por día, con una
                  pregunta para conversar en cada una.
                </Text>
                {chosen.run.running && (
                  <Text style={[text.small, { color: colors.muted, marginTop: 6 }]}>Ya empezó: el grupo se une en el día de hoy.</Text>
                )}
              </View>
            </>
          ) : (
            <>
              <Field value={query} onChangeText={setQuery} placeholder="Buscar un libro" />
              <View style={{ height: 10 }} />
              <Chips
                options={[...shown.map((b) => ({ value: b.id, label: b.name })), { value: '', label: 'Sin plan' }]}
                value={bookId ?? ''}
                onChange={(v) => setBookId(v || null)}
              />

              {book && (
                <>
                  <SectionTitle>Ritmo</SectionTitle>
                  <Chips
                    options={[1, 2, 3].map((n) => ({ value: n, label: n === 1 ? '1 capítulo al día' : `${n} capítulos al día` }))}
                    value={perDay}
                    onChange={setPerDay}
                  />
                  <SectionTitle>Empieza</SectionTitle>
                  <Chips options={startOptions} value={start} onChange={setStart} />
                  <Text style={[text.body, { color: colors.text, marginTop: 16 }]}>
                    {book.name} en {days} {days === 1 ? 'día' : 'días'}: del {longDate(start)} al {longDate(addDays(start, days - 1))}.
                  </Text>
                </>
              )}
              {!book && (
                <Text style={[text.body, { color: colors.muted, marginTop: 12 }]}>
                  Sin plan, el grupo verá quién leyó cualquier capítulo cada día.
                </Text>
              )}
            </>
          )}

          <View style={{ marginTop: 32 }}>
            <Button label={editar ? 'Guardar cambios' : 'Crear el grupo'} onPress={save} busy={busy} disabled={!name.trim()} />
            <ErrorText>{error}</ErrorText>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  reto: { borderRadius: 18, padding: 16, marginTop: 14 },
  retoTitle: { fontFamily: serif, fontSize: 20, marginTop: 4 },
});
