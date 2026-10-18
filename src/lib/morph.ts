// Traduce los códigos de morfología griega (estilo Robinson, como en TAGNT) y hebrea (OpenScriptures, como en TAHOT)
// a una descripción en español.

const POS: Record<string, string> = {
  N: 'sustantivo',
  V: 'verbo',
  A: 'adjetivo',
  T: 'artículo',
  P: 'pronombre personal',
  R: 'pronombre relativo',
  C: 'pronombre recíproco',
  D: 'pronombre demostrativo',
  K: 'pronombre correlativo',
  I: 'pronombre interrogativo',
  X: 'pronombre indefinido',
  Q: 'pronombre correlativo',
  F: 'pronombre reflexivo',
  S: 'pronombre posesivo',
  ADV: 'adverbio',
  CONJ: 'conjunción',
  PREP: 'preposición',
  PRT: 'partícula',
  INJ: 'interjección',
  COND: 'conjunción condicional',
  HEB: 'palabra hebrea',
  ARAM: 'palabra aramea',
};
const CASE: Record<string, string> = { N: 'nominativo', G: 'genitivo', D: 'dativo', A: 'acusativo', V: 'vocativo' };
const NUMBER: Record<string, string> = { S: 'singular', P: 'plural' };
const GENDER: Record<string, string> = { M: 'masculino', F: 'femenino', N: 'neutro' };
const TENSE: Record<string, string> = {
  P: 'presente',
  I: 'imperfecto',
  F: 'futuro',
  A: 'aoristo',
  R: 'perfecto',
  L: 'pluscuamperfecto',
  '2A': 'aoristo segundo',
  '2F': 'futuro segundo',
  '2R': 'perfecto segundo',
  '2L': 'pluscuamperfecto segundo',
};
const VOICE: Record<string, string> = {
  A: 'activa',
  M: 'media',
  P: 'pasiva',
  E: 'media o pasiva',
  D: 'media deponente',
  O: 'pasiva deponente',
  N: 'media o pasiva deponente',
};
const MOOD: Record<string, string> = {
  I: 'indicativo',
  S: 'subjuntivo',
  O: 'optativo',
  M: 'imperativo',
  N: 'infinitivo',
  P: 'participio',
};

function caseNumberGender(code: string) {
  const [c, n, g] = code;
  return [CASE[c], NUMBER[n], GENDER[g]].filter(Boolean).join(', ');
}

export function describeMorph(code: string): string {
  if (HEBREW_CODE.test(code)) return describeHebrew(code);
  // Palabras compuestas vienen como 'CONJ + G1565=D': se describe la primera parte
  const [pos, ...rest] = code.split(' + ')[0].split('-');
  const name = POS[pos] ?? code;
  if (pos === 'V' && rest[0]) {
    const tvm = rest[0];
    const tenseKey = tvm.startsWith('2') ? tvm.slice(0, 2) : tvm[0];
    const after = tvm.slice(tenseKey.length);
    const parts = [TENSE[tenseKey], VOICE[after[0]], MOOD[after[1]]];
    const pn = rest[1];
    if (pn && /^[123]/.test(pn)) parts.push(`${pn[0]}.ª persona`, NUMBER[pn[1]]);
    else if (pn) parts.push(caseNumberGender(pn));
    return `verbo: ${parts.filter(Boolean).join(', ')}`;
  }
  if (rest[0]) {
    const person = /^[123]/.test(rest[0]) ? `${rest[0][0]}.ª persona, ` : '';
    const detail = person + caseNumberGender(rest[0].replace(/^[123]/, ''));
    return detail ? `${name}: ${detail}` : name;
  }
  return name;
}

// Hebreo y arameo: 'HC/Td/Ncfsa' = conjunción + artículo + sustantivo. La primera letra es el idioma (H/A).
// https://openscriptures.github.io/morphhb/parsing/HebrewMorphologyCodes.html
const HEBREW_CODE = /^[HA][A-Z][a-z0-9]*(\/|$)/;

