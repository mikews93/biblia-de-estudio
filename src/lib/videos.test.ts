import { describe, expect, it } from 'vitest';

import { enlacesDeYoutube, idDeYoutube, parrafosDeTranscripcion } from './videos';

describe('videos de YouTube', () => {
  it('reconoce los enlaces de YouTube y su id', () => {
    expect(idDeYoutube('https://youtu.be/abcdefghijk?si=x')).toBe('abcdefghijk');
    expect(idDeYoutube('https://www.youtube.com/watch?app=desktop&v=abcdefghijk&t=30s')).toBe('abcdefghijk');
    expect(idDeYoutube('https://m.youtube.com/shorts/abcdefghijk')).toBe('abcdefghijk');
    expect(idDeYoutube('https://www.youtube.com/live/abcdefghijk')).toBe('abcdefghijk');
    expect(idDeYoutube('https://vimeo.com/123')).toBeNull();
    const texto = 'Mira este https://youtu.be/abcdefghijk. y este (https://www.youtube.com/watch?v=abcdefghijk) y https://youtu.be/zyxwvutsrqp';
    expect(enlacesDeYoutube(texto)).toEqual(['https://youtu.be/abcdefghijk', 'https://youtu.be/zyxwvutsrqp']);
  });

  it('deja la transcripción copiada de YouTube en párrafos, sin marcas de tiempo', () => {
    const copiada = 'Transcripción\n0:00\nBuenas noches, iglesia.\n0:03\nHoy vamos a Mateo 14.\n1:02:03\nPedro caminó sobre el agua.';
    expect(parrafosDeTranscripcion(copiada)).toEqual(['Buenas noches, iglesia. Hoy vamos a Mateo 14. Pedro caminó sobre el agua.']);
    const larga = Array.from({ length: 60 }, (_, i) => `Frase número ${i} del sermón.`).join('\n');
    const parrafos = parrafosDeTranscripcion(larga);
    expect(parrafos.length).toBeGreaterThan(2);
    expect(parrafos.every((p) => p.endsWith('.'))).toBe(true);
    expect(parrafosDeTranscripcion('   \n')).toEqual([]);
  });
});
