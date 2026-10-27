// «Pregúntale a la Biblia» (/buscar y /preguntar): una pregunta escrita en el buscador se responde arriba y se abre
// completa; las preguntas que muchos hacen se guardan para todos y se leen sin cuenta.

import type { Locator, Page } from '@playwright/test';

import { conSesion, cuentaNueva, expect, peticionesIA, test } from './support/fixtures';

const visible = (l: Locator) => l.filter({ visible: true });
const texto = (page: Page, t: string | RegExp) => visible(page.getByText(t)).first();

test('una pregunta en el buscador muestra la respuesta corta y se abre completa para seguir preguntando', async ({ page, request }) => {
  await conSesion(page, await cuentaNueva(request, 'Ana'));
  const pregunta = `¿Qué dice la Biblia sobre la ansiedad cuando todo va mal ${Date.now()}?`;
  await page.goto(`/buscar?q=${encodeURIComponent(pregunta)}`);

  // Arriba la respuesta corta con su versículo; debajo los pasajes de la búsqueda rápida
  await expect(texto(page, /no llama pecado a sentir angustia/)).toBeVisible();
  await expect(texto(page, /Por nada estéis afanosos/)).toBeVisible();
  await expect(texto(page, 'También en la Biblia')).toBeVisible();
  // La parte de «Lo que dice la Biblia» y la línea «Sigue» no salen en la tarjeta
  await expect(visible(page.getByText('Lo que dice la Biblia'))).toHaveCount(0);

  // La respuesta completa es la misma: no se vuelve a pedir
  const antes = (await peticionesIA(request, pregunta)).length;
  await texto(page, 'Ver la respuesta completa ›').click();
  await expect(page).toHaveURL(/\/preguntar\?q=/);
  await expect(texto(page, 'Lo que dice la Biblia')).toBeVisible();
  await expect(texto(page, 'Para pensar')).toBeVisible();
  await expect(visible(page.getByText(/^Sigue:/))).toHaveCount(0);
  expect((await peticionesIA(request, pregunta)).length).toBe(antes);

  // Una pregunta sugerida sigue la conversación
  await texto(page, '¿Jesús sintió angustia?').click();
  await expect(visible(page.getByText('Para pensar'))).toHaveCount(2);
  expect((await peticionesIA(request, '¿Jesús sintió angustia?')).length).toBeGreaterThan(0);
});

test('una pregunta propia sin cuenta invita a entrar; una de las que muchos hacen se lee gratis una vez preparada', async ({ page, request, browser }) => {
  // Alguien con cuenta la prepara la primera vez
  const conCuenta = await browser.newPage();
  await conSesion(conCuenta, await cuentaNueva(request, 'Luis'));
  await conCuenta.goto(`/preguntar?q=${encodeURIComponent('¿Qué es la Trinidad?')}`);
  await expect(texto(conCuenta, 'Para pensar')).toBeVisible();
  await conCuenta.close();

  await page.goto(`/buscar?q=${encodeURIComponent('¿Qué dice la Biblia sobre la envidia?')}`);
  await expect(texto(page, 'Crear cuenta gratis')).toBeVisible();

  // Desde la lista del buscador vacío, sin cuenta
  await page.goto('/buscar');
  await visible(page.getByRole('button', { name: 'La Biblia', exact: true })).click();
  await texto(page, '¿Cómo se decidió qué libros van en la Biblia?').waitFor();
  await page.goto('/buscar');
  await visible(page.getByRole('button', { name: 'Dios', exact: true })).click();
  await texto(page, '¿Qué es la Trinidad?').click();
  await expect(texto(page, /no llama pecado a sentir angustia/)).toBeVisible();
  await expect(visible(page.getByText('Crear cuenta gratis'))).toHaveCount(0);
});
