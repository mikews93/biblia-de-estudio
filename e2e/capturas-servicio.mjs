// Capturas del reconocimiento al servicio (no es una prueba): la tarjeta de Mi diario, el cielo de cada nivel, las
// insignias y la corona de estrellas en la comunidad. node e2e/capturas-servicio.mjs <carpeta>, con el servidor de
// pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const ZONA = 'America/Bogota';
const AHORA = new Date('2026-10-26T00:40:00Z');
const HOY = '2026-10-25';

const dia = (n) => new Date(Date.UTC(2026, 9, 25 + n)).toISOString().slice(0, 10);

/** Las huellas de Mis sellos de alguien que ha servido tanto. */
function sellos({ profundos, escritos, guiados }) {
  const huellas = {};
  for (let i = 0; i < profundos; i++) huellas[`profundo:${dia(-Math.floor(i / 2))}|jhn.${(i % 21) + 1}.${(i % 7) + 1}`] = dia(-Math.floor(i / 2));
  for (let i = 0; i < escritos; i++) huellas[`escrito:m${i}`] = dia(-i * 6);
  for (let i = 0; i < guiados; i++) huellas[`guiar:evento:E${i}`] = dia(-i * 4);
  // Los sellos de servicio que ya alcanzó, ganados y vistos (si no, saldrían «10 de 10» sin ganar)
  const metas = { 'profundo-10': [profundos, 10], 'profundo-100': [profundos, 100], 'escrito-1': [escritos, 1], 'escrito-12': [escritos, 12], 'guiar-1': [guiados, 1], 'guiar-25': [guiados, 25] };
  const ganados = {};
  for (const [id, [n, meta]] of Object.entries(metas)) if (n >= meta) ganados[id] = { fecha: HOY, visto: true };
  return { huellas, ganados, iniciado: true };
}

