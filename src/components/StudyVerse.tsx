import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Word } from '@/lib/data';
import { Colors, serif } from '@/lib/theme';

type Props = {
  n: number;
  text: string;
  words?: Word[];
  /** Hebreo: las palabras van de derecha a izquierda. */
  rtl?: boolean;
  refCount: number;
  selected: boolean;
  /** Color del resaltado, si lo hay. */
  mark?: string;
  fontSize: number;
  fontFamily?: string;
  colors: Colors;
  onSelect: () => void;
  onWord: (index: number) => void;
  onRefs: () => void;
};

/** Versículo en modo estudio: el texto, debajo el griego o el hebreo palabra por palabra y las referencias a un toque. */
export default function StudyVerse({ n, text, words, rtl, refCount, selected, mark, fontSize, fontFamily, colors, onSelect, onWord, onRefs }: Props) {
  return (
    <View
      style={[
        styles.block,
        { borderColor: colors.border, backgroundColor: mark },
        selected && { backgroundColor: colors.highlight },
      ]}
    >
      <Pressable onPress={onSelect}>
        <Text style={{ fontFamily, fontSize, lineHeight: fontSize * 1.55, color: colors.text }}>
          <Text style={{ fontSize: fontSize * 0.62, color: colors.accent, fontWeight: '700' }}>{n} </Text>
          {text}
        </Text>
      </Pressable>
      {words && words.length > 0 && (
        <View style={[styles.words, rtl && styles.rtl]}>
          {words.map(([original, , es], i) => (
            <Pressable key={i} onPress={() => onWord(i)} style={styles.word} accessibilityLabel={`${original}, ${es}`}>
              <Text style={{ fontFamily: serif, fontSize: fontSize * (rtl ? 0.95 : 0.82), color: colors.greek, writingDirection: rtl ? 'rtl' : 'ltr' }}>
                {original}
              </Text>
              <Text style={{ fontSize: Math.max(11, fontSize * 0.55), color: colors.muted }} numberOfLines={1}>
                {es || '·'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {refCount > 0 && (
        <Pressable onPress={onRefs} style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
            ↗ {refCount} {refCount === 1 ? 'referencia' : 'referencias'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingVertical: 12, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  words: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 6, marginTop: 8 },
  rtl: { flexDirection: 'row-reverse' },
  word: { alignItems: 'center', maxWidth: 120 },
  chip: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
});
