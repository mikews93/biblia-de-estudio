import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { siglaDe } from './enVersion';
import { CORTADA, Herramienta, Source, askStudy } from './estudio';
import { conVersion, versionPodcast } from './podcastVersion';
import { useSettings } from './theme';

// Resultado de las herramientas de un capítulo (pódcast, tarjetas, mapa mental). El servidor guarda la de cada
// capítulo para todos; además se guarda en el dispositivo para abrirla sin esperar ni pedirla otra vez.

type Saved = { text: string; sources: Source[]; created: number };

const key = (tool: Herramienta, book: string, chapter: number) => `herramienta.${tool}.${book}.${chapter}`;

/** Con «version», la herramienta en esa versión (solo el pódcast la tiene: ver src/lib/podcastVersion.ts). */
export function useHerramienta(tool: Herramienta, book: string, chapter: number, version = 'rv1909') {
  return useGuardado(conVersion(key(tool, book, chapter), version), {
    book,
    chapter,
    herramienta: tool,
    ...(version !== 'rv1909' && { version }),
  });
}

/** El relato o el guion del pódcast de «La historia de una palabra»; el pódcast, en «version». */
export function usePalabraIA(palabra: string, tool: 'relato' | 'podcast', version = 'rv1909') {
  const conVersionDelPodcast = tool === 'podcast' && version !== 'rv1909';
  return useGuardado(conVersionDelPodcast ? `palabra.${tool}.${palabra}.${version}` : `palabra.${tool}.${palabra}`, {
    palabra,
    ...(tool === 'podcast' && { herramienta: 'podcast' as const }),
    ...(conVersionDelPodcast && { version }),
  });
}

export type VersionPodcast = {
  /** La versión libre en que está el pódcast. */
  id: string;
  sigla: string;
};

/** En qué versión suena el pódcast para quien lee la versión elegida en los ajustes (o en «elegida», si ya se sabe). */
export function useVersionPodcast(elegida?: string): VersionPodcast {
  const { settings } = useSettings();
  const id = elegida ?? versionPodcast(settings.version);
  const [sigla, setSigla] = useState<Record<string, string>>({ rv1909: 'RV1909', pdt: 'PDT' });
  useEffect(() => {
    if (sigla[id]) return;
    siglaDe(id).then((s) => s && setSigla((m) => ({ ...m, [id]: s })));
  }, [id, sigla]);
  return { id, sigla: sigla[id] ?? id.toUpperCase() };
}

type Pedido = { book?: string; chapter?: number; palabra?: string; herramienta?: Herramienta; version?: string };

/** Cuántas veces se vuelve a pedir solo lo que se cortó por la conexión, antes de enseñar el error. */
const REINTENTOS = 4;
/** Al volver a la app, si hace esto que no llega nada, la conexión de antes ya no sirve: se pide de nuevo. */
const VOLVER_MS = 8000;

/** Se cortó la conexión (no es un «no» del servidor): vale la pena volver a pedirlo. */
const esCorte = (e: unknown) => e instanceof TypeError || (e instanceof Error && e.message === CORTADA);

const esperar = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true });
  });

function useGuardado(storageKey: string, pedido: Pedido) {
  const [text, setText] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [busy, setBusy] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Se cortó la conexión y se está volviendo a pedir (el servidor sigue preparándolo). */
  const [retomando, setRetomando] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const ultimaNoticia = useRef(0);

  const generate = async (nueva = false) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setDone(false);
    setError(null);
    setRetomando(false);
    setText('');
    setSources([]);
    ultimaNoticia.current = Date.now();
    try {
      for (let intento = 0; ; intento++) {
        try {
          const answer = await askStudy(
            // Al reintentar ya no es «nueva»: la preparación de antes sigue en el servidor y se espera a esa.
            { ...pedido, messages: [], ...(nueva && intento === 0 && { nueva }) },
            (t, s) => {
              ultimaNoticia.current = Date.now();
              setText(t);
              setSources(s);
            },
            controller.signal,
            { compartida: true },
          );
          setText(answer.text);
          setSources(answer.sources);
          setDone(true);
          setRetomando(false);
          const saved: Saved = { ...answer, created: Date.now() };
          AsyncStorage.setItem(storageKey, JSON.stringify(saved)).catch(() => {});
          return;
        } catch (e) {
          if (controller.signal.aborted) return;
          if (!esCorte(e) || intento >= REINTENTOS) throw e;
          // Se cortó (la app pasó a segundo plano, cambió la red): se vuelve a pedir sin borrar lo que ya se ve. El
          // servidor entrega lo guardado o espera a la preparación que sigue en marcha.
          setRetomando(true);
          await esperar(1500 * (intento + 1), controller.signal);
          if (controller.signal.aborted) return;
          ultimaNoticia.current = Date.now();
        }
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      setRetomando(false);
      setError(e instanceof Error ? e.message : 'No se pudo preparar.');
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    AsyncStorage.getItem(storageKey)
      .catch(() => null)
      .then((raw) => {
        if (cancelled) return;
        const saved = raw ? (JSON.parse(raw) as Saved) : null;
        if (saved?.text) {
          setText(saved.text);
          setSources(saved.sources);
          setDone(true);
          setBusy(false);
        } else {
          generate();
        }
      });
    return () => {
      cancelled = true;
      abort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Al volver a la app con la preparación a medias, la conexión de antes suele estar muerta aunque no lo diga: si hace
  // rato que no llega nada, se pide otra vez en seguida (sin gastar: el servidor no prepara dos veces lo mismo).
  const preparando = busy && !done;
  useEffect(() => {
    if (!preparando) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - ultimaNoticia.current > VOLVER_MS) generate();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparando]);

  return { text, sources, busy, done, error, retomando, retry: () => generate(), regenerate: () => generate(true) };
}

const CITE = /⟦(\d+)⟧/g;

/** Separa el texto de sus marcas de cita: «… ⟦2⟧⟦3⟧» → texto limpio y [2, 3]. */
export function splitCites(text: string): { text: string; cites: number[] } {
  const cites = [...text.matchAll(CITE)].map((m) => Number(m[1]));
  return { text: text.replace(CITE, '').replace(/\s+([,.;:!?»])/g, '$1').replace(/\s{2,}/g, ' ').trim(), cites: [...new Set(cites)] };
}

/** Versículo de una referencia «(v. 3)», «(vv. 1-8)» o «(vv. 4, 6)» al final, aunque lleve punto: el primero que nombra. */
export function verseRange(text: string): { text: string; from?: number; to?: number } {
  const m = text.match(/\s*\((?:vv?\.|versículos?)\s*(\d+)(?:\s*[-–]\s*(\d+))?[^)]*\)[.;:]?\s*$/i);
  if (!m) return { text };
  return { text: text.slice(0, m.index).trim(), from: Number(m[1]), to: m[2] ? Number(m[2]) : undefined };
}
