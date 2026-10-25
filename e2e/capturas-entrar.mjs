// Capturas de «Entrar con Google, Apple y Facebook» (no es una prueba): node e2e/capturas-entrar.mjs <carpeta>, con el
// servidor de pruebas corriendo con claves de mentira para Google y Apple (AUTH_GOOGLE_ID, AUTH_APPLE_*), para que
// salgan los tres botones. Facebook es el simulado de e2e/support/mock-facebook.ts.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme, cuenta } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme });
  const p = await ctx.newPage();
  if (cuenta) await p.addInitScript((cu) => localStorage.setItem('cuenta', cu), JSON.stringify(cuenta));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name, full = false) => {
  await wait(900);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
};

for (const [prefix, opts] of [['m', {}], ['o', { theme: 'oscuro' }], ['d', { desktop: true }]]) {
  const p = await page(opts);
  await p.goto(`${BASE}/entrar`);
  await p.getByRole('button', { name: 'Continuar con Google' }).waitFor();
  await shot(p, `${prefix}-1-entrar`);
  await p.goto(`${BASE}/registro`);
  await p.getByRole('button', { name: 'Continuar con Google' }).waitFor();
  await shot(p, `${prefix}-2-registro`);

  // El perfil con Facebook conectado.
  const cuenta = await (
    await fetch(`${BASE}/api/comunidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `capturas-${prefix}-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
    })
  ).json();
  const q = await page({ ...opts, cuenta });
  await q.goto(`${BASE}/cuenta`);
  const conectar = q.getByRole('button', { name: 'Conectar', exact: true });
  await conectar.first().waitFor();
  const popup = q.waitForEvent('popup');
  await conectar.last().click();
  const fb = await popup;
  // Cada pasada usa otra cuenta de Facebook simulada (su id sale del nombre); el espacio final se recorta al guardarlo.
  await fb.getByLabel('Tu nombre en Facebook').fill(`Miguel Blanco${prefix === 'm' ? '' : prefix === 'o' ? ' ' : '  '}`);
  await fb.getByRole('button', { name: 'Continuar como en Facebook' }).click();
  await q.getByText('Conectado como Miguel Blanco').waitFor();
  await wait(2600);
  await q.getByText('Entrar con un toque').scrollIntoViewIfNeeded();
  await q.evaluate(() => window.scrollBy(0, -80));
  await shot(q, `${prefix}-3-perfil`);
}

// La página que se ve al volver del proveedor (abierta en la misma pestaña, para que no se cierre sola).
for (const [name, theme] of [['m-4-vuelta', 'claro'], ['o-4-vuelta', 'oscuro']]) {
  const { url } = await (
    await fetch(`${BASE}/api/comunidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'proveedorInicio', proveedor: 'facebook', modo: 'entrar' }),
    })
  ).json();
  const p = await page({ theme });
  await p.goto(url);
  await p.getByLabel('Tu nombre en Facebook').fill(`Lidia ${Date.now().toString(36)}`);
  await p.getByRole('button', { name: 'Continuar como en Facebook' }).click();
  await p.getByText('Bienvenido a Zarza').waitFor();
  await shot(p, name);
}
await browser.close();
