// Capturas de las citas corregidas antes de enseñarlas (no es una prueba): node e2e/capturas-corregir.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). La IA simulada escribe el Salmo 23 como si
// fuera Juan 3:17 y un Juan 3:99 que no existe (e2e/support/mock-anthropic.ts); el servidor los corrige.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function caso(nombre, { desktop = false, theme } = {}) {
  const cuenta = await (
    await fetch(`${BASE}/api/comunidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `capturas-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
    })
  ).json();
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, ...scheme }
      : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript((cu) => {
    localStorage.setItem('cuenta', cu);
    localStorage.setItem('permiso-ia', 'si');
  }, JSON.stringify(cuenta));
  await p.goto(`${BASE}/juan/3/16`);
  await p.getByRole('button', { name: 'Estudiar', exact: true }).click();
  const estudio = p.getByRole('dialog').filter({ hasText: 'ESTUDIO' });
  await estudio.getByPlaceholder('Pregunta sobre Juan 3:16').fill('¿Qué citas lo apoyan?');
  await estudio.getByLabel('Enviar pregunta').click();
  await estudio.getByText('(Salmos 23:1)', { exact: false }).waitFor();
  const fuentes = estudio.getByTestId('fuentes').last();
  await fuentes.waitFor();
  await wait(4500);
  await fuentes.scrollIntoViewIfNeeded();
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, 160);
  await wait(800);
  await p.screenshot({ path: `${OUT}/${nombre}.png` });
  await ctx.close();
}

await caso('corregida-m-claro');
await caso('corregida-m-oscuro', { theme: 'oscuro' });
await caso('corregida-d-claro', { desktop: true });
await browser.close();
