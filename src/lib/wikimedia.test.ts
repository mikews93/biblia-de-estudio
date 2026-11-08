import { describe, expect, it } from 'vitest';

import { sized, standardThumb, viaApp } from './wikimedia';

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

  it('vuelve a upload.wikimedia.org las miniaturas de thumb.wikimedia.org con ?utm_…', () => {
    expect(
      standardThumb(
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Herodian_Kingdom_topographic_map.svg/960px-Herodian_Kingdom_topographic_map.svg.png?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=thumbnail',
      ),
    ).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Herodian_Kingdom_topographic_map.svg/960px-Herodian_Kingdom_topographic_map.svg.png');
  });
});

describe('imágenes a través de la app', () => {
  it('pide las tarjetas en 500 px, también de un archivo original más ancho', () => {
    expect(sized('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Arca.jpg/960px-Arca.jpg', 500, 960)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Arca.jpg/500px-Arca.jpg',
    );
    expect(sized('https://upload.wikimedia.org/wikipedia/commons/a/af/Givaat_Ravid.JPG', 500, 960)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Givaat_Ravid.JPG/500px-Givaat_Ravid.JPG',
    );
    // Más estrecha que 500 px: el archivo tal cual (Wikimedia no agranda miniaturas).
    expect(sized('https://upload.wikimedia.org/wikipedia/commons/a/af/Chica.jpg', 500, 400)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/a/af/Chica.jpg',
    );
  });

  it('pasa por /api/biblia?imagen= solo lo que es de Wikimedia Commons', () => {
    const img = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Arca.jpg/960px-Arca.jpg';
    expect(viaApp(img)).toBe(`/api/biblia?imagen=${encodeURIComponent(img)}`);
    expect(viaApp(img, 'https://zarzabiblia.com')).toBe(`https://zarzabiblia.com/api/biblia?imagen=${encodeURIComponent(img)}`);
    expect(viaApp('https://example.com/x.jpg')).toBe('https://example.com/x.jpg');
  });
});
