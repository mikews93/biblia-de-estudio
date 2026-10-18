import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('resaltados', () => {
  beforeEach(() => vi.resetModules());

  it('pone, cambia y quita el color de un versículo', async () => {
    const { highlightOf, setHighlight } = await import('./highlights');
    expect(highlightOf('jhn', 3, 16)).toBeNull();
    await setHighlight('jhn', 3, 16, 'amarillo');
    await setHighlight('jhn', 3, 16, 'verde');
    await setHighlight('jhn', 3, 17, 'rosa');
    expect(highlightOf('jhn', 3, 16)).toBe('verde');
    await setHighlight('jhn', 3, 17, null);
    expect(highlightOf('jhn', 3, 17)).toBeNull();
    expect(Object.keys(JSON.parse((await AsyncStorage.getItem('resaltados'))!))).toEqual(['jhn.3.16']);
  });

  it('lee lo guardado antes en el dispositivo y aguanta datos dañados', async () => {
    await AsyncStorage.setItem('resaltados', JSON.stringify({ 'rom.8.28': { color: 'azul', at: 1 } }));
    const { highlightOf, setHighlight } = await import('./highlights');
    await setHighlight('rom', 8, 1, 'rosa');
    expect(highlightOf('rom', 8, 28)).toBe('azul');

    vi.resetModules();
    await AsyncStorage.setItem('resaltados', '{no es json');
    const fresh = await import('./highlights');
    await fresh.setHighlight('gen', 1, 1, 'verde');
    expect(fresh.highlightOf('gen', 1, 1)).toBe('verde');
  });
});
