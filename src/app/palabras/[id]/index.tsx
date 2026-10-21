// /palabras/jesed: la historia de una palabra por toda la Biblia. Arriba, la palabra en el original, cuántas veces
// aparece y su recorrido de Génesis a Apocalipsis; después, el relato que prepara la IA (qué significa, de 4 a 6
// momentos en el orden de la Biblia, el hilo que los une y dos preguntas), el pódcast y la palabra hermana del otro
// testamento. En pantallas anchas el resumen queda a la izquierda y el relato a la derecha.
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import Appear from '@/components/Appear';
import { TextSkeleton } from '@/components/Comparar';
import { ChevronRightIcon, ConcordanceIcon, RefreshIcon, TalkIcon, WordJourneyIcon } from '@/components/icons';
import { Markdown } from '@/components/StudyPanel';
import { SourcePeek } from '@/components/StudyText';
import { ToolState } from '@/components/ToolState';
import { IconText } from '@/components/comunidad/ui';
import { concordanceHref, displayStrong, summarize, type Concordance } from '@/lib/concordancia';
import { Book, getBooks, getPalabraConcordance, parseRef } from '@/lib/data';
import { Source } from '@/lib/estudio';
import { usePalabraIA } from '@/lib/herramientas';
import {
  type Columna,
  type PalabraEnTema,
  palabraHref,
  palabraPodcastHref,
  palabraPorId,
  palabrasHref,
  partirRelato,
  primeraReferencia,
  recorrido,
} from '@/lib/palabras';
import { verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Hover = { pressed: boolean; hovered?: boolean };

export default function PalabraScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palabra = palabraPorId(id);
  const colors = useColors();
  if (!palabra)
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'La historia de una palabra' }} />
        <WordJourneyIcon color={colors.muted} size={36} />
        <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: serif }]}>No conocemos esta palabra</Text>
        <Pressable onPress={() => router.replace(palabrasHref())} accessibilityRole="link">
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver todas las palabras ›</Text>
        </Pressable>
      </View>
    );
  return <Palabra key={palabra.id} palabra={palabra} />;
}

function Palabra({ palabra }: { palabra: PalabraEnTema }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const [books, setBooks] = useState<Book[]>([]);
  const [data, setData] = useState<Concordance | null | undefined>(undefined);
  const [peek, setPeek] = useState<Source | null>(null);
  const relato = usePalabraIA(palabra.id, 'relato');

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
    getPalabraConcordance(palabra.strongs)
      .then(setData)
      .catch(() => setData(null));
  }, [palabra.strongs]);

  const summary = useMemo(() => (data && books.length ? summarize(data.uses, books) : null), [data, books]);
  const columnas = useMemo(() => (data && books.length ? recorrido(data.uses, books) : null), [data, books]);

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  const resumen = (
    <>
      <Hero palabra={palabra} colors={colors} wide={wide} total={summary?.total} libros={summary?.books.length} at={summary?.ot} nt={summary?.nt} />
      <Appear delay={60}>
        <Recorrido columnas={columnas} books={books} hebreo={palabra.hebreo} colors={colors} />
      </Appear>
      {summary && summary.glosses.length > 0 && (
        <Appear delay={90} style={styles.section}>
          <SectionTitle colors={colors}>En la Reina-Valera se lee como</SectionTitle>
          <View style={styles.chips}>
            {summary.glosses.slice(0, 7).map((g) => (
              <View key={g.key} style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.text }]}>{g.key}</Text>
                <Text style={[styles.chipCount, { color: colors.muted }]}>{g.count}</Text>
              </View>
            ))}
          </View>
        </Appear>
      )}
      <Appear delay={120} style={styles.section}>
        <LinkCard
          colors={colors}
          icon={<TalkIcon color={colors.surface} size={20} />}
          filled
          title="Escúchala como pódcast"
          detail={`Ana y Tomás siguen ${palabra.nombre} por la Biblia`}
          onPress={() => navigate(() => router.push(palabraPodcastHref(palabra.id) as never), 'forward')}
        />
        <LinkCard
          colors={colors}
          icon={<ConcordanceIcon color={colors.text} size={20} />}
          title={summary ? `Las ${summary.total.toLocaleString('es')} veces, una por una` : 'Todas las veces, una por una'}
          detail="Concordancia con cada versículo"
          onPress={() => navigate(() => router.push(concordanceHref(palabra.strongs[0]) as never), 'forward')}
        />
        {palabra.pareja && <Pareja palabra={palabra} colors={colors} />}
      </Appear>
    </>
  );

  const historia = (
    <Historia
      palabra={palabra}
      relato={relato}
      colors={colors}
      onCite={(s) => (s.ref ? setPeek(s) : null)}
      onOpen={open}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: `${palabra.nombre[0].toUpperCase()}${palabra.nombre.slice(1)} · La historia de una palabra` }} />
      {wide ? (
        <View style={styles.columns}>
          <ScrollView style={[styles.side, { borderColor: colors.border }]} contentContainerStyle={styles.sideContent}>
            {resumen}
          </ScrollView>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.mainContent}>
            {historia}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {resumen}
          {historia}
        </ScrollView>
      )}
      {peek && (
        <View style={styles.peek} pointerEvents="box-none">
          <SourcePeek source={peek} colors={colors} onOpen={open} onClose={() => setPeek(null)} />
        </View>
      )}
    </View>
  );
}

