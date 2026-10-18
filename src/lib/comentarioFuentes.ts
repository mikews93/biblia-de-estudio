// Fuentes de comentario de la app. Sin dependencias de React Native: también lo usa la función del servidor.
//
// Para añadir una fuente:
// - «traducida»: texto en inglés de dominio público que /api/comentario traduce con IA la primera vez y guarda.
//   Sus secciones salen de pipeline/build_comentarios.py.
// - «propia»: texto que ya está en español (por ejemplo Enduring Word en español, si David Guzik da permiso).
//   Se dejan sus secciones en comentarios/<id>/ con el mismo formato y se sirven sin traducir.
// - «enlace»: no tenemos el texto; la app enlaza al sitio del autor.

export type Fuente = {
  id: string;
  /** Nombre corto para la pestaña. */
  nombre: string;
  obra: string;
  autor: string;
  año: string;
  tipo: 'traducida' | 'propia' | 'enlace';
  idioma: 'en' | 'es';
  licencia: string;
  /** Página del pasaje en el sitio del autor. */
  url?: (slug: string, chapter: number) => string;
};

export const FUENTES: Fuente[] = [
  {
    id: 'mhc',
    nombre: 'Matthew Henry',
    obra: 'Comentario de toda la Biblia',
    autor: 'Matthew Henry',
    año: '1706-1721',
    tipo: 'traducida',
    idioma: 'en',
    licencia: 'Dominio público. Texto del módulo SWORD de CrossWire, preparado por Christian Classics Ethereal Library.',
  },
  {
    id: 'jfb',
    nombre: 'JFB',
    obra: 'Comentario crítico y explicativo de toda la Biblia',
    autor: 'Robert Jamieson, A. R. Fausset y David Brown',
    año: '1871',
    tipo: 'traducida',
    idioma: 'en',
    licencia: 'Dominio público. Texto del módulo SWORD de CrossWire, preparado por Christian Classics Ethereal Library.',
  },
  {
    id: 'ew',
    nombre: 'Enduring Word',
    obra: 'Comentario bíblico Enduring Word',
    autor: 'David Guzik',
    año: '',
    tipo: 'enlace',
    idioma: 'es',
    licencia: 'Se lee en el sitio de Enduring Word.',
    url: (slug, chapter) => `https://enduringword.com/bible-commentary/es/${slug}-${chapter}/`,
  },
];
