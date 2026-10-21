// Piezas de «Comparar versiones»: la fila para elegir versiones, el texto con las palabras que cambian marcadas y la
// pestaña Versiones del panel del versículo. La pantalla del capítulo entero está en src/app/comparar/.
// Las versiones con derechos se leen igual que en el lector (en línea, con su aviso y FUMS); nunca van a la IA.

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, ChevronRightIcon, GlobeIcon } from '@/components/icons';
import { compareList, diffWords, findVerse, toggleCompare } from '@/lib/comparar';
import { Book, Verse, Version, getChapter, getChapterExtras, getVersions } from '@/lib/data';
import { BOOK_SLUGS } from '@/lib/routes';
import { Colors, isDark, serif, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Todas las versiones (libres y con derechos) y las que se comparan, con la que se lee primero. */
export function useCompareVersions() {
  const { settings, update } = useSettings();
  const [all, setAll] = useState<Version[]>([]);
  useEffect(() => {
    getVersions().then(setAll).catch(() => {});
  }, []);
  const chosen = useMemo(() => compareList(settings.comparar, settings.version, all), [settings.comparar, settings.version, all]);
  const toggle = (id: string) => {
    if (id === settings.version) return; // la que se lee es la base de la comparación
    update({ comparar: toggleCompare(settings.comparar, id) });
  };
  return { all, chosen, toggle, reading: settings.version };
}

/** extras: aviso del editor y notas al pie de las versiones con derechos. */
export type Extras = { copyright: string | null; notes: Record<number, string[]> } | null;
export type Loaded = { verses: Verse[] | null; error: string | null; extras?: Extras };

/** Capítulo de cada versión elegida; cada una llega por su cuenta y puede fallar sola (las con derechos, sin red). */
export function useChapters(book: string, chapter: number, versions: Version[]) {
  const [state, setState] = useState<Record<string, Loaded>>({});
  const ids = versions.map((v) => v.id).join(',');
  useEffect(() => {
    let live = true;
    for (const v of versions) {
      getChapter(book, chapter, v.id).then(
        async (verses) => {
          const extras = await getChapterExtras(book, chapter, v.id).catch(() => null);
          if (live) setState((s) => ({ ...s, [`${book}/${chapter}/${v.id}`]: { verses, error: null, extras } }));
        },
        (e) => live && setState((s) => ({ ...s, [`${book}/${chapter}/${v.id}`]: { verses: null, error: String(e.message ?? e) } })),
      );
    }
    return () => {
      live = false;
    };
  }, [book, chapter, ids]); // eslint-disable-line react-hooks/exhaustive-deps
  return (id: string): Loaded => state[`${book}/${chapter}/${id}`] ?? { verses: null, error: null };
}

/** Fila de versiones para poner o quitar de la comparación. */
export function VersionChips({
  all,
  chosen,
  reading,
  colors,
  onToggle,
}: {
  all: Version[];
  chosen: Version[];
  reading: string;
  colors: Colors;
  onToggle: (id: string) => void;
}) {
  const on = new Set(chosen.map((v) => v.id));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
      {all.map((v, i) => {
        const active = on.has(v.id);
        const base = v.id === reading;
        return (
          <View key={v.id} style={styles.chipWrap}>
            {v.licensed && !all[i - 1]?.licensed && <View style={[styles.chipDivider, { backgroundColor: colors.border }]} />}
            <Pressable
              onPress={() => onToggle(v.id)}
              disabled={base}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active, disabled: base }}
              aria-checked={active}
              accessibilityLabel={`${v.name}${base ? ', la que estás leyendo' : ''}`}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.chip,
                {
                  borderColor: active ? colors.accent : hovered ? colors.muted : colors.border,
                  backgroundColor: base ? colors.accent : active ? colors.accentSoft : colors.surface,
                },
                pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
              ]}
            >
              {active && !base && <CheckIcon color={colors.accent} size={13} strokeWidth={2.8} />}
              <Text style={[styles.chipText, { color: base ? colors.surface : active ? colors.accent : colors.muted }]}>{v.abbr}</Text>
              {v.licensed && <GlobeIcon color={base ? colors.surface : active ? colors.accent : colors.muted} size={12} strokeWidth={2} />}
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

/** Texto con las palabras que no están en la versión base marcadas con un subrayado suave. */
export function DiffText({
  base,
  text,
  marks,
  colors,
  style,
}: {
  base: string | null;
  text: string;
  marks: boolean;
  colors: Colors;
  style: object;
}) {
  const pieces = useMemo(() => (marks && base !== null ? diffWords(base, text) : [{ text, changed: false }]), [base, text, marks]);
  const tint = isDark(colors) ? 'rgba(226, 168, 104, 0.18)' : 'rgba(168, 100, 31, 0.10)';
  return (
    <Text style={style}>
      {pieces.map((p, i) =>
        p.changed ? (
          <Text key={i} style={{ backgroundColor: tint, color: colors.text, borderRadius: 3 }}>
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}

/** Interruptor pequeño para marcar o no las diferencias. */
export function MarksToggle({ on, colors, onPress }: { on: boolean; colors: Colors; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="Marcar diferencias"
      hitSlop={6}
      style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.track, { backgroundColor: on ? colors.accent : colors.border }]}>
        <View style={[styles.knob, { backgroundColor: colors.surface }, on && styles.knobOn]} />
      </View>
      <Text style={[styles.toggleText, { color: on ? colors.text : colors.muted }]}>Marcar diferencias</Text>
    </Pressable>
  );
}

/** Dos renglones grises mientras llega el texto. */
export function TextSkeleton({ colors, lines = 2 }: { colors: Colors; lines?: number }) {
  return (
    <View style={{ gap: 8, paddingVertical: 4 }}>
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={[styles.skeleton, { backgroundColor: colors.border, width: i === lines - 1 ? '62%' : '100%' }]} />
      ))}
    </View>
  );
}

/**
 * Aviso de derechos de una versión con permiso (el que manda el editor), sus enlaces y sus notas al pie:
 * las del versículo si se compara uno, o todas las del capítulo.
 */
export function LicenseNote({
  version,
  colors,
  extras,
  verse,
}: {
  version: Version;
  colors: Colors;
  extras?: Extras;
  verse?: number;
}) {
  const notes = Object.entries(extras?.notes ?? {})
    .map(([n, texts]) => [Number(n), texts] as const)
    .filter(([n]) => verse === undefined || n === verse)
    .sort(([a], [b]) => a - b);
  return (
    <View style={styles.licenseBox}>
      {notes.map(([n, texts]) =>
        texts.map((t, i) => (
          <Text key={`${n}-${i}`} style={[styles.footnote, { color: colors.text }]}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>
              {verse === undefined ? `${version.abbr} ${n}` : 'Nota'}
              {': '}
            </Text>
            {t}
          </Text>
        )),
      )}
      <Text style={[styles.license, { color: colors.muted }]}>{extras?.copyright ?? version.credit}</Text>
      {version.links?.length ? (
        <View style={styles.licenseLinks}>
          {version.links.map((l) => (
            <Text
              key={l.url}
              style={[styles.license, styles.licenseLink, { color: colors.accent }]}
              onPress={() => Linking.openURL(l.url)}
              accessibilityRole="link"
            >
              {l.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const compareHref = (book: string, chapter: number, verse?: number) =>
  `/comparar/${BOOK_SLUGS[book] ?? book}/${chapter}${verse ? `?v=${verse}` : ''}` as const;

/** Pestaña «Versiones» del panel del versículo: el versículo en cada versión elegida, una tarjeta por versión. */
export function CompareVerse({
  book,
  chapter,
  verse,
  colors,
  onNavigate,
}: {
  book: Book;
  chapter: number;
  verse: number;
  colors: Colors;
  onNavigate: () => void;
}) {
  const { all, chosen, toggle, reading } = useCompareVersions();
  const chapters = useChapters(book.id, chapter, chosen);
  const [marks, setMarks] = useState(true);
  const baseText = findVerse(chapters(reading).verses ?? [], verse)?.[1] ?? null;

  return (
    <View>
      <VersionChips all={all} chosen={chosen} reading={reading} colors={colors} onToggle={toggle} />
      <View style={styles.bar}>
        <Text style={[styles.hint, { color: colors.muted }]} numberOfLines={2}>
          Toca para añadir o quitar.
        </Text>
        <MarksToggle on={marks} colors={colors} onPress={() => setMarks(!marks)} />
      </View>

      <View style={{ gap: 10 }}>
        {chosen.map((v, i) => {
          const { verses, error, extras } = chapters(v.id);
          const found = verses ? findVerse(verses, verse) : undefined;
          const isBase = v.id === reading;
          return (
            <Appear key={v.id} delay={i * 40} from={6}>
              <View
                style={[
                  styles.card,
                  { backgroundColor: isBase ? colors.background : colors.surface, borderColor: isBase ? colors.accent : colors.border },
                ]}
              >
                <View style={styles.cardHead}>
                  <Text style={[styles.abbr, { color: colors.accent, fontFamily: serif }]}>{v.abbr}</Text>
                  <Text style={[styles.name, { color: colors.muted }]} numberOfLines={1}>
                    {v.name}
                  </Text>
                  {isBase ? (
                    <View style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
                      <Text style={[styles.tagText, { color: colors.accent }]}>Estás leyendo</Text>
                    </View>
                  ) : (
                    v.licensed && (
                      <View style={[styles.tag, { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
                        <GlobeIcon color={colors.muted} size={11} strokeWidth={2} />
                        <Text style={[styles.tagText, { color: colors.muted }]}>En línea</Text>
                      </View>
                    )
                  )}
                </View>
                {error ? (
                  <Text style={[styles.missing, { color: colors.muted }]}>{error}</Text>
                ) : !verses ? (
                  <TextSkeleton colors={colors} />
                ) : found ? (
                  <>
                    {found[2] && found[0] !== verse && (
                      <Text style={[styles.joined, { color: colors.muted }]}>Esta versión une los versículos {found[2]}</Text>
                    )}
                    <DiffText
                      base={isBase ? null : baseText}
                      text={found[1]}
                      marks={marks}
                      colors={colors}
                      style={[styles.verseText, { color: colors.text }]}
                    />
                  </>
                ) : (
                  <Text style={[styles.missing, { color: colors.muted }]}>Esta versión no tiene este versículo.</Text>
                )}
                {v.licensed && <LicenseNote version={v} colors={colors} extras={extras} verse={verse} />}
              </View>
            </Appear>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          onNavigate();
          navigate(() => router.push(compareHref(book.id, chapter, verse) as never), 'forward');
        }}
        accessibilityRole="button"
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.chapterLink,
          { borderColor: hovered ? colors.accent : colors.border, backgroundColor: colors.accentSoft },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={[styles.chapterLinkText, { color: colors.accent }]}>
          Comparar todo {book.name} {chapter}
        </Text>
        <ChevronRightIcon color={colors.accent} size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chipsScroll: { flexGrow: 0, maxWidth: '100%' },
  chips: { gap: 6, alignItems: 'center' },
  chipWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipDivider: { width: 1, height: 20, marginHorizontal: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3, lineHeight: 16 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10, marginBottom: 14 },
  hint: { fontSize: 12.5, flexShrink: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { width: 32, height: 19, borderRadius: 10, padding: 2, justifyContent: 'center' },
  knob: { width: 15, height: 15, borderRadius: 8 },
  knobOn: { alignSelf: 'flex-end' },
  toggleText: { fontSize: 12.5, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 13 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  abbr: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  name: { fontSize: 12, flexShrink: 1, flexGrow: 1 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, height: 20 },
  tagText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  verseText: { fontFamily: serif, fontSize: 17, lineHeight: 26 },
  joined: { fontSize: 11.5, fontStyle: 'italic', marginBottom: 2 },
  missing: { fontSize: 13.5, fontStyle: 'italic', lineHeight: 20 },
  licenseBox: { marginTop: 8, gap: 4 },
  license: { fontSize: 11, lineHeight: 15 },
  licenseLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  licenseLink: { fontWeight: '600', textDecorationLine: 'underline' },
  footnote: { fontSize: 13, lineHeight: 18 },
  skeleton: { height: 11, borderRadius: 6, opacity: 0.6 },
  chapterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 16,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
  },
  chapterLinkText: { fontSize: 14.5, fontWeight: '700' },
});
