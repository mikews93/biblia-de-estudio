// Capturas de la hoja para compartir un versículo (no es una prueba): fondos, letras, dedicatoria y palabra original.
// node e2e/capturas-compartir.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
// También guarda las imágenes que se descargan (las que dibuja el canvas), para ver que salen igual que la vista previa.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: 1280, height: 860 }, acceptDownloads: true, ...scheme }
      : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, acceptDownloads: true, ...scheme },
  );
  return ctx.newPage();
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(700);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const descargar = async (p, name) => {
  const [d] = await Promise.all([p.waitForEvent('download'), p.getByText('Descargar', { exact: true }).click()]);
  await d.saveAs(`${OUT}/${name}.png`);
};

// Toca un control de la hoja: primero lo trae a la vista dentro de la lista que se desplaza.
const toca = async (loc) => {
  await loc.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
  await wait(250);
  await loc.click({ force: true });
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/juan/3`);
  await p.getByText('Porque de tal manera amó Dios al mundo').click();
  await p.getByRole('button', { name: 'Compartir', exact: true }).click();
  await p.getByText('Compartir Juan 3:16').waitFor();
  await wait(1500);
  await shot(p, `${prefix}-1-amanecer`);

  await p.getByRole('radio', { name: 'Fondo Estrellas' }).click();
  await p.getByRole('tab', { name: 'Letra' }).click();
  await p.getByRole('radio', { name: 'Letra Elegante' }).click();
  await p.getByRole('radio', { name: 'Letra Elegante' }).scrollIntoViewIfNeeded();
  await shot(p, `${prefix}-2-estrellas-letras`);

  await p.getByRole('tab', { name: 'Dedicar' }).click();
  await p.getByRole('radio', { name: 'Oré por ti hoy' }).click();
  // Destacar «amó» y «Hijo» tocándolas en la vista previa.
  const vista = p.getByText('«Porque de tal manera', { exact: false }).last();
  await vista.getByText('amó', { exact: true }).click();
  await vista.getByText('unigénito,', { exact: true }).click();
  await p.getByRole('radio', { name: 'Oré por ti hoy' }).scrollIntoViewIfNeeded();
  await shot(p, `${prefix}-3-dedicar`);

  await p.getByRole('tab', { name: 'Original' }).click();
  await p.getByRole('radio', { name: /amó/ }).click();
  await p.getByRole('tab', { name: 'Fondo' }).click();
  await p.getByRole('radio', { name: 'Fondo Olivo' }).click();
  await p.getByRole('tab', { name: 'Original' }).click();
  await p.getByRole('radio', { name: /amó/ }).scrollIntoViewIfNeeded();
  await shot(p, `${prefix}-4-original-olivo`);
  if (prefix === 'm') await descargar(p, 'imagen-1-olivo');

  await p.getByRole('radio', { name: 'Historia' }).click();
  await p.getByRole('tab', { name: 'Fondo' }).click();
  await p.getByRole('radio', { name: 'Fondo Zarza' }).click();
  await p.getByRole('tab', { name: 'Letra' }).click();
  await p.getByRole('radio', { name: 'Letra Inscripción' }).click();
  await p.getByText('Compartir Juan 3:16').scrollIntoViewIfNeeded();
  await shot(p, `${prefix}-5-historia-zarza`);
  if (prefix === 'm') {
    await descargar(p, 'imagen-2-zarza-historia');
    // Más combinaciones solo como imagen descargada.
    const combos = [
      ['Mar', 'A mano', 'cuadrado'],
      ['Montes', 'Moderna', 'cuadrado'],
      ['Trigal', 'Caligrafía', 'cuadrado'],
      ['Luz', 'Cursiva', 'historia'],
      ['Acuarela', 'Antigua', 'cuadrado'],
      ['Amanecer', 'Cartel', 'historia'],
    ];
    for (const [fondo, letra, formato] of combos) {
      await toca(p.getByRole('radio', { name: formato === 'historia' ? 'Historia' : 'Publicación' }));
      await toca(p.getByRole('tab', { name: 'Fondo' }));
      await toca(p.getByRole('radio', { name: `Fondo ${fondo}` }));
      await toca(p.getByRole('tab', { name: 'Letra' }));
      await toca(p.getByRole('radio', { name: `Letra ${letra}` }));
      await descargar(p, `imagen-${fondo.toLowerCase()}-${letra.toLowerCase().replace(/\s/g, '')}`);
    }
  }
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
