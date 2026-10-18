// Ayudas para probar las funciones de api/ como las llama Vercel: POST(new Request(...)).
// Las funciones leen DATA_DIR, DATABASE_URL y la configuración de la IA al importarse, así que cada archivo de
// pruebas llama a prepareEnv() y después importa la función con import() dinámico.
//
// Base de datos: las pruebas que la usan corren solo con DATABASE_URL (una base aparte para pruebas, nunca la de
// producción), por ejemplo:
//   createdb biblia_unit
//   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/biblia_unit npm test
// Las tablas se crean solas. Cada ejecución usa correos y nombres nuevos, así que se puede repetir sin limpiar.

import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import postgres from 'postgres';

import { requests, startMockAnthropic } from '../../e2e/support/mock-anthropic';

export const DB_URL = process.env.DATABASE_URL;
export const DATA_DIR = path.resolve(import.meta.dirname, '../../public/data');
/** public/data lo genera `npm run data`; sin él se saltan las pruebas que leen el texto bíblico. */
export const HAS_DATA = existsSync(path.join(DATA_DIR, 'books.json'));

export type Post = (request: Request) => Promise<Response>;

/** Variables de entorno para las funciones: datos de public/data y la IA simulada (nunca la real). */
export async function prepareEnv({ ai = false } = {}) {
  process.env.DATA_DIR = DATA_DIR;
  process.env.ANTHROPIC_API_KEY = 'clave-de-prueba';
  // Sin IA simulada, un puerto cerrado: si algo llamara a la IA, fallaría en vez de salir a internet.
  process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9';
  if (ai) {
    const port = await freePort();
    await startMockAnthropic(port);
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
  }
  return { requests };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

export const request = (url: string, body: unknown, llave?: string) =>
  new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

/**
 * Las tablas se crean la primera vez que se usa /api/comunidades. Varios archivos de pruebas corren a la vez,
 * y dos «create table if not exists» simultáneos pueden chocar en Postgres: se hace una sola vez con un candado.
 */
export async function ensureSchema(comunidades: Post) {
  const sql = postgres(DB_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`select pg_advisory_lock(424242)`;
    // Cualquier acción crea las tablas; esta además no necesita cuenta.
    await comunidades(request('/api/comunidades', { accion: 'verInvitacion', codigo: 'NOEXISTE' }));
    await sql`select pg_advisory_unlock(424242)`;
  } finally {
    await sql.end();
  }
}

let n = 0;
/** Un nombre y un correo que no se repiten entre ejecuciones. */
export const unique = (name: string) => {
  const id = `${Date.now().toString(36)}${process.pid}${n++}`;
  return { nombre: `${name} ${id}`.slice(0, 40), correo: `${name.toLowerCase()}.${id}@prueba.test` };
};

/** Cliente de /api/comunidades con la llave de una persona. */
export function client(comunidades: Post, hoy: string) {
  return async function call<T = Record<string, any>>(accion: string, body: Record<string, unknown> = {}, llave?: string) {
    const res = await comunidades(request('/api/comunidades', { accion, hoy, ...body }, llave));
    return { status: res.status, json: (await res.json()) as T };
  };
}
