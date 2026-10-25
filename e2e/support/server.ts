// Sirve la web exportada (dist/) como Vercel y ejecuta las funciones de api/ en el mismo proceso, con la
// IA simulada (mock-anthropic.ts) y la base de datos de DATABASE_URL. Lo arranca playwright.config.ts.
//
// Uso: npx tsx e2e/support/server.ts   (antes: npm run data && npm run comentarios && npm run build:web)

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import postgres from 'postgres';

import { startMockAnthropic } from './mock-anthropic';
import { configureFacebook, handleFacebook } from './mock-facebook';
import { handlePush } from './mock-push';

const PORT = Number(process.env.PORT ?? 8081);
const AI_PORT = Number(process.env.AI_PORT ?? 8089);
const DIST = path.resolve(process.env.DIST ?? 'dist');

process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${AI_PORT}`;
process.env.ANTHROPIC_API_KEY = 'clave-de-prueba';
process.env.DATABASE_URL ??= 'postgres://postgres:postgres@127.0.0.1:5432/biblia_e2e';
process.env.DATA_DIR = path.join(DIST, 'data');
// Los avisos push van al servicio simulado de este mismo servidor (mock-push.ts).
process.env.PUSH_HOSTS = 'localhost,127.0.0.1';
// Quienes cuidan Zarza en las pruebas (/cuidar: iglesias y círculos de solteros; e2e/circulo.spec.ts, e2e/iglesias.spec.ts).
process.env.CUIDADORES ??= 'cuidadora@prueba.test,cuidar-e2e@prueba.test';
// Las fotos de perfil van a una carpeta servida como el resto de dist/, y Facebook es el simulado.
process.env.FOTOS_STORE_DIR ??= path.join(DIST, 'fotos-prueba');
process.env.FOTOS_URL ??= '/fotos-prueba';
configureFacebook(`http://localhost:${PORT}`);
process.env.AUTH_SECRET ??= 'secreto-de-prueba-para-auth-js';

type Handler = (request: Request) => Promise<Response>;
const handlers = new Map<string, Promise<Record<string, Handler>>>();
const FUNCTIONS = ['audio', 'buscar', 'comentario', 'auth', 'comunidades', 'estudiar', 'notificaciones', 'podcast-grabado', 'sincronizar', 'vivo'];

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

async function file(p: string) {
  try {
    const s = await stat(p);
    if (s.isFile()) return p;
    if (s.isDirectory()) return (await stat(path.join(p, 'index.html'))).isFile() ? path.join(p, 'index.html') : null;
  } catch {}
  return null;
}

async function api(name: string, req: IncomingMessage, res: ServerResponse) {
  if (!FUNCTIONS.includes(name)) {
    res.writeHead(404);
    return res.end();
  }
  if (!handlers.has(name)) handlers.set(name, import(`../../api/${name}.ts`));
  const handler = (await handlers.get(name)!)[req.method ?? 'GET'];
  if (!handler) {
    res.writeHead(405);
    return res.end();
  }
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    signal: controller.signal,
    // @ts-expect-error: necesario en Node para cuerpos en streaming
    duplex: 'half',
  });
  const response = await handler(request);
  // Varias cookies van en cabeceras Set-Cookie separadas (Object.fromEntries las juntaría en una).
  const headers: Record<string, string | string[]> = Object.fromEntries(response.headers);
  if (response.headers.getSetCookie().length) headers['set-cookie'] = response.headers.getSetCookie();
  res.writeHead(response.status, headers);
  if (!response.body) return res.end();
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
  res.end();
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.startsWith('/__push') && (await handlePush(req, res))) return;
  if (pathname.startsWith('/__facebook/')) return handleFacebook(req, res);
  // Como la reescritura de vercel.json: todo /api/auth/… va a la función api/auth.ts.
  if (pathname.startsWith('/api/auth/')) return api('auth', req, res);
  if (pathname.startsWith('/api/')) return api(pathname.slice(5).replace(/\/$/, ''), req, res);
  // Como vercel.json: los archivos que existen se sirven tal cual; el resto de rutas abren la app.
  let p = await file(path.join(DIST, path.normalize(pathname)));
  if (!p && !/^\/(data|_expo|assets)\//.test(pathname)) p = path.join(DIST, 'app.html');
  if (!p) {
    res.writeHead(404);
    return res.end();
  }
  const type = TYPES[path.extname(p)] ?? 'application/octet-stream';
  // Rangos como Vercel: sin ellos el navegador no puede saltar dentro de un MP3 (seekTo vuelve al principio).
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range) {
    const { size } = await stat(p);
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    return createReadStream(p, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes' });
  createReadStream(p).pipe(res);
}

/** Las herramientas con IA se guardan por capítulo para todos: cada ejecución empieza sin ninguna guardada. */
async function clearSavedTools() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await sql`delete from herramientas_ia`.catch(() => {}); // la tabla aún no existe la primera vez
  await sql`delete from estudios_ia`.catch(() => {});
  await sql.end();
}

void Promise.all([startMockAnthropic(AI_PORT), clearSavedTools()]).then(() =>
  createServer((req, res) =>
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }),
).listen(PORT, () => console.log(`Servidor de pruebas en http://localhost:${PORT}`)),
);
