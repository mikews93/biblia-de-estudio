// «¿Por qué difieren las versiones?»: dónde dicen algo distinto las versiones de un versículo y qué palabra griega o
// hebrea hay detrás de cada diferencia. Todo se calcula aquí, sin IA: cada palabra española se une a la palabra del
// interlineal cuya glosa se le parece, y las diferencias se agrupan por esa palabra original. Así ningún texto con
// derechos (NBLA, NVI…) sale del teléfono.

import type { Word } from './data';
import { notaPalabra } from './notasPalabras';

/** Diferencias entre manuscritos de un versículo del NT (pipeline/build_data.py, variantes/<libro>/<cap>.json). */
export type VerseVariants = {
  /** Posiciones en el interlineal de las palabras que solo tiene el texto tradicional (Textus Receptus). */
  tr: number[];
  /** Palabras que solo tiene el texto crítico: [griego, transliteración, glosa, posición tras la que van]. */
  na: [string, string, string, number][];
};

export type Rendering = { text: string; versions: string[] };

export type Difference = {
  /**
   * palabra: la misma palabra original dicha de otra forma. tradicional / critico: los manuscritos no coinciden
   * (palabras solo del Texto Recibido o solo de los más antiguos). versiculo: el versículo entero es del Texto Recibido.
   */
  kind: 'palabra' | 'tradicional' | 'critico' | 'versiculo';
  /** Posiciones en el interlineal (vacío en «critico», cuyas palabras no están en el interlineal). */
  words: number[];
  /** Palabras originales que se muestran: [original, transliteración, glosa]. */
  original: [string, string, string][];
  strong: string | null;
  /** Cómo lo dice cada versión, agrupadas las que coinciden; text vacío: esa versión no lo incluye. */
  renderings: Rendering[];
  /** Explicación breve y neutral. */
  note: string;
};

export type VersionText = { id: string; abbr: string; text: string };

const STOP = new Set(
  (
    'el la los las lo un una unos unas de del al a á en y e o u que se su sus mi mis tu tus le les me te nos os con ' +
    'por para ni como pues mas es son fue era ha han he sea este esta estos estas ese esa esos esas aquel aquella ' +
    'él ella ellos ellas yo tú usted ustedes nosotros vosotros cual cuál cuales qué quien quién cuando sobre entre ' +
    'muy ya sin hasta desde porque sino pero también tan hay está están estaba nuestro nuestra nuestros nuestras ' +
    'vuestro vuestra vuestros vuestras suyo suya suyos suyas tuyo tuya tuyos tuyas mío mía míos mías'
  )
    .split(' ')
    .map((w) => norm(w)),
);

/** Palabra sin tildes, mayúsculas ni signos (la misma regla que src/lib/comparar.ts). */
export function norm(w: string) {
  return w
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\p{Lm}|[^\p{L}\p{N}]/gu, '');
}

const isStop = (w: string) => !w || STOP.has(w);

/**
 * Cuánto se parecen dos palabras españolas: 3 iguales, 2 de la misma raíz («perezca» y «perecer»), 1 quizá
 * («único» y «unigénito», «malo» y «maligno»), 0 nada.
 */
export function similar(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (isStop(a) || isStop(b)) return 0;
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  const short = Math.min(a.length, b.length);
  if (p >= 5 || (p >= 4 && short <= 6)) return 2;
  return p >= 3 && short >= 4 ? 1 : 0;
}

/** Sustantivo, verbo, adjetivo o adverbio (no artículos, preposiciones, conjunciones, pronombres ni partículas). */
export function isContent(word: Word) {
  const morph = word[7] ?? '';
  if (/^H/.test(morph)) return morph.slice(1).split('/').some((s) => /^[NVAD]/.test(s));
  return /^(N-|V-|A-|ADV)/.test(morph);
}

type Token = { raw: string; n: string };

const tokenize = (text: string): Token[] => (text.match(/\S+/g) ?? []).map((raw) => ({ raw, n: norm(raw) }));

/** Texto de un versículo que no dice nada (algunas versiones marcan así un versículo que no incluyen: «]]»). */
export const isEmptyVerse = (text: string | null | undefined) => !text || !tokenize(text).some((t) => t.n);

/**
 * Une cada palabra española con la palabra original cuya glosa se le parece; si varias se parecen igual, la que está
 * en una posición parecida dentro del versículo. -1: ninguna (artículos, palabras añadidas…).
 */
