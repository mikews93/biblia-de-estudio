// Ocasiones para mandarle un versículo a alguien: cumpleaños, duelo, enfermedad… Cada una trae versículos escogidos
// (RV1909, dominio público), el fondo que va con el momento y una dedicatoria para empezar. La investigación
// (investigacion/compartir-versiculos.md) mostró que la gente comparte sobre todo pensando en una persona concreta.

import { getBooks, getChapter } from './data';
import type { VerseToShare } from './compartir';

export type Ocasion = {
  id: string;
  nombre: string;
  /** Para quién es, en una frase corta. */
  para: string;
  /** Nombre del fondo (src/lib/fondos.ts) que va con el momento. */
  fondo: string;
  dedicatoria: string;
  /** Lo que se le pide a la búsqueda por idea cuando la persona cuenta qué pasa. */
  consulta: string;
  /** Versículos escogidos, como «libro.capítulo.versículo». */
  refs: string[];
};

export const OCASIONES: Ocasion[] = [
  {
    id: 'cumpleanos',
    nombre: 'Cumpleaños',
    para: 'Una bendición para su nuevo año',
    fondo: 'Amanecer',
    dedicatoria: 'Feliz cumpleaños',
    consulta: 'versículos de bendición para el cumpleaños de alguien',
    refs: ['psa.118.24', 'num.6.24', 'lam.3.23', 'jer.29.11', 'psa.139.14', 'psa.90.12'],
  },
  {
    id: 'duelo',
    nombre: 'Duelo',
    para: 'Para quien perdió a alguien',
    fondo: 'Estrellas',
    dedicatoria: 'Estoy contigo',
    consulta: 'versículos de consuelo para alguien que perdió a un ser querido',
    refs: ['psa.34.18', 'mat.5.4', 'rev.21.4', 'jhn.11.25', 'psa.147.3', '2co.1.3'],
  },
  {
    id: 'enfermedad',
    nombre: 'Enfermedad',
    para: 'Ánimo para quien está enfermo',
    fondo: 'Luz',
    dedicatoria: 'Oro por tu salud',
    consulta: 'versículos de ánimo para alguien que está enfermo',
    refs: ['isa.41.10', 'psa.41.3', 'psa.30.2', '2co.12.9', 'jas.5.15', 'psa.103.3'],
  },
  {
    id: 'examen',
    nombre: 'Examen',
    para: 'Fuerza para un examen o un reto',
    fondo: 'Montes',
    dedicatoria: 'Dios va contigo',
    consulta: 'versículos de ánimo para alguien que tiene un examen o un reto difícil',
    refs: ['jos.1.9', 'pro.16.3', 'php.4.13', 'jas.1.5', 'isa.40.31', 'col.3.23'],
  },
  {
    id: 'boda',
    nombre: 'Boda',
    para: 'Para los novios',
    fondo: 'Olivo',
    dedicatoria: 'Para los novios',
    consulta: 'versículos sobre el amor y el matrimonio para una boda',
    refs: ['ecc.4.12', '1co.13.4', 'sng.8.7', 'col.3.14', 'rut.1.16', 'mrk.10.9'],
  },
  {
    id: 'bebe',
    nombre: 'Bebé',
    para: 'Bienvenida a una nueva vida',
    fondo: 'Acuarela',
    dedicatoria: 'Bienvenida, nueva vida',
    consulta: 'versículos para celebrar el nacimiento de un bebé',
    refs: ['psa.127.3', 'jer.1.5', 'psa.139.16', '1sa.1.27', 'num.6.25', 'mrk.10.14'],
  },
  {
    id: 'preocupacion',
    nombre: 'Preocupación',
    para: 'Paz para quien está ansioso',
    fondo: 'Mar',
    dedicatoria: 'Dios cuida de ti',
    consulta: 'versículos de paz para alguien preocupado o con ansiedad',
    refs: ['1pe.5.7', 'php.4.6', 'mat.11.28', 'jhn.14.27', 'psa.56.3', 'isa.26.3'],
  },
  {
    id: 'gracias',
    nombre: 'Gratitud',
    para: 'Para dar gracias por alguien',
    fondo: 'Trigal',
    dedicatoria: 'Gracias por tu vida',
    consulta: 'versículos de gratitud para agradecerle a alguien',
    refs: ['php.1.3', '1th.5.18', 'psa.107.1', 'jas.1.17', 'psa.100.4', 'col.3.15'],
  },
];

export const ocasionPorId = (id?: string) => OCASIONES.find((o) => o.id === id);

/** Los versículos de una ocasión con su texto en la RV1909, listos para compartir. */
export async function versiculosDe(ocasion: Ocasion): Promise<VerseToShare[]> {
  const books = await getBooks();
  const out = await Promise.all(
    ocasion.refs.map(async (ref) => {
      const [book, c, v] = ref.split('.');
      const chapter = Number(c);
      const verse = Number(v);
      const text = (await getChapter(book, chapter).catch(() => [])).find(([n]) => n === verse)?.[1];
      const name = books.find((b) => b.id === book)?.name ?? book;
      const item: VerseToShare | null = text ? { book, chapter, verse, text, reference: `${name} ${chapter}:${verse}`, version: 'RV1909' } : null;
      return item;
    }),
  );
  return out.filter((x): x is VerseToShare => !!x);
}
