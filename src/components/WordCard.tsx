import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconText } from '@/components/comunidad/ui';
import { ChevronRightIcon, ConcordanceIcon, SparkIcon, WordJourneyIcon } from '@/components/icons';
import StudyPanel from '@/components/StudyPanel';
import { concordanceHref, normalizeStrong } from '@/lib/concordancia';
import { Book, Word, getConcordance } from '@/lib/data';
import { describeMorph } from '@/lib/morph';
import { palabraDeStrong, palabraHref } from '@/lib/palabras';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

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
          <ConcordanceButton strong={strong} from={study && `${study.book.id}.${study.chapter}.${study.verse}`} />
          <PalabraButton strong={strong} />
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

/** «Todas las veces en la Biblia»: abre la concordancia de la palabra; el número llega cuando carga. */
export function ConcordanceButton({ strong, from, onOpen }: { strong: string; from?: string; onOpen?: () => void }) {
  const colors = useColors();
  const key = normalizeStrong(strong);
  const [loaded, setLoaded] = useState<{ key: string; count: number } | null>(null);
  const count = loaded && loaded.key === key ? loaded.count : null;
  useEffect(() => {
    if (key) getConcordance(key).then((c) => setLoaded({ key, count: c?.uses.length ?? 0 })).catch(() => {});
  }, [key]);
  if (!key || count === 0) return null;
  return (
    <Pressable
      onPress={() => {
        onOpen?.();
        navigate(() => router.push(concordanceHref(key, from) as never), 'forward');
      }}
      accessibilityRole="link"
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.concordance,
        { backgroundColor: hovered || pressed ? colors.border : colors.accentSoft },
      ]}
    >
      <ConcordanceIcon color={colors.text} size={20} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14.5 }}>Todas las veces en la Biblia</Text>
        <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 1 }}>
          {count === null ? 'Concordancia' : `${count.toLocaleString('es')} ${count === 1 ? 'vez' : 'veces'} · concordancia`}
        </Text>
      </View>
      <ChevronRightIcon color={colors.muted} size={18} strokeWidth={2} />
    </Pressable>
  );
}

/** «La historia de esta palabra»: solo para las palabras del catálogo (jésed, ágape…). */
export function PalabraButton({ strong, onOpen }: { strong: string; onOpen?: () => void }) {
  const colors = useColors();
  const palabra = palabraDeStrong(normalizeStrong(strong));
  if (!palabra) return null;
  return (
    <Pressable
      onPress={() => {
        onOpen?.();
        navigate(() => router.push(palabraHref(palabra.id) as never), 'forward');
      }}
      accessibilityRole="link"
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.concordance,
        styles.palabra,
        { backgroundColor: hovered || pressed ? colors.warmSoft : colors.surface, borderColor: colors.warm },
      ]}
    >
      <WordJourneyIcon color={colors.warm} size={20} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14.5 }}>La historia de esta palabra</Text>
        <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 1 }}>{`${palabra.nombre} por toda la Biblia, con pódcast`}</Text>
      </View>
      <ChevronRightIcon color={colors.muted} size={18} strokeWidth={2} />
    </Pressable>
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
  concordance: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginTop: 14 },
  palabra: { marginTop: 8, borderWidth: 1 },
  why: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, marginTop: 16, alignSelf: 'center' },
});
