import { describe, expect, it } from 'vitest';

import { recortar, type Registro } from './actividad';
import { construirActividad, resumenDe, type Fuentes } from './miActividad';

const at = (fecha: string, h: number) => new Date(`${fecha}T${String(h).padStart(2, '0')}:00:00`).getTime();
const NOMBRES: Record<string, string> = { jhn: 'Juan', psa: 'Salmos', rom: 'Romanos' };

function fuentes(p: Partial<Fuentes>): Fuentes {
  return { registro: {}, diario: [], resaltados: {}, notas: {}, oraciones: [], sellos: [], nombre: (b) => NOMBRES[b] ?? b, ...p };
}

describe('Mi actividad', () => {
  it('junta todo por día, del más reciente al más antiguo', () => {
    const registro: Registro = {
      '2026-10-24|capitulo|jhn.3': { tipo: 'capitulo', t: at('2026-10-24', 8), titulo: '' },
      '2026-10-24|capitulo|jhn.4': { tipo: 'capitulo', t: at('2026-10-24', 9), titulo: '' },
      '2026-10-24|podcast|jhn.3': { tipo: 'podcast', t: at('2026-10-24', 10), titulo: 'Juan 3' },
      '2026-10-25|profundo|rom.8': { tipo: 'profundo', t: at('2026-10-25', 7), titulo: 'Romanos 8' },
    };
    const dias = construirActividad(
      fuentes({
        registro,
        resaltados: { 'jhn.3.16': { at: at('2026-10-24', 11) }, 'jhn.3.17': { at: at('2026-10-24', 11) } },
        notas: { 'psa.23.1': { text: 'El Señor es mi pastor', created: at('2026-10-25', 6), updated: at('2026-10-25', 6) } },
        sellos: [{ id: 'racha-3', titulo: 'Pan de cada día', fecha: '2026-10-25' }],
      }),
    );
    expect(dias.map((d) => d.fecha)).toEqual(['2026-10-25', '2026-10-24']);
    expect(dias[0].items.map((i) => i.titulo)).toEqual([
      'Estudio profundo de Romanos 8',
      'Escribiste una nota en Salmos 23:1',
      'Ganaste el sello «Pan de cada día»',
    ]);
    const ayer = dias[1].items.map((i) => [i.titulo, i.detalle]);
    expect(ayer).toContainEqual(['Leíste 2 capítulos', 'Juan 3 · Juan 4']);
    expect(ayer).toContainEqual(['Resaltaste 2 versículos en Juan 3', 'Versículos 16, 17']);
    expect(ayer).toContainEqual(['Escuchaste el pódcast de Juan 3', undefined]);
  });

  it('el devocional con entrada en el diario se muestra una vez, con lo que escribió', () => {
    const t = at('2026-10-25', 7);
    const dias = construirActividad(
      fuentes({
        registro: { '2026-10-25|devocional|jhn.3.16': { tipo: 'devocional', t, titulo: 'Juan 3:16' } },
        diario: [{ id: '1', book: 'jhn', chapter: 3, verse: 16, reference: 'Juan 3:16', palabra: '«De tal manera amó»', oracion: '', paso: '', created: t }],
      }),
    );
    expect(dias[0].items).toHaveLength(1);
    expect(dias[0].items[0]).toMatchObject({ tipo: 'devocional', titulo: 'Devocional en Juan 3:16', detalle: '«De tal manera amó»' });
  });

  it('un devocional borrado del diario sigue en la actividad', () => {
    const dias = construirActividad(
      fuentes({ registro: { '2026-10-25|devocional|jhn.3.16': { tipo: 'devocional', t: at('2026-10-25', 7), titulo: 'Juan 3:16' } } }),
    );
    expect(dias[0].items[0].titulo).toBe('Devocional en Juan 3:16');
  });

  it('oraciones: cuándo empezó a orar y cuándo Dios respondió', () => {
    const dias = construirActividad(
      fuentes({
        oraciones: [
          { id: 'o', titulo: 'Trabajo para papá', created: at('2026-10-20', 9), versiculos: [], respondida: { fecha: at('2026-10-25', 9), nota: '¡Lo contrataron!' } },
        ],
      }),
    );
    expect(dias.map((d) => d.items[0].titulo)).toEqual(['Dios respondió: «Trabajo para papá»', 'Empezaste a orar por «Trabajo para papá»']);
  });

  it('el resumen de hoy dice qué se hizo', () => {
    const [hoy] = construirActividad(
      fuentes({ registro: { '2026-10-25|dramatizado|jhn.3': { tipo: 'dramatizado', t: at('2026-10-25', 7), titulo: 'Juan 3' } } }),
    );
    expect(resumenDe(hoy)).toEqual({ devocional: false, profundo: false, lectura: false, escuchado: true, total: 1 });
    expect(resumenDe(undefined).total).toBe(0);
  });

  it('el registro guarda algo más de un año', () => {
    const ahora = at('2026-10-25', 12);
    const r: Registro = {
      viejo: { tipo: 'capitulo', t: ahora - 401 * 86_400_000, titulo: '' },
      nuevo: { tipo: 'capitulo', t: ahora - 86_400_000, titulo: '' },
    };
    expect(Object.keys(recortar(r, ahora))).toEqual(['nuevo']);
  });
});
