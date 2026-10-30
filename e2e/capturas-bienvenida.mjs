// Capturas de la bienvenida, «Todo en Zarza», Hoy y la pestaña «Fallos» de Cuidar Zarza (no es una prueba):
// node e2e/capturas-bienvenida.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

async function api(accion, body = {}, llave) {
  const res = await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: JSON.stringify({ accion, ...body }),
  });
  if (!res.ok) throw new Error(`${accion}: ${await res.text()}`);
  return res.json();
}

const correo = 'cuidar-e2e@prueba.test';
const cuida = await api('entrar', { correo, clave: 'clave-segura-1' }).catch(() => api('registrarse', { nombre: 'Mike', correo, clave: 'clave-segura-1' }));
const fallos = [
  { plataforma: 'android', origen: 'pantalla', mensaje: "TypeError: Cannot read property 'versiculos' of undefined", pila: "TypeError: Cannot read property 'versiculos' of undefined\n    at Comparar (index.android.bundle:1:48211)\n    at renderWithHooks (index.android.bundle:1:91822)", ruta: '/comparar/jhn/3', version: '1.0.0 (3) · a2149a2', fatal: true },
  { plataforma: 'web', origen: 'promesa', mensaje: 'NotAllowedError: play() failed because the user didn\'t interact with the document first.', pila: 'NotAllowedError: play() failed\n    at Ambiente.tocar (https://zarzabiblia.com/_expo/static/js/web/entry.js:2:1931)', ruta: '/taller/…/presentar', version: '1.0.0 · a2149a2' },
  { plataforma: 'ios', origen: 'global', mensaje: 'Network request failed', pila: 'TypeError: Network request failed\n    at fetch (main.jsbundle:1:220)', ruta: '/', version: '1.0.0 (1) · a2149a2' },
];
for (const f of fallos) for (let i = 0; i < (f.fatal ? 4 : 2); i++) await api('errorApp', f);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme, quien } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme });
  const p = await ctx.newPage();
  if (quien) await p.addInitScript((c) => localStorage.setItem('cuenta', c), JSON.stringify(quien));
  return p;
}
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
const shot = async (p, name, full = false) => {
  await wait(2500);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/?bienvenida=1`);
  await p.getByRole('radio', { name: /Reina-Valera 1909/ }).click();
  await shot(p, `${prefix}-1-version`);
  await p.getByRole('button', { name: 'Seguir' }).click();
  await p.getByRole('radio', { name: /Estudiar a fondo/ }).click();
  await shot(p, `${prefix}-2-meta`);
  await p.getByRole('button', { name: 'Seguir' }).click();
  await p.getByRole('button', { name: 'Letra más grande' }).click();
  await shot(p, `${prefix}-3-letra`);
  await p.getByRole('button', { name: 'Saltar la bienvenida' }).click();
  await p.mouse.wheel(0, 1800);
  await shot(p, `${prefix}-4-hoy-accesos`);
  await p.goto(`${BASE}/todo`);
  await shot(p, `${prefix}-5-todo`);
  await p.getByLabel('Buscar una función').fill('mapa');
  await shot(p, `${prefix}-6-todo-buscar`);
  const c = await page({ ...opts, quien: cuida });
  await c.goto(`${BASE}/cuidar?tab=fallos`);
  await shot(c, `${prefix}-7-fallos`);
  await c.getByRole('button', { name: /CERRÓ LA APP/i }).first().click();
  await shot(c, `${prefix}-8-fallo-abierto`);
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
