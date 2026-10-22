// Capturas del estudio con IA que cita la versión e investiga (no es una prueba): node e2e/capturas-estudio-ia.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). Las respuestas de /api/estudiar se simulan
// en el navegador, por partes, para ver también el momento en que la IA investiga.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `capturas-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
  })
).json();

const ESTUDIO = [
  { type: 'source', n: 1, label: 'Juan 3:16', ref: 'jhn.3.16' },
  { type: 'source', n: 2, label: 'Griego de Juan 3:16', ref: 'jhn.3.16' },
  { type: 'source', n: 3, label: 'Romanos 5:8', ref: 'rom.5.8' },
  {
    type: 'text',
    text: '## Panorama\n\nJesús conversa de noche con Nicodemo, un maestro de Israel. El versículo 16 resume la conversación: el origen de todo es el amor de Dios por el mundo.⟦1⟧\n\n## Palabras del griego\n\n- **ēgapēsen** («amó») está en aoristo: un amor que se mostró en un hecho concreto, el envío del Hijo.⟦2⟧\n\n## Pasajes relacionados\n\n- Pablo dice lo mismo desde otro ángulo: Dios mostró su amor cuando aún éramos pecadores.⟦3⟧',
  },
  { type: 'done' },
];

const PASOS = [
  { type: 'paso', tipo: 'buscar', texto: '«escritur»' },
  { type: 'paso', tipo: 'leer', texto: '2 Timoteo 3:14-17' },
  { type: 'paso', tipo: 'leer', texto: '2 Pedro 3:14-18' },
  { type: 'paso', tipo: 'comentarios', texto: '2 Pedro 3' },
  { type: 'paso', tipo: 'teologia', texto: 'el canon del Nuevo Testamento' },
];

const RESPUESTA = [
  { type: 'source', n: 1, label: '2 Timoteo 3:16', ref: '2ti.3.16' },
  { type: 'source', n: 2, label: '2 Pedro 3:16', ref: '2pe.3.16' },
  { type: 'source', n: 3, label: 'Notas de estudio de Tyndale, 2 Pedro 3:15-16', ref: '2pe.3.15' },
  {
    type: 'source',
    n: 4,
    label: 'Eusebio, Historia eclesiástica, Book III, The Divine Scriptures that are accepted and those that…',
    url: 'https://ccel.org/ccel/schaff/npnf201/npnf201.iii.viii.xxv.html',
    nota: 'Eusebio de Cesarea · hacia el año 325 · historia de la Iglesia antigua · dominio público',
  },
  {
    type: 'source',
    n: 5,
    label: 'Fragmento de Muratori, Canon Muratorianus: the Muratorian fragment on the canon…',
    url: 'https://ccel.org/ccel/schaff/anf05/anf05.v.iii.iii.html',
    nota: 'Anónimo (siglo II) · hacia el año 170 · Padres de la Iglesia · dominio público',
  },
  {
    type: 'source',
    n: 6,
    label: 'Shedd, Teología dogmática, I, Chapter IV. The canonicity of Scripture',
    url: 'https://archive.org/details/dogmatictheology01sheduoft/page/141',
    nota: 'William G. T. Shedd · 1888 · presbiteriana · dominio público',
  },
  {
    type: 'text',
    text: '## Lo que muestra la Biblia\n\nLa Biblia no trae una lista de sus libros, pero deja ver cómo se reconocían. Pablo llama «Escritura» a lo que Timoteo conocía desde niño y dice que es inspirada por Dios.⟦1⟧ Pedro ya pone las cartas de Pablo junto a «las otras Escrituras».⟦2⟧ Las notas de Tyndale explican que se leían con la misma autoridad que el Antiguo Testamento.⟦3⟧\n\n## Los testigos antiguos\n\n- Hacia el año 170, el fragmento de Muratori ya enumera casi todos los libros del Nuevo Testamento que se leían en las iglesias y rechaza otros escritos.⟦5⟧\n- Hacia el 325, Eusebio separa los libros que todas las iglesias aceptaban de unos pocos que algunas todavía discutían, como Santiago, 2 Pedro o Judas.⟦4⟧\n\n## Cómo lo explica un teólogo\n\nShedd, presbiteriano del siglo XIX, insiste en que la Iglesia no hizo canónicos esos libros: reconoció la autoridad que ya tenían.⟦6⟧',
  },
  { type: 'done' },
];

