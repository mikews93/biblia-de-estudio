// Capturas de «Sostén Zarza» (no es una prueba): node e2e/capturas-sostener.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'capturas/sostener';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [pref, opts] of [['m', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }], ['o', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' }], ['d', { viewport: { width: 1280, height: 900 } }]]) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  await p.goto('http://localhost:8081/sostener');
  await p.getByText('Círculo de sembradores').filter({ visible: true }).waitFor();
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/${pref}-1-inicio.png` });
  await p.getByText('CADA MES', { exact: true }).filter({ visible: true }).evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${pref}-2-sembrar.png` });
  await ctx.close();
}
await b.close();
