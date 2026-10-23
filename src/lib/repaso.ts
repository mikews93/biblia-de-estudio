// El repaso relámpago del estudio en grupo: cinco preguntas de opción múltiple sobre el capítulo que la IA prepara
// una vez y quedan guardadas para todos (herramienta «repaso» de api/estudiar.ts). Sin dependencias de React
// Native: también lo usa api/_celula.ts.

/**
 * `correcta` es el índice de la opción buena (en «ordena» y «espada», 0: la respuesta se compara con `solucion`).
 * Antes de revelarse, el servidor manda `correcta` −1 y sin `cita` ni `solucion`.
 */
export type PreguntaRepaso = { texto: string; opciones: string[]; correcta: number; cita: string | null; solucion?: string; versiculos?: number };

/**
 * Los juegos del estudio en grupo. «repaso», «quien» y «mentira» son de opción múltiple (la IA los prepara una vez por
 * capítulo); «ordena» (las palabras de un versículo revueltas) y «espada» (encontrar el versículo de una frase) se
 * arman en el teléfono con el texto del capítulo.
 */
export type Juego = 'repaso' | 'quien' | 'mentira' | 'ordena' | 'espada';
export const JUEGOS: { id: Juego; nombre: string; kicker: string; detalle: string }[] = [
  { id: 'repaso', nombre: 'Repaso relámpago', kicker: 'REPASO RELÁMPAGO', detalle: 'Preguntas de opción múltiple sobre el capítulo' },
  { id: 'quien', nombre: '¿Quién lo dijo?', kicker: '¿QUIÉN LO DIJO?', detalle: 'Una frase del capítulo y cuatro personajes' },
  { id: 'mentira', nombre: 'Dos verdades y una mentira', kicker: 'DOS VERDADES Y UNA MENTIRA', detalle: 'Tres frases sobre el capítulo: ¿cuál es falsa?' },
  { id: 'ordena', nombre: 'Ordena el versículo', kicker: 'ORDENA EL VERSÍCULO', detalle: 'Las palabras revueltas: tócalas en orden' },
  { id: 'espada', nombre: 'Espada bíblica', kicker: 'ESPADA BÍBLICA', detalle: 'Una frase: el más rápido en encontrar el versículo' },
];
/** Los que se responden escribiendo o tocando otra cosa que una opción: el servidor compara con `solucion`. */
export const conSolucion = (j: Juego | undefined) => j === 'ordena' || j === 'espada';

export const LETRAS = ['A', 'B', 'C', 'D'];
export const MAX_PREGUNTAS = 8;

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
      const cita = lines.find((l) => /^V:/i.test(l))?.replace(/^V:\s*/i, '') || null;
      const correcta = letra ? LETRAS.indexOf(letra) : -1;
      if (!texto || opciones.some((o) => !o) || correcta < 0 || correcta >= opciones.length) return null;
      return { texto, opciones: opciones as string[], correcta, cita };
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
