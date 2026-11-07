// El teclado no tapa la caja de preguntar (Estudio y Pregúntale a la Biblia). En Chrome de Android la página pide
// interactive-widget=resizes-content y el teclado encoge la ventana: aquí se imita achicándola. En Safari solo encoge
// la parte visible (visualViewport) y src/lib/teclado.ts deja ese espacio debajo.

import { conSesion, cuentaNueva, expect, modoProfundo, test } from './support/fixtures';

const W = 412, H = 915, TECLADO = 330;

for (const tema of ['light', 'dark'] as const) {
  test(`estudio con teclado ${tema}`, async ({ page, request }) => {
    await page.emulateMedia({ colorScheme: tema });
    await page.setViewportSize({ width: W, height: H });
    await modoProfundo(page);
    await conSesion(page, await cuentaNueva(request, 'Teclado'));
    await page.goto('/romanos/11/26');
    await page.getByRole('button', { name: 'Estudiar', exact: true }).click();
    const caja = page.getByRole('dialog').getByRole('textbox').last();
    await expect(caja).toBeEnabled({ timeout: 20000 });
    await caja.click();
    await caja.fill('¿Qué significa todo Israel será salvo');
    // Con interactive-widget=resizes-content el teclado encoge la ventana: es lo mismo que achicarla
    await page.setViewportSize({ width: W, height: H - TECLADO });
    await page.waitForTimeout(600);
    const box = await caja.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(H - TECLADO);
  });

  test(`preguntar con teclado ${tema}`, async ({ page, request }) => {
    await page.emulateMedia({ colorScheme: tema });
    await page.setViewportSize({ width: W, height: H });
    await conSesion(page, await cuentaNueva(request, 'Teclado'));
    await page.goto('/preguntar');
    const caja = page.getByRole('textbox').last();
    await caja.click();
    await caja.fill('¿Qué dice la Biblia sobre la ansiedad');
    await page.setViewportSize({ width: W, height: H - TECLADO });
    await page.waitForTimeout(600);
    const box = await caja.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(H - TECLADO);
    await expect(page.getByRole('tablist')).toBeHidden();
    // Al cerrar el teclado vuelven las pestañas
    await caja.blur();
    await page.setViewportSize({ width: W, height: H });
    await expect(page.getByRole('tablist')).toBeVisible();
  });
}

test('Safari: deja el espacio que tapa el teclado', async ({ page, request }) => {
  await page.setViewportSize({ width: W, height: H });
  await page.addInitScript((tapa) => {
    const vv = new EventTarget() as EventTarget & { height: number; offsetTop: number };
    vv.height = window.innerHeight; vv.offsetTop = 0;
    Object.defineProperty(window, 'visualViewport', { value: vv });
    (window as unknown as { abrirTeclado: () => void }).abrirTeclado = () => { vv.height = window.innerHeight - tapa; vv.dispatchEvent(new Event('resize')); };
  }, TECLADO);
  await conSesion(page, await cuentaNueva(request, 'Teclado'));
  await page.goto('/preguntar');
  const caja = page.getByRole('textbox').last();
  await caja.click();
  await page.evaluate(() => (window as unknown as { abrirTeclado: () => void }).abrirTeclado());
  await page.waitForTimeout(400);
  const box = await caja.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(H - TECLADO);
});

test('Chrome que encoge la ventana menos que el teclado: deja el trozo que falta', async ({ page, request }) => {
  await page.setViewportSize({ width: W, height: H });
  await page.addInitScript(() => {
    const vv = new EventTarget() as EventTarget & { height: number; offsetTop: number };
    vv.height = window.innerHeight; vv.offsetTop = 0;
    Object.defineProperty(window, 'visualViewport', { value: vv });
    // window.innerHeight en Chrome es la parte visible: se imita igual que el visualViewport
    (window as unknown as { faltan: (n: number) => void }).faltan = (n) => {
      vv.height = document.documentElement.clientHeight - n;
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: vv.height });
      vv.dispatchEvent(new Event('resize'));
    };
  });
  await conSesion(page, await cuentaNueva(request, 'Teclado'));
  await page.goto('/romanos/11/26');
  await page.getByRole('button', { name: 'Estudiar', exact: true }).click();
  const caja = page.getByRole('dialog').getByRole('textbox').last();
  await expect(caja).toBeEnabled({ timeout: 20000 });
  await caja.click();
  await page.evaluate(() => (window as unknown as { faltan: (n: number) => void }).faltan(50));
  await page.waitForTimeout(400);
  const box = await caja.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(H - 50);
});

// Preparar un mensaje (Mike, 2026-11-07): en Investigar la caja de pedir más quedaba tapada por el teclado.
test('preparar un mensaje: el teclado no tapa la caja de pedir más ni lo que se escribe', async ({ page, request }) => {
  await page.setViewportSize({ width: W, height: H });
  await page.addInitScript(() => {
    const vv = new EventTarget() as EventTarget & { height: number; offsetTop: number };
    vv.height = window.innerHeight; vv.offsetTop = 0;
    Object.defineProperty(window, 'visualViewport', { value: vv });
    (window as unknown as { faltan: (n: number) => void }).faltan = (n) => {
      vv.height = document.documentElement.clientHeight - n;
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: vv.height });
      vv.dispatchEvent(new Event('resize'));
    };
  });
  await conSesion(page, await cuentaNueva(request, 'Teclado preparar'));
  await page.goto('/taller/preparar');
  const faltan = (n: number) => page.evaluate((x) => (window as unknown as { faltan: (n: number) => void }).faltan(x), n);

  // Paso 1: lo que Dios te puso, con un teclado que la ventana no descuenta (Safari, o un Samsung que se queda corto)
  const orar = page.getByLabel('Lo que Dios te puso');
  await orar.click();
  await orar.fill('Los muchachos andan ansiosos por el futuro; me vino Pedro caminando sobre el agua.');
  await faltan(TECLADO);
  await page.waitForTimeout(400);
  // El navegador lleva el campo enfocado a la vista: solo queda por encima del teclado si la página dejó el espacio
  await orar.evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
  const b1 = await orar.boundingBox();
  expect(b1!.y + 40).toBeLessThanOrEqual(H - TECLADO);
  await orar.blur();
  await faltan(0);
  await page.getByRole('button', { name: 'Investigar esto' }).click();

  // Paso 2: la caja de pedir más, por encima del teclado
  await expect(page.getByText('PREDICACIONES EN LA WEB')).toBeVisible({ timeout: 20_000 });
  const caja = page.getByPlaceholder('Pide más, añade una idea o un enlace');
  await expect(caja).toBeEnabled({ timeout: 20_000 });
  await caja.click();
  await faltan(TECLADO);
  await page.waitForTimeout(400);
  const b2 = await caja.boundingBox();
  expect(b2!.y + b2!.height).toBeLessThanOrEqual(H - TECLADO);
  await page.screenshot({ path: 'test-results/teclado-preparar.png' });
});
