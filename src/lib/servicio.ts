// El servicio: un reconocimiento para quien estudia a fondo, prepara mensajes y guía a otros (idea de Mike). Cuenta
// tres cosas que ya dejan huella en Mis sellos (src/lib/sellos.ts): cada estudio profundo de un pasaje, cada mensaje
// del Taller terminado y cada vez que guía a otros (un evento publicado, una lectura en vivo, un mensaje predicado).
// Con esa cuenta se sube de nivel, como en la racha (src/lib/resplandor.ts), pero con estrellas en lugar de fuego:
// «los que enseñan á justicia la multitud, como las estrellas» (Daniel 12:3). Sin rankings: cada quien ve el suyo, y
// en la comunidad solo se ve la corona de estrellas sobre la foto.

export type Cuenta = { profundos: number; escritos: number; guiados: number };

export type Nivel = {
  /** Cuántas veces de servicio hacen falta. */
  meta: number;
  /** 1 a 5: cuántas estrellas y cuánta luz. */
  nivel: number;
  titulo: string;
  versiculo: { ref: string; texto: string };
  centro: 'toalla' | 'talentos' | 'cayado' | 'manos' | 'estrellas';
};

// Versículos en la RV1909 (dominio público).
export const NIVELES: Nivel[] = [
  {
    meta: 10,
    nivel: 1,
    titulo: 'Toalla y lebrillo',
    versiculo: {
      ref: 'Juan 13:14',
      texto: 'Pues si yo, el Señor y el Maestro, he lavado vuestros pies, vosotros también debéis lavar los pies los unos á los otros.',
    },
    centro: 'toalla',
  },
  {
    meta: 40,
    nivel: 2,
    titulo: 'Buen siervo y fiel',
    versiculo: {
      ref: 'Mateo 25:21',
      texto: 'Bien, buen siervo y fiel; sobre poco has sido fiel, sobre mucho te pondré: entra en el gozo de tu señor.',
    },
    centro: 'talentos',
  },
  {
    meta: 120,
    nivel: 3,
    titulo: 'Apacienta mis ovejas',
    versiculo: { ref: 'Juan 21:17', texto: 'Señor, tú sabes todas las cosas; tú sabes que te amo. Dícele Jesús: Apacienta mis ovejas.' },
    centro: 'cayado',
  },
  {
    meta: 300,
    nivel: 4,
    titulo: 'Dispensadores de su gracia',
    versiculo: {
      ref: '1 Pedro 4:10',
      texto: 'Cada uno según el don que ha recibido, adminístrelo á los otros, como buenos dispensadores de las diferentes gracias de Dios.',
    },
    centro: 'manos',
  },
  {
    meta: 1000,
    nivel: 5,
    titulo: 'Como las estrellas',
    versiculo: {
      ref: 'Daniel 12:3',
      texto:
        'Y los entendidos resplandecerán como el resplandor del firmamento; y los que enseñan á justicia la multitud, como las estrellas á perpetua eternidad.',
    },
    centro: 'estrellas',
  },
];

export const totalDe = (c: Cuenta) => c.profundos + c.escritos + c.guiados;

/** El nivel alcanzado con tantas veces de servicio (null antes de la primera meta). */
export const nivelDe = (total: number) => NIVELES.filter((n) => n.meta <= total).at(-1) ?? null;

/** La meta que sigue, o null si ya llegó a la última. */
export const siguienteNivel = (total: number) => NIVELES.find((n) => n.meta > total) ?? null;
