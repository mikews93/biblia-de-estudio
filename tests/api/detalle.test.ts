// Las fuentes de más del estudio profundo (api/_detalle.ts): diccionario Tyndale, léxico UBS, Treasury, medidas y
// objetos. Necesitan public/data (npm run data && npm run fuentes && npm run libros).
import { beforeAll, describe, expect, it } from 'vitest';

import { HAS_DATA, prepareEnv } from './helpers';

const conDatos = HAS_DATA ? describe : describe.skip;

let mod: typeof import('../../api/_detalle');
let biblia: import('../../api/_investigar').Biblia;
let lucas: import('../../api/_investigar').Book;
let load: typeof import('../../api/_investigar').load;

beforeAll(async () => {
  if (!HAS_DATA) return;
  await prepareEnv();
  mod = await import('../../api/_detalle');
  const inv = await import('../../api/_investigar');
  load = inv.load;
  const books = await inv.load<import('../../api/_investigar').Book[]>('books.json');
  lucas = books.find((b) => b.id === 'luk')!;
  biblia = new inv.Biblia(new Request('http://localhost/api/estudiar'), inv.RV1909, books);
});

conDatos('fuentes del estudio profundo', () => {
  it('Lucas 1:9: el diccionario explica el incienso o el templo, y el léxico da el sentido en español', async () => {
    const interlinear = await load<Record<string, import('../../api/_investigar').Word[]>>('interlinear/luk/1.json');
    const fuentes = await mod.fuentesDetalladas(biblia, lucas, 1, 9, interlinear, []);
    const titulos = fuentes.map((f) => f.title).join(' | ');
    expect(titulos).toContain('Diccionario bíblico Tyndale');
    expect(titulos).toContain('Sociedades Bíblicas Unidas');
    expect(titulos).toContain('Treasury');
    const dicc = fuentes.find((f) => f.title.includes('Tyndale'))!;
    expect(dicc.blocks.map((b) => b.text).join(' ')).toMatch(/incienso|templo|sacerdo/i);
    const lex = fuentes.find((f) => f.title.includes('Sociedades'))!;
    expect(lex.blocks.length).toBeGreaterThan(2);
    expect(lex.blocks[0].meta.label).toMatch(/^Léxico UBS, /);
    const tsk = fuentes.find((f) => f.title.includes('Treasury'))!;
    expect(tsk.blocks.every((b) => b.meta.ref && b.text.length > 10)).toBe(true);
  });

  it('las medidas del capítulo que nombra el versículo (Juan 2:6, las tinajas)', async () => {
    const juan = (await load<import('../../api/_investigar').Book[]>('books.json')).find((b) => b.id === 'jhn')!;
    const f = await mod.contextoDelPasaje(biblia, juan, 2, 6);
    expect(f?.title).toContain('Medidas antiguas y objetos');
    expect(f?.blocks[0].text).toMatch(/litros/);
    expect(await mod.contextoDelPasaje(biblia, juan, 2, 1)).toBeNull();
  });

  it('un capítulo entero trae más artículos y no repite las referencias de OpenBible', async () => {
    const interlinear = await load<Record<string, import('../../api/_investigar').Word[]>>('interlinear/luk/1.json');
    const xrefs = await load<Record<string, [string, number][]>>('xrefs/luk/1.json');
    const ya = Object.values(xrefs).flatMap((l) => l.slice(0, 2).map(([r]) => r));
    const fuentes = await mod.fuentesDetalladas(biblia, lucas, 1, undefined, interlinear, ya);
    const tsk = fuentes.find((f) => f.title.includes('Treasury'))!;
    const vistas = new Set(ya.map((r) => r.split('-')[0]));
    expect(tsk.blocks.some((b) => vistas.has(b.meta.ref!.split('-')[0]))).toBe(false);
    const dicc = fuentes.find((f) => f.title.includes('Tyndale'))!;
    expect(new Set(dicc.blocks.map((b) => b.meta.label)).size).toBeGreaterThanOrEqual(4);
  });
});

describe('palabras que aportan al léxico', () => {
  it('sustantivos, verbos y adjetivos sí; preposiciones, artículos, partículas y nombres propios no', async () => {
    const { contenido } = await import('../../api/_detalle');
    for (const m of ['N-GSM-T', 'V-AAI-3S', 'A-NSN', 'HNcmpa', 'HR/Ncfsa', 'HVqp3ms', 'HTd/Aamsa']) expect(contenido(m), m).toBe(true);
    for (const m of ['PREP', 'CONJ', 'PRT-N', 'T-GSM', 'N-PRI', 'N-NSF-P', 'N-GSF-L', 'HTo', 'HC/To', 'HNpm', 'HR']) expect(contenido(m), m).toBe(false);
  });
});
