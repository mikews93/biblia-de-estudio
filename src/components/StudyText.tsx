import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ArrowRightIcon, BooksIcon, ChevronRightIcon, CompassIcon, CrossIcon, EyeIcon, type IconProps, LampIcon, LinkIcon } from '@/components/icons';
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
          {s.ref && <ChevronRightIcon color={colors.muted} size={16} />}
        </Pressable>
      ))}
    </View>
  );
}

/** Markdown mínimo: títulos ##, listas con -, **negritas** y marcas de cita ⟦n⟧. */
// Iconos de las secciones del estudio profundo, por la palabra con que empieza el título.
// La letra griega se queda como letra: es la misma marca del texto original en el lector.
const SECTION_ICONS: [RegExp, ((p: IconProps) => ReactNode) | string][] = [
  [/^(panorama|resumen)/i, CompassIcon],
  [/^(observa|cómo avanza)/i, EyeIcon],
  [/^(palabras|qué dice el)/i, 'α'],
  [/^interpreta/i, LampIcon],
  [/^pasajes/i, LinkIcon],
  [/^hacia cristo/i, CrossIcon],
  [/^(para aplicar|para reflexionar|para pensar)/i, ArrowRightIcon],
  [/^(cómo la traduce|dónde más)/i, BooksIcon],
];

/** Título de sección; con «ornate», con su icono en un círculo, como en el estudio profundo. */
function Heading({ text, colors, ornate }: { text: string; colors: Colors; ornate?: boolean }) {
  const title = text.replace(/^#{1,3} /, '');
  const Icon = ornate ? SECTION_ICONS.find(([re]) => re.test(title))?.[1] : undefined;
  if (!Icon) return <Text style={[styles.h2, { color: colors.text }]}>{inline(title, colors)}</Text>;
  return (
    <View style={styles.ornate}>
      <View style={[styles.ornateIcon, { backgroundColor: colors.accentSoft }]}>
        {typeof Icon === 'string' ? (
          <Text style={{ color: colors.accent, fontFamily: serif, fontSize: 14 }}>{Icon}</Text>
        ) : (
          <Icon color={colors.accent} size={15} strokeWidth={2} />
        )}
      </View>
      <Text style={[styles.h2, styles.ornateText, { color: colors.text }]}>{inline(title, colors)}</Text>
    </View>
  );
}

export function Markdown({ text, colors, ornate }: { text: string; colors: Colors; ornate?: boolean }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <View>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (!lines.length) return null;
        if (lines.length === 1 && /^#{1,3} /.test(lines[0])) {
          return <Heading key={i} text={lines[0]} colors={colors} ornate={ornate} />;
        }
        return lines.map((line, j) => {
          if (/^#{1,3} /.test(line)) {
            return <Heading key={`${i}-${j}`} text={line} colors={colors} ornate={ornate} />;
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
  ornate: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 6 },
  ornateIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ornateText: { marginTop: 0, marginBottom: 0, flex: 1 },
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
