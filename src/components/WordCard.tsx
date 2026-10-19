import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconText } from '@/components/comunidad/ui';
import { SparkIcon } from '@/components/icons';
import StudyPanel from '@/components/StudyPanel';
import { Book, Word } from '@/lib/data';
import { describeMorph } from '@/lib/morph';
import { serif, useColors } from '@/lib/theme';

const HEBREW = /[\u0590-\u05FF]/;

type Props = {
  word: Word;
  reference: string;
  /** Pasaje y posición de la palabra, para «¿Por qué esta palabra?». */
  study?: { book: Book; chapter: number; verse: number; index: number };
  onClose: () => void;
};

export default function WordCard({ word, reference, study, onClose }: Props) {
  const colors = useColors();
  // Al ir a /entrar o /registro desde aquí, la ventana se oculta para no tapar esa pantalla y vuelve al regresar.
  const focused = useIsFocused();
  const [why, setWhy] = useState(false);
  const [greek, translit, es, en, lemma, meaning, strong, morph] = word;

  return (
    <Modal transparent animationType="fade" visible={focused} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar">
        <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.ref, { color: colors.muted }]}>{reference}</Text>
          <Text style={[styles.greek, { color: colors.greek, writingDirection: HEBREW.test(greek) ? 'rtl' : 'ltr' }]}>{greek}</Text>
          <Text style={[styles.translit, { color: colors.muted }]}>{translit}</Text>
          <Text style={[styles.gloss, { color: colors.accent }]}>«{es || en}»</Text>

          <View style={[styles.rule, { backgroundColor: colors.border }]} />

          <Row label="Forma de diccionario" colors={colors}>
            <Text style={{ fontFamily: serif, fontSize: 18, color: colors.text }}>{lemma}</Text>
          </Row>
          <Row label="Significado" colors={colors}>
            <Text style={{ color: colors.text }}>{meaning}</Text>
          </Row>
          <Row label="Gramática" colors={colors}>
            <Text style={{ color: colors.text }}>{describeMorph(morph)}</Text>
          </Row>
          <Text style={[styles.codes, { color: colors.muted }]}>
            Strong {strong} · {morph}
          </Text>
          {study && <WhyButton onPress={() => setWhy(true)} />}
        </Pressable>
      </Pressable>
      {why && study && (
        <StudyPanel
          book={study.book}
          chapter={study.chapter}
          verse={study.verse}
          word={{ index: study.index, greek }}
          onClose={() => setWhy(false)}
        />
      )}
    </Modal>
  );
}

/** Botón «¿Por qué esta palabra?»: abre la explicación con IA de la palabra en su versículo. */
export function WhyButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.why, { borderColor: colors.accent }, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
    >
      <IconText icon={SparkIcon} color={colors.accent} size={16}>
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>¿Por qué esta palabra?</Text>
      </IconText>
    </Pressable>
  );
}

function Row({ label, colors, children }: { label: string; colors: ReturnType<typeof useColors>; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 22, alignItems: 'center' },
  ref: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  greek: { fontFamily: serif, fontSize: 40, marginTop: 8 },
  translit: { fontStyle: 'italic', fontSize: 15, marginTop: 2 },
  gloss: { fontSize: 18, fontWeight: '600', marginTop: 6 },
  rule: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 16 },
  row: { alignSelf: 'stretch', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  codes: { fontSize: 12, alignSelf: 'stretch' },
  why: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, marginTop: 16, alignSelf: 'center' },
});
