// El texto de un pasaje corto (en la versión de la persona, o la RV1909 si no carga), con los números de versículo pequeños: para la pregunta de la semana del
// círculo, «Conocernos» y las etapas del camino de preparación.
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import type { Pasaje } from '@/lib/circulo';
import { useCapitulo } from '@/lib/enVersion';
import { Colors, serif } from '@/lib/theme';

export default function TextoPasaje({ pasaje, colors }: { pasaje: Pasaje; colors: Colors }) {
  const capitulo = useCapitulo(pasaje.book, pasaje.chapter);
  const verses = capitulo?.verses.filter(([v]) => v >= pasaje.from && v <= pasaje.to) ?? null;
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
