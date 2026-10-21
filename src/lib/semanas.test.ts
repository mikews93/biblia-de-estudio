import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { parseDevocional } from './diario';
import { dateKey } from './temporadas';
import { type Semana, diaCompleto, diaDeHoy, fechaDia, inicioDesde, parseSemana, semanaActiva, siguiente } from './semanas';

const juan3 = { book: 'jhn', chapter: 3, from: 1, to: 21 };

const dia = (n: number, cita: string, extra = '') => `## Día ${n} · Título ${n}
Pasaje: ${cita}
Del domingo: «frase ${n}»

### Observa
Observa ${n} ⟦1⟧

### Medita
- ¿Pregunta ${n}?

### Vive
- Paso ${n}

### Ora
- Adora: algo
- Pide: algo

### Llévalo contigo
${n + 2}${extra}`;

const semana = (patch: Partial<Semana> = {}): Semana => ({
  id: 's1',
  titulo: 'Nacer de nuevo',
  pasaje: juan3,
  referencia: 'Juan 3:1-21',
  notas: 'notas',
  inicio: '2026-10-19',
  dias: [1, 2, 3, 4, 5].map(() => ({ titulo: 't', pasaje: juan3, referencia: 'Juan 3', domingo: '', texto: '### Llévalo contigo\n3' })),
  fuentes: [],
  hechos: {},
  creado: 0,
  ...patch,
});

describe('parseSemana', () => {
  it('separa el título y los días con su pasaje, la frase del domingo y el devocional', () => {
    const text = `# Nacer de nuevo\n\n${dia(1, 'Juan 3:1-3')}\n\n${dia(2, '**Romanos 5:8**')}`;
    const { titulo, dias } = parseSemana(text, BOOKS, juan3);
    expect(titulo).toBe('Nacer de nuevo');
    expect(dias).toHaveLength(2);
    expect(dias[0]).toMatchObject({ titulo: 'Título 1', pasaje: { book: 'jhn', chapter: 3, from: 1, to: 3 }, referencia: 'Juan 3:1-3', domingo: 'frase 1' });
    expect(dias[1].pasaje).toEqual({ book: 'rom', chapter: 5, from: 8, to: undefined });
    // El devocional del día lo lee el mismo parser que el devocional guiado
    const d = parseDevocional(dias[0].texto);
    expect(d.observa).toBe('Observa 1 ⟦1⟧');
    expect(d.medita).toEqual(['¿Pregunta 1?']);
    expect(d.ora.map((o) => o.label)).toEqual(['Adora', 'Pide']);
    expect(d.llevar).toBe(3);
  });

  it('tolera una respuesta a medias y un pasaje que no reconoce', () => {
    const text = `# Título\n\n${dia(1, 'Juan 3:1-3')}\n\n## Día 2 · Otro\nPasaje: Libro inventado 4\nDel domingo: «a medias»\n\n### Observa\nEmpie`;
    const { dias } = parseSemana(text, BOOKS, juan3);
    expect(dias.map(diaCompleto)).toEqual([true, false]);
    expect(dias[1].pasaje).toEqual(juan3);
    expect(parseSemana('', BOOKS, juan3)).toEqual({ titulo: '', dias: [] });
  });
});

describe('fechas de la semana', () => {
  it('si se prepara en domingo empieza el lunes; si no, el mismo día', () => {
    expect(inicioDesde(new Date(2026, 9, 18))).toBe('2026-10-19'); // domingo
    expect(inicioDesde(new Date(2026, 9, 21))).toBe('2026-10-21'); // miércoles
  });

  it('sabe qué día toca y cuál sigue sin hacer', () => {
    const s = semana({ hechos: { 0: 'a', 2: 'b' } });
    expect(diaDeHoy(s, '2026-10-18')).toBe(-1);
    expect(diaDeHoy(s, '2026-10-21')).toBe(2);
    expect(diaDeHoy(s, '2026-11-01')).toBe(5);
    // Si empieza un miércoles, el domingo se salta: el quinto día es el lunes
    const miercoles = semana({ inicio: '2026-10-21' });
    expect(dateKey(fechaDia(miercoles, 3))).toBe('2026-10-24');
    expect(dateKey(fechaDia(miercoles, 4))).toBe('2026-10-26');
    expect(diaDeHoy(miercoles, '2026-10-25')).toBe(4);
    expect(diaDeHoy(miercoles, '2026-10-26')).toBe(4);
    expect(diaDeHoy(miercoles, '2026-10-27')).toBe(5);
    expect(siguiente(s)).toBe(1);
    expect(siguiente(semana({ hechos: { 0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e' } }))).toBeNull();
  });

  it('en Hoy se muestra la semana sin terminar más reciente, hasta una semana después del último día', () => {
    const vieja = semana({ id: 'vieja', inicio: '2026-09-01' });
    const hecha = semana({ id: 'hecha', hechos: { 0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e' } });
    const actual = semana({ id: 'actual' });
    expect(semanaActiva([hecha, actual, vieja], '2026-10-21')?.id).toBe('actual');
    expect(semanaActiva([actual], '2026-10-30')?.id).toBe('actual');
    expect(semanaActiva([actual], '2026-10-31')).toBeNull();
  });
});
