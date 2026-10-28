// «Del diccionario bíblico» en el buscador: una palabra de la Biblia se explica en español con sus pasajes clave,
// desde los diccionarios de Easton y Smith y el índice de Nave. Se escribe una vez con IA y se guarda para todos.

import type { Locator, Page } from '@playwright/test';

import { expect, peticionesIA, test } from './support/fixtures';

const visible = (l: Locator) => l.filter({ visible: true });
const texto = (page: Page, t: string | RegExp) => visible(page.getByText(t)).first();

test('una palabra de la Biblia se explica sin cuenta, con pasajes de las fuentes, y se guarda para todos', async ({ page, request }) => {
  await page.goto(`/buscar?q=${encodeURIComponent('Getsemaní')}`);
  await expect(texto(page, 'Del diccionario bíblico')).toBeVisible();
  await expect(texto(page, /huerto de olivos al pie del monte de los Olivos/)).toBeVisible();
  // Los pasajes vienen de las fuentes; el que la IA inventó no sale
  await expect(texto(page, 'Jesús ora en el huerto')).toBeVisible();
  await expect(visible(page.getByRole('link', { name: 'Lucas 22:39' }))).toHaveCount(1);
  await expect(visible(page.getByText(/Génesis 99/))).toHaveCount(0);
  await expect(texto(page, /diccionarios bíblicos de Easton \(1897\) y Smith \(1863\)/)).toBeVisible();

  // «Leer más» abre el resto
  await expect(visible(page.getByText('Su nombre significa «prensa de aceite».'))).toHaveCount(0);
  await texto(page, 'Leer más').click();
  await expect(texto(page, 'Su nombre significa «prensa de aceite».')).toBeVisible();

  // Ya guardada, otra visita no vuelve a pedirla a la IA
  const antes = (await peticionesIA(request, 'Palabra: Getsemaní')).length;
  expect(antes).toBeLessThanOrEqual(1);
  await page.reload();
  await expect(texto(page, /huerto de olivos/)).toBeVisible();
  expect((await peticionesIA(request, 'Palabra: Getsemaní')).length).toBe(antes);

  // Un pasaje abre el lector
  await visible(page.getByRole('link', { name: 'Lucas 22:39' })).click();
  await expect(page).toHaveURL(/\/lucas\/22/);
});

test('una pregunta corta sobre una palabra muestra también su explicación, y las búsquedas normales no', async ({ page }) => {
  await page.goto(`/buscar?q=${encodeURIComponent('¿Qué es el efod?')}`);
  await expect(texto(page, 'Del diccionario bíblico')).toBeVisible();
  await expect(texto(page, 'Efod')).toBeVisible();

  await page.goto(`/buscar?q=${encodeURIComponent('Todo lo puedo en Cristo')}`);
  await expect(texto(page, 'También en la Biblia').or(texto(page, /Filipenses 4:13/))).toBeVisible();
  await expect(visible(page.getByText('Del diccionario bíblico'))).toHaveCount(0);
});
