// Capturas de «Para ti» en Hoy (no es una prueba): node e2e/capturas-para-ti.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). Las oraciones se siembran en el navegador.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const DIA = 86_400_000;

const ORACIONES = [
  { id: 'a1', titulo: 'Ansiedad por el trabajo nuevo', detalle: 'No puedo dormir pensando en todo lo que falta.', created: Date.now() - 2 * DIA, versiculos: [] },
  { id: 'a2', titulo: 'Por la salud de mi mamá', created: Date.now() - 6 * DIA, versiculos: [] },
];
const RIESGO = [{ id: 'r1', titulo: 'Ya no quiero vivir así', detalle: '', created: Date.now() - DIA, versiculos: [] }];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme, oraciones = ORACIONES } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript((o) => {
    localStorage.setItem('oraciones', o);
    localStorage.setItem('progreso', JSON.stringify({ chapters: { jhn: [1, 2, 3] }, days: [] }));
  }, JSON.stringify(oraciones));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(800);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const hasta = async (p, id) => {
  await p.getByTestId(id).waitFor();
  await p.getByTestId(id).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.evaluate(() => document.querySelectorAll('*').forEach((el) => el.scrollTop > 0 && (el.scrollTop -= 16)));
};

async function hoy(prefix, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/`);
  await wait(3500);
  await hasta(p, 'para-ti');
  await shot(p, `${prefix}-1-para-ti`);
  await p.getByRole('button', { name: '¿Por qué veo esto?' }).click();
  await shot(p, `${prefix}-2-por-que`);
  return p;
}

const m = await hoy('m', {});
await m.getByRole('button', { name: 'Elegir mis temas' }).click();
await m.getByText('¿Por qué estás orando estos días?').waitFor();
await m.getByRole('checkbox', { name: /Soledad/ }).click();
await shot(m, 'm-3-mis-temas');
await m.goto(`${BASE}/planes/paz-ansiedad`);
await m.getByText('Un capítulo al día').waitFor();
await shot(m, 'm-4-plan-tema');
await m.goto(`${BASE}/planes`);
await m.getByText('Para un momento difícil').waitFor();
await m.getByText('Para un momento difícil').evaluate((el) => el.scrollIntoView({ block: 'start' }));
await shot(m, 'm-5-planes');

const r = await page({ oraciones: RIESGO });
await r.goto(`${BASE}/`);
await wait(3500);
await hasta(r, 'no-estas-solo');
await shot(r, 'm-6-no-estas-solo');

await hoy('o', { theme: 'oscuro' });
const ro = await page({ theme: 'oscuro', oraciones: RIESGO });
await ro.goto(`${BASE}/`);
await wait(3500);
await hasta(ro, 'no-estas-solo');
await shot(ro, 'o-6-no-estas-solo');

await hoy('d', { desktop: true });

// «¿Cómo sigues?»: una carga escrita hace cinco días
async function comoSigues(prefix, opts) {
  const p = await page({ ...opts, oraciones: [{ id: 'c1', titulo: 'Tristeza desde que perdí el trabajo', created: Date.now() - 5 * DIA, versiculos: [] }] });
  await p.goto(`${BASE}/`);
  await wait(3500);
  await hasta(p, 'como-sigues');
  await shot(p, `${prefix}-7-como-sigues`);
  await p.getByRole('button', { name: 'Igual' }).click();
  await shot(p, `${prefix}-8-igual`);
  await p.getByRole('button', { name: 'Todavía no' }).click();
  await hasta(p, 'como-sigues');
  await shot(p, `${prefix}-9-hablar`);
}
await comoSigues('m', {});
await comoSigues('o', { theme: 'oscuro' });

await browser.close();