export function alignToOriginal(tokens: Token[], words: Word[]): number[] {
  // Glosa del interlineal, transliteración («Elohim») y equivalentes conocidos («Jehová», «Yahvé», «Señor»…)
  const glosses = words.map((w) =>
    [...(w[2] ?? '').split(/\s+/), w[1] ?? '', ...(EQUIVALENTES[strongKey(w[6] ?? '')] ?? [])].map(norm).filter(Boolean),
  );
  return tokens.map((t, i) => {
    if (isStop(t.n)) return -1;
    let best = -1;
    let bestScore = 0;
    words.forEach((_, j) => {
      const s = Math.max(0, ...glosses[j].map((g) => similar(t.n, g)));
      const far = Math.abs(i / Math.max(1, tokens.length) - j / Math.max(1, words.length));
      // Un parecido dudoso solo vale si la palabra está más o menos en el mismo lugar del versículo, y uno de raíz,
      // si no está en la otra punta
      if (!s || (s === 1 && far > 0.25) || (s === 2 && far > 0.45)) return;
      const score = s * 10 - far * 6;
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    });
    return best;
  });
}

/** «H3068G» → «H3068», «G26» → «G0026». */
export const strongKey = (strong: string) => {
  const m = /^([GH])0*(\d+)/.exec(strong.trim());
  return m ? `${m[1]}${m[2].padStart(4, '0')}` : '';
};

/** Formas en que las versiones españolas dicen palabras cuya glosa del interlineal es muy distinta. */
const EQUIVALENTES: Record<string, string[]> = {
  H3068: ['Jehová', 'Yahvé', 'Yavé', 'Yahveh', 'Señor', 'SEÑOR', 'Eterno'],
  H3050: ['Jah', 'Yah', 'Señor'],
  H0430: ['Dios', 'Elohim', 'dioses'],
  H0136: ['Señor', 'Adonai'],
  H2617: ['misericordia', 'misericordias', 'bondad', 'amor', 'fidelidad', 'piedad', 'gracia'],
  H7585: ['Seol', 'sepulcro', 'infierno', 'tumba', 'muerte', 'abismo'],
  H5315: ['alma', 'vida', 'persona', 'ser'],
  H7307: ['espíritu', 'viento', 'aliento'],
  G5547: ['Cristo', 'Mesías', 'Ungido', 'Jesucristo'],
  G2424: ['Jesús', 'Jesucristo'],
  G2962: ['Señor', 'amo', 'dueño'],
  G0026: ['amor', 'caridad'],
  G0025: ['amor', 'amar', 'amó', 'ama', 'aman'],
  G3439: ['unigénito', 'único'],
  G3056: ['Verbo', 'Palabra', 'palabra', 'mensaje'],
  G1577: ['iglesia', 'iglesias', 'congregación', 'comunidad', 'asamblea'],
  G1401: ['siervo', 'siervos', 'esclavo', 'esclavos'],
  G4561: ['carne', 'naturaleza'],
  G0086: ['infierno', 'Hades', 'sepulcro', 'muerte'],
  G1067: ['infierno', 'Gehena'],
  G0165: ['siglos', 'siempre', 'eternidad', 'mundo'],
};

type Hunk = { base: [number, number]; other: [number, number] };

/**
 * Tramos donde dos textos dejan de coincidir, por la subsecuencia común más larga. Solo las palabras con contenido
 * sirven de ancla: un «el» o un «que» repetido no debe partir una diferencia en dos.
 */
export function hunks(a: Token[], b: Token[]): Hunk[] {
  const A = a.map((t) => (isStop(t.n) ? '' : t.n));
  const B = b.map((t) => (isStop(t.n) ? '' : t.n));
  const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--)
      dp[i][j] = A[i] && A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Hunk[] = [];
  let i = 0;
  let j = 0;
  let open: Hunk | null = null;
  const close = () => {
    if (!open) return;
    open.base[1] = i;
    open.other[1] = j;
    const sb = a.slice(open.base[0], i).map((t) => t.n);
    const so = b.slice(open.other[0], j).map((t) => t.n);
    // Iguales salvo signos o palabras de enlace en el mismo orden: no es una diferencia
    if (sb.filter(Boolean).join(' ') !== so.filter(Boolean).join(' ')) out.push(open);
    open = null;
  };
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] && A[i] === B[j]) {
      close();
      i++;
      j++;
      continue;
    }
    open ??= { base: [i, i], other: [j, j] };
    if (j < B.length && (i >= A.length || dp[i][j + 1] >= dp[i + 1][j])) j++;
    else i++;
  }
  close();
  return out;
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, k) => from + k);

