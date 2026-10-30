// Revisa las citas bíblicas de una respuesta de la IA contra el texto de la Biblia: que el pasaje exista y que las
// palabras entre comillas digan de verdad lo que dice ese versículo. Es la queja más repetida de las apps con IA
// (investigación de 2026-10-30): citas inventadas o versículos que no dicen eso. Sin dependencias de React Native.

import { parseCita } from './cita';
import { parseRef } from './refs';
import type { Source } from './estudio';

type Libro = { id: string; name: string; abbr: string; chapters: number };

/** Un pasaje de un solo capítulo: «Juan 3:16-18» → jhn 3, del 16 al 18. */
export type Pasaje = { book: string; chapter: number; verse: number; verseEnd: number };

export type CitaEncontrada = {
  /** Cómo aparece en la respuesta («Juan 3:16», o la etiqueta de la fuente ⟦2⟧). */
  texto: string;
  pasaje: Pasaje;
  /** Las palabras entre comillas que van con esa cita, si las hay. */
  frase?: string;
  /** El capítulo no existe en ese libro («Juan 30:1»). */
  problema?: string;
};

const quitarTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Para comparar: sin tildes ni signos, en minúsculas. «á» de la RV1909 queda en «a». */
export const normalizar = (t: string) =>
  quitarTildes(t)
    .toLowerCase()
    .replace(/[^a-zñ0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// «Juan 3:16», «1 Corintios 13:4-7», «Cantar de los Cantares 2:4», «Jn 3:16». Lo confirma parseCita.
const REF = /(?:\b([1-3])\s?)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s(?:de\s(?:los\s)?)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)\.?\s(\d{1,3}):(\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?/g;
const COMILLAS = /«([^«»\n]{8,400})»|“([^“”\n]{8,400})”|"([^"\n]{8,400})"/g;
const FUENTE = /⟦(\d+)⟧/g;
/** Hasta dónde puede estar la cita de unas comillas (en caracteres de la misma línea). */
const CERCA = 90;

function pasajeDeFuente(ref: string): Pasaje | null {
  const { start, end } = parseRef(ref);
  if (!start.book || !start.chapter || !start.verse) return null;
  const mismo = end.book === start.book && end.chapter === start.chapter;
  return { book: start.book, chapter: start.chapter, verse: start.verse, verseEnd: mismo ? Math.max(end.verse, start.verse) : start.verse };
}

/**
 * Las citas de la respuesta: las escritas («Juan 3:16») y las fuentes ⟦n⟧ que son un pasaje. Las comillas se juntan
 * con la cita más cercana de su misma línea. Las marcas ⟪Juan 3:16⟫ no se revisan: su texto lo pone la app.
 */
export function buscarCitas(text: string, books: Libro[], sources: Source[] = []): CitaEncontrada[] {
  const citas: CitaEncontrada[] = [];
  const vistas = new Set<string>();
  for (const linea of text.replace(/⟪[^⟪⟫\n]*⟫/g, (m) => ' '.repeat(m.length)).split('\n')) {
    type Lugar = { at: number; fin: number; cita: CitaEncontrada };
    const lugares: Lugar[] = [];
    for (const m of linea.matchAll(REF)) {
      let texto = m[0];
      let at = m.index!;
      let c = parseCita(texto, books);
      // «Luego Romanos 8:28»: la primera palabra con mayúscula no era parte del libro
      if (!c && !m[1] && m[2].includes(' ')) {
        const corte = texto.indexOf(' ') + 1;
        texto = texto.slice(corte);
        at += corte;
        c = parseCita(texto, books);
      }
      if (!c || c.verse === undefined) continue;
      const pasaje = { book: c.book, chapter: c.chapter, verse: c.verse, verseEnd: c.verseEnd ?? c.verse };
      lugares.push({ at, fin: m.index! + m[0].length, cita: { texto: texto.trim(), pasaje, problema: c.problem } });
    }
    for (const m of linea.matchAll(FUENTE)) {
      const s = sources.find((x) => x.n === Number(m[1]));
      const pasaje = s?.ref ? pasajeDeFuente(s.ref) : null;
      if (s && pasaje) lugares.push({ at: m.index!, fin: m.index! + m[0].length, cita: { texto: s.label, pasaje } });
    }
    if (!lugares.length) continue;

    // Cada frase entre comillas va con la cita más cercana: la de justo después («…» (Juan 3:16) o «…» ⟦2⟧)
    // o la de antes («Juan 3:16 dice: «…»»).
    const usadas = new Set<Lugar>();
    for (const q of linea.matchAll(COMILLAS)) {
      const frase = (q[1] ?? q[2] ?? q[3]).trim();
      if (normalizar(frase).split(' ').length < 3) continue; // «misericordia»: una palabra, no una cita
      const ini = q.index!;
      const fin = ini + q[0].length;
      const distancia = (l: Lugar) => (l.at >= fin ? l.at - fin : ini >= l.fin ? ini - l.fin : 0);
      const cerca = lugares.filter((l) => !usadas.has(l) && distancia(l) <= CERCA).sort((a, b) => distancia(a) - distancia(b))[0];
      if (!cerca) continue;
      usadas.add(cerca);
      cerca.cita.frase = frase;
    }
    for (const { cita } of lugares) {
      const p = cita.pasaje;
      const clave = `${p.book}.${p.chapter}.${p.verse}-${p.verseEnd}|${cita.frase ?? ''}`;
      // La misma fuente sin frase, repetida en varias líneas, se cuenta una vez.
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      citas.push(cita);
    }
  }
  return citas;
}

