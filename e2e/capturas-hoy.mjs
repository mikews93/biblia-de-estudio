// Capturas de Hoy con el saludo por nombre (no es una prueba): node e2e/capturas-hoy.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const post = async (accion, body, llave) =>
  (
    await fetch(`${BASE}/api/comunidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
      body: JSON.stringify({ accion, ...body }),
    })
  ).json();

const cuenta = await post('registrarse', { nombre: 'Miguel Blanco', correo: `capturas-${Date.now()}@prueba.test`, clave: 'clave-segura-1' });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });

async function page({ desktop = false, theme, conCuenta = true } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO', timezoneId: 'America/Bogota' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-10-25T00:30:00Z') });
  await p.clock.resume();
  await p.addInitScript(
    ({ cu }) => {
      if (cu) localStorage.setItem('cuenta', cu);
      localStorage.setItem('ultima-lectura', JSON.stringify({ book: 'jhn', chapter: 4 }));
    },
    { cu: conCuenta ? JSON.stringify(cuenta) : null },
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name, full = false) => {
  await wait(5000);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
};
const accesos = async (p) => {
  await p.getByRole('button', { name: 'Libros', exact: true }).scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, 300));
};

for (const [pre, theme] of [['m', 'claro'], ['o', 'oscuro']]) {
  const p = await page({ theme });
  await p.goto(`${BASE}/`);
  await shot(p, `${pre}-1-hoy`);
  await accesos(p);
  await shot(p, `${pre}-2-accesos`);
  await p.goto(`${BASE}/cuenta`);
  await p.getByText('Cómo te saludamos').scrollIntoViewIfNeeded();
  await p.getByText('Cómo te saludamos').locator('..').locator('input').fill('Migue');
  await p.evaluate(() => window.scrollBy(0, 120));
  await shot(p, `${pre}-3-perfil-apodo`);
  await p.close();
}
{
  const p = await page({ theme: 'claro', conCuenta: false });
  await p.goto(`${BASE}/`);
  await shot(p, 'm-4-hoy-sin-cuenta');
}
{
  const p = await page({ desktop: true, theme: 'claro' });
  await p.goto(`${BASE}/`);
  await shot(p, 'd-1-hoy');
  await accesos(p);
  await shot(p, 'd-2-accesos');
}
await browser.close();
