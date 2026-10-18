import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('notas personales', () => {
  beforeEach(() => vi.resetModules());

  const saved = async () => JSON.parse((await AsyncStorage.getItem('notas'))!);

  it('guarda el texto sin espacios de más y conserva la fecha de creación al editar', async () => {
    const { setNote } = await import('./notas');
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    await setNote('jhn', 3, 16, '  Mi versículo favorito  ');
    now.mockReturnValue(2000);
    await setNote('jhn', 3, 16, 'Editada');
    now.mockRestore();
    expect(await saved()).toEqual({ 'jhn.3.16': { text: 'Editada', created: 1000, updated: 2000 } });
  });

  it('un texto vacío borra la nota', async () => {
    const { setNote } = await import('./notas');
    await setNote('jhn', 3, 16, 'Algo');
    await setNote('jhn', 3, 17, 'Otra');
    await setNote('jhn', 3, 16, '   ');
    expect(Object.keys(await saved())).toEqual(['jhn.3.17']);
  });

  it('noteKey y parseNoteKey van y vuelven', async () => {
    const { noteKey, parseNoteKey } = await import('./notas');
    expect(parseNoteKey(noteKey('1co', 13, 4))).toEqual({ book: '1co', chapter: 13, verse: 4 });
  });
});
