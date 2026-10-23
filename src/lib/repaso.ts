// El repaso relámpago del estudio en grupo: cinco preguntas de opción múltiple sobre el capítulo que la IA prepara
// una vez y quedan guardadas para todos (herramienta «repaso» de api/estudiar.ts). Sin dependencias de React
// Native: también lo usa api/_celula.ts.

/**
 * `correcta` es el índice de la opción buena (en «ordena» y «espada», 0: la respuesta se compara con `solucion`).
 * Antes de revelarse, el servidor manda `correcta` −1 y sin `cita` ni `solucion`.
 */
export type PreguntaRepaso = {
  texto: string;
  opciones: string[];
  correcta: number;
  cita: string | null;
  solucion?: string;
  versiculos?: number;
  /** Ruleta: la categoría de la pregunta (una de CATEGORIAS) y su dificultad, de 1 (fácil) a 3 (difícil). */
  categoria?: Categoria;
  nivel?: number;
};

/**
 * Los juegos del estudio en grupo. «repaso», «quien» y «mentira» son de opción múltiple (la IA los prepara una vez por
 * capítulo); «ordena» (las palabras de un versículo revueltas) y «espada» (encontrar el versículo de una frase) se
 * arman en el teléfono con el texto del capítulo.
 */
export type Juego = 'repaso' | 'quien' | 'mentira' | 'ordena' | 'espada' | 'ruleta';
export const JUEGOS: { id: Juego; nombre: string; kicker: string; detalle: string }[] = [
  { id: 'repaso', nombre: 'Repaso relámpago', kicker: 'REPASO RELÁMPAGO', detalle: 'Preguntas de opción múltiple sobre el capítulo' },
  { id: 'quien', nombre: '¿Quién lo dijo?', kicker: '¿QUIÉN LO DIJO?', detalle: 'Una frase del capítulo y cuatro personajes' },
  { id: 'mentira', nombre: 'Dos verdades y una mentira', kicker: 'DOS VERDADES Y UNA MENTIRA', detalle: 'Tres frases sobre el capítulo: ¿cuál es falsa?' },
  { id: 'ordena', nombre: 'Ordena el versículo', kicker: 'ORDENA EL VERSÍCULO', detalle: 'Las palabras revueltas: tócalas en orden' },
  { id: 'espada', nombre: 'Espada bíblica', kicker: 'ESPADA BÍBLICA', detalle: 'Una frase: el más rápido en encontrar el versículo' },
  { id: 'ruleta', nombre: 'Ruleta de preguntas', kicker: 'RULETA DE PREGUNTAS', detalle: 'Gira la ruleta: la categoría y los puntos los decide ella' },
];
/** Los que se responden escribiendo o tocando otra cosa que una opción: el servidor compara con `solucion`. */
export const conSolucion = (j: Juego | undefined) => j === 'ordena' || j === 'espada';

export const LETRAS = ['A', 'B', 'C', 'D'];
export const MAX_PREGUNTAS = 12;
/** Los topes de la sala y de los eventos (api/_celula.ts, api/vivo.ts). Lo que escribe la IA se recorta a ellos. */
export const MAX_TEXTO_PREGUNTA = 280;
export const MAX_OPCION = 200;
export const MAX_CITA = 60;

