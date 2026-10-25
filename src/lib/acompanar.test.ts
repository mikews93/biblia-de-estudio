import { describe, expect, it } from 'vitest';

import { consejo, tocaPreguntar, type Paso } from './acompanar';

const DIA = 86_400_000;
const hoy = '2026-10-25';
const ahora = Date.parse(hoy);
const oracion = (id: string, titulo: string, dias: number, extra: object = {}) => ({ id, titulo, created: ahora - dias * DIA, ...extra });

describe('cuándo preguntar «¿cómo sigues?»', () => {
  it('por una carga escrita hace unos días', () => {
    expect(tocaPreguntar([oracion('a', 'Mi ansiedad', 4)], [], hoy)?.oracion.id).toBe('a');
  });

  it('no por una petición recién escrita, ni por una que no es carga, ni por una respondida', () => {
    expect(tocaPreguntar([oracion('a', 'Mi ansiedad', 1)], [], hoy)).toBeNull();
    expect(tocaPreguntar([oracion('b', 'Por el viaje', 10)], [], hoy)).toBeNull();
    expect(tocaPreguntar([oracion('c', 'Mi ansiedad', 10, { respondida: { fecha: ahora } })], [], hoy)).toBeNull();
  });

  it('como mucho una vez por semana, también después de «Ahora no»', () => {
    const o = [oracion('a', 'Mucha tristeza', 20)];
    expect(tocaPreguntar(o, [{ fecha: '2026-10-21', oracion: null }], hoy)).toBeNull();
    expect(tocaPreguntar(o, [{ fecha: '2026-10-18', oracion: 'a', respuesta: 'igual' }], hoy)?.oracion.id).toBe('a');
  });

  it('respeta los temas ocultos, salvo que haya riesgo', () => {
    expect(tocaPreguntar([oracion('a', 'Mi ansiedad', 5)], [], hoy, ['ansiedad'])).toBeNull();
    expect(tocaPreguntar([oracion('r', 'No quiero vivir', 5)], [], hoy, ['tristeza'])?.oracion.id).toBe('r');
  });
});

describe('qué decir después', () => {
  it('si va mejor, gratitud y nada más', () => {
    expect(consejo('mejor', [], hoy)).toMatchObject({ hablar: false, lineas: false });
  });

  it('la primera vez «igual» solo pregunta si lo habló con alguien', () => {
    expect(consejo('igual', [], hoy)).toMatchObject({ hablar: false, preguntarSiHablo: true });
  });

  it('sin mejoría o más difícil, anima a hablar con alguien', () => {
    const previas: Paso[] = [{ fecha: '2026-10-18', oracion: 'a', respuesta: 'igual' }];
    expect(consejo('igual', previas, hoy)).toMatchObject({ hablar: true });
    expect(consejo('dificil', [], hoy)).toMatchObject({ hablar: true, lineas: false });
  });

  it('dos veces «más difícil» seguidas: también las líneas de ayuda', () => {
    expect(consejo('dificil', [{ fecha: '2026-10-18', oracion: 'a', respuesta: 'dificil' }], hoy)).toMatchObject({ lineas: true });
  });

  it('si ya habló con alguien, no se le vuelve a preguntar', () => {
    const previas: Paso[] = [{ fecha: '2026-10-18', oracion: 'a', respuesta: 'igual', hablo: true }];
    expect(consejo('igual', previas, hoy)).toMatchObject({ preguntarSiHablo: false, hablar: false });
  });
});
