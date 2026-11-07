import { describe, expect, it } from 'vitest';

import { antesDe, aplicarCambio, borradorParaCambiar, huellaDe, leerBorrador, leerCambios, parteDe, partesDelRepaso, partesParaEscuchar, valeCambio } from './borrador';
import type { Mensaje } from './taller';

const respuesta = `# Mira a Jesús, no a las olas

## Idea central
- Tema: La ansiedad | Complemento: se vence mirando a Jesús y no al viento ⟦1⟧

## Bienvenida | 10
¿Qué te quita el sueño? Todos tenemos una tormenta.
> dinámica: pregunta-en-ronda
* Romper el hielo con honestidad

## Jesús te mandó al barco | 12
Los discípulos no estaban en la tormenta por desobedecer ⟦2⟧.

Jesús los mandó (Mateo 14:22).
> dinámica: no-existe
* Estar en la tormenta no es estar fuera de su voluntad
* Él ora por ti en el monte
`;

describe('leerBorrador', () => {
  it('lee el título, la idea central y cada parte con sus minutos, dinámica y puntos clave', () => {
    const b = leerBorrador(respuesta);
    expect(b.titulo).toBe('Mira a Jesús, no a las olas');
    expect(b.idea).toEqual({ tema: 'La ansiedad', complemento: 'se vence mirando a Jesús y no al viento' });
    expect(b.partes.map((p) => [p.titulo, p.minutos, p.dinamica])).toEqual([
      ['Bienvenida', 10, 'pregunta-en-ronda'],
      ['Jesús te mandó al barco', 12, undefined],
    ]);
    expect(b.partes[1].texto).toBe('Los discípulos no estaban en la tormenta por desobedecer ⟦2⟧.\n\nJesús los mandó (Mateo 14:22).');
    expect(b.partes[1].claves).toEqual(['Estar en la tormenta no es estar fuera de su voluntad', 'Él ora por ti en el monte']);
  });

  it('lee los pasos de la dinámica escritos para quienes la hacen', () => {
    const b = leerBorrador(`# T

## Introducción | 5
Texto.
> dinámica: recuento-en-cadena
> paso: Lean Lucas 15:11-24 y cierren la Biblia.
> paso: Cada uno cuenta un pedazo de la historia con sus palabras.
* Punto

## Cierre | 3
> paso: suelto, sin dinámica`);
    expect(b.partes[0].dinamica).toBe('recuento-en-cadena');
    expect(b.partes[0].pasos).toEqual(['Lean Lucas 15:11-24 y cierren la Biblia.', 'Cada uno cuenta un pedazo de la historia con sus palabras.']);
    expect(b.partes[0].texto).toBe('Texto.');
    expect(b.partes[1].pasos).toBeUndefined();
  });

  it('mientras llega, devuelve lo que ya está', () => {
    const b = leerBorrador('# Título\n\n## Introducción | 5\nUna frase a me');
    expect(b.partes).toHaveLength(1);
    expect(b.partes[0].texto).toBe('Una frase a me');
  });
});

const mensaje: Mensaje = {
  id: 'm1',
  tipo: 'encuentro',
  titulo: 'Mira a Jesús',
  pasaje: { book: 'mat', chapter: 14, from: 22, to: 33 },
  plantilla: '4e',
  observacion: '',
  tema: 'La ansiedad',
  complemento: 'se vence mirando a Jesús',
  necesidad: '',
  gracia: '',
  secciones: [
    { id: 'a1', titulo: 'Bienvenida', ayuda: '', texto: '¿Qué te quita el sueño?', minutos: 10, dinamica: 'pregunta-en-ronda' },
    { id: 'b2', titulo: 'Pedro mira el viento', ayuda: '', texto: 'Al ver el viento tuvo miedo (Mateo 14:30).', minutos: 15 },
  ],
  revision: [],
  seguimiento: '',
  minutos: 25,
  creado: '2026-11-07T10:00:00.000Z',
  actualizado: '2026-11-07T10:00:00.000Z',
  anuncios: 'Retiro el 22',
  ia: '2026-11-07T10:00:00.000Z',
};