/** Palabras originales con contenido que no tienen ninguna palabra española unida, entre dos que sí la tienen. */
function between(map: number[], start: number, end: number, words: Word[], used: Set<number>): number[] {
  let lo = -1;
  for (let k = start - 1; k >= 0; k--)
    if (map[k] >= 0) {
      lo = map[k];
      break;
    }
  let hi = words.length;
  for (let k = end; k < map.length; k++)
    if (map[k] >= 0) {
      hi = map[k];
      break;
    }
  if (hi <= lo) return [];
  const free = range(lo + 1, hi).filter((w) => isContent(words[w]) && !used.has(w));
  return free.length === 1 ? free : [];
}

/**
 * Reparte las palabras de un lado de un tramo entre las palabras originales: cada una a la suya. Las que no tienen
 * ninguna van a la única que haya; si hay varias y en este lado ninguna está unida, por su lugar en el tramo
 * («El Señor» frente a «Salmo de David. JEHOVÁ»).
 */
function assign(idx: number[], tokens: Token[], map: number[], targets: number[], order: number[]): Map<number, number[]> {
  const out = new Map<number, number[]>(targets.map((w) => [w, []]));
  const anchored = idx.some((k) => targets.includes(map[k]));
  const loose = idx.filter((k) => map[k] < 0 && !isStop(tokens[k].n));
  for (const k of idx) if (targets.includes(map[k])) out.get(map[k])!.push(k);
  if (targets.length === 1) loose.forEach((k) => out.get(targets[0])!.push(k));
  else if (!anchored)
    loose.forEach((k, i) => out.get(order[Math.min(order.length - 1, Math.floor(((i + 0.5) / loose.length) * order.length))])!.push(k));
  return out;
}

const clean = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

/**
 * Texto de las palabras elegidas, con las de enlace que haya entre ellas («se pierda», «de tal manera»). Si la
 * palabra se repite en el versículo («la caridad… la caridad»), solo la primera vez.
 */
const spanText = (tokens: Token[], idx: Iterable<number>) => {
  const list = [...idx].sort((a, b) => a - b);
  if (!list.length) return '';
  const from = list[0];
  let to = from + 1;
  for (const k of list.slice(1)) if (tokens.slice(to, k).every((t) => isStop(t.n))) to = k + 1;
  return clean(
    tokens
      .slice(from, to)
      .map((t) => t.raw)
      .join(' '),
  );
};

const LANG = (words: Word[]) => (/[֐-׿]/.test(words[0]?.[0] ?? '') ? 'hebrea' : 'griega');
const MAX_WORDS = 6;

/** Versión que lo dice con otras palabras, pero no se sabe con cuáles: no se muestra en la tarjeta. */
const UNKNOWN = new Set<number>();

type Entry = {
  kind: Difference['kind'];
  words: Set<number>;
  /** Por versión, las palabras que lo dicen (vacío: no lo dice; UNKNOWN: no se sabe). La base va aparte. */
  spans: Map<string, Set<number>>;
  base: Set<number>;
};

/**
 * Las diferencias de un versículo entre la versión base (la primera) y las demás, una por palabra original. Las que
 * no se pueden unir a ninguna palabra original (orden, palabras de enlace, paráfrasis) solo se cuentan en `minor`.
 */
