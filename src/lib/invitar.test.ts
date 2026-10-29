import { describe, expect, it } from 'vitest';

import { ESTILOS, cleanCode, inviteMessage, inviteUrl, shortUrl, whatsappUrl } from './invitar';

describe('invitar a Zarza', () => {
  it('el enlace usa siempre zarzabiblia.com, con o sin código', () => {
    expect(inviteUrl('AB12CD34')).toBe('https://zarzabiblia.com/i/AB12CD34');
    expect(inviteUrl(null)).toBe('https://zarzabiblia.com');
    expect(shortUrl(inviteUrl('AB12CD34'))).toBe('zarzabiblia.com/i/AB12CD34');
  });

  it('cada mensaje lleva el enlace una sola vez', () => {
    const url = inviteUrl('AB12CD34');
    for (const { value } of ESTILOS) expect(inviteMessage(value, url).split(url)).toHaveLength(2);
  });

  it('WhatsApp recibe el mensaje codificado', () => {
    expect(whatsappUrl('Hola, lee conmigo: https://zarzabiblia.com/i/AB')).toBe(
      'https://wa.me/?text=Hola%2C%20lee%20conmigo%3A%20https%3A%2F%2Fzarzabiblia.com%2Fi%2FAB',
    );
  });

  it('el código se limpia como en el servidor', () => {
    expect(cleanCode('ab12-cd34 ')).toBe('AB12CD34');
    expect(cleanCode(undefined)).toBe('');
  });
});
