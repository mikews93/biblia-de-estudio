import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-application', () => ({ nativeApplicationVersion: null, nativeBuildVersion: null }));
vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0', extra: { compilacion: { commit: 'a1b2c3d4e5f6', fecha: '2026-10-27T14:00:00Z', rama: 'main' } } } },
}));

import { compilacion, type Compilacion, estado, etiqueta, textoParaReportar } from './version';

const web: Compilacion = { version: '1.0.0', build: null, commit: 'a1b2c3d4e5f6', fecha: '2026-10-27T14:00:00Z', rama: 'main', plataforma: 'web', instalada: true };

describe('versión de la app', () => {
  it('lee el commit y la fecha que dejó app.config.ts', () => {
    expect(compilacion()).toMatchObject({ version: '1.0.0', build: null, commit: 'a1b2c3d4e5f6', plataforma: 'web' });
  });

  it('muestra la versión con el commit corto, y la compilación de la tienda si la hay', () => {
    expect(etiqueta(web)).toBe('1.0.0 · a1b2c3d');
    expect(etiqueta({ ...web, build: '3', plataforma: 'android' })).toBe('1.0.0 (3) · a1b2c3d');
    expect(etiqueta({ ...web, commit: '' })).toBe('1.0.0');
  });

  it('sabe si hay una versión más nueva publicada', () => {
    expect(estado(web, { commit: 'a1b2c3d4e5f6', fecha: '2026-10-27T14:00:00Z' })).toBe('al-dia');
    expect(estado(web, { commit: 'ffff', fecha: '2026-10-28T09:00:00Z' })).toBe('nueva');
    // Una vista previa más reciente que lo publicado no pide actualizar.
    expect(estado(web, { commit: 'ffff', fecha: '2026-10-26T09:00:00Z' })).toBe('al-dia');
    expect(estado(web, null)).toBe('desconocido');
  });

  it('arma los datos para reportar un fallo', () => {
    const t = textoParaReportar(web, 'Chrome/141');
    expect(t).toContain('Zarza 1.0.0 · a1b2c3d');
    expect(t).toContain('App web instalada');
    expect(t).toContain('Commit: a1b2c3d4e5f6');
    expect(t).toContain('Navegador: Chrome/141');
    expect(t).not.toContain('Rama');
  });
});
