// Capturas del tiempo transcurrido y restante en el reproductor (no es una prueba): node e2e/capturas-progreso-audio.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). Marcos 1 dramatizado y el pódcast de Juan 3.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--no-proxy-server'] });

async function abrir({ desktop = false, theme }) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO', deviceScaleFactor: 2, serviceWorkers: 'block' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.route('**/audio/index.json', (r) => r.fulfill({ json: { dramatizado: ['mrk-1'], podcast: [] } }));
  await p.goto(`${BASE}/marcos/1`);
  await p.getByRole('button', { name: /^Escuchar el capítulo: elegir/ }).filter({ visible: true }).click();
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Escuchar el capítulo dramatizado, con voces, efectos y música' }).filter({ visible: true }).click();
  await p.waitForTimeout(2500);
  // Un poco más adelante, para que se vea lo que va y lo que falta
  await p.evaluate(() => document.querySelectorAll('audio').forEach((a) => (a.currentTime = 312)));
  await p.waitForTimeout(1500);
  return p;
}

for (const [prefijo, opts] of [['m', {}], ['o', { theme: 'oscuro' }], ['d', { desktop: true }]]) {
  const p = await abrir(opts);
  await p.screenshot({ path: `${OUT}/${prefijo}-dramatizado.png` });
  await p.context().close();
}
await browser.close();
