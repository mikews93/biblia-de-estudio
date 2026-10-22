import { describe, expect, it } from 'vitest';

import { indexFiles } from '../../api/_montoya';

describe('indexFiles', () => {
  it('reconoce cada capítulo por el número del libro y el del capítulo', () => {
    const index = indexFiles([
      { name: '01-Génesis 01.mp3', length: '292.51', source: 'original' },
      { name: '02-Exodo 40.mp3', length: '210', source: 'original' },
      { name: '19-Salmos 119.mp3', length: '1500', source: 'original' },
      { name: '43-Juan 03.mp3', length: '300', source: 'original' },
      { name: '01-Génesis 01_spectrogram.png', source: 'derivative' },
      { name: '01-Génesis 01.ogg', source: 'derivative' },
    ]);
    expect(index.get('gen/1')).toEqual({
      url: 'https://archive.org/download/BibliaEnAudioRVA1909/01-G%C3%A9nesis%2001.mp3',
      duration: 292.51,
    });
    expect(index.get('exo/40')?.duration).toBe(210);
    expect(index.get('psa/119')?.duration).toBe(1500);
    expect(index.get('jhn/3')?.duration).toBe(300);
    expect(index.size).toBe(4);
  });

  it('no confunde los libros si la numeración no sigue el orden de la Biblia', () => {
    const index = indexFiles([
      { name: '01-Mateo 05.mp3', length: '400', source: 'original' },
      { name: '01-Cantar de los Cantares 02.mp3', length: '100', source: 'original' },
      { name: '22-Cantar de los Cantares 02.mp3', length: '120', source: 'original' },
      { name: '07-1 Corintios 13.mp3', length: '150', source: 'original' },
    ]);
    expect(index.get('mat/5')?.duration).toBe(400);
    expect(index.get('sng/2')?.duration).toBe(120);
    expect(index.has('gen/5')).toBe(false);
    expect(index.get('1co/13')?.duration).toBe(150);
  });
});
