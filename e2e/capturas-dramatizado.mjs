// Capturas del dramatizado a pedido (no es una prueba): node e2e/capturas-dramatizado.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). El servidor de dramatizado se simula con
// page.route en cada estado: sin dramatizar, preparando (guion, voces a medias, mezcla) y listo.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });

const ESTADOS = {
  ninguno: { estado: 'ninguno' },
  guion: { estado: 'grabando', fase: 'guion', hechas: 0, total: 0 },
  voces: { estado: 'grabando', fase: 'voces', hechas: 19, total: 31 },
  mezcla: { estado: 'grabando', fase: 'mezcla', hechas: 31, total: 31 },
};

async function abrir({ desktop = false, theme, estado }) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO', deviceScaleFactor: 2 };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.route('**/audio/index.json', (r) => r.fulfill({ json: { dramatizado: [], podcast: [] } }));
  await p.route('**/api/dramatizado**', (r) => r.fulfill({ json: ESTADOS[estado] }));
  await p.goto(`${BASE}/marcos/2`);
  await p.getByRole('button', { name: /^Escuchar el capítulo: elegir/ }).filter({ visible: true }).click();
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: /^Dramatizado: narrador/ }).filter({ visible: true }).click();
  await p.waitForTimeout(1500);
  return p;
}

for (const [prefijo, opts] of [['m', {}], ['o', { theme: 'oscuro' }], ['d', { desktop: true }]]) {
  for (const [i, estado] of ['ninguno', 'guion', 'voces', 'mezcla'].entries()) {
    if (prefijo !== 'm' && (estado === 'guion' || estado === 'mezcla')) continue;
    const p = await abrir({ ...opts, estado });
    await p.screenshot({ path: `${OUT}/${prefijo}-${i + 1}-${estado}.png` });
    await p.context().close();
  }
}
await browser.close();
