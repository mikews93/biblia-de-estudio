// Capturas de preguntar mientras se escucha el pódcast (no es una prueba): node e2e/capturas-podcast-preguntas.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). Juan 3 con su grabación de la app; /api/estudiar
// se imita en el navegador: el guion de Ana y Tomás y una respuesta que llega por partes.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const GUION = `ANA: Hay conversaciones que pasan de noche y cambian una vida entera. La de Juan tres es una de ellas.⟦1⟧
TOMÁS: Nicodemo no es cualquiera: es fariseo, es maestro de Israel. Y aun así viene a buscar a Jesús a escondidas.⟦1⟧
ANA: Y Jesús no le da una charla de bienvenida. Le dice de entrada que nadie puede ver el reino de Dios si no nace de nuevo.⟦2⟧
TOMÁS: Aquí la palabra griega es ánōthen, que significa «de nuevo» y también «de arriba». Nicodemo entiende lo primero y piensa en volver a entrar en el vientre de su madre.⟦2⟧
ANA: Pero Jesús habla de las dos cosas a la vez: un nacimiento que viene de Dios, del agua y del Espíritu.⟦3⟧
TOMÁS: Y luego la imagen del viento: sopla donde quiere, lo oyes, pero no sabes de dónde viene ni a dónde va.⟦3⟧
ANA: Después recuerda la serpiente de bronce que Moisés levantó en el desierto. Quien la miraba, vivía.⟦4⟧
TOMÁS: Y llegamos al versículo dieciséis: de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito.⟦5⟧
ANA: ¿Y tú qué piensas? ¿Qué te dice a ti este nacer de arriba? Anótalo y conversémoslo en tu grupo.`;

const RESPUESTA = `Tomás se refiere a la palabra que usa Jesús en el versículo 3: **ánōthen**. En griego puede significar «otra vez» y también «desde arriba».⟦1⟧

Nicodemo la entiende solo en el primer sentido, por eso pregunta cómo puede un hombre viejo volver a nacer.⟦1⟧ Jesús, en cambio, habla de un nacimiento que **viene de Dios**: no es algo que uno logra esforzándose, sino una obra del Espíritu, como el viento que se oye pero no se controla.⟦2⟧

Juan usa la misma palabra en 3:31: «El que de arriba viene, sobre todos es».⟦3⟧ Y Santiago 1:17 dice que todo don perfecto «es de lo alto». Por eso muchos comentarios ven aquí los dos sentidos a la vez: nacer **de nuevo** porque se nace **de arriba**.

Es la idea que Ana y Tomás retoman al final con la serpiente levantada: la vida nueva se recibe mirando a lo que Dios provee.`;

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `podcast-preguntas-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
  })
).json();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--autoplay-policy=no-user-gesture-required'] });
async function page({ desktop = false, theme } = {}) {
  const ctx = await browser.newContext({
    ...(desktop ? { viewport: { width: 1280, height: 860 } } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } }),
    colorScheme: theme === 'oscuro' ? 'dark' : 'light',
    locale: 'es-CO',
    deviceScaleFactor: 2,
    serviceWorkers: 'block',
  });
  const p = await ctx.newPage();
  await p.route('**/api/podcast-grabado**', (r) => r.fulfill({ json: { estado: 'ninguno' } }));
  await p.addInitScript(
    ([cu, guion, respuesta]) => {
      localStorage.setItem('cuenta', cu);
      localStorage.setItem('permiso-ia', 'si');
      const real = window.fetch;
      window.fetch = (url, init) => {
        if (!String(url).endsWith('/api/estudiar')) return real(url, init);
        const body = JSON.parse(init.body);
        if (body.detener || body.senales) return real(url, init);
        const pregunta = body.herramienta === 'podcast' && body.messages?.length;
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(c) {
            const send = (e) => c.enqueue(enc.encode(JSON.stringify(e) + '\n'));
            if (!pregunta) {
              for (const [n, ref] of [[1, '3.1'], [2, '3.3'], [3, '3.5'], [4, '3.14'], [5, '3.16']]) send({ type: 'source', n, label: `Juan ${ref.replace('.', ':')}`, ref: `jhn.${ref}` });
              send({ type: 'text', text: guion });
              send({ type: 'done' });
              return c.close();
            }
            send({ type: 'paso', tipo: 'original', texto: 'el griego de Juan 3:3' });
            await new Promise((r) => setTimeout(r, 400));
            send({ type: 'paso', tipo: 'leer', texto: 'Juan 3:31 y Santiago 1:17' });
            await new Promise((r) => setTimeout(r, 400));
            send({ type: 'source', n: 1, label: 'Juan 3:3-4', ref: 'jhn.3.3' });
            send({ type: 'source', n: 2, label: 'Juan 3:8', ref: 'jhn.3.8' });
            send({ type: 'source', n: 3, label: 'Juan 3:31', ref: 'jhn.3.31' });
            for (const trozo of respuesta.match(/\S+\s*/g)) {
              while (window.__pausa) await new Promise((r) => setTimeout(r, 100));
              send({ type: 'text', text: trozo });
              await new Promise((r) => setTimeout(r, 25));
            }
            send({ type: 'done' });
            c.close();
          },
        });
        return Promise.resolve(new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } }));
      };
    },
    [JSON.stringify(cuenta), GUION, RESPUESTA],
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const v = (l) => l.filter({ visible: true }).first();

for (const [prefijo, opts] of [['m', {}], ['o', { theme: 'oscuro' }], ['d', { desktop: true }]]) {
  const p = await page(opts);
  await p.goto(`${BASE}/podcast/juan/3`);
  await v(p.getByText('Nicodemo no es cualquiera', { exact: false })).waitFor({ timeout: 60_000 });
  await v(p.getByRole('button', { name: 'Escuchar', exact: true })).click();
  await wait(1500);
  // Más adelante: la intervención de Tomás sobre ánōthen (tocarla salta a ella)
  await v(p.getByText('Aquí la palabra griega es ánōthen', { exact: false })).click();
  await wait(2500);
  await p.screenshot({ path: `${OUT}/${prefijo}-1-reproductor.png` });

  await v(p.getByRole('button', { name: 'Pausar y preguntar sobre lo que escuchas' })).click();
  await wait(900);
  await p.screenshot({ path: `${OUT}/${prefijo}-2-en-pausa.png` });

  await v(p.getByText(/^¿Qué quiso decir/)).click();
  await v(p.getByText('Nicodemo la entiende solo', { exact: false })).waitFor({ timeout: 30_000 });
  await p.evaluate(() => (window.__pausa = true));
  await wait(400);
  await p.screenshot({ path: `${OUT}/${prefijo}-3-respondiendo.png` });
  await p.evaluate(() => (window.__pausa = false));
  await v(p.getByText('Seguir escuchando', { exact: true })).waitFor({ timeout: 30_000 });
  await wait(800);
  await p.screenshot({ path: `${OUT}/${prefijo}-4-respuesta.png` });
  // Al final de la respuesta
  await p.mouse.wheel(0, 3000);
  await wait(600);
  await p.screenshot({ path: `${OUT}/${prefijo}-5-seguir.png` });

  await v(p.getByText('Seguir escuchando', { exact: true })).click();
  await wait(1200);
  await p.screenshot({ path: `${OUT}/${prefijo}-6-vuelve.png` });
  await p.context().close();
}
await browser.close();
