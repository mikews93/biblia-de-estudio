// El Taller: preparar reflexiones, encuentros de grupo y sermones. Todo se guarda en el dispositivo.
// El recorrido es el mismo para los tres tipos: pasaje → idea central → bosquejo → revisión → presentar.
// Diseño: investigacion/reflexiones-dinamicas-sermones.md en los archivos del proyecto.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { Book } from './data';

export type Tipo = 'reflexion' | 'encuentro' | 'sermon';

export type Pasaje = { book: string; chapter: number; from?: number; to?: number };

export type Seccion = {
  id: string;
  titulo: string;
  /** Qué se hace en esta parte, según la plantilla. */
  ayuda: string;
  /** Notas o borrador de quien prepara (en un encuentro, las notas del líder). */
  texto: string;
  minutos: number;
  /** Solo encuentros: lo que ve el grupo (preguntas, instrucciones) y quién guía la parte. */
  paraGrupo?: string;
  responsable?: string;
  dinamica?: string;
};

export type Mensaje = {
  id: string;
  tipo: Tipo;
  titulo: string;
  pasaje: Pasaje | null;
  plantilla: string;
  observacion: string;
  tema: string;
  complemento: string;
  necesidad: string;
  gracia: string;
  secciones: Seccion[];
  revision: string[];
  seguimiento: string;
  minutos: number;
  creado: string;
  actualizado: string;
};

type SeccionBase = { titulo: string; ayuda: string; minutos: number; dinamica?: string };
export type Plantilla = { id: string; tipo: Tipo; nombre: string; descripcion: string; secciones: SeccionBase[] };

const punto = (n: number): SeccionBase => ({
  titulo: `Punto ${n}`,
  ayuda: 'Un punto que sale del texto. Explícalo (qué dice), ilústralo (cómo se ve en la vida) y aplícalo (qué hago con esto).',
  minutos: 7,
});

