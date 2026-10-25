// Compartir un versículo como imagen: fondos ilustrados, letras, palabras destacadas, dedicatoria y palabra original.
// La imagen descargada sale del canvas; la publicada en Comunidad se dibuja igual en el muro del amigo.

import type { APIRequestContext } from '@playwright/test';

import { type Cuenta, conSesion, cuentaNueva, expect, test } from './support/fixtures';

async function api(request: APIRequestContext, cuenta: Cuenta, accion: string, body: Record<string, unknown> = {}) {
  const res = await request.post('/api/comunidades', {
    headers: { Authorization: `Bearer ${cuenta.llave}` },
    data: { accion, ...body },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

test('la imagen se arma con fondo, letra, dedicatoria y palabra original, y se descarga', async ({ page }) => {
  await page.goto('/juan/3');
  await page.getByText('Porque de tal manera amó Dios al mundo').click();
  await page.getByRole('button', { name: 'Compartir', exact: true }).click();
  await expect(page.getByText('Compartir Juan 3:16')).toBeVisible();

  await page.getByRole('radio', { name: 'Fondo Estrellas' }).click();
  await expect(page.getByRole('radio', { name: 'Fondo Estrellas' })).toBeChecked();
  await page.getByRole('tab', { name: 'Letra' }).click();
  await page.getByRole('radio', { name: 'Letra A mano' }).click();
  await expect(page.getByRole('radio', { name: 'Letra A mano' })).toBeChecked();

  await page.getByRole('tab', { name: 'Dedicar' }).click();
  await expect(page.getByText('¿A quién le hace falta hoy este versículo?')).toBeVisible();
  await page.getByRole('radio', { name: 'Oré por ti hoy' }).click();
  await expect(page.getByLabel('Dedicatoria')).toHaveValue('Oré por ti hoy');
  await expect(page.getByText('Oré por ti hoy', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar imagen' })).toBeVisible();

  await page.getByRole('tab', { name: 'Original' }).click();
  await page.getByRole('radio', { name: /amó/ }).click();
  await expect(page.getByText('ēgapēsen · amó')).toBeVisible();

  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByText('Descargar', { exact: true }).click()]);
  expect(descarga.suggestedFilename()).toBe('juan-3-16.png');
  await expect(page.getByText('Imagen descargada')).toBeVisible();

  // El fondo y la letra quedan recordados para la próxima vez.
  await page.reload();
  await page.getByText('Porque de tal manera amó Dios al mundo').click();
  await page.getByRole('button', { name: 'Compartir', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Fondo Estrellas' })).toBeChecked();
});

test('la imagen publicada en Comunidad lleva su dedicatoria y su palabra original al muro del amigo', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Comparte');
  const beto = await cuentaNueva(request, 'Beto Recibe');
  await api(request, ana, 'pedirAmistad', { usuario: beto.usuario.id });
  await api(request, beto, 'pedirAmistad', { usuario: ana.usuario.id });

  const pa = await (await browser.newContext()).newPage();
  await conSesion(pa, ana);
  await pa.goto('/juan/3');
  await pa.getByText('Porque de tal manera amó Dios al mundo').click();
  await pa.getByRole('button', { name: 'Compartir', exact: true }).click();
  await pa.getByRole('radio', { name: 'Fondo Olivo' }).click();
  await pa.getByRole('tab', { name: 'Dedicar' }).click();
  await pa.getByLabel('Dedicatoria').fill('Para Beto, me acordé de ti');
  await pa.getByRole('tab', { name: 'Original' }).click();
  await pa.getByRole('radio', { name: /amó/ }).click();
  await pa.getByText('Publicar en Comunidad').click();
  await pa.getByRole('radio', { name: 'Mis amigos' }).click();
  await pa.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(pa.getByText('Publicado en Comunidad')).toBeVisible();

  const pb = await (await browser.newContext()).newPage();
  await conSesion(pb, beto);
  await pb.goto('/comunidades');
  await expect(pb.getByText('Para Beto, me acordé de ti')).toBeVisible();
  await expect(pb.getByText('ēgapēsen · amó')).toBeVisible();

  await pa.context().close();
  await pb.context().close();
});
