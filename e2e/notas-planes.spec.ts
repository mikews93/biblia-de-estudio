import type { Locator } from '@playwright/test';

import { expect, test, type Page } from './support/fixtures';

// Herramientas personales que se guardan en el dispositivo: resaltados, notas y planes de lectura.

/** La pila de pantallas deja las anteriores en el DOM, ocultas: solo cuentan las visibles. */
const v = (l: Locator) => l.filter({ visible: true });

/** Toca un versículo en el lector (modo párrafo) por un trozo de su texto. */
const tocarVersiculo = (page: Page, texto: string) => v(page.getByText(texto, { exact: false })).last().click();

test.describe('Resaltados y notas', () => {
  test('resaltar y anotar un versículo, encontrarlo en «Mis resaltados y notas», editar y borrar la nota', async ({ page }) => {
    await page.goto('/juan/3');
    const barra = v(page.getByText('Juan 3:16', { exact: true }));

    // Resaltar Juan 3:16 en amarillo
    await tocarVersiculo(page, 'Porque de tal manera amó Dios al mundo');
    await expect(barra).toBeVisible();
    await v(page.getByRole('button', { name: 'Resaltar en amarillo' })).click();
    await expect(barra).toBeHidden(); // al pintar se quita la selección

    // Escribir una nota en el mismo versículo
    await tocarVersiculo(page, 'Porque de tal manera amó Dios al mundo');
    await expect(v(page.getByRole('button', { name: 'Quitar resaltado amarillo' }))).toBeVisible();
    await v(page.getByRole('button', { name: 'Nota', exact: true })).click();
    await expect(v(page.getByText('Mi nota · Juan 3:16'))).toBeVisible();
    await v(page.getByLabel('Texto de la nota')).fill('Dios me amó primero.');
    await v(page.getByRole('button', { name: 'Guardar' })).click();
    await expect(v(page.getByLabel('Tiene nota'))).toHaveCount(1);
    await expect(v(page.getByRole('button', { name: 'Mi nota' }))).toBeVisible();

    // Otro versículo, solo resaltado en verde
    await v(page.getByLabel('Quitar selección')).click();
    await tocarVersiculo(page, 'el que no naciere otra vez, no puede ver');
    await expect(v(page.getByText('Juan 3:3', { exact: true }))).toBeVisible();
    await v(page.getByRole('button', { name: 'Resaltar en verde' })).click();

    // Todo aparece en «Mis resaltados y notas», también tras recargar
    await page.goto('/notas');
    await page.reload();
    const item316 = v(page.getByRole('link', { name: /Juan 3:16/ }));
    const item33 = v(page.getByRole('link', { name: /Juan 3:3/ }));
    await expect(item316).toBeVisible();
    await expect(item316).toContainText('Porque de tal manera amó Dios');
    await expect(item33).toBeVisible();
    await expect(v(page.getByLabel('Editar nota'))).toHaveText('Dios me amó primero.');

    // Filtros: solo notas, solo verde
    await v(page.getByRole('radio', { name: 'Notas (1)' })).click();
    await expect(item316).toBeVisible();
    await expect(item33).toBeHidden();
    await v(page.getByRole('radio', { name: '● Verde' })).click();
    await expect(item33).toBeVisible();
    await expect(item316).toBeHidden();
    await v(page.getByRole('radio', { name: 'Todo' })).click();

    // Editar la nota desde la lista
    await v(page.getByLabel('Editar nota')).click();
    await expect(v(page.getByLabel('Texto de la nota'))).toHaveValue('Dios me amó primero.');
    await v(page.getByLabel('Texto de la nota')).fill('Dios me amó primero; quiero amar así.');
    await v(page.getByRole('button', { name: 'Guardar' })).click();
    await expect(v(page.getByLabel('Editar nota'))).toHaveText('Dios me amó primero; quiero amar así.');
    // Lo editado va primero: es lo más reciente
    await expect(v(page.getByRole('link')).first()).toContainText('Juan 3:16');

    // Abrir el versículo desde la lista: el lector lo marca y muestra la nota
    await item316.click();
    await expect(page).toHaveURL(/\/juan\/3\/16$/);
    await expect(v(page.getByText('Juan 3:16', { exact: true }))).toBeVisible();
    await expect(v(page.getByRole('button', { name: 'Mi nota' }))).toBeVisible();
    await v(page.getByRole('button', { name: 'Mi nota' })).click();
    await expect(v(page.getByLabel('Texto de la nota'))).toHaveValue('Dios me amó primero; quiero amar así.');

    // Borrar la nota: el resaltado se queda
    await v(page.getByRole('button', { name: 'Borrar' })).click();
    await expect(v(page.getByLabel('Tiene nota'))).toHaveCount(0);
    await page.goto('/notas');
    await expect(v(page.getByRole('radio', { name: 'Notas (0)' }))).toBeVisible();
    await expect(v(page.getByLabel('Editar nota'))).toHaveCount(0);
    await expect(item316).toBeVisible();

    // Quitar los dos resaltados deja la lista vacía
    await page.goto('/juan/3/16');
    await v(page.getByRole('button', { name: 'Quitar resaltado amarillo' })).click();
    await page.goto('/juan/3/3');
    await v(page.getByRole('button', { name: 'Quitar resaltado verde' })).click();
    await page.goto('/notas');
    await expect(v(page.getByText('Aún no hay nada aquí'))).toBeVisible();
  });
});

