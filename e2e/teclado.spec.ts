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
