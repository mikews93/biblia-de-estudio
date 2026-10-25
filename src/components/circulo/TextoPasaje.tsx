// El texto de un pasaje corto (RV1909), con los números de versículo pequeños: para la pregunta de la semana del
// círculo, «Conocernos» y las etapas del camino de preparación.
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import type { Pasaje } from '@/lib/circulo';
import { type Verse, getChapter } from '@/lib/data';
import { Colors, serif } from '@/lib/theme';

export default function TextoPasaje({ pasaje, colors }: { pasaje: Pasaje; colors: Colors }) {
  const [verses, setVerses] = useState<Verse[] | null>(null);
  useEffect(() => {
    getChapter(pasaje.book, pasaje.chapter).then(
      (all) => setVerses(all.filter(([v]) => v >= pasaje.from && v <= pasaje.to)),
      () => setVerses([]),
    );
  }, [pasaje.book, pasaje.chapter, pasaje.from, pasaje.to]);
  if (verses === null) return <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />;
  return (
    <Text style={[styles.verseText, { color: colors.text }]}>
      {verses.map(([v, t]) => (
        <Text key={v}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{v} </Text>
          {t}{' '}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  verseText: { fontFamily: serif, fontSize: 17, lineHeight: 27, marginTop: 12 },
});
