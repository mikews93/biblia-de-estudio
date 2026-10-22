// Fichas de personas y lugares (/ficha/…): la descripción traducida, la familia, la época y el mapa, y cómo se llega a
// ellas desde el lector y el buscador.

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './support/fixtures';

const visible = (l: Locator) => l.filter({ visible: true });
const texto = (page: Page, t: string | RegExp) => visible(page.getByText(t)).first();

test('la ficha de Abraham junta descripción, familia, época y versículos', async ({ page }) => {
  await page.goto('/ficha/h0085-abraham');
  await expect(texto(page, 'Quién fue')).toBeVisible();
  // La descripción se traduce la primera vez (IA simulada) y conserva las citas, que se pueden tocar
  await expect(texto(page, /Descripción simulada de la ficha/)).toBeVisible();
  await expect(texto(page, 'Cuándo vivió')).toBeVisible();
  await expect(texto(page, 'Ver en la línea de tiempo')).toBeVisible();
  await expect(texto(page, 'Versículos clave')).toBeVisible();

  // De la familia a otra ficha
  await visible(page.getByRole('link', { name: 'Isaac', exact: true })).first().click();
  await expect(page).toHaveURL(/\/ficha\/h3327-isaac$/);
  await expect(texto(page, 'Hijo de Abraham')).toBeVisible();
});

test('la ficha de un lugar tiene su mapa y la gente que vivió allí', async ({ page }) => {
  await page.goto('/ficha/h1035g-belen');
  await expect(texto(page, 'Dónde estaba')).toBeVisible();
  await expect(texto(page, 'Personas de este lugar')).toBeVisible();
  // Dónde aparece: al tocar un libro se ven sus capítulos
  await visible(page.getByRole('button', { name: /^Rut/ })).first().click();
  await expect(visible(page.getByRole('link', { name: /^Rut 1, 4 versículos$/ })).first()).toBeVisible();
});

test('en el lector, los nombres del versículo elegido llevan a su ficha', async ({ page }) => {
  await page.goto('/rut/4/17');
  // El versículo llega elegido: la barra muestra a las personas que nombra
  await visible(page.getByRole('link', { name: 'Ficha de David' })).first().click();
  await expect(page).toHaveURL(/\/ficha\/h1732-david$/);
  await expect(texto(page, 'Hijo de Isaí')).toBeVisible();
});

test('el buscador encuentra personas y lugares por su nombre', async ({ page }) => {
  await page.goto('/buscar');
  await visible(page.getByRole('textbox', { name: 'Buscar una cita, unas palabras o una idea' })).fill('booz');
  await expect(texto(page, 'Personas y lugares')).toBeVisible();
  await visible(page.getByRole('link', { name: /Booz/ })).first().click();
  await expect(page).toHaveURL(/\/ficha\/h1162g-booz$/);
});
