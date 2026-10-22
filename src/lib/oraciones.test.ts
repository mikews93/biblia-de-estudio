import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Entrada } from './diario';

const salmo = { book: 'psa', chapter: 23, verse: 1, reference: 'Salmo 23:1', text: 'Jehová es mi pastor; nada me faltará.' };
const filipenses = { book: 'php', chapter: 4, verse: 6, reference: 'Filipenses 4:6', text: 'Por nada estéis afanosos…' };
const fecha = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9).getTime();

describe('diario de oración', () => {
  beforeEach(async () => {
    vi.resetModules();
    await AsyncStorage.clear();
  });

  const saved = async () => JSON.parse((await AsyncStorage.getItem('oraciones'))!);

  it('crea una petición con el versículo del lector, sin repetirlo al unirlo otra vez', async () => {
    const { nuevaOracion, acompanar } = await import('./oraciones');
    const id = await nuevaOracion('  Trabajo para papá ', '', salmo);
    await acompanar(id, salmo);
    await acompanar(id, filipenses);
    const [o] = await saved();
    expect(o.titulo).toBe('Trabajo para papá');
    expect(o.detalle).toBeUndefined();
    expect(o.versiculos.map((v: { reference: string }) => v.reference)).toEqual(['Salmo 23:1', 'Filipenses 4:6']);
  });

  it('marca y desmarca la respuesta', async () => {
    const { nuevaOracion, responder, seguirOrando } = await import('./oraciones');
    const id = await nuevaOracion('Salud de Ana');
    await responder(id, ' Salió bien la operación ', 5000);
    expect((await saved())[0].respondida).toEqual({ fecha: 5000, nota: 'Salió bien la operación' });
    await seguirOrando(id);
    expect((await saved())[0].respondida).toBeUndefined();
  });

  it('cuenta cuánto tiempo se oró', async () => {
    const { cuantoTiempo } = await import('./oraciones');
    expect(cuantoTiempo(fecha(2025, 1, 1), fecha(2025, 1, 1))).toBe('el mismo día');
    expect(cuantoTiempo(fecha(2025, 1, 1), fecha(2025, 1, 4))).toBe('después de 3 días');
    expect(cuantoTiempo(fecha(2025, 1, 1), fecha(2025, 1, 22))).toBe('después de 3 semanas');
    expect(cuantoTiempo(fecha(2025, 1, 1), fecha(2025, 6, 1))).toBe('después de 5 meses');
    expect(cuantoTiempo(fecha(2024, 1, 1), fecha(2025, 3, 1))).toBe('después de un año y 2 meses');
  });

  it('arma «Mi camino» por año y mes, con las respuestas y los versículos de cada momento', async () => {
    const { momentos, porAno } = await import('./oraciones');
    const entrada: Entrada = {
      id: 'e1',
      book: 'jhn',
      chapter: 3,
      verse: 16,
      reference: 'Juan 3:16',
      palabra: 'de tal manera amó',
      oracion: '',
      paso: '',
      llevar: { verse: 17, text: 'Porque no envió Dios…' },
      created: fecha(2025, 3, 2),
    };
    const oracion = {
      id: 'o1',
      titulo: 'Trabajo para papá',
      created: fecha(2024, 11, 5),
      versiculos: [{ ...salmo, added: fecha(2024, 11, 5) }],
      respondida: { fecha: fecha(2025, 3, 20), nota: 'Lo contrataron' },
    };
    const lista = momentos([entrada], [oracion]);
    expect(lista.map((m) => m.tipo)).toEqual(['respuesta', 'devocional', 'peticion']);
    expect(lista[1].versiculos[0].reference).toBe('Juan 3:17');
    const anos = porAno(lista);
    expect(anos.map((a) => a.ano)).toEqual([2025, 2024]);
    expect(anos[0]).toMatchObject({ respondidas: 1, versiculos: 2 });
    expect(anos[0].meses).toHaveLength(1);
    expect(anos[0].meses[0].momentos.map((m) => m.tipo)).toEqual(['respuesta', 'devocional']);
  });

  it('recuerda un momento de hace un año cerca de esta fecha', async () => {
    const { momentos, unDiaComoHoy } = await import('./oraciones');
    const oracion = { id: 'o1', titulo: 'Paz', created: fecha(2024, 10, 18), versiculos: [{ ...salmo, added: 0 }] };
    const lista = momentos([], [oracion]);
    expect(unDiaComoHoy(lista, fecha(2025, 10, 21))).toMatchObject({ anos: 1, momento: { titulo: 'Paz' } });
    expect(unDiaComoHoy(lista, fecha(2025, 12, 21))).toBeNull();
    expect(unDiaComoHoy(lista, fecha(2024, 10, 21))).toBeNull();
  });
});