/** Recorta en una palabra, con «…», para que una pregunta larga no tumbe todo el juego. */
function recortar(t: string, max: number) {
  if (t.length <= max) return t;
  const corte = t.slice(0, max - 1);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > max / 2 ? corte.slice(0, espacio) : corte).replace(/[\s,;:.]+$/, '')}…`;
}

/** Una sola cita: si la IA pone varias («1 Reyes 18:21; 18:36»), queda la primera. */
function unaCita(c: string | undefined) {
  const t = c?.replace(/^[«"“]|[»"”]$/g, '').trim();
  if (!t) return null;
  return t.length <= MAX_CITA ? t : recortar(t.split(/\s*[;|]\s*|\s+y\s+/)[0], MAX_CITA);
}

/** Lee el formato «P: … / A) … / R: B / V: cita». Se salta las preguntas mal formadas. */
export function parseRepaso(text: string): PreguntaRepaso[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim());
      const texto = lines.find((l) => /^P:/i.test(l))?.replace(/^P:\s*/i, '');
      // «Dos verdades y una mentira» lleva tres opciones; las demás, cuatro.
      const opciones = LETRAS.map((L) => lines.find((l) => new RegExp(`^${L}[).]\\s`).test(l))?.replace(/^[A-D][).]\s*/, '')).filter(
        (o, i) => o || i < 3,
      );
      const letra = lines.find((l) => /^R:/i.test(l))?.replace(/^R:\s*/i, '').trim()[0]?.toUpperCase();
      const cita = unaCita(lines.find((l) => /^V:/i.test(l))?.replace(/^V:\s*/i, ''));
      const cat = lines.find((l) => /^C:/i.test(l))?.replace(/^C:\s*/i, '').trim().toLowerCase();
      const categoria = CATEGORIAS.find((c) => c.id === cat || c.nombre.toLowerCase() === cat)?.id;
      const nivel = Number(lines.find((l) => /^N:/i.test(l))?.replace(/^N:\s*/i, '').trim()[0]);
      const correcta = letra ? LETRAS.indexOf(letra) : -1;
      if (!texto || opciones.some((o) => !o) || correcta < 0 || correcta >= opciones.length) return null;
      return {
        texto: recortar(texto, MAX_TEXTO_PREGUNTA),
        opciones: (opciones as string[]).map((o) => recortar(o, MAX_OPCION)),
        correcta,
        cita,
        ...(categoria && { categoria }),
        ...(nivel >= 1 && nivel <= 3 && { nivel }),
      };
    })
    .filter((q): q is PreguntaRepaso => q !== null)
    .slice(0, MAX_PREGUNTAS);
}

/** Una pregunta «la acertó el grupo» si la mayoría de quienes respondieron eligió la correcta. */
export function acertoElGrupo(votos: number[], correcta: number) {
  const total = votos.reduce((a, b) => a + b, 0);
  return total > 0 && votos[correcta] * 2 > total;
}

/** Cómo se juega: en equipo (el grupo acierta junto), con puntos y podio, o dos equipos. */
export type ModoRepaso = 'grupo' | 'puntos' | 'equipos';
export const NOMBRES_EQUIPOS = ['Equipo Lámpara', 'Equipo Pergamino'];

/** Segundos para el extra por rapidez: responder al instante vale 1000, al final de este tiempo 500. */
const RAPIDEZ_SEGUNDOS = 30;

/** Los puntos de una respuesta correcta según lo que tardó desde que apareció la pregunta. */
export function puntosPor(segundos: number) {
  const t = Math.min(Math.max(segundos, 0), RAPIDEZ_SEGUNDOS) / RAPIDEZ_SEGUNDOS;
  return Math.round((1000 - 500 * t) / 10) * 10;
}

export type RespuestaRepaso = { usuario: string; nombre: string; paso: number; opcion: number; creado: string };

/**
 * Los puntos de cada persona en las preguntas ya reveladas, de más a menos (a igualdad, por nombre). Solo se
 * cuentan las reveladas: así nadie sabe antes de tiempo si acertó.
 */
export function marcador(respuestas: RespuestaRepaso[], preguntas: PreguntaRepaso[], desdes: (string | null)[], reveladas: number[]) {
  const map = new Map<string, { usuario: string; nombre: string; puntos: number; aciertos: number }>();
  for (const r of respuestas) {
    const fila = map.get(r.usuario) ?? { usuario: r.usuario, nombre: r.nombre, puntos: 0, aciertos: 0 };
    map.set(r.usuario, fila);
    if (!reveladas.includes(r.paso) || preguntas[r.paso]?.correcta !== r.opcion) continue;
    const desde = desdes[r.paso];
    fila.puntos += puntosPor(desde ? (Date.parse(r.creado) - Date.parse(desde)) / 1000 : RAPIDEZ_SEGUNDOS);
    fila.aciertos++;
  }
  return [...map.values()].sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));
}

/** Reparte a quienes están en dos equipos parejos; quien llega después va al equipo con menos gente. */
export function equipoPara(equipos: Record<string, number>) {
  const n = [0, 0];
  for (const e of Object.values(equipos)) n[e]++;
  return n[0] <= n[1] ? 0 : 1;
}

// Juegos que se arman con el texto del capítulo

const PALABRAS_MIN = 6;
const PALABRAS_MAX = 16;

function barajar<T>(xs: T[], azar: () => number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const limpio = (t: string) => t.replace(/[⟦⟧[\]¶]/g, '').replace(/\s+/g, ' ').trim();

/** Ordena el versículo: versículos de largo mediano con sus palabras revueltas (nunca en su orden). */
export function preguntasOrdena(nombre: string, capitulo: number, versos: [number, string][], cuantas = 5, azar = Math.random): PreguntaRepaso[] {
  const buenos = versos.map(([n, t]) => [n, limpio(t)] as const).filter(([, t]) => {
    const w = t.split(' ').length;
    return w >= PALABRAS_MIN && w <= PALABRAS_MAX;
  });
  return barajar(buenos, azar)
    .slice(0, cuantas)
    .sort((a, b) => a[0] - b[0])
    .map(([n, t]) => {
      const palabras = t.split(' ');
      let revueltas = barajar(palabras, azar);
      for (let k = 0; k < 5 && revueltas.join(' ') === t; k++) revueltas = barajar(palabras, azar);
      return { texto: 'Toca las palabras en orden', opciones: revueltas, correcta: 0, cita: `${nombre} ${capitulo}:${n}`, solucion: t };
    });
}

/** Espada bíblica: un pedazo de un versículo para encontrar en el capítulo; gana quien toca primero su número. */
export function preguntasEspada(nombre: string, capitulo: number, versos: [number, string][], cuantas = 5, azar = Math.random): PreguntaRepaso[] {
  const buenos = versos.map(([n, t]) => [n, limpio(t)] as const).filter(([, t]) => t.split(' ').length >= 7);
  return barajar(buenos, azar)
    .slice(0, cuantas)
    .map(([n, t]) => {
      const w = t.split(' ');
      const largo = Math.min(9, w.length);
      const desde = Math.floor(azar() * (w.length - largo + 1));
      const frase = w.slice(desde, desde + largo).join(' ').replace(/^[,;:.]+|[,;:]+$/g, '');
      return {
        texto: `«${desde > 0 ? '…' : ''}${frase}${desde + largo < w.length ? '…' : ''}»`,
        opciones: [],
        correcta: 0,
        cita: `${nombre} ${capitulo}:${n}`,
        solucion: String(n),
        versiculos: versos.length,
      };
    });
}

/** Cómo compara el servidor la respuesta de «ordena» y «espada» con la solución. */
export const mismaRespuesta = (a: string, b: string) => limpio(a).toLowerCase() === limpio(b).toLowerCase();

// Ruleta de preguntas: la ruleta cae en una casilla (una categoría y un nivel) y sale la pregunta de esa casilla. Las
// difíciles valen más. Las categorías invitan a pensar el tema, no solo a recordar quién dijo qué.

export type Categoria = 'texto' | 'sentido' | 'tema' | 'vida';
export const CATEGORIAS: { id: Categoria; nombre: string; detalle: string }[] = [
  { id: 'texto', nombre: 'Lo que dice', detalle: 'qué pasa, quién, en qué orden' },
  { id: 'sentido', nombre: 'Qué significa', detalle: 'por qué lo dice, qué palabra o imagen usa y qué quiere decir' },
  { id: 'tema', nombre: 'El tema', detalle: 'la idea central y lo que enseña de Dios' },
  { id: 'vida', nombre: 'Para la vida', detalle: 'qué respuesta vive mejor esta enseñanza en una situación concreta' },
];
export const NIVELES = ['Fácil', 'Media', 'Difícil'];
export const PUNTOS_NIVEL = [100, 200, 300];
/** Las doce casillas en orden en el círculo: cada categoría en sus tres niveles, sin dos vecinas iguales. */
export const RULETA: { categoria: Categoria; nivel: number; puntos: number }[] = (
  [
    ['texto', 1],
    ['sentido', 2],
    ['tema', 3],
    ['vida', 1],
    ['texto', 2],
    ['sentido', 3],
    ['tema', 1],
    ['vida', 2],
    ['texto', 3],
    ['sentido', 1],
    ['tema', 2],
    ['vida', 3],
  ] as [Categoria, number][]
).map(([categoria, nivel]) => ({ categoria, nivel, puntos: PUNTOS_NIVEL[nivel - 1] }));
/** Cuántas vueltas tiene una ruleta: luego se ve quién ganó. */
export const GIROS = 6;

/**
 * Un giro: una casilla al azar entre las que todavía tienen pregunta, y esa pregunta (la de su categoría y nivel; si
 * la IA no hizo esa, otra de la categoría o cualquiera sin usar). Devuelve null si ya se usaron todas.
 */
export function girarRuleta(preguntas: PreguntaRepaso[], usadas: number[], azar = Math.random) {
  const libres = preguntas.map((_, i) => i).filter((i) => !usadas.includes(i));
  if (!libres.length) return null;
  const opciones = RULETA.map((c, casilla) => {
    const paso =
      libres.find((i) => preguntas[i].categoria === c.categoria && preguntas[i].nivel === c.nivel) ??
      libres.find((i) => preguntas[i].categoria === c.categoria && !preguntas[i].nivel);
    return paso === undefined ? null : { casilla, paso };
  }).filter((x): x is { casilla: number; paso: number } => x !== null);
  if (opciones.length) return opciones[Math.floor(azar() * opciones.length)];
  // Preguntas sin categoría: cualquier casilla, cualquier pregunta libre.
  return { casilla: Math.floor(azar() * RULETA.length), paso: libres[Math.floor(azar() * libres.length)] };
}

/** Los puntos que deja una pregunta a un conjunto de personas: el valor de la casilla por la parte que acertó. */
const parte = (valor: number, bien: number, total: number) => (total ? Math.round(((valor * bien) / total) / 10) * 10 : 0);

/**
 * El puntaje de la ruleta en las preguntas reveladas. `grupo`: lo que suma todo el grupo junto. `equipos`: lo de
 * cada equipo, por la parte de su gente que acertó (así un equipo más grande no gana solo por ser más). `personas`:
 * a cada uno, el valor de la casilla de cada pregunta que acertó.
 */
export function puntajeRuleta(
  respuestas: { usuario: string; paso: number; opcion: number; equipo?: number | null }[],
  preguntas: PreguntaRepaso[],
  casillas: Record<number, number>,
  reveladas: number[],
) {
  const out = { grupo: 0, equipos: [0, 0], personas: {} as Record<string, number> };
  for (const p of reveladas) {
    const valor = RULETA[casillas[p]]?.puntos ?? 0;
    const correcta = preguntas[p]?.correcta;
    const rs = respuestas.filter((r) => r.paso === p);
    out.grupo += parte(valor, rs.filter((r) => r.opcion === correcta).length, rs.length);
    for (const e of [0, 1]) {
      const de = rs.filter((r) => r.equipo === e);
      out.equipos[e] += parte(valor, de.filter((r) => r.opcion === correcta).length, de.length);
    }
    for (const r of rs) out.personas[r.usuario] = (out.personas[r.usuario] ?? 0) + (r.opcion === correcta ? valor : 0);
  }
  return out;
}

/** En un evento no hay cuentas: el equipo sale del identificador del teléfono, siempre el mismo y parejo. */
export function equipoDe(participante: string) {
  let h = 0;
  for (const ch of participante) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2;
}
