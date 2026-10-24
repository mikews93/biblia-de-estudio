import { expect, test, type Page } from './support/fixtures';

// El despertador: se configura en /despertador (guarda hora y días en el servidor junto a la suscripción push)
// y por la mañana abre /despertar con música. El servicio push del navegador se simula como en
// notificaciones.spec.ts; la música de amanecer se sirve con un WAV de silencio.

async function pushSimulado(page: Page) {
  await page.addInitScript(() => {
    let permission: NotificationPermission = 'default';
    Object.defineProperty(Notification, 'permission', { get: () => permission });
    Notification.requestPermission = async () => (permission = 'granted');
    let current: unknown = null;
    PushManager.prototype.getSubscription = async () => current as PushSubscription | null;
    PushManager.prototype.subscribe = async () => {
      const j = (await (await fetch('/__push/nueva')).json()) as { endpoint: string; keys: Record<string, string> };
      current = { endpoint: j.endpoint, options: { applicationServerKey: null }, toJSON: () => j, unsubscribe: async () => true };
      return current as PushSubscription;
    };
  });
}

/** Un segundo de silencio en WAV (44 bytes de cabecera + datos). */
function silencio() {
  const rate = 8000;
  const data = Buffer.alloc(rate);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate, 28);
  h.writeUInt16LE(1, 32);
  h.writeUInt16LE(8, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data.fill(128)]);
}

test.describe('Despertador', () => {
  test('activarlo, elegir hora, días y qué suena; el servidor lo guarda', async ({ page }) => {
    await pushSimulado(page);
    await page.goto('/despertador');
    await expect(page.getByText('El despertador está apagado')).toBeVisible();

    await page.getByTestId('despertador-activo').click();
    await expect(page.getByText('Suena a las 6:00 de la mañana')).toBeVisible();
    await page.getByRole('radio', { name: '5:30' }).click();
    await page.getByRole('button', { name: 'Lun a vie' }).click();
    await page.getByRole('checkbox', { name: 'viernes' }).click();
    await expect(page.getByText('Lunes, martes, miércoles y jueves').first()).toBeVisible();
    await page.getByRole('radio', { name: /Solo música/ }).click();

    const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('avisos') ?? '{}'));
    expect(guardado.despertar).toEqual({ activo: true, hora: 330, dias: 0b0011110, modo: 'musica' });
    const leido = await page.request.post('/api/notificaciones', { data: { accion: 'leer', endpoint: guardado.endpoint } });
    expect((await leido.json()).despertar).toEqual({ hora: 330, dias: 0b0011110 });
  });

  test('la mañana: el versículo del día y la música, que se puede apagar', async ({ page }) => {
    await page.route('**/audio/ambiente/amanecer.mp3', (r) => r.fulfill({ body: silencio(), contentType: 'audio/wav' }));
    await page.addInitScript(() => {
      // Sin un toque, el navegador no deja sonar: la primera vez se niega.
      const play = HTMLMediaElement.prototype.play;
      let veces = 0;
      HTMLMediaElement.prototype.play = function () {
        return veces++ ? play.call(this) : Promise.reject(new DOMException('sin toque', 'NotAllowedError'));
      };
    });
    await page.goto('/despertar?modo=musica');
    await expect(page.getByTestId('versiculo-despertar')).toContainText('VERSÍCULO DEL DÍA', { ignoreCase: true });
    await page.getByTestId('toca-para-empezar').click();
    await expect(page.getByTestId('toca-para-empezar')).toHaveCount(0);
    const musica = page.getByTestId('musica');
    await expect(musica).toHaveText('Amanecer');
    await musica.click();
    await expect(musica).toHaveText('Música');
  });
});
