import { describe, expect, it } from 'vitest';

import { dinamica, DINAMICAS, MOMENTOS } from './dinamicas';
import { PLANTILLAS } from './taller';

describe('catálogo de dinámicas', () => {
  it('ids únicos y datos completos', () => {
    expect(new Set(DINAMICAS.map((d) => d.id)).size).toBe(DINAMICAS.length);
    const momentos = MOMENTOS.map((m) => m.momento);
    for (const d of DINAMICAS) {
      expect(d.id, d.nombre).toMatch(/^[a-z0-9-]+$/);
      expect(momentos).toContain(d.momento);
      expect(d.pasos.length, d.id).toBeGreaterThan(0);
      expect(d.minutos, d.id).toBeGreaterThan(0);
    }
  });

  it('cada dinámica que nombran las plantillas del Taller existe', () => {
    const usadas = PLANTILLAS.flatMap((p) => p.secciones.flatMap((s) => (s.dinamica ? [s.dinamica] : [])));
    expect(usadas.length).toBeGreaterThan(0);
    for (const id of usadas) expect(dinamica(id), id).toBeDefined();
  });

  it('dinamica() sin id o con uno desconocido', () => {
    expect(dinamica(undefined)).toBeUndefined();
    expect(dinamica('no-existe')).toBeUndefined();
  });
});
