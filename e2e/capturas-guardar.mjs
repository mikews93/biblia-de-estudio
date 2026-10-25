// Capturas de «guardar lo del Taller al cerrar la app» y de las correcciones de Revisa (no es una prueba):
// node e2e/capturas-guardar.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `capturas-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
  })
).json();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript((cu) => {
    localStorage.setItem('cuenta', cu);
    localStorage.setItem('permiso-ia', 'si');
  }, JSON.stringify(cuenta));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(800);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const bajar = async (p, px) => {
  await p.mouse.move(200, 500);
  await p.mouse.wheel(0, px);
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  const ia = p.getByRole('dialog').filter({ hasText: 'ACOMPAÑANTE' });
  await p.goto(`${BASE}/taller`);
  await p.getByRole('button', { name: /Encuentro de grupo ·/ }).waitFor();
  await wait(4500);
  await p.getByRole('button', { name: /Encuentro de grupo ·/ }).click();
  const pasaje = p.getByLabel('Pasaje: escribe una cita, unas palabras o una idea');
  await pasaje.fill('Nehemías 4:7-23');
  await pasaje.press('Enter');
  await p.getByPlaceholder('Cómo lo llamarás').fill('Con la espada en una mano');
  await p.getByPlaceholder(/Lo que ves en el texto/).fill('Nehemías ora y también pone guarda: no deja de construir asta terminar el muro.');
  await p.getByRole('tab', { name: '2 Idea central' }).click();
  await p.getByPlaceholder('Por ejemplo, el amor del Padre').fill('La obra de Dios en medio de la oposición');
  await p.getByPlaceholder('Lo que compartimos con los primeros lectores').fill('Nos desanimamos cuando hay burla y oposicion, y tambien cuando el cansancio pesa.');
  await p.getByRole('tab', { name: '4 Revisar' }).click();
  await p.getByRole('button', { name: 'Revisa mi borrador' }).first().click();
  await ia.getByText('Revisión simulada').waitFor();
  await ia.getByRole('button', { name: 'Proponer correcciones' }).waitFor();
  await bajar(p, 400);
  await shot(p, `${prefix}-1-revisa`);
  await ia.getByRole('button', { name: 'Proponer correcciones' }).click();
  await ia.getByText('CORRECCIONES A TU TEXTO').waitFor();
  await ia.getByRole('button', { name: /Aplicar/ }).waitFor();
  await bajar(p, 1200);
  await shot(p, `${prefix}-2-correcciones`);
  await ia.getByRole('radio', { name: 'Descartar' }).last().click();
  await ia.getByRole('button', { name: /Aplicar/ }).click();
  await ia.getByText(/Se aplic/).waitFor();
  await bajar(p, 1200);
  await shot(p, `${prefix}-3-aplicadas`);
  // Se cierra la app y se vuelve a abrir: sigue el Acompañante con todo
  await wait(800);
  await p.reload();
  await ia.getByText('CORRECCIONES A TU TEXTO').waitFor();
  await shot(p, `${prefix}-4-al-volver`);
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
