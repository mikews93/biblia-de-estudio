import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconText } from '@/components/comunidad/ui';
import { LinkIcon } from '@/components/icons';
import { useSpoken } from '@/lib/audio';
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
  /** Suena el capítulo en la lengua original: la palabra que se lee se ilumina. */
  listening?: boolean;
};

/** Versículo en modo estudio: el texto, debajo el griego o el hebreo palabra por palabra y las referencias a un toque. */
export default function StudyVerse({ n, text, words, rtl, refCount, selected, mark, fontSize, fontFamily, colors, onSelect, onWord, onRefs, listening }: Props) {
  // Solo se vuelve a dibujar el versículo que se está leyendo, no todo el capítulo.
  const spoken = useSpoken((w) => (listening && w?.verse === n ? w.index : -1));
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
          {words.map(([original, , es], i) => {
            const now = i === spoken;
            return (
              <Pressable
                key={i}
                onPress={() => onWord(i)}
                style={[styles.word, now && { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
                accessibilityLabel={`${original}, ${es}`}
              >
                <Text
                  style={{
                    fontFamily: serif,
                    fontSize: fontSize * (rtl ? 0.95 : 0.82),
                    color: now ? colors.accent : colors.greek,
                    writingDirection: rtl ? 'rtl' : 'ltr',
                  }}
                >
                  {original}
                </Text>
                <Text
                  style={{ fontSize: Math.max(11, fontSize * 0.55), color: now ? colors.text : colors.muted, fontWeight: now ? '700' : '400' }}
                  numberOfLines={1}
                >
                  {es || '·'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {refCount > 0 && (
        <Pressable onPress={onRefs} style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
          <IconText icon={LinkIcon} color={colors.accent} size={13} gap={5}>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
              {refCount} {refCount === 1 ? 'referencia' : 'referencias'}
            </Text>
          </IconText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingVertical: 12, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  words: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 4, rowGap: 4, marginTop: 8, marginHorizontal: -6 },
  rtl: { flexDirection: 'row-reverse' },
  // El borde transparente reserva el sitio del resaltado: al iluminarse una palabra no se mueve nada.
  word: { alignItems: 'center', maxWidth: 132, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  chip: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
});
