// Sin conexión: descargar la traducción completa desde «Sin conexión», leerla sin internet (el service worker la
// sirve de lo descargado), el aviso en lo que no está descargado y en lo que necesita internet (comunidad, IA).

import type { Page } from '@playwright/test';

import type { BrowserContext } from '@playwright/test';

import { expect, test } from './support/fixtures';

// setOffline no corta la red del service worker; con esto sus peticiones pasan por context.route y se cortan
// también (ver offline()).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

/** Sin internet de verdad: navigator.onLine en false y toda petición a la red falla, también las del service worker. */
async function offline(context: BrowserContext, off: boolean) {
  await context.setOffline(off);
  if (off) await context.route('**/*', (route) => route.abort('internetdisconnected'));
  else await context.unrouteAll();
}

const visible = (page: Page, t: string | RegExp) => page.getByText(t).filter({ visible: true }).first();

/** Espera a que el service worker controle la página (lo registra index.html al cargar). */
async function withServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
  });
}

test('se descarga la traducción completa y se lee sin conexión; lo demás avisa que necesita internet', async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(120_000);
  const judas: [number, string][] = await (await request.get('/data/text/rv1909/jud/1.json')).json();

  await page.goto('/descargas');
  await withServiceWorker(page);
  await expect(visible(page, 'Lee sin conexión')).toBeVisible();
  await expect(visible(page, 'Nada descargado aún')).toBeVisible();

  // La versión que se lee va primero y se descarga entera
  const card = page.getByTestId('paquete-texto:rv1909');
  await expect(card.getByText('La que lees', { exact: true })).toBeVisible();
  await expect(card.getByText('Reina-Valera 1909', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: /^Descargar la traducción completa · [\d,]+ MB$/ }).click();
  await expect(card.getByRole('progressbar')).toBeVisible();
  await expect(card.getByText('Descargada', { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(card.getByRole('button', { name: /^Quitar · / })).toBeVisible();
  await expect(visible(page, /MB guardados/)).toBeVisible();

  // En la lista de libros, todos aparecen disponibles sin conexión
  await page.goto('/libros');
  await expect(page.getByLabel('Descargado para leer sin conexión')).toHaveCount(66);

  await offline(context, true);

  // Judas se abre sin internet
  await page.goto('/judas/1');
  await expect(visible(page, judas[0][1].slice(0, 40))).toBeVisible();
  await expect(visible(page, 'Sin conexión')).toBeVisible();

  // Otra versión, no descargada, avisa
  await page.evaluate(() => localStorage.setItem('ajustes', JSON.stringify({ version: 'bes' })));
  await page.goto('/romanos/1');
  await expect(visible(page, 'Este capítulo no está descargado')).toBeVisible();
  await visible(page, 'Ver lo que puedes leer sin conexión').click();
  await expect(page).toHaveURL(/\/descargas$/);
  await expect(visible(page, 'Conéctate a internet para descargar.')).toBeVisible();

  // La comunidad necesita internet
  await page.goto('/comunidades');
  await expect(visible(page, 'La comunidad necesita internet')).toBeVisible();

  // Al volver la conexión desaparece el aviso, y quitar la versión la borra del dispositivo
  await offline(context, false);
  await page.goto('/descargas');
  await expect(visible(page, 'Con conexión')).toBeVisible();
  await expect(page.getByText('lees lo guardado')).toHaveCount(0);
  await page.getByTestId('paquete-texto:rv1909').getByRole('button', { name: /^Quitar · / }).click();
  await expect(visible(page, 'Nada descargado aún')).toBeVisible();
});

test('buscar por idea sin conexión avisa sin llamar a la IA', async ({ page, context }) => {
  await page.goto('/buscar');
  await withServiceWorker(page);
  // La pantalla ya cargada; luego se corta la red
  const box = page.getByRole('textbox').filter({ visible: true }).first();
  await expect(box).toBeVisible();
  await offline(context, true);
  await box.fill('el amor de Dios por el mundo');
  await box.press('Enter');
  await expect(visible(page, 'Buscar por idea necesita internet')).toBeVisible();
});
