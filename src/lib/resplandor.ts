// El huevo de pascua de la racha devocional: una luz que crece con la racha. Idea de Mike: como Moisés, que bajó
// del monte después de 40 días con Dios y no sabía que su rostro resplandecía. Cada meta tiene su luz, y entre más
// larga la racha, más intensa. Sale sola el día en que se alcanza una meta (al terminar el devocional) y, escondida,
// al tocar la llama de la racha en Mi diario.

export type Resplandor = {
  dias: number;
  /** 1 a 7: cuánta luz, cuántos rayos y cuántas chispas. */
  intensidad: number;
  titulo: string;
  versiculo: { ref: string; texto: string };
  /** Lo que se dibuja en el centro. */
  centro: 'chispa' | 'llama' | 'corazon' | 'rostro' | 'zarza' | 'gloria' | 'cristo';
};

// Versículos en la RV1909 (dominio público).
export const RESPLANDORES: Resplandor[] = [
  {
    dias: 3,
    intensidad: 1,
    titulo: 'Como la luz de la aurora',
    versiculo: { ref: 'Proverbios 4:18', texto: 'Mas la senda de los justos es como la luz de la aurora, que va en aumento hasta que el día es perfecto.' },
    centro: 'chispa',
  },
  {
    dias: 7,
    intensidad: 2,
    titulo: 'El fuego no se apaga',
    versiculo: { ref: 'Levítico 6:13', texto: 'El fuego ha de arder continuamente en el altar; no se apagará.' },
    centro: 'llama',
  },
  {
    dias: 21,
    intensidad: 3,
    titulo: '¿No ardía nuestro corazón?',
    versiculo: {
      ref: 'Lucas 24:32',
      texto: '¿No ardía nuestro corazón en nosotros, mientras nos hablaba en el camino, y cuando nos abría las Escrituras?',
    },
    centro: 'corazon',
  },
  {
    dias: 40,
    intensidad: 4,
    titulo: 'Tu rostro resplandece',
    versiculo: {
      ref: 'Éxodo 34:29',
      texto: 'Mientras descendía del monte, no sabía él que la tez de su rostro resplandecía, después que hubo con Él hablado.',
    },
    centro: 'rostro',
  },
  {
    dias: 100,
    intensidad: 5,
    titulo: 'La zarza no se consumía',
    versiculo: { ref: 'Éxodo 3:2', texto: 'Y él miró, y vió que la zarza ardía en fuego, y la zarza no se consumía.' },
    centro: 'zarza',
  },
  {
    dias: 365,
    intensidad: 6,
    titulo: 'La gloria llenó la casa',
    versiculo: {
      ref: '2 Crónicas 7:1',
      texto: 'El fuego descendió de los cielos, y consumió el holocausto y las víctimas; y la gloria de Jehová hinchió la casa.',
    },
    centro: 'gloria',
  },
  // Casi inalcanzable (idea de Mike): años de lectura, hasta parecerse a Cristo. La pantalla deja la noche y se vuelve
  // luz blanca, como en el monte de la transfiguración (Mateo 17:2).
  {
    dias: 2555,
    intensidad: 7,
    titulo: 'La estatura de Cristo',
    versiculo: {
      ref: 'Efesios 4:13',
      texto:
        'Hasta que todos lleguemos á la unidad de la fe y del conocimiento del Hijo de Dios, á un varón perfecto, á la medida de la edad de la plenitud de Cristo.',
    },
    centro: 'cristo',
  },
];

/** La luz que corresponde a una racha: la de la meta más alta alcanzada (null antes de 3 días). */
export const resplandorDe = (dias: number) => RESPLANDORES.filter((r) => r.dias <= dias).at(-1) ?? null;

/** La luz que sale sola: solo el día exacto en que la racha llega a una meta. */
export const resplandorNuevo = (dias: number) => RESPLANDORES.find((r) => r.dias === dias) ?? null;
