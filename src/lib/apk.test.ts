import { describe, expect, it } from 'vitest';

import { dispositivo, fechaCorta, leerRelease, megas } from './apk';

const asset = { name: 'zarza.apk', size: 32_925_000, updated_at: '2026-10-30T20:00:00Z', browser_download_url: 'https://x/zarza.apk' };

describe('APK para la web', () => {
  it('lee versión, compilación y tamaño de la release', () => {
    expect(leerRelease({ name: 'Zarza 1.0.0 (7) para Android', assets: [asset] })).toEqual({
      version: '1.0.0',
      build: '7',
      bytes: 32_925_000,
      fecha: '2026-10-30T20:00:00Z',
      url: 'https://x/zarza.apk',
    });
    expect(leerRelease({ name: 'Zarza 1.2.0 para Android', assets: [asset] })?.build).toBeNull();
  });

  it('sin el archivo zarza.apk no hay descarga', () => {
    expect(leerRelease({ name: 'Zarza 1.0.0', assets: [{ ...asset, name: 'otra.apk' }] })).toBeNull();
    expect(leerRelease({})).toBeNull();
  });

  it('reconoce el dispositivo', () => {
    expect(dispositivo('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130', 5)).toBe('android');
    expect(dispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe('iphone');
    expect(dispositivo('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', 5)).toBe('iphone');
    expect(dispositivo('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130', 0)).toBe('computador');
    expect(dispositivo('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe('computador');
  });

  it('escribe tamaño y fecha en español', () => {
    expect(megas(32_925_000)).toBe('31,4 MB');
    expect(fechaCorta('2026-10-30T20:00:00Z', new Date('2026-11-02'))).toBe('30 de octubre');
    expect(fechaCorta('2025-03-01T12:00:00Z', new Date('2026-11-02'))).toBe('1 de marzo de 2025');
  });
});
