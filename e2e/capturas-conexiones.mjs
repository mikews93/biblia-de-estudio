// Capturas de /conexiones (no es una prueba): node e2e/capturas-conexiones.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'capturas/conexiones';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [pref, opts] of [['m', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }], ['o', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' }], ['d', { viewport: { width: 1280, height: 900 } }]]) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  const v = (l) => l.filter({ visible: true }).first();
  await p.goto('http://localhost:8081/conexiones');
  await v(p.getByText('Los capítulos más conectados')).waitFor();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${pref}-1-toda-la-biblia.png` });
  await p.goto('http://localhost:8081/conexiones?libro=isaias');
  await v(p.getByText('CON QUIÉN CONVERSA MÁS')).waitFor();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${pref}-2-isaias.png` });
  await p.goto('http://localhost:8081/conexiones?libro=isaias&cap=53');
  await v(p.getByText('LAS MÁS FUERTES')).waitFor();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${pref}-3-isaias-53.png` });
  await v(p.getByText('LAS MÁS FUERTES')).evaluate((e) => e.scrollIntoView({ block: 'start' }));
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${pref}-4-isaias-53-refs.png` });
  await ctx.close();
}
await b.close();
