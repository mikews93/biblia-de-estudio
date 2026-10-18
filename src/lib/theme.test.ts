import AsyncStorage from '@react-native-async-storage/async-storage';
import { describe, expect, it } from 'vitest';

import { getLastRead, isDark, saveLastRead, themeSwatches } from './theme';

describe('tema y última lectura', () => {
  it('solo el tema oscuro cuenta como oscuro', () => {
    const colors = Object.fromEntries(themeSwatches.map((t) => [t.name, t.colors]));
    expect(colors.auto).toBeNull();
    expect(isDark(colors.oscuro!)).toBe(true);
    expect(isDark(colors.claro!)).toBe(false);
    expect(isDark(colors.sepia!)).toBe(false);
  });

  it('recuerda dónde se quedó la persona y aguanta datos dañados', async () => {
    expect(await getLastRead()).toBeNull();
    await saveLastRead('rom', 8);
    expect(await getLastRead()).toEqual({ book: 'rom', chapter: 8 });
    await AsyncStorage.setItem('ultima-lectura', 'roto');
    expect(await getLastRead()).toBeNull();
  });
});
