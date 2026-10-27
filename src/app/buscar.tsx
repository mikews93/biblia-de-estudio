// /buscar?q=…: una cita («1 reyes 2:5 nbla») abre el pasaje; unas palabras recordadas o una idea se buscan al momento
// sin IA (por el sentido con internet, por palabras sin conexión) y la IA puede afinar después (con cuenta).
// Una pregunta («¿qué dice la Biblia sobre la ansiedad?») además se responde arriba (src/lib/preguntar.ts).
// /buscar?voz=1 empieza a escuchar al abrir.
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { ChevronRightIcon, ClockIcon, CloseIcon, MicIcon, SearchIcon, SparkIcon, type IconProps } from '@/components/icons';
import { PreguntaCard, Preparadas } from '@/components/Preguntar';
import { NeedsConnection } from '@/components/SinConexion';
import {
  IdeaResult,
  NOTHING_DOWNLOADED,
  type QuickMode,
  addRecent,
  clearRecent,
  getRecent,
  quickSearch,
  searchByIdea,
  withVersion,
} from '@/lib/buscar';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { NEEDS_CONNECTION, useOnline } from '@/lib/conexion';
import { Cita, citaLabel, parseCita } from '@/lib/cita';
import { Book, Version, getBooks, getChapter, getVersions, parseRef } from '@/lib/data';
import { Icono } from '@/components/FichaChips';
import { IndiceRow, buscarFichas, fichaHref, getIndice } from '@/lib/fichas';
import { type Licensed, licensedById } from '@/lib/licenciadas';
import { esPregunta } from '@/lib/preguntar';
import { chapterHref, verseHref } from '@/lib/routes';
import { Colors, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { listen, voiceSupported } from '@/lib/voz';

const CITAS = ['1 Reyes 2:5', 'Salmo 23', 'Juan 3:16 BES', 'Romanos 8:28-30'];
const FRAGMENTS = ['Todo lo puedo en Cristo', 'Echa sobre él tu ansiedad', 'Mira que te mando que te esfuerces'];
const TOPICS = ['La ansiedad', 'Perdonar a quien me hirió', 'Cuando Dios parece tardar', 'Dar gracias en la prueba'];

/** «version»: la versión del texto (sin conexión, una con derechos se muestra en RV1909). */
type Preview = { verses: [number, string][]; more: boolean; version: string } | { problem: string };

export default function Search() {
  const colors = useColors();
  const { settings, update } = useSettings();
  const params = useLocalSearchParams<{ q?: string; voz?: string }>();
  const [books, setBooks] = useState<Book[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [query, setQuery] = useState(params.q ?? '');
  const [asked, setAsked] = useState('');
  const [results, setResults] = useState<IdeaResult[] | null>(null);
  // La versión en la que se hizo la búsqueda (la de lectura en ese momento)
  const [searchedIn, setSearchedIn] = useState('rv1909');
  const [note, setNote] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  // Cómo se encontraron los resultados: al momento sin IA (QuickMode) o leídos y elegidos por la IA
  const [mode, setMode] = useState<QuickMode | 'ia' | null>(null);
  const [showAll, setShowAll] = useState(false);
  const online = useOnline();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const abort = useRef<AbortController | null>(null);
  const stopListening = useRef<(() => void) | null>(null);
  const canTalk = useMemo(voiceSupported, []);
  const [indice, setIndice] = useState<IndiceRow[] | null>(null);

  const available = versions.map((v) => v.id);
  const read = (text: string) => (books.length ? parseCita(text, books, available) : null);
  // La cita se lee cuando la persona hace una pausa, no a cada letra: cambiar la pantalla mientras el teclado del
  // teléfono está componiendo una palabra hacía que Chrome en Android borrara lo escrito.
  const settled = useSettled(query, 350);
  const cita = useMemo(() => read(settled), [settled, books, versions]); // eslint-disable-line react-hooks/exhaustive-deps
  // La versión en la que se abrirá: la pedida si está en la app; si no, la que ya se usa.
  const openVersion = cita?.version?.id ?? settings.version;
  // La cita no existe («Juan 30», «Salmo 119:200»): se queda el aviso y no se abre
  const blocked = !!cita && (!!cita.problem || (preview !== null && 'problem' in preview));
  // Personas y lugares con ficha cuyo nombre coincide (el índice se pide la primera vez que hace falta).
  // Sin números también con una cita: «Juan» o «Daniel» son un libro y una persona.
  const quiereFichas = settled.trim().length >= 2 && (!cita || !/\d/.test(settled));
  useEffect(() => {
    if (quiereFichas && !indice) getIndice().then(setIndice, () => {});
  }, [quiereFichas, indice]);
  const fichas = useMemo(() => (quiereFichas && indice ? buscarFichas(indice, settled, 5) : []), [quiereFichas, indice, settled]);

  useEffect(() => {
    getRecent().then(setRecent);
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
    const load = (id: string) => getChapter(cita.book, cita.chapter, id).then((vs) => ({ id, verses: vs }));
    load(openVersion)
      .catch(() => load('rv1909'))
      .then(({ id, verses }) => {
        if (!live) return;
        const first = cita.verse ?? 1;
        const last = cita.verse === undefined ? Math.min(3, verses.length) : (cita.verseEnd ?? cita.verse);
        const picked = verses.filter(([n]) => n >= first && n <= Math.min(last, first + 4));
        if (!picked.length) {
          const max = verses[verses.length - 1]?.[0] ?? 0;
          setPreview({ problem: `${citaLabel({ ...cita, verse: undefined }, books)} tiene ${max} versículos.` });
          return;
        }
        setPreview({ verses: picked.map(([n, t]) => [n, t]), more: cita.verse === undefined || last > first + 4, version: id });
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

  /** La búsqueda por idea: primero al momento y sin IA; con `ai`, la IA propone, lee y explica (necesita cuenta). */
  const runIdea = async (q: string, ai = false) => {
    const text = q.trim();
    if (text.length < 3) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setQuery(text);
    setAsked(text);
    addRecent(text).then(setRecent);
    setBusy(true);
    setError(null);
    if (!ai) setResults(null);
    setShowAll(false);
    router.setParams({ q: text });
    // Se busca en la versión que se lee ahora; con una con derechos, su texto se pide aparte (nunca va a la IA).
    const version = settings.version;
    try {
      const r = ai ? { ...(await searchByIdea(text, version, controller.signal)), mode: 'ia' as const } : await quickSearch(text, version, books, controller.signal);
      const fromServer = r.mode !== 'sin-conexion';
      const shown = fromServer && licensedById(version) ? await withVersion(r.results, version, (b, c) => getChapter(b, c, version)) : r.results;
      if (controller.signal.aborted) return;
      setResults(shown);
      setMode(r.mode);
      setSearchedIn(fromServer ? version : (shown[0]?.version ?? version));
      setNote('note' in r ? r.note : undefined);
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
      addRecent(chosen.text).then(setRecent);
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

  const idle = !asked && !cita && !listening && !settled.trim() && !error;
  const versionName = versions.find((v) => v.id === openVersion)?.name ?? 'Reina-Valera 1909';
  const abbrOf = (id: string) => versions.find((v) => v.id === id)?.abbr ?? licensedById(id)?.abbr ?? id.toUpperCase();
  const previewLicensed = licensedById(openVersion);
  const searchedLicensed = licensedById(searchedIn);
  const searchedName = versions.find((v) => v.id === searchedIn)?.name ?? searchedLicensed?.name ?? 'Reina-Valera 1909';
  const shownLicensed = !!searchedLicensed && !!results?.some((r) => r.version === searchedIn);
  const bookName = cita ? (books.find((b) => b.id === cita.book)?.name ?? '') : '';
  // Lo buscado es una pregunta: arriba va su respuesta y debajo los pasajes de la búsqueda rápida.
  const pregunta = !!asked && !cita && esPregunta(asked);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Appear>
        <Text style={[styles.overline, { color: colors.muted }]}>Citas, palabras, ideas o preguntas</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>¿Qué quieres encontrar?</Text>
      </Appear>

      <Appear delay={40}>
        <View
          style={[
            styles.field,
            { backgroundColor: colors.surface, borderColor: focused || listening ? colors.accent : colors.border },
          ]}
        >
          <SearchIcon color={focused ? colors.accent : colors.muted} />
          <TextInput
            ref={input}
            value={listening && heard ? heard : query}
            onChangeText={setQuery}
            onSubmitEditing={() => submit([query])}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={listening ? 'Te escucho…' : '1 Reyes 2:5 NBLA'}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            autoCorrect={false}
            maxLength={200}
            autoFocus={!params.q && !params.voz}
            style={[styles.input, { color: colors.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
            accessibilityLabel="Buscar una cita, unas palabras o una idea, o hacer una pregunta"
          />
          {!!query && !listening && (
            <Pressable
              onPress={() => {
                setQuery('');
                setAsked('');
                setResults(null);
                setError(null);
                router.setParams({ q: undefined });
                input.current?.focus();
              }}
              hitSlop={8}
              style={[styles.clear, { backgroundColor: colors.border }]}
              accessibilityLabel="Borrar"
            >
              <CloseIcon color={colors.muted} size={13} strokeWidth={2.6} />
            </Pressable>
          )}
          {canTalk && (
            <Pressable
              onPress={talk}
              style={({ pressed }) => [
                styles.mic,
                { backgroundColor: listening ? colors.accent : colors.accentSoft },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Dejar de escuchar' : 'Dictar la búsqueda'}
              accessibilityState={{ selected: listening }}
            >
              <MicIcon color={listening ? colors.surface : colors.accent} />
            </Pressable>
          )}
        </View>
      </Appear>

      {listening && <Listening colors={colors} heard={heard} onStop={talk} />}

      {!listening && cita && (
        <Appear>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <Text style={[styles.kicker, { color: colors.accent }]}>Cita</Text>
              {preview && 'verses' in preview && (
                <View style={[styles.pill, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{abbrOf(preview.version)}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.citaTitle, { color: colors.text, fontFamily: serif }]}>{citaLabel(cita, books)}</Text>

            {cita.version && cita.version.id === null && (
              <View style={[styles.notice, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
                  <Text style={{ fontWeight: '700' }}>La {cita.version.abbr} todavía no está en la app</Text>
                  {cita.version.abbr === 'NBLA' ? '; estamos pidiendo el permiso para incluirla' : ''}. Mientras tanto, aquí
                  está en {versionName}.
                </Text>
              </View>
            )}

            {preview && 'problem' in preview && (
              <Text style={[styles.problem, { color: colors.muted }]}>{preview.problem}</Text>
            )}

            {preview && 'verses' in preview && (
              <Text style={[styles.passage, { color: colors.text, fontFamily: serif }]} numberOfLines={7}>
                {preview.verses.map(([n, t], i) => (
                  <Text key={n}>
                    {(preview.verses.length > 1 || cita.verse === undefined) && (
                      <Text style={[styles.verseNum, { color: colors.accent }]}>{n} </Text>
                    )}
                    {t}
                    {i < preview.verses.length - 1 ? ' ' : preview.more ? ' …' : ''}
                  </Text>
                ))}
              </Text>
            )}
            {previewLicensed && preview && 'verses' in preview && preview.version === openVersion && (
              <Credit licensed={previewLicensed} colors={colors} />
            )}

            {!blocked && (
              <Pressable
                onPress={() => open(cita)}
                style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent }, pressed && styles.pressed]}
                accessibilityRole="link"
              >
                <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>
                  {cita.verse === undefined ? `Leer ${bookName} ${cita.chapter}` : `Abrir en ${bookName} ${cita.chapter}`} ›
                </Text>
              </Pressable>
            )}
          </View>
          {query.trim().length >= 3 && (
            <Pressable onPress={() => runIdea(query)} style={styles.altSearch} accessibilityRole="button">
              <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}>
                ¿No era una cita? <Text style={{ color: colors.accent, fontWeight: '600' }}>Buscarlo como idea</Text>
              </Text>
            </Pressable>
          )}
        </Appear>
      )}

      {!listening && fichas.length > 0 && (
        <Appear>
          <Text style={[styles.section, { color: colors.muted }]}>Personas y lugares</Text>
          <View style={[styles.fichas, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {fichas.map(([id, nombre, tipo, breve, menciones], i) => (
              <Pressable
                key={id}
                onPress={() => navigate(() => router.push(fichaHref({ id, nombre }) as never), 'forward')}
                style={({ pressed }) => [
                  styles.fichaRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="link"
              >
                <Icono tipo={tipo} nombre={nombre} colors={colors} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontFamily: serif, fontSize: 17 }}>{nombre}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                    {breve || (tipo === 'l' ? 'Lugar' : 'Persona')} · {menciones} {menciones === 1 ? 'versículo' : 'versículos'}
                  </Text>
                </View>
                <ChevronRightIcon color={colors.muted} size={16} />
              </Pressable>
            ))}
          </View>
        </Appear>
      )}

      {!listening && pregunta && <PreguntaCard key={asked} texto={asked} colors={colors} />}

      {idle && (
        <>
          {recent.length > 0 && (
            <Appear delay={60}>
              <View style={styles.sectionHead}>
                <Text style={[styles.section, { color: colors.muted }]}>Recientes</Text>
                <Pressable onPress={() => clearRecent().then(() => setRecent([]))} hitSlop={8}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Borrar</Text>
                </Pressable>
              </View>
              <View style={styles.chips}>
                {recent.map((r) => (
                  <Chip key={r} label={r} icon={ClockIcon} colors={colors} onPress={() => submit([r])} />
                ))}
              </View>
            </Appear>
          )}

          <Appear delay={70}>
            <Text style={[styles.section, { color: colors.muted }]}>Preguntas que muchos hacen</Text>
            <Preparadas colors={colors} onPick={(t) => submit([t])} />
          </Appear>

          <Appear delay={80}>
            <Text style={[styles.section, { color: colors.muted }]}>Ir a una cita</Text>
            <View style={styles.chips}>
              {CITAS.map((c) => (
                <Chip key={c} label={c} serifLabel colors={colors} onPress={() => submit([c])} />
              ))}
            </View>
          </Appear>

          <Appear delay={100}>
            <Text style={[styles.section, { color: colors.muted }]}>¿Recuerdas unas palabras?</Text>
            <View style={{ gap: 8 }}>
              {FRAGMENTS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => submit([f])}
                  style={({ pressed }) => [styles.quote, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
                >
                  <Text style={{ color: colors.text, fontFamily: serif, fontSize: 17, fontStyle: 'italic', flex: 1 }}>«{f}…»</Text>
                  <ChevronRightIcon color={colors.accent} size={18} />
                </Pressable>
              ))}
            </View>
          </Appear>

          <Appear delay={120}>
            <Text style={[styles.section, { color: colors.muted }]}>Por tema</Text>
            <View style={styles.chips}>
              {TOPICS.map((t) => (
                <Chip key={t} label={t} icon={SparkIcon} colors={colors} onPress={() => submit([t])} />
              ))}
            </View>
          </Appear>

          {canTalk && (
            <Text style={[styles.tip, { color: colors.muted }]}>
              También puedes tocar el micrófono y decirlo: «primera de Reyes dos cinco» o «el Señor es mi pastor».
            </Text>
          )}
        </>
      )}

      {!listening && busy && <Searching colors={colors} asked={asked} ai={mode !== null && results !== null} />}

      {!listening && error === NEEDS_ACCOUNT && (
        <Appear style={{ marginTop: 8 }}>
          <Welcome
            kind="ia"
            title="Que la IA afine la búsqueda"
            intro="La IA lee los pasajes, se queda con los que de verdad hablan de lo que buscas y te explica por qué. Necesitas una cuenta gratuita; la búsqueda rápida y las citas no la necesitan."
            onReady={() => asked && runIdea(asked, true)}
          />
        </Appear>
      )}

      {!listening && (error === NEEDS_CONNECTION || error === NOTHING_DOWNLOADED) && (
        <Appear style={{ marginTop: 8 }}>
          <NeedsConnection
            title={error === NOTHING_DOWNLOADED ? 'Descarga una versión para buscar sin conexión' : 'Afinar con la IA necesita internet'}
            intro={
              error === NOTHING_DOWNLOADED
                ? 'Sin internet, Zarza busca por palabras en una versión descargada en este dispositivo. También puedes abrir una cita directamente, como «Juan 3:16» o «Sal 23».'
                : 'La IA lee los pasajes en el servidor. Sin conexión puedes buscar por palabras en tus versiones descargadas o abrir una cita, como «Juan 3:16».'
            }
          />
        </Appear>
      )}

      {!listening && error && error !== NEEDS_ACCOUNT && error !== NEEDS_CONNECTION && error !== NOTHING_DOWNLOADED && (
        <Appear>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center' }]}>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{error}</Text>
            {asked ? (
              <Pressable onPress={() => runIdea(asked, mode === 'ia')} style={[styles.secondary, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.accent, fontWeight: '700' }}>Intentar otra vez</Text>
              </Pressable>
            ) : null}
          </View>
        </Appear>
      )}

      {!listening && !busy && results && !results.length && (
        <Appear>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontFamily: serif, fontSize: 20 }}>Nada claro todavía</Text>
            <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 6 }}>
              No encontré pasajes para «{asked}». Prueba a decirlo con otras palabras o con lo que recuerdes del versículo.
            </Text>
            {mode !== 'ia' && online && <Refine colors={colors} onPress={() => runIdea(asked, true)} />}
          </View>
        </Appear>
      )}

      {!listening && !busy && results && results.length > 0 && (
        <>
          <View style={styles.resultsHead}>
            <Text style={[styles.section, { color: colors.muted, marginBottom: 0, flex: 1 }]}>
              {pregunta ? 'También en la Biblia' : results.length === 1 ? '1 pasaje' : `${results.length} pasajes`}
              {pregunta ? '' : ` para «${asked}»`}
            </Text>
            <ModeBadge mode={mode} colors={colors} abbr={abbrOf(searchedIn)} />
          </View>
          {mode !== 'ia' && online && <Refine colors={colors} onPress={() => runIdea(asked, true)} />}
          {note ? (
            <View style={[styles.notice, { backgroundColor: colors.accentSoft, borderColor: colors.accent, marginTop: 0 }]}>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{note}</Text>
            </View>
          ) : null}
          {(showAll || mode === 'ia' ? results : results.slice(0, QUICK_SHOWN)).map((r, i) => (
            <Appear key={r.ref} delay={Math.min(i, 6) * 40}>
              <Pressable
                onPress={() => openIdea(r.ref)}
                style={({ pressed }) => [styles.result, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
                accessibilityRole="link"
              >
                <View style={styles.cardHead}>
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14, flex: 1 }}>{r.label}</Text>
                  <View style={[styles.resultVersion, { borderColor: colors.border }]}>
                    <Text style={[styles.resultVersionText, { color: r.version === searchedIn ? colors.text : colors.muted }]}>
                      {abbrOf(r.version)}
                    </Text>
                  </View>
                  <ChevronRightIcon color={colors.accent} size={18} />
                </View>
                <Text style={[styles.resultText, { color: colors.text, fontFamily: serif }]}>{r.text}</Text>
                {!!r.reason && <Text style={[styles.reason, { color: colors.muted, borderColor: colors.border }]}>{r.reason}</Text>}
              </Pressable>
            </Appear>
          ))}
          {mode !== 'ia' && !showAll && results.length > QUICK_SHOWN && (
            <Pressable
              onPress={() => setShowAll(true)}
              style={({ pressed }) => [styles.more, { borderColor: colors.border }, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>Ver {results.length - QUICK_SHOWN} más</Text>
            </Pressable>
          )}
          {searchedLicensed && mode !== 'sin-conexion' ? (
            <View style={styles.creditBox}>
              <Text style={[styles.credit, { color: colors.muted, marginTop: 0 }]}>
                {mode === 'ia'
                  ? `Búsqueda con IA. La licencia de la ${searchedLicensed.abbr} no permite pasarle su texto a la IA: la IA buscó con la Reina-Valera 1909`
                  : 'Búsqueda rápida, sin IA: se buscó en la Reina-Valera 1909'}{' '}
                y aquí ves cada pasaje en tu {searchedLicensed.abbr}
                {results.some((r) => r.version !== searchedIn) ? ' (los que dicen RV1909 no se pudieron mostrar en ella ahora)' : ''}.
              </Text>
              {shownLicensed && <Credit licensed={searchedLicensed} colors={colors} center />}
            </View>
          ) : (
            <Text style={[styles.credit, { color: colors.muted }]}>
              {mode === 'ia'
                ? `Búsqueda con IA. Los textos son los de la ${abbrOf(searchedIn)} (${searchedName}) tal como están en la app; la IA solo los elige y explica por qué responden a tu búsqueda.`
                : mode === 'sin-conexion'
                  ? `Sin conexión: buscado por palabras en la ${abbrOf(searchedIn)} descargada en este dispositivo.`
                  : mode === 'palabras'
                    ? 'Búsqueda rápida por palabras, sin IA. Si no ves lo que buscas, pide a la IA que la afine.'
                    : 'Búsqueda rápida por el sentido y las palabras, sin IA: encuentra pasajes que dicen lo mismo con otras palabras. Si quieres que alguien los lea y te explique por qué, pide a la IA que la afine.'}
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

/** Cuántos resultados rápidos se ven antes de «Ver más». */
const QUICK_SHOWN = 8;

/** De dónde salieron los resultados, en una etiqueta junto al título. */
function ModeBadge({ mode, colors, abbr }: { mode: QuickMode | 'ia' | null; colors: Colors; abbr: string }) {
  if (!mode) return null;
  const label = mode === 'ia' ? 'Elegidos por la IA' : mode === 'sin-conexion' ? `Sin conexión · ${abbr}` : mode === 'semantica' ? 'Por el sentido' : 'Por palabras';
  return (
    <View style={[styles.badge, { backgroundColor: mode === 'ia' ? colors.accentSoft : colors.surface, borderColor: mode === 'ia' ? colors.accent : colors.border }]}>
      {mode === 'ia' && <SparkIcon color={colors.accent} size={12} />}
      <Text style={{ color: mode === 'ia' ? colors.accent : colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/** Pedir a la IA que lea y elija: una franja discreta sobre los resultados rápidos. */
function Refine({ colors, onPress }: { colors: Colors; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.refine, { backgroundColor: colors.accentSoft, borderColor: colors.accent }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Afinar con la IA"
    >
      <View style={[styles.refineIcon, { backgroundColor: colors.surface }]}>
        <SparkIcon color={colors.accent} size={16} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Afinar con la IA</Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 1 }}>Lee los pasajes, elige los mejores y explica por qué.</Text>
      </View>
      <ChevronRightIcon color={colors.accent} size={18} />
    </Pressable>
  );
}

/** El aviso de derechos y los enlaces que los editores piden cada vez que se muestra su texto. */
function Credit({ licensed, colors, center }: { licensed: Licensed; colors: Colors; center?: boolean }) {
  return (
    <Text style={[styles.licensedCredit, { color: colors.muted }, center && { textAlign: 'center' }]}>
      {licensed.credit}
      {licensed.links.map((l) => (
        <Text key={l.url} onPress={() => Linking.openURL(l.url)} role="link" style={{ color: colors.accent }}>
          {` · ${l.label}`}
        </Text>
      ))}
    </Text>
  );
}

/** El valor después de `ms` sin cambios; vacío al instante, para que borrar no deje la tarjeta anterior. */
function useSettled(value: string, ms: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (!value.trim()) {
      setSettled(value);
      return;
    }
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

function Chip({
  label,
  icon: Icon,
  serifLabel,
  colors,
  onPress,
}: {
  label: string;
  icon?: (p: IconProps) => React.ReactNode;
  serifLabel?: boolean;
  colors: Colors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
    >
      {Icon && <Icon color={colors.accent} size={15} />}
      <Text style={{ color: colors.text, fontSize: serifLabel ? 16 : 14, fontFamily: serifLabel ? serif : undefined }}>{label}</Text>
    </Pressable>
  );
}

/** Mientras se habla: ondas alrededor del micrófono y lo que se va oyendo. */
function Listening({ colors, heard, onStop }: { colors: Colors; heard: string; onStop: () => void }) {
  const wave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) return;
        loop = Animated.loop(Animated.timing(wave, { toValue: 1, duration: 1600, useNativeDriver: Platform.OS !== 'web' }));
        loop.start();
      });
    return () => loop?.stop();
  }, [wave]);
  const ring = (offset: number) => {
    const t = Animated.modulo(Animated.add(wave, offset), 1);
    return {
      opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
      transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
    };
  };
  return (
    <Appear>
      <View style={[styles.card, styles.listening, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.micStage}>
          <Animated.View style={[styles.ring, { backgroundColor: colors.accent }, ring(0)]} />
          <Animated.View style={[styles.ring, { backgroundColor: colors.accent }, ring(0.5)]} />
          <Pressable
            onPress={onStop}
            style={[styles.bigMic, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Dejar de escuchar"
          >
            <MicIcon color={colors.surface} size={30} />
          </Pressable>
        </View>
        <Text style={[styles.heard, { color: heard ? colors.text : colors.muted, fontFamily: serif }]}>
          {heard || 'Te escucho…'}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Di una cita, como «Juan tres dieciséis», o lo que recuerdes del versículo.
        </Text>
        <Pressable onPress={onStop} style={[styles.secondary, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Listo</Text>
        </Pressable>
      </View>
    </Appear>
  );
}

/** Tarjetas en blanco que laten mientras se busca (o mientras la IA lee y comprueba los pasajes). */
function Searching({ colors, asked, ai }: { colors: Colors; asked: string; ai: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const bar = (width: `${number}%`, height = 12) => (
    <View style={{ width, height, borderRadius: 6, backgroundColor: colors.border, marginTop: 10 }} />
  );
  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
        {ai ? `La IA está leyendo los pasajes para quedarse con los que responden a «${asked}»…` : `Buscando «${asked}»…`}
      </Text>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={[styles.result, { backgroundColor: colors.surface, borderColor: colors.border, opacity }]}>
          {bar('28%', 10)}
          {bar('100%')}
          {bar('92%')}
          {bar(i === 1 ? '60%' : '75%')}
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fichas: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  fichaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  content: { padding: 20, paddingTop: 8, paddingBottom: 64, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  overline: { fontSize: 14 },
  title: { fontSize: 32, lineHeight: 38, marginTop: 2 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 18, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontSize: 18, paddingVertical: 10, minWidth: 0 },
  clear: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  mic: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  pill: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  citaTitle: { fontSize: 30, lineHeight: 36, marginTop: 6 },
  notice: { borderLeftWidth: 3, borderRadius: 10, padding: 12, marginTop: 14 },
  problem: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  passage: { fontSize: 20, lineHeight: 31, marginTop: 14 },
  verseNum: { fontSize: 13, fontWeight: '700' },
  primary: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  secondary: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 20, marginTop: 14 },
  altSearch: { paddingVertical: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  quote: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  tip: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8, paddingHorizontal: 12 },
  listening: { alignItems: 'center', paddingVertical: 32, gap: 14 },
  micStage: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 72, height: 72, borderRadius: 36 },
  bigMic: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  heard: { fontSize: 24, lineHeight: 32, textAlign: 'center', minHeight: 32 },
  resultsHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  refine: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4 },
  refineIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  more: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 8 },
  result: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 18, marginBottom: 12 },
  resultText: { fontSize: 18, lineHeight: 28, marginTop: 8 },
  reason: { fontSize: 14, lineHeight: 20, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  credit: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  creditBox: { marginTop: 4, gap: 6 },
  licensedCredit: { fontSize: 11, lineHeight: 16, marginTop: 10 },
  resultVersion: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginRight: 4 },
  resultVersionText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
});
