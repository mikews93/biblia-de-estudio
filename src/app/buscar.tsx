// /buscar?q=…: una cita («1 reyes 2:5 nbla») abre el pasaje; unas palabras recordadas o una idea se buscan con IA.
// /buscar?voz=1 empieza a escuchar al abrir.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Appear from '@/components/Appear';
import MicIcon from '@/components/MicIcon';
import { IdeaResult, searchByIdea } from '@/lib/buscar';
import { Cita, citaLabel, parseCita } from '@/lib/cita';
import { Book, Version, getBooks, getChapter, getVersions, parseRef } from '@/lib/data';
import { chapterHref, verseHref } from '@/lib/routes';
import { serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { listen, voiceSupported } from '@/lib/voz';

const EXAMPLES = ['1 Reyes 2:5', 'Juan 3:16 BES', 'Todo lo puedo en Cristo', 'La ansiedad', 'Perdonar a quien me hirió'];

type Preview = { text: string; versionName: string } | { problem: string };

export default function Search() {
  const colors = useColors();
  const { settings, update } = useSettings();
  const params = useLocalSearchParams<{ q?: string; voz?: string }>();
  const [books, setBooks] = useState<Book[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [query, setQuery] = useState(params.q ?? '');
  const [asked, setAsked] = useState('');
  const [results, setResults] = useState<IdeaResult[] | null>(null);
  const [note, setNote] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const abort = useRef<AbortController | null>(null);
  const stopListening = useRef<(() => void) | null>(null);
  const canTalk = useMemo(voiceSupported, []);

  const available = versions.map((v) => v.id);
  const read = (text: string) => (books.length ? parseCita(text, books, available) : null);
  const cita = useMemo(() => read(query), [query, books, versions]); // eslint-disable-line react-hooks/exhaustive-deps
  // La versión en la que se abrirá: la pedida si está en la app; si no, la que ya se usa.
  const openVersion = cita?.version?.id ?? settings.version;
  // La cita no existe («Juan 30», «Salmo 119:200»): se queda el aviso y no se abre
  const blocked = !!cita && (!!cita.problem || (preview !== null && 'problem' in preview));
  const openVersionName = versions.find((v) => v.id === openVersion)?.abbr ?? 'RV1909';

  useEffect(() => {
    Promise.all([getBooks(), getVersions()]).then(([b, v]) => {
      setBooks(b);
      setVersions(v);
    });
    return () => {
      abort.current?.abort();
      stopListening.current?.();
    };
  }, []);

  // Al llegar con ?q=…: si es una cita se muestra; si no, se busca
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !books.length) return;
    started.current = true;
    if (params.q && !read(params.q)) runIdea(params.q);
    if (params.voz && canTalk) talk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books]);

  // Texto del pasaje citado, para ver antes de abrir
  useEffect(() => {
    setPreview(null);
    if (!cita) return;
    if (cita.problem) {
      setPreview({ problem: cita.problem });
      return;
    }
    let live = true;
    const version = versions.find((v) => v.id === openVersion) ?? versions[0];
    const load = (id: string) => getChapter(cita.book, cita.chapter, id);
    load(openVersion)
      .catch(() => load('rv1909'))
      .then((verses) => {
        if (!live) return;
        const first = cita.verse ?? 1;
        const last = cita.verse === undefined ? Math.min(3, verses.length) : (cita.verseEnd ?? cita.verse);
        const picked = verses.filter(([n]) => n >= first && n <= Math.min(last, first + 4));
        if (!picked.length) {
          const max = verses[verses.length - 1]?.[0] ?? 0;
          setPreview({ problem: `${citaLabel({ ...cita, verse: undefined }, books)} tiene ${max} versículos.` });
          return;
        }
        const more = cita.verse === undefined || last > first + 4 ? ' …' : '';
        setPreview({ text: picked.map(([n, t]) => (picked.length > 1 ? `${n} ${t}` : t)).join(' ') + more, versionName: version?.abbr ?? '' });
      })
      .catch(() => live && setPreview(null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cita?.book, cita?.chapter, cita?.verse, cita?.verseEnd, cita?.problem, openVersion, versions]);

  const open = (c: Cita) => {
    if (c.version?.id && c.version.id !== settings.version) update({ version: c.version.id });
    const href = c.verse === undefined ? chapterHref(c.book, c.chapter) : verseHref(c.book, c.chapter, c.verse);
    navigate(() => router.push(href), 'forward');
  };

  const runIdea = async (q: string) => {
    const text = q.trim();
    if (text.length < 3) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setQuery(text);
    setAsked(text);
    setBusy(true);
    setError(null);
    setResults(null);
    router.setParams({ q: text });
    try {
      const r = await searchByIdea(text, controller.signal);
      setResults(r.results);
      setNote(r.note);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo hacer la búsqueda.');
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };

  /** Enter, un ejemplo o lo dictado. Con varias formas posibles (dictado), gana la primera que sea una cita. */
  const submit = async (options: string[]) => {
    const found = options.map((o) => ({ text: o, cita: read(o) })).find((o) => o.cita && !o.cita.problem);
    const chosen = found ?? { text: options[0] ?? '', cita: read(options[0] ?? '') };
    setQuery(chosen.text);
    if (chosen.cita) {
      setAsked('');
      setResults(null);
      // Si pidió una versión que todavía no está, se queda aquí para leer el aviso antes de abrir
      const c = chosen.cita;
      if (c.problem || c.version?.id === null) return;
      // El versículo tiene que existir: con lo dictado no hay vista previa antes de abrir («Salmo 119:200»)
      if (c.verse !== undefined) {
        const verses = await getChapter(c.book, c.chapter).catch(() => null);
        if (verses && !verses.some(([n]) => n === c.verse)) return;
      }
      open(c);
      return;
    }
    runIdea(chosen.text);
  };

  const talk = () => {
    if (listening) {
      stopListening.current?.();
      return;
    }
    setError(null);
    setHeard('');
    setListening(true);
    stopListening.current = listen({
      onPartial: setHeard,
      onFinal: (options) => {
        setHeard('');
        if (options.length) submit(options);
      },
      onError: setError,
      onEnd: () => {
        setListening(false);
        stopListening.current = null;
      },
    });
  };

  const openIdea = (ref: string) => {
    const { start } = parseRef(ref);
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  const showExamples = !asked && !cita && !listening && !query.trim();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.lead, { color: colors.muted }]}>
        {canTalk
          ? 'Escribe o di una cita, unas palabras que recuerdes de un versículo o una idea.'
          : 'Escribe una cita, unas palabras que recuerdes de un versículo o una idea.'}
      </Text>
      <View style={[styles.searchRow, { backgroundColor: colors.accentSoft }]}>
        <TextInput
          value={listening && heard ? heard : query}
          onChangeText={setQuery}
          onSubmitEditing={() => submit([query])}
          placeholder={listening ? 'Te escucho…' : 'Por ejemplo: 1 Reyes 2:5 NBLA'}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
          maxLength={200}
          autoFocus={!params.q && !params.voz}
          style={[styles.input, { color: colors.text }]}
          accessibilityLabel="Buscar una cita, unas palabras o una idea"
        />
        {canTalk && (
          <Pressable
            onPress={talk}
            style={[styles.mic, { backgroundColor: listening ? colors.accent : 'transparent' }]}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Dejar de escuchar' : 'Dictar la búsqueda'}
            accessibilityState={{ selected: listening }}
          >
            <MicIcon color={listening ? colors.surface : colors.accent} />
          </Pressable>
        )}
        <Pressable
          onPress={() => submit([query])}
          disabled={busy || query.trim().length < 2 || blocked}
          style={[styles.go, { backgroundColor: busy || query.trim().length < 2 || blocked ? colors.border : colors.accent }]}
          accessibilityLabel={cita && !blocked ? 'Abrir la cita' : 'Buscar'}
        >
          <Text style={{ color: colors.surface, fontWeight: '700' }}>{cita && !blocked ? 'Abrir' : 'Buscar'}</Text>
        </Pressable>
      </View>

      {listening && (
        <Text style={[styles.hint, { color: colors.accent }]}>
          Te escucho… di una cita como «Juan tres dieciséis» o lo que recuerdes del versículo.
        </Text>
      )}

      {cita && (
        <Appear>
          <View style={[styles.cita, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.kicker, { color: colors.accent }]}>Cita</Text>
            <Text style={[styles.citaTitle, { color: colors.text, fontFamily: serif }]}>
              {citaLabel(cita, books)}
              {preview && 'text' in preview ? <Text style={{ color: colors.muted, fontSize: 16 }}> · {openVersionName}</Text> : null}
            </Text>
            {cita.version && cita.version.id === null && (
              <Text style={[styles.notice, { color: colors.text, backgroundColor: colors.accentSoft }]}>
                La {cita.version.abbr} ({cita.version.name}) todavía no está en la app
                {cita.version.abbr === 'NBLA' ? ': estamos pidiendo el permiso para incluirla' : ''}. Mientras tanto, aquí está en{' '}
                {versions.find((v) => v.id === openVersion)?.name ?? 'Reina-Valera 1909'}.
              </Text>
            )}
            {preview && 'problem' in preview && <Text style={{ color: colors.text, marginTop: 8 }}>{preview.problem}</Text>}
            {preview && 'text' in preview && (
              <Text style={[styles.text, { color: colors.text }]} numberOfLines={6}>
                {preview.text}
              </Text>
            )}
            {!blocked && (
              <Pressable onPress={() => open(cita)} style={[styles.openBtn, { backgroundColor: colors.accent }]} accessibilityRole="link">
                <Text style={{ color: colors.surface, fontWeight: '700' }}>
                  {cita.verse === undefined ? 'Leer el capítulo →' : 'Abrir en el capítulo →'}
                </Text>
              </Pressable>
            )}
          </View>
          {query.trim().length >= 3 && (
            <Pressable onPress={() => runIdea(query)} style={styles.altSearch}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>¿No era una cita? Buscar «{query.trim()}» por palabras o idea ›</Text>
            </Pressable>
          )}
        </Appear>
      )}

      {showExamples && (
        <View style={styles.ideas}>
          {EXAMPLES.map((i) => (
            <Pressable key={i} onPress={() => submit([i])} style={[styles.chip, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 14 }}>{i}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {busy && (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>
            Buscando pasajes y leyéndolos para confirmar que responden a «{asked}»…
          </Text>
        </View>
      )}

      {error && <Text style={[styles.waiting, { color: colors.text, textAlign: 'center' }]}>{error}</Text>}

      {results && !results.length && (
        <Text style={[styles.waiting, { color: colors.muted, textAlign: 'center' }]}>
          No encontré pasajes para «{asked}». Prueba a decirlo con otras palabras.
        </Text>
      )}

      {note && results?.length ? (
        <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{note}</Text>
        </View>
      ) : null}

      {results?.map((r) => (
        <Appear key={r.ref}>
          <Pressable onPress={() => openIdea(r.ref)} style={[styles.result, { borderColor: colors.border }]}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{r.label}</Text>
            <Text style={[styles.text, { color: colors.text }]}>{r.text}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6 }}>{r.reason}</Text>
          </Pressable>
        </Appear>
      ))}

      {results?.length ? (
        <Text style={[styles.credit, { color: colors.muted }]}>
          Búsqueda con IA. Los textos son los de la Reina-Valera 1909 tal como están en la app; la IA solo los elige y
          explica por qué responden a tu búsqueda.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  lead: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingLeft: 14, padding: 5, gap: 4 },
  input: { flex: 1, fontSize: 16, paddingVertical: 8, minWidth: 0 },
  mic: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  go: { borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  hint: { fontSize: 14, marginTop: 10 },
  cita: { borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 16 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  citaTitle: { fontSize: 24, marginTop: 4 },
  notice: { fontSize: 14, lineHeight: 20, borderRadius: 10, padding: 10, marginTop: 10, overflow: 'hidden' },
  openBtn: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14 },
  altSearch: { paddingVertical: 12 },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  waiting: { alignItems: 'center', marginTop: 32 },
  note: { borderRadius: 10, padding: 12, marginTop: 16 },
  result: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { fontFamily: serif, fontSize: 17, lineHeight: 25, marginTop: 6 },
  credit: { fontSize: 11, marginTop: 20 },
});
