import { describe, expect, it } from 'vitest';

import type { Word } from './data';
import { explainDifferences, hunks, norm, similar, strongKey } from './diferencias';
import { notaPalabra } from './notasPalabras';

// Palabras del interlineal: [original, transliteración, glosa, glosa inglesa, lema, significado, Strong, morfología]
const w = (o: string, t: string, es: string, strong: string, morph: string): Word => [o, t, es, '', '', '', strong, morph];

const JN316: Word[] = [
  w('οὕτως', 'houtōs', 'Así', 'G3779', 'ADV'),
  w('γὰρ', 'gar', 'porque', 'G1063', 'CONJ'),
  w('ἠγάπησεν', 'ēgapēsen', 'amó', 'G0025', 'V-AAI-3S'),
  w('ὁ', 'ho', 'el', 'G3588', 'T-NSM'),
  w('θεὸς', 'theos', 'Dios', 'G2316', 'N-NSM-T'),
  w('τὸν', 'ton', 'a el', 'G3588', 'T-ASM'),
  w('κόσμον,', 'kosmon', 'mundo', 'G2889', 'N-ASM'),
  w('ὥστε', 'hōste', 'de modo que', 'G5620', 'CONJ'),
  w('τὸν', 'ton', 'el', 'G3588', 'T-ASM'),
  w('υἱὸν', 'huion', 'Hijo', 'G5207', 'N-ASM'),
  w('αὐτοῦ', 'autou', 'de él', 'G0846', 'P-GSM'),
  w('τὸν', 'ton', 'el', 'G3588', 'T-ASM'),
  w('μονογενῆ', 'monogenē', 'unigénito', 'G3439', 'A-ASM'),
  w('ἔδωκεν,', 'edōken', 'dio', 'G1325', 'V-AAI-3S'),
];
const RV = { id: 'rv1909', abbr: 'RV1909', text: 'Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito,' };
const BES = { id: 'bes', abbr: 'BES', text: 'Porque Dios tuvo tal amor por el mundo que le dio a su único Hijo,' };
const RVG = { id: 'rvg', abbr: 'RVG', text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito,' };

describe('por qué difieren las versiones', () => {
  it('compara palabras sin tildes ni signos y reconoce la misma raíz', () => {
    expect(norm('Él,')).toBe('el');
    expect(norm('ʼElohim')).toBe('elohim');
    expect(similar('perezca', 'perezcan')).toBe(2);
    expect(similar('perezca', 'perecer')).toBe(1);
    expect(similar(norm('único'), norm('unigénito'))).toBe(1);
    expect(similar('dio', 'dios')).toBe(0);
    expect(similar('de', 'de')).toBe(3);
  });

  it('no parte una diferencia por palabras de enlace repetidas', () => {
    const tok = (s: string) => s.split(' ').map((raw) => ({ raw, n: norm(raw) }));
    expect(hunks(tok('a su Hijo unigénito'), tok('a su Hijo unigénito'))).toEqual([]);
    expect(hunks(tok('su Hijo unigénito para'), tok('su único Hijo para'))).toHaveLength(2);
  });

  it('une «unigénito» y «único» a μονογενής aunque cambie el orden', () => {
    const { differences } = explainDifferences([RV, RVG, BES], JN316);
    const mono = differences.find((d) => d.strong === 'G3439')!;
    expect(mono.original[0][0]).toBe('μονογενῆ');
    expect(mono.renderings).toEqual([
      { text: 'unigénito', versions: ['RV1909', 'RVG'] },
      { text: 'único', versions: ['BES'] },
    ]);
    // Tiene nota propia, y va antes que las demás
    expect(mono.note).toContain('unigénito');
    expect(differences[0]).toBe(mono);
  });

  it('las versiones que dicen lo mismo no dan diferencias', () => {
    expect(explainDifferences([RV, RVG], JN316).differences).toEqual([]);
  });

  it('explica lo que solo está en el Texto Recibido', () => {
    const words: Word[] = [
      w('ῥῦσαι', 'rhusai', 'libra rescatando', 'G4506', 'V-ADM-2S'),
      w('ἡμᾶς', 'hēmas', 'a nosotros', 'G3165', 'P-1AP'),
      w('ἀπὸ', 'apo', 'desde', 'G0575', 'PREP'),
      w('τοῦ', 'tou', 'el', 'G3588', 'T-GSM'),
      w('πονηροῦ.', 'ponērou', 'Maligno', 'G4190', 'A-GSM'),
      w('ὅτι', 'hoti', 'que', 'G3754', 'CONJ'),
      w('σοῦ', 'sou', 'de ti', 'G4771', 'P-2GS'),
      w('ἐστιν', 'estin', 'está siendo', 'G1510', 'V-PAI-3S'),
      w('ἡ', 'hē', 'la', 'G3588', 'T-NSF'),
      w('βασιλεία', 'basileia', 'reino', 'G0932', 'N-NSF'),
      w('καὶ', 'kai', 'y', 'G2532', 'CONJ'),
      w('ἡ', 'hē', 'la', 'G3588', 'T-NSF'),
      w('δύναμις', 'dunamis', 'poder', 'G1411', 'N-NSF'),
      w('ἀμήν.', 'amēn', 'amén', 'G0281', 'INJ-HEB'),
    ];
    const tr = { tr: [5, 6, 7, 8, 9, 10, 11, 12, 13], na: [] };
    const { differences } = explainDifferences(
      [
        { id: 'rv1909', abbr: 'RV1909', text: 'mas líbranos del mal: porque tuyo es el reino, y el poder. Amén.' },
        { id: 'pdt', abbr: 'PDT', text: 'pero líbranos del malo.' },
      ],
      words,
      tr,
    );
    const ms = differences.find((d) => d.kind === 'tradicional')!;
    expect(ms.renderings).toEqual([
      { text: 'porque tuyo es el reino, y el poder. Amén', versions: ['RV1909'] },
      { text: '', versions: ['PDT'] },
    ]);
    expect(ms.note).toContain('Texto Recibido');
    expect(ms.note).toContain('PDT no las incluye');
  });

  it('un versículo entero del Texto Recibido es una sola tarjeta', () => {
    const words = [w('εἶπε', 'eipe', 'dijo', 'G2036', 'V-2AAI-3S'), w('Φίλιππος', 'Philippos', 'Felipe', 'G5376', 'N-NSM-P')];
    const { differences } = explainDifferences(
      [
        { id: 'rv1909', abbr: 'RV1909', text: 'Y Felipe dijo: Si crees de todo corazón, bien puedes.' },
        { id: 'pdt', abbr: 'PDT', text: ']]' },
        { id: 'blm', abbr: 'BLM', text: '' },
      ],
      words,
      { tr: [0, 1], na: [] },
    );
    expect(differences).toHaveLength(1);
    expect(differences[0].kind).toBe('versiculo');
    expect(differences[0].renderings[1].versions).toEqual(['PDT', 'BLM']);
  });

  it('reconoce lo que solo tienen los manuscritos más antiguos («¡Y somos!»)', () => {
    const words = [
      w('κληθῶμεν', 'klēthōmen', 'seamos llamados', 'G2564', 'V-APS-1P'),
      w('τέκνα', 'tekna', 'hijos', 'G5043', 'N-NPN'),
      w('θεοῦ.', 'theou', 'de Dios', 'G2316', 'N-GSM'),
    ];
    const { differences } = explainDifferences(
      [
        { id: 'rv1909', abbr: 'RV1909', text: 'que seamos llamados hijos de Dios: por esto' },
        { id: 'pdt', abbr: 'PDT', text: 'para que seamos llamados hijos de Dios! ¡Y somos! Por esto' },
      ],
      words,
      { tr: [], na: [['ἐσμέν.', 'esmen', 'estamos siendo', 2]] },
    );
    const na = differences.find((d) => d.kind === 'critico')!;
    expect(na.original[0][0]).toBe('ἐσμέν');
    expect(na.renderings.find((r) => r.versions.includes('PDT'))?.text).toBe('Y somos');
  });

  it('tiene notas para las palabras que más cambian', () => {
    expect(strongKey('H3068G')).toBe('H3068');
    expect(strongKey('G26')).toBe('G0026');
    expect(notaPalabra('H3068G')).toContain('YHWH');
    expect(notaPalabra('G0026')).toContain('caridad');
    expect(notaPalabra('G9999')).toBeNull();
  });
});
