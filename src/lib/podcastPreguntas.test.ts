import { afterEach, describe, expect, it, vi } from 'vitest';

import * as estudio from './estudio';
import { savedConversation } from './misPreguntas';
import type { Line } from './podcast';
import { conversacionPodcast, guionDe, momentoDe } from './podcastPreguntas';

const lines: Line[] = [
  { speaker: 'ana', text: 'Nicodemo llega de noche.', cites: [1] },
  { speaker: 'tomas', text: 'Y Jesús le habla de nacer de nuevo.', cites: [] },
];

afterEach(() => vi.restoreAllMocks());

describe('preguntas durante el pódcast', () => {
  it('el guion vuelve al formato de la IA y el momento dice quién hablaba', () => {
    expect(guionDe(lines)).toBe('ANA: Nicodemo llega de noche.\nTOMÁS: Y Jesús le habla de nacer de nuevo.');
    expect(momentoDe(lines, 1)).toBe('Tomás: Y Jesús le habla de nacer de nuevo.');
    expect(momentoDe(lines, null)).toBeUndefined();
    expect(momentoDe(lines, 7)).toBeUndefined();
    expect(momentoDe([{ speaker: 'ana', text: 'a'.repeat(2000), cites: [] }], 0)!.length).toBe(900);
  });

  it('pregunta con el guion delante y lo que sonaba, y guarda la conversación solo en el dispositivo', async () => {
    const ask = vi.spyOn(estudio, 'askStudy').mockImplementation(async (_req, onUpdate) => {
      onUpdate('Nacer de nuevo es…', [], []);
      return { text: 'Nacer de nuevo es…', sources: [] };
    });
    const c = conversacionPodcast('jhn', 3);
    await c.preguntar(lines, '¿Qué es nacer de nuevo?', momentoDe(lines, 1));
    const req = ask.mock.calls[0][0];
    expect(req).toMatchObject({ book: 'jhn', chapter: 3, herramienta: 'podcast', momento: 'Tomás: Y Jesús le habla de nacer de nuevo.' });
    expect(req.messages).toEqual([
      { role: 'assistant', text: guionDe(lines) },
      { role: 'user', text: '¿Qué es nacer de nuevo?' },
    ]);
    expect(c.estado.turns.at(-1)).toMatchObject({ role: 'assistant', text: 'Nacer de nuevo es…' });
    expect(await savedConversation('podcast:jhn:3::')).toHaveLength(3);

    // La siguiente lleva la conversación anterior
    await c.preguntar(lines, '¿Y el viento?');
    expect(ask.mock.calls[1][0].messages.map((t) => t.text)).toEqual([guionDe(lines), '¿Qué es nacer de nuevo?', 'Nacer de nuevo es…', '¿Y el viento?']);

    c.borrar();
    expect(c.estado.turns).toEqual([]);
  });

  it('si falla, la pregunta queda para reintentarla sin escribirla otra vez', async () => {
    const ask = vi.spyOn(estudio, 'askStudy').mockRejectedValueOnce(new Error('Sin red'));
    const c = conversacionPodcast('jhn', 4);
    await c.preguntar(lines, '¿Quién era la samaritana?');
    expect(c.estado.error).toBe('Sin red');
    expect(c.estado.turns.at(-1)).toEqual({ role: 'user', text: '¿Quién era la samaritana?' });
    ask.mockResolvedValueOnce({ text: 'Una mujer de Sicar.', sources: [] });
    await c.preguntar(lines, null);
    expect(ask.mock.calls[1][0].messages.at(-1)).toEqual({ role: 'user', text: '¿Quién era la samaritana?' });
    expect(c.estado.error).toBeNull();
    expect(c.estado.turns).toHaveLength(3);
  });
});
