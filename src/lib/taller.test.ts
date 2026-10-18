import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import {
  applyTemplate,
  borradorParaIA,
  comoTexto,
  duracion,
  enPasaje,
  hojaDelGrupo,
  ideaCentral,
  Mensaje,
  nuevaSeccion,
  parsePasaje,
  pasajeLabel,
  plantilla,
  PLANTILLAS,
  revisionPara,
  Seccion,
  TIPOS,
  tituloDe,
} from './taller';

const seccion = (patch: Partial<Seccion>): Seccion => ({ id: patch.titulo ?? 's', titulo: 'Parte', ayuda: '', texto: '', minutos: 5, ...patch });

const mensaje = (patch: Partial<Mensaje> = {}): Mensaje => ({
  id: 'm',
  tipo: 'encuentro',
  titulo: '',
  pasaje: { book: 'jhn', chapter: 3, from: 1, to: 8 },
  plantilla: 'dbs',
  observacion: '',
  tema: '',
  complemento: '',
  necesidad: '',
  gracia: '',
  secciones: [],
  revision: [],
  seguimiento: '',
  minutos: 80,
  creado: '',
  actualizado: '',
  ...patch,
});

describe('parsePasaje', () => {
  it('lee capítulos, versículos y tramos', () => {
    expect(parsePasaje('Juan 3', BOOKS)).toEqual({ book: 'jhn', chapter: 3, from: undefined, to: undefined });
    expect(parsePasaje('jn 3:16', BOOKS)).toEqual({ book: 'jhn', chapter: 3, from: 16, to: undefined });
    expect(parsePasaje('1 Corintios 13:1-7', BOOKS)).toEqual({ book: '1co', chapter: 13, from: 1, to: 7 });
    expect(parsePasaje('1co 13', BOOKS)?.book).toBe('1co');
    expect(parsePasaje('Salmo 23', BOOKS)?.book).toBe('psa');
    expect(parsePasaje('  génesis   1.1 ', BOOKS)).toMatchObject({ book: 'gen', chapter: 1, from: 1 });
  });

  it('un tramo de un solo versículo queda como versículo', () => {
    expect(parsePasaje('Juan 3:16-16', BOOKS)).toEqual({ book: 'jhn', chapter: 3, from: 16, to: undefined });
  });

  it('rechaza capítulos que no existen, tramos al revés y libros desconocidos', () => {
    expect(parsePasaje('Juan 22', BOOKS)).toBeNull();
    expect(parsePasaje('Juan 0', BOOKS)).toBeNull();
    expect(parsePasaje('Juan 3:16-14', BOOKS)).toBeNull();
    expect(parsePasaje('Hechizos 3', BOOKS)).toBeNull();
    expect(parsePasaje('Juan', BOOKS)).toBeNull();
  });
});

describe('pasajes', () => {
  it('pasajeLabel y enPasaje', () => {
    expect(pasajeLabel(null, BOOKS)).toBe('');
    expect(pasajeLabel({ book: 'jhn', chapter: 3 }, BOOKS)).toBe('Juan 3');
    expect(pasajeLabel({ book: 'jhn', chapter: 3, from: 16 }, BOOKS)).toBe('Juan 3:16');
    expect(pasajeLabel({ book: 'jhn', chapter: 3, from: 1, to: 8 }, BOOKS)).toBe('Juan 3:1-8');
    const p = { book: 'jhn', chapter: 3, from: 1, to: 8 };
    expect([0, 1, 8, 9].map((v) => enPasaje(p, v))).toEqual([false, true, true, false]);
    expect(enPasaje({ book: 'jhn', chapter: 3, from: 16 }, 16)).toBe(true);
    expect(enPasaje({ book: 'jhn', chapter: 3, from: 16 }, 17)).toBe(false);
    expect(enPasaje({ book: 'jhn', chapter: 3 }, 30)).toBe(true);
  });
});

describe('plantillas', () => {
  it('cada tipo tiene al menos una plantilla y la revisión se adapta al tipo', () => {
    for (const t of TIPOS) expect(PLANTILLAS.some((p) => p.tipo === t.tipo), t.tipo).toBe(true);
    expect(revisionPara('sermon').map((r) => r.id)).toContain('eia');
    expect(revisionPara('sermon').map((r) => r.id)).not.toContain('preguntas');
    expect(revisionPara('encuentro').map((r) => r.id)).toContain('preguntas');
  });

  it('cambiar de plantilla conserva lo escrito por posición y añade al final lo que no cabe', () => {
    const m = mensaje({
      secciones: [
        seccion({ titulo: 'A', texto: 'notas A' }),
        seccion({ titulo: 'B' }), // vacía: se pierde
        seccion({ titulo: 'C', paraGrupo: '¿Qué dice?', responsable: 'Ana' }),
      ],
    });
    const next = applyTemplate(m, 'oia');
    expect(next.plantilla).toBe('oia');
    expect(next.secciones!.map((s) => s.titulo)).toEqual(['El versículo', 'Algo que sorprende', 'Una verdad sobre Dios', 'Un paso para hoy', 'Oración']);
    expect(next.secciones![0].texto).toBe('notas A');
    expect(next.secciones![1]).toMatchObject({ paraGrupo: '¿Qué dice?', responsable: 'Ana' });

    const muchas = mensaje({ secciones: Array.from({ length: 6 }, (_, i) => seccion({ titulo: `S${i}`, texto: `t${i}` })) });
    const larga = applyTemplate(muchas, '4e').secciones!;
    expect(larga).toHaveLength(6);
    expect(larga[5]).toMatchObject({ titulo: 'S5', texto: 't5' });
    expect(new Set(larga.map((s) => s.id)).size).toBe(6);
  });

  it('una plantilla desconocida no cambia nada', () => {
    expect(applyTemplate(mensaje(), 'no-existe')).toEqual({});
    expect(plantilla('dbs')?.tipo).toBe('encuentro');
  });

  it('nuevaSeccion según el tipo', () => {
    expect(nuevaSeccion('sermon')).toMatchObject({ titulo: 'Nuevo punto', minutos: 7 });
    expect(nuevaSeccion('encuentro')).toMatchObject({ titulo: 'Nueva parte', minutos: 10 });
    expect(nuevaSeccion('reflexion').minutos).toBe(2);
  });
});

