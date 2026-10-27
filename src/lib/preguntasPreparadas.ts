// Las preguntas que muchos hacen (src/lib/preguntar.ts): su respuesta se prepara una vez y se guarda para todos.
// Datos solos, sin dependencias: también los lee el servidor (api/estudiar.ts).

export type Categoria = 'dios' | 'jesus' | 'biblia' | 'vida';
export type Preparada = { id: string; cat: Categoria; texto: string };

export const CATEGORIAS: { id: Categoria; label: string }[] = [
  { id: 'dios', label: 'Dios' },
  { id: 'jesus', label: 'Jesús' },
  { id: 'biblia', label: 'La Biblia' },
  { id: 'vida', label: 'La vida' },
];

/** Las preguntas que más se hacen sobre la fe. El id es la llave de su respuesta guardada: no cambiarlo. */
export const PREPARADAS: Preparada[] = [
  { id: 'quien-es-dios', cat: 'dios', texto: '¿Quién es Dios según la Biblia?' },
  { id: 'trinidad', cat: 'dios', texto: '¿Qué es la Trinidad?' },
  { id: 'sufrimiento', cat: 'dios', texto: '¿Por qué Dios permite el sufrimiento?' },
  { id: 'voluntad-de-dios', cat: 'dios', texto: '¿Cómo puedo conocer la voluntad de Dios?' },
  { id: 'espiritu-santo', cat: 'dios', texto: '¿Quién es el Espíritu Santo?' },
  { id: 'jesus-dios', cat: 'jesus', texto: '¿Jesús es Dios?' },
  { id: 'por-que-murio', cat: 'jesus', texto: '¿Por qué tuvo que morir Jesús?' },
  { id: 'resurreccion', cat: 'jesus', texto: '¿Qué significa que Jesús resucitó?' },
  { id: 'como-ser-salvo', cat: 'jesus', texto: '¿Cómo puedo ser salvo?' },
  { id: 'volvera', cat: 'jesus', texto: '¿Qué dice la Biblia sobre el regreso de Jesús?' },
  { id: 'quien-escribio', cat: 'biblia', texto: '¿Quién escribió la Biblia?' },
  { id: 'canon', cat: 'biblia', texto: '¿Cómo se decidió qué libros van en la Biblia?' },
  { id: 'cuatro-evangelios', cat: 'biblia', texto: '¿Por qué hay cuatro evangelios?' },
  { id: 'antiguo-nuevo', cat: 'biblia', texto: '¿Qué diferencia hay entre el Antiguo y el Nuevo Testamento?' },
  { id: 'por-donde-empezar', cat: 'biblia', texto: '¿Por dónde empiezo a leer la Biblia?' },
  { id: 'perdonar', cat: 'vida', texto: '¿Cómo perdonar a alguien que me hirió?' },
  { id: 'ansiedad', cat: 'vida', texto: '¿Qué dice la Biblia sobre la ansiedad?' },
  { id: 'orar', cat: 'vida', texto: '¿Cómo puedo aprender a orar?' },
  { id: 'duda', cat: 'vida', texto: '¿Está mal tener dudas sobre la fe?' },
  { id: 'iglesia', cat: 'vida', texto: '¿Por qué ir a una iglesia?' },
  { id: 'cielo', cat: 'vida', texto: '¿Qué pasa cuando morimos?' },
];