function Hero(props: {
  palabra: PalabraEnTema;
  colors: Colors;
  wide: boolean;
  total?: number;
  libros?: number;
  at?: number;
  nt?: number;
}) {
  const { palabra, colors, wide } = props;
  const align = wide ? 'flex-start' : 'center';
  return (
    <View style={[styles.hero, { alignItems: align }]}>
      <View style={styles.kicker}>
        <WordJourneyIcon color={colors.accent} size={15} strokeWidth={2} />
        <Text style={[styles.kickerText, { color: colors.accent }]}>LA HISTORIA DE UNA PALABRA</Text>
      </View>
      <Appear style={{ alignItems: align, alignSelf: 'stretch' }}>
        <Text
          style={[styles.original, { color: colors.greek, fontFamily: serif, writingDirection: palabra.hebreo ? 'rtl' : 'ltr' }]}
          accessibilityLanguage={palabra.hebreo ? 'he' : 'grc'}
        >
          {palabra.original}
        </Text>
        <Text style={[styles.nombre, { color: colors.text, fontFamily: serif }]}>{palabra.nombre}</Text>
        <Text style={[styles.resumen, { color: colors.muted, textAlign: wide ? 'left' : 'center' }]}>{palabra.resumen}</Text>
        <View style={[styles.tags, { justifyContent: align }]}>
          <Tag colors={colors}>{palabra.tema}</Tag>
          <Tag colors={colors}>{palabra.hebreo ? 'Hebreo · AT' : 'Griego · NT'}</Tag>
          <Tag colors={colors} muted>{`Strong ${[...new Set(palabra.strongs.map((s) => displayStrong(s).replace(/[A-Z]$/, '')))].join(', ')}`}</Tag>
        </View>
      </Appear>
      <View style={styles.stats}>
        <Stat n={props.total} label="veces" colors={colors} />
        <Stat n={props.libros} label="libros" colors={colors} />
        <Stat
          n={props.total === undefined ? undefined : palabra.hebreo ? props.at : props.nt}
          label={palabra.hebreo ? 'en el AT' : 'en el NT'}
          colors={colors}
        />
      </View>
    </View>
  );
}

