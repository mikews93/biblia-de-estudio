// Capturas de la espera del pódcast (no es una prueba): node e2e/capturas-podcast-cargando.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). /api/estudiar y /api/podcast-grabado se imitan
// en el navegador: un guion que tarda (solo latidos), una conexión que se corta y una grabación que sigue en marcha.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const GUION = `ANA: Juan cinco empieza junto a un estanque lleno de enfermos que esperan.⟦1⟧
TOMÁS: Y un hombre lleva treinta y ocho años ahí, sin nadie que lo ayude a bajar al agua.⟦1⟧
ANA: Jesús le pregunta algo que suena raro: ¿quieres ser sano?⟦2⟧
TOMÁS: ¿Y tú qué piensas? ¿Qué llevas años esperando que alguien haga por ti?`;

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `podcast-cargando-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
  })
).json();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });

/** modo: 'lento' (solo latidos), 'cortado' (se corta y luego espera) o 'listo' (guion al momento). */
async function page({ theme, modo }) {
  const ctx = await browser.newContext({
    ...devices['Pixel 7'],
    viewport: { width: 412, height: 915 },
    colorScheme: theme === 'oscuro' ? 'dark' : 'light',
    locale: 'es-CO',
    deviceScaleFactor: 2,
    serviceWorkers: 'block',
  });
  const p = await ctx.newPage();
  // La grabación pedida sigue en el servidor: el POST no contesta y las consultas dicen «grabando».
  let grabando = false;
  await p.route('**/api/podcast-grabado**', (r) => {
    if (r.request().method() === 'POST') {
      grabando = true;
      return new Promise(() => {});
    }
    if (r.request().url().includes('grabadas=1')) return r.fulfill({ json: { versiones: [] } });
    return r.fulfill({ json: { estado: grabando ? 'grabando' : 'ninguno' } });
  });
  await p.addInitScript(
    ([cu, guion, modo]) => {
      localStorage.setItem('cuenta', cu);
      localStorage.setItem('permiso-ia', 'si');
      let veces = 0;
      const real = window.fetch;
      window.fetch = (url, init) => {
        if (!String(url).endsWith('/api/estudiar')) return real(url, init);
        const enc = new TextEncoder();
        const primera = veces++ === 0;
        return Promise.resolve(
          new Response(
            new ReadableStream({
              async start(c) {
                const send = (e) => c.enqueue(enc.encode(JSON.stringify(e) + '\n'));
                if (modo === 'listo') {
                  send({ type: 'source', n: 1, label: 'Juan 5:5', ref: 'jhn.5.5' });
                  send({ type: 'source', n: 2, label: 'Juan 5:6', ref: 'jhn.5.6' });
                  send({ type: 'text', text: guion });
                  send({ type: 'done' });
                  return c.close();
                }
                if (modo === 'cortado' && primera) return c.error(new TypeError('Network request failed'));
                for (;;) {
                  await new Promise((r) => setTimeout(r, 10_000));
                  send({ type: 'latido' });
                }
              },
            }),
          ),
        );
      };
    },
    [JSON.stringify({ llave: cuenta.llave, usuario: cuenta.usuario }), GUION, modo],
  );
  return p;
}

for (const theme of ['claro', 'oscuro']) {
  // 1 y 2: el guion se está escribiendo (al principio y pasados 25 s)
  let p = await page({ theme, modo: 'lento' });
  await p.clock.install();
  await p.goto(`${BASE}/podcast/juan/5`);
  await p.getByTestId('preparando-podcast').waitFor();
  await p.clock.runFor(4000);
  await p.screenshot({ path: `${OUT}/m-1-leyendo-${theme}.png` });
  await p.clock.runFor(24_000);
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${OUT}/m-2-conversacion-${theme}.png` });
  await p.context().close();

  // 3: la conexión se cortó y se retoma solo
  p = await page({ theme, modo: 'cortado' });
  await p.goto(`${BASE}/podcast/juan/5`);
  await p.getByText('Retomando…').waitFor();
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/m-3-retomando-${theme}.png` });
  await p.context().close();

  // 4: grabando con voces naturales, con el tiempo que lleva
  p = await page({ theme, modo: 'listo' });
  await p.clock.install();
  await p.goto(`${BASE}/podcast/juan/5`);
  await p.getByRole('button', { name: 'Escuchar' }).click();
  await p.getByRole('button', { name: 'Grabar este pódcast con voces naturales' }).click();
  await p.getByRole('button', { name: 'Grabar con voces naturales' }).click();
  await p.clock.runFor(42_000);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/m-4-grabando-${theme}.png` });
  await p.getByRole('button', { name: /Grabando con voces naturales/ }).click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/m-5-grabando-hoja-${theme}.png` });
  await p.context().close();
}

await browser.close();