export function explainDifferences(
  versions: VersionText[],
  words: Word[],
  variants?: VerseVariants,
): { differences: Difference[]; minor: number } {
  const [base, ...others] = versions;
  if (!base || !words.length) return { differences: [], minor: 0 };
  const tr = new Set(variants?.tr ?? []);
  const lang = LANG(words);

  // Versículo entero que solo está en el texto tradicional (Hechos 8:37, 1 Juan 5:7…): una sola tarjeta
  if (variants && words.every((_, i) => tr.has(i))) {
    const yes = versions.filter((v) => !isEmptyVerse(v.text)).map((v) => v.abbr);
    const no = versions.filter((v) => isEmptyVerse(v.text)).map((v) => v.abbr);
    if (!no.length || !yes.length) return { differences: [], minor: 0 };
    const renderings = [
      { text: 'Incluyen el versículo', versions: yes },
      { text: '', versions: no },
    ];
    return {
      differences: [{ kind: 'versiculo', words: [], original: [], strong: null, renderings, note: explain('versiculo', lang, [], null, renderings) }],
      minor: 0,
    };
  }

  const baseTokens = tokenize(base.text);
  const baseMap = alignToOriginal(baseTokens, words);
  const baseUsed = new Set(baseMap.filter((w) => w >= 0));
  const entries = new Map<string, Entry>();
  const critico: { versions: Set<string>; spans: Map<string, Set<number>>; tokens: Map<string, Token[]> } = {
    versions: new Set(),
    spans: new Map(),
    tokens: new Map(),
  };
  const tokensOf = new Map<string, Token[]>([[base.id, baseTokens]]);
  let minor = 0;

  const entry = (key: string, kind: Difference['kind']) => {
    let e = entries.get(key);
    if (!e) {
      e = { kind, words: new Set(), spans: new Map(), base: new Set() };
      entries.set(key, e);
    }
    return e;
  };

  for (const v of others) {
    if (isEmptyVerse(v.text)) continue;
    const tokens = tokenize(v.text);
    tokensOf.set(v.id, tokens);
    const map = alignToOriginal(tokens, words);
    const used = new Set(map.filter((w) => w >= 0));
    const content = (k: number) => !isStop(tokens[k].n);
    const leftovers: number[] = [];

    for (const h of hunks(baseTokens, tokens)) {
      const sideB = range(...h.base);
      const sideO = range(...h.other);
      const found = new Set<number>();
      sideB.forEach((k) => baseMap[k] >= 0 && found.add(baseMap[k]));
      sideO.forEach((k) => map[k] >= 0 && found.add(map[k]));
      let C = [...found].filter((w) => isContent(words[w]));
      const baseHas = sideB.some((k) => !isStop(baseTokens[k].n));
      const otherHas = sideO.some(content);
      if (!C.length && baseHas) C = between(baseMap, h.base[0], h.base[1], words, baseUsed);
      if (!C.length && otherHas) C = between(map, h.other[0], h.other[1], words, used);

      if (!C.length) {
        // Palabras que solo tiene el texto crítico, dichas en esta versión y no en la base
        const na = variants?.na ?? [];
        // (por su glosa, o porque están justo donde irían: tras la palabra del original que las precede)
        const where = (after: number) => {
          const k = baseMap.lastIndexOf(after);
          return k < 0 ? -9 : k + 1;
        };
        const hit =
          !baseHas &&
          otherHas &&
          na.some(
            ([, , gloss, after]) =>
              Math.abs(where(after) - h.base[0]) <= 3 ||
              gloss
                .split(/\s+/)
                .map(norm)
                .some((g) => sideO.some((k) => tokens[k].n === g || (content(k) && similar(tokens[k].n, g) > 0))),
          );
        if (hit) {
          critico.versions.add(v.id);
          // Con las palabras de enlace de delante («¡Y somos!»), sin las de detrás
          const last = Math.max(...sideO.filter(content));
          critico.spans.set(v.id, new Set(sideO.filter((k) => k <= last && tokens[k].n)));
          critico.tokens.set(v.id, tokens);
        } else {
          if (otherHas && !baseHas) leftovers.push(...sideO.filter((k) => content(k) && map[k] < 0));
          minor++;
        }
        continue;
      }

      // Palabras del texto tradicional que esta versión no dice: diferencia de manuscritos. La versión las dice si
      // alguna palabra suya está unida a ellas, o si le sobran palabras sin unir para decirlas.
      const looseO = sideO.filter((k) => content(k) && map[k] < 0).length;
      const notTr = sideB.filter((k) => !isStop(baseTokens[k].n) && !tr.has(baseMap[k])).length;
      const saysTr = sideO.some((k) => tr.has(map[k])) || looseO > notTr;
      const missing = saysTr ? [] : C.filter((w) => tr.has(w));
      if (missing.length) {
        const key = `t:${missing[0]}`;
        const e = [...entries.entries()].find(([, x]) => x.kind === 'tradicional' && missing.some((w) => x.words.has(w)))?.[1] ?? entry(key, 'tradicional');
        missing.forEach((w) => e.words.add(w));
        // En la base, el tramo entero menos lo que dice otras palabras (en Mateo 6:13, «mal:» antes de la doxología)
        let own = sideB.filter((k) => baseMap[k] < 0 || tr.has(baseMap[k]));
        // Las primeras palabras sin unir de la base son las que esta versión sí dice con las suyas («mal» y «malo»)
        for (let n = looseO; n > 0; n--) {
          const k = own.findIndex((j) => baseMap[j] < 0 && !isStop(baseTokens[j].n));
          if (k < 0) break;
          own = own.slice(k + 1);
        }
        let start = own.findIndex((k) => tr.has(baseMap[k]));
        while (start > 0 && own[start - 1] === own[start] - 1 && baseMap[own[start - 1]] < 0) start--;
        if (start >= 0) own.slice(start).forEach((k) => e.base.add(k));
        e.spans.set(v.id, new Set());
      }
      const rest = C.filter((w) => !missing.includes(w));
      if (!rest.length) continue;
      // Orden de las palabras originales según la base (el hebreo y el griego no siguen el orden del español)
      const firstInBase = (w: number) => {
        const k = baseMap.indexOf(w);
        return k < 0 ? words.length + w : k;
      };
      const order = [...rest].sort((a, b) => firstInBase(a) - firstInBase(b));
      const looseB = sideB.filter((k) => !isStop(baseTokens[k].n) && baseMap[k] < 0).length;
      const fromO = assign(sideO, tokens, map, rest, order);
      // Cambio limpio (una palabra por otra): «unigénito» → «único», «caridad» → «amor», «se ensancha» → «tiene orgullo»
      const clean1 = rest.length === 1 && looseB <= 2 && looseO <= 3;
      for (const w of rest) {
        const e = entry(`p:${w}`, 'palabra');
        e.words.add(w);
        if (e.spans.get(v.id) === UNKNOWN) continue;
        const s = e.spans.get(v.id) ?? new Set<number>();
        const mapped = fromO.get(w)!.filter((k) => map[k] === w);
        if (mapped.length) mapped.forEach((k) => s.add(k));
        else if (clean1 || !looseO) fromO.get(w)!.forEach((k) => s.add(k));
        else {
          // No se sabe qué palabras de esta versión la dicen: mejor no mostrarla que mostrarla mal
          e.spans.set(v.id, UNKNOWN);
          continue;
        }
        e.spans.set(v.id, s);
      }
    }

    // Lo que esta versión dice en otro lugar del versículo (otro orden: «su único Hijo» frente a «su Hijo unigénito»)
    for (const [key, e] of entries) {
      let s = e.spans.get(v.id);
      if (e.kind !== 'palabra' || !s || s.size) continue;
      const w = Number(key.slice(2));
      if (s === UNKNOWN) {
        if (!map.includes(w)) continue;
        s = new Set();
        e.spans.set(v.id, s);
      }
      map.forEach((m, k) => m === w && s.add(k));
      if (s.size) continue;
      if (!leftovers.length) continue;
      const pos = Math.min(...(e.base.size ? [...e.base] : [0])) / Math.max(1, baseTokens.length);
      const near = leftovers.reduce((a, b) => (Math.abs(b / tokens.length - pos) < Math.abs(a / tokens.length - pos) ? b : a));
      if (Math.abs(near / tokens.length - pos) <= 0.2) {
        s.add(near);
        leftovers.splice(leftovers.indexOf(near), 1);
      }
    }
  }

  // Dos tarjetas de manuscritos sobre el mismo tramo de la base (cada versión lo corta distinto): una sola
  const tradicionales = [...entries.entries()].filter(([, e]) => e.kind === 'tradicional');
  for (const [key, e] of tradicionales)
    for (const [key2, f] of tradicionales) {
      if (key === key2 || !entries.has(key) || !entries.has(key2) || ![...f.base].some((k) => e.base.has(k))) continue;
      f.words.forEach((w) => e.words.add(w));
      f.base.forEach((k) => e.base.add(k));
      f.spans.forEach((s, id) => e.spans.set(id, s.size && e.spans.get(id)?.size !== 0 ? s : new Set()));
      entries.delete(key2);
    }

  const differences: Difference[] = [];
  const seen = new Set<string>();
  const manuscripts = new Set([...entries.values()].filter((e) => e.kind === 'tradicional').flatMap((e) => [...e.words]));
  for (const e of entries.values()) {
    const ws = [...e.words].sort((a, b) => a - b);
    if (e.kind === 'palabra') {
      // Ya explicada como diferencia de manuscritos, o sin una palabra de la base unida a ella: no se sabe bien
      if (manuscripts.has(ws[0]) || !baseMap.includes(ws[0])) continue;
      baseMap.forEach((m, k) => m === ws[0] && e.base.add(k));
    }
    const baseText = spanText(baseTokens, e.base);
    if (!baseText) continue;
    const byText = new Map<string, Rendering>();
    for (const v of versions) {
      const s = v.id === base.id ? null : e.spans.get(v.id);
      if (s === UNKNOWN) continue;
      const text = s ? spanText(tokensOf.get(v.id)!, s) : isEmptyVerse(v.text) ? null : baseText;
      if (text === null) continue; // la versión no tiene este versículo
      const key = norm(text.replace(/\s+/g, ''));
      const r = byText.get(key) ?? { text, versions: [] };
      r.versions.push(v.abbr);
      byText.set(key, r);
    }
    const renderings = [...byText.values()];
    if (renderings.length < 2) continue;
    // Solo las que se pueden explicar bien: una palabra dicha en pocas palabras
    if (e.kind === 'palabra' && renderings.some((r) => r.text.split(/\s+/).length > MAX_WORDS)) continue;
    const strong = e.kind === 'palabra' ? words[ws[0]][6] : null;
    if (strong) {
      if (seen.has(strong)) continue;
      seen.add(strong);
    }
    // En las de manuscritos, la frase griega entera (con artículos y conjunciones), no solo sus palabras principales
    const shown = e.kind === 'tradicional' ? range(ws[0], ws[ws.length - 1] + 1).filter((w) => tr.has(w)) : ws;
    const original = shown.map((w): [string, string, string] => [clean(words[w][0]), words[w][1], words[w][2]]);
    differences.push({ kind: e.kind, words: ws, original, strong, renderings, note: explain(e.kind, lang, original, strong, renderings) });
  }

  if (critico.versions.size) {
    const renderings: Rendering[] = [];
    const add = (text: string, abbr: string) => {
      const r = renderings.find((x) => norm(x.text) === norm(text));
      if (r) r.versions.push(abbr);
      else renderings.push({ text, versions: [abbr] });
    };
    for (const v of versions) {
      if (isEmptyVerse(v.text)) continue;
      const s = critico.spans.get(v.id);
      add(s ? spanText(critico.tokens.get(v.id)!, s) : '', v.abbr);
    }
    const original = (variants?.na ?? []).map(([o, t, g]): [string, string, string] => [clean(o), t, g]);
    differences.push({ kind: 'critico', words: [], original, strong: null, renderings, note: explain('critico', lang, original, null, renderings) });
  }

  // Primero las de manuscritos y las que tienen nota propia; después, en el orden del versículo
  const rank = (d: Difference) => (d.kind !== 'palabra' ? 0 : d.strong && notaPalabra(d.strong) ? 1 : 2);
  differences.sort((a, b) => rank(a) - rank(b) || (a.words[0] ?? 0) - (b.words[0] ?? 0));
  return { differences, minor };
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

function explain(
  kind: Difference['kind'],
  lang: string,
  original: [string, string, string][],
  strong: string | null,
  renderings: Rendering[],
): string {
  const without = renderings.filter((r) => !r.text).flatMap((r) => r.versions);
  const tradicional =
    'el Texto Recibido, el griego que tradujeron la Reina-Valera y otras versiones clásicas';
  const antiguos = 'los manuscritos más antiguos que se conocen hoy, que siguen muchas versiones modernas';
  if (kind === 'versiculo')
    return (
      `Los manuscritos griegos no coinciden en este versículo. Está en ${tradicional}, pero no en ${antiguos}. ` +
      `Por eso ${list(without)} ${without.length > 1 ? 'lo dejan' : 'lo deja'} fuera o en una nota.`
    );
  if (kind === 'tradicional')
    return (
      `Aquí los manuscritos griegos no coinciden. Estas palabras están en ${tradicional}, pero no en ${antiguos}.` +
      (without.length ? ` Por eso ${list(without)} no ${without.length > 1 ? 'las incluyen' : 'las incluye'}.` : '')
    );
  if (kind === 'critico')
    return `Aquí los manuscritos griegos no coinciden. Estas palabras están en ${antiguos}, pero no en ${tradicional}.`;
  const own = strong ? notaPalabra(strong) : null;
  const [o, t, gloss] = original[0];
  const general =
    `Es la misma palabra ${lang}, ${o} (${t}), que palabra por palabra se traduce «${gloss}». ` +
    'Cada versión elige cómo decirla en español: unas se quedan más cerca de la forma original y otras buscan una ' +
    'expresión más natural.';
  const silent = without.length
    ? ` ${list(without)} no ${without.length > 1 ? 'la dicen' : 'la dice'} con una palabra propia aquí: queda implícita o en otro versículo.`
    : '';
  return (own ?? general) + silent;
}
