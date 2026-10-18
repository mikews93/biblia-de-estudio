// Dictado por voz con el reconocimiento del navegador (Chrome, Edge, Safari). En la app nativa todavía no:
// ahí se usa el micrófono del teclado, que escribe en el mismo campo.
import { Platform } from 'react-native';

type Alternative = { transcript: string };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<ArrayLike<Alternative> & { isFinal: boolean }> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function recognitionClass(): (new () => Recognition) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const voiceSupported = () => recognitionClass() !== null;

const MESSAGES: Record<string, string> = {
  'not-allowed': 'Para dictar, permite el uso del micrófono en el navegador.',
  'service-not-allowed': 'Para dictar, permite el uso del micrófono en el navegador.',
  'audio-capture': 'No encontré un micrófono.',
  'no-speech': 'No te escuché. Toca el micrófono e inténtalo otra vez.',
  network: 'El dictado necesita conexión a internet.',
};

type Handlers = {
  /** Lo que se va oyendo, para mostrarlo mientras se habla. */
  onPartial: (text: string) => void;
  /** Lo que se dijo, con las otras formas posibles que oyó el navegador (la primera es la más probable). */
  onFinal: (alternatives: string[]) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};

/** Empieza a escuchar una frase. Devuelve la función para dejar de escuchar. */
export function listen({ onPartial, onFinal, onError, onEnd }: Handlers): () => void {
  const Rec = recognitionClass();
  if (!Rec) {
    onError('Este navegador no permite dictar. Prueba con Chrome, Edge o Safari, o con el micrófono del teclado.');
    onEnd();
    return () => {};
  }
  const rec = new Rec();
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  rec.lang = nav.toLowerCase().startsWith('es') ? nav : 'es-ES';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 4;
  let done = false;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const options = Array.from(result, (a) => a.transcript.trim()).filter(Boolean);
      if (result.isFinal) {
        done = true;
        onFinal(options);
      } else if (options[0]) onPartial(options[0]);
    }
  };
  rec.onerror = (e) => {
    if (e.error !== 'aborted') onError(MESSAGES[e.error] ?? 'No se pudo usar el micrófono.');
  };
  rec.onend = () => onEnd();
  try {
    rec.start();
  } catch {
    onError('No se pudo usar el micrófono.');
    onEnd();
  }
  // stop() en vez de abort(): lo dicho hasta ese momento todavía llega como resultado final
  return () => (done ? undefined : rec.stop());
}
