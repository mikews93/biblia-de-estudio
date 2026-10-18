// Traduce los códigos de morfología griega (estilo Robinson, como en TAGNT) a una descripción en español.

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
