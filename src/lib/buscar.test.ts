import AsyncStorage from '@react-native-async-storage/async-storage';
import { describe, expect, it } from 'vitest';

import { addRecent, clearRecent, getRecent } from './buscar';

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
