// Capturas del rediseño de Hoy (no es una prueba): node e2e/capturas-hoy-rediseno.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). De noche, de mañana, en claro, oscuro y escritorio.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const post = async (accion, body) =>
  (
    await fetch(`${BASE}/api/comunidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, ...body }),
    })
  ).json();

const cuenta = await post('registrarse', { nombre: 'Miguel Blanco', correo: `hoy-${Date.now()}@prueba.test`, clave: 'clave-segura-1' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });

// Miércoles 4 de noviembre de 2026, hora de Bogotá
const HORAS = { noche: '2026-11-05T03:30:00Z', manana: '2026-11-04T12:30:00Z' };

async function page({ desktop = false, oscuro, hora, uso = null }) {
  const scheme = { colorScheme: oscuro ? 'dark' : 'light', locale: 'es-CO', timezoneId: 'America/Bogota' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date(HORAS[hora]) });
  await p.clock.resume();
  await p.addInitScript(
    ({ cu, uso }) => {
      localStorage.setItem('cuenta', cu);
      if (uso) localStorage.setItem('uso-funciones', uso);
      localStorage.setItem('ultima-lectura', JSON.stringify({ book: '1ki', chapter: 21 }));
      localStorage.setItem('progreso', JSON.stringify({ chapters: { '1ki': [18, 19, 20], jhn: [1, 2, 3] }, days: ['2026-11-02', '2026-11-04'] }));
    },
    { cu: JSON.stringify(cuenta), uso: uso && JSON.stringify(uso) },
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Alguien que usa mucho el pódcast, comparar versiones y el despertador: los accesos se ordenan por su uso.
const t = Date.parse(HORAS.noche);
const USO = { podcast: { p: 6, t }, comparar: { p: 4, t }, despertador: { p: 3, t }, historia: { p: 2, t } };

for (const [pre, oscuro, hora, uso] of [
  ['o-uso', true, 'noche', USO],
  ['o', true, 'noche'],
  ['m', false, 'noche'],
  ['o-manana', true, 'manana'],
  ['m-manana', false, 'manana'],
]) {
  const p = await page({ oscuro, hora, uso });
  await p.goto(`${BASE}/`);
  await wait(5000);
  await p.screenshot({ path: `${OUT}/${pre}-1-arriba.png` });
  await p.screenshot({ path: `${OUT}/${pre}-completa.png`, fullPage: true });
  await p.getByText('Tu semana').scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, 200));
  await wait(800);
  await p.screenshot({ path: `${OUT}/${pre}-2-abajo.png` });
  await p.getByRole('button', { name: 'Todo en Zarza' }).scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, 200));
  await wait(800);
  await p.screenshot({ path: `${OUT}/${pre}-3-accesos.png` });
  await p.close();
}
for (const [pre, oscuro] of [['d-o', true], ['d-m', false]]) {
  const p = await page({ desktop: true, oscuro, hora: 'noche' });
  await p.goto(`${BASE}/`);
  await wait(5000);
  await p.screenshot({ path: `${OUT}/${pre}-1-arriba.png` });
  await p.close();
}
await browser.close();
