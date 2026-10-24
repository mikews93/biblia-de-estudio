import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Turn } from './estudio';

const respuesta: Turn = { role: 'assistant', text: '## Para mejorar\n- La idea central tiene dos frases ⟦1⟧', sources: [{ n: 1, label: 'Nehemías 4:14' }] };

describe('lo que se hacía en el Taller', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('sigue ahí al volver a abrir la app, con la vista y las conversaciones mezcladas por clave', async () => {
    const { guardarTallerIa, guardarYa } = await import('./tallerIa');
    await guardarTallerIa('m1', { vista: { paso: 'bosquejo', ia: { modo: 'revisar', paso: 'bosquejo' } } });
    await guardarTallerIa('m1', { convs: { revisar: [respuesta] } });
    await guardarTallerIa('m1', { convs: { preguntar: [{ role: 'assistant', text: '- ¿Quién habla?' }] } });
    guardarYa();

    vi.resetModules();
    const fresh = await import('./tallerIa');
    const e = await fresh.leerTallerIa('m1');
    expect(e?.vista).toEqual({ paso: 'bosquejo', ia: { modo: 'revisar', paso: 'bosquejo' } });
    expect(e?.convs?.revisar).toEqual([respuesta]);
    expect(e?.convs?.preguntar?.[0].text).toBe('- ¿Quién habla?');
  });

  it('guarda la respuesta cortada, quita las vacías y olvida una pestaña que vuelve a empezar', async () => {
    const { guardarTallerIa, leerTallerIa } = await import('./tallerIa');
    await guardarTallerIa('m2', {
      convs: {
        revisar: [respuesta, { role: 'user', text: '¿Puedes acomodarlo?' }, { role: 'assistant', text: 'Un esquema para', cortada: true }],
        sugerir: [{ role: 'assistant', text: '' }],
      },
    });
    let e = await leerTallerIa('m2');
    expect(e?.convs?.revisar?.[2]).toEqual({ role: 'assistant', text: 'Un esquema para', cortada: true });
    expect(e?.convs?.sugerir).toBeUndefined();

    await guardarTallerIa('m2', { convs: { revisar: [] } });
    e = await leerTallerIa('m2');
    expect(e?.convs).toBeUndefined();
  });

  it('recorta las conversaciones que no caben y borra la entrada del mensaje', async () => {
    const { borrarTallerIa, guardarTallerIa, leerTallerIa } = await import('./tallerIa');
    const largo = Array.from({ length: 40 }, (_, i): Turn => ({ role: i % 2 ? 'user' : 'assistant', text: `${i} `.padEnd(8000, 'x') }));
    await guardarTallerIa('m3', { convs: { revisar: largo } });
    const e = await leerTallerIa('m3');
    expect(JSON.stringify(e).length).toBeLessThan(180_000);
    expect(e?.convs?.revisar?.at(-1)?.text.startsWith('39 ')).toBe(true);

    await borrarTallerIa('m3');
    expect(await leerTallerIa('m3')).toBeNull();
  });
});