export type Comparacion = 'igual' | 'casi' | 'distinta';

/**
 * ¿Dicen las palabras citadas lo que dice el texto? «igual»: cada trozo (separado por «…») está tal cual.
 * «casi»: casi todas sus palabras están (otra puntuación, otra versión cercana). «distinta»: no lo dice.
 */
export function comparar(frase: string, texto: string): Comparacion {
  const t = normalizar(texto);
  const trozos = frase
    .split(/…|\.\.\./)
    .map(normalizar)
    .filter((x) => x.split(' ').length >= 2);
  if (!trozos.length) return 'igual';
  if (trozos.every((x) => ` ${t} `.includes(` ${x} `))) return 'igual';
  // Casi todas sus palabras y buena parte de sus pares de palabras seguidas: así no pasa por buena una frase de
  // otro versículo que solo comparte «Dios», «su» y «mundo».
  const palabrasTexto = t.split(' ');
  const enTexto = new Set(palabrasTexto);
  const paresTexto = new Set(palabrasTexto.slice(1).map((w, i) => `${palabrasTexto[i]} ${w}`));
  const palabras = trozos.join(' ').split(' ');
  const pares = trozos.flatMap((x) => {
    const ws = x.split(' ');
    return ws.slice(1).map((w, i) => `${ws[i]} ${w}`);
  });
  const parte = (xs: string[], en: Set<string>) => (xs.length ? xs.filter((x) => en.has(x)).length / xs.length : 1);
  return parte(palabras, enTexto) >= 0.85 && parte(pares, paresTexto) >= 0.4 ? 'casi' : 'distinta';
}

export type Revision =
  | { estado: 'bien'; cita: CitaEncontrada; version: string }
  | { estado: 'existe'; cita: CitaEncontrada }
  | { estado: 'no-existe'; cita: CitaEncontrada; detalle: string }
  | { estado: 'otro-versiculo'; cita: CitaEncontrada; verso: number; version: string }
  | { estado: 'no-coincide'; cita: CitaEncontrada; texto: string; version: string };

type Capitulo = [number, string, ...unknown[]][];

/**
 * Revisa cada cita con el capítulo en las versiones dadas (la que lee la persona y la RV1909, que es con la que
 * trabaja la IA cuando la otra tiene derechos). Basta con que coincida en una.
 */
export async function revisarCitas(
  citas: CitaEncontrada[],
  capitulo: (book: string, chapter: number, version: string) => Promise<Capitulo>,
  versiones: string[],
  nombreLibro: (id: string) => string,
): Promise<Revision[]> {
  const leidos = new Map<string, Promise<Capitulo | null>>();
  const leer = (book: string, chapter: number, version: string) => {
    const k = `${version}/${book}/${chapter}`;
    if (!leidos.has(k)) leidos.set(k, capitulo(book, chapter, version).catch(() => null));
    return leidos.get(k)!;
  };
  return Promise.all(
    citas.map(async (cita): Promise<Revision> => {
      const p = cita.pasaje;
      if (cita.problema) return { estado: 'no-existe', cita, detalle: cita.problema };
      let alguno: { version: string; vs: Capitulo } | null = null;
      for (const version of versiones) {
        const vs = await leer(p.book, p.chapter, version);
        if (!vs?.length) continue;
        alguno ??= { version, vs };
        const ultimo = Math.max(...vs.map(([n]) => n));
        if (p.verse > ultimo) {
          return { estado: 'no-existe', cita, detalle: `${nombreLibro(p.book)} ${p.chapter} tiene ${ultimo} versículos.` };
        }
        if (!cita.frase) return { estado: 'existe', cita };
        const texto = vs.filter(([n]) => n >= p.verse && n <= p.verseEnd).map(([, t]) => t).join(' ');
        if (comparar(cita.frase, texto) !== 'distinta') return { estado: 'bien', cita, version };
      }
      if (!alguno) return { estado: 'existe', cita }; // sin conexión ni texto: no se puede decir nada
      // No está en el pasaje: ¿quizá en uno de al lado? Si no, se enseña lo que dice de verdad.
      for (const version of versiones) {
        const vs = await leer(p.book, p.chapter, version);
        const vecino = vs?.find(([n, t]) => (n < p.verse || n > p.verseEnd) && n >= p.verse - 3 && n <= p.verseEnd + 3 && comparar(cita.frase!, t) !== 'distinta');
        if (vecino) return { estado: 'otro-versiculo', cita, verso: vecino[0], version };
      }
      const texto = alguno.vs.filter(([n]) => n >= p.verse && n <= p.verseEnd).map(([, t]) => t).join(' ');
      return { estado: 'no-coincide', cita, texto, version: alguno.version };
    }),
  );
}

export const esProblema = (r: Revision) => r.estado === 'no-existe' || r.estado === 'no-coincide' || r.estado === 'otro-versiculo';

export const refDe = (p: Pasaje) => `${p.book}.${p.chapter}.${p.verse}` + (p.verseEnd > p.verse ? `-${p.book}.${p.chapter}.${p.verseEnd}` : '');
