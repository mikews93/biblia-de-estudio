// «¿Por qué difieren?»: debajo de Comparar versiones, una tarjeta por cada palabra griega o hebrea que las versiones
// dicen de forma distinta, con cómo la dice cada una y una explicación breve y neutral. Se calcula en el teléfono
// (src/lib/diferencias.ts), sin IA, así que también sirve con las versiones con derechos.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import type { Loaded } from '@/components/Comparar';
import { ChevronDownIcon, ForkIcon, ScrollIcon } from '@/components/icons';
import WordCard from '@/components/WordCard';
import { findVerse } from '@/lib/comparar';
import { Version, Word, getInterlinear, getVariants } from '@/lib/data';
import { Difference, VerseVariants, VersionText, explainDifferences, isEmptyVerse } from '@/lib/diferencias';
import { Colors, isDark, serif } from '@/lib/theme';

const HEBREW = /[֐-׿]/;
/** Tarjetas que se ven sin tocar «Ver más». */
const FIRST = 3;

type Original = { words: Record<string, Word[]>; variants: Record<string, VerseVariants> } | null;

/** Interlineal y diferencias de manuscritos de un capítulo (null mientras llegan; vacío si no hay). */
export function useOriginal(book: string, chapter: number): Original {
  const [state, setState] = useState<{ key: string; value: Original }>({ key: '', value: null });
  const key = `${book}/${chapter}`;
  useEffect(() => {
    let live = true;
    Promise.all([getInterlinear(book, chapter), getVariants(book, chapter).catch(() => ({}))]).then(
      ([words, variants]) => live && setState({ key, value: { words, variants } }),
      () => live && setState({ key, value: { words: {}, variants: {} } }),
    );
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state.key === key ? state.value : null;
}

/** Diferencias de un versículo entre las versiones elegidas (la primera es la base). null mientras cargan. */
export function useDifferences(original: Original, verse: number, versions: Version[], chapters: (id: string) => Loaded) {
  const loaded = versions.map((v) => chapters(v.id));
  const ready = !!original && loaded.every((l) => l.verses || l.error);
  const texts: VersionText[] = [];
  versions.forEach((v, i) => {
    const found = loaded[i].verses ? findVerse(loaded[i].verses!, verse) : undefined;
    // Una versión que une este versículo con otros no se puede comparar palabra por palabra
    if (loaded[i].error || (found && found[0] !== verse)) return;
    texts.push({ id: v.id, abbr: v.abbr, text: found?.[1] ?? '' });
  });
  const signature = texts.map((t) => `${t.id}:${t.text}`).join('|');
  const words = original?.words[String(verse)];
  const variants = original?.variants[String(verse)];
  return useMemo(() => {
    if (!ready) return null;
    if (!words?.length || texts.length < 2 || isEmptyVerse(texts[0].text)) return { differences: [], minor: 0, words: [] as Word[] };
    return { ...explainDifferences(texts, words, variants), words };
  }, [ready, signature, words, variants]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Sección «¿Por qué difieren?» de un versículo. */
export function WhyDifferent({
  verse,
  reference,
  original,
  versions,
  chapters,
  colors,
  bare,
}: {
  verse: number;
  /** «Juan 3:16», para la ficha de la palabra. */
  reference: string;
  original: Original;
  versions: Version[];
  chapters: (id: string) => Loaded;
  colors: Colors;
  /** Sin título (cuando ya hay un botón que la abre). */
  bare?: boolean;
}) {
  const result = useDifferences(original, verse, versions, chapters);
  const [all, setAll] = useState(false);
  const [word, setWord] = useState<Word | null>(null);
  const hebrew = HEBREW.test(result?.words[0]?.[0] ?? '');

  if (versions.length < 2) return null;
  if (result && !result.words.length && original) return null; // capítulo sin interlineal

  const shown = result ? (all ? result.differences : result.differences.slice(0, FIRST)) : [];
  const hidden = result ? result.differences.length - shown.length : 0;

  return (
    <View style={[styles.section, bare && { marginTop: 10 }]}>
      {!bare && (
        <View style={styles.head}>
          <View style={[styles.headIcon, { backgroundColor: colors.warmSoft }]}>
            <ForkIcon color={colors.warm} size={17} strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>¿Por qué difieren?</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              La palabra {hebrew ? 'hebrea' : 'griega'} detrás de cada diferencia
            </Text>
          </View>
        </View>
      )}

      {!result ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.skeleton, { backgroundColor: colors.border, width: ['38%', '100%', '72%'][i] as `${number}%` }]} />
          ))}
        </View>
      ) : !result.differences.length ? (
        <View style={[styles.calm, { borderColor: colors.border }]}>
          <Text style={[styles.calmText, { color: colors.muted }]}>
            {result.minor
              ? 'Aquí las versiones solo cambian el orden o las palabras de enlace: dicen lo mismo del original.'
              : 'Las versiones elegidas dicen lo mismo en este versículo.'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {shown.map((d, i) => (
            <Appear key={`${d.kind}-${d.words.join('.')}-${i}`} delay={i * 50} from={6}>
              <DifferenceCard
                d={d}
                base={versions[0].abbr}
                colors={colors}
                onWord={d.kind === 'palabra' && result.words[d.words[0]] ? () => setWord(result.words[d.words[0]]) : undefined}
              />
            </Appear>
          ))}
          {hidden > 0 && (
            <Pressable
              onPress={() => setAll(true)}
              accessibilityRole="button"
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.more,
                { borderColor: hovered ? colors.muted : colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.moreText, { color: colors.text }]}>
                Ver {hidden} {hidden === 1 ? 'diferencia más' : 'diferencias más'}
              </Text>
              <ChevronDownIcon color={colors.muted} size={16} />
            </Pressable>
          )}
          <Text style={[styles.foot, { color: colors.muted }]}>
            Calculado palabra por palabra con el interlineal{result.minor ? '. Los cambios de orden y de palabras de enlace no se muestran' : ''}.
          </Text>
        </View>
      )}

      {word && <WordCard word={word} reference={reference} onClose={() => setWord(null)} />}
    </View>
  );
}