describe('cambiar el borrador hablando', () => {
  it('manda cada parte con su id', () => {
    const t = borradorParaCambiar(mensaje);
    expect(t).toContain('[titulo:b2] Pedro mira el viento | 15 min');
    expect(t).toContain('[texto:b2]\nAl ver el viento tuvo miedo (Mateo 14:30).');
  });

  it('lee la explicación y los bloques, y descarta los ids que no conoce', () => {
    const r = leerCambios(`Cambié el punto 2 para usar Isaías 43:2 ⟦1⟧.

@@ texto:b2
Cuando pases por las aguas, Él estará contigo ⟦1⟧.

Pedro lo vivió.

@@ cualquier-cosa
no vale

@@ nueva:despues:b2
## Oración en parejas | 5
Oren de dos en dos.`);
    expect(r.resumen).toBe('Cambié el punto 2 para usar Isaías 43:2 ⟦1⟧.');
    expect(r.cambios).toEqual([
      { destino: 'texto:b2', texto: 'Cuando pases por las aguas, Él estará contigo ⟦1⟧.\n\nPedro lo vivió.' },
      { destino: 'nueva:despues:b2', titulo: 'Oración en parejas', minutos: 5, texto: 'Oren de dos en dos.' },
    ]);
  });

  it('aplica un cambio de texto con las citas como referencias, y una parte nueva en su sitio', () => {
    const sources = [{ n: 1, label: 'Isaías 43' }];
    const a = aplicarCambio(mensaje, { destino: 'texto:b2', texto: 'Él estará contigo ⟦1⟧.' }, sources);
    expect(a.secciones![1].texto).toBe('Él estará contigo (Isaías 43).');
    expect(a.secciones![0]).toBe(mensaje.secciones[0]);
    const n = aplicarCambio(mensaje, { destino: 'nueva:despues:a1', titulo: 'Oración', minutos: 5, texto: 'Oren.' }, []);
    expect(n.secciones!.map((s) => s.titulo)).toEqual(['Bienvenida', 'Oración', 'Pedro mira el viento']);
    expect(aplicarCambio(mensaje, { destino: 'titulo', texto: 'Su mano llega antes' }, [])).toEqual({ titulo: 'Su mano llega antes' });
  });

  it('dice qué había antes, de qué parte es y si la parte sigue', () => {
    const c = { destino: 'texto:b2', texto: 'x' };
    expect(antesDe(mensaje, c)).toBe('Al ver el viento tuvo miedo (Mateo 14:30).');
    expect(parteDe(mensaje, c)).toBe('Pedro mira el viento');
    expect(valeCambio(mensaje, c)).toBe(true);
    expect(valeCambio(mensaje, { destino: 'texto:zz', texto: 'x' })).toBe(false);
  });
});

describe('escucharlo para practicar', () => {
  it('lee el título, cada parte sin las referencias entre paréntesis, y los anuncios', () => {
    expect(partesParaEscuchar(mensaje, 'Mira a Jesús')).toEqual([
      'Mira a Jesús',
      'Bienvenida. ¿Qué te quita el sueño?',
      'Pedro mira el viento. Al ver el viento tuvo miedo.',
      'Anuncios. Retiro el 22',
    ]);
  });

  it('parte el repaso en párrafos sin marcas', () => {
    expect(partesDelRepaso('La idea **central** ⟦1⟧.\n\nLuego vas al barco.\n\n')).toEqual(['La idea central.', 'Luego vas al barco.']);
  });

  it('la huella cambia cuando cambia el texto', () => {
    const otra = { ...mensaje, secciones: [{ ...mensaje.secciones[0], texto: 'Otro' }, mensaje.secciones[1]] };
    expect(huellaDe(mensaje)).toBe(huellaDe({ ...mensaje }));
    expect(huellaDe(otra)).not.toBe(huellaDe(mensaje));
  });
});
