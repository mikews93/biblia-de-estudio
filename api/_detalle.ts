// Más fuentes para el estudio profundo (pedido de Mike, 2026-11-08: «hacerlo aún más detallado»). Además del texto,
// el original, las referencias de OpenBible, los comentarios y las fichas, el primer estudio recibe:
//   - los artículos del diccionario bíblico Tyndale en español que tratan el pasaje (diccionario-es/cap),
//   - el léxico de las Sociedades Bíblicas Unidas en español de las palabras del original (lexico/),
//   - las referencias del Treasury of Scripture Knowledge que OpenBible no trae (tsk/),
//   - las medidas antiguas y los objetos del capítulo que la app ya enseña en «Medidas» e «Imágenes» (contexto/).
// Las costumbres (Edersheim, Josefo), los temas de Nave y Torrey y la doctrina los busca la IA con sus herramientas
// antes de escribir (api/estudiar.ts, PROFUNDO_SYSTEM). El guion bajo hace que Vercel no la publique como función.

import { TYNDALE, textoTyndale } from './_diccionario';
import { Biblia, Block, Book, Word, firstWords } from './_investigar';
import { leerJson } from './_teologia';
import { type EntradaLexico, type FilaDiccionario, LEXICO_UBS, claveLexico, sentidoEn, vecesSentido } from '../src/lib/fuentesAbiertas';

export type Fuente = { title: string; blocks: Block[] };

const DATA = (process.env.DATA_DIR as string | undefined) ?? undefined;
const leer = <T>(request: Request, rel: string) => leerJson<T>(request, 'data', rel, DATA);

// Palabras por artículo del diccionario: el estudio de un versículo va más a fondo, el de un capítulo trae más temas.
const DICC = { verso: { max: 5, palabras: 260 }, capitulo: { max: 7, palabras: 170 } };
// Palabras del original con su entrada del léxico. Las muy frecuentes («y», «el», «decir») no aportan.
const LEXICO = { verso: 10, capitulo: 8, frecuente: 1500 };
const TSK = { verso: 10, capitulo: 14 };

// Lo que más ayuda a entender el pasaje va primero: costumbres y objetos, términos clave, grupos; luego lugares y
// personas (que también tienen ficha).
const PRIORIDAD: Record<string, number> = { realia: 0, keyterm: 1, group: 2, flora: 3, fauna: 3, deity: 4, place: 5, person: 6 };

/** Los artículos de Tyndale del pasaje: los de ese versículo o los que más se repiten en el capítulo. */
export async function diccionarioDelPasaje(biblia: Biblia, book: Book, chapter: number, verse?: number): Promise<Fuente | null> {
  const cap = await leer<Record<string, FilaDiccionario[]>>(biblia.request, `diccionario-es/cap/${book.id}/${chapter}.json`);
  if (!cap) return null;
  // En un versículo, primero sus artículos y luego los de los dos de cada lado (el incienso de Lucas 1:10 explica 1:9).
  const filas = verse ? [0, -1, 1, -2, 2].flatMap((d) => cap[verse + d] ?? []) : Object.values(cap).flat();
  const veces = new Map<string, { fila: FilaDiccionario; n: number; primero: number }>();
  filas.forEach((f, i) => {
    const v = veces.get(f[0]);
    if (v) v.n++;
    else veces.set(f[0], { fila: f, n: 1, primero: i });
  });
  const { max, palabras } = verse ? DICC.verso : DICC.capitulo;
  const elegidos = [...veces.values()]
    .sort((a, b) =>
      verse
        ? a.primero - b.primero
        : (PRIORIDAD[a.fila[2]] ?? 5) - (PRIORIDAD[b.fila[2]] ?? 5) || b.n - a.n || a.primero - b.primero,
    )
    .slice(0, max);
  const articulos = await Promise.all(
    elegidos.map(({ fila: [id] }) => leer<{ t: string; x: string }>(biblia.request, `diccionario-es/a/${id}.json`)),
  );
  const blocks = articulos.flatMap((a) => {
    if (!a?.t || !a.x) return [];
    const meta = { label: `${TYNDALE.corto}, «${a.t}»`, url: TYNDALE.url, nota: TYNDALE.nota };
    return firstWords(textoTyndale(a.x, biblia.books), palabras).map((text, i) => ({ text: i ? text : `${a.t}: ${text}`, meta }));
  });
  if (!blocks.length) return null;
  return {
    title: `${TYNDALE.corto} (moderno, evangélico, en español): artículos sobre ${book.name} ${chapter}${verse ? `:${verse}` : ''}`,
    blocks,
  };
}

