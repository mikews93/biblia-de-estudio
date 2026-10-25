import { Share } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { imageFileName, shareMessage, shareVerse, verseFontSize, verseUrl } from './compartir';

const v = { book: '1jn', chapter: 4, verse: 8, text: 'Dios es amor.', reference: '1 Juan 4:8', version: 'RV1909' };

describe('compartir un versículo', () => {
  it('enlace a la página pública del versículo', () => {
    expect(verseUrl(v)).toBe('https://biblia.migueblanco.com/1-juan/4/8');
  });

  it('el texto lleva comillas, la cita con la versión y el enlace', async () => {
    await shareVerse(v);
    expect(vi.mocked(Share.share)).toHaveBeenCalledWith({
      message: '«Dios es amor.» 1 Juan 4:8 (RV1909)\n\nhttps://biblia.migueblanco.com/1-juan/4/8',
    });
  });

  it('las invitaciones llevan el enlace una sola vez (sin `url` aparte)', async () => {
    vi.mocked(Share.share).mockClear();
    await shareMessage('Únete aquí: https://biblia.migueblanco.com/g/ABC');
    expect(vi.mocked(Share.share)).toHaveBeenCalledWith({ message: 'Únete aquí: https://biblia.migueblanco.com/g/ABC' });
  });

  it('nombre de archivo de la imagen sin espacios ni dos puntos, con acentos', () => {
    expect(imageFileName(v)).toBe('1-juan-4-8.png');
    expect(imageFileName({ ...v, reference: 'Génesis 1:1-3' })).toBe('génesis-1-1-3.png');
  });

  it('la letra se achica con versículos más largos y crece en formato historia', () => {
    const sizes = [10, 100, 200, 300, 500, 800].map((n) => verseFontSize('a'.repeat(n), 'cuadrado'));
    expect(sizes).toEqual([70, 60, 50, 42, 36, 30]);
    expect(verseFontSize('corto', 'historia')).toBe(91);
  });
});
