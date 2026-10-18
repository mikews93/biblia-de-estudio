import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Source } from '@/lib/estudio';
import { Colors, serif } from '@/lib/theme';

export function Sources({ sources, colors, onOpen }: { sources: Source[]; colors: Colors; onOpen: (ref: string) => void }) {
  return (
    <View style={[styles.sources, { borderColor: colors.border }]}>
      <Text style={[styles.sourcesTitle, { color: colors.muted }]}>FUENTES</Text>
      {sources.map((s) => (
        <Pressable key={s.n} onPress={() => s.ref && onOpen(s.ref)} style={styles.sourceRow} disabled={!s.ref}>
          <Text style={[styles.sourceNumber, { color: colors.accent }]}>{s.n}</Text>
          <Text style={{ color: colors.text, flex: 1 }}>{s.label}</Text>
          {s.ref && <Text style={{ color: colors.muted }}>›</Text>}
        </Pressable>
      ))}
    </View>
  );
}

/** Markdown mínimo: títulos ##, listas con -, **negritas** y marcas de cita ⟦n⟧. */
export function Markdown({ text, colors }: { text: string; colors: Colors }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <View>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (!lines.length) return null;
        if (lines.length === 1 && /^#{1,3} /.test(lines[0])) {
          return (
            <Text key={i} style={[styles.h2, { color: colors.text }]}>
              {inline(lines[0].replace(/^#{1,3} /, ''), colors)}
            </Text>
          );
        }
        return lines.map((line, j) => {
          if (/^#{1,3} /.test(line)) {
            return (
              <Text key={`${i}-${j}`} style={[styles.h2, { color: colors.text }]}>
                {inline(line.replace(/^#{1,3} /, ''), colors)}
              </Text>
            );
          }
          const bullet = /^\s*[-*] /.test(line);
          return (
            <View key={`${i}-${j}`} style={bullet ? styles.bulletRow : undefined}>
              {bullet && <Text style={[styles.p, { color: colors.accent, width: 16 }]}>•</Text>}
              <Text style={[styles.p, { color: colors.text, flex: bullet ? 1 : undefined }]}>
                {inline(line.replace(/^\s*[-*] /, ''), colors)}
              </Text>
            </View>
          );
        });
      })}
    </View>
  );
}

function inline(text: string, colors: Colors): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|⟦\d+⟧)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    const cite = part.match(/^⟦(\d+)⟧$/);
    if (cite) {
      return (
        <Text key={i} style={[styles.cite, { color: colors.accent }]}>
          {' '}
          {cite[1]}
        </Text>
      );
    }
    return part;
  });
}

const styles = StyleSheet.create({
  h2: {
    fontSize: 19,
    fontFamily: serif,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 6,
  },
  p: { fontSize: 16, lineHeight: 25, marginBottom: 8 },
  bulletRow: { flexDirection: 'row' },
  cite: { fontSize: 11, fontWeight: '700', lineHeight: 16 },
  sources: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 10,
  },
  sourcesTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  sourceNumber: { fontWeight: '700', width: 20, textAlign: 'right' },
});
