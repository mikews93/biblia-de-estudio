import { router } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Book, formatRef, parseRef } from '@/lib/data';
import { Comentario, Estado, FUENTES, Parte, getComentario, reportarError, traducirParte } from '@/lib/comentarios';
import { verseHref } from '@/lib/routes';
import { Colors, serif } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Props = { book: Book; books: Book[]; chapter: number; verse: number; colors: Colors; onNavigate: () => void };

const ESTADOS: Record<Estado, string> = {
  traducido: 'Traducido al español con IA. Una segunda revisión con IA está en camino.',
  revisado: 'Traducido al español con IA y revisado con una segunda pasada de IA.',
  humano: 'Traducción revisada por una persona.',
  original: '',
};
const ORDEN: Estado[] = ['traducido', 'revisado', 'humano', 'original'];

// La fuente elegida se recuerda mientras la app está abierta.
let lastSource = 'mhc';

/** Pestaña Comentario del versículo: Matthew Henry y JFB traducidos al español, y enlace a Enduring Word. */
export default function Commentary({ book, books, chapter, verse, colors, onNavigate }: Props) {
  const [source, setSource] = useState(lastSource);
  // Versículo que se está viendo: 0 es la introducción del capítulo; las flechas pasan de sección en sección.
  const [at, setAt] = useState(verse);
  const [data, setData] = useState<Comentario | null>(null);
  const [parts, setParts] = useState<Parte[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const fuente = FUENTES.find((f) => f.id === source)!;
  const ew = FUENTES.find((f) => f.tipo === 'enlace')!;
  const section = data?.seccion ?? null;

  useEffect(() => setAt(verse), [verse]);

  useEffect(() => {
    let alive = true;
    abort.current?.abort();
    setData(null);
    setParts([]);
    setDraft(null);
    setError('');
    getComentario(source, book.id, chapter, at)
      .then((c) => {
        if (!alive) return;
        setData(c);
        setParts(c.seccion?.traducidas ?? []);
      })
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [source, book, chapter, at]);

  const next = section && parts.length < section.partes ? parts.length : null;

  const load = async () => {
    if (!section || next === null || draft !== null) return;
    const controller = new AbortController();
    abort.current = controller;
    setDraft('');
    setError('');
    try {
      const key = { fuente: source, libro: book.id, capitulo: chapter, desde: section.desde, parte: next };
      const part = await traducirParte(key, setDraft, controller.signal);
      setParts((p) => [...p, part]);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo traducir');
    } finally {
      if (!controller.signal.aborted) setDraft(null);
    }
  };

  // La primera parte se trae sola al abrir la sección.
  useEffect(() => {
    if (section && parts.length === 0 && next === 0) load();
  }, [section]);

  useEffect(() => () => abort.current?.abort(), []);

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    onNavigate();
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  const list = data?.secciones ?? [];
  const index = section ? list.findIndex((s) => s.desde === section.desde) : -1;
  const prev = index > 0 ? list[index - 1] : null;
  const after = index >= 0 && index < list.length - 1 ? list[index + 1] : null;
  const label = (s: { desde: number; hasta: number }) =>
    s.desde === 0
      ? 'Introducción al capítulo'
      : `${book.name} ${chapter}:${s.desde}${s.hasta > s.desde ? `-${s.hasta}` : ''}`;
  const worst = parts.reduce<Estado | null>(
    (w, p) => (w === null || ORDEN.indexOf(p.estado) < ORDEN.indexOf(w) ? p.estado : w),
    null,
  );

  return (
    <View>
      <View style={styles.sources}>
        {FUENTES.map((f) => {
          const selected = f.id === source;
          return (
            <Pressable
              key={f.id}
              onPress={() => {
                if (f.tipo === 'enlace') {
                  if (f.url) Linking.openURL(f.url(book.ewSlug, chapter));
                  return;
                }
                lastSource = f.id;
                setSource(f.id);
              }}
              style={[
                styles.chip,
                { borderColor: selected ? colors.accent : colors.border },
                selected && { backgroundColor: colors.accentSoft },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={{ color: selected ? colors.text : colors.muted, fontWeight: '600', fontSize: 13 }}>
                {f.nombre}
                {f.tipo === 'enlace' ? ' ↗' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!data && !error && <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />}
      {data && !section && (
        <Text style={{ color: colors.muted }}>
          {fuente.nombre} no comenta este capítulo. Prueba con la otra fuente o con Enduring Word.
        </Text>
      )}

      {section && (
        <>
          <View style={styles.nav}>
            <Pressable onPress={() => prev && setAt(prev.desde)} disabled={!prev} hitSlop={8}>
              <Text style={{ color: prev ? colors.accent : colors.border, fontSize: 18 }}>‹</Text>
            </Pressable>
            <Text style={[styles.section, { color: colors.accent }]}>{label(section)}</Text>
            <Pressable onPress={() => after && setAt(after.desde)} disabled={!after} hitSlop={8}>
              <Text style={{ color: after ? colors.accent : colors.border, fontSize: 18 }}>›</Text>
            </Pressable>
          </View>
          {section.desde > 0 && list[0]?.desde === 0 && (
            <Pressable onPress={() => setAt(0)} hitSlop={6}>
              <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>Ver la introducción al capítulo ›</Text>
            </Pressable>
          )}
          {parts.map((p) => (
            <Rich key={p.parte} text={p.texto} books={books} colors={colors} onRef={open} />
          ))}
          {draft !== null && (
            <View>
              {draft ? (
                <Rich text={draft} books={books} colors={colors} onRef={open} />
              ) : (
                <View style={styles.translating}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={{ color: colors.muted, marginLeft: 10, flex: 1 }}>
                    Traduciendo al español. Solo pasa la primera vez que alguien lo abre.
                  </Text>
                </View>
              )}
            </View>
          )}
          {next !== null && draft === null && parts.length > 0 && (
            <Pressable onPress={load} style={[styles.more, { borderColor: colors.accent }]}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>
                Seguir leyendo ({parts.length + 1} de {section.partes})
              </Text>
            </Pressable>
          )}
          {next !== null && draft === null && parts.length === 0 && error !== '' && (
            <Pressable onPress={load} style={[styles.more, { borderColor: colors.accent }]}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Intentar de nuevo</Text>
            </Pressable>
          )}
        </>
      )}

      {error !== '' && <Text style={{ color: colors.accent, marginTop: 12 }}>{error}</Text>}

      {section && parts.length > 0 && (
        <Text style={[styles.credit, { color: colors.muted }]}>
          {fuente.obra}, {fuente.autor} ({fuente.año}). {fuente.licencia}
          {worst && ESTADOS[worst] ? ` ${ESTADOS[worst]}` : ''}
        </Text>
      )}
      {section && parts.length > 0 && fuente.tipo === 'traducida' && (
        <Report
          colors={colors}
          send={(nota) =>
            reportarError(
              { fuente: source, libro: book.id, capitulo: chapter, desde: section.desde, parte: parts.length - 1 },
              nota,
            )
          }
        />
      )}

      <Pressable
        onPress={() => ew.url && Linking.openURL(ew.url(book.ewSlug, chapter))}
        style={[styles.ewButton, { backgroundColor: colors.accent }]}
      >
        <Text style={{ color: colors.surface, fontWeight: '600' }}>
          Leer {book.name} {chapter} en Enduring Word ↗
        </Text>
      </Pressable>
      <Text style={[styles.credit, { color: colors.muted }]}>{ew.obra}, por {ew.autor}, en su sitio web.</Text>
    </View>
  );
}

function Report({ colors, send }: { colors: Colors; send: (nota: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | string>('idle');

  if (state === 'sent') {
    return <Text style={[styles.credit, { color: colors.muted }]}>Gracias, lo revisaremos.</Text>;
  }
  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={6}>
        <Text style={[styles.credit, { color: colors.accent }]}>¿Ves un error en la traducción?</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ marginTop: 12 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Qué frase está mal y cómo debería decir"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={500}
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
      />
      <Pressable
        disabled={!text.trim() || state === 'sending'}
        onPress={async () => {
          setState('sending');
          try {
            await send(text.trim());
            setState('sent');
          } catch (err) {
            setState(err instanceof Error ? err.message : 'No se pudo enviar');
          }
        }}
        style={[styles.more, { borderColor: colors.accent, opacity: text.trim() ? 1 : 0.5 }]}
      >
        <Text style={{ color: colors.accent, fontWeight: '600' }}>{state === 'sending' ? 'Enviando…' : 'Enviar aviso'}</Text>
      </Pressable>
      {!['idle', 'sending'].includes(state) && <Text style={{ color: colors.accent, marginTop: 6 }}>{state}</Text>}
    </View>
  );
}

/** Markdown del comentario: ## títulos, **negritas**, *cursivas* y referencias ⟦jhn.3.16⟧ que se pueden tocar. */
function Rich({ text, books, colors, onRef }: { text: string; books: Book[]; colors: Colors; onRef: (ref: string) => void }) {
  return (
    <View>
      {text
        .split(/\n{2,}/)
        .map((b) => b.trim())
        .filter(Boolean)
        .map((block, i) =>
          /^#{1,3} /.test(block) ? (
            <Text key={i} style={[styles.h, { color: colors.text }]}>
              {inline(block.replace(/^#{1,3} /, ''), books, colors, onRef)}
            </Text>
          ) : (
            <Text key={i} style={[styles.p, { color: colors.text }]}>
              {inline(block, books, colors, onRef)}
            </Text>
          ),
        )}
    </View>
  );
}

function inline(text: string, books: Book[], colors: Colors, onRef: (ref: string) => void): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|⟦[^⟧]+⟧)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <Text key={i} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <Text key={i} style={{ fontStyle: 'italic' }}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    const ref = part.match(/^⟦([^⟧]+)⟧$/);
    if (ref) {
      const valid = /^[0-9a-z]{3}\.\d+\.\d+(-[0-9a-z]{3}\.\d+\.\d+)?$/.test(ref[1]);
      if (!valid) return null;
      return (
        <Text key={i} style={{ color: colors.accent, fontWeight: '600' }} onPress={() => onRef(ref[1])}>
          {formatRef(ref[1], books)}
        </Text>
      );
    }
    return part;
  });
}

const styles = StyleSheet.create({
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  section: { fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center' },
  h: { fontSize: 17, fontWeight: '700', marginTop: 6, marginBottom: 8, fontFamily: serif },
  p: { fontSize: 16, lineHeight: 25, marginBottom: 10, fontFamily: serif },
  translating: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  more: { marginTop: 8, borderWidth: 1, borderRadius: 24, paddingVertical: 10, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 64, textAlignVertical: 'top' },
  credit: { fontSize: 11, marginTop: 16 },
  ewButton: { marginTop: 20, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
});
