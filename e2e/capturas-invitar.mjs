// Capturas de «Invitar amigos» y de la invitación que abre quien recibe el enlace (no es una prueba):
// node e2e/capturas-invitar.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const hoy = new Date().toISOString().slice(0, 10);
const r = Math.random().toString(36).slice(2, 6);

async function api(accion, body = {}, llave) {
  const res = await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: JSON.stringify({ accion, hoy, ...body }),
  });
  if (!res.ok) throw new Error(`${accion}: ${await res.text()}`);
  return res.json();
}
const cuenta = (nombre) => api('registrarse', { nombre, correo: `${nombre.replace(/\W/g, '').toLowerCase()}${r}@prueba.dev`, clave: 'clave-segura-1' });

const mike = await cuenta('Mike Blanco');
const { codigo } = await api('amigos', {}, mike.llave);
for (const n of ['Laura Gómez', 'Pablo Ruiz', 'Sara Méndez']) await api('aceptarInvitacion', { codigo }, (await cuenta(n)).llave);
const nuevo = await cuenta('Daniel Ortiz');

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
  await wait(3500);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
};

async function recorrido(prefix, opts) {
  let p = await page({ ...opts, quien: mike });
  await p.goto(`${BASE}/invitar`);
  await shot(p, `${prefix}-1-invitar`);
  await p.getByRole('radio', { name: 'Con un versículo' }).click();
  await p.getByRole('button', { name: /En persona/ }).click();
  await p.mouse.wheel(0, 600);
  await shot(p, `${prefix}-2-mensaje-qr`);
  await p.mouse.wheel(0, 1200);
  await shot(p, `${prefix}-3-se-unieron`);
  await p.goto(`${BASE}/comunidades`);
  await shot(p, `${prefix}-4-comunidad`);

  p = await page(opts);
  await p.goto(`${BASE}/i/${codigo}`);
  await shot(p, `${prefix}-5-invitacion`);
  await shot(p, `${prefix}-6-invitacion-completa`, true);

  p = await page({ ...opts, quien: nuevo });
  await p.goto(`${BASE}/i/${codigo}`);
  await p.getByRole('button', { name: /Unirme como amigo/ }).click();
  await p.getByText('YA SON AMIGOS').waitFor();
  await shot(p, `${prefix}-7-ya-son-amigos`);
  await api('quitarAmigo', { usuario: mike.usuario.id }, nuevo.llave);
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
