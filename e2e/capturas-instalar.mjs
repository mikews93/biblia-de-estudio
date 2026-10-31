// Capturas de «Zarza en tu Android» (/instalar) (no es una prueba): node e2e/capturas-instalar.mjs <carpeta>
// Con la web servida en localhost:8081. La release de GitHub se simula, para no depender de que ya exista.
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'capturas/instalar';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const release = {
  name: 'Zarza 1.0.0 (7) para Android',
  assets: [{ name: 'zarza.apk', size: 32_925_000, updated_at: '2026-10-30T20:00:00Z', browser_download_url: 'https://github.com/mikews93/biblia-de-estudio/releases/download/apk/zarza.apk' }],
};
const movil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const casos = [
  ['m', { ...movil, userAgent: ANDROID }],
  ['o', { ...movil, userAgent: ANDROID, colorScheme: 'dark' }],
  ['d', { viewport: { width: 1280, height: 900 } }],
  ['do', { viewport: { width: 1280, height: 900 }, colorScheme: 'dark' }],
  ['i', { ...movil, userAgent: IPHONE }],
];
for (const [pref, opts] of casos) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => localStorage.setItem('bienvenida', '2026-10-01T00:00:00.000Z'));
  const p = await ctx.newPage();
  await p.route('https://api.github.com/**', (r) => r.fulfill({ json: release }));
  await p.goto('http://localhost:8081/instalar');
  await p.getByText('Zarza en tu Android').filter({ visible: true }).first().waitFor();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${pref}-1-instalar.png` });
  if (pref === 'm' || pref === 'o') {
    await p.getByText('Instala y abre Zarza').filter({ visible: true }).evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/${pref}-2-pasos.png` });
  }
  if (pref === 'm') {
    // Tocar «Descargar» sin salir de la página: aparece la ayuda por si Chrome deja la descarga al 100 %.
    await p.route('https://github.com/**', (r) => r.fulfill({ status: 204 }));
    await p.getByTestId('descargar-apk').click();
    await p.getByTestId('descarga-trabada').waitFor();
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/m-7-descarga-trabada.png` });
    await p.unroute('https://api.github.com/**');
    await p.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, json: { message: 'Not Found' } }));
    await p.reload();
    await p.getByText('Muy pronto').filter({ visible: true }).waitFor();
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${out}/m-3-muy-pronto.png` });
    await p.goto('http://localhost:8081/acerca');
    await p.getByTestId('acerca-instalar').waitFor();
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}/m-4-acerca.png` });
    await p.goto('http://localhost:8081/');
    await p.getByTestId('hoy-instalar').evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}/m-5-hoy.png` });
    await p.goto('http://localhost:8081/todo');
    await p.getByPlaceholder(/busca/i).fill('apk').catch(() => {});
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}/m-6-todo.png` });
  }
  await ctx.close();
}
await b.close();
