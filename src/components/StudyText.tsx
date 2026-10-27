import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ArrowRightIcon,
  BooksIcon,
  ChevronRightIcon,
  CloseIcon,
  CompassIcon,
  CrossIcon,
  ExternalIcon,
  EyeIcon,
  type IconProps,
  LampIcon,
  LinkIcon,
  SparkIcon,
} from '@/components/icons';
import Appear from '@/components/Appear';
import { citaLabel, parseCita } from '@/lib/cita';
import { getBooks, getChapter, getChapterExtras, parseRef } from '@/lib/data';
import { licensedById } from '@/lib/licenciadas';
import { Source } from '@/lib/estudio';
import { Colors, serif, useSettings } from '@/lib/theme';

export function Sources({ sources, colors, onOpen }: { sources: Source[]; colors: Colors; onOpen: (ref: string) => void }) {
  return (
    <View style={[styles.sources, { borderColor: colors.border }]}>
      <Text style={[styles.sourcesTitle, { color: colors.muted }]}>FUENTES</Text>
      {sources.map((s) => (
        <Pressable
          key={s.n}
          onPress={() => (s.ref ? onOpen(s.ref) : s.url && Linking.openURL(s.url))}
          style={styles.sourceRow}
          disabled={!s.ref && !s.url}
        >
          <Text style={[styles.sourceNumber, { color: colors.accent }]}>{s.n}</Text>
          <Text style={{ color: colors.text, flex: 1 }}>{s.label}</Text>
          {s.ref ? <ChevronRightIcon color={colors.muted} size={16} /> : s.url ? <ExternalIcon color={colors.muted} size={15} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

/** Markdown mínimo: títulos ##, listas con -, **negritas**, *cursivas*, marcas de cita ⟦n⟧ y versículos ⟪Juan 3:16⟫. */
// Iconos de las secciones del estudio profundo, por la palabra con que empieza el título.
// La letra griega se queda como letra: es la misma marca del texto original en el lector.
const SECTION_ICONS: [RegExp, ((p: IconProps) => ReactNode) | string][] = [
  [/^(panorama|resumen)/i, CompassIcon],
  [/^en corto/i, SparkIcon],
  [/^lo que dice la biblia/i, BooksIcon],
  [/^cómo lo (han|ha) entendido/i, LampIcon],
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
  /** Con él, los versículos ⟪…⟫ se pueden tocar para leerlos en su capítulo. */
  onOpenRef?: (ref: string) => void;
};

// Un versículo que la IA no copia (versión con derechos, ver versionSystem en api/_investigar.ts): ⟪Juan 3:16⟫.
const MARCA = /^⟪([^⟪⟫\n]{3,60})⟫$/;

export function Markdown({ text, colors, ornate, sources, onCite, onOpenRef }: { text: string; colors: Colors; ornate?: boolean } & Cites) {
  const cites = { sources, onCite, onOpenRef };
  // Mientras llega la respuesta, una marca a medias no se enseña.
  const blocks = text.replace(/⟪[^⟫\n]*$/, '').split(/\n{2,}/);
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
          const marca = line.trim().match(MARCA);
          if (marca) return <VerseQuote key={`${i}-${j}`} cita={marca[1]} colors={colors} onOpen={onOpenRef} />;
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
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|⟦\d+⟧|⟪[^⟪⟫\n]{3,60}⟫)/).map((part, i) => {
    // Un versículo dentro de una frase: su texto entre comillas
    if (part.startsWith('⟪') && part.endsWith('⟫')) return <InlineVerse key={i} cita={part.slice(1, -1)} />;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    // *cursiva*: las palabras del original transliteradas («*jésed*»)
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      return (
        <Text key={i} style={{ fontStyle: 'italic' }}>
          {part.slice(1, -1)}
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

type Quoted = {
  ref: string;
  label: string;
  verses: [number, string][];
  more: boolean;
  /** La versión del texto: sin conexión, una con derechos se muestra en RV1909. */
  version: string;
  copyright?: string | null;
};

/** El texto de ⟪Juan 3:16⟫ en la versión que lee la persona (hasta tres versículos), pedido en el momento. */
function useQuoted(cita: string): Quoted | null | 'none' {
  const { settings } = useSettings();
  const version = settings.version;
  const key = `${version}|${cita}`;
  // Con la llave, lo de otra cita o versión no se enseña mientras llega lo nuevo.
  const [quoted, setQuoted] = useState<{ key: string; q: Quoted | 'none' } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const books = await getBooks();
      const c = parseCita(cita, books);
      if (!c || c.problem) return 'none' as const;
      const first = c.verse ?? 1;
      const last = Math.min(c.verseEnd ?? c.verse ?? 3, first + 2);
      const ref = `${c.book}.${c.chapter}.${first}` + (last > first ? `-${c.book}.${c.chapter}.${last}` : '');
      const licensed = licensedById(version);
      let shown = version;
      const vs = await getChapter(c.book, c.chapter, version).catch(() => {
        if (!licensed) throw new Error('sin texto');
        shown = 'rv1909';
        return getChapter(c.book, c.chapter);
      });
      const verses = vs.filter(([n]) => n >= first && n <= last).map(([n, t]): [number, string] => [n, t]);
      if (!verses.length) return 'none' as const;
      const extras = licensed && shown === version ? await getChapterExtras(c.book, c.chapter, version).catch(() => null) : null;
      return {
        ref,
        label: citaLabel({ ...c, verse: first, verseEnd: last > first ? last : undefined }, books),
        verses,
        more: (c.verseEnd ?? c.verse ?? 0) > last || c.verse === undefined,
        version: shown,
        copyright: extras?.copyright,
      };
    })()
      .catch(() => 'none' as const)
      .then((q) => alive && setQuoted({ key, q }));
    return () => {
      alive = false;
    };
  }, [cita, version, key]);
  return quoted?.key === key ? quoted.q : null;
}

/** ⟪Juan 3:16⟫ en una línea propia: el versículo en una tarjeta, con su versión y el aviso que piden los editores. */
function VerseQuote({ cita, colors, onOpen }: { cita: string; colors: Colors; onOpen?: (ref: string) => void }) {
  const quoted = useQuoted(cita);
  if (quoted === 'none') return <Text style={[styles.p, { color: colors.muted }]}>{cita}</Text>;
  const licensed = quoted ? licensedById(quoted.version) : undefined;
  const body = (
    <>
      <View style={styles.quoteHead}>
        <Text style={[styles.quoteLabel, { color: colors.accent }]} numberOfLines={1}>
          {quoted?.label ?? cita}
        </Text>
        {quoted && (
          <View style={[styles.quotePill, { borderColor: colors.border }]}>
            <Text style={[styles.quotePillText, { color: colors.muted }]}>{licensed?.abbr ?? quoted.version.toUpperCase()}</Text>
          </View>
        )}
        {quoted && onOpen && <ChevronRightIcon color={colors.muted} size={15} />}
      </View>
      {quoted ? (
        <Text style={[styles.quoteText, { color: colors.text }]}>
          {quoted.verses.map(([n, t], i) => (
            <Text key={n}>
              {i > 0 ? ' ' : ''}
              {quoted.verses.length > 1 && <Text style={[styles.peekVerse, { color: colors.accent }]}>{n} </Text>}
              {t}
            </Text>
          ))}
          {quoted.more ? ' …' : ''}
        </Text>
      ) : (
        <View style={styles.quoteLoading}>
          <View style={[styles.quoteBar, { backgroundColor: colors.border, width: '92%' }]} />
          <View style={[styles.quoteBar, { backgroundColor: colors.border, width: '64%' }]} />
        </View>
      )}
      {licensed && (
        <Text style={[styles.peekCredit, { color: colors.muted }]}>
          {quoted && typeof quoted === 'object' && quoted.copyright ? quoted.copyright : licensed.credit}
          {licensed.links.map((l) => (
            <Text key={l.url} onPress={() => Linking.openURL(l.url)} role="link" style={{ color: colors.accent }}>
              {` · ${l.label}`}
            </Text>
          ))}
        </Text>
      )}
    </>
  );
  const style = [styles.quote, { backgroundColor: colors.accentSoft, borderColor: colors.accent }];
  if (!quoted || !onOpen) return <View style={style}>{body}</View>;
  return (
    <Pressable
      onPress={() => onOpen(quoted.ref)}
      accessibilityRole="link"
      accessibilityLabel={`${quoted.label}: leer en su capítulo`}
      style={({ pressed }) => [...style, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}

/** ⟪Juan 3:16⟫ dentro de una frase: Juan 3:16, «texto» (la versión ya se ve en el selector del estudio). */
function InlineVerse({ cita }: { cita: string }) {
  const quoted = useQuoted(cita);
  if (!quoted || quoted === 'none') return <Text>{cita}</Text>;
  return (
    <Text>
      {`${quoted.label}, `}
      <Text style={{ fontStyle: 'italic' }}>«{quoted.verses.map(([, t]) => t).join(' ')}{quoted.more ? ' …' : ''}»</Text>
    </Text>
  );
}

/**
 * Lo que dice una fuente sin salir del estudio: al tocar un número aparece encima de la caja de preguntas
 * con el texto del pasaje y un botón para leerlo en su capítulo. Con «version», el texto sale en la versión que
 * lee la persona, también si es una con derechos (con el aviso que piden sus editores), aunque la IA no la recibe.
 */
export function SourcePeek({
  source,
  colors,
  onOpen,
  onClose,
  version = 'rv1909',
}: {
  source: Source;
  colors: Colors;
  onOpen: (ref: string) => void;
  onClose: () => void;
  version?: string;
}) {
  const [text, setText] = useState<{ ref: string; verses: [number, string][]; copyright?: string | null; licensed?: boolean } | null>(null);
  const ref = source.ref;
  const licensed = licensedById(version);

  useEffect(() => {
    if (!ref) return;
    let alive = true;
    const { start, end } = parseRef(ref);
    const last = end.chapter === start.chapter ? end.verse : start.verse + 2;
    const pick = (vs: [number, string, string?][]) => vs.filter(([n]) => n >= start.verse && n <= Math.min(last, start.verse + 2)).map(([n, t]): [number, string] => [n, t]);
    getChapter(start.book, start.chapter, version)
      .then(async (vs) => {
        const extras = licensed ? await getChapterExtras(start.book, start.chapter, version).catch(() => null) : null;
        if (alive) setText({ ref, verses: pick(vs), copyright: extras?.copyright, licensed: !!licensed });
      })
      // Sin la versión con derechos (sin conexión), la RV1909
      .catch(() => (licensed ? getChapter(start.book, start.chapter).then((vs) => alive && setText({ ref, verses: pick(vs) })) : Promise.reject()))
      .catch(() => alive && setText({ ref, verses: [] }));
    return () => {
      alive = false;
    };
  }, [ref, version, licensed]);

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
          {/* Un comentario: la IA no nombra a su autor en el texto, así que aquí se ve de quién es y qué pasaje comenta. */}
          {!!source.nota && (
            <>
              <View style={styles.peekObra}>
                <BooksIcon color={colors.accent} size={14} strokeWidth={2} />
                <Text style={[styles.peekObraText, { color: colors.muted }]}>{source.nota}</Text>
              </View>
              <Text style={[styles.peekHint, { color: colors.muted }]}>
                Un comentario humano, no la Escritura. La IA lo leyó en su inglés original y lo explica con sus palabras. Comenta este pasaje:
              </Text>
            </>
          )}
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
          {/* Los editores piden su aviso de derechos y sus enlaces cada vez que se muestra su texto. */}
          {licensed && shown?.licensed && !!shown.verses.length && (
            <Text style={[styles.peekCredit, { color: colors.muted }]}>
              {shown.copyright || licensed.credit}
              {licensed.links.map((l) => (
                <Text key={l.url} onPress={() => Linking.openURL(l.url)} role="link" style={{ color: colors.accent }}>
                  {` · ${l.label}`}
                </Text>
              ))}
            </Text>
          )}
          <Pressable
            onPress={() => onOpen(ref)}
            accessibilityRole="link"
            style={({ pressed }) => [styles.peekOpen, { borderColor: colors.accent }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Leer en su capítulo ›</Text>
          </Pressable>
        </>
      ) : source.url ? (
        // Una obra clásica (teología, historia del canon): no se muestra su inglés, solo de quién es y dónde leerla.
        <>
          {!!source.nota && (
            <View style={styles.peekObra}>
              <BooksIcon color={colors.accent} size={14} strokeWidth={2} />
              <Text style={[styles.peekObraText, { color: colors.muted }]}>{source.nota}</Text>
            </View>
          )}
          <Text style={[styles.peekHint, { color: colors.muted }]}>
            Una obra humana, no la Escritura. La IA la leyó en su inglés original y la explica con sus palabras.
          </Text>
          <Pressable
            onPress={() => Linking.openURL(source.url!)}
            accessibilityRole="link"
            style={({ pressed }) => [styles.peekOpen, styles.peekOpenRow, { borderColor: colors.accent }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Leer la obra original</Text>
            <ExternalIcon color={colors.accent} size={14} strokeWidth={2.2} />
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
  peekCredit: { fontSize: 11, lineHeight: 15, marginTop: 8 },
  peekObra: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  peekObraText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  peekOpenRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  peekOpen: { alignSelf: 'flex-start', marginTop: 12, borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  citeTap: { borderRadius: 8, overflow: 'hidden' },
  quote: { borderLeftWidth: 3, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 4, marginBottom: 12 },
  quoteHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quoteLabel: { flex: 1, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  quotePill: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 1 },
  quotePillText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 },
  quoteText: { fontFamily: serif, fontSize: 17, lineHeight: 26, marginTop: 6 },
  quoteLoading: { gap: 8, marginTop: 10, marginBottom: 4 },
  quoteBar: { height: 10, borderRadius: 5 },
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