/**
 * Botón «¿Por qué difieren? · 2» debajo de un versículo de la pantalla de comparar, que abre sus tarjetas. No aparece
 * si las versiones dicen lo mismo.
 */
export function WhyToggle({
  verse,
  reference,
  original,
  versions,
  chapters,
  colors,
  initiallyOpen,
}: {
  verse: number;
  reference: string;
  original: Original;
  versions: Version[];
  chapters: (id: string) => Loaded;
  colors: Colors;
  initiallyOpen?: boolean;
}) {
  const result = useDifferences(original, verse, versions, chapters);
  const [open, setOpen] = useState(!!initiallyOpen);
  const count = result?.differences.length ?? 0;
  if (!count) return null;
  const manuscripts = result!.differences.some((d) => d.kind !== 'palabra');
  return (
    <View style={styles.toggleBox}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.toggle,
          { backgroundColor: open ? colors.warmSoft : 'transparent', borderColor: open || hovered ? colors.warm : colors.border },
          pressed && { opacity: 0.75 },
        ]}
      >
        {manuscripts ? (
          <ScrollIcon color={colors.warm} size={14} strokeWidth={2} />
        ) : (
          <ForkIcon color={colors.warm} size={14} strokeWidth={2} />
        )}
        <Text style={[styles.toggleText, { color: open ? colors.warm : colors.text }]}>¿Por qué difieren?</Text>
        <View style={[styles.count, { backgroundColor: colors.warm }]}>
          <Text style={[styles.countText, { color: colors.surface }]}>{count}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDownIcon color={open ? colors.warm : colors.muted} size={15} />
        </View>
      </Pressable>
      {open && (
        <Appear from={6}>
          <WhyDifferent verse={verse} reference={reference} original={original} versions={versions} chapters={chapters} colors={colors} bare />
        </Appear>
      )}
    </View>
  );
}