export const PLANTILLAS: Plantilla[] = [
  {
    id: 'oia',
    tipo: 'reflexion',
    nombre: 'Devocional breve',
    descripcion: 'Observar, interpretar y aplicar en 5 a 10 minutos.',
    secciones: [
      { titulo: 'El versículo', ayuda: 'Lee el versículo o la escena. ¿Qué pasa? ¿Quién habla y a quién?', minutos: 1 },
      { titulo: 'Algo que sorprende', ayuda: 'Una observación que despierte interés: un detalle del texto, una palabra del original o una referencia cruzada.', minutos: 2 },
      { titulo: 'Una verdad sobre Dios', ayuda: '¿Qué muestra este pasaje de quién es Dios y de lo que hace?', minutos: 2 },
      { titulo: 'Un paso para hoy', ayuda: 'Una pregunta o una acción concreta y posible hoy mismo.', minutos: 2 },
      { titulo: 'Oración', ayuda: 'Una oración breve que responda a lo que dice el texto.', minutos: 1 },
    ],
  },
  {
    id: 'yo-nosotros-breve',
    tipo: 'reflexion',
    nombre: 'Yo, nosotros, Dios, tú, nosotros',
    descripcion: 'La estructura de Andy Stanley en versión corta: crea tensión antes de resolverla.',
    secciones: [
      { titulo: 'Yo', ayuda: 'Cómo te ha tocado a ti este problema o esta pregunta.', minutos: 1 },
      { titulo: 'Nosotros', ayuda: 'A todos nos pasa: nombra la tensión que compartimos.', minutos: 1 },
      { titulo: 'Dios', ayuda: 'Qué dice el texto. Aquí se resuelve la tensión.', minutos: 3 },
      { titulo: 'Tú', ayuda: 'Qué significa para quien escucha esta semana.', minutos: 2 },
      { titulo: 'Nosotros', ayuda: 'Cómo sería nuestro grupo o iglesia si todos viviéramos esto, desde el amor de Dios y no desde la culpa.', minutos: 1 },
    ],
  },
  {
    id: 'dbs',
    tipo: 'encuentro',
    nombre: 'Descubrimiento (DBS)',
    descripcion: 'Conexión, mirar atrás, mirar arriba, mirar adelante y oración. El grupo descubre el texto preguntando.',
    secciones: [
      {
        titulo: 'Conexión',
        ayuda: 'Una dinámica para conectar. «¿Por qué das gracias esta semana?», «¿Qué te tiene preocupado?», «¿Cómo podemos ayudarnos?».',
        minutos: 15,
        dinamica: 'pregunta-en-ronda',
      },
      {
        titulo: 'Mirar atrás',
        ayuda: 'Alguien recuenta el pasaje de la vez pasada. «¿Pudiste hacer lo que dijiste?» (con gracia, sin legalismo). «¿Con quién lo compartiste?».',
        minutos: 10,
      },
      {
        titulo: 'Mirar arriba',
        ayuda: 'Dos personas leen el pasaje en voz alta. Alguien lo recuenta con sus palabras. ¿Qué enseña sobre Dios? ¿Qué enseña sobre las personas? Añade una pregunta de profundización con un dato del interlineal o de las referencias.',
        minutos: 30,
        dinamica: 'recuento-en-cadena',
      },
      {
        titulo: 'Mirar adelante',
        ayuda: '«¿Qué vas a hacer esta semana en respuesta?» en forma de «Yo voy a…». «¿Con quién lo vas a compartir?». Un minuto de silencio.',
        minutos: 15,
        dinamica: 'yo-voy-a',
      },
      { titulo: 'Oración', ayuda: 'Oren por las cargas compartidas al inicio.', minutos: 10 },
    ],
  },
  {
    id: '4e',
    tipo: 'encuentro',
    nombre: 'Célula de las 4 E',
    descripcion: 'Bienvenida, exaltación, edificación y evangelismo, la estructura de célula de Joel Comiskey.',
    secciones: [
      { titulo: 'Bienvenida', ayuda: 'Un rompehielos para que todos hablen en los primeros minutos.', minutos: 15, dinamica: 'dos-verdades-un-deseo' },
      { titulo: 'Exaltación', ayuda: 'Adoración: un canto, un salmo leído juntos u oraciones breves de gratitud.', minutos: 15 },
      { titulo: 'Edificación', ayuda: 'La Palabra: lectura del pasaje y preguntas para descubrirlo y aplicarlo.', minutos: 35, dinamica: 'pregunta-luz-desafio' },
      { titulo: 'Evangelismo', ayuda: 'Mirar hacia fuera: por quién orar, a quién invitar, cómo servir esta semana.', minutos: 10, dinamica: 'silla-vacia' },
    ],
  },
  {
    id: 'expositiva',
    tipo: 'sermon',
    nombre: 'Expositiva',
    descripcion: 'Robinson y Chapell: la necesidad, puntos que salen del texto y la respuesta de la gracia.',
    secciones: [
      { titulo: 'Introducción: la necesidad', ayuda: 'Presenta la necesidad humana que toca el pasaje, en lenguaje de hoy. Que la gente sienta que el problema es suyo.', minutos: 5 },
      punto(1),
      punto(2),
      punto(3),
      { titulo: 'Conclusión', ayuda: 'Repite la idea central y muestra cómo responde la gracia de Dios en Cristo. Termina con una respuesta concreta.', minutos: 5 },
    ],
  },
  {
    id: 'yo-nosotros',
    tipo: 'sermon',
    nombre: 'Yo, nosotros, Dios, tú, nosotros',
    descripcion: 'Andy Stanley: un solo punto y una tensión que el texto resuelve.',
    secciones: [
      { titulo: 'Yo', ayuda: 'Cómo te ha tocado a ti este problema. Sé honesto y breve.', minutos: 4 },
      { titulo: 'Nosotros', ayuda: 'A todos nos pasa. Deja sentir la tensión antes de resolverla.', minutos: 5 },
      { titulo: 'Dios', ayuda: 'Qué dice el texto. Explícalo con calma: aquí la tensión se resuelve.', minutos: 12 },
      { titulo: 'Tú', ayuda: 'Qué significa esta semana para distintas personas: padres, jóvenes, quien está en crisis…', minutos: 6 },
      { titulo: 'Nosotros', ayuda: 'Cómo sería nuestra iglesia si todos viviéramos esto. Motiva desde el amor de Dios, no desde la culpa.', minutos: 3 },
    ],
  },
  {
    id: 'narrativa',
    tipo: 'sermon',
    nombre: 'Narrativa en cinco movimientos',
    descripcion: 'La trama de Eugene Lowry, para pasajes narrativos.',
    secciones: [
      { titulo: 'Desequilibrio', ayuda: 'Algo no encaja. Presenta el conflicto o la pregunta que abre el relato.', minutos: 4 },
      { titulo: 'Análisis', ayuda: '¿Por qué pasa esto? Profundiza en el problema, también en nosotros.', minutos: 7 },
      { titulo: 'Pista de resolución', ayuda: 'El giro del texto: lo inesperado que cambia la historia.', minutos: 6 },
      { titulo: 'Evangelio', ayuda: 'Dios actúa. Muestra su gracia como la respuesta al problema.', minutos: 8 },
      { titulo: 'Anticipación', ayuda: 'Qué cambia ahora. Una respuesta concreta para esta semana.', minutos: 5 },
    ],
  },
];

