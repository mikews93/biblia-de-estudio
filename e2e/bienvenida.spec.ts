import { expect, test } from './support/fixtures';

// La bienvenida de la primera vez (src/components/Bienvenida.tsx), «Todo en Zarza» (/todo) y los avisos de fallos
// (src/lib/errores.ts → /cuidar). En las pruebas la bienvenida no sale sola: se pide con ?bienvenida=1.

test('la bienvenida elige versión, meta y letra, y lleva a la meta elegida', async ({ page }) => {
  await page.goto('/?bienvenida=1');
  await expect(page.getByText('Te damos la bienvenida a Zarza')).toBeVisible();

  await page.getByRole('radio', { name: /La Biblia en Español Sencillo/ }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();

  await expect(page.getByText('¿Qué te gustaría hacer?')).toBeVisible();
  await page.getByRole('radio', { name: /Orar y escribir/ }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();

  await expect(page.getByText('Que se lea bien')).toBeVisible();
  await page.getByRole('button', { name: 'Letra más grande' }).click();
  await page.getByRole('radio', { name: 'Oscuro' }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();

  await expect(page).toHaveURL(/\/diario$/);
  const ajustes = await page.evaluate(() => JSON.parse(localStorage.getItem('ajustes') ?? '{}'));
  expect(ajustes).toMatchObject({ version: 'bes', theme: 'oscuro', fontSize: 20 });

  // Ya vista, no vuelve a salir.
  await page.goto('/?bienvenida=1');
  await expect(page.getByText('Tu semana')).toBeVisible();
  await expect(page.getByText('Te damos la bienvenida a Zarza')).toHaveCount(0);
});

test('«Saltar» cierra la bienvenida sin cambiar nada', async ({ page }) => {
  await page.goto('/?bienvenida=1');
  await page.getByRole('button', { name: 'Saltar la bienvenida' }).click();
  await expect(page.getByText('Te damos la bienvenida a Zarza')).toHaveCount(0);
  await expect(page).toHaveURL(/\/\?bienvenida=1$/);
});

test('«Todo en Zarza» ordena las funciones y las busca sin tildes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Todo en Zarza' }).click();
  await expect(page).toHaveURL(/\/todo$/);
  await expect(page.getByText('ENSEÑAR Y PREDICAR')).toBeVisible();

  await page.getByLabel('Buscar una función').fill('genealogias');
  await expect(page.getByRole('link', { name: /Genealogías/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Taller/ })).toHaveCount(0);

  await page.getByLabel('Buscar una función').fill('sermon');
  await page.getByRole('link', { name: /Del sermón a tu semana/ }).click();
  await expect(page).toHaveURL(/\/semana$/);
});

test('un fallo de la app llega a «Cuidar Zarza» sin datos de la persona', async ({ page, request }) => {
  const marca = Math.random().toString(36).replace(/[\d.]/g, '').slice(0, 8);
  await page.goto('/todo');
  await expect(page.getByRole('heading', { name: 'Todo en Zarza' })).toBeVisible();
  await page.evaluate((m) => {
    setTimeout(() => {
      throw new Error(`Fallo e2e ${m} de ana@correo.com`);
    });
  }, marca);

  const correo = 'cuidar-e2e@prueba.test';
  let llave = (await (await request.post('/api/comunidades', { data: { accion: 'entrar', correo, clave: 'clave-segura-1' } })).json()).llave;
  llave ??= (await (await request.post('/api/comunidades', { data: { accion: 'registrarse', nombre: 'Cuida', correo, clave: 'clave-segura-1' } })).json()).llave;

  await expect
    .poll(async () => {
      const r = await request.post('/api/comunidades', { data: { accion: 'cuidarErrores' }, headers: { Authorization: `Bearer ${llave}` } });
      const { errores } = (await r.json()) as { errores: { mensaje: string; ruta: string; plataforma: string }[] };
      return errores.find((e) => e.mensaje.includes(marca)) ?? null;
    })
    .toMatchObject({ mensaje: `Fallo e2e ${marca} de [correo]`, ruta: '/todo', plataforma: 'web' });
});

test('«Reportar un problema» llega a «Cuidar Zarza» con el correo para responder', async ({ page, request }) => {
  const marca = Math.random().toString(36).replace(/[\d.]/g, '').slice(0, 8);
  await page.goto('/acerca');
  const enviar = page.getByRole('button', { name: 'Enviar' });
  await expect(enviar).toBeDisabled();
  await page.getByLabel('Qué pasó', { exact: true }).fill(`El botón de compartir no responde ${marca}`);
  await page.getByLabel('Tu correo, si quieres respuesta').fill('no-es-correo');
  await enviar.click();
  await expect(page.getByText('Ese correo no parece válido.')).toBeVisible();
  await page.getByLabel('Tu correo, si quieres respuesta').fill('ana@correo.test');
  await enviar.click();
  await expect(page.getByText('Gracias, ya nos llegó')).toBeVisible();

  const correo = 'cuidar-e2e@prueba.test';
  let llave = (await (await request.post('/api/comunidades', { data: { accion: 'entrar', correo, clave: 'clave-segura-1' } })).json()).llave;
  llave ??= (await (await request.post('/api/comunidades', { data: { accion: 'registrarse', nombre: 'Cuida', correo, clave: 'clave-segura-1' } })).json()).llave;
  const r = await request.post('/api/comunidades', { data: { accion: 'cuidarErrores' }, headers: { Authorization: `Bearer ${llave}` } });
  const { reportes } = (await r.json()) as { reportes: { texto: string; contacto: string; plataforma: string; resuelto: boolean }[] };
  expect(reportes.find((x) => x.texto.includes(marca))).toMatchObject({ contacto: 'ana@correo.test', plataforma: 'web', resuelto: false });
});
