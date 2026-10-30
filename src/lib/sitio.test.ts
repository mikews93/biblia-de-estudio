import { afterEach, describe, expect, it, vi } from 'vitest';

import { inviteUrl } from './comunidad';
import { enlaceEvento } from './eventos';
import { origenCompartir } from './sitio';
import { friendUrl } from './social';

const abrirEn = (url: string) => {
  const u = new URL(url);
  vi.stubGlobal('location', { origin: u.origin, hostname: u.hostname });
};

describe('enlaces que se comparten', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('desde el dominio viejo salen con zarzabiblia.com', () => {
    abrirEn('https://biblia.migueblanco.com/cuenta');
    expect(friendUrl('AB12CD34')).toBe('https://zarzabiblia.com/amigo/AB12CD34');
    expect(inviteUrl('XYZ')).toBe('https://zarzabiblia.com/unirse/XYZ');
    expect(enlaceEvento('QWE789')).toBe('https://zarzabiblia.com/evento/QWE789');
  });

  it('en www también usan el dominio sin www', () => {
    abrirEn('https://www.zarzabiblia.com/');
    expect(origenCompartir()).toBe('https://zarzabiblia.com');
  });

  it('en pruebas usan la dirección donde corre la app', () => {
    abrirEn('http://localhost:8081/');
    expect(origenCompartir()).toBe('http://localhost:8081');
    abrirEn('https://biblia-de-estudio-git-dev-acme.vercel.app/');
    expect(origenCompartir()).toBe('https://biblia-de-estudio-git-dev-acme.vercel.app');
  });

  it('en el teléfono, sin location, zarzabiblia.com', () => {
    vi.stubGlobal('location', undefined);
    expect(origenCompartir()).toBe('https://zarzabiblia.com');
  });
});
