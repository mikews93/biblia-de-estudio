// Capturas de «Hombres de pie» (no es una prueba): node e2e/capturas-hombres.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'capturas/hombres';
const diario = { respuestas: { 1: ['En hablar de mi fe en el trabajo.'] }, hechas: { 1: '2026-10-11', 2: '2026-10-18', 3: '2026-10-24', 4: '2026-10-25' }, retos: { 1: true, 2: true, 4: true } };
const b = await chromium.launch();
for (const [pref, opts] of [['m', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }], ['o', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' }], ['d', { viewport: { width: 1280, height: 900 } }]]) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript((d) => localStorage.setItem('hombres-de-pie', d), JSON.stringify(diario));
  const p = await ctx.newPage();
  await p.goto('http://localhost:8081/hombres');
  await p.getByText('4 DE 8 SEMANAS').filter({ visible: true }).waitFor();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${pref}-1-semanas.png` });
  await p.goto('http://localhost:8081/hombres/5');
  await p.getByText(/Hierro con hierro se aguza/).filter({ visible: true }).first().waitFor();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${pref}-2-semana.png` });
  await p.getByText('EL RETO DE LA SEMANA').filter({ visible: true }).scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${pref}-3-reto.png` });
  await ctx.close();
}
await b.close();
