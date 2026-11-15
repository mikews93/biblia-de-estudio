// Capturas de la IA escribiendo por partes (no es una prueba): node e2e/capturas-streaming.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). /api/estudiar se imita en el navegador con
// una respuesta larga que llega palabra a palabra, para ver el texto y el cursor mientras se escribe.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const ESTUDIO = `## Panorama
Juan 3 cuenta la conversación de Jesús con Nicodemo, un fariseo y maestro de Israel que llega de noche. Jesús le dice que nadie puede ver el reino de Dios sin nacer de nuevo, y Nicodemo no entiende cómo puede ser eso.⟦1⟧

## Observa
- Nicodemo viene **de noche**: quizá por miedo, quizá para hablar con calma.
- Jesús responde con imágenes: el *viento*, el agua, la serpiente levantada en el desierto.
- El versículo 16 resume todo el evangelio en una sola frase.

## Palabras del original
La palabra *ánōthen* puede significar «de nuevo» y también «de arriba». Nicodemo entiende la primera; Jesús habla de las dos a la vez: un nacimiento que viene de Dios.`;

const PREGUNTA = `## En corto
La Biblia no llama pecado a sentir angustia: invita a llevarla a Dios en oración y a confiar en que él cuida de ti.⟦1⟧

⟪Filipenses 4:6⟫

## Lo que dice la Biblia
Pablo escribe desde la cárcel y no pide fingir calma: pide convertir cada preocupación en oración, con gratitud. La promesa es la paz de Dios que guarda el corazón, no que el problema desaparezca.⟦1⟧ Jesús, en el sermón del monte, habla de las aves y los lirios para recordar que el Padre conoce lo que necesitamos.`;

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `streaming-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
  })
).json();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme, video = false } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext({
    ...(desktop ? { viewport: { width: 1280, height: 860 } } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } }),
    ...scheme,
    ...(video && { recordVideo: { dir: OUT, size: { width: 412, height: 915 } } }),
  });
  const p = await ctx.newPage();
  await p.addInitScript(
    ([cu, estudio, pregunta]) => {
      localStorage.setItem('cuenta', cu);
      localStorage.setItem('permiso-ia', 'si');
      const real = window.fetch;
      window.fetch = (url, init) => {
        if (!String(url).endsWith('/api/estudiar')) return real(url, init);
        const body = JSON.parse(init.body);
        if (body.detener || body.senales) return real(url, init);
        const texto = body.pregunta ? pregunta : estudio;
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(c) {
            const send = (e) => c.enqueue(enc.encode(JSON.stringify(e) + '\n'));
            send({ type: 'source', n: 1, label: 'Juan 3:1', ref: 'jhn.3.1' });
            for (const trozo of texto.match(/\S+\s*/g)) {
              while (window.__pausa) await new Promise((r) => setTimeout(r, 100));
              send({ type: 'text', text: trozo });
              await new Promise((r) => setTimeout(r, 70));
            }
            send({ type: 'done' });
            c.close();
          },
        });
        return Promise.resolve(new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } }));
      };
    },
    [JSON.stringify(cuenta), ESTUDIO, PREGUNTA],
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Se pausa la respuesta para que el cursor salga encendido en la captura.
const shot = async (p, name, cuando) => {
  await p.getByText(cuando, { exact: false }).first().waitFor({ timeout: 60_000 });
  await p.evaluate(() => (window.__pausa = true));
  await wait(150);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  await p.evaluate(() => (window.__pausa = false));
};

async function serie(prefijo, opts) {
  let p = await page(opts);
  await p.goto(`${BASE}/juan/3/16`);
  await p.getByRole('button', { name: 'Estudiar', exact: true }).click();
  await p.getByText('Profundo', { exact: true }).click();
  await shot(p, `${prefijo}-1-estudio-escribiendo`, 'Jesús responde con');
  await p.context().close();
  p = await page(opts);
  await p.goto(`${BASE}/preguntar?q=${encodeURIComponent('¿Qué dice la Biblia sobre la ansiedad?')}`);
  await shot(p, `${prefijo}-2-preguntar-escribiendo`, 'Pablo escribe desde la cárcel y no');
  await p.context().close();
}

await serie('m', {});
await serie('o', { theme: 'oscuro' });
await serie('d', { desktop: true });

// Un video corto del estudio escribiéndose
const p = await page({ video: true });
await p.goto(`${BASE}/juan/3/16`);
await p.getByRole('button', { name: 'Estudiar', exact: true }).click();
await p.getByText('Profundo', { exact: true }).click();
await wait(11000);
await p.context().close();
await browser.close();