async function post(body, llave) {
  const r = await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: JSON.stringify({ hoy: HOY, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });

async function page({ servicio, desktop = false, theme = 'claro', cuenta, quieto = false, visto = 5 } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO', timezoneId: ZONA, reducedMotion: quieto ? 'reduce' : 'no-preference' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.clock.install({ time: AHORA });
  await p.clock.resume();
  await p.addInitScript(
    ([s, cu, v]) => {
      localStorage.setItem('sellos', JSON.stringify(s));
      localStorage.setItem('servicio-visto', String(v));
      if (cu) localStorage.setItem('cuenta', cu);
    },
    [sellos(servicio ?? { profundos: 0, escritos: 0, guiados: 0 }), cuenta ? JSON.stringify(cuenta) : null, visto],
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const NIVELES = [
  [1, { profundos: 8, escritos: 1, guiados: 2 }],
  [2, { profundos: 34, escritos: 6, guiados: 12 }],
  [3, { profundos: 90, escritos: 14, guiados: 30 }],
  [4, { profundos: 210, escritos: 40, guiados: 75 }],
  [5, { profundos: 640, escritos: 160, guiados: 260 }],
];

// 1. La tarjeta en Mi diario y las insignias
for (const [pre, opts] of [
  ['m', {}],
  ['o', { theme: 'oscuro' }],
]) {
  const p = await page({ servicio: NIVELES[1][1], ...opts });
  await p.goto(`${BASE}/diario`);
  await p.getByTestId('servicio').waitFor();
  await wait(2500);
  await p.getByTestId('servicio').scrollIntoViewIfNeeded();
  await p.mouse.move(200, 500);
  await p.mouse.wheel(0, 120);
  await wait(900);
  await shot(p, `${pre}-1-tarjeta`);
  await p.mouse.wheel(0, 420);
  await wait(900);
  await shot(p, `${pre}-2-insignias`);
  await p.context().close();
}

// 2. El cielo de cada nivel, ya quieto
for (const [n, servicio] of NIVELES) {
  const p = await page({ servicio, quieto: true });
  await p.goto(`${BASE}/diario`);
  await p.getByTestId('servicio-estrella').waitFor();
  await wait(2500);
  await p.getByTestId('servicio-estrella').click();
  await wait(1500);
  await shot(p, `cielo-${n}`);
  await p.context().close();
}
{
  // El último en movimiento y en el computador
  const p = await page({ servicio: NIVELES[4][1], desktop: true });
  await p.goto(`${BASE}/diario`);
  await p.getByTestId('servicio-estrella').waitFor();
  await wait(2500);
  await p.getByTestId('servicio-estrella').click();
  await wait(5000);
  await shot(p, 'cielo-5-computador');
  await p.context().close();
}
{
  // Sale solo al subir de nivel
  const p = await page({ servicio: NIVELES[2][1], visto: 2, quieto: true });
  await p.goto(`${BASE}/`);
  await wait(6000);
  await shot(p, 'cielo-3-al-subir');
  await p.context().close();
}

// 3. La corona de estrellas en la comunidad
const gente = [
  ['Ana Martínez', 40, 52, 'Hoy preparé el estudio de la célula sobre Juan 15.'],
  ['Beto Ramírez', 100, 330, '¿Alguien más está leyendo Éxodo? La zarza que ardía y no se consumía me tiene pensando.'],
  ['Carla Gómez', 365, 1200, 'Veinte años enseñando a los niños de la iglesia. Él es fiel.'],
  ['Daniel Ruiz', 7, 14, 'Primera vez que guío la lectura en vivo de mi grupo.'],
  ['Eva Suárez', 0, 45, 'Terminé mi primer mensaje en el Taller.'],
  ['Felipe Díaz', 0, 0, '¿Por dónde me recomiendan empezar a leer la Biblia?'],
  ['Gloria Pérez', 2600, 140, 'Siete años leyendo cada mañana con mi esposo.'],
];
const cuentas = [];
for (const [nombre, racha, servicio] of gente) {
  const c = await post({ accion: 'registrarse', nombre });
  if (racha) await post({ accion: 'racha', dias: racha, vence: HOY }, c.llave);
  if (servicio) await post({ accion: 'servicio', total: servicio }, c.llave);
  cuentas.push(c);
}
const [ana, ...amigos] = cuentas;
for (const c of amigos) {
  await post({ accion: 'pedirAmistad', usuario: c.usuario.id }, ana.llave);
  await post({ accion: 'responderAmistad', usuario: ana.usuario.id, aceptar: true }, c.llave);
}
for (let i = gente.length - 1; i >= 0; i--) await post({ accion: 'publicar', tipo: 'reflexion', audiencia: 'amigos', texto: gente[i][3] }, cuentas[i].llave);

for (const [pre, opts] of [
  ['c', {}],
  ['co', { theme: 'oscuro' }],
]) {
  const p = await page({ servicio: NIVELES[1][1], cuenta: ana, ...opts });
  await p.goto(`${BASE}/comunidades`);
  await p.getByText('Veinte años enseñando').waitFor();
  await wait(1500);
  await shot(p, `${pre}-1-muro`);
  await p.goto(`${BASE}/comunidades/amigos`);
  await p.getByText('Carla Gómez').first().waitFor();
  await wait(900);
  await p.getByText('Tus amigos').first().scrollIntoViewIfNeeded();
  await wait(600);
  await shot(p, `${pre}-2-amigos`);
  await p.goto(`${BASE}/comunidades/persona/${cuentas[2].usuario.id}`);
  await wait(2000);
  await shot(p, `${pre}-3-persona`);
  await p.context().close();
}
{
  const p = await page({ servicio: NIVELES[1][1] });
  await p.goto(`${BASE}/sellos`);
  await wait(2500);
  await p.getByText('Servicio').first().scrollIntoViewIfNeeded();
  await wait(800);
  await shot(p, 'm-3-mis-sellos');
  await p.context().close();
}

await browser.close();
