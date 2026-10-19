import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ArrowRightIcon, BooksIcon, ChevronRightIcon, CloseIcon, CompassIcon, CrossIcon, EyeIcon, type IconProps, LampIcon, LinkIcon } from '@/components/icons';
import Appear from '@/components/Appear';
import { getChapter, parseRef } from '@/lib/data';
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
function Heading({ text, colors, ornate, cites }: { text: string; colors: Colors; ornate?: boolean; cites: Cites }) {
  const title = text.replace(/^#{1,3} /, '');
  const Icon = ornate ? SECTION_ICONS.find(([re]) => re.test(title))?.[1] : undefined;
  if (!Icon) return <Text style={[styles.h2, { color: colors.text }]}>{inline(title, colors, cites)}</Text>;
  return (
    <View style={styles.ornate}>
      <View style={[styles.ornateIcon, { backgroundColor: colors.accentSoft }]}>
        {typeof Icon === 'string' ? (
          <Text style={{ color: colors.accent, fontFamily: serif, fontSize: 14 }}>{Icon}</Text>
        ) : (
          <Icon color={colors.accent} size={15} strokeWidth={2} />
        )}
      </View>
      <Text style={[styles.h2, styles.ornateText, { color: colors.text }]}>{inline(title, colors, cites)}</Text>
    </View>
  );
}

type Cites = {
  /** Fuentes de esta respuesta: con ellas los números ⟦n⟧ se pueden tocar. */
  sources?: Source[];
  onCite?: (source: Source) => void;
};

export function Markdown({ text, colors, ornate, sources, onCite }: { text: string; colors: Colors; ornate?: boolean } & Cites) {
  const cites = { sources, onCite };
  const blocks = text.split(/\n{2,}/);
  return (
    <View>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (!lines.length) return null;
        if (lines.length === 1 && /^#{1,3} /.test(lines[0])) {
          return <Heading key={i} text={lines[0]} colors={colors} ornate={ornate} cites={cites} />;
        }
        return lines.map((line, j) => {
          if (/^#{1,3} /.test(line)) {
            return <Heading key={`${i}-${j}`} text={line} colors={colors} ornate={ornate} cites={cites} />;
          }
          const bullet = /^\s*[-*] /.test(line);
          return (
            <View key={`${i}-${j}`} style={bullet ? styles.bulletRow : undefined}>
              {bullet && <Text style={[styles.p, { color: colors.accent, width: 16 }]}>•</Text>}
              <Text style={[styles.p, { color: colors.text, flex: bullet ? 1 : undefined }]}>
                {inline(line.replace(/^\s*[-*] /, ''), colors, cites)}
              </Text>
            </View>
          );
        });
      })}
    </View>
  );
}

function inline(text: string, colors: Colors, { sources, onCite }: Cites = {}): ReactNode[] {
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
      const source = sources?.find((s) => s.n === Number(cite[1]));
      if (!source || !onCite) {
        return (
          <Text key={i} style={[styles.cite, { color: colors.accent }]}>
            {'\u2009'}
            {cite[1]}
          </Text>
        );
      }
      // Un número en una pastilla, para que se vea que se puede tocar y sea fácil de acertar con el dedo. Con
      // espacios que no se parten, para que no quede separado de la frase ni partido en dos líneas.
      return (
        <Text key={i}>
          {'\u202f'}
          <Text
            onPress={() => onCite(source)}
            role="link"
            aria-label={`Fuente ${source.n}: ${source.label}`}
            style={[styles.cite, styles.citeTap, { color: colors.accent, backgroundColor: colors.accentSoft }]}
          >
            {`\u00a0${cite[1]}\u00a0`}
          </Text>
        </Text>
      );
    }
    return part;
  });
}

/**
 * Lo que dice una fuente sin salir del estudio: al tocar un número aparece encima de la caja de preguntas
 * con el texto del pasaje y un botón para leerlo en su capítulo.
 */
export function SourcePeek({ source, colors, onOpen, onClose }: { source: Source; colors: Colors; onOpen: (ref: string) => void; onClose: () => void }) {
  const [text, setText] = useState<{ ref: string; verses: [number, string][] } | null>(null);
  const ref = source.ref;

  useEffect(() => {
    if (!ref) return;
    let alive = true;
    const { start, end } = parseRef(ref);
    const last = end.chapter === start.chapter ? end.verse : start.verse + 2;
    getChapter(start.book, start.chapter)
      .then((vs) => alive && setText({ ref, verses: vs.filter(([n]) => n >= start.verse && n <= Math.min(last, start.verse + 2)).map(([n, t]) => [n, t]) }))
      .catch(() => alive && setText({ ref, verses: [] }));
    return () => {
      alive = false;
    };
  }, [ref]);

  const shown = text?.ref === ref ? text : null;
  const { start, end } = ref ? parseRef(ref) : { start: null, end: null };
  const more = !!start && !!end && (end.chapter !== start.chapter || end.verse > start.verse + 2);

  return (
    <Appear key={source.n} style={[styles.peek, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.peekHead}>
        <View style={[styles.peekBadge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.peekBadgeText, { color: colors.surface }]}>{source.n}</Text>
        </View>
        <Text style={[styles.peekLabel, { color: colors.text }]} numberOfLines={2}>
          {source.label}
        </Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar fuente" style={styles.peekClose}>
          <CloseIcon color={colors.muted} size={16} />
        </Pressable>
      </View>
      {ref ? (
        <>
          {shown ? (
            !!shown.verses.length && (
              <Text style={[styles.peekText, { color: colors.text }]} numberOfLines={5}>
                {shown.verses.map(([n, t], i) => (
                  <Text key={n}>
                    {i > 0 ? ' ' : ''}
                    <Text style={[styles.peekVerse, { color: colors.accent }]}>{n} </Text>
                    {t}
                  </Text>
                ))}
                {more ? ' …' : ''}
              </Text>
            )
          ) : (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 10 }} />
          )}
          <Pressable
            onPress={() => onOpen(ref)}
            accessibilityRole="link"
            style={({ pressed }) => [styles.peekOpen, { borderColor: colors.accent }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Leer en su capítulo ›</Text>
          </Pressable>
        </>
      ) : (
        <Text style={[styles.peekHint, { color: colors.muted }]}>Uno de los datos de la app que la IA usó para esta idea.</Text>
      )}
    </Appear>
  );
}

const styles = StyleSheet.create({
  peek: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  peekHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  peekBadge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  peekBadgeText: { fontSize: 12, fontWeight: '800' },
  peekLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
  peekClose: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  peekText: { fontFamily: serif, fontSize: 16, lineHeight: 24, marginTop: 10 },
  peekVerse: { fontSize: 11, fontWeight: '700' },
  peekHint: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  peekOpen: { alignSelf: 'flex-start', marginTop: 12, borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  citeTap: { borderRadius: 8, overflow: 'hidden' },
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
