import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));
vi.mock('expo-application', () => ({ nativeApplicationVersion: null, nativeBuildVersion: null }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0', extra: { compilacion: { commit: 'a1b2c3d4e5f6' } } } } }));

import { firmaDe, limpiar, rutaLimpia } from '../../api/_errores';
import { armarAviso, esCodigoViejo, ignorar, seguirRuta } from './errores';

describe('avisos de fallos', () => {
  it('arma el aviso con la pantalla y la versión', () => {
    seguirRuta('/juan/3');
    const a = armarAviso(new TypeError('x is undefined'), 'pantalla');
    expect(a).toMatchObject({ plataforma: 'web', origen: 'pantalla', mensaje: 'TypeError: x is undefined', ruta: '/juan/3', version: '1.0.0 · a1b2c3d', fatal: false });
  });

  it('no avisa de lo que no es de Zarza', () => {
    expect(ignorar('Script error.', '')).toBe(true);
    expect(ignorar('ResizeObserver loop limit exceeded', '')).toBe(true);
    expect(ignorar('boom', 'at x (chrome-extension://abc/a.js:1:2)')).toBe(true);
    expect(ignorar('boom', 'at x (https://zarzabiblia.com/_expo/a.js:1:2)')).toBe(false);
    expect(armarAviso('', 'global')).toBeNull();
  });

  it('el servidor borra lo que diría quién es la persona', () => {
    expect(limpiar('No se pudo con ana@correo.com ni +1 505 416 4268')).toBe('No se pudo con [correo] ni [número]');
    expect(limpiar('GET /api?llave=abc123&x=1')).toBe('GET /api?llave=[…]&x=1');
    expect(rutaLimpia('/amigo/AB12CD?x=1')).toBe('/amigo/…');
    expect(rutaLimpia('/taller/abc-123/presentar')).toBe('/taller/…/presentar');
    expect(rutaLimpia('/juan/3/16')).toBe('/juan/3/16');
  });

  it('junta el mismo fallo aunque cambien números y líneas', () => {
    const a = firmaDe('web', 'Falla 12', 'Error: Falla 12\n    at f (https://x/_expo/a.js:10:5)');
    const b = firmaDe('web', 'Falla 30', 'Error: Falla 30\n    at f (https://x/_expo/a.js:11:9)');
    expect(a).toBe(b);
    expect(firmaDe('android', 'Falla 12', 'at f (a.js:1)')).not.toBe(a);
  });

  it('reconoce el código de una publicación anterior', () => {
    const e = Object.assign(new Error('Loading module https://zarzabiblia.com/_expo/static/js/web/index-8b13263f6723ede0760fd19930e097bf.js failed.\n(error: https://zarzabiblia.com/_expo/static/js/web/index-8b13263f6723ede0760fd19930e097bf.js)'), { name: 'AsyncRequireError' });
    expect(esCodigoViejo(e)).toBe(true);
    expect(esCodigoViejo(new Error('Failed to fetch dynamically imported module: https://x/a.js'))).toBe(true);
    expect(esCodigoViejo(new TypeError('x is undefined'))).toBe(false);
    expect(esCodigoViejo(null)).toBe(false);
  });

  it('junta el mismo fallo de distintas publicaciones', () => {
    const msg = (h: string) => `AsyncRequireError: Loading module https://zarzabiblia.com/_expo/static/js/web/index-${h}.js failed.`;
    const a = firmaDe('web', msg('8b13263f6723ede0760fd19930e097bf'), `at x (https://zarzabiblia.com/_expo/static/js/web/entry-9de7050bbe56c6f8520aa0abab7d5355.js:1:2)`);
    const b = firmaDe('web', msg('0a9090870a378d9b324a059dcc1a5f2f'), `at x (https://zarzabiblia.com/_expo/static/js/web/entry-1120746a5f2e74d2b3cd384d732a0ffd.js:3:4)`);
    expect(a).toBe(b);
  });
});
