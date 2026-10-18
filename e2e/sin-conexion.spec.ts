// Sin conexión: descargar un libro desde «Sin conexión», leerlo sin internet (el service worker lo sirve de
// lo descargado), el aviso en lo que no está descargado y en lo que necesita internet (comunidad, IA).

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

test('se descarga Judas y se lee sin conexión; lo demás avisa que necesita internet', async ({ page, context, request }) => {
  const judas: [number, string][] = await (await request.get('/data/text/rv1909/jud/1.json')).json();

  await page.goto('/descargas');
  await withServiceWorker(page);
  await expect(visible(page, 'Lee sin conexión')).toBeVisible();
  await expect(visible(page, 'Nada descargado aún')).toBeVisible();

  // La versión que se lee va primero: se eligen libros y se toca Judas
  const card = page.getByTestId('paquete-texto:rv1909');
  await expect(card.getByText('La que lees', { exact: true })).toBeVisible();
  await expect(card.getByText('Reina-Valera 1909', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: /^Toda la Biblia · \d/ })).toBeVisible();
  await card.getByRole('button', { name: 'Elegir libros' }).click();
  await card.getByRole('checkbox', { name: 'Judas', exact: true }).click();
  await expect(card.getByRole('checkbox', { name: 'Judas, descargado' })).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText('1 de 66 libros')).toBeVisible();
  await expect(visible(page, /KB guardados/)).toBeVisible();

  // En la lista de libros, Judas aparece como disponible sin conexión
  await page.goto('/libros');
  await expect(page.getByLabel('Descargado para leer sin conexión')).toHaveCount(1);

  await offline(context, true);

  // Judas se abre sin internet
  await page.goto('/judas/1');
  await expect(visible(page, judas[0][1].slice(0, 40))).toBeVisible();
  await expect(visible(page, 'Sin conexión')).toBeVisible();

  // Romanos no está descargado
  await page.goto('/romanos/1');
  await expect(visible(page, 'Este capítulo no está descargado')).toBeVisible();
  await visible(page, 'Ver lo que puedes leer sin conexión').click();
  await expect(page).toHaveURL(/\/descargas$/);
  await expect(visible(page, 'Conéctate a internet para descargar.')).toBeVisible();

  // La comunidad necesita internet
  await page.goto('/comunidades');
  await expect(visible(page, 'La comunidad necesita internet')).toBeVisible();

  // Al volver la conexión desaparece el aviso
  await offline(context, false);
  await page.goto('/descargas');
  await expect(visible(page, 'Con conexión')).toBeVisible();
  await expect(page.getByText('lees lo guardado')).toHaveCount(0);

  // Quitar el libro lo borra del dispositivo
  const again = page.getByTestId('paquete-texto:rv1909');
  await again.getByRole('button', { name: 'Elegir libros' }).click();
  await again.getByRole('checkbox', { name: 'Judas, descargado' }).click();
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
