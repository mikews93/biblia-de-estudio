import type { Locator } from '@playwright/test';

import { conSesion, cuentaNueva, expect, test, type Page } from './support/fixtures';

// Notificaciones push de la web. El servicio push del navegador (Google, Apple…) no existe en las pruebas: el
// PushManager se sustituye por uno que pide la suscripción al servicio simulado (e2e/support/mock-push.ts),
// y ese servicio descifra lo que manda /api/notificaciones para comprobarlo.

const v = (l: Locator) => l.filter({ visible: true });

async function pushSimulado(page: Page, inicial: NotificationPermission = 'default') {
  await page.addInitScript((inicial) => {
    // Chromium sin ventana responde «denied» siempre: el permiso también se simula.
    let permission: NotificationPermission = inicial;
    Object.defineProperty(Notification, 'permission', { get: () => permission });
    Notification.requestPermission = async () => (permission = 'granted');
    let current: unknown = null;
    const fake = (j: { endpoint: string; keys: Record<string, string> }) => ({
      endpoint: j.endpoint,
      options: { applicationServerKey: null },
      toJSON: () => ({ endpoint: j.endpoint, keys: j.keys }),
      unsubscribe: async () => {
        current = null;
        return true;
      },
    });
    PushManager.prototype.getSubscription = async () => current as PushSubscription | null;
    PushManager.prototype.subscribe = async () => {
      current = fake(await (await fetch('/__push/nueva')).json());
      return current as PushSubscription;
    };
  }, inicial);
}

type Entrega = { id: string; aviso: { title: string; body: string; url: string } | null };

async function entregaA(page: Page, endpoint: string) {
  const id = endpoint.split('/').pop();
  let found: Entrega | undefined;
  await expect
    .poll(async () => {
      const all = (await (await page.request.get('/__push')).json()) as Entrega[];
      found = all.find((e) => e.id === id);
      return Boolean(found);
    })
    .toBe(true);
  return found!;
}

const endpointGuardado = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('avisos') ?? '{}') as { endpoint?: string }).endpoint ?? '');

