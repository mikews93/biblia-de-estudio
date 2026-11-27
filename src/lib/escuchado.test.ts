import { beforeEach, describe, expect, it, vi } from 'vitest';

type Escucha = { kind: string; book: string; chapter: number; title: string };
const empezar: ((e: Escucha) => void)[] = [];
const terminar: ((e: Escucha) => void)[] = [];
const markChapterRead = vi.fn(async () => {});
const saveLastRead = vi.fn(async () => {});

vi.mock('./audio', () => ({
  alEmpezar: (fn: (e: Escucha) => void) => empezar.push(fn),
  alTerminar: (fn: (e: Escucha) => void) => terminar.push(fn),
}));
vi.mock('./progress', () => ({ markChapterRead }));
vi.mock('./theme', () => ({ saveLastRead }));

const { esCapitulo, instalarEscuchado } = await import('./escuchado');

describe('escuchar cuenta como leer', () => {
  beforeEach(() => {
    instalarEscuchado();
    markChapterRead.mockClear();
    saveLastRead.mockClear();
  });

  it('el capítulo que empieza a sonar pasa a ser el último leído («Leer» y «Seguir leyendo» llevan ahí)', () => {
    empezar.forEach((fn) => fn({ kind: 'podcast', book: 'rev', chapter: 7, title: 'Apocalipsis 7' }));
    expect(saveLastRead).toHaveBeenCalledWith('rev', 7);
  });

  it('escuchado entero cuenta una vez como capítulo leído', () => {
    const fin = { kind: 'podcast', book: 'rev', chapter: 6, title: 'Apocalipsis 6' };
    terminar.forEach((fn) => fn(fin));
    terminar.forEach((fn) => fn(fin));
    expect(markChapterRead).toHaveBeenCalledTimes(1);
    expect(markChapterRead).toHaveBeenCalledWith('rev', 6);
  });

  it('el pódcast de una palabra no es un capítulo', () => {
    empezar.forEach((fn) => fn({ kind: 'podcast', book: 'palabra:jesed', chapter: 0, title: 'Jésed' }));
    terminar.forEach((fn) => fn({ kind: 'podcast', book: 'palabra:jesed', chapter: 0, title: 'Jésed' }));
    expect(saveLastRead).not.toHaveBeenCalled();
    expect(markChapterRead).not.toHaveBeenCalled();
    expect(esCapitulo('jhn', 3)).toBe(true);
  });

  it('se instala una sola vez', () => {
    instalarEscuchado();
    expect(empezar).toHaveLength(1);
    expect(terminar).toHaveLength(1);
  });
});
