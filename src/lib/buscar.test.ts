import AsyncStorage from '@react-native-async-storage/async-storage';
import { describe, expect, it } from 'vitest';

import { IdeaResult, addRecent, clearRecent, getRecent, withVersion } from './buscar';

describe('búsquedas recientes', () => {
  it('la última va primero, sin repetir (sin importar mayúsculas) y como mucho 6', async () => {
    for (const q of ['amor', 'paz', 'fe', 'esperanza', 'gozo', 'perdón', 'gracia']) await addRecent(q);
    expect(await addRecent('  PAZ ')).toEqual(['PAZ', 'gracia', 'perdón', 'gozo', 'esperanza', 'fe']);
    expect(await getRecent()).toHaveLength(6);
  });

  it('borrar y datos dañados', async () => {
    await addRecent('amor');
    await clearRecent();
    expect(await getRecent()).toEqual([]);
    await AsyncStorage.setItem('busquedas', '[roto');
    expect(await getRecent()).toEqual([]);
  });
});

describe('resultados en una versión con derechos', () => {
  const r = (ref: string, version = 'rv1909'): IdeaResult => ({ ref, label: ref, text: `rv ${ref}`, reason: 'r', version });
  const chapter = async (book: string, c: number): Promise<[number, string][]> =>
    book === 'xxx' ? Promise.reject(new Error('sin red')) : Array.from({ length: 40 }, (_, i) => [i + 1, `nbla ${book}.${c}.${i + 1}`]);

  it('cambia el texto de cada pasaje y marca su versión', async () => {
    expect(await withVersion([r('php.4.6'), r('mat.6.33-mat.6.34')], 'nbla', chapter)).toEqual([
      { ...r('php.4.6'), text: 'nbla php.4.6', version: 'nbla' },
      { ...r('mat.6.33-mat.6.34'), text: 'nbla mat.6.33 nbla mat.6.34', version: 'nbla' },
    ]);
  });

  it('no pasa de 25 versículos a la vez y, sin conexión, deja el texto que llegó', async () => {
    const many = Array.from({ length: 4 }, (_, i) => r(`psa.${i + 1}.1-psa.${i + 1}.5`));
    const out = await withVersion([...many, r('xxx.1.1'), r('psa.9.1-psa.9.5'), r('rom.8.28')], 'nbla', chapter);
    // 4 × 5 + el que no se pudo leer = 21; los 5 siguientes no caben y el último sí.
    expect(out.map((x) => x.version)).toEqual(['nbla', 'nbla', 'nbla', 'nbla', 'rv1909', 'rv1909', 'nbla']);
    expect(out[4].text).toBe('rv xxx.1.1');
  });
});
