// Búsqueda tradicional por palabras (BM25) sobre los versículos de una versión. No necesita red ni IA: la usa el
// teléfono sin conexión y también el servidor, que la mezcla con la búsqueda semántica (api/semantica.ts).
// Sin tildes, sin mayúsculas, con las grafías antiguas de la RV1909 igualadas («mugeres», «á») y por raíz de la palabra
// («perdonar» encuentra «perdonad», «perdón» y «perdonados»). Unas palabras seguidas tal como se escribieron suman más,
// para que un fragmento recordado («todo lo puedo en Cristo») encuentre su versículo primero.

export type Doc = { ref: string; text: string };
/** «phrase»: la parte de las palabras seguidas de la consulta que aparecen igual en el versículo (0 a 1). */
export type Hit = { ref: string; score: number; phrase?: number };

// Palabras tan frecuentes que no ayudan a encontrar nada. Se quitan de la consulta, no del texto (cuentan en las frases).
const STOP = new Set(
  (
    'a al algo ante antes como con contra cual cuando de del desde donde e el ella ellas ellos en entre era es esa ese eso esta este esto fue ha han hay la las le les lo los me mi mis muy nos o os para pero por que quien se si sin sobre son su sus te ti tu tus un una uno unos y ya yo ' +
    'quiero busco versiculo versiculos pasaje pasajes biblia biblico habla hablan dice dicen sobre acerca tema'
  ).split(' '),
);

