import { describe, expect, it } from 'vitest';

import { MAX_VUELTAS, ordenarVueltas, recortarVueltas } from './turnos';

const a = (text = 'respuesta') => ({ role: 'assistant' as const, text });
const u = (text: string) => ({ role: 'user' as const, text });

describe('ordenarVueltas', () => {
  it('deja igual una conversación bien alternada', () => {
    const c = [a(), u('¿Quién era Acab?')];
    expect(ordenarVueltas(c)).toEqual(c);
    expect(ordenarVueltas([])).toEqual([]);
  });

  it('una pregunta sin respuesta seguida de otra: vale la última', () => {
    expect(ordenarVueltas([a(), u('Características de Acab'), u('Acabab'), u('Qué características tenía el rey Acab?')])).toEqual([
      a(),
      u('Qué características tenía el rey Acab?'),
    ]);
  });

  it('quita respuestas vacías (las que fallaron antes de escribir)', () => {
    expect(ordenarVueltas([a(), u('uno'), a(''), u('dos')])).toEqual([a(), u('dos')]);
  });

  it('rechaza lo que no tiene arreglo', () => {
    expect(ordenarVueltas('hola')).toBeNull();
    expect(ordenarVueltas([u('hola')])).toBeNull();
    expect(ordenarVueltas([a()])).toBeNull();
    expect(ordenarVueltas([a(), { role: 'user', text: 5 }])).toBeNull();
    expect(ordenarVueltas([a(), { role: 'system', text: 'x' }])).toBeNull();
  });
});

describe('recortarVueltas', () => {
  it('guarda la primera respuesta y las últimas vueltas, alternadas', () => {
    const larga = [a('estudio'), ...Array.from({ length: 10 }, (_, i) => [u(`p${i}`), a(`r${i}`)]).flat(), u('última')];
    const corta = recortarVueltas(larga);
    expect(corta.length).toBeLessThanOrEqual(MAX_VUELTAS);
    expect(corta[0]).toEqual(a('estudio'));
    expect(corta[corta.length - 1]).toEqual(u('última'));
    expect(ordenarVueltas(corta)).toEqual(corta);
  });
});
