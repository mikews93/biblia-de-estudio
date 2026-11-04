// Corrige las citas bíblicas de una respuesta de la IA antes de enseñarla y guardarla (api/estudiar.ts), para que
// nadie vea una referencia equivocada ni un versículo inventado. Mike lo pidió el 2026-11-04: no basta con avisar.
// 1. Lo que se puede arreglar con el texto de la Biblia se arregla solo: la frase está en el versículo de al lado, en
//    otro sitio del capítulo o de la Biblia (se cambia la referencia), o el versículo no existe (se cita el capítulo).
// 2. Lo que queda se lo pasa a la IA con lo que dice de verdad cada pasaje, para que reescriba solo esas frases.
// 3. Si aun así queda algo, la frase deja de presentarse como cita: se quitan las comillas y la referencia.
// Sin dependencias de React Native.

import type { Source } from './estudio';
import {
  buscarCitas,
  comparar,
  type CitaEncontrada,
  esProblema,
  normalizar,
  type Pasaje,
  type Revision,
  revisarCitas,
} from './verificarCitas';

type Libro = { id: string; name: string; abbr: string; chapters: number };
type Capitulo = [number, string, ...unknown[]][];
type LeerCapitulo = (book: string, chapter: number, version: string) => Promise<Capitulo>;

/** Un cambio pedido a la IA: el fragmento exacto de la respuesta y lo que va en su lugar. */
export type Reemplazo = { de: string; a: string };
/** Lo que se le cuenta a la IA de cada cita que no cuadra. */
export type Problema = { cita: string; frase?: string; motivo: string; texto?: string };

export type Opciones = {
  books: Libro[];
  sources?: Source[];
  leer: LeerCapitulo;
  /** Versiones con que se compara (la de la respuesta y la RV1909). */
  versiones: string[];
  /** Busca la frase en toda la Biblia (en el servidor, que tiene la RV1909 a mano). */
  buscar?: (frase: string) => Promise<Pasaje | null>;
  /** Pide a la IA que reescriba las frases que no se pudieron arreglar solas. */
  reparar?: (texto: string, problemas: Problema[]) => Promise<Reemplazo[]>;
};

export const etiqueta = (p: Pasaje, books: Libro[]) => {
  const nombre = books.find((b) => b.id === p.book)?.name ?? p.book;
  return `${nombre} ${p.chapter}:${p.verse}${p.verseEnd > p.verse ? `-${p.verseEnd}` : ''}`;
};

type Cambio = { at: number; fin: number; a: string };

/** Aplica cambios por posición, de atrás hacia delante para no mover los que faltan. Ignora los que se pisan. */
function aplicar(texto: string, cambios: Cambio[]) {
  const orden = [...cambios].sort((a, b) => b.at - a.at);
  let out = texto;
  let limite = Infinity;
  for (const c of orden) {
    if (c.fin > limite) continue;
    out = out.slice(0, c.at) + c.a + out.slice(c.fin);
    limite = c.at;
  }
  return out;
}

/** Dónde está la frase en el capítulo: un versículo o un tramo de hasta tres seguidos. Lo «igual» gana a lo «casi». */
async function enCapitulo(frase: string, book: string, chapter: number, versiones: string[], leer: LeerCapitulo): Promise<Pasaje | null> {
  let casi: Pasaje | null = null;
  for (const version of versiones) {
    const vs = await leer(book, chapter, version).catch(() => null);
    if (!vs?.length) continue;
    for (let largo = 1; largo <= 3; largo++) {
      for (let i = 0; i + largo <= vs.length; i++) {
        const tramo = vs.slice(i, i + largo);
        const r = comparar(frase, tramo.map(([, t]) => t).join(' '));
        if (r === 'distinta') continue;
        const p = { book, chapter, verse: tramo[0][0], verseEnd: tramo[largo - 1][0] };
        if (r === 'igual') return p;
        casi ??= p;
      }
      if (casi) return casi;
    }
  }
  return casi;
}

/** Los sitios de una cita escrita (no las marcas ⟦n⟧). */
const escritas = (c: CitaEncontrada) => (c.en ?? []).filter((d) => !d.marca);

/** El arreglo con el texto de la Biblia, si lo hay: la referencia nueva en cada sitio donde está escrita. */
async function arregloSolo(r: Revision, o: Opciones): Promise<Cambio[]> {
  const sitios = escritas(r.cita);
  if (!sitios.length) return []; // una fuente ⟦n⟧: su pasaje lo puso la herramienta, no se cambia
  const poner = (p: Pasaje) => sitios.map((d) => ({ at: d.at, fin: d.fin, a: etiqueta(p, o.books) }));
  const p = r.cita.pasaje;
  if (r.estado === 'otro-versiculo') return poner({ ...p, verse: r.verso, verseEnd: r.verso });
  if (r.estado === 'no-existe') {
    // Un versículo que no existe: se cita el capítulo; un capítulo que no existe: el libro.
    const libro = o.books.find((b) => b.id === p.book);
    if (!libro) return [];
    const a = p.chapter <= libro.chapters ? `${libro.name} ${p.chapter}` : libro.name;
    return sitios.map((d) => ({ at: d.at, fin: d.fin, a }));
  }
  if (r.estado === 'no-coincide' && r.cita.frase) {
    const otro = (await enCapitulo(r.cita.frase, p.book, p.chapter, o.versiones, o.leer)) ?? (await o.buscar?.(r.cita.frase).catch(() => null)) ?? null;
    if (otro) return poner(otro);
  }
  return [];
}

/**
 * Si nada lo arregla, la frase sale de la respuesta: se quita la oración que la tiene. Unas palabras que no están en
 * la Biblia no pueden quedar presentadas como suyas, ni con comillas ni sin ellas.
 */
