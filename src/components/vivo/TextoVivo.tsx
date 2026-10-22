import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { initials } from '@/lib/comunidad';
import type { Verse } from '@/lib/data';
import { isDark, sans, serif, useColors, useSettings } from '@/lib/theme';
import { type Toque, toneOf } from '@/lib/vivo';

type Props = {
  bookName: string;
  chapter: number;
  verses: Verse[];
  toques: Map<number, Toque[]>;
  foco: number | null;
  guia: string;
  me: string | null;
  lead: boolean;
  onTap: (verse: number) => void;
  /** Dónde quedó cada versículo dentro del texto, para llevar a todos al que señala quien guía. */
  onVerseLayout: (verse: number, y: number) => void;
};

/**
 * El capítulo que leen juntos, un versículo por línea. Quien guía lo toca para señalarlo a todos (se ilumina
 * con el tono cálido); los demás lo tocan para iluminarlo con su color, con sus iniciales al lado.
 */
export default function TextoVivo({ bookName, chapter, verses, toques, foco, guia, me, lead, onTap, onVerseLayout }: Props) {
  const colors = useColors();
  const { settings } = useSettings();
  const dark = isDark(colors);
  const size = settings.fontSize;
  const fontFamily = settings.font === 'sans' ? sans : serif;
  const top = useRef(0);

  return (
    <Appear key={`${bookName}.${chapter}`} from={14}>
      <View style={styles.head} onLayout={(e) => (top.current = e.nativeEvent.layout.y)}>
        <Text style={[styles.book, { color: colors.muted }]}>{bookName}</Text>
        <Text style={[styles.chapter, { color: colors.text, fontFamily: serif }]}>{chapter}</Text>
      </View>
      {verses.map(([n, text, label]) => {
        const who = toques.get(n) ?? [];
        const focused = foco === n;
        const mine = who.some((t) => t.usuario === me);
        const tone = who[0] ? toneOf(who[0].usuario) : null;
        return (
          <Pressable
            key={n}
            onPress={() => onTap(n)}
            onLayout={(e) => onVerseLayout(n, e.nativeEvent.layout.y)}
            accessibilityRole="button"
            accessibilityLabel={`Versículo ${label ?? n}${focused ? `, señalado por ${guia}` : ''}${who.length ? `, iluminado por ${who.map((t) => t.nombre).join(', ')}` : ''}`}
            accessibilityHint={lead ? 'Señalarlo para todos' : mine ? 'Apagar tu luz' : 'Iluminarlo para todos'}
            style={({ pressed }) => [
              styles.verse,
              tone && { backgroundColor: dark ? tone.dark : tone.light },
              focused && { backgroundColor: colors.warmSoft, borderLeftColor: colors.warm },
              pressed && { opacity: 0.75 },
            ]}
          >
            {focused && (
              <Text style={[styles.pointer, { color: colors.warm }]}>
                {guia === 'Tú' ? 'TÚ SEÑALAS' : `${guia.split(' ')[0].toUpperCase()} SEÑALA`}
              </Text>
            )}
            <Text style={{ fontFamily, fontSize: size, lineHeight: size * 1.6, color: colors.text }}>
              <Text style={{ fontSize: size * 0.6, color: focused ? colors.warm : colors.accent, fontWeight: '700' }}>{label ?? n} </Text>
              {text}
            </Text>
            {who.length > 0 && (
              <View style={styles.who}>
                {who.map((t) => {
                  const c = toneOf(t.usuario);
                  return (
                    <View key={t.usuario} style={[styles.dot, { backgroundColor: c.ink }]}>
                      <Text style={styles.dotText}>{t.usuario === me ? 'TÚ' : initials(t.nombre)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Pressable>
        );
      })}
    </Appear>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  book: { fontSize: 13, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' },
  chapter: { fontSize: 64, lineHeight: 72, marginTop: 4 },
  verse: {
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    marginBottom: 4,
  },
  pointer: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  who: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  dot: { minWidth: 24, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
});
