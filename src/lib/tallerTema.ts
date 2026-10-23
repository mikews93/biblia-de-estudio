// El Taller desde un tema: la persona graba o escribe de qué quiere hablar, la IA investiga (pasajes, comentarios de la
// app y teologías) y, con el pasaje elegido, arma la maqueta: el esqueleto del mensaje, con títulos, preguntas guía y
// pasajes de apoyo. Lo que se dice en cada parte lo escribe la persona.
// Los formatos los piden temaTask y el modo «maqueta» de tallerTask en api/estudiar.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Book } from './data';
import { Source } from './estudio';
import { PLANTILLAS, Pasaje, Seccion, Tipo, crearMensaje, actualizarMensaje, parsePasaje, plantilla as plantillaDe } from './taller';

export const MIN_TEMA = 10;
export const MAX_TEMA = 4000;

export type PasajeSugerido = {
  /** La cita tal como la escribió la IA: «Juan 14:1-6». */
  cita: string;
  pasaje: Pasaje | null;
  /** Por qué sirve, en markdown con sus citas ⟦n⟧. */
  porque: string;
};

export type Exploracion = {
  entiendo: string;
  pasajes: PasajeSugerido[];
  /** Líneas de lo que aportan los comentarios y las teologías, en markdown con sus citas. */
  fuentes: string[];
  preguntas: string[];
};

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Las partes de una respuesta en markdown: el texto bajo cada título «## ». */
function apartados(markdown: string): { titulo: string; lineas: string[] }[] {
  const out: { titulo: string; lineas: string[] }[] = [];
  for (const line of markdown.split('\n')) {
    const h = line.match(/^#{1,3}\s+(.+)/);
    if (h) out.push({ titulo: h[1].replace(/\*\*/g, '').trim(), lineas: [] });
    else if (out.length && line.trim()) out[out.length - 1].lineas.push(line.trim());
  }
  return out;
}

const item = (line: string) => line.match(/^[-*•]\s+(.+)/)?.[1].trim() ?? (/^\d+[.)]\s+/.test(line) ? line.replace(/^\d+[.)]\s+/, '').trim() : null);
const sinMarcas = (s: string) => s.replace(/(?:\s*⟦\d+⟧)+/g, '').replace(/\*\*/g, '').trim();

