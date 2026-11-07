import AsyncStorage from '@react-native-async-storage/async-storage';
import { describe, expect, it } from 'vitest';

import type { Turn } from './estudio';
import { estudioPrevio, paraLaIA, prepararDesdeEstudio, preguntasParaBorrador } from './estudioASermon';
import { leerTallerIa } from './tallerIa';

const fuente = (n: number, label: string) => ({ n, label, ref: '', text: '' }) as unknown as NonNullable<Turn['sources']>[number];
const TURNS: Turn[] = [
  { role: 'assistant', text: '## Panorama\nDios ama al mundo.⟦1⟧ Lo dice ⟪Juan 3:16⟫.', sources: [fuente(1, 'Juan 3:16')] },
  { role: 'user', text: '¿Qué significa unigénito?' },
  { role: 'assistant', text: 'Único en su clase.⟦1⟧', sources: [fuente(1, 'Diccionario: unigénito')] },
  { role: 'user', text: '¿Y el mundo?' },
  { role: 'assistant', text: 'Una respuesta a medias', cortada: true },
  { role: 'user', text: '¿Cómo lo aplico?' },
];
const PASAJE = { book: 'jhn', chapter: 3, verse: 16, cita: 'Juan 3:16' };

describe('convertir un estudio profundo en sermón', () => {
  it('toma el estudio y solo las preguntas con su respuesta entera, con las citas como referencias', () => {
    const e = estudioPrevio(PASAJE, TURNS)!;
    expect(e.texto).toBe('## Panorama\nDios ama al mundo. (Juan 3:16) Lo dice Juan 3:16.');
    expect(e.preguntas).toEqual([{ pregunta: '¿Qué significa unigénito?', respuesta: 'Único en su clase. (Diccionario: unigénito)' }]);
    expect(paraLaIA(e)).toEqual({ cita: 'Juan 3:16', texto: e.texto, preguntas: e.preguntas });
    expect(preguntasParaBorrador(e)).toContain('- «¿Qué significa unigénito?»');
  });

  it('sin estudio no hay nada que llevar; las respuestas largas se recortan', () => {
    expect(estudioPrevio(PASAJE, [])).toBeNull();
    const largo = estudioPrevio(PASAJE, [TURNS[0], { role: 'user', text: 'x?' }, { role: 'assistant', text: 'palabra '.repeat(1000) }])!;
    expect(largo.preguntas[0].respuesta.length).toBeLessThanOrEqual(3500);
    expect(largo.preguntas[0].respuesta.endsWith('…')).toBe(true);
  });

  it('empieza una preparación nueva de sermón con el estudio y sin la investigación de antes', async () => {
    await AsyncStorage.clear();
    const { guardarTallerIa } = await import('./tallerIa');
    await guardarTallerIa('preparar', { vista: { texto: 'Otra cosa', etapa: 'investigar' }, convs: { investigar: [{ role: 'assistant', text: 'vieja' }] } });
    await prepararDesdeEstudio(estudioPrevio(PASAJE, TURNS)!);
    const g = await leerTallerIa('preparar');
    expect(g?.vista).toMatchObject({ tipo: 'sermon', etapa: 'orar', texto: expect.stringContaining('Juan 3:16'), estudio: { cita: 'Juan 3:16' } });
    expect(g?.convs?.investigar).toBeUndefined();
  });
});
