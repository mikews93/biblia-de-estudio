import { describe, expect, it } from 'vitest';

import {
  type Use,
  concordanceHref,
  displayStrong,
  glossKey,
  markGloss,
  normalizeStrong,
  occurrences,
  parseConcordance,
  summarize,
} from './concordancia';

const BOOKS = [
  { id: 'gen', testament: 'AT' as const },
  { id: 'psa', testament: 'AT' as const },
  { id: 'jhn', testament: 'NT' as const },
  { id: '1jn', testament: 'NT' as const },
];

const USES: Use[] = [
  ['psa.136.1', 'חַסְדּוֹ', 'su misericordia'],
  ['gen.24.12', 'חֶסֶד', 'misericordia'],
  ['gen.21.23', 'כַּחֶסֶד', 'conforme a la lealtad'],
  ['psa.136.2', 'חַסְדּוֹ', 'Su misericordia'],
  ['psa.136.2', 'וְחֶסֶד', 'y misericordia'],
];

describe('concordancia', () => {
  it('escribe los números de Strong como los archivos', () => {
    expect(normalizeStrong('g26')).toBe('G0026');
    expect(normalizeStrong('H2617a')).toBe('H2617A');
    expect(normalizeStrong('G0025')).toBe('G0025');
    expect(normalizeStrong('juan')).toBeNull();
    expect(displayStrong('G0026')).toBe('G26');
    expect(displayStrong('H2617A')).toBe('H2617A');
    expect(concordanceHref('G0026', 'jhn.3.16')).toBe('/concordancia/G0026?desde=jhn.3.16');
  });

  it('lee el formato nuevo y el antiguo', () => {
    expect(parseConcordance([['jhn.3.16', 'ἠγάπησεν', 'amó']]).uses).toHaveLength(1);
    expect(parseConcordance({ lemma: 'ἀγάπη', uses: [] }).lemma).toBe('ἀγάπη');
  });

  it('junta las glosas que solo cambian por los prefijos', () => {
    expect(glossKey('Y su misericordia')).toBe('misericordia');
    expect(glossKey('conforme a la lealtad')).toBe('lealtad');
    expect(glossKey('(obj.)')).toBe('obj');
    expect(glossKey('de')).toBe('de');
    expect(glossKey('estén amando')).toBe('amando');
    expect(glossKey('habiendo amado')).toBe('amado');
    expect(glossKey('sido amados')).toBe('amados');
    expect(glossKey('misericordia de')).toBe('misericordia');
  });

  it('cuenta por libro en el orden de la Biblia y por traducción', () => {
    const s = summarize(USES, BOOKS);
    expect(s.total).toBe(5);
    expect(s.verses).toBe(4);
    expect(s.books).toEqual([
      { id: 'gen', count: 2 },
      { id: 'psa', count: 3 },
    ]);
    expect(s.glosses).toEqual([
      { key: 'misericordia', count: 4 },
      { key: 'lealtad', count: 1 },
    ]);
    expect([s.ot, s.nt]).toEqual([5, 0]);
  });

  it('une las apariciones de un mismo versículo y filtra', () => {
    const all = occurrences(USES, BOOKS);
    expect(all.map((o) => o.ref)).toEqual(['gen.21.23', 'gen.24.12', 'psa.136.1', 'psa.136.2']);
    expect(all[3].forms).toEqual(['חַסְדּוֹ', 'וְחֶסֶד']);
    expect(occurrences(USES, BOOKS, { book: 'gen' })).toHaveLength(2);
    expect(occurrences(USES, BOOKS, { gloss: 'lealtad' }).map((o) => o.ref)).toEqual(['gen.21.23']);
  });

  it('resalta en el versículo la palabra que traduce el original', () => {
    const text = 'Porque de tal manera amó Dios al mundo';
    const marked = markGloss(text, ['amó']);
    expect(marked.map((p) => p.text).join('')).toBe(text);
    expect(marked.filter((p) => p.mark).map((p) => p.text)).toEqual(['amó']);
    // Sin tilde en la glosa y otra forma del verbo en el texto
    expect(markGloss('Alabad á Jehová, porque es bueno; porque para siempre es su misericordia.', ['misericordias'])
      .filter((p) => p.mark)
      .map((p) => p.text)).toEqual(['misericordia']);
    // «mar» no se marca dentro de «amargo»
    expect(markGloss('el agua amarga', ['mar']).some((p) => p.mark)).toBe(false);
  });
});
