import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Turn } from './estudio';

const study: Turn = { role: 'assistant', text: '## Panorama\nEl amor de Dios ⟦1⟧', sources: [{ n: 1, label: 'Juan 3:16', ref: 'jhn.3.16' }] };
const question: Turn[] = [study, { role: 'user', text: '¿Qué es el mundo aquí?' }, { role: 'assistant', text: 'Toda la humanidad.', sources: [] }];

describe('mis preguntas', () => {
  beforeEach(async () => {
    vi.resetModules();
    await AsyncStorage.clear();
  });

  it('guarda la conversación solo cuando hay preguntas, y se puede borrar', async () => {
    const { conversationKey, forgetConversation, saveConversation, savedConversation } = await import('./misPreguntas');
    const key = conversationKey('profundo', 'jhn', 3, 16);
    expect(key).toBe('profundo:jhn:3:16:');

    await saveConversation(key, [study]);
    expect(await savedConversation(key)).toBeNull();

    await saveConversation(key, question);
    expect(await savedConversation(key)).toEqual([study, question[1], { role: 'assistant', text: 'Toda la humanidad.' }]);

    // Al volver a abrir la app sigue ahí.
    vi.resetModules();
    const fresh = await import('./misPreguntas');
    expect((await fresh.savedConversation(key))?.[1].text).toBe('¿Qué es el mundo aquí?');

    await fresh.forgetConversation(key);
    expect(await fresh.savedConversation(key)).toBeNull();
  });

  it('olvida las más antiguas al pasar el límite y aguanta datos dañados', async () => {
    await AsyncStorage.setItem('mis-preguntas', '{no es json');
    const { LIMIT, conversationKey, saveConversation, savedConversation } = await import('./misPreguntas');
    for (let i = 1; i <= LIMIT + 2; i++) await saveConversation(conversationKey('devocional', 'psa', i), question);
    expect(await savedConversation(conversationKey('devocional', 'psa', 1))).toBeNull();
    expect(await savedConversation(conversationKey('devocional', 'psa', 2))).toBeNull();
    expect(await savedConversation(conversationKey('devocional', 'psa', 3))).not.toBeNull();
    expect(Object.keys(JSON.parse((await AsyncStorage.getItem('mis-preguntas'))!))).toHaveLength(LIMIT);
  });
});