/** Minúsculas, sin tildes ni diéresis, y las grafías antiguas igualadas a las de hoy. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/g(?=[ei])/g, 'j'); // RV1909: «mugeres», «muger» → «mujeres»; «ángel» → «anjel» (igual en el texto y en la consulta)
}

export const words = (text: string) => normalize(text).match(/[a-z0-9]+/g) ?? [];

/** Raíz aproximada en español: quita plurales, terminaciones verbales comunes y la vocal final. */
export function stem(w: string): string {
  if (w.length <= 3) return w;
  let s = w;
  // Plural: «mujeres» → «mujer», «piedras» → «piedra»
  if (/[^aeiou]es$/.test(s) && s.length > 5) s = s.slice(0, -2);
  else if (s.endsWith('s') && s.length > 4) s = s.slice(0, -1);
  for (const suf of ['amente', 'mente', 'acion', 'imiento', 'idad', 'ado', 'ada', 'ido', 'ida', 'ando', 'iendo', 'aron', 'ieron', 'aba', 'aban', 'ar', 'er', 'ir', 'ad', 'ed', 'id']) {
    if (s.endsWith(suf) && s.length - suf.length >= 3) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  if (s.length > 3 && /[aeio]$/.test(s)) s = s.slice(0, -1);
  return s;
}

const K1 = 1.2;
const B = 0.75;

export class WordIndex {
  readonly docs: Doc[];
  private plain: string[];
  private postings = new Map<string, [number, number][]>(); // raíz → [versículo, veces]
  private lengths: Uint16Array;
  private avg: number;
  private byRef: Map<string, string> | null = null;

  constructor(docs: Doc[]) {
    this.docs = docs;
    this.plain = new Array(docs.length);
    this.lengths = new Uint16Array(docs.length);
    let total = 0;
    const stems = new Map<string, string>(); // cada palabra distinta se reduce a su raíz una sola vez
    docs.forEach((d, i) => {
      const ws = words(d.text);
      this.plain[i] = ` ${ws.join(' ')} `;
      this.lengths[i] = ws.length;
      total += ws.length;
      const counts = new Map<string, number>();
      for (const w of ws) {
        let s = stems.get(w);
        if (s === undefined) stems.set(w, (s = stem(w)));
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
      for (const [s, n] of counts) {
        let list = this.postings.get(s);
        if (!list) this.postings.set(s, (list = []));
        list.push([i, n]);
      }
    });
    this.avg = total / Math.max(1, docs.length);
  }

  /** El texto de un versículo del índice. */
  text(ref: string): string {
    this.byRef ??= new Map(this.docs.map((d) => [d.ref, d.text]));
    return this.byRef.get(ref) ?? '';
  }

  /** Los mejores versículos para la consulta, del más al menos parecido. */
  search(query: string, limit = 30, keep?: (doc: Doc) => boolean): Hit[] {
    const qs = words(query);
    const terms = [...new Set(qs.filter((w) => !STOP.has(w)).map(stem))];
    if (!terms.length) return [];
    const n = this.docs.length;
    const scores = new Map<number, number>();
    const matched = new Map<number, number>();
    for (const t of terms) {
      const list = this.postings.get(t);
      if (!list) continue;
      const idf = Math.log(1 + (n - list.length + 0.5) / (list.length + 0.5));
      for (const [i, tf] of list) {
        const norm = tf * (K1 + 1) / (tf + K1 * (1 - B + (B * this.lengths[i]) / this.avg));
        scores.set(i, (scores.get(i) ?? 0) + idf * norm);
        matched.set(i, (matched.get(i) ?? 0) + 1);
      }
    }
    // Las palabras seguidas de la consulta (de dos en dos, con las pequeñas incluidas) que aparecen igual en el versículo
    const pairs = qs.slice(1).map((w, i) => ` ${qs[i]} ${w} `);
    const hits: Hit[] = [];
    for (const [i, base] of scores) {
      if (keep && !keep(this.docs[i])) continue;
      let score = base * (0.5 + (0.5 * (matched.get(i) ?? 0)) / terms.length);
      const phrase = pairs.length ? pairs.filter((p) => this.plain[i].includes(p)).length / pairs.length : 0;
      score *= 1 + phrase;
      hits.push({ ref: this.docs[i].ref, score, phrase });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

/** Mezcla listas ordenadas (Reciprocal Rank Fusion): sube lo que sale arriba en varias. */
export function fuse(lists: { refs: string[]; weight?: number }[], k = 60): string[] {
  const score = new Map<string, number>();
  for (const { refs, weight = 1 } of lists)
    refs.forEach((r, i) => score.set(r, (score.get(r) ?? 0) + weight / (k + i + 1)));
  return [...score].sort((a, b) => b[1] - a[1]).map(([r]) => r);
}

/** Parte de las palabras seguidas que tiene que coincidir para tomar la búsqueda como un fragmento recordado. */
const PHRASE = 0.6;

/**
 * Búsqueda por palabras en varias versiones a la vez, mezclada (la que lee la persona pesa más), con el fragmento
 * recordado casi palabra por palabra (en cualquier versión, desde 4 palabras) primero.
 */
export function searchVersions(versions: { id: string; index: WordIndex }[], query: string, reading?: string, limit = 40): string[] {
  const lists = versions.map(({ id, index }) => ({ id, hits: index.search(query, limit) }));
  const refs = fuse(lists.map(({ id, hits }) => ({ refs: hits.map((h) => h.ref), weight: id === reading ? 1.5 : 1 })));
  return pinRecalled(refs, query, lists, reading);
}

/** Pone primero el fragmento recordado (si lo hay) en una lista ya mezclada con otras búsquedas. */
export function pinRecalled(refs: string[], query: string, lists: { id: string; hits: Hit[] }[], reading?: string): string[] {
  const best = recalled(query, lists, reading);
  return best ? [best, ...refs.filter((r) => r !== best)] : refs;
}

/** El versículo del que viene un fragmento recordado casi palabra por palabra (desde 4 palabras), o null. */
export function recalled(query: string, lists: { id: string; hits: Hit[] }[], reading?: string): string | null {
  if (words(query).length < 4) return null;
  const best = lists
    .flatMap(({ id, hits }) => hits.slice(0, 5).map((h) => ({ ...h, mine: id === reading })))
    .filter((h) => (h.phrase ?? 0) >= PHRASE)
    .sort((a, b) => (b.phrase ?? 0) - (a.phrase ?? 0) || Number(b.mine) - Number(a.mine) || b.score - a.score)[0];
  return best?.ref ?? null;
}