describe('tiempo y textos', () => {
  it('duración: en un encuentro suman las partes; en lo demás, lo escrito a 130 palabras por minuto', () => {
    expect(duracion(mensaje({ secciones: [seccion({ minutos: 15 }), seccion({ minutos: 30 })] }))).toBe(45);
    const palabras = Array(390).fill('palabra').join(' ');
    expect(duracion(mensaje({ tipo: 'sermon', secciones: [seccion({ texto: palabras }), seccion({ texto: '  ' })] }))).toBe(3);
  });

  it('idea central y título por defecto', () => {
    expect(ideaCentral(mensaje({ tema: ' La gracia ', complemento: 'nos busca' }))).toBe('La gracia: nos busca');
    expect(ideaCentral(mensaje({ tema: 'Solo tema' }))).toBe('Solo tema');
    expect(ideaCentral(mensaje())).toBe('');
    expect(tituloDe(mensaje({ titulo: '  Nacer de nuevo ' }), BOOKS)).toBe('Nacer de nuevo');
    expect(tituloDe(mensaje(), BOOKS)).toBe('Juan 3:1-8');
    expect(tituloDe(mensaje({ tipo: 'sermon', pasaje: null }), BOOKS)).toBe('Sermón sin título');
  });

  it('comoTexto: todo el mensaje, sin secciones vacías ni el pasaje repetido', () => {
    const m = mensaje({
      titulo: 'Nacer de nuevo',
      tema: 'El nuevo nacimiento',
      complemento: 'es obra de Dios',
      secciones: [seccion({ titulo: 'Conexión', texto: 'Notas del líder', paraGrupo: '¿Qué te sorprende?' }), seccion({ titulo: 'Vacía' })],
    });
    expect(comoTexto(m, BOOKS)).toBe(
      'Nacer de nuevo\nJuan 3:1-8\n\nIdea central: El nuevo nacimiento: es obra de Dios\n\n*Conexión*\nNotas del líder\n\n¿Qué te sorprende?',
    );
    expect(comoTexto(mensaje(), BOOKS)).toBe('Juan 3:1-8');
  });

  it('la hoja del grupo no lleva las notas del líder', () => {
    const m = mensaje({
      secciones: [
        seccion({ titulo: 'Conexión', minutos: 15, dinamica: 'pregunta-en-ronda', responsable: ' Ana ', texto: 'SECRETO', paraGrupo: '¿Por qué das gracias?' }),
        seccion({ titulo: 'Oración', minutos: 0 }),
      ],
    });
    const hoja = hojaDelGrupo(m, BOOKS, (id) => (id === 'pregunta-en-ronda' ? 'Pregunta en ronda' : undefined));
    expect(hoja).not.toContain('SECRETO');
    expect(hoja).toBe(
      'Juan 3:1-8\n\n## Conexión · 15 min\nDinámica: Pregunta en ronda\nGuía: Ana\n¿Por qué das gracias?\n\n## Oración',
    );
  });

  it('el borrador para la IA resume cada parte y no pasa de 12 000 caracteres', () => {
    const m = mensaje({
      tema: 'Tema',
      necesidad: 'Soledad',
      secciones: [seccion({ titulo: 'Conexión', dinamica: 'yo-voy-a', texto: 'n', paraGrupo: 'g' }), seccion({ titulo: 'Oración' })],
    });
    expect(borradorParaIA(m)).toBe(
      'Idea central: tema «Tema», complemento «»\nNecesidad humana que toca el pasaje: Soledad\nSección 1, Conexión (dinámica: yo-voy-a): Notas: n | Para el grupo: g\nSección 2, Oración: (vacía)',
    );
    expect(borradorParaIA(mensaje({ observacion: 'x'.repeat(20000) })).length).toBe(12000);
  });
});

describe('guardado en el dispositivo', () => {
  afterEach(() => vi.useRealTimers());

  it('crear y duplicar un mensaje; se guarda poco después de dejar de escribir', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const m = await import('./taller');
    const id = await m.crearMensaje('sermon', { book: 'jhn', chapter: 3 }, 'Nacer de nuevo');
    m.actualizarSeccion(id, 'no-existe', { texto: 'nada' });
    const copia = await m.duplicarMensaje(id);
    expect(copia).not.toBe(id);
    expect(await m.duplicarMensaje('no-existe')).toBeNull();
    expect(await AsyncStorage.getItem('taller')).toBeNull();

    await vi.advanceTimersByTimeAsync(400);
    const saved = JSON.parse((await AsyncStorage.getItem('taller'))!) as Mensaje[];
    expect(saved.map((x) => x.titulo)).toEqual(['Nacer de nuevo (copia)', 'Nacer de nuevo']);
    expect(saved[1]).toMatchObject({ tipo: 'sermon', plantilla: 'expositiva', minutos: 30 });
    expect(saved[0].secciones.map((s) => s.id)).not.toEqual(saved[1].secciones.map((s) => s.id));

    m.borrarMensaje(id);
    await vi.advanceTimersByTimeAsync(400);
    expect((JSON.parse((await AsyncStorage.getItem('taller'))!) as Mensaje[]).map((x) => x.id)).toEqual([copia]);
  });
});
