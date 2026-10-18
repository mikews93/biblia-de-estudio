import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/comunidad';
import { Book } from '@/lib/data';
import { serif, useColors } from '@/lib/theme';

import { Button, Chips, ErrorText, Field, text, useAction } from './ui';

type Props = { group: string; books: Book[]; suggested?: { book: string; chapters: number[] } };

/** Preguntas para la reunión sugeridas por la IA. Solo preguntas: quien guía es el líder. */
export default function Meeting({ group, books, suggested }: Props) {
  const colors = useColors();
  const [bookId, setBookId] = useState(suggested?.book ?? 'jhn');
  const [chapter, setChapter] = useState(String(suggested?.chapters[0] ?? 1));
  const [questions, setQuestions] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { busy, error, run } = useAction();
  const book = books.find((b) => b.id === bookId);

  // Capítulos recientes del plan para elegir rápido: el de hoy y los dos anteriores.
  const recent = suggested
    ? Array.from({ length: 3 }, (_, i) => suggested.chapters[0] - i).filter((n) => n >= 1)
    : [];

  useEffect(() => setQuestions(null), [bookId, chapter]);

  const ask = (nuevas = false) =>
    run(async () => {
      const r = await api<{ texto: string }>('preguntas', { grupo: group, libro: bookId, capitulo: Number(chapter), nuevas });
      setQuestions(r.texto);
    });

  const copy = async () => {
    if (!questions || !book) return;
    await Clipboard.setStringAsync(`Preguntas para ${book.name} ${chapter}\n\n${questions.replace(/^## /gm, '')}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={[text.body, { color: colors.text }]}>
        Elige el pasaje de la reunión y la IA te propone preguntas para conversar. No da respuestas ni escribe la enseñanza:
        el grupo descubre el texto por sí mismo.
      </Text>
      {recent.length > 0 && book && (
        <Chips
          options={recent.map((n) => ({ value: String(n), label: `${book.name} ${n}` }))}
          value={bookId === suggested?.book ? chapter : ''}
          onChange={(v) => {
            setBookId(suggested!.book);
            setChapter(v);
          }}
        />
      )}
      <View style={styles.row}>
        <Text style={[text.body, { color: colors.text }]}>{book?.name ?? bookId}</Text>
        <Field
          value={chapter}
          onChangeText={setChapter}
          keyboardType="number-pad"
          style={styles.num}
          accessibilityLabel="Capítulo"
        />
      </View>
      <Button
        label={questions ? 'Otras preguntas' : 'Sugerir preguntas'}
        kind={questions ? 'outline' : 'primary'}
        onPress={() => ask(!!questions)}
        busy={busy}
        disabled={!book || !(Number(chapter) >= 1 && Number(chapter) <= book.chapters)}
      />
      <ErrorText>{error}</ErrorText>

      {questions && (
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {questions.split('\n').map((line, i) => {
            if (line.startsWith('## ')) {
              return (
                <Text key={i} style={[styles.heading, { color: colors.accent }]}>
                  {line.slice(3)}
                </Text>
              );
            }
            if (line.startsWith('- ')) {
              return (
                <View key={i} style={styles.bullet}>
                  <Text style={{ color: colors.muted }}>•</Text>
                  <Text style={[styles.question, { color: colors.text }]}>{line.slice(2)}</Text>
                </View>
              );
            }
            return line.trim() ? (
              <Text key={i} style={[styles.question, { color: colors.text }]}>
                {line}
              </Text>
            ) : null;
          })}
          <Button label={copied ? 'Copiadas' : 'Copiar preguntas'} kind="quiet" onPress={copy} style={{ marginTop: 8 }} />
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>Sugeridas por IA a partir de la Reina-Valera 1909.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  num: { width: 72, paddingVertical: 8, textAlign: 'center' },
  sheet: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 18, marginTop: 4 },
  heading: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  bullet: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  question: { fontFamily: serif, fontSize: 16, lineHeight: 24, flex: 1 },
});
