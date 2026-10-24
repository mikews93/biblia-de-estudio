import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { initials } from '@/lib/comunidad';
import type { Verse } from '@/lib/data';
import { rangoTexto, soloRango } from '@/lib/guion';
import { isDark, sans, serif, useColors, useSettings } from '@/lib/theme';
import { type Rango, type Toque, toneOf } from '@/lib/vivo';

import { CreditoVersion, useVersion } from './Guion';

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
  /** La versión en que se muestra el texto. */
  version: string;
  /** Los versículos que eligió quien guía y si esta persona pidió ver el capítulo entero. */
  rango?: Rango | null;
  todo?: boolean;
  onTodo?: (todo: boolean) => void;
};

/**
 * El capítulo que leen juntos, un versículo por línea. Quien guía lo toca para señalarlo a todos (se ilumina
 * con el tono cálido); los demás lo tocan para iluminarlo con su color, con sus iniciales al lado.
 */
export default function TextoVivo({ bookName, chapter, verses: all, toques, foco, guia, me, lead, onTap, onVerseLayout, version, rango, todo, onTodo }: Props) {
  const colors = useColors();
  const { settings } = useSettings();
  const dark = isDark(colors);
  const size = settings.fontSize;
  const fontFamily = settings.font === 'sans' ? sans : serif;
  const top = useRef(0);
  const { abbr } = useVersion(version);
  const elegidos = rango ? all.filter(([n]) => n >= rango.desde && n <= rango.hasta) : all;
  // Si el rango no cae en este capítulo (otra versión que numera distinto), se ve entero.
  const solo = !!rango && !todo && elegidos.length > 0;
  const verses = solo ? elegidos : all;

  return (
    <Appear key={`${bookName}.${chapter}`} from={14}>
      <View style={styles.head} onLayout={(e) => (top.current = e.nativeEvent.layout.y)}>
        <Text style={[styles.book, { color: colors.muted }]}>{bookName}</Text>
        <Text style={[styles.chapter, { color: colors.text, fontFamily: serif }]}>{chapter}</Text>
        <View style={styles.meta}>
          {solo && (
            <View style={[styles.pill, { backgroundColor: colors.warmSoft }]}>
              <Text style={[styles.pillText, { color: colors.warm }]}>{rangoTexto(rango!).toUpperCase()}</Text>
            </View>
          )}
          <View style={[styles.pill, { borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.pillText, { color: colors.muted }]}>{abbr}</Text>
          </View>
        </View>
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
      {!!rango && elegidos.length > 0 && onTodo && (
        <Pressable onPress={() => onTodo(!todo)} accessibilityRole="button" style={[styles.todo, { borderColor: colors.border }]}>
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>
            {todo ? `Ver ${soloRango(rango)}` : `Leer todo ${bookName} ${chapter}`}
          </Text>
        </Pressable>
      )}
      <CreditoVersion version={version} style={{ marginTop: 18, textAlign: 'center' }} />
    </Appear>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  book: { fontSize: 13, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' },
  chapter: { fontSize: 64, lineHeight: 72, marginTop: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 6 },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  todo: { alignSelf: 'center', borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9, marginTop: 16 },
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
