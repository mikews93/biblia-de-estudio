import type { Locator } from '@playwright/test';

import { conSesion, cuentaNueva, expect, test, type Page } from './support/fixtures';

// El progreso guardado en la cuenta (src/lib/sincronia.ts y api/sincronizar.ts): lo que se hizo en un
// dispositivo aparece en otro al entrar con la misma cuenta.

const v = (l: Locator) => l.filter({ visible: true });

/** Deja datos en el dispositivo antes de que cargue la app (solo la primera vez: al recargar no se pisan). */
async function enElDispositivo(page: Page, datos: Record<string, unknown>) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem('sembrado')) return;
    sessionStorage.setItem('sembrado', '1');
    for (const [k, val] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(val));
  }, datos);
}

const hoy = () => new Date().toISOString().slice(0, 10);

test('sin cuenta, Hoy invita a guardar el progreso', async ({ page }) => {
  await enElDispositivo(page, { progreso: { chapters: { jhn: [1, 2, 3] }, days: [hoy()] } });
  await page.goto('/');
  const invitacion = page.getByTestId('invitacion-cuenta');
  await expect(invitacion).toContainText('Ya leíste 3 capítulos.');
  await invitacion.getByRole('button', { name: 'Ahora no' }).click();
  await expect(invitacion).toBeHidden();
  await page.reload();
  await expect(page.getByText('Versículo del día')).toBeVisible();
  await expect(page.getByTestId('invitacion-cuenta')).toBeHidden();
});

test('lo del teléfono pasa a la cuenta y aparece en otro dispositivo', async ({ page, request, browser }) => {
  const ana = await cuentaNueva(request, 'Ana Sincronía');
  await enElDispositivo(page, {
    progreso: { chapters: { rom: [8], jhn: [3] }, days: [hoy()] },
    notas: { 'rom.8.28': { text: 'Todo ayuda a bien.', created: 1, updated: 2 } },
    resaltados: { 'rom.8.28': { color: 'amarillo', at: 2 } },
    'ultima-lectura': { book: 'rom', chapter: 8 },
    ajustes: { theme: 'sepia' },
  });
  await conSesion(page, ana);
  await page.goto('/cuenta');
  await expect(page.getByTestId('aviso-sincronia')).toHaveText('Tu progreso quedó guardado en tu cuenta');
  const tarjeta = page.getByTestId('progreso-cuenta');
  await expect(tarjeta).toContainText('Todo guardado en tu cuenta');
  await expect(tarjeta).toContainText('2capítulos leídos');
  await expect(tarjeta).toContainText('2notas y resaltados');

  // En otro dispositivo, al entrar con la misma cuenta, llega todo.
  const otro = await browser.newContext();
  const page2 = await otro.newPage();
  await conSesion(page2, ana);
  await page2.goto('/');
  await expect(page2.getByTestId('aviso-sincronia')).toHaveText('Trajimos tu progreso de la cuenta');
  await expect(page2.getByText('Romanos 8')).toBeVisible();
  await expect(page2.getByTestId('nube-estado')).toBeVisible();
  await expect(page2.getByRole('button', { name: 'Tu perfil · Guardado en tu cuenta' })).toBeVisible();
  await page2.goto('/notas');
  await expect(v(page2.getByLabel('Editar nota'))).toHaveText('Todo ayuda a bien.');

  // Lo que se cambia en el segundo dispositivo vuelve al primero.
  await v(page2.getByLabel('Editar nota')).click();
  await v(page2.getByLabel('Texto de la nota')).fill('Todo ayuda a bien a los que aman a Dios.');
  const guardado = page2.waitForResponse((r) => r.url().includes('/api/sincronizar') && r.request().postData()!.includes('a los que aman'));
  await v(page2.getByRole('button', { name: 'Guardar' })).click();
  await guardado;
  await otro.close();

  await page.goto('/notas');
  await expect(v(page.getByLabel('Editar nota'))).toHaveText('Todo ayuda a bien a los que aman a Dios.');
});
