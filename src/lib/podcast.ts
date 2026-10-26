import { splitCites } from './herramientas';
import { Voz, vocesEspanol } from './voces';

// Resumen en audio de un capítulo, al estilo de los «Audio Overviews» de NotebookLM: la IA escribe una
// conversación entre Ana y Tomás y el teléfono la lee con sus voces en español (sin servidor de voz:
// funciona igual en web, iOS y Android, y no cuesta nada por minuto escuchado). Lo reproduce el reproductor único
// (src/lib/audio.ts), como todo lo demás que suena en la app.

export type Speaker = 'ana' | 'tomas';
export type Line = { speaker: Speaker; text: string; cites: number[] };

export const SPEAKERS: Record<Speaker, string> = { ana: 'Ana', tomas: 'Tomás' };

/** Convierte el guion «ANA: …» / «TOMÁS: …» en intervenciones; una línea sin nombre continúa la anterior. */
export function parseScript(script: string): Line[] {
  const lines: Line[] = [];
  for (const raw of script.split('\n')) {
    const line = raw.replace(/\*\*/g, '').trim();
    if (!line) continue;
    const m = line.match(/^(ANA|TOM[AÁ]S)\s*:\s*(.*)$/i);
    if (m) {
      const { text, cites } = splitCites(m[2]);
      lines.push({ speaker: m[1].toLowerCase().startsWith('ana') ? 'ana' : 'tomas', text, cites });
    } else if (lines.length) {
      const last = lines[lines.length - 1];
      const { text, cites } = splitCites(line);
      // Las marcas de cita pueden llegar solas en la línea siguiente
      lines[lines.length - 1] = { ...last, text: text ? `${last.text} ${text}` : last.text, cites: [...new Set([...last.cites, ...cites])] };
    }
  }
  return lines.filter((l) => l.text);
}

/** Minutos aproximados de escucha (unas 150 palabras por minuto). */
export const minutes = (lines: Line[]) =>
  Math.max(1, Math.round(lines.reduce((s, l) => s + l.text.split(/\s+/).length, 0) / 150));

// Nombres frecuentes de voces del sistema para distinguir a Ana (femenina) de Tomás (masculina).
const FEMALE = /paulina|m[oó]nica|helena|laura|elvira|dalia|sabina|salom[eé]|paloma|marisol|francisca|isabela|lucia|luc[ií]a|camila|valeria|elena|esperanza|ximena|larissa|abril|irene|triana|vera|estrella|google espa|female|mujer/i;
const MALE = /jorge|diego|juan|pablo|carlos|[aá]lvaro|ra[uú]l|enrique|jos[eé]|gonzalo|andr[eé]s|tom[aá]s|alonso|gerardo|lorenzo|emilio|male|hombre/i;

export type Voices = Record<Speaker, { voice?: string; pitch: number }>;

let voicesPromise: Promise<Voices> | null = null;

/**
 * Elige dos voces distintas en español, las más naturales del dispositivo (src/lib/voces.ts): una de mujer para Ana
 * y una de hombre para Tomás. Si el sistema tiene una sola, cambia el tono.
 */
export function pickVoices(): Promise<Voices> {
  voicesPromise ??= vocesEspanol().then((es) => {
    const nombre = (v: Voz) => `${v.nombre} ${v.id}`;
    const female = es.find((v) => FEMALE.test(nombre(v)) && !MALE.test(nombre(v)));
    const male = es.find((v) => MALE.test(nombre(v)) && v !== female);
    const ana = female ?? es[0];
    const tomas = male ?? es.find((v) => v !== ana);
    const voices: Voices =
      ana && tomas
        ? { ana: { voice: ana.id, pitch: 1 }, tomas: { voice: tomas.id, pitch: 1 } }
        : { ana: { voice: ana?.id, pitch: 1.12 }, tomas: { voice: ana?.id, pitch: 0.85 } };
    // Si no hubo voces, se vuelve a buscar la próxima vez (pueden cargar más tarde)
    if (!voices.ana.voice) voicesPromise = null;
    return voices;
  });
  return voicesPromise;
}

/** Trozos cortos: algunos navegadores cortan las frases muy largas a mitad. */
export function chunks(text: string): string[] {
  const parts = text.match(/[^.!?…]+[.!?…»"]*\s*/g) ?? [text];
  const out: string[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && last.length + p.length < 180) out[out.length - 1] = last + p;
    else out.push(p);
  }
  return out.map((s) => s.trim()).filter(Boolean);
}
