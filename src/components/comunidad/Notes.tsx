import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Nota, ago, api, chapterHref } from '@/lib/comunidad';
import { Book } from '@/lib/data';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

import { confirm } from './confirm';
import { Button, ErrorText, Field, text, useAction } from './ui';

type Props = {
  books: Book[];
  /** Grupo del que se leen las notas; sin él, las de todos los grupos de la persona. */
  group?: string;
  /** Grupos donde se puede escribir (el primero por defecto). */
  writeTo: { id: string; nombre: string }[];
  /** Pasaje fijo (desde el panel del versículo) o sugerido (la lectura de hoy). */
  passage?: { book: string; chapter: number; verse?: number };
  fixed?: boolean;
  onNavigate?: () => void;
};

/** Notas compartidas en un versículo: se leen en el grupo y se escriben sobre un pasaje. */
export default function Notes({ books, group, writeTo, passage, fixed, onNavigate }: Props) {
  const colors = useColors();
  const [notes, setNotes] = useState<Nota[] | null>(null);
  const [draft, setDraft] = useState('');
  const [target, setTarget] = useState(writeTo[0]?.id);
  const [chapter, setChapter] = useState(String(passage?.chapter ?? ''));
  const [verse, setVerse] = useState(String(passage?.verse ?? ''));
  const { busy, error, run } = useAction();
  const bookName = (id: string) => books.find((b) => b.id === id)?.name ?? id;

  const load = useCallback(() => {
    const filter = fixed && passage ? { libro: passage.book, capitulo: passage.chapter, versiculo: passage.verse } : {};
    api<{ notas: Nota[] }>('notas', { grupo: group, ...filter })
      .then((r) => setNotes(r.notas))
      .catch(() => setNotes([]));
  }, [group, fixed, passage?.book, passage?.chapter, passage?.verse]);

  useEffect(load, [load]);

  const add = () =>
    run(async () => {
      await api('nuevaNota', {
        grupo: target,
        libro: passage?.book,
        capitulo: Number(chapter),
        versiculo: Number(verse),
        texto: draft,
      });
      setDraft('');
      load();
    });

  const remove = async (n: Nota) => {
    if (!(await confirm('¿Borrar esta nota?', 'Se borrará para todo el grupo.', 'Borrar'))) return;
    await api('borrarNota', { nota: n.id }).catch(() => {});
    load();
  };

  return (
    <View style={{ gap: 12 }}>
      {passage && writeTo.length > 0 && (
        <View style={{ gap: 10 }}>
          {!fixed && (
            <View style={styles.refRow}>
              <Text style={[text.body, { color: colors.text }]}>{bookName(passage.book)}</Text>
              <Field value={chapter} onChangeText={setChapter} keyboardType="number-pad" style={styles.num} accessibilityLabel="Capítulo" />
              <Text style={{ color: colors.muted }}>:</Text>
              <Field value={verse} onChangeText={setVerse} keyboardType="number-pad" placeholder="vers." style={styles.num} accessibilityLabel="Versículo" />
            </View>
          )}
          <Field
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
            placeholder={fixed ? 'Comparte con tu grupo lo que te dice este versículo' : 'Lo que te llamó la atención'}
          />
          {writeTo.length > 1 && (
            <View style={styles.groupPick}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Compartir en:</Text>
              {writeTo.map((g) => (
                <Pressable key={g.id} onPress={() => setTarget(g.id)} hitSlop={6}>
                  <Text style={{ color: target === g.id ? colors.accent : colors.muted, fontWeight: target === g.id ? '700' : '500' }}>
                    {g.nombre}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <Button label="Compartir nota" onPress={add} busy={busy} disabled={!draft.trim() || !Number(chapter) || !Number(verse)} />
          <ErrorText>{error}</ErrorText>
        </View>
      )}

      {notes === null ? (
        <ActivityIndicator color={colors.accent} />
      ) : notes.length === 0 ? (
        <Text style={[text.body, { color: colors.muted }]}>
          {fixed ? 'Nadie de tus grupos ha escrito sobre este versículo todavía.' : 'Todavía no hay notas en el grupo.'}
        </Text>
      ) : (
        notes.map((n) => (
          <View key={n.id} style={[styles.note, { borderColor: colors.border }]}>
            {!fixed && (
              <Pressable
                onPress={() => {
                  onNavigate?.();
                  navigate(() => router.push(chapterHref(n.libro, n.capitulo, n.versiculo)), 'forward');
                }}
              >
                <Text style={{ color: colors.accent, fontWeight: '700' }}>
                  {bookName(n.libro)} {n.capitulo}:{n.versiculo}
                </Text>
              </Pressable>
            )}
            <Text style={[styles.noteText, { color: colors.text }]}>{n.texto}</Text>
            <View style={styles.meta}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {n.autor} · {ago(n.creado)}
                {!group && writeTo.length > 1 ? ` · ${n.grupoNombre}` : ''}
              </Text>
              {n.mia && (
                <Pressable onPress={() => remove(n)} hitSlop={8}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Borrar</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  num: { width: 64, paddingVertical: 8, textAlign: 'center' },
  groupPick: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  note: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  noteText: { fontFamily: serif, fontSize: 16, lineHeight: 24, marginTop: 4 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
});
