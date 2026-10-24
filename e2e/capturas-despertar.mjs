// Capturas del despertador (no es una prueba): node e2e/capturas-despertar.mjs <carpeta> [musica.mp3]
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). La música de amanecer puede venir de otro
// lado (aún en otra rama): si se pasa un archivo, se sirve en su lugar.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const MUSICA = process.argv[3];

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `capturas-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
  })
).json();

const libre = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--autoplay-policy=no-user-gesture-required'] });

async function page({ desktop = false, theme, autoplay = true, despertar } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO', timezoneId: 'America/Bogota' };
  const browser = libre;
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-10-24T11:00:00Z') });
  await p.clock.resume();
  if (MUSICA) await p.route('**/audio/ambiente/amanecer.mp3', (r) => r.fulfill({ path: MUSICA, contentType: 'audio/mpeg' }));
  await p.addInitScript(
    ({ cu, d, bloquear }) => {
      // Como un navegador que no deja sonar sin un toque: la primera vez se niega.
      if (bloquear) {
        const play = HTMLMediaElement.prototype.play;
        let veces = 0;
        HTMLMediaElement.prototype.play = function () {
          return veces++ ? play.call(this) : Promise.reject(new DOMException('sin toque', 'NotAllowedError'));
        };
      }
      localStorage.setItem('cuenta', cu);
      localStorage.setItem('ultima-lectura', JSON.stringify({ book: 'jhn', chapter: 4 }));
      if (d) localStorage.setItem('avisos', JSON.stringify({ endpoint: null, hora: 420, avisos: {}, despertar: d }));
      // La voz del navegador sin ventana no suena: se finge que lee.
      speechSynthesis.speak = (u) => setTimeout(() => u.onend?.(new Event('end')), 6000);
    },
    { cu: JSON.stringify(cuenta), d: despertar, bloquear: !autoplay },
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(800);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const bajar = async (p, px) => {
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, px);
};

const activo = { activo: true, hora: 360, dias: 0b0111110, modo: 'versiculo' };

for (const [prefix, opts] of [
  ['m', {}],
  ['o', { theme: 'oscuro' }],
  ['d', { desktop: true }],
]) {
  // La mañana: amanece, suena la música y se lee el versículo.
  const p = await page({ ...opts, despertar: activo });
  await p.goto(`${BASE}/despertar`);
  await p.getByTestId('versiculo-despertar').waitFor();
  await wait(9000);
  await shot(p, `${prefix}-1-despertar`);
  if (prefix === 'm') {
    await bajar(p, 600);
    await shot(p, `${prefix}-2-despertar-abajo`);
  }
  // Ajustes
  await p.goto(`${BASE}/despertador`);
  await p.getByText('Despertar con la Biblia').first().waitFor();
  await shot(p, `${prefix}-3-ajustes`);
  if (prefix !== 'd') {
    await bajar(p, 700);
    await shot(p, `${prefix}-4-ajustes-que-suena`);
    await bajar(p, 900);
    await shot(p, `${prefix}-5-ajustes-rutina`);
  }
  await p.context().close();
}

// Si el navegador no deja sonar sin un toque.
const t = await page({ autoplay: false, despertar: activo });
await t.goto(`${BASE}/despertar`);
await t.getByTestId('toca-para-empezar').waitFor({ timeout: 15000 }).catch(() => {});
await shot(t, 'm-6-toca-para-empezar');

await libre.close();
