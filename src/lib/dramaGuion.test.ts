import { describe, expect, it } from 'vitest';

import { caracteres, leerGuion, revisarGuion } from './dramaGuion';

const VERSOS: [number, string][] = [
  [1, 'Y Jesús les dijo: Vengan en pos de mí.'],
  [2, 'Y luego, dejando sus redes, le siguieron.'],
  [3, 'Y pasando de allí un poco más adelante, vio a Jacobo.'],
];

describe('revisarGuion', () => {
  it('reparte un versículo entre voces si dice el texto exacto (sin importar tildes ni signos)', () => {
    const { plan, corregidos } = revisarGuion(
      ['ESCENA Junto al mar | ambiente: calm lake shore', '1 NARRADOR: Y Jesus les dijo:', '1 JESUS [calm]: “Vengan en pos de mí”.', '2 NARRADOR: Y luego, dejando sus redes, le siguieron.', '3 NARRADOR: Y pasando de allí un poco más adelante, vio a Jacobo.'].join('\n'),
      VERSOS,
    );
    expect(corregidos).toEqual([]);
    expect(plan.escenas).toHaveLength(1);
    expect(plan.escenas[0].ambiente).toBe('calm lake shore');
    const v1 = plan.escenas[0].pasos[0];
    expect('v' in v1 && v1.lineas.map((l) => [l.voz, l.tag])).toEqual([['NARRADOR', undefined], ['JESUS', '[calm]']]);
  });

  it('el versículo que cambia, falta o llega desordenado lo lee el narrador tal cual y en su lugar', () => {
    const { plan, corregidos } = revisarGuion(['3 PEDRO: Vio a Jacobo y a Juan.', '1 NARRADOR: Y Jesús les dijo: Vengan en pos de mí.'].join('\n'), VERSOS);
    const pasos = plan.escenas.flatMap((e) => e.pasos).filter((p) => 'v' in p);
    expect(pasos.map((p) => ('v' in p ? p.v : 0))).toEqual([1, 2, 3]);
    expect(corregidos).toEqual([2, 3]);
    const v3 = pasos[2];
    expect('v' in v3 && v3.lineas).toEqual([{ voz: 'NARRADOR', texto: VERSOS[2][1] }]);
    // PEDRO no llegó a hablar: no se le busca voz.
    expect(plan.personajes).toEqual([]);
  });

  it('sin guion (la IA falló), todo lo lee el narrador; la voz de Dios desde el cielo cuenta tres veces', () => {
    const { plan } = revisarGuion('', VERSOS);
    expect(plan.escenas[0].pasos).toHaveLength(3);
    const conDios = revisarGuion('1 DIOS aprobacion: Y Jesús les dijo: Vengan en pos de mí.', VERSOS).plan;
    expect(caracteres(conDios)).toBeGreaterThan(caracteres(plan) + 2 * VERSOS[0][1].length);
  });

  it('limita los efectos y declara las voces que la IA no declaró', () => {
    const efectos = Array.from({ length: 8 }, (_, i) => `EFECTO sonido ${i} | 9`).join('\n');
    const { plan } = revisarGuion(`${efectos}\n1 GENTE: Y Jesús les dijo: Vengan en pos de mí.`, VERSOS);
    const pasos = plan.escenas.flatMap((e) => e.pasos);
    expect(pasos.filter((p) => 'efecto' in p)).toHaveLength(3);
    expect(pasos.find((p) => 'efecto' in p)).toMatchObject({ dur: 6 });
    expect(plan.personajes).toEqual([{ id: 'GENTE', genero: 'hombre', edad: 'adulto', nombre: 'GENTE' }]);
  });
});

describe('la hoja de dirección', () => {
  it('lee el tono, el espacio, el ritmo, la dirección, los sonidos y las pausas de cada escena', () => {
    const { plan, corregidos } = revisarGuion(
      [
        'TONO Tensión',
        'ESCENA En la barca | ritmo: vivo | ambiente: storm wind, waves hitting a wooden boat | espacio: abierto',
        'DIRECCION Miedo creciente; Jesús duerme y luego habla con calma.',
        '1 NARRADOR [urgent]: Y Jesús les dijo:',
        'SONIDO oars splashing | 3',
        '1 JESUS [calm]: Vengan en pos de mí.',
        'PAUSA 1,5',
        'ESCENA En la casa | espacio: Interior | ritmo: rapidísimo',
        '2 NARRADOR: Y luego, dejando sus redes, le siguieron.',
        '3 NARRADOR: Y pasando de allí un poco más adelante, vio a Jacobo.',
      ].join('\n'),
      VERSOS,
    );
    expect(corregidos).toEqual([]);
    expect(plan.tono).toBe('tension');
    const [barca, casa] = plan.escenas;
    expect(barca).toMatchObject({ ritmo: 'vivo', espacio: 'abierto', ambiente: 'storm wind, waves hitting a wooden boat', direccion: 'Miedo creciente; Jesús duerme y luego habla con calma.' });
    expect(barca.pasos.filter((p) => !('v' in p))).toEqual([{ sonido: 'oars splashing', dur: 3 }, { pausa: 1.5 }]);
    // Un ritmo que no existe se ignora.
    expect(casa).toMatchObject({ espacio: 'interior' });
    expect(casa.ritmo).toBeUndefined();
  });

  it('deja hasta dos indicaciones dentro del texto y quita las que no se oyen', () => {
    const { plan, corregidos } = revisarGuion(
      '1 JESUS [smiling] [warm]: Y Jesús [laughs] les dijo: [short pause] Vengan [nods] en pos [sighs] de [whispers] mí.',
      VERSOS,
    );
    // Solo el v. 1 viene en el guion: los otros los lee el narrador.
    expect(corregidos).toEqual([2, 3]);
    const linea = 'v' in plan.escenas[0].pasos[0] ? plan.escenas[0].pasos[0].lineas[0] : null;
    // A Jesús no se le ríe ni se le ponen gestos; de las que valen quedan dos.
    expect(linea).toMatchObject({ tag: '[warm]', texto: 'Y Jesús les dijo: [short pause] Vengan en pos [sighs] de mí.' });
  });

  it('a la voz de Dios no se le ponen indicaciones (su registro dice cómo suena)', () => {
    const { items } = leerGuion('1 DIOS poder [angry]: Y Jesús [shouts] les dijo: Vengan en pos de mí.');
    expect(items[0]).toMatchObject({ linea: { voz: 'DIOS', registro: 'poder', texto: 'Y Jesús les dijo: Vengan en pos de mí.' } });
    expect('linea' in items[0] && items[0].linea.tag).toBeUndefined();
  });
});
