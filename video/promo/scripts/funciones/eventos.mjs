// Pantallas del video de función «Eventos de la iglesia» (no es una prueba).  node video/promo/scripts/funciones/eventos.mjs
// Ana predica: publica su sermón del Taller como evento; la congregación lo sigue en su teléfono con un código.
import { chromium, devices } from '@playwright/test';
import { abrir, guardarToques } from './comun.mjs';

const BASE = process.env.BASE ?? 'http://localhost:8081';
const ROOT = new URL('../../', import.meta.url).pathname;
const OUT = `${ROOT}public/capturas/funciones/eventos`;
const now = new Date().toISOString();
const s = (n, t, texto) => ({ id: `ev-${n}`, titulo: t, ayuda: '', texto, minutos: 7 });
const sermon = {
  id: 'evzarza', tipo: 'sermon', titulo: 'El hijo que vuelve', pasaje: { book: 'luk', chapter: 15, from: 11, to: 24 },
  plantilla: 'expositiva', observacion: '', tema: 'El amor del Padre', complemento: 'corre hacia quien vuelve', necesidad: '', gracia: '',
  secciones: [
    s(1, 'Nos alejamos', 'Leer Lucas 15:13. Contar la historia del viaje.'),
    s(2, 'Volvemos en sí', 'Romanos 2:4: la bondad lleva al arrepentimiento.'),
    s(3, 'El Padre corre', 'Lucas 15:20 y Romanos 5:8.'),
  ],
  revision: [], seguimiento: '', minutos: 30, creado: now, actualizado: now,
};

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('eventos', { guardar: { taller: [sermon] } });
await p.goto('/taller/evzarza');
await wait(3500);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
const tab = p.getByRole('tab', { name: '6 Presentar' });
await tab.click();
await wait(1200);
const preparar = p.getByRole('button', { name: 'Preparar el evento en vivo' });
await preparar.scrollIntoViewIfNeeded();
await shot('1-presentar', await toque(preparar), 800);
await preparar.click();
await p.getByLabel('Para la congregación, punto 1').fill('Todos, alguna vez, nos alejamos de casa.');
await p.getByLabel('Para la congregación, punto 2').fill('La bondad de Dios nos hace volver.').catch(() => {});
await p.getByLabel('Para la congregación, punto 3').fill('Antes de que llegues, Él ya corre hacia ti.').catch(() => {});
const publicar = p.getByRole('button', { name: 'Publicar como evento' });
await publicar.scrollIntoViewIfNeeded();
await shot('2-preparar', await toque(publicar), 800);
await publicar.click();
const codigo = (await p.getByLabel(/^Código [A-Z0-9]{6}$/).getAttribute('aria-label')).slice(-6);
await wait(1500);
await p.getByText('Nuevo sello').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
await p.getByRole('button', { name: 'Actualizar' }).click({ timeout: 2000 }).catch(() => {});
await wait(1500);
await p.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); while (w.nextNode()) w.currentNode.nodeValue = w.currentNode.nodeValue.replace('localhost:8081', 'zarzabiblia.com'); });
await p.getByLabel(/^Código [A-Z0-9]{6}$/).scrollIntoViewIfNeeded();
await shot('3-codigo', null, 1500);

// El teléfono de alguien de la congregación, sin cuenta.
const b2 = await chromium.launch({ executablePath: process.env.CHROMIUM });
const c2 = await b2.newContext({ ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, baseURL: BASE, colorScheme: 'dark', locale: 'es-CO', timezoneId: 'America/Bogota' });
const t = await c2.newPage();
await t.addInitScript(() => localStorage.setItem('ultima-lectura', JSON.stringify({ book: 'luk', chapter: 15 })));
const toques = {};
const tshot = async (name, loc = null, ms = 900) => {
  let tap = null;
  if (loc) { const bx = await loc.boundingBox(); tap = bx && { x: Math.round((bx.x + bx.width / 2) * 2.625), y: Math.round((bx.y + bx.height / 2) * 2.625) }; }
  await wait(ms);
  await t.screenshot({ path: `${OUT}/${name}.png` });
  toques[name] = tap;
  console.log(name, tap ?? '');
};
await t.goto('/eventos');
await wait(3000);
await t.getByLabel('Código del evento').fill(codigo);
const seguir = t.getByRole('button', { name: 'Seguir el evento' });
await tshot('4-entrar', seguir);
await seguir.click();
await t.waitForURL(new RegExp(`/evento/${codigo}$`));
await tshot('5-pronto', null, 2500);

await p.getByRole('button', { name: 'Abrir el evento' }).click();
await p.getByRole('button', { name: 'Empezar en vivo' }).click();
await p.getByRole('button', { name: 'Mostrar el punto 1' }).click();
await shot('6-predica', null, 1500);
await t.reload();
await t.getByText('Nos alejamos', { exact: true }).waitFor({ timeout: 15000 });
const leer = t.getByRole('button', { name: 'Lucas 15:13, leer' });
await tshot('7-vivo', leer, 1500);
await leer.click();
await tshot('8-versiculo', null, 1500);
const nota = t.getByRole('button', { name: 'Escribir una nota' }).first();
await nota.scrollIntoViewIfNeeded();
await nota.click();
await t.getByLabel('Mi nota de este punto').pressSequentially('Siempre puedo volver a casa.', { delay: 30 });
await tshot('9-nota', null, 800);

await p.getByRole('button', { name: 'Siguiente: punto 2' }).click();
await t.getByText('Volvemos en sí', { exact: true }).waitFor({ timeout: 15000 });
await tshot('10-punto2', null, 1200);

await p.getByRole('button', { name: /Siguiente: punto 3/ }).click().catch(() => {});
await wait(1500);
await p.getByRole('button', { name: 'Terminar el evento' }).click();
await t.getByText('El mensaje terminó').waitFor({ timeout: 25000 });
await t.evaluate(() => window.scrollTo(0, 0));
await t.getByText('El mensaje terminó').first().evaluate((e) => e.scrollIntoView({ block: 'start' }));
await tshot('11-termino', null, 1500);
const comparte = t.getByText('Comparte lo que oíste hoy');
await comparte.scrollIntoViewIfNeeded();
await tshot('12-comparte', null, 1200);

await b2.close();
await cerrar();
guardarToques('eventos');
const { readFileSync, writeFileSync } = await import('node:fs');
const f = `${ROOT}src/funciones/eventos.taps.json`;
writeFileSync(f, JSON.stringify({ ...JSON.parse(readFileSync(f, 'utf8')), ...toques }, null, 1) + '\n');
