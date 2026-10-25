import { conSesion, cuentaNueva, expect, test, type Cuenta } from './support/fixtures';

// Una iglesia se postula, alguien de Cuidar Zarza la revisa y la aprueba, y quien la postuló queda de encargado.
// Quien cuida en las pruebas es cuidar-e2e@prueba.test (CUIDADORES en e2e/support/server.ts).

async function cuidadora(request: import('@playwright/test').APIRequestContext): Promise<Cuenta> {
  const datos = { correo: 'cuidar-e2e@prueba.test', clave: 'clave-segura-1' };
  const r = await request.post('/api/comunidades', { data: { accion: 'registrarse', nombre: 'Cuidadora', ...datos } });
  if (r.ok()) return (await r.json()) as Cuenta;
  const e = await request.post('/api/comunidades', { data: { accion: 'entrar', ...datos } });
  expect(e.ok()).toBeTruthy();
  return (await e.json()) as Cuenta;
}

test.describe('Iglesias anfitrionas', () => {
  test('postular, revisar en Cuidar Zarza, aprobar y ser encargado', async ({ page, browser, request }) => {
    const pastor = await cuentaNueva(request, 'Pastor Pablo');
    await conSesion(page, pastor);
    await page.goto('/iglesia');
    await page.getByTestId('ir-postular').click();
    await expect(page.getByText('Postula tu iglesia')).toBeVisible();

    const nombre = `Iglesia La Roca ${Date.now()}`;
    await page.getByPlaceholder('Iglesia Bautista La Roca').fill(nombre);
    await page.getByPlaceholder('Cali, Colombia').fill('Cali, Colombia');
    await page.getByPlaceholder('facebook.com/tu-iglesia').fill('facebook.com/larocacali');
    await page.getByPlaceholder('Para confirmar que existe').fill('+57 300 000 0000');
    const enviar = page.getByRole('button', { name: 'Enviar postulación' });
    await expect(enviar).toBeDisabled();
    await page.getByTestId('declaracion-fe').click();
    await enviar.click();
    await expect(page.getByText(`${nombre} está en revisión`)).toBeVisible();

    // Quien cuida la ve con sus datos y la aprueba
    const cuida = await (await browser.newContext()).newPage();
    await conSesion(cuida, await cuidadora(request));
    await cuida.goto('/cuidar');
    await cuida.getByText('Iglesias', { exact: true }).click();
    const tarjeta = cuida.getByTestId('postulacion').filter({ hasText: nombre });
    await expect(tarjeta).toContainText('+57 300 000 0000');
    await expect(tarjeta).toContainText('Pastor Pablo');
    cuida.on('dialog', (d) => d.accept());
    await tarjeta.getByRole('button', { name: 'Aprobar' }).click();
    await expect(cuida.getByText(nombre).first()).toBeVisible();
    await expect(cuida.getByTestId('postulacion').filter({ hasText: nombre })).toHaveCount(0);

    // El pastor ya tiene su iglesia, su QR y el panel de encargado
    await page.goto('/iglesia');
    await expect(page.getByText('TU IGLESIA ANFITRIONA')).toBeVisible();
    await expect(page.getByTestId('encargo')).toContainText('ERES SU ENCARGADO');
    await expect(page.getByTestId('encargo')).toContainText('entraron esta semana');
    await page.goto('/iglesia/postular');
    await expect(page.getByText('Tu iglesia ya es anfitriona')).toBeVisible();
  });
});