const HEB_POS: Record<string, string> = {
  A: 'adjetivo',
  C: 'conjunción',
  D: 'adverbio',
  N: 'sustantivo',
  P: 'pronombre',
  R: 'preposición',
  S: 'sufijo',
  T: 'partícula',
  V: 'verbo',
};
const HEB_SUB: Record<string, Record<string, string>> = {
  A: { a: '', c: 'cardinal', g: 'gentilicio', o: 'ordinal' },
  N: { c: 'común', g: 'gentilicio', p: 'nombre propio', x: '' },
  P: { d: 'demostrativo', f: 'indefinido', i: 'interrogativo', p: 'personal', r: 'relativo' },
  R: { d: 'con artículo' },
  S: { d: 'he direccional', h: 'he paragógica', n: 'nun paragógica', p: 'pronominal' },
  T: {
    a: 'partícula afirmativa',
    d: 'artículo',
    e: 'partícula exhortativa',
    i: 'partícula interrogativa',
    j: 'interjección',
    m: 'partícula demostrativa',
    n: 'negación',
    o: 'marca de objeto directo',
    r: 'partícula relativa',
  },
};
const HEB_STEM: Record<string, string> = {
  q: 'qal', N: 'nifal', p: 'piel', P: 'pual', h: 'hifil', H: 'hofal', t: 'hitpael', o: 'polel', O: 'polal',
  r: 'hitpolel', m: 'poel', M: 'poal', k: 'palel', K: 'pulal', Q: 'qal pasivo', l: 'pilpel', L: 'polpal',
  f: 'hitpalpel', D: 'nitpael', j: 'pealal', i: 'pilel', u: 'hotpaal', c: 'tifil', v: 'histafel', w: 'nitpalel',
  y: 'nitpoel', z: 'hitpoel',
};
const ARAM_STEM: Record<string, string> = {
  q: 'peal', Q: 'peil', u: 'hitpeel', p: 'pael', P: 'itpaal', M: 'hitpaal', a: 'afel', h: 'hafel', s: 'safel',
  e: 'shafel', H: 'hofal', i: 'itpeel', t: 'histafel', v: 'istafel', w: 'hitafel', o: 'polel', z: 'itpoel',
  r: 'hitpolel', f: 'hitpalpel', b: 'hefal', c: 'tifel', m: 'poel', l: 'palpel', L: 'itpalpel', O: 'itpolel',
  G: 'itafal',
};
const HEB_TYPE: Record<string, string> = {
  p: 'perfecto',
  q: 'perfecto consecutivo',
  i: 'imperfecto',
  w: 'imperfecto consecutivo',
  h: 'cohortativo',
  j: 'yusivo',
  v: 'imperativo',
  r: 'participio activo',
  s: 'participio pasivo',
  a: 'infinitivo absoluto',
  c: 'infinitivo constructo',
};
const HEB_GENDER: Record<string, string> = { m: 'masculino', f: 'femenino', b: 'común', c: 'común' };
const HEB_NUMBER: Record<string, string> = { s: 'singular', p: 'plural', d: 'dual' };
const HEB_STATE: Record<string, string> = { a: 'absoluto', c: 'constructo', d: 'determinado' };

/** Persona, género, número y estado al final de un código: '3ms', 'fsa', 'mpc'. */
function hebrewPgn(rest: string) {
  const parts: string[] = [];
  let i = 0;
  if (/[123]/.test(rest[i] ?? '')) parts.push(`${rest[i++]}.ª persona`);
  for (const table of [HEB_GENDER, HEB_NUMBER, HEB_STATE]) {
    const c = rest[i];
    if (c && table[c]) {
      parts.push(table[c]);
      i++;
    } else if (c === 'x') i++;
  }
  return parts;
}

function hebrewPart(seg: string, aramaic: boolean): string {
  const pos = seg[0];
  const name = HEB_POS[pos];
  if (!name) return seg;
  if (pos === 'V') {
    const stem = (aramaic ? ARAM_STEM : HEB_STEM)[seg[1]];
    const type = HEB_TYPE[seg[2]];
    const detail = [stem, type, ...hebrewPgn(seg.slice(3))].filter(Boolean);
    return detail.length ? `verbo: ${detail.join(', ')}` : name;
  }
  if (pos === 'C' || pos === 'D') return name;
  const sub = HEB_SUB[pos]?.[seg[1]];
  if (pos === 'T') return sub ?? name;
  const detail = [sub, ...hebrewPgn(seg.slice(sub === undefined ? 1 : 2))].filter(Boolean);
  return detail.length ? `${name}: ${detail.join(', ')}` : name;
}

function describeHebrew(code: string): string {
  const aramaic = code[0] === 'A';
  const text = code
    .slice(1)
    .split('/')
    .map((seg) => hebrewPart(seg, aramaic))
    .join(' + ');
  return aramaic ? `arameo · ${text}` : text;
}
