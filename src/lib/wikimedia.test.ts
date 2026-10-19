import { describe, expect, it } from 'vitest';

import { standardThumb } from './wikimedia';

describe('miniaturas de Wikimedia', () => {
  it('lleva las de 800 px (como la de Samaria) al ancho estándar de 960', () => {
    expect(
      standardThumb(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/2016_WLM_-_OVEDC_-_Shomron_capital_of_the_Kingdom_of_Israel_061.jpg/800px-2016_WLM_-_OVEDC_-_Shomron_capital_of_the_Kingdom_of_Israel_061.jpg',
      ),
    ).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/2016_WLM_-_OVEDC_-_Shomron_capital_of_the_Kingdom_of_Israel_061.jpg/960px-2016_WLM_-_OVEDC_-_Shomron_capital_of_the_Kingdom_of_Israel_061.jpg',
    );
  });

  it('deja como están los anchos estándar, los originales y otras direcciones', () => {
    const ok = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Arca.jpg/960px-Arca.jpg';
    expect(standardThumb(ok)).toBe(ok);
    expect(standardThumb('https://upload.wikimedia.org/wikipedia/commons/4/43/View.jpg')).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/4/43/View.jpg',
    );
    expect(standardThumb('https://example.com/thumb/x/800px-x.jpg')).toBe('https://example.com/thumb/x/800px-x.jpg');
    expect(standardThumb('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Mapa.svg/640px-Mapa.svg.png')).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Mapa.svg/960px-Mapa.svg.png',
    );
  });
});
