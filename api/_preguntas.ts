// Preguntas frecuentes anónimas: cada pregunta de seguimiento que alguien deja compartir se guarda limpia, sin cuenta
// ni sesión, para descubrir más adelante qué se pregunta más de cada pasaje y añadirlo al estudio para todos.
//
// Cómo se cuida a la persona (ver /mnt/project-files/investigacion/zarza-estrategia.md):
// - Se limpia ANTES de guardar: correos, teléfonos, enlaces, números largos y @menciones se borran.
// - No se guarda quién preguntó. Solo un seudónimo por capítulo (hash con sal de la cuenta + el capítulo) para contar
//   personas distintas; no sirve para unir las preguntas de alguien entre capítulos (el error de AOL en 2006).
// - Una pregunta solo se publicará si la hicieron al menos 5 personas distintas, reescrita y revisada.
// - El Modo Jóvenes y el Espacio Niños nunca envían preguntas (lo decide la app y lo vuelve a mirar el servidor).

import { createHash } from 'node:crypto';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
// La sal separa los seudónimos de los ids de la base: sin ella, quien vea la tabla podría recalcularlos.
const SAL = process.env.PREGUNTAS_SAL ?? createHash('sha256').update(`preguntas:${DB_URL ?? ''}`).digest('hex');
const MAX = 400;

let sql: ReturnType<typeof postgres> | null = null;
let ready: Promise<unknown> | null = null;

/** Quita lo que pueda identificar a alguien. Devuelve null si no queda una pregunta que valga la pena guardar. */
export function limpiarPregunta(texto: string): string | null {
  const limpio = texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, ' ')
    .replace(/\d{5,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (limpio.length < 8 || limpio.length > MAX) return null;
  return limpio;
}

/** Guarda la pregunta limpia. Nunca falla hacia fuera: compartir es una ayuda, no un requisito. */
export async function guardarPregunta(request: Request, libro: string, capitulo: number, versiculo: number | undefined, texto: string) {
  const limpio = limpiarPregunta(texto);
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!limpio || !key || !DB_URL) return;
  try {
    sql ??= postgres(DB_URL, { max: 1, idle_timeout: 20, onnotice: () => {} });
    ready ??= sql`
      create table if not exists preguntas_anonimas (
        id bigserial primary key,
        libro text not null,
        capitulo int not null,
        versiculo int,
        texto text not null,
        quien text not null,
        dia date not null default current_date
      )`
      .then(() => sql!`create index if not exists preguntas_anonimas_pasaje on preguntas_anonimas (libro, capitulo)`)
      .catch((err) => {
        ready = null;
        throw err;
      });
    await ready;
    const hash = createHash('sha256').update(key).digest('hex');
    const [s] = await sql<{ usuario_id: string }[]>`select usuario_id from sesiones where llave_hash = ${hash}`;
    if (!s) return;
    const quien = createHash('sha256').update(`${SAL}:${s.usuario_id}:${libro}:${capitulo}`).digest('hex').slice(0, 24);
    await sql`
      insert into preguntas_anonimas (libro, capitulo, versiculo, texto, quien)
      values (${libro}, ${capitulo}, ${versiculo ?? null}, ${limpio}, ${quien})`;
  } catch (err) {
    console.error('preguntas anónimas', err);
  }
}
