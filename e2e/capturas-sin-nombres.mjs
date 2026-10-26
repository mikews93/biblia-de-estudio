// Capturas del estudio que cita los comentarios sin nombrar a sus autores (no es una prueba):
// node e2e/capturas-sin-nombres.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
// La respuesta de /api/estudiar se simula en el navegador.
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
  {
    type: 'source',
    n: 3,
    label: 'Matthew Henry, Juan 3:16',
    ref: 'jhn.3.16',
    nota: 'Comentario de toda la Biblia · Matthew Henry · 1706-1721',
  },
  {
    type: 'source',
    n: 4,
    label: 'Tyndale, Juan 3:16-18',
    ref: 'jhn.3.16',
    nota: 'Notas de estudio abiertas de Tyndale · Tyndale House Publishers · 2022',
  },
  { type: 'source', n: 5, label: 'Romanos 5:8', ref: 'rom.5.8' },
  {
    type: 'text',
    text: '## Panorama\n\nJesús conversa de noche con Nicodemo, un maestro de Israel. El versículo 16 resume la conversación: el origen de todo es el amor de Dios por el mundo.⟦1⟧\n\n## Palabras del griego\n\n- **ēgapēsen** («amó») está en aoristo: un amor que se mostró en un hecho concreto, el envío del Hijo.⟦2⟧\n\n## Lo que señalan los comentarios\n\nUn comentario llama a este versículo «el evangelio en pocas palabras»: el amor de Dios no espera a que el mundo lo merezca.⟦3⟧ Las notas de estudio explican que «mundo» en Juan es la humanidad que se aparta de Dios, y por eso el amor sorprende.⟦4⟧\n\n## Pasajes relacionados\n\n- Pablo dice lo mismo desde otro ángulo: Dios mostró su amor cuando aún éramos pecadores.⟦5⟧',
  },
  { type: 'done' },
];

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
async function page({ device = 'Pixel 7', theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    device === 'desktop' ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices[device], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript(([cu, estudio]) => {
    localStorage.setItem('cuenta', cu);
    localStorage.setItem('ajustes', JSON.stringify({ enfoque: 'profundo' }));
    const real = window.fetch;
    window.fetch = (url, init) => {
      if (!String(url).endsWith('/api/estudiar')) return real(url, init);
      const enc = new TextEncoder();
      const stream = new ReadableStream({
        start(c) {
          estudio.forEach((e) => c.enqueue(enc.encode(JSON.stringify(e) + '\n')));
          c.close();
        },
      });
      return Promise.resolve(new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } }));
    };
  }, [JSON.stringify(cuenta), ESTUDIO]);
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(700);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};

for (const [prefijo, opts] of [['m', {}], ['o', { theme: 'oscuro' }], ['d', { device: 'desktop' }]]) {
  const p = await page(opts);
  await p.goto(`${BASE}/juan/3/16`);
  await p.getByRole('button', { name: 'Estudiar', exact: true }).click();
  await p.getByText('Lo que señalan los comentarios').waitFor();
  await p.getByText('Lo que señalan los comentarios').scrollIntoViewIfNeeded();
  await shot(p, `${prefijo}-1-sin-nombres`);
  await p.getByRole('link', { name: /Fuente 3: Matthew Henry/ }).click();
  await shot(p, `${prefijo}-2-cita-comentario`);
  await p.close();
}
await browser.close();