export const TIPOS: { tipo: Tipo; nombre: string; duracion: string; descripcion: string; minutos: number }[] = [
  {
    tipo: 'reflexion',
    nombre: 'Reflexión',
    duracion: '5 a 10 min',
    descripcion: 'Un devocional corto para compartir en un mensaje, al abrir una reunión o en familia.',
    minutos: 8,
  },
  {
    tipo: 'encuentro',
    nombre: 'Encuentro de grupo',
    duracion: '60 a 90 min',
    descripcion: 'La guía del líder con dinámicas sin materiales y la hoja para el grupo.',
    minutos: 80,
  },
  {
    tipo: 'sermon',
    nombre: 'Sermón',
    duracion: '20 a 45 min',
    descripcion: 'Una idea central que sale del texto, desarrollada con explicación, ilustración y aplicación.',
    minutos: 30,
  },
];

export const tipoInfo = (t: Tipo) => TIPOS.find((x) => x.tipo === t)!;
export const plantilla = (id: string) => PLANTILLAS.find((p) => p.id === id);

/** Lista de verificación de calidad (§2.3 del diseño). */
export const REVISION: { id: string; texto: string; solo?: Tipo[] }[] = [
  { id: 'una-frase', texto: '¿Puedo decir la idea central en una frase?' },
  { id: 'del-texto', texto: '¿Sale del texto, o la traje yo y busqué un versículo que la apoye?' },
  { id: 'contexto', texto: '¿Respeté el contexto: quién escribe, a quién, por qué, qué viene antes y después?' },
  { id: 'necesidad', texto: '¿Nombré la necesidad humana que el pasaje toca?' },
  { id: 'gracia', texto: '¿Dios y su gracia son el centro, o solo hay consejos?' },
  { id: 'eia', texto: '¿Cada punto tiene explicación, ilustración y aplicación?', solo: ['sermon'] },
  { id: 'preguntas', texto: '¿Las preguntas llevan al texto y no tienen respuesta de sí o no?', solo: ['encuentro'] },
  { id: 'concreta', texto: '¿La aplicación es concreta y posible esta semana?' },
  { id: 'memorable', texto: '¿Hay al menos una historia o imagen que la gente recordará?' },
  { id: 'tiempo', texto: '¿Cabe en el tiempo disponible?' },
];

export const revisionPara = (t: Tipo) => REVISION.filter((r) => !r.solo || r.solo.includes(t));

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const fromTemplate = (p: Plantilla): Seccion[] =>
  p.secciones.map((s) => ({ id: uid(), titulo: s.titulo, ayuda: s.ayuda, texto: '', minutos: s.minutos, dinamica: s.dinamica }));

/** Cambia de plantilla conservando lo escrito en las secciones que coinciden por posición. */
export function applyTemplate(m: Mensaje, id: string): Partial<Mensaje> {
  const p = plantilla(id);
  if (!p) return {};
  const next = fromTemplate(p);
  const written = m.secciones.filter((s) => s.texto.trim() || s.paraGrupo?.trim());
  written.forEach((s, i) => {
    if (next[i]) next[i] = { ...next[i], texto: s.texto, paraGrupo: s.paraGrupo, responsable: s.responsable };
    else next.push({ ...s, id: uid() });
  });
  return { plantilla: id, secciones: next };
}

