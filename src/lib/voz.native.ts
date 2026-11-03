// Dictado por voz en la app de Android e iPhone, con el reconocimiento del propio teléfono (expo-speech-recognition:
// SpeechRecognizer de Google en Android, SFSpeechRecognizer en iPhone). Mismas funciones que voz.ts, que es la de la web.
// Un APK viejo que reciba este código por una actualización no tiene el módulo nativo: ahí no se ofrece el micrófono
// y queda el del teclado (la huella nativa ya lo evita, esto es por si acaso).
import type { ExpoSpeechRecognitionErrorCode, ExpoSpeechRecognitionModule as Modulo } from 'expo-speech-recognition';

let modulo: typeof Modulo | null | undefined;

function speech(): typeof Modulo | null {
  if (modulo !== undefined) return modulo;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modulo = (require('expo-speech-recognition') as { ExpoSpeechRecognitionModule: typeof Modulo }).ExpoSpeechRecognitionModule;
  } catch {
    modulo = null;
  }
  return modulo;
}

export function voiceSupported(): boolean {
  const m = speech();
  if (!m) return false;
  try {
    return m.isRecognitionAvailable();
  } catch {
    return false;
  }
}

const MESSAGES: Partial<Record<ExpoSpeechRecognitionErrorCode, string>> = {
  'not-allowed': 'Para dictar, permite que Zarza use el micrófono en los ajustes del teléfono.',
  'service-not-allowed': 'Para dictar, activa el reconocimiento de voz del teléfono (la app de Google en Android).',
  'audio-capture': 'No pude usar el micrófono. ¿Lo está usando otra app?',
  'no-speech': 'No te escuché. Toca el micrófono e inténtalo otra vez.',
  'speech-timeout': 'No te escuché. Toca el micrófono e inténtalo otra vez.',
  network: 'El dictado necesita conexión a internet.',
  'language-not-supported': 'El reconocimiento de voz del teléfono no tiene el español. Instálalo en los ajustes de idioma.',
  busy: 'El micrófono está ocupado. Espera un momento e inténtalo otra vez.',
  interrupted: 'Se cortó el dictado. Inténtalo otra vez.',
};

type Handlers = {
  /** Lo que se va oyendo, para mostrarlo mientras se habla. */
  onPartial: (text: string) => void;
  /** Lo que se dijo, con las otras formas posibles que oyó el teléfono (la primera es la más probable). */
  onFinal: (alternatives: string[]) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};

/** Pide el idioma del teléfono si es español; si no, español de España (como en la web). */
function idioma(): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    if (loc.toLowerCase().startsWith('es')) return loc;
  } catch {}
  return 'es-ES';
}

/** Empieza a escuchar una frase. Devuelve la función para dejar de escuchar. */
export function listen({ onPartial, onFinal, onError, onEnd }: Handlers): () => void {
  const m = speech();
  if (!m) {
    onError('Este teléfono no permite dictar aquí. Usa el micrófono del teclado.');
    onEnd();
    return () => {};
  }
  let terminado = false;
  let cancelado = false;
  let empezo = false;
  let final = false;
  const subs: { remove: () => void }[] = [];
  const cerrar = () => {
    if (terminado) return;
    terminado = true;
    subs.forEach((s) => s.remove());
    onEnd();
  };

  subs.push(
    m.addListener('result', (e) => {
      const options = e.results.map((r) => r.transcript.trim()).filter(Boolean);
      if (!options.length) return;
      if (e.isFinal) {
        final = true;
        onFinal(options);
      } else onPartial(options[0]);
    }),
    m.addListener('error', (e) => {
      if (e.error !== 'aborted') onError(MESSAGES[e.error] ?? 'No se pudo usar el micrófono.');
    }),
    m.addListener('end', cerrar),
  );

  m.requestPermissionsAsync()
    .then((p) => {
      if (cancelado) return cerrar();
      if (!p.granted) {
        onError(MESSAGES['not-allowed']!);
        return cerrar();
      }
      m.start({
        lang: idioma(),
        interimResults: true,
        continuous: false,
        maxAlternatives: 4,
        addsPunctuation: true,
        androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'free_form' },
      });
      empezo = true;
    })
    .catch(() => {
      onError('No se pudo usar el micrófono.');
      cerrar();
    });

  // stop() en vez de abort(): lo dicho hasta ese momento todavía llega como resultado final
  return () => {
    if (final || terminado) return;
    cancelado = true;
    if (empezo) m.stop();
  };
}
