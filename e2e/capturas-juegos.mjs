// Capturas de los juegos del estudio en grupo y de la interacción en los eventos (no es una prueba):
// node e2e/capturas-juegos.mjs <carpeta>, con el servidor de e2e (npx tsx e2e/support/server.ts) en marcha.
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
const card = (p, k) => p.getByText(k, { exact: true }).first();

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

async function lanzar(nombre, modo) {
  await pm.getByRole('button', { name: 'Mostrar' }).click();
  await pm.getByRole('radio', { name: nombre }).click();
  if (modo) await pm.getByRole('radio', { name: modo }).click();
  await wait(300);
  return pm.getByRole('button', { name: `Empezar: ${nombre}` });
}

// 1. El panel de juegos del guía
await lanzar('Ordena el versículo', 'Por equipos');
await shot(pm, 'j-1-panel-juegos');
await pm.getByRole('button', { name: 'Empezar: Ordena el versículo' }).click();

// 2. Ordena el versículo en el teléfono de Beto, a medio ordenar
await card(pb, 'ORDENA EL VERSÍCULO').waitFor();
await card(pb, 'ORDENA EL VERSÍCULO').scrollIntoViewIfNeeded();
const pool = pb.getByTestId('ordena-palabras').getByRole('button');
for (let k = 0; k < 3; k++) await pool.nth(k).click();
await wait(300);
await shot(pb, 'j-2-ordena');
const n = await pool.count();
for (let k = 3; k < n; k++) await pool.nth(k).click();
await pb.getByRole('button', { name: 'Listo' }).click();
await pm.getByRole('button', { name: 'Revelar la respuesta' }).click();
await wait(2500);
await card(pb, 'ORDENA EL VERSÍCULO').scrollIntoViewIfNeeded();
await shot(pb, 'j-3-ordena-revelado');

// 3. Espada bíblica en el teléfono de Carla (oscuro)
await (await lanzar('Espada bíblica', 'Con puntos')).click();
await card(pc, 'ESPADA BÍBLICA').waitFor();
await card(pc, 'ESPADA BÍBLICA').scrollIntoViewIfNeeded();
await wait(400);
await shot(pc, 'j-4-espada-oscuro');

// 4. Dos verdades y una mentira, revelada
await (await lanzar('Dos verdades y una mentira', 'En grupo')).click();
await card(pb, 'DOS VERDADES Y UNA MENTIRA').waitFor();
await pc.getByText('DOS VERDADES Y UNA MENTIRA').waitFor();
await pb.getByRole('button', { name: /^C: Nuestra vida/ }).click();
await pc.getByRole('button', { name: /^C: Nuestra vida/ }).click();
await pm.getByRole('button', { name: 'Revelar la respuesta' }).click();
await wait(2500);
await card(pb, 'DOS VERDADES Y UNA MENTIRA').scrollIntoViewIfNeeded();
await shot(pb, 'j-5-mentira');

// 5. ¿Quién lo dijo?
await (await lanzar('¿Quién lo dijo?', 'En grupo')).click();
await card(pc, '¿QUIÉN LO DIJO?').waitFor();
await card(pc, '¿QUIÉN LO DIJO?').scrollIntoViewIfNeeded();
await wait(400);
await shot(pc, 'j-6-quien-oscuro');

// Eventos: un sermón de varias citas
const ev = await post(
  '/api/vivo',
  {
    accion: 'publicar',
    mensaje: `cap${Date.now()}`,
    titulo: 'El Padre que corre',
    idea: 'Dios corre hacia quien vuelve a él.',
    pasaje: { book: 'luk', chapter: 15, from: 11, to: 24 },
    puntos: [
      { titulo: 'Nos alejamos', texto: '', citas: ['Lucas 15:13', 'Isaías 53:6'] },
      { titulo: 'Volvemos en sí', texto: '', citas: ['Romanos 2:4'] },
      { titulo: 'El Padre corre', texto: '', citas: ['Lucas 15:20', 'Romanos 5:8'] },
    ],
  },
  mike.llave,
);
const E = ev.evento.codigo;
await post('/api/vivo', { accion: 'mover', codigo: E, estado: 'en-vivo', punto: 2 }, mike.llave);
const ep = await page(mike);
await ep.goto(`${BASE}/evento/${E}`);
await ep.getByText('TU EVENTO · PUNTO 3 DE 3').waitFor();
await ep.getByRole('button', { name: 'Interactuar: que la iglesia responda' }).click();
await ep.getByRole('button', { name: 'Preparar el repaso' }).click();
await ep.getByText('Según Romanos 5:8').waitFor();
await wait(400);
await shot(ep, 'e-1-lanzar');
await ep.getByRole('button', { name: 'Cerrar' }).last().click();

await post('/api/vivo', { accion: 'interactuar', codigo: E, nueva: { tipo: 'pregunta', titulo: '¿Qué te habló Dios en este mensaje?' } }, mike.llave);
const { evento } = await post('/api/vivo', { accion: 'ver', codigo: E }, mike.llave);
const respuestas = [
  'Que no importa cuán lejos me fui, él me espera.',
  'Gracia',
  'Que tengo que volver a casa y pedir perdón a mi papá.',
  'Me impactó que el padre corrió primero.',
  'Su bondad me lleva al arrepentimiento',
  'Que puedo dejar la vergüenza',
];
for (const [k, texto] of respuestas.entries())
  await post('/api/vivo', { accion: 'responderEvento', codigo: E, interaccion: evento.interaccion.id, participante: `captura-participante-${k}xx`, texto });
const fiel = await page(null);
await fiel.goto(`${BASE}/evento/${E}`);
await fiel.getByText('PREGUNTA PARA TODOS').waitFor();
await fiel.getByLabel('Tu respuesta').fill('Que el Padre me ve de lejos y corre hacia mí.');
await wait(300);
await shot(fiel, 'e-2-congregacion-responde');
await post('/api/vivo', { accion: 'interactuar', codigo: E, revelar: true }, mike.llave);
await fiel.getByText('Lo que respondió la iglesia').waitFor({ timeout: 15000 });
await wait(1200);
await shot(fiel, 'e-3-muro');
const proy = await page(mike, { device: 'desktop', theme: 'oscuro' });
await proy.goto(`${BASE}/evento/${E}/proyectar`);
await proy.getByText('PREGUNTA PARA TODOS').waitFor();
await wait(1500);
await shot(proy, 'e-4-proyector-muro');

await browser.close();
