import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Welcome from '@/components/comunidad/Welcome';
import { Button, Chips, ErrorText, Field, SectionTitle, text, useAction } from '@/components/comunidad/ui';
import { Grupo, TIPOS, TipoGrupo, api, refreshGroups, today, useAccount } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import { useColors } from '@/lib/theme';
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

/** Crear un grupo o, con ?editar=<id>, cambiar su nombre y su plan. */
export default function NewGroup() {
  const colors = useColors();
  const { editar } = useLocalSearchParams<{ editar?: string }>();
  const { ready, usuario } = useAccount();
  const [books, setBooks] = useState<Book[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<TipoGrupo>('celula');
  const [bookId, setBookId] = useState<string | null>('jhn');
  const [query, setQuery] = useState('');
  const [perDay, setPerDay] = useState(1);
  const [start, setStart] = useState(today());
  const { busy, error, run } = useAction();

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

  const save = () =>
    run(async () => {
      const body = {
        nombre: name,
        tipo: type,
        plan: book ? { libro: book.id, inicio: start, porDia: perDay } : null,
      };
      if (editar) {
        await api('editarGrupo', { grupo: editar, ...body });
        await refreshGroups();
        navigate(() => router.back(), 'back');
      } else {
        const { id } = await api<{ id: string }>('crearGrupo', body);
        await refreshGroups();
        navigate(() => router.replace(`/comunidades/${id}?nuevo=1`), 'forward');
      }
    });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: editar ? 'Editar grupo' : 'Nuevo grupo' }} />
      {ready && !usuario ? (
        <Welcome intro="Para crear un grupo primero dinos cómo te llamas." />
      ) : (
        <>
          <Field label="Nombre del grupo" value={name} onChangeText={setName} placeholder="Célula de los jueves" maxLength={60} />

          <SectionTitle>Es un grupo de</SectionTitle>
          <Chips options={TIPOS.map((t) => ({ value: t.tipo, label: t.label }))} value={type} onChange={setType} />

          <SectionTitle>Plan de lectura en común</SectionTitle>
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
});