/**
 * ¿Sustantivo, verbo o adjetivo? Las preposiciones, conjunciones, artículos y partículas no aportan al estudio.
 * Griego (Robinson): «N-GSM», «V-AAI-3S», «A-NSN». Hebreo (STEPBible): «HNcmpa», «HR/Ncfsa», «HVqp3ms».
 */
export function contenido(morph: string): boolean {
  if (/^[HA][A-Z][a-z]/.test(morph) || morph.includes('/')) {
    const partes = morph.split('/');
    const ultima = partes.length === 1 ? morph.slice(1) : partes[partes.length - 1];
    return /^(?:Nc|V|A)/.test(ultima);
  }
  // Los nombres propios de personas (-P) y lugares (-L) ya tienen ficha y diccionario.
  return /^(?:N|V|A)-/.test(morph) && !/^N-PRI|^N-.*-[PL]$/.test(morph);
}

/**
 * El léxico UBS (en español) de las palabras del original: todas las de un versículo, o en un capítulo las que se
 * repiten o pesan más, con el sentido que UBS marca en ese pasaje.
 */
export async function lexicoDelPasaje(
  biblia: Biblia,
  book: Book,
  chapter: number,
  verse: number | undefined,
  interlinear: Record<string, Word[]>,
): Promise<Fuente | null> {
  const usos = new Map<string, { verso: number; lema: string; n: number }>();
  for (const [v, words] of Object.entries(interlinear)) {
    if (verse && Number(v) !== verse) continue;
    for (const w of words) {
      const k = claveLexico(w[6] ?? '');
      if (!k || !contenido(w[7] ?? '')) continue;
      const u = usos.get(k);
      if (u) u.n++;
      else usos.set(k, { verso: Number(v), lema: w[4], n: 1 });
    }
  }
  const claves = [...usos.keys()];
  const entradas = await Promise.all(claves.map((k) => leer<EntradaLexico[]>(biblia.request, `lexico/${k}.json`)));
  const candidatos = claves.flatMap((k, i) => {
    const e = Array.isArray(entradas[i]) ? entradas[i]![0] : undefined;
    if (!e?.s?.length) return [];
    const total = e.s.reduce((n, s) => n + vecesSentido(s), 0);
    // Las palabras de función («y», «hacia», «no»): UBS las define como «marcador de…» y no aportan al estudio.
    if (total > LEXICO.frecuente || e.s.every((x) => /^\(?[^)]*\)?\s*marcador\b/i.test(x[1]))) return [];
    const u = usos.get(k)!;
    const marcado = sentidoEn(e.s, book.id, chapter, u.verso);
    return [{ k, e, u, total, sentido: e.s[marcado >= 0 ? marcado : 0], marcado: marcado >= 0 }];
  });
  // En un capítulo pesan las que se repiten en él y las raras en la Biblia, que dicen más de este pasaje.
  const peso = (c: (typeof candidatos)[number]) => c.u.n * Math.log(4000 / (c.total + 1));
  const elegidos = verse ? candidatos.slice(0, LEXICO.verso) : candidatos.sort((a, b) => peso(b) - peso(a)).slice(0, LEXICO.capitulo);
  if (!elegidos.length) return null;
  const blocks = elegidos.map(({ k, e, u, total, sentido, marcado }) => {
    const [glosas, definicion, comentario] = sentido;
    const donde = verse ? '' : ` (${u.n === 1 ? `v. ${u.verso}` : `${u.n} veces en el capítulo`})`;
    const texto = [
      `${e.l} (${k})${donde}: «${glosas.join('», «')}»${marcado ? ', el sentido que tiene en este pasaje' : ''}.`,
      limpiar(definicion),
      limpiar(comentario),
      `${total} apariciones en la Biblia.`,
    ]
      .filter(Boolean)
      .join(' ');
    return { text: texto, meta: { label: `Léxico UBS, ${e.l}`, url: LEXICO_UBS.url, nota: 'Sociedades Bíblicas Unidas · 2023 · CC BY-SA 4.0' } };
  });
  return { title: `${LEXICO_UBS.nombre} (en español): las palabras del original de ${book.name} ${chapter}${verse ? `:${verse}` : ''}`, blocks };
}