/** Las 66 columnas de la Biblia: la altura dice cuántas veces aparece la palabra en cada libro. */
function Recorrido({ columnas, books, hebreo, colors }: { columnas: Columna[] | null; books: Book[]; hebreo: boolean; colors: Colors }) {
  const [sel, setSel] = useState<string | null>(null);
  const names = useMemo(() => new Map(books.map((b) => [b.id, b.name])), [books]);
  const max = columnas ? Math.max(1, ...columnas.map((c) => c.count)) : 1;
  const top = columnas ? [...columnas].sort((a, b) => b.count - a.count)[0] : null;
  const shown = columnas?.find((c) => c.id === sel) ?? top;
  const firstNt = columnas?.findIndex((c) => !c.at) ?? 39;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHead}>
        <SectionTitle colors={colors}>Su recorrido por la Biblia</SectionTitle>
        {shown && shown.count > 0 && (
          <Text style={[styles.recorridoSel, { color: colors.text }]} numberOfLines={1}>
            {names.get(shown.id) ?? shown.id} · <Text style={{ fontWeight: '800' }}>{shown.count}</Text>
          </Text>
        )}
      </View>
      <View style={styles.bars} accessibilityLabel="Cuántas veces aparece en cada libro, de Génesis a Apocalipsis">
        {(columnas ?? Array.from({ length: 66 }, (_, i) => ({ id: String(i), count: 0, at: i < 39 }))).map((c, i) => {
          const on = c.id === shown?.id;
          // Raíz cuadrada: los libros con pocas apariciones se siguen viendo junto a los que tienen muchas
          const h = c.count ? 6 + Math.sqrt(c.count / max) * 58 : 2;
          const tint = c.at === hebreo ? colors.greek : colors.warm;
          return (
            <Pressable
              key={c.id}
              onPress={() => c.count && setSel(c.id)}
              onHoverIn={() => c.count && setSel(c.id)}
              accessibilityLabel={columnas ? `${names.get(c.id) ?? c.id}: ${c.count}` : undefined}
              style={[styles.barSlot, i === firstNt && { marginLeft: 5 }]}
            >
              <View
                style={{
                  height: columnas ? h : 2,
                  borderRadius: 2,
                  backgroundColor: c.count ? tint : colors.border,
                  opacity: c.count ? (on ? 1 : 0.55) : 1,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.axisText, { color: colors.muted }]}>Génesis</Text>
        <Text style={[styles.axisText, { color: colors.muted }]}>Mateo</Text>
        <Text style={[styles.axisText, { color: colors.muted }]}>Apocalipsis</Text>
      </View>
    </View>
  );
}

function Pareja({ palabra, colors }: { palabra: PalabraEnTema; colors: Colors }) {
  const otra = palabraPorId(palabra.pareja!.id)!;
  return (
    <Pressable
      onPress={() => navigate(() => router.push(palabraHref(otra.id) as never), 'forward')}
      accessibilityRole="link"
      accessibilityLabel={`La misma idea en el ${otra.hebreo ? 'hebreo' : 'griego'}: ${otra.nombre}`}
      style={({ pressed, hovered }: Hover) => [
        styles.pareja,
        { backgroundColor: hovered || pressed ? colors.accentSoft : colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.parejaKicker, { color: colors.muted }]}>
        {otra.hebreo ? 'LA MISMA IDEA EN EL ANTIGUO TESTAMENTO' : 'LA MISMA IDEA EN EL NUEVO TESTAMENTO'}
      </Text>
      <View style={styles.parejaRow}>
        <Text style={[styles.parejaOriginal, { color: colors.greek, fontFamily: serif }]}>{otra.original}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.parejaNombre, { color: colors.text, fontFamily: serif }]}>{otra.nombre}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={2}>
            {otra.resumen}
          </Text>
        </View>
        <ChevronRightIcon color={colors.muted} size={18} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

function Historia({
  palabra,
  relato,
  colors,
  onCite,
  onOpen,
}: {
  palabra: PalabraEnTema;
  relato: ReturnType<typeof usePalabraIA>;
  colors: Colors;
  onCite: (s: Source) => void;
  onOpen: (ref: string) => void;
}) {
  const partes = useMemo(() => partirRelato(relato.text), [relato.text]);
  const empty = !partes.significado && !partes.momentos.length;
  return (
    <View style={styles.historia}>
      <Text style={[styles.historiaTitle, { color: colors.text, fontFamily: serif }]}>El relato</Text>
      <Text style={[styles.historiaSub, { color: colors.muted }]}>
        {`Cómo ${palabra.nombre} va mostrando algo nuevo de un pasaje a otro`}
      </Text>

      {relato.error || (relato.busy && empty) ? (
        <>
          <ToolState
            colors={colors}
            busy={relato.busy}
            error={relato.error}
            waiting={`Siguiendo ${palabra.nombre} por la Biblia con el léxico, la concordancia y la RV1909…`}
            onRetry={relato.retry}
          />
          {!relato.error && (
            <View style={{ gap: 22 }}>
              {[0, 1, 2].map((i) => (
                <TextSkeleton key={i} colors={colors} lines={3} />
              ))}
            </View>
          )}
        </>
      ) : null}

      {partes.significado && (
        <Appear style={[styles.significado, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.blockKicker, { color: colors.muted }]}>QUÉ SIGNIFICA</Text>
          <Markdown text={partes.significado} colors={colors} sources={relato.sources} onCite={onCite} />
        </Appear>
      )}

      {partes.momentos.length > 0 && (
        <View style={styles.timeline}>
          {partes.momentos.map((m, i) => {
            const ref = primeraReferencia(m.texto, relato.sources);
            const last = i === partes.momentos.length - 1 && !partes.hilo;
            return (
              <Appear key={i} delay={Math.min(i, 4) * 50} style={styles.momento}>
                <View style={styles.rail}>
                  <View style={[styles.node, { backgroundColor: colors.background, borderColor: colors.greek }]}>
                    <Text style={[styles.nodeText, { color: colors.greek }]}>{i + 1}</Text>
                  </View>
                  {!last && <View style={[styles.railLine, { backgroundColor: colors.border }]} />}
                </View>
                <View style={styles.momentoBody}>
                  {ref && (
                    <Pressable
                      onPress={() => onOpen(ref.ref!)}
                      accessibilityRole="link"
                      style={({ pressed, hovered }: Hover) => [
                        styles.refPill,
                        { backgroundColor: hovered || pressed ? colors.border : colors.accentSoft },
                      ]}
                    >
                      <Text style={[styles.refPillText, { color: colors.text }]}>{ref.label}</Text>
                      <ChevronRightIcon color={colors.muted} size={13} strokeWidth={2.2} />
                    </Pressable>
                  )}
                  <Text style={[styles.momentoTitle, { color: colors.text, fontFamily: serif }]}>{m.titulo.replace(/\*+/g, '')}</Text>
                  <Markdown text={m.texto} colors={colors} sources={relato.sources} onCite={onCite} />
                </View>
              </Appear>
            );
          })}
        </View>
      )}

      {partes.hilo && (
        <Appear style={[styles.hilo, { backgroundColor: colors.warmSoft }]}>
          <Text style={[styles.blockKicker, { color: colors.warm }]}>EL HILO</Text>
          <Markdown text={partes.hilo} colors={colors} sources={relato.sources} onCite={onCite} />
        </Appear>
      )}

      {partes.preguntas.length > 0 && (
        <Appear style={styles.preguntas}>
          <SectionTitle colors={colors}>Para pensar</SectionTitle>
          {partes.preguntas.map((q, i) => (
            <View key={i} style={[styles.pregunta, { borderColor: colors.border }]}>
              <Text style={[styles.preguntaMark, { color: colors.warm, fontFamily: serif }]}>?</Text>
              <View style={{ flex: 1 }}>
                <Markdown text={q} colors={colors} sources={relato.sources} onCite={onCite} />
              </View>
            </View>
          ))}
        </Appear>
      )}

      {/* Si la IA no respetó el formato, se muestra tal cual */}
      {relato.done && empty && !!relato.text && <Markdown text={relato.text} colors={colors} sources={relato.sources} onCite={onCite} />}

      <View style={[styles.footer, { borderColor: colors.border }]}>
        <Text style={[styles.disclaimer, { color: colors.muted }]}>
          Relato preparado con IA solo a partir del léxico breve y la concordancia de STEPBible (Tyndale House, CC BY 4.0) y
          del texto de la Reina-Valera 1909. Cada número lleva a su fuente.
        </Text>
        {relato.done && (
          <Pressable onPress={relato.regenerate} accessibilityRole="button" hitSlop={8}>
            <IconText icon={RefreshIcon} color={colors.accent} size={14}>
              <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Preparar otra versión</Text>
            </IconText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function LinkCard(props: { colors: Colors; icon: ReactNode; title: string; detail: string; onPress: () => void; filled?: boolean }) {
  const { colors } = props;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="link"
      style={({ pressed, hovered }: Hover) => [
        styles.link,
        props.filled
          ? { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }
          : { backgroundColor: hovered || pressed ? colors.accentSoft : colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={[styles.linkIcon, { backgroundColor: props.filled ? colors.accent : colors.accentSoft }]}>{props.icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{props.title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{props.detail}</Text>
      </View>
      <ChevronRightIcon color={colors.muted} size={18} strokeWidth={2} />
    </Pressable>
  );
}

function SectionTitle({ colors, children }: { colors: Colors; children: string }) {
  return <Text style={[styles.sectionTitle, { color: colors.muted }]}>{children.toUpperCase()}</Text>;
}

function Stat({ n, label, colors }: { n?: number; label: string; colors: Colors }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {n === undefined ? (
        <View style={[styles.statSkel, { backgroundColor: colors.border }]} />
      ) : (
        <Text style={[styles.statN, { color: colors.text, fontFamily: serif }]}>{n.toLocaleString('es')}</Text>
      )}
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function Tag({ children, colors, muted }: { children: string; colors: Colors; muted?: boolean }) {
  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: muted ? 'transparent' : colors.accentSoft, borderColor: colors.border, borderWidth: muted ? StyleSheet.hairlineWidth : 0 },
      ]}
    >
      <Text style={[styles.tagText, { color: muted ? colors.muted : colors.text }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 72, maxWidth: 680, width: '100%', alignSelf: 'center' },
  columns: { flex: 1, flexDirection: 'row', maxWidth: 1240, width: '100%', alignSelf: 'center' },
  side: { width: 400, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth },
  sideContent: { paddingHorizontal: 28, paddingBottom: 48 },
  mainContent: { paddingHorizontal: 40, paddingBottom: 72, maxWidth: 780 },
  hero: { paddingTop: 16 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kickerText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.8 },
  original: { fontSize: 60, lineHeight: 78, marginTop: 8 },
  nombre: { fontSize: 26, fontStyle: 'italic', marginTop: -4 },
  resumen: { fontSize: 16, lineHeight: 22, marginTop: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  tag: { borderRadius: 10, paddingHorizontal: 9, height: 22, justifyContent: 'center' },
  tagText: { fontSize: 11.5, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 20 },
  stat: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, alignItems: 'center' },
  statN: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  statSkel: { width: 40, height: 22, borderRadius: 6, marginVertical: 4 },
  statLabel: { fontSize: 12, marginTop: 1 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginTop: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  recorridoSel: { fontSize: 13, flexShrink: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 68, marginTop: 6 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 0.6 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisText: { fontSize: 11, fontWeight: '600' },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, height: 32 },
  chipText: { fontSize: 14, fontWeight: '600' },
  chipCount: { fontSize: 12, fontWeight: '600' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 10 },
  linkIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pareja: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  parejaKicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  parejaRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  parejaOriginal: { fontSize: 32, lineHeight: 42 },
  parejaNombre: { fontSize: 18, fontStyle: 'italic' },
  historia: { marginTop: 36 },
  historiaTitle: { fontSize: 28, fontWeight: '600' },
  historiaSub: { fontSize: 14.5, marginTop: 4, marginBottom: 18 },
  significado: { borderRadius: 18, padding: 18, paddingBottom: 10 },
  blockKicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  timeline: { marginTop: 26 },
  momento: { flexDirection: 'row', gap: 14 },
  rail: { width: 30, alignItems: 'center' },
  node: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  nodeText: { fontSize: 13, fontWeight: '800' },
  railLine: { width: 2, flex: 1, marginVertical: 4, borderRadius: 1 },
  momentoBody: { flex: 1, paddingBottom: 22 },
  refPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 12, paddingLeft: 10, paddingRight: 7, height: 24, marginTop: 3 },
  refPillText: { fontSize: 12.5, fontWeight: '700' },
  momentoTitle: { fontSize: 21, fontWeight: '600', marginTop: 8, marginBottom: 6, lineHeight: 27 },
  hilo: { borderRadius: 18, padding: 18, paddingBottom: 10, marginTop: 4 },
  preguntas: { marginTop: 28 },
  pregunta: { flexDirection: 'row', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginBottom: 6 },
  preguntaMark: { fontSize: 24, fontWeight: '700', lineHeight: 26, width: 16 },
  footer: { alignItems: 'center', marginTop: 28, paddingTop: 18, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  disclaimer: { fontSize: 12, lineHeight: 17, textAlign: 'center', maxWidth: 520 },
  peek: { position: 'absolute', left: 0, right: 0, bottom: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '600', textAlign: 'center' },
});
