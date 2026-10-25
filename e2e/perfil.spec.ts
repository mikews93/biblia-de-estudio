// El perfil: los datos que ven los demás, la foto y entrar o conectar la cuenta con Facebook por Auth.js (el
// simulado de e2e/support/mock-facebook.ts).

import path from 'node:path';

import { conSesion, cuentaNueva, expect, test } from './support/fixtures';

const FOTO = path.resolve('assets/icon.png');

test('el perfil se abre desde Hoy, con la foto cuando la hay', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tu perfil' }).click();
  await expect(page).toHaveURL(/\/cuenta$/);

  const ana = await cuentaNueva(request, 'Ana');
  await conSesion(page, ana);
  await page.goto('/');
  await page.getByRole('button', { name: 'Tu perfil' }).click();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
});

test('editar el perfil: lo que escribes lo ve otra persona en tu perfil', async ({ page, request, browser }) => {
  const ana = await cuentaNueva(request, 'Ana Profetisa');
  await conSesion(page, ana);
  await page.goto('/cuenta');

  const guardar = page.getByRole('button', { name: 'Guardar cambios' });
  await expect(guardar).toBeDisabled();
  await page.getByPlaceholder('Por ejemplo: aprendiendo a leer la Biblia con mi familia').fill('Sirvo en el templo de día y de noche');
  await expect(page.getByText('36/160')).toBeVisible();
  await page.getByPlaceholder('Opcional').first().fill('Templo de Jerusalén');
  await page.getByPlaceholder('Opcional').last().fill('Jerusalén');
  await guardar.click();
  await expect(page.getByText('Perfil guardado')).toBeVisible();
  await expect(page.getByText('Templo de Jerusalén · Jerusalén')).toBeVisible();

  const simeon = await cuentaNueva(request, 'Simeón');
  const otro = await browser.newContext();
  const page2 = await otro.newPage();
  await conSesion(page2, simeon);
  await page2.goto(`/comunidades/persona/${ana.usuario.id}`);
  await expect(page2.getByText('Sirvo en el templo de día y de noche')).toBeVisible();
  await expect(page2.getByText('Templo de Jerusalén')).toBeVisible();
  await expect(page2.getByText('Jerusalén', { exact: true })).toBeVisible();
  await otro.close();
});

test('poner una foto, verla en la comunidad y quitarla', async ({ page, request }) => {
  page.on('dialog', (d) => d.accept());
  const ana = await cuentaNueva(request, 'Lidia');
  await conSesion(page, ana);
  await page.goto('/cuenta');

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Poner foto', exact: true }).click();
  await (await chooser).setFiles(FOTO);
  await expect(page.getByText('Foto actualizada')).toBeVisible();
  const foto = page.locator('img[src*="/fotos-prueba/"]');
  await expect(foto.first()).toBeVisible();

  // La foto sale también en la cabecera de Comunidad.
  await page.goto('/comunidades');
  await expect(page.locator('img[src*="/fotos-prueba/"]').first()).toBeVisible();

  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Quitar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Poner foto', exact: true })).toBeVisible();
  await expect(page.locator('img[src*="/fotos-prueba/"]')).toHaveCount(0);
});

test('entrar con Facebook crea la cuenta con su nombre y su foto', async ({ page }) => {
  const nombre = `Priscila ${Date.now().toString(36)}`;
  await page.goto('/entrar');
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Continuar con Facebook' }).click();
  const fb = await popup;
  await fb.getByLabel('Tu nombre en Facebook').fill(nombre);
  await fb.getByRole('button', { name: 'Continuar como en Facebook' }).click();

  // La ventana de Facebook se cierra sola y la app sigue con la cuenta ya abierta.
  await expect(page.getByText('Pregúntale algo a la comunidad…')).toBeVisible();
  await page.goto('/cuenta');
  await expect(page.getByText(`Conectado como ${nombre}`)).toBeVisible();
  await expect(page.getByRole('textbox').first()).toHaveValue(nombre);
  await expect(page.locator('img[src*="/fotos-prueba/"]').first()).toBeVisible();
});

test('conectar Facebook desde el perfil y cancelar en Facebook', async ({ page, request }) => {
  const ana = await cuentaNueva(request, 'Febe');
  await conSesion(page, ana);
  await page.goto('/cuenta');
  await expect(page.getByText('Facebook', { exact: true })).toBeVisible();

  let popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  let fb = await popup;
  await fb.getByRole('link', { name: 'Cancelar' }).click();
  await expect(page.getByText('No se conectó con Facebook.')).toBeVisible();

  popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  fb = await popup;
  await fb.getByLabel('Tu nombre en Facebook').fill(`Febe de Cencrea ${Date.now().toString(36)}`);
  await fb.getByRole('button', { name: 'Continuar como en Facebook' }).click();
  await expect(page.getByText('Facebook quedó conectado')).toBeVisible();
  await expect(page.getByText(/^Conectado como Febe de Cencrea/)).toBeVisible();
});