// Algunas definiciones de UBS traen restos de su numeración pegados al final («negativas001»).
const limpiar = (t: string) => (t ?? '').replace(/([^\d\s])\d{3}\b/g, '$1').trim();

/** Las referencias del Treasury que no están ya entre las de OpenBible, con su texto. */
export async function treasuryDelPasaje(biblia: Biblia, book: Book, chapter: number, verse: number | undefined, ya: string[]): Promise<Fuente | null> {
  const tsk = await leer<Record<string, string[]>>(biblia.request, `tsk/${book.id}/${chapter}.json`);
  if (!tsk) return null;
  const vistas = new Set(ya.map((r) => r.split('-')[0]));
  // En un capítulo, las que apuntan al mismo capítulo no aportan: ya está entero en los documentos.
  const mismo = `${book.id}.${chapter}.`;
  const refs = (verse ? (tsk[verse] ?? []) : Object.values(tsk).flatMap((l) => l.filter((r) => !r.startsWith(mismo)).slice(0, 1))).filter((r) => {
    const k = r.split('-')[0];
    if (vistas.has(k) || k.startsWith(mismo)) return false;
    vistas.add(k);
    return true;
  });
  const elegidas = refs.slice(0, verse ? TSK.verso : TSK.capitulo);
  const blocks = (
    await Promise.all(
      elegidas.map(async (r): Promise<Block | null> => {
        const text = await biblia.refText(r).catch(() => '');
        const label = biblia.label(r);
        return text ? { text: `${label}: ${text}`, meta: { label, ref: r } } : null;
      }),
    )
  ).filter((b): b is Block => !!b);
  if (!blocks.length) return null;
  return { title: `Más referencias de ${book.name} ${chapter}${verse ? `:${verse}` : ''} (Treasury of Scripture Knowledge, 1836)`, blocks };
}

type Contexto = {
  medidas?: { id: string; name: string; kind: string; value: string; note: string; verses: number[] }[];
  imagenes?: { id: string; kind: string; title: string; caption: string; verses: number[] }[];
};

/** Las medidas antiguas y los objetos del capítulo que la app enseña en el estudio (pipeline/medidas.py, imagenes.py). */
export async function contextoDelPasaje(biblia: Biblia, book: Book, chapter: number, verse?: number): Promise<Fuente | null> {
  const c = await leer<Contexto>(biblia.request, `contexto/${book.id}/${chapter}.json`);
  if (!c) return null;
  const aqui = (vs: number[]) => !verse || vs.includes(verse);
  const meta = { label: `Medidas y objetos de ${book.name} ${chapter} (la app)`, nota: 'Valores aproximados de los diccionarios bíblicos; variaban según la época y la región' };
  const blocks: Block[] = [
    ...(c.medidas ?? []).filter((m) => aqui(m.verses)).map((m) => ({ text: `${m.name} (${m.kind.toLowerCase()}, v. ${m.verses.join(', ')}): ${m.value}. ${m.note}`, meta })),
    ...(c.imagenes ?? [])
      .filter((i) => i.kind === 'objeto' && aqui(i.verses))
      .map((i) => ({ text: `${i.title} (v. ${i.verses.join(', ')}): ${i.caption}`, meta })),
  ];
  return blocks.length ? { title: `Medidas antiguas y objetos de ${book.name} ${chapter} (la app los enseña con imágenes)`, blocks } : null;
}

/** Todas las fuentes de más del estudio profundo; las que fallan se dejan fuera (son una ayuda, no un requisito). */
export async function fuentesDetalladas(
  biblia: Biblia,
  book: Book,
  chapter: number,
  verse: number | undefined,
  interlinear: Record<string, Word[]>,
  refsOpenBible: string[],
): Promise<Fuente[]> {
  const todas = await Promise.all([
    diccionarioDelPasaje(biblia, book, chapter, verse),
    lexicoDelPasaje(biblia, book, chapter, verse, interlinear),
    treasuryDelPasaje(biblia, book, chapter, verse, refsOpenBible),
    contextoDelPasaje(biblia, book, chapter, verse),
  ].map((p) =>
    p.catch((err) => {
      console.error('estudiar: fuentes del estudio profundo', err);
      return null;
    }),
  ));
  return todas.filter((f): f is Fuente => !!f);
}
