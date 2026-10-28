import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { PALABRAS, conArticulo, palabraDe } from './diccionario';

describe('palabraDe', () => {
  it('reconoce la palabra sola, con artículo o dentro de una pregunta corta', () => {
    expect(palabraDe('Getsemaní')?.id).toBe('getsemani');
    expect(palabraDe('getsemani')?.id).toBe('getsemani');
    expect(palabraDe('la gracia')?.id).toBe('gracia');
    expect(palabraDe('¿Qué es la gracia?')?.id).toBe('gracia');
    expect(palabraDe('quiénes eran los fariseos')?.id).toBe('fariseos');
    expect(palabraDe('¿Qué significa propiciación?')?.id).toBe('propiciacion');
    expect(palabraDe('menorá')?.id).toBe('candelero');
  });

  it('deja fuera las búsquedas y preguntas que no son una palabra del diccionario', () => {
    expect(palabraDe('Todo lo puedo en Cristo')).toBeUndefined();
    expect(palabraDe('¿Qué dice la Biblia sobre la ansiedad cuando todo va mal?')).toBeUndefined();
    expect(palabraDe('Juan 3:16')).toBeUndefined();
  });
});

describe('conArticulo', () => {
  it('nombra la palabra como se diría en la pregunta', () => {
    expect(conArticulo('Gracia')).toBe('la gracia');
    expect(conArticulo('Fariseos')).toBe('los fariseos');
    expect(conArticulo('Fe')).toBe('la fe');
    expect(conArticulo('Arca del pacto')).toBe('el arca del pacto');
    expect(conArticulo('Getsemaní')).toBe('Getsemaní');
    expect(conArticulo('Amén')).toBe('la palabra «amén»');
    expect(conArticulo('Panes sin levadura')).toBe('los panes sin levadura');
  });
});

describe('PALABRAS', () => {
  it('cada palabra abre una entrada o un tema que existe en los datos', () => {
    const ix = JSON.parse(gunzipSync(readFileSync('pipeline/diccionario/indice.json.gz')).toString()) as { d: string[]; n: string[] };
    const d = new Set(ix.d);
    const n = new Set(ix.n);
    for (const p of PALABRAS) {
      expect(p.entrada || p.tema, p.nombre).toBeTruthy();
      if (p.entrada) expect(d.has(p.entrada), `${p.nombre}: ${p.entrada}`).toBe(true);
      if (p.tema) expect(n.has(p.tema), `${p.nombre}: ${p.tema}`).toBe(true);
    }
    expect(new Set(PALABRAS.map((p) => p.id)).size).toBe(PALABRAS.length);
  });
});
