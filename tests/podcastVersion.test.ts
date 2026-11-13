import { describe, expect, it } from 'vitest';

import { elegirVersionPodcast, versionPodcast } from '../src/lib/podcastVersion';

describe('un solo pódcast grabado por capítulo', () => {
  it('sin grabaciones, el pódcast va en la versión de quien lee', () => {
    expect(elegirVersionPodcast('bes', [])).toBe('bes');
    expect(elegirVersionPodcast(versionPodcast('nbla'), [])).toBe('pdt');
  });

  it('si ya está grabado en la versión de quien lee, ese', () => {
    expect(elegirVersionPodcast('bes', ['rv1909', 'pdt', 'bes'])).toBe('bes');
  });

  it('si está grabado en otra versión, se usa ese en vez de grabar otro: primero la PDT, luego la RV1909', () => {
    expect(elegirVersionPodcast('bes', ['rv1909', 'pdt'])).toBe('pdt');
    expect(elegirVersionPodcast('pdt', ['rv1909'])).toBe('rv1909');
    expect(elegirVersionPodcast('rv1909', ['bes'])).toBe('bes');
  });

  it('nunca una versión con derechos', () => {
    expect(elegirVersionPodcast('bes', ['nbla'])).toBe('bes');
  });
});