/** Lee la investigación de un tema; mientras llega, devuelve lo que ya está completo. */
export function leerExploracion(markdown: string, books: Book[]): Exploracion {
  const out: Exploracion = { entiendo: '', pasajes: [], fuentes: [], preguntas: [] };
  for (const { titulo, lineas } of apartados(markdown)) {
    const t = fold(titulo);
    if (t.startsWith('lo que entiendo')) out.entiendo = lineas.join(' ');
    else if (t.startsWith('pasaje')) {
      for (const l of lineas) {
        const x = item(l);
        if (!x) continue;
        const [cita, ...resto] = x.split('|');
        const limpia = sinMarcas(cita).replace(/[«»"]/g, '').replace(/[.:,;]+$/, '');
        out.pasajes.push({ cita: limpia, pasaje: parsePasaje(limpia, books), porque: resto.join('|').trim() });
      }
    } else if (t.includes('fuentes') || t.includes('comentarios')) {
      lineas.forEach((l) => {
        const x = item(l);
        if (x) out.fuentes.push(x);
      });
    } else if (t.includes('afinar') || t.includes('pregunta')) {
      lineas.forEach((l) => {
        const x = item(l);
        if (x) out.preguntas.push(sinMarcas(x));
      });
    }
  }
  return out;
}

export type ParteMaqueta = { titulo: string; pregunta: string; apoyo: string; apoyoPasaje: Pasaje | null; porque: string };
export type Maqueta = { ideas: { tema: string; complemento: string }[]; partes: ParteMaqueta[] };

/** Lee la maqueta: las opciones de idea central y, por cada parte, su título, la pregunta guía y el pasaje de apoyo. */
export function leerMaqueta(markdown: string, books: Book[]): Maqueta {
  const out: Maqueta = { ideas: [], partes: [] };
  for (const { titulo, lineas } of apartados(markdown)) {
    if (fold(titulo).startsWith('idea central')) {
      for (const l of lineas) {
        const x = item(l);
        const m = x && sinMarcas(x).match(/^tema\s*:\s*(.+?)\s*(?:\||·|—|–|;)\s*complemento\s*:\s*(.+)$/i);
        if (m) out.ideas.push({ tema: m[1].replace(/^[«"]|[«»".]+$/g, ''), complemento: m[2].replace(/[«»"]/g, '').trim() });
      }
      continue;
    }
    const parte: ParteMaqueta = { titulo: sinMarcas(titulo), pregunta: '', apoyo: '', apoyoPasaje: null, porque: '' };
    for (const l of lineas) {
      if (l.startsWith('?')) parte.pregunta = sinMarcas(l.slice(1));
      else if (l.startsWith('>')) {
        const [cita, ...resto] = l.slice(1).split('|');
        parte.apoyo = sinMarcas(cita).replace(/[«»"]/g, '').replace(/[.:,;]+$/, '');
        parte.apoyoPasaje = parsePasaje(parte.apoyo, books);
        parte.porque = resto.join('|').trim();
      }
    }
    out.partes.push(parte);
  }
  return out;
}

/** Las partes de la estructura, para que la IA arme la maqueta sobre ellas. */
export function estructuraParaIA(plantillaId: string) {
  const p = plantillaDe(plantillaId);
  if (!p) return '';
  return ['Partes de la estructura:', ...p.secciones.map((s, i) => `${i + 1}. ${s.titulo}: ${s.ayuda}`)].join('\n');
}

/**
 * Crea el mensaje con la maqueta: el pasaje elegido, la idea central que la persona eligió (si eligió una) y las partes
 * de la plantilla con el título, la pregunta guía y el pasaje de apoyo de la maqueta. Las notas quedan vacías.
 */
export async function crearDesdeMaqueta(o: {
  tipo: Tipo;
  plantilla: string;
  pasaje: Pasaje;
  situacion: string;
  maqueta: Maqueta;
  idea?: { tema: string; complemento: string };
  sources: Source[];
}): Promise<string> {
  const id = await crearMensaje(o.tipo, o.pasaje);
  const p = plantillaDe(o.plantilla) ?? PLANTILLAS.find((x) => x.tipo === o.tipo)!;
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const secciones: Seccion[] = p.secciones.map((base, i) => {
    const parte = o.maqueta.partes[i];
    const titulo = parte?.titulo && (o.tipo === 'sermon' || fold(parte.titulo) === fold(base.titulo)) ? parte.titulo : base.titulo;
    return {
      id: uid(),
      titulo,
      ayuda: parte?.pregunta || base.ayuda,
      apoyo: parte?.apoyo ? { cita: parte.apoyo, porque: conCitas(parte.porque, o.sources) } : undefined,
      texto: '',
      minutos: base.minutos,
      dinamica: base.dinamica,
    };
  });
  actualizarMensaje(id, {
    plantilla: p.id,
    secciones,
    situacion: o.situacion.trim(),
    ...(o.idea && { tema: o.idea.tema, complemento: o.idea.complemento }),
  });
  return id;
}

/** Las marcas ⟦n⟧ como referencias entre paréntesis, para guardar el texto sin depender de la respuesta. */
export function conCitas(s: string, sources: { n: number; label: string }[]) {
  return s
    .replace(/(?:\s*⟦\d+⟧)+/g, (run) => {
      const labels = [...new Set([...run.matchAll(/⟦(\d+)⟧/g)].map(([, n]) => sources.find((x) => x.n === Number(n))?.label).filter(Boolean))];
      return labels.length ? ` (${labels.join('; ')})` : '';
    })
    .replace(/\*\*/g, '')
    .trim();
}

// El borrador del tema se guarda en el dispositivo mientras se escribe, para no perder lo dictado.
const KEY = 'taller-tema';
export type BorradorTema = { texto: string; tipo: Tipo };

export async function leerBorradorTema(): Promise<BorradorTema | null> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BorradorTema;
  } catch {
    return null;
  }
}

export const guardarBorradorTema = (b: BorradorTema) => AsyncStorage.setItem(KEY, JSON.stringify(b)).catch(() => {});
export const borrarBorradorTema = () => AsyncStorage.removeItem(KEY).catch(() => {});
