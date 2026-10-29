import { splitCites } from './herramientas';
import { Voz, vocesEspanol, vozElegida } from './voces';

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

export type Voices = Record<Speaker, { voice?: string; pitch: number }>;

let voicesPromise: Promise<Voices> | null = null;

/**
 * Elige dos voces distintas en español, las más naturales del dispositivo (src/lib/voces.ts): una de mujer para Ana
 * y una de hombre para Tomás, salvo que la persona haya elegido otras. Si el sistema tiene una sola, cambia el tono.
 */
export async function pickVoices(): Promise<Voices> {
  const [auto, ana, tomas] = await Promise.all([pickAutoVoices(), vozElegida('ana'), vozElegida('tomas')]);
  if (!ana && !tomas) return auto;
  const es = await vocesEspanol();
  const a = ana?.id ?? (auto.ana.voice !== tomas?.id ? auto.ana.voice : es.find((v) => v.id !== tomas?.id)?.id);
  const t = tomas?.id ?? (auto.tomas.voice !== a ? auto.tomas.voice : es.find((v) => v.id !== a)?.id);
  if (!t || t === a) return { ana: { voice: a, pitch: 1.12 }, tomas: { voice: a, pitch: 0.85 } };
  // La que eligió la persona suena tal cual; la automática conserva su ajuste de tono
  const tono = (s: Speaker, id: string | undefined, elegida: unknown) => (!elegida && id === auto[s].voice ? auto[s].pitch : 1);
  return { ana: { voice: a, pitch: tono('ana', a, ana) }, tomas: { voice: t, pitch: tono('tomas', t, tomas) } };
}

/**
 * Las voces que pondría la app sola, sin lo que eligió la persona: para Ana la más natural de mujer y para Tomás la
 * más natural de hombre (src/lib/voces.ts sabe cuál es cuál por el nombre o el código de la voz). Si falta una de
 * las dos, la otra voz se acerca con el tono: más agudo para Ana, más grave para Tomás.
 */
export function pickAutoVoices(): Promise<Voices> {
  voicesPromise ??= vocesEspanol().then((es) => {
    voicesPromise = es.length ? voicesPromise : null;
    return elegirAuto(es);
  });
  return voicesPromise;
}

/** Ana y Tomás de una lista de voces ordenada de la más natural a la más robótica. */
export function elegirAuto(es: Voz[]): Voices {
  const mujer = es.find((v) => v.genero === 'mujer');
  const hombre = es.find((v) => v.genero === 'hombre');
  const ana = mujer ?? es.find((v) => !v.genero) ?? es.find((v) => v !== hombre);
  const tomas = hombre ?? es.find((v) => !v.genero && v !== ana) ?? es.find((v) => v !== ana);
  if (!ana && !tomas) return { ana: { pitch: 1 }, tomas: { pitch: 1 } };
  if (!ana || !tomas) {
    const una = (ana ?? tomas)!.id;
    return { ana: { voice: una, pitch: 1.12 }, tomas: { voice: una, pitch: 0.85 } };
  }
  return {
    ana: { voice: ana.id, pitch: ana.genero === 'mujer' ? 1 : 1.12 },
    tomas: { voice: tomas.id, pitch: tomas.genero === 'hombre' ? 1 : 0.85 },
  };
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
