// Capturas de la ruleta de preguntas en la sala y en un evento (no es una prueba):
// node e2e/capturas-ruleta.mjs <carpeta>, con el servidor de e2e (npx tsx e2e/support/server.ts) en marcha.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const hoy = new Date().toISOString().slice(0, 10);

async function post(path, body, llave) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: JSON.stringify({ hoy, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}
const cuenta = (nombre) =>
  post('/api/comunidades', {
    accion: 'registrarse',
    nombre,
    correo: `${nombre.split(' ')[0].toLowerCase()}${Date.now()}${Math.random().toString(36).slice(2, 6)}@prueba.test`,
    clave: 'clave-segura-1',
  });

const browser = await chromium.launch();
async function page(c, { device = 'Pixel 7', theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-ES' };
  const ctx = await browser.newContext(device === 'desktop' ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices[device], ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript((cu) => cu && localStorage.setItem('cuenta', cu), c ? JSON.stringify(c) : null);
  return p;
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const mike = await cuenta('Mike Blanco');
const beto = await cuenta('Beto Ramírez');
const carla = await cuenta('Carla Gómez');
const sala = await post('/api/vivo', { accion: 'crearSala', libro: 'col', capitulo: 3, titulo: 'Discipulado de los jueves' }, mike.llave);
const S = sala.sala.codigo;
for (const c of [beto, carla]) await post('/api/vivo', { accion: 'unirseSala', sala: S }, c.llave);
const pm = await page(mike);
await pm.goto(`${BASE}/vivo/${S}`);
await pm.getByText('Tú guías la lectura').waitFor();
const pb = await page(beto);
await pb.goto(`${BASE}/vivo/${S}`);
const pc = await page(carla, { theme: 'oscuro' });
await pc.goto(`${BASE}/vivo/${S}`);

await pm.getByRole('button', { name: 'Mostrar' }).click();
await pm.getByRole('radio', { name: 'Ruleta de preguntas' }).click();
await pm.getByRole('radio', { name: 'Por equipos' }).click();
await pm.getByRole('button', { name: 'Empezar: Ruleta de preguntas' }).click();
const kick = (p) => p.getByText('RULETA DE PREGUNTAS', { exact: true }).first();
await kick(pb).waitFor();
await kick(pb).scrollIntoViewIfNeeded();
await wait(500);
await shot(pb, 'r-1-ruleta-lista');
await pm.getByRole('button', { name: 'Girar la ruleta' }).click();
await wait(2300);
await kick(pc).scrollIntoViewIfNeeded();
await shot(pc, 'r-2-girando-oscuro');
const b = pb.getByRole('button', { name: 'B: La respuesta fiel al texto', exact: true });
await b.waitFor({ timeout: 10000 });
await kick(pb).scrollIntoViewIfNeeded();
await wait(300);
await shot(pb, 'r-3-pregunta');
await b.click();
await pc.getByRole('button', { name: 'A: Opción falsa uno', exact: true }).click();
await pm.getByRole('button', { name: 'Revelar la respuesta' }).click();
await wait(2500);
await kick(pb).scrollIntoViewIfNeeded();
await shot(pb, 'r-4-revelada-equipos');

// En un evento: la ruleta del mensaje en el proyector
const ev = await post(
  '/api/vivo',
  {
    accion: 'publicar',
    mensaje: `rul${Date.now()}`,
    titulo: 'El Padre que corre',
    pasaje: { book: 'luk', chapter: 15, from: 11, to: 24 },
    puntos: [{ titulo: 'El Padre corre', texto: '', citas: ['Lucas 15:20', 'Romanos 5:8'] }],
  },
  mike.llave,
);
const E = ev.evento.codigo;
await post('/api/vivo', { accion: 'mover', codigo: E, estado: 'en-vivo', punto: 0 }, mike.llave);
const ep = await page(mike);
await ep.goto(`${BASE}/evento/${E}`);
await ep.getByText('TU EVENTO · PUNTO 1 DE 1').waitFor();
await ep.getByRole('button', { name: 'Interactuar: que la iglesia responda' }).click();
await ep.getByRole('tab', { name: 'Ruleta de preguntas' }).click();
await ep.getByRole('button', { name: 'Preparar la ruleta' }).click();
await ep.getByText('PARA LA VIDA · DIFÍCIL').waitFor();
await ep.getByText('Por equipos').click();
await wait(300);
await ep.getByText('Revisa las preguntas').scrollIntoViewIfNeeded();
await shot(ep, 'r-5-evento-lanzar');
await ep.getByRole('button', { name: 'Empezar la ruleta (12)' }).click();
const proy = await page(mike, { device: 'desktop' });
await proy.goto(`${BASE}/evento/${E}/proyectar`);
await proy.getByText(/RULETA DE PREGUNTAS/).waitFor();
await wait(800);
await shot(proy, 'r-6-proyector-ruleta');
await post('/api/vivo', { accion: 'interactuar', codigo: E, girar: true }, mike.llave);
await wait(7000);
await shot(proy, 'r-7-proyector-pregunta');
await browser.close();
