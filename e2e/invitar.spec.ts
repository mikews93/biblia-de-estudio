// Invitar amigos a Zarza con un enlace (zarzabiblia.com/i/CODIGO): quien lo abre conoce la app sin cuenta y, al
// crear la suya, queda como amigo de quien lo compartió; quien invitó lo ve en «Se unieron con tu enlace».

import { conSesion, correoUnico, cuentaNueva, expect, test } from './support/fixtures';

async function codigoDe(request: Parameters<typeof cuentaNueva>[0], llave: string) {
  const res = await request.post('/api/comunidades', { data: { accion: 'amigos' }, headers: { Authorization: `Bearer ${llave}` } });
  return (await res.json()).codigo as string;
}

test('la pantalla de invitar muestra el enlace de zarzabiblia.com y el mensaje elegido', async ({ page, request }) => {
  const ana = await cuentaNueva(request, 'Ana Invita');
  const codigo = await codigoDe(request, ana.llave);
  await conSesion(page, ana);
  await page.goto('/comunidades');
  await page.getByTestId('entrada-invitar').click();
  await expect(page).toHaveURL(/\/invitar$/);
  await expect(page.getByTestId('enlace-invitar')).toHaveText(`zarzabiblia.com/i/${codigo}`);
  await page.getByRole('radio', { name: 'Para un grupo' }).click();
  await expect(page.getByTestId('mensaje-invitar')).toContainText(`Únanse con mi enlace: https://zarzabiblia.com/i/${codigo}`);
  await page.getByRole('button', { name: /En persona/ }).click();
  await expect(page.getByLabel(`Código QR de https://zarzabiblia.com/i/${codigo}`)).toBeVisible();
  await expect(page.getByText('Aquí verás a quienes se unan a Zarza con tu enlace.', { exact: false })).toBeVisible();
});

test('quien abre el enlace sin cuenta crea la suya y queda como amigo', async ({ page, request }) => {
  const ana = await cuentaNueva(request, 'Ana Anfitriona');
  const codigo = await codigoDe(request, ana.llave);

  await page.goto(`/i/${codigo}`);
  await expect(page.getByTestId('invitacion-titulo')).toHaveText(`${ana.usuario.nombre} te invita a leer la Biblia en Zarza`);
  await expect(page.getByText('QUÉ ENCUENTRAS EN ZARZA')).toBeVisible();
  await page.getByRole('button', { name: 'Crear cuenta gratis' }).click();
  await page.getByPlaceholder('Así te verán tus grupos y amigos').fill('Beto Invitado');
  await page.getByPlaceholder('tu@correo.com').fill(correoUnico('Beto'));
  await page.getByPlaceholder('Elige una contraseña').fill('clave-segura-1');
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();

  // Vuelve a la invitación, que ya dice que son amigos.
  await expect(page).toHaveURL(new RegExp(`/i/${codigo}$`));
  await expect(page.getByText('YA SON AMIGOS')).toBeVisible();

  await conSesion(page, ana);
  await page.goto('/invitar');
  await expect(page.getByText('SE UNIERON CON TU ENLACE · 1')).toBeVisible();
  await expect(page.getByRole('link', { name: /Beto Invitado/ })).toBeVisible();
});

test('si se pone a leer sin cuenta, la amistad se hace cuando la crea más tarde', async ({ page, request }) => {
  const ana = await cuentaNueva(request, 'Ana Paciente');
  const codigo = await codigoDe(request, ana.llave);
  await page.goto(`/i/${codigo}`);
  await page.getByRole('link', { name: 'O empieza a leer sin cuenta ›' }).click();
  await expect(page).toHaveURL(/\/$/);

  const carla = await cuentaNueva(request, 'Carla Tarde');
  await conSesion(page, carla);
  await page.goto('/comunidades');
  await expect(page).toHaveURL(new RegExp(`/i/${codigo}$`));
  await expect(page.getByText('YA SON AMIGOS')).toBeVisible();
});

test('el enlace propio y uno que no existe', async ({ page, request }) => {
  const ana = await cuentaNueva(request, 'Ana Sola');
  const codigo = await codigoDe(request, ana.llave);
  await conSesion(page, ana);
  await page.goto(`/i/${codigo}`);
  await expect(page.getByTestId('invitacion-titulo')).toHaveText('Este es tu enlace de invitación');
  await page.goto('/i/ZZZZZZZZ');
  await expect(page.getByText('Este enlace ya no funciona')).toBeVisible();
});