test.describe('Notificaciones', () => {
  test('elegir la hora, activarlas y recibir la de prueba', async ({ page }) => {
    await pushSimulado(page);
    await page.goto('/notificaciones');
    await expect(v(page.getByText('Un recordatorio amable'))).toBeVisible();
    await expect(v(page.getByTestId('vista-previa'))).toContainText('Tu lectura de hoy');

    // Antes de activarlas ya se puede elegir la hora
    await v(page.getByRole('radio', { name: /Antes de dormir/ })).click();
    await expect(v(page.getByTestId('hora-recordatorio'))).toHaveText('9:00');
    await v(page.getByRole('button', { name: 'Quince minutos después' })).click();
    await expect(v(page.getByTestId('hora-recordatorio'))).toHaveText('9:15');
    await expect(v(page.getByText('Así se verá mañana a las 9:15 de la noche:'))).toBeVisible();

    await v(page.getByRole('button', { name: 'Activar notificaciones' })).click();
    await expect(v(page.getByText('Activas en este dispositivo', { exact: true }))).toBeVisible();
    const endpoint = await endpointGuardado(page);
    expect(endpoint).toContain('/__push/');

    await v(page.getByRole('button', { name: 'Enviarme una de prueba' })).click();
    await expect(v(page.getByText('Enviada. Debería llegarte en unos segundos.'))).toBeVisible();
    const e = await entregaA(page, endpoint);
    expect(e.aviso).toMatchObject({
      title: '¡Listo! Las notificaciones funcionan',
      body: 'Te recordaremos tu lectura cada día a las 9:15 de la noche.',
    });

    // Apagar las tarjetas cambia la vista previa; y se pueden desactivar
    await v(page.getByRole('switch', { name: 'Lectura del día' })).click();
    await expect(v(page.getByTestId('vista-previa'))).toContainText('no te escribiremos');
    await v(page.getByRole('button', { name: 'Desactivar' })).click();
    await expect(v(page.getByRole('button', { name: 'Activar notificaciones' }))).toBeVisible();
    expect(await endpointGuardado(page)).toBe('');
  });

  test('tras reinstalar la app, la suscripción perdida se rehace sola al abrirla', async ({ page }) => {
    // El permiso sigue concedido, pero el navegador ya no tiene la suscripción que la app recordaba.
    await pushSimulado(page, 'granted');
    const vieja = 'https://fcm.googleapis.com/fcm/send/vieja';
    await page.addInitScript((endpoint) => {
      if (!sessionStorage.getItem('sembrado')) {
        sessionStorage.setItem('sembrado', '1');
        localStorage.setItem('avisos', JSON.stringify({ endpoint, hora: 21 * 60 }));
      }
    }, vieja);
    await page.goto('/');
    await expect.poll(() => endpointGuardado(page)).toContain('/__push/');
    await page.goto('/notificaciones');
    await expect(v(page.getByText('Activas en este dispositivo', { exact: true }))).toBeVisible();
    await expect(v(page.getByTestId('hora-recordatorio'))).toHaveText('9:00');
    await v(page.getByRole('button', { name: 'Enviarme una de prueba' })).click();
    const e = await entregaA(page, await endpointGuardado(page));
    expect(e.aviso?.body).toBe('Te recordaremos tu lectura cada día a las 9:00 de la noche.');
  });

  test('sin cuenta, los avisos de la comunidad piden entrar; con cuenta se pueden activar', async ({ page, request }) => {
    await page.goto('/notificaciones');
    await expect(v(page.getByText('Necesitas una cuenta para recibir avisos de la comunidad.'))).toBeVisible();
    await expect(v(page.getByRole('switch', { name: 'Comunidad' }))).toBeDisabled();

    await conSesion(page, await cuentaNueva(request, 'Avisos'));
    await page.reload();
    await expect(v(page.getByRole('switch', { name: 'Comunidad' }))).toBeEnabled();
    await expect(v(page.getByText(/Comentarios, me gusta, invitaciones/))).toBeVisible();
  });

  test('Hoy invita a elegir la hora, y la campana lleva a Notificaciones', async ({ page }) => {
    await page.goto('/');
    const invitacion = v(page.getByTestId('invitacion-avisos'));
    await expect(invitacion).toContainText('¿Te recordamos leer cada día?');
    await invitacion.getByRole('button', { name: 'Ahora no' }).click();
    await expect(invitacion).toHaveCount(0);
    await page.reload();
    await expect(v(page.getByText('Seguir leyendo').or(page.getByText('Empieza aquí')))).toBeVisible();
    await expect(v(page.getByTestId('invitacion-avisos'))).toHaveCount(0);

    await v(page.getByRole('button', { name: 'Notificaciones' })).click();
    await expect(page).toHaveURL(/\/notificaciones$/);
    await expect(v(page.getByText('Un recordatorio amable'))).toBeVisible();
  });
});

test.describe('Notificaciones en iPhone', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' });

  test('en Safari explica que hay que agregar la app a la pantalla de inicio', async ({ page }) => {
    await page.goto('/notificaciones');
    const guia = v(page.getByTestId('guia-iphone'));
    await expect(guia).toContainText('Primero, agrega la app a tu pantalla de inicio');
    await expect(guia).toContainText('desde iOS 16.4');
    await expect(guia).toContainText('Agregar a pantalla de inicio');
    await expect(v(page.getByRole('button', { name: 'Activar notificaciones' }))).toHaveCount(0);
  });
});

test('el horario de silencio se elige y se recuerda', async ({ page }) => {
  await page.goto('/notificaciones');
  await page.getByRole('switch', { name: 'Horario de silencio' }).click();
  const desde = page.getByTestId('silencio-desde');
  const antes = await desde.textContent();
  await page.getByRole('button', { name: 'Empezar media hora después' }).click();
  await expect(desde).not.toHaveText(antes!);
  await expect(page.getByText(/no llegan avisos de la comunidad ni el de la racha/)).toBeVisible();
  const elegido = await desde.textContent();
  await page.reload();
  await expect(page.getByTestId('silencio-desde')).toHaveText(elegido!);
});