function quitarOracion(r: Revision, texto: string): Cambio[] {
  return (r.cita.en ?? []).flatMap((d): Cambio[] => {
    const [ini, fin] = d.comillas ?? [d.at, d.fin];
    let at = ini;
    while (at > 0 && !/[.!?\n]/.test(texto[at - 1])) at--;
    let hasta = fin;
    while (hasta < texto.length && texto[hasta] !== '\n' && !/[.!?]/.test(texto[hasta])) hasta++;
    if (/[.!?]/.test(texto[hasta] ?? '')) hasta++;
    while (at < ini && texto[at] === ' ') at++;
    return [{ at, fin: hasta, a: '' }];
  });
}

async function revisar(texto: string, o: Opciones) {
  const citas = buscarCitas(texto, o.books, o.sources ?? []);
  if (!citas.length) return [];
  const nombre = (id: string) => o.books.find((b) => b.id === id)?.name ?? id;
  return (await revisarCitas(citas, o.leer, o.versiones, nombre)).filter(esProblema);
}

function problemaDe(r: Revision, books: Libro[]): Problema {
  const cita = r.cita.texto;
  switch (r.estado) {
    case 'no-existe':
      return { cita, motivo: `Ese pasaje no existe (${r.detalle})` };
    case 'otro-versiculo':
      return { cita, frase: r.cita.frase, motivo: `Esas palabras están en ${etiqueta({ ...r.cita.pasaje, verse: r.verso, verseEnd: r.verso }, books)}` };
    case 'no-coincide':
      return { cita, frase: r.cita.frase, motivo: 'El pasaje no dice esas palabras', texto: r.texto };
    default:
      return { cita, motivo: '' };
  }
}

/**
 * Devuelve la respuesta con sus citas corregidas y una nota por cambio (para los registros). Si todo estaba bien,
 * devuelve el mismo texto.
 */
export async function corregirCitas(texto: string, o: Opciones): Promise<{ texto: string; cambios: string[] }> {
  const cambios: string[] = [];
  let problemas = await revisar(texto, o);
  if (!problemas.length) return { texto, cambios };

  // 1. Con el texto de la Biblia
  const solos: Cambio[] = [];
  for (const r of problemas) {
    const c = await arregloSolo(r, o);
    if (c.length) cambios.push(`${r.cita.texto} → ${c[0].a}`);
    solos.push(...c);
  }
  if (solos.length) {
    texto = aplicar(texto, solos);
    problemas = await revisar(texto, o);
  }

  // 2. Con la IA, solo las citas con una referencia escrita: las comillas junto a una fuente ⟦n⟧ pueden ser otra cosa
  // (la pregunta de la persona, una palabra) y ni se avisan ni se quitan. Cada fragmento que devuelve tiene que estar
  // tal cual y una sola vez en la respuesta.
  const paraIA = problemas.filter((r) => escritas(r.cita).length);
  if (paraIA.length && o.reparar) {
    const pedidos = await o.reparar(texto, paraIA.map((r) => problemaDe(r, o.books))).catch(() => [] as Reemplazo[]);
    let nuevo = texto;
    for (const { de, a } of pedidos) {
      if (!de || de === a) continue;
      const at = nuevo.indexOf(de);
      if (at < 0 || nuevo.indexOf(de, at + 1) >= 0) continue;
      nuevo = nuevo.slice(0, at) + a + nuevo.slice(at + de.length);
      cambios.push(`IA: ${de.slice(0, 60)} → ${a.slice(0, 60)}`);
    }
    if (nuevo !== texto) {
      texto = nuevo;
      problemas = await revisar(texto, o);
    }
  }

  // 3. Lo que quede con una referencia escrita sale de la respuesta. Las comillas junto a una fuente ⟦n⟧ se quedan:
  // el pasaje lo trajo la herramienta y lo citado puede ser otra cosa (la pregunta de la persona, una palabra).
  const quedan = problemas.filter((r) => escritas(r.cita).length);
  if (quedan.length) {
    texto = aplicar(texto, quedan.flatMap((r) => quitarOracion(r, texto)))
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
    quedan.forEach((r) => cambios.push(`quitada: ${r.cita.texto}`));
  }
  return { texto, cambios };
}

/** Busca la frase en todos los capítulos dados (el servidor le pasa la RV1909 completa). La primera que coincide. */
export async function buscarEnBiblia(
  frase: string,
  books: Libro[],
  leer: (book: string, chapter: number) => Promise<Capitulo>,
): Promise<Pasaje | null> {
  // Un filtro rápido: el versículo tiene que tener la palabra más larga de la frase.
  const clave = normalizar(frase)
    .split(' ')
    .sort((a, b) => b.length - a.length)[0];
  if (!clave || clave.length < 4) return null;
  let casi: Pasaje | null = null;
  for (const b of books) {
    for (let ch = 1; ch <= b.chapters; ch++) {
      const vs = await leer(b.id, ch).catch(() => null);
      if (!vs) continue;
      for (let i = 0; i < vs.length; i++) {
        if (!normalizar(vs[i][1]).includes(clave)) continue;
        // El versículo solo, o con el siguiente si la frase sigue en él
        for (const largo of [1, 2]) {
          const tramo = vs.slice(i, i + largo);
          const r = comparar(frase, tramo.map(([, t]) => t).join(' '));
          if (r === 'distinta') continue;
          const p = { book: b.id, chapter: ch, verse: tramo[0][0], verseEnd: tramo[tramo.length - 1][0] };
          if (r === 'igual') return p;
          casi ??= p;
          break;
        }
      }
    }
  }
  return casi;
}
