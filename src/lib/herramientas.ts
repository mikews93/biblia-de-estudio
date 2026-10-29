import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

import { siglaDe } from './enVersion';
import { Herramienta, Source, askStudy } from './estudio';
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

/** En qué versión suena el pódcast para quien lee la versión elegida en los ajustes. */
export function useVersionPodcast(): VersionPodcast {
  const { settings } = useSettings();
  const id = versionPodcast(settings.version);
  const [sigla, setSigla] = useState<Record<string, string>>({ rv1909: 'RV1909', pdt: 'PDT' });
  useEffect(() => {
    if (sigla[id]) return;
    siglaDe(id).then((s) => s && setSigla((m) => ({ ...m, [id]: s })));
  }, [id, sigla]);
  return { id, sigla: sigla[id] ?? id.toUpperCase() };
}

type Pedido = { book?: string; chapter?: number; palabra?: string; herramienta?: Herramienta; version?: string };

function useGuardado(storageKey: string, pedido: Pedido) {
  const [text, setText] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [busy, setBusy] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const generate = async (nueva = false) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setDone(false);
    setError(null);
    setText('');
    setSources([]);
    try {
      const answer = await askStudy(
        { ...pedido, messages: [], ...(nueva && { nueva }) },
        (t, s) => {
          setText(t);
          setSources(s);
        },
        controller.signal,
      );
      setText(answer.text);
      setSources(answer.sources);
      setDone(true);
      const saved: Saved = { ...answer, created: Date.now() };
      AsyncStorage.setItem(storageKey, JSON.stringify(saved)).catch(() => {});
    } catch (e) {
      if (controller.signal.aborted) return;
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

  return { text, sources, busy, done, error, retry: () => generate(), regenerate: () => generate(true) };
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
