import { describe, expect, it } from 'vitest';

import { hayAlgo, resumenDelAño } from './miAno';

const t = (dia: string) => Date.parse(`${dia}T12:00:00`);

describe('Mi año con la Palabra', () => {
  it('cuenta solo lo del año y elige el versículo al que más se volvió', () => {
    const r = resumenDelAño(
      {
        progreso: { chapters: { jhn: [1, 2, 3], psa: [23] }, days: ['2026-03-02', '2026-03-03', '2025-12-30'] },
        sellos: {
          huellas: {
            'dia:2026-01-05': '2026-01-05',
            'dia:2026-03-02': '2026-03-02',
            'palabra:G26': '2026-02-01',
            'palabra:H2617': '2025-11-01',
            'palabra:G5485': '2026-05-01',
            'compartir:psa.23.1': '2026-04-01',
          },
          ganados: { bereano: { fecha: '2026-02-01', visto: true }, viejo: { fecha: '2025-06-01', visto: true } },
        },
        resaltados: { 'jhn.3.16': { at: t('2026-01-10') }, 'psa.23.1': { at: t('2026-02-10') }, 'rom.8.28': { at: t('2025-05-01') } },
        notas: { 'psa.23.1': { text: 'Él me cuida', created: t('2026-02-11'), updated: t('2026-02-11') } },
        diario: [],
        oraciones: [
          {
            id: 'o1',
            titulo: 'Salud',
            created: t('2026-03-01'),
            versiculos: [{ book: 'jhn', chapter: 3, verse: 16, reference: 'Juan 3:16', text: '', added: t('2026-03-01') }],
            respondida: { fecha: t('2026-04-01'), nota: '' },
          },
        ],
      },
      2026,
    );
    expect(r.dias).toBe(3);
    expect(r.capitulos).toBe(4);
    expect(r.resaltados).toBe(2);
    expect(r.notas).toBe(1);
    expect(r.oraciones).toBe(1);
    expect(r.respondidas).toBe(1);
    expect(r.compartidos).toBe(1);
    expect(r.sellos).toBe(1);
    expect(r.palabras).toEqual(['G26', 'G5485']);
    // Salmos 23:1: resaltado, con nota y compartido.
    expect(r.versiculo).toEqual({ book: 'psa', chapter: 23, verse: 1 });
    expect(r.libro).toBe('psa');
    expect(hayAlgo(r)).toBe(true);
  });

  it('sin nada guardado no hay nada que contar', () => {
    const r = resumenDelAño({ progreso: { chapters: {}, days: [] }, sellos: { huellas: {}, ganados: {} }, resaltados: {}, notas: {}, diario: [], oraciones: [] }, 2026);
    expect(hayAlgo(r)).toBe(false);
    expect(r.versiculo).toBeNull();
  });
});