const browser = await chromium.launch();
async function page({ device = 'Pixel 7', theme, version = 'pdt', nbla = false } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    device === 'desktop' ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices[device], viewport: { width: 412, height: 915 }, ...scheme },
  );
  if (nbla) {
    await ctx.route('**/api/biblia?versiones=1', (r) =>
      r.fulfill({
        json: {
          versions: [
            { id: 'nbla', abbr: 'NBLA', name: 'Nueva Biblia de las Américas', licensed: true, credit: 'Nueva Biblia de las Américas · Copyright © 2005 by The Lockman Foundation', links: [] },
            { id: 'ntv', abbr: 'NTV', name: 'Nueva Traducción Viviente', licensed: true, credit: 'Nueva Traducción Viviente · © Tyndale House Foundation, 2010', links: [] },
          ],
        },
      }),
    );
  }
  const p = await ctx.newPage();
  await p.addInitScript(
    ([cu, ajustes, estudio, pasos, respuesta]) => {
      localStorage.setItem('cuenta', cu);
      localStorage.setItem('ajustes', ajustes);
      const real = window.fetch;
      window.fetch = (url, init) => {
        if (!String(url).endsWith('/api/estudiar')) return real(url, init);
        const body = JSON.parse(init.body);
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(c) {
            const send = (e) => c.enqueue(enc.encode(JSON.stringify(e) + '\n'));
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            if (!body.messages.length) {
              estudio.forEach(send);
              return c.close();
            }
            for (const paso of pasos) {
              send(paso);
              await wait(150);
            }
            while (!window.__soltar) await wait(100);
            respuesta.forEach(send);
            c.close();
          },
        });
        return Promise.resolve(new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } }));
      };
    },
    [JSON.stringify(cuenta), JSON.stringify({ enfoque: 'profundo', version }), ESTUDIO, PASOS, RESPUESTA],
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name, espera = 700) => {
  await wait(espera);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};

async function preguntar(p) {
  await p.getByRole('button', { name: 'Estudiar', exact: true }).click();
  await p.getByText('Panorama').waitFor();
  await p.getByPlaceholder(/Pregunta sobre/).fill('¿Cómo se definió el canon de la Biblia?');
  await p.getByRole('button', { name: 'Enviar pregunta' }).click();
  await p.getByText('Comentarios de').first().waitFor().catch(() => {});
  await p.getByText(/Consultando teologías clásicas/).waitFor();
}

async function serie(prefijo, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/juan/3/16`);
  await preguntar(p);
  await shot(p, `${prefijo}-2-investigando`);
  await p.evaluate(() => (window.__soltar = true));
  await p.getByText('Lo que muestra la Biblia').waitFor();
  await p.getByRole('button', { name: /Investigó en/ }).click();
  await shot(p, `${prefijo}-3-respuesta`);
  return p;
}

// Móvil: la versión en el estudio, investigando, respuesta, la cita y el selector
{
  const p = await page();
  await p.goto(`${BASE}/juan/3/16`);
  await p.getByRole('button', { name: 'Estudiar', exact: true }).click();
  await p.getByText('Panorama').waitFor();
  await shot(p, 'm-1-version-pdt');
  await p.close();
}
{
  const p = await serie('m', {});
  await p.getByRole('link', { name: /Fuente 2: 2 Pedro 3:16/ }).click();
  await shot(p, 'm-4-cita-pdt');
  await p.getByRole('link', { name: /Fuente 4: Eusebio/ }).click();
  await shot(p, 'm-7-fuente-teologia');
  await p.close();
}
{
  const p = await page({ nbla: true, version: 'nbla' });
  await p.goto(`${BASE}/juan/3/16`);
  await p.getByRole('button', { name: 'Estudiar', exact: true }).click();
  await p.getByText('Panorama').waitFor();
  await shot(p, 'm-5-nbla');
  await p.getByRole('button', { name: /Versión del estudio/ }).click();
  await shot(p, 'm-6-selector');
  await p.close();
}
await (await serie('o', { theme: 'oscuro' })).close();
await (await serie('d', { device: 'desktop' })).close();
await browser.close();
