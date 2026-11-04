// Capturas de las fuentes con sus citas revisadas en una sola lista (no es una prueba):
// node e2e/capturas-fuentes.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
// La respuesta de la IA se sustituye aquí mismo para enseñar fuentes de pasajes, de comentarios y una cita que falla.
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

const FUENTES = [
  { n: 1, label: 'Romanos 11:28', ref: 'rom.11.28' },
  { n: 2, label: 'Romanos 11:29', ref: 'rom.11.29' },
  { n: 3, label: 'Romanos 11:20', ref: 'rom.11.20' },
  { n: 4, label: 'Scofield, Romanos 11:1', ref: 'rom.11.1', nota: 'Biblia de referencia · C. I. Scofield · 1917' },
  { n: 5, label: 'JFB, Romanos 11:26-27', ref: 'rom.11.26', nota: 'Comentario · Jamieson, Fausset y Brown · 1871' },
  { n: 6, label: 'Romanos 11:26', ref: 'rom.11.26' },
  { n: 7, label: 'Calvino, Romanos 11:26', ref: 'rom.11.26', nota: 'Comentario a Romanos · Juan Calvino · 1540' },
];
// El caso que vio Mike: «todo Israel será salvo» junto al comentario de Scofield (sección desde 11:1) ya no da aviso.
const BIEN = [
  '## Todo Israel será salvo',
  'Pablo afirma que «todo Israel será salvo» ⟦4⟧ ⟦6⟧, y lo funda en que «sin arrepentimiento son las mercedes y la vocación de Dios» ⟦2⟧.',
  'Algunos lo entienden como la nación al final de los tiempos ⟦5⟧; otros, como todo el pueblo de Dios, judíos y gentiles ⟦7⟧.',
  'Pero hay un aviso: «por la incredulidad fueron quebradas» ⟦3⟧, y aun así son «amados por causa de los padres» ⟦1⟧.',
].join('\n\n');
// Y una respuesta con una cita que no dice eso y otra que no existe, para ver cómo se marcan en la misma lista.
const MAL = [
  '## Todo Israel será salvo',
  'Pablo afirma que «todo Israel será salvo» ⟦6⟧, y lo funda en que «el Señor es mi pastor, nada me faltará» ⟦2⟧.',
  'Algunos lo entienden como la nación al final ⟦5⟧; otros, como todo el pueblo de Dios ⟦7⟧. Lo repite en Romanos 11:40.',
].join('\n\n');

const ndjson = (text) =>
  [
    { type: 'paso', tipo: 'comentarios', texto: 'Comentarios de Romanos 11' },
    { type: 'text', text },
    ...FUENTES.map((s) => ({ type: 'source', ...s })),
    { type: 'done' },
  ]
    .map((e) => JSON.stringify(e))
    .join('\n') + '\n';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme, texto }) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, ...scheme }
      : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript((cu) => {
    localStorage.setItem('cuenta', cu);
    localStorage.setItem('permiso-ia', 'si');
  }, JSON.stringify(cuenta));
  await p.route('**/api/estudiar', (route) =>
    route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson(texto) }),
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function caso(nombre, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/preguntar?q=${encodeURIComponent('¿Qué quiere decir que todo Israel será salvo?')}`);
  const lista = p.getByTestId('fuentes').last();
  await lista.waitFor();
  await p.getByTestId('citas-resumen').waitFor();
  await wait(4500); // el aviso de «progreso guardado» se va solo
  await lista.scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, 0));
  await wait(600);
  await lista.screenshot({ path: `${OUT}/${nombre}.png` });
  await p.screenshot({ path: `${OUT}/${nombre}-pantalla.png` });
  await p.context().close();
}

await caso('m-1-todo-bien', { texto: BIEN });
await caso('o-1-todo-bien', { texto: BIEN, theme: 'oscuro' });
await caso('m-2-una-mal', { texto: MAL });
await caso('o-2-una-mal', { texto: MAL, theme: 'oscuro' });
await caso('d-1-todo-bien', { texto: BIEN, desktop: true });
await caso('d-2-una-mal', { texto: MAL, desktop: true });
await browser.close();
