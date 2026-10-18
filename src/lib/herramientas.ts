import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

import { Herramienta, Source, askStudy } from './estudio';

// Resultado de las herramientas de un capítulo (pódcast, tarjetas, mapa mental). Se guarda en el
// dispositivo para no volver a pedirlo a la IA cada vez que se abre.

type Saved = { text: string; sources: Source[]; created: number };

const key = (tool: Herramienta, book: string, chapter: number) => `herramienta.${tool}.${book}.${chapter}`;

export function useHerramienta(tool: Herramienta, book: string, chapter: number) {
  const [text, setText] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [busy, setBusy] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const generate = async () => {
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
        { book, chapter, herramienta: tool, messages: [] },
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
      AsyncStorage.setItem(key(tool, book, chapter), JSON.stringify(saved)).catch(() => {});
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
    AsyncStorage.getItem(key(tool, book, chapter))
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
  }, [tool, book, chapter]);

  return { text, sources, busy, done, error, regenerate: generate };
}

const CITE = /⟦(\d+)⟧/g;

/** Separa el texto de sus marcas de cita: «… ⟦2⟧⟦3⟧» → texto limpio y [2, 3]. */
export function splitCites(text: string): { text: string; cites: number[] } {
  const cites = [...text.matchAll(CITE)].map((m) => Number(m[1]));
  return { text: text.replace(CITE, '').replace(/\s+([,.;:!?»])/g, '$1').replace(/\s{2,}/g, ' ').trim(), cites: [...new Set(cites)] };
}

/** Versículo de una referencia «(v. 3)», «(vv. 1-8)» o «(vv. 4, 6)»: el primero que nombra. */
export function verseRange(text: string): { text: string; from?: number; to?: number } {
  const m = text.match(/\s*\((?:vv?\.|versículos?)\s*(\d+)(?:\s*[-–]\s*(\d+))?[^)]*\)\s*$/i);
  if (!m) return { text };
  return { text: text.slice(0, m.index).trim(), from: Number(m[1]), to: m[2] ? Number(m[2]) : undefined };
}
