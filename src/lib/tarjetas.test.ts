import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Source } from './estudio';
import { dateKey } from './planes';
import { Card, dueCards, Grade, intervalLabel, parseCards, questionCardId, schedule, verseCardId } from './tarjetas';

const card = (patch: Partial<Card> = {}): Card => ({
  id: 'x',
  kind: 'pregunta',
  book: 'jhn',
  chapter: 3,
  front: '¿?',
  back: '.',
  label: '',
  created: 0,
  due: '2026-01-01',
  interval: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
  ...patch,
});

describe('schedule (SM-2 sencillo)', () => {
  it('una tarjeta nueva: otra = hoy, difícil y bien = 1 día, fácil = 4 días', () => {
    const c = card();
    expect(schedule(c, 'otra')).toEqual({ interval: 0, ease: 2.3, reps: 0, lapses: 0 });
    expect(schedule(c, 'dificil')).toEqual({ interval: 1, ease: 2.35, reps: 1, lapses: 0 });
    expect(schedule(c, 'bien')).toEqual({ interval: 1, ease: 2.5, reps: 1, lapses: 0 });
    expect(schedule(c, 'facil')).toEqual({ interval: 4, ease: 2.65, reps: 1, lapses: 0 });
  });

  it('con «bien» el intervalo crece 1 → 3 → ×facilidad', () => {
    let c = card();
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      c = { ...c, ...schedule(c, 'bien') };
      seen.push(c.interval);
    }
    expect(seen).toEqual([1, 3, 8, 20, 50]);
  });

  it('olvidar una tarjeta aprendida cuenta un fallo y la reinicia', () => {
    const c = card({ interval: 20, reps: 4, ease: 2.5, lapses: 1 });
    expect(schedule(c, 'otra')).toEqual({ interval: 0, ease: 2.3, reps: 0, lapses: 2 });
  });

  it('la facilidad nunca baja de 1,3', () => {
    let c = card({ ease: 1.4 });
    for (const g of ['otra', 'dificil', 'otra'] as Grade[]) c = { ...c, ...schedule(c, g) };
    expect(c.ease).toBe(1.3);
  });

  it('cada respuesta mejor da un intervalo al menos igual de largo', () => {
    const c = card({ interval: 10, reps: 3, ease: 2.2 });
    const [o, d, b, f] = (['otra', 'dificil', 'bien', 'facil'] as Grade[]).map((g) => schedule(c, g).interval);
    expect(o).toBe(0);
    expect(d).toBe(12);
    expect(b).toBe(22);
    expect(f).toBe(29);
    expect(o < d && d < b && b < f).toBe(true);
  });
});

describe('intervalLabel', () => {
  it('días y meses en español', () => {
    expect(intervalLabel(0)).toBe('hoy');
    expect(intervalLabel(1)).toBe('1 día');
    expect(intervalLabel(12)).toBe('12 días');
    expect(intervalLabel(30)).toBe('1 mes');
    expect(intervalLabel(75)).toBe('3 meses');
  });
});

describe('parseCards', () => {
  const sources: Source[] = [
    { n: 1, label: 'Juan 3:3', ref: 'jhn.3.3' },
    { n: 2, label: 'Ezequiel 36:26', ref: 'ezk.36.26' },
    { n: 3, label: 'Juan 3:16', ref: 'jhn.3.16' },
  ];

  it('lee pares P/R, quita las marcas y toma el versículo de la cita del capítulo', () => {
    const text = [
      '**P:** ¿Qué hay que hacer para ver el reino de Dios? ⟦1⟧',
      'R: Nacer otra vez ⟦1⟧',
      '',
      '2. P: ¿Qué promete Ezequiel?',
      'R: Un corazón nuevo ⟦2⟧',
    ].join('\n');
    expect(parseCards(text, sources, 'jhn', 3)).toEqual([
      { kind: 'pregunta', book: 'jhn', chapter: 3, verse: 3, front: '¿Qué hay que hacer para ver el reino de Dios?', back: 'Nacer otra vez', label: '' },
      // Cita de otro pasaje: no hay versículo del capítulo, se muestra la etiqueta
      { kind: 'pregunta', book: 'jhn', chapter: 3, verse: undefined, front: '¿Qué promete Ezequiel?', back: 'Un corazón nuevo', label: 'Ezequiel 36:26' },
    ]);
  });

  it('las marcas sueltas en la línea siguiente ponen el versículo que faltaba', () => {
    const cards = parseCards('P: Completa: «De tal manera amó Dios…»\nR: al mundo\n⟦3⟧', sources, 'jhn', 3);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ verse: 16, label: '' });
  });

  it('ignora respuestas sin pregunta y preguntas sin respuesta', () => {
    expect(parseCards('R: suelta\nP: sin respuesta', sources, 'jhn', 3)).toEqual([]);
  });

  it('sirve con lo que devuelve la IA simulada de las pruebas (citas entre paréntesis, sin marcas)', () => {
    const text = 'P: ¿Quién visitó a Jesús de noche?\nR: Nicodemo (Juan 3:1-2)\n\nP: ¿Qué dijo Jesús?\nR: Nacer otra vez (Juan 3:3)';
    expect(parseCards(text, [], 'jhn', 3).map((c) => c.back)).toEqual(['Nicodemo (Juan 3:1-2)', 'Nacer otra vez (Juan 3:3)']);
  });
});