function DifferenceCard({ d, base, colors, onWord }: { d: Difference; base: string; colors: Colors; onWord?: () => void }) {
  const manuscripts = d.kind !== 'palabra';
  const tint = isDark(colors) ? 'rgba(226, 168, 104, 0.18)' : 'rgba(168, 100, 31, 0.10)';
  const greek = d.original.map((o) => o[0]).join(' ');
  const rtl = HEBREW.test(greek);
  const label = manuscripts ? (d.kind === 'versiculo' ? 'Versículo en disputa' : 'Diferencia de manuscritos') : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {manuscripts ? (
        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: colors.warmSoft }]}>
            <ScrollIcon color={colors.warm} size={13} strokeWidth={2} />
            <Text style={[styles.tagText, { color: colors.warm }]}>{label}</Text>
          </View>
        </View>
      ) : null}

      {greek ? (
        <Pressable
          onPress={onWord}
          disabled={!onWord}
          accessibilityRole={onWord ? 'button' : undefined}
          accessibilityLabel={onWord ? `Ver la palabra ${d.original[0][1]}` : undefined}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.wordRow,
            onWord && (hovered || pressed) && { backgroundColor: colors.accentSoft },
          ]}
        >
          <Text
            style={[
              manuscripts ? styles.phrase : styles.original,
              { color: colors.greek, writingDirection: rtl ? 'rtl' : 'ltr' },
            ]}
            numberOfLines={manuscripts ? 3 : 1}
          >
            {greek}
          </Text>
          {!manuscripts && (
            <View style={styles.wordMeta}>
              <Text style={[styles.translit, { color: colors.muted }]} numberOfLines={1}>
                {d.original[0][1]}
              </Text>
              <Text style={[styles.gloss, { color: colors.text }]} numberOfLines={1}>
                «{d.original[0][2]}»
              </Text>
            </View>
          )}
        </Pressable>
      ) : null}

      <View style={[styles.renderings, { borderColor: colors.border }]}>
        {d.renderings.map((r) => (
          <View key={r.versions.join()} style={styles.rendering}>
            <View style={styles.abbrs}>
              {r.versions.map((a) => (
                <View
                  key={a}
                  style={[
                    styles.abbr,
                    a === base ? { backgroundColor: colors.accent } : { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <Text style={[styles.abbrText, { color: a === base ? colors.surface : colors.muted }]}>{a}</Text>
                </View>
              ))}
            </View>
            {r.text ? (
              <Text style={[styles.renderText, { color: colors.text }]}>
                <Text style={{ backgroundColor: r.versions.includes(base) ? 'transparent' : tint }}>{r.text}</Text>
              </Text>
            ) : (
              <Text style={[styles.absent, { color: colors.muted }]}>
                {d.kind === 'palabra'
                  ? r.versions.length > 1 ? 'No la dicen aquí' : 'No la dice aquí'
                  : `No ${r.versions.length > 1 ? 'lo incluyen' : 'lo incluye'}`}
              </Text>
            )}
          </View>
        ))}
      </View>

      <Text style={[styles.note, { color: colors.muted }]}>{d.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700', lineHeight: 24 },
  subtitle: { fontSize: 12.5, lineHeight: 17 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 13, gap: 10 },
  tagRow: { flexDirection: 'row' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 9, height: 22 },
  tagText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, marginHorizontal: -6, paddingHorizontal: 6, paddingVertical: 2 },
  original: { fontFamily: serif, fontSize: 26, lineHeight: 34, flexShrink: 1 },
  phrase: { fontFamily: serif, fontSize: 17, lineHeight: 25, flexShrink: 1 },
  wordMeta: { flexShrink: 1, gap: 1 },
  translit: { fontSize: 12.5, fontStyle: 'italic' },
  gloss: { fontSize: 13.5, fontWeight: '600' },
  renderings: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  rendering: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  abbrs: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: 112, paddingTop: 2 },
  abbr: { borderRadius: 8, paddingHorizontal: 6, height: 18, justifyContent: 'center' },
  abbrText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  renderText: { flex: 1, fontFamily: serif, fontSize: 16.5, lineHeight: 23 },
  absent: { flex: 1, fontSize: 13.5, fontStyle: 'italic', lineHeight: 22 },
  note: { fontSize: 13, lineHeight: 19 },
  calm: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  calmText: { fontSize: 13.5, lineHeight: 19 },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  moreText: { fontSize: 13.5, fontWeight: '700' },
  toggleBox: { marginTop: 10 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 30,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 15,
    borderWidth: 1,
  },
  toggleText: { fontSize: 12.5, fontWeight: '700' },
  count: { minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 10.5, fontWeight: '800' },
  skeleton: { height: 11, borderRadius: 6, opacity: 0.6 },
  foot: { fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 2 },
});
