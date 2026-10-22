import type { Locator } from '@playwright/test';

import { conSesion, cuentaNueva, expect, test, type Page } from './support/fixtures';

// Diario de oración (src/lib/oraciones.ts): peticiones con los versículos que acompañan, respuestas y «Mi camino».

const v = (l: Locator) => l.filter({ visible: true });
const tocarVersiculo = (page: Page, texto: string) => v(page.getByText(texto, { exact: false })).last().click();

test('orar con un versículo del lector, unir otro, marcar la respuesta y verla en «Mi camino»', async ({ page }) => {
  await page.goto('/juan/3');
  await tocarVersiculo(page, 'Porque de tal manera amó Dios al mundo');
  await v(page.getByRole('button', { name: 'Orar', exact: true })).click();
  await expect(v(page.getByText('Orar con este versículo'))).toBeVisible();
  await v(page.getByRole('button', { name: 'Nueva petición con este versículo' })).click();
  await v(page.getByLabel('Petición', { exact: true })).fill('Trabajo para papá');
  await v(page.getByRole('button', { name: 'Guardar' })).click();

  // Otro versículo del lector se une a la misma petición.
  await v(page.getByLabel('Quitar selección')).click();
  await tocarVersiculo(page, 'el que no naciere otra vez, no puede ver');
  await v(page.getByRole('button', { name: 'Orar', exact: true })).click();
  await v(page.getByRole('button', { name: /Trabajo para papá/ })).click();
  await expect(v(page.getByText('Quedó unido a «Trabajo para papá».'))).toBeVisible();

  await page.goto('/diario?vista=oraciones');
  const tarjeta = v(page.getByTestId('oracion'));
  await expect(tarjeta).toContainText('Trabajo para papá');
  await expect(tarjeta).toContainText('Juan 3:16');
  await expect(tarjeta).toContainText('Juan 3:3');

  // Un versículo escrito a mano.
  await tarjeta.getByRole('button', { name: 'Versículo' }).click();
  await v(page.getByLabel('Cita del versículo')).fill('Salmo 23:1');
  await expect(v(page.getByText('Jehová es mi pastor', { exact: false }))).toBeVisible();
  await v(page.getByRole('button', { name: 'Unir a mi oración' })).click();
  await expect(tarjeta).toContainText('Salmos 23:1');

  // Dios respondió.
  await tarjeta.getByRole('button', { name: 'Dios respondió' }).click();
  await v(page.getByLabel('Cómo respondió')).fill('Lo contrataron en la panadería.');
  await v(page.getByRole('button', { name: 'Guardar respuesta' })).click();
  await expect(v(page.getByText('No tienes peticiones abiertas ahora.'))).toBeVisible();
  await v(page.getByRole('tab', { name: 'Respondidas · 1' })).click();
  await expect(v(page.getByTestId('oracion'))).toContainText('RESPONDIDA EL MISMO DÍA');
  await expect(v(page.getByTestId('oracion'))).toContainText('Lo contrataron en la panadería.');

  // «Mi camino», también tras recargar.
  await page.reload();
  await v(page.getByRole('tab', { name: 'Mi camino' })).click();
  await expect(v(page.getByText('3 versículos te han acompañado'))).toBeVisible();
  await expect(v(page.getByTestId('momento-respuesta'))).toContainText('Lo contrataron en la panadería.');
  await expect(v(page.getByTestId('momento-peticion'))).toContainText('Trabajo para papá');
});

test('las oraciones viajan en la cuenta a otro dispositivo', async ({ page, request, browser }) => {
  const ana = await cuentaNueva(request, 'Ana Oración');
  await page.addInitScript(() => {
    if (sessionStorage.getItem('sembrado')) return;
    sessionStorage.setItem('sembrado', '1');
    const oracion = {
      id: 'o1',
      titulo: 'Salud de mamá',
      created: Date.now() - 40 * 86_400_000,
      versiculos: [{ book: 'isa', chapter: 41, verse: 10, reference: 'Isaías 41:10', text: 'No temas, que yo soy contigo', added: 1 }],
    };
    localStorage.setItem('oraciones', JSON.stringify([oracion]));
  });
  await conSesion(page, ana);
  await page.goto('/cuenta');
  await expect(page.getByTestId('progreso-cuenta')).toContainText('1 oración');
  await expect(page.getByTestId('progreso-cuenta')).toContainText('Todo guardado en tu cuenta');

  const otro = await browser.newContext();
  const page2 = await otro.newPage();
  await conSesion(page2, ana);
  await page2.goto('/diario?vista=oraciones');
  await expect(v(page2.getByTestId('oracion'))).toContainText('Salud de mamá');
  await expect(v(page2.getByTestId('oracion'))).toContainText('ORANDO DESDE EL');
  await expect(v(page2.getByTestId('oracion'))).toContainText('Isaías 41:10');
  await otro.close();
});