test.describe('Planes de lectura', () => {
  test('empezar un plan, leer lo de hoy, ver el avance en el plan y en Hoy, y dejarlo', async ({ page }) => {
    await page.goto('/planes');
    await v(page.getByRole('button', { name: /Marcos, la vida de Jesús/ })).click();
    await expect(page).toHaveURL(/\/planes\/marcos$/);

    // Configurar: 5 minutos al día, 7 días a la semana
    await v(page.getByRole('radio', { name: '5 min', exact: true })).click();
    await v(page.getByRole('radio', { name: 'Todos' })).click();
    const resumen = v(page.getByText(/16 capítulos en \d+ días de lectura/));
    await expect(resumen).toBeVisible();
    const dias = Number((await resumen.textContent())!.match(/en (\d+) días/)![1]);
    await v(page.getByRole('button', { name: 'Empezar el plan' })).click();

    // El plan empieza en el día 1
    await expect(v(page.getByText(`0 de ${dias} día`))).toBeVisible();
    await expect(v(page.getByText('DÍA 1', { exact: true })).first()).toBeVisible();
    await expect(v(page.getByText(/^Marcos 1 · \d+ min$/)).first()).toBeVisible();

    // Leer lo de hoy y marcarlo como terminado
    await v(page.getByRole('button', { name: 'Leer lo de hoy' })).click();
    await expect(page).toHaveURL(/\/marcos\/1$/);
    await v(page.getByRole('button', { name: 'Terminé este capítulo' })).click();
    await expect(v(page.getByText('Capítulo leído'))).toBeVisible();
    await expect(v(page.getByText(/Marcos, la vida de Jesús: 1 de 16/))).toBeVisible();

    // Hoy muestra el día siguiente del plan, también tras recargar
    await page.goto('/');
    await page.reload();
    await expect(v(page.getByText(`1 de ${dias} día`))).toBeVisible();
    await expect(v(page.getByText('DÍA 2', { exact: true }))).toBeVisible();
    await expect(v(page.getByText(/^Marcos 2 · \d+ min$/))).toBeVisible();

    // En el plan: un día con la Palabra y el día 1 marcado
    await page.goto('/planes');
    await expect(v(page.getByText('Tus planes'))).toBeVisible();
    await v(page.getByText('Marcos, la vida de Jesús')).first().click();
    await expect(page).toHaveURL(/\/planes\/marcos$/);
    await expect(v(page.getByText('día con la Palabra'))).toBeVisible();
    await expect(v(page.getByText(`1 de ${dias} día`))).toBeVisible();

    // Dejar el plan (confirmando) vuelve a la configuración y lo quita de «Tus planes»
    page.once('dialog', (d) => void d.accept());
    await v(page.getByRole('button', { name: 'Dejar este plan' })).click();
    await expect(v(page.getByRole('button', { name: 'Empezar el plan' }))).toBeVisible();
    await page.goto('/planes');
    await expect(v(page.getByRole('button', { name: /Marcos, la vida de Jesús/ }))).toBeVisible();
    await expect(v(page.getByText('Tus planes'))).toBeHidden();

    // Volver a empezarlo arranca de cero
    await v(page.getByRole('button', { name: /Marcos, la vida de Jesús/ })).click();
    await v(page.getByRole('button', { name: 'Empezar el plan' })).click();
    await expect(v(page.getByText(/^0 de \d+ días?$/))).toBeVisible();
  });

  test('terminar un plan propio de un libro corto lo pasa a «Terminados»', async ({ page }) => {
    await page.goto('/planes');
    await v(page.getByText('Un libro que tú elijas')).click();
    await v(page.getByText('Rut', { exact: true })).click();
    await expect(page).toHaveURL(/\/planes\/libro-rut$/);
    await v(page.getByRole('radio', { name: '30 min' })).click();
    await v(page.getByRole('button', { name: 'Empezar el plan' })).click();
    await expect(v(page.getByText(/^0 de \d+ días?$/))).toBeVisible();

    // Leer los cuatro capítulos seguidos desde el lector
    await v(page.getByRole('button', { name: 'Leer lo de hoy' })).click();
    for (const cap of [1, 2, 3, 4]) {
      await expect(page).toHaveURL(new RegExp(`/rut/${cap}$`));
      await v(page.getByRole('button', { name: 'Terminé este capítulo' })).click();
      await expect(v(page.getByText('Capítulo leído'))).toBeVisible();
      if (cap < 4) {
        await expect(v(page.getByText(`Rut: ${cap} de 4`, { exact: false }))).toBeVisible();
        await v(page.getByText(`Rut ${cap + 1} ›`)).click();
      }
    }
    await expect(v(page.getByText('¡Terminaste el plan «Rut»! Ver tu recorrido ›'))).toBeVisible();
    await v(page.getByText('¡Terminaste el plan «Rut»! Ver tu recorrido ›')).click();
    await expect(page).toHaveURL(/\/planes\/libro-rut$/);
    await expect(v(page.getByText(/Terminado el/))).toBeVisible();

    // En la lista de planes ya no está en curso, sino terminado; y Hoy no lo ofrece
    await page.goto('/planes');
    await expect(v(page.getByText('Terminados'))).toBeVisible();
    await expect(v(page.getByText('Tus planes'))).toBeHidden();
    await page.goto('/');
    await expect(v(page.getByRole('button', { name: 'Leer lo de hoy' }))).toHaveCount(0);
  });
});
