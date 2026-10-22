// Del sermón a tu semana (src/lib/semanas.ts): las notas del sermón del domingo se convierten en cinco días de
// devocional sobre su pasaje; cada día se hace con el devocional guiado y queda en el diario.

import type { Locator } from '@playwright/test';

import { conSesion, cuentaNueva, expect, peticionesIA, test } from './support/fixtures';

// Las pantallas anteriores siguen en la página (ocultas) mientras se navega.
const v = (l: Locator) => l.filter({ visible: true });
const marca = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

test('sin cuenta se pueden escribir las notas, que no se pierden, y se invita a crear la cuenta', async ({ page }) => {
  await page.goto('/semana');
  await expect(v(page.getByText('Lleva el sermón del domingo a tu semana'))).toBeVisible();
  await v(page.getByText('Escribir mis notas del sermón')).click();
  await expect(page).toHaveURL(/\/semana\/nueva$/);

  const pasaje = page.getByLabel('Pasaje del sermón');
  await pasaje.fill('jn 3:1-8');
  await pasaje.press('Enter');
  await expect(pasaje).toHaveValue('Juan 3:1-8');
  await expect(v(page.getByText(/un hombre de los Fariseos/))).toBeVisible();
  await page.getByRole('button', { name: 'Añadir «La idea principal» a las notas' }).click();
  await expect(page.getByLabel('Tus notas del sermón')).toHaveValue('La idea principal: ');
  await page.getByLabel('Tus notas del sermón').pressSequentially('nacer de nuevo');
  await expect(v(page.getByText('Prepara tu semana'))).toBeVisible();

  // El borrador sigue ahí al volver
  await expect.poll(() => page.evaluate(() => localStorage.getItem('semana-borrador') ?? '')).toContain('nacer de nuevo');
  await page.reload();
  await expect(page.getByLabel('Tus notas del sermón')).toHaveValue('La idea principal: nacer de nuevo');
  await expect(page.getByLabel('Pasaje del sermón')).toHaveValue('Juan 3:1-8');
});

test('de las notas a cinco días: hacer el primero lo deja en el diario y en Hoy aparece el siguiente', async ({ page, request }) => {
  const m = marca();
  await conSesion(page, await cuentaNueva(request, 'Oyente'));
  await page.goto('/semana/nueva');
  const pasaje = page.getByLabel('Pasaje del sermón');
  await pasaje.fill('Juan 3:1-21');
  await pasaje.press('Tab');
  await page.getByPlaceholder('Nombre o iglesia').fill('Pastor Luis');
  await page.getByLabel('Tus notas del sermón').fill(`Nicodemo vino de noche ${m}. Dios nos busca aunque tengamos miedo.`);
  await page.getByRole('button', { name: 'Preparar mi semana' }).click();

  // La semana preparada
  await expect(page).toHaveURL(/\/semana\/[a-z0-9]+$/);
  await expect(v(page.getByText('Nacer de nuevo'))).toBeVisible();
  await expect(v(page.getByText('Predicó Pastor Luis'))).toBeVisible();
  await expect(v(page.getByText('TUS 5 DÍAS · 0 HECHOS'))).toBeVisible();
  for (const t of ['Un encuentro de noche', 'El viento sopla', 'Mirar y vivir', 'Tanto amó Dios', 'De la luz a la luz']) {
    await expect(page.getByRole('button', { name: new RegExp(`Día \\d, ${t}`) })).toBeVisible();
  }
  const [pedido] = await peticionesIA(request, `Nicodemo vino de noche ${m}`);
  expect(JSON.stringify(pedido.system)).toContain('Reglas de la semana');
  expect(JSON.stringify(pedido.messages[0].content)).toContain('sobre Juan 3:1-21, que predicó Pastor Luis');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('semana-borrador'))).toBeNull();

  // Las notas siguen a mano
  await page.getByRole('button', { name: /Tus notas del domingo/ }).click();
  await expect(page.getByText(`Nicodemo vino de noche ${m}. Dios nos busca aunque tengamos miedo.`)).toBeVisible();

  // El día 1, con el devocional guiado del pasaje
  await page.getByRole('button', { name: /^EMPIEZA AQUÍ/ }).click();
  await expect(page).toHaveURL(/\/semana\/[a-z0-9]+\/1$/);
  await expect(v(page.getByText('EL DOMINGO ANOTASTE'))).toBeVisible();
  await expect(v(page.getByText('«Nicodemo vino de noche»'))).toBeVisible();
  await v(page.getByText('Estoy listo · Leer')).click();
  await expect(v(page.getByText('JUAN 3:1-3', { exact: true }))).toBeVisible();
  await expect(v(page.getByText(/Respondió Jesús, y díjole/))).toBeVisible();
  await v(page.getByText('Ya lo leí')).click();
  await expect(v(page.getByText('Observación simulada del día 1'))).toBeVisible();
  await page.getByLabel('¿Qué palabra o frase te detuvo?').fill(`De noche ${m}`);
  await v(page.getByText('Vive ›')).click();
  await v(page.getByText('Paso simulado 1: llama a alguien y escúchale.')).click();
  await v(page.getByText('Ora ›')).click();
  await page.getByLabel('Tu oración').fill('Señor, búscame');
  await v(page.getByText('Amén · Guardar')).click();
  await expect(v(page.getByText('Amén', { exact: true }))).toBeVisible();
  await expect(v(page.getByText('LLÉVALO CONTIGO'))).toBeVisible();

  // Quedó en el diario y marcado en la semana
  await expect.poll(() => page.evaluate(() => localStorage.getItem('diario') ?? '')).toContain(`De noche ${m}`);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('semanas') ?? '[]')[0]?.hechos ?? {})).toHaveProperty('0');

  // Mañana: el día 2
  await v(page.getByText(/Día 2 · El viento sopla ›/)).click();
  await expect(page).toHaveURL(/\/semana\/[a-z0-9]+\/2$/);
  await expect(v(page.getByText('«El Espíritu es como el viento»'))).toBeVisible();

  // En Hoy, la semana en curso lleva al día que sigue
  await page.goto('/');
  const tarjeta = page.getByRole('button', { name: /Del sermón · Juan 3:1-21/ });
  await expect(tarjeta).toContainText('Día 2 · El viento sopla');
  await tarjeta.click();
  await expect(page).toHaveURL(/\/semana\/[a-z0-9]+\/2$/);
});