describe('identificadores', () => {
  it('questionCardId es estable y no distingue mayúsculas', () => {
    const a = questionCardId('jhn', 3, '¿Quién es Nicodemo?');
    expect(a).toMatch(/^p\.jhn\.3\.[0-9a-z]+$/);
    expect(questionCardId('jhn', 3, '¿QUIÉN ES NICODEMO?')).toBe(a);
    expect(questionCardId('jhn', 3, '¿Quién es Jesús?')).not.toBe(a);
    expect(questionCardId('jhn', 4, '¿Quién es Nicodemo?')).not.toBe(a);
  });

  it('verseCardId', () => expect(verseCardId('psa', 23, 1)).toBe('v.psa.23.1'));
});

describe('dueCards', () => {
  it('primero las ya repasadas y atrasadas (más antiguas antes), luego las nuevas; nada del futuro', () => {
    const today = dateKey(new Date());
    const cards = {
      nueva: card({ id: 'nueva', due: today, created: 1 }),
      atrasada: card({ id: 'atrasada', due: '2020-01-01', reps: 2 }),
      hoy: card({ id: 'hoy', due: today, reps: 1 }),
      futura: card({ id: 'futura', due: '2999-01-01', reps: 3 }),
      otraNueva: card({ id: 'otraNueva', due: today, created: 0 }),
      otroCapitulo: card({ id: 'otroCapitulo', chapter: 4, due: today, reps: 1 }),
    };
    expect(dueCards(cards).map((c) => c.id)).toEqual(['atrasada', 'hoy', 'otroCapitulo', 'otraNueva', 'nueva']);
    expect(dueCards(cards, 'jhn', 4).map((c) => c.id)).toEqual(['otroCapitulo']);
  });
});

describe('guardado en el dispositivo', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 18, 9));
  });
  afterEach(() => vi.useRealTimers());

  const saved = async () => JSON.parse((await AsyncStorage.getItem('tarjetas'))!) as Record<string, Card>;
  const nueva = { kind: 'versiculo' as const, book: 'jhn', chapter: 3, verse: 16, front: 'Juan 3:16', back: '…', label: 'Juan 3:16' };

  it('addCards no reinicia el calendario de una tarjeta que ya existe', async () => {
    const m = await import('./tarjetas');
    await m.addCards([{ ...nueva, id: 'v.jhn.3.16' }]);
    expect((await saved())['v.jhn.3.16']).toMatchObject({ due: '2026-10-18', interval: 0, ease: 2.5, reps: 0 });

    await m.grade('v.jhn.3.16', 'facil');
    expect((await saved())['v.jhn.3.16']).toMatchObject({ due: '2026-10-22', interval: 4, reps: 1 });

    await m.addCards([{ ...nueva, id: 'v.jhn.3.16', back: 'cambiada' }]);
    expect((await saved())['v.jhn.3.16']).toMatchObject({ interval: 4, back: '…' });
  });

  it('«otra» la deja para hoy; removeCards la borra; calificar una que no existe no hace nada', async () => {
    const m = await import('./tarjetas');
    await m.addCards([{ ...nueva, id: 'a' }]);
    await m.grade('a', 'otra');
    expect((await saved()).a.due).toBe('2026-10-18');
    await m.grade('no-existe', 'bien');
    expect(Object.keys(await saved())).toEqual(['a']);
    await m.removeCards(['a']);
    expect(await saved()).toEqual({});
  });
});
