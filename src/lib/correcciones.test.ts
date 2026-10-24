import { describe, expect, it } from 'vitest';

import { aplicarCorrecciones, borradorParaCorregir, deshacerCorrecciones, diferencias, estadoDe, leerCorrecciones } from './correcciones';
import type { Mensaje } from './taller';

const mensaje: Mensaje = {
  id: 'm1',
  tipo: 'encuentro',
  titulo: 'Reconstruir con la espada en la mano',
  pasaje: { book: 'neh', chapter: 4, from: 7, to: 23 },
  plantilla: 'dbs',
  observacion: 'Nehemías ora y pone guardia asta terminar el muro.',
  tema: 'La obra de Dios',
  complemento: '',
  necesidad: 'Nos desanimamos cuando hay oposición.',
  gracia: '',
  secciones: [
    { id: 'a1', titulo: 'Conexión', ayuda: '', texto: 'Preguntar como les fue.', minutos: 15, paraGrupo: '¿Que te desanima?' },
    { id: 'b2', titulo: 'Mirar arriba', ayuda: '', texto: '', minutos: 30 },
  ],
  revision: [],
  seguimiento: '',
  minutos: 80,
  creado: '2026-10-24T10:00:00.000Z',
  actualizado: '2026-10-24T10:00:00.000Z',
};

const respuesta = `@@ observacion
- Nehemías ora y pone guardia asta terminar el muro.
+ Nehemías ora y pone guardia hasta terminar el muro.
? Falta la «h» ⟦1⟧.

@@ grupo:a1
- ¿Que te desanima?
+ ¿Qué te desanima?
? Lleva tilde en la pregunta.

@@ notas:zz
- algo
+ otra cosa

@@ tema
- La obra de Dios
+ La obra de Dios`;

describe('correcciones de Revisa', () => {
  it('manda a la IA solo lo escrito, cada campo con su id', () => {
    const b = borradorParaCorregir(mensaje);
    expect(b).toContain('[observacion] Observar:\nNehemías ora');
    expect(b).toContain('[notas:a1] Conexión · notas:\nPreguntar como les fue.');
    expect(b).toContain('[grupo:a1] Conexión · para el grupo:\n¿Que te desanima?');
    expect(b).not.toContain('notas:b2');
    expect(b).not.toContain('[complemento]');
  });

  it('lee las correcciones e ignora las de campos que no existen o que no cambian nada', () => {
    const lista = leerCorrecciones(respuesta, mensaje);
    expect(lista.map((c) => c.destino)).toEqual(['observacion', 'grupo:a1']);
    expect(lista[0]).toMatchObject({ label: 'Observar', despues: 'Nehemías ora y pone guardia hasta terminar el muro.', porque: 'Falta la «h».' });
    expect(lista[1].label).toBe('Conexión · para el grupo');
  });

  it('aplica las elegidas, sabe cuáles ya están y se deshace', () => {
    const lista = leerCorrecciones(respuesta, mensaje);
    expect(estadoDe(mensaje, lista[0])).toBe('pendiente');
    const { cambio, previo, aplicadas } = aplicarCorrecciones(mensaje, lista);
    expect(aplicadas).toBe(2);
    const despues = { ...mensaje, ...cambio };
    expect(despues.observacion).toBe('Nehemías ora y pone guardia hasta terminar el muro.');
    expect(despues.secciones[0].paraGrupo).toBe('¿Qué te desanima?');
    expect(despues.secciones[0].texto).toBe('Preguntar como les fue.');
    expect(estadoDe(despues, lista[0])).toBe('aplicada');
    expect(estadoDe({ ...despues, observacion: 'Otra cosa' }, lista[0])).toBe('no-coincide');

    const vuelta = { ...despues, ...deshacerCorrecciones(despues, previo) };
    expect(vuelta.observacion).toBe(mensaje.observacion);
    expect(vuelta.secciones[0].paraGrupo).toBe('¿Que te desanima?');
  });

  it('marca palabra por palabra lo que se quita y lo que entra', () => {
    expect(diferencias('pone guardia asta el fin', 'pone guardia hasta el fin')).toEqual([
      { texto: 'pone guardia ', tipo: 'igual' },
      { texto: 'asta', tipo: 'quitado' },
      { texto: 'hasta', tipo: 'puesto' },
      { texto: ' el fin', tipo: 'igual' },
    ]);
  });
});