export function nuevaSeccion(tipo: Tipo): Seccion {
  return tipo === 'sermon'
    ? { id: uid(), ...punto(0), titulo: 'Nuevo punto', texto: '' }
    : { id: uid(), titulo: 'Nueva parte', ayuda: '', texto: '', minutos: tipo === 'encuentro' ? 10 : 2 };
}

// Almacén en el dispositivo, con el mismo patrón que el progreso de lectura.
const KEY = 'taller';
let state: Mensaje[] = [];
let loaded: Promise<void> | null = null;
let isLoaded = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = JSON.parse(raw) as Mensaje[];
    })
    .catch(() => {})
    .then(() => {
      isLoaded = true;
      listeners.forEach((l) => l());
    });
  return loaded;
}

function commit(next: Mensaje[]) {
  state = next;
  listeners.forEach((l) => l());
  // Se guarda poco después de dejar de escribir.
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {}), 400);
}

export async function crearMensaje(tipo: Tipo, pasaje: Pasaje | null = null, titulo = ''): Promise<string> {
  await load();
  const p = PLANTILLAS.find((x) => x.tipo === tipo)!;
  const now = new Date().toISOString();
  const m: Mensaje = {
    id: uid(),
    tipo,
    titulo,
    pasaje,
    plantilla: p.id,
    observacion: '',
    tema: '',
    complemento: '',
    necesidad: '',
    gracia: '',
    secciones: fromTemplate(p),
    revision: [],
    seguimiento: '',
    minutos: tipoInfo(tipo).minutos,
    creado: now,
    actualizado: now,
  };
  commit([m, ...state]);
  return m.id;
}

export function actualizarMensaje(id: string, patch: Partial<Mensaje>) {
  commit(state.map((m) => (m.id === id ? { ...m, ...patch, actualizado: new Date().toISOString() } : m)));
}

export function actualizarSeccion(id: string, seccion: string, patch: Partial<Seccion>) {
  const m = state.find((x) => x.id === id);
  if (!m) return;
  actualizarMensaje(id, { secciones: m.secciones.map((s) => (s.id === seccion ? { ...s, ...patch } : s)) });
}

export function borrarMensaje(id: string) {
  commit(state.filter((m) => m.id !== id));
}

export async function duplicarMensaje(id: string): Promise<string | null> {
  await load();
  const m = state.find((x) => x.id === id);
  if (!m) return null;
  const now = new Date().toISOString();
  const copy: Mensaje = {
    ...m,
    id: uid(),
    titulo: m.titulo ? `${m.titulo} (copia)` : '',
    secciones: m.secciones.map((s) => ({ ...s, id: uid() })),
    revision: [],
    seguimiento: '',
    creado: now,
    actualizado: now,
  };
  commit([copy, ...state]);
  return copy.id;
}

export function useTaller() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { mensajes: state, ready: isLoaded };
}

// Pasajes

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Lee «Juan 3», «jn 3:16», «1 Corintios 13:1-7» o «Salmo 23». */
export function parsePasaje(input: string, books: Book[]): Pasaje | null {
  const m = fold(input).match(/^(.+?)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
  if (!m) return null;
  const name = m[1].replace(/\s+/g, ' ').replace(/^(\d)\s*/, '$1 ').trim();
  const book =
    books.find((b) => fold(b.name) === name || fold(b.abbr) === name || b.id === name) ??
    books.find((b) => fold(b.name).startsWith(name) && name.length >= 2) ??
    (name === 'salmo' ? books.find((b) => b.id === 'psa') : undefined);
  if (!book) return null;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > book.chapters) return null;
  const from = m[3] ? Number(m[3]) : undefined;
  const to = m[4] ? Number(m[4]) : undefined;
  if (from !== undefined && to !== undefined && to < from) return null;
  return { book: book.id, chapter, from, to: to !== from ? to : undefined };
}

