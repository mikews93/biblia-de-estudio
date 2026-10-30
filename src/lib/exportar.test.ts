import { describe, expect, it } from 'vitest';

import { comoHtml, comoTexto, type Contenido } from './exportar';

const HOY = Date.UTC(2026, 9, 30, 12);
const contenido: Contenido = {
  versiculos: [
    { key: 'jhn.3.16', book: 'jhn', chapter: 3, verse: 16, referencia: 'Juan 3:16', texto: 'Porque de tal manera amó Dios al mundo', nota: 'Me lo dijo mamá <siempre>', color: 'amarillo', fecha: HOY },
  ],
  diario: [{ id: 'd1', book: 'psa', chapter: 23, reference: 'Salmos 23', palabra: 'nada me faltará', oracion: 'Gracias', paso: 'Llamar a Ana', created: HOY, hecho: true }],
  oraciones: [{ id: 'o1', titulo: 'Trabajo para papá', created: HOY, versiculos: [], respondida: { fecha: HOY, nota: 'Lo contrataron' } }],
  mensajes: [],
  borradores: 0,
};

describe('exportar', () => {
  it('arma el texto con cada parte elegida y deja fuera las vacías', () => {
    const t = comoTexto(contenido, ['notas', 'diario', 'oraciones', 'mensajes'], HOY);
    expect(t).toContain('## Notas y resaltados');
    expect(t).toContain('**Juan 3:16** (resaltado amarillo)\n> Porque de tal manera amó Dios al mundo\nMe lo dijo mamá <siempre>');
    expect(t).toContain('El paso de hoy: Llamar a Ana (hecho)');
    expect(t).toContain('Respondida el 30 de octubre de 2026: Lo contrataron');
    expect(t).not.toContain('## Sermones');
    expect(comoTexto(contenido, ['diario'], HOY)).not.toContain('Juan 3:16');
  });

  it('escapa lo que escribió la persona en el HTML', () => {
    const h = comoHtml(contenido, ['notas'], HOY);
    expect(h).toContain('Me lo dijo mamá &lt;siempre&gt;');
    expect(h).toContain('<h2>Notas y resaltados <span class="cuenta">1</span></h2>');
    expect(h).not.toContain('Diario devocional');
  });
});
