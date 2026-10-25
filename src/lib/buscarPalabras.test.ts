import { describe, expect, it } from 'vitest';

import { WordIndex, fuse, normalize, stem } from './buscarPalabras';

const docs = [
  { ref: 'php.4.13', text: 'Todo lo puedo en Cristo que me fortalece.' },
  { ref: 'pro.3.15', text: 'Más preciosa es que las piedras preciosas; y todo lo que puedes desear, no se puede comparar á ella.' },
  { ref: 'luk.6.37', text: 'No juzguéis, y no seréis juzgados: perdonad, y seréis perdonados.' },
  { ref: 'pro.31.10', text: 'Mujer fuerte, ¿quién la hallará? Porque su estima sobrepuja largamente á la de piedras preciosas.' },
  { ref: '1ti.2.9', text: 'Asimismo también las mugeres, ataviándose en hábito honesto.' },
];

describe('búsqueda por palabras', () => {
  it('iguala tildes y grafías antiguas, y busca por la raíz', () => {
    expect(normalize('Á las MUGERES')).toBe('a las mujeres');
    expect(stem('perdonados')).toBe(stem('perdonad'));
    expect(stem('mujeres')).toBe(stem('mujer'));
  });

  it('un fragmento recordado sale primero, con sus palabras seguidas', () => {
    const index = new WordIndex(docs);
    const [first] = index.search('todo lo puedo en Cristo');
    expect(first.ref).toBe('php.4.13');
    expect(first.phrase).toBe(1);
    expect(index.search('perdonar').map((h) => h.ref)).toEqual(['luk.6.37']);
    expect(index.search('mujeres').map((h) => h.ref).sort()).toEqual(['1ti.2.9', 'pro.31.10']);
    expect(index.text('php.4.13')).toBe(docs[0].text);
  });

  it('sin palabras que busquen algo no devuelve nada', () => {
    expect(new WordIndex(docs).search('de la que')).toEqual([]);
  });

  it('mezcla listas subiendo lo que sale en varias', () => {
    expect(fuse([{ refs: ['a', 'b'] }, { refs: ['b', 'c'] }])).toEqual(['b', 'a', 'c']);
  });
});