export function pasajeLabel(p: Pasaje | null, books: Book[]) {
  if (!p) return '';
  const name = books.find((b) => b.id === p.book)?.name ?? p.book;
  if (!p.from) return `${name} ${p.chapter}`;
  return `${name} ${p.chapter}:${p.from}${p.to ? `-${p.to}` : ''}`;
}

export const enPasaje = (p: Pasaje, verse: number) => !p.from || (verse >= p.from && verse <= (p.to ?? p.from));

// Tiempo y textos para compartir

const PALABRAS_POR_MINUTO = 130;

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Minutos estimados: en un encuentro, los de cada parte; en lo demás, lo escrito leído en voz alta. */
export function duracion(m: Mensaje) {
  if (m.tipo === 'encuentro') return m.secciones.reduce((n, s) => n + (s.minutos || 0), 0);
  return Math.round(m.secciones.reduce((n, s) => n + words(s.texto), 0) / PALABRAS_POR_MINUTO);
}

export function ideaCentral(m: Mensaje) {
  const tema = m.tema.trim();
  const complemento = m.complemento.trim();
  if (!tema && !complemento) return '';
  return [tema, complemento].filter(Boolean).join(': ');
}

export function tituloDe(m: Mensaje, books: Book[]) {
  return m.titulo.trim() || pasajeLabel(m.pasaje, books) || `${tipoInfo(m.tipo).nombre} sin título`;
}

/** Todo el mensaje como texto, para copiar o enviar por WhatsApp. */
export function comoTexto(m: Mensaje, books: Book[]) {
  const out = [tituloDe(m, books)];
  const pasaje = pasajeLabel(m.pasaje, books);
  if (pasaje && pasaje !== out[0]) out.push(pasaje);
  const idea = ideaCentral(m);
  if (idea) out.push('', `Idea central: ${idea}`);
  for (const s of m.secciones) {
    const body = [s.texto.trim(), s.paraGrupo?.trim()].filter(Boolean).join('\n\n');
    if (!body) continue;
    out.push('', `*${s.titulo}*`, body);
  }
  return out.join('\n');
}

/** La hoja del participante de un encuentro: sin las notas del líder. */
export function hojaDelGrupo(m: Mensaje, books: Book[], dinamicaNombre: (id?: string) => string | undefined) {
  const out = [tituloDe(m, books)];
  const pasaje = pasajeLabel(m.pasaje, books);
  if (pasaje && pasaje !== out[0]) out.push(`Pasaje: ${pasaje}`);
  for (const s of m.secciones) {
    const lines = [`## ${s.titulo}${s.minutos ? ` · ${s.minutos} min` : ''}`];
    const nombre = dinamicaNombre(s.dinamica);
    if (nombre) lines.push(`Dinámica: ${nombre}`);
    if (s.responsable?.trim()) lines.push(`Guía: ${s.responsable.trim()}`);
    if (s.paraGrupo?.trim()) lines.push(s.paraGrupo.trim());
    out.push('', ...lines);
  }
  return out.join('\n');
}

/** El borrador resumido para que la IA lo lea en los modos Sugerir y Revisar. */
export function borradorParaIA(m: Mensaje) {
  const out: string[] = [];
  if (m.observacion.trim()) out.push(`Observaciones del autor: ${m.observacion.trim()}`);
  if (m.tema.trim() || m.complemento.trim()) out.push(`Idea central: tema «${m.tema.trim()}», complemento «${m.complemento.trim()}»`);
  if (m.necesidad.trim()) out.push(`Necesidad humana que toca el pasaje: ${m.necesidad.trim()}`);
  if (m.gracia.trim()) out.push(`Respuesta de la gracia: ${m.gracia.trim()}`);
  m.secciones.forEach((s, i) => {
    const parts = [s.texto.trim() && `Notas: ${s.texto.trim()}`, s.paraGrupo?.trim() && `Para el grupo: ${s.paraGrupo.trim()}`]
      .filter(Boolean)
      .join(' | ');
    out.push(`Sección ${i + 1}, ${s.titulo}${s.dinamica ? ` (dinámica: ${s.dinamica})` : ''}: ${parts || '(vacía)'}`);
  });
  return out.join('\n').slice(0, 12000);
}
