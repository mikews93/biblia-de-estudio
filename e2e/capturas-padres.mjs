// Capturas del comentario «Padres» en el lector (no es una prueba): node e2e/capturas-padres.mjs <carpeta>, con el
// servidor de pruebas corriendo (npx tsx e2e/support/server.ts) y public/comentarios/padres generado.
// La traducción al español de Juan 3:16 se responde aquí (en la app la hace /api/comentario con IA la primera vez).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const secciones = JSON.parse(gunzipSync(readFileSync('public/comentarios/padres/jhn/3.json.gz')).toString());

const TRADUCCION = `**Tertuliano** · *Contra Práxeas* (hacia el año 220)

En su conversación con Nicodemo dice: «De tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna». Y otra vez: «Porque no envió Dios á su Hijo al mundo, para que condene al mundo, mas para que el mundo sea salvo por él».

**Juan Crisóstomo** · *Homilías sobre el Evangelio de Juan, 27* (hacia el año 407)

Lo que dice es esto: no te maravilles de que yo haya de ser levantado para que ustedes sean salvos, porque así le pareció bien al Padre, y él los amó tanto que dio a su Hijo por siervos, y por siervos ingratos. Un hombre no haría esto ni siquiera por un amigo, ni fácilmente por un justo, como declaró Pablo cuando dijo: «Apenas muere alguno por un justo».

Con la expresión «de tal manera amó», y con aquella otra, «Dios al mundo», muestra la gran fuerza de su amor. Grande e infinita era la distancia entre los dos. Él, el inmortal, el que no tiene principio, la Majestad infinita; ellos, polvo y ceniza, llenos de diez mil pecados, que ingratos lo ofendieron en todo tiempo; y a estos los «amó». Y también son significativas las palabras que añadió: que «dio a su Hijo unigénito», no a un siervo, no a un ángel, no a un arcángel.

¿Ves que en todo hace falta la fe? Porque llama a la cruz fuente de vida, cosa que la razón no admite con facilidad, como lo atestiguan hoy los paganos con sus burlas. Pero la fe, que va más allá de la debilidad del razonamiento, puede recibirla y retenerla con facilidad.`;

async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO', serviceWorkers: 'block' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  await ctx.route((u) => u.pathname === '/api/comentario', (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get('fuente') !== 'padres') return route.continue();
    const s = secciones.find((x) => x.desde === 16);
    return route.fulfill({
      json: {
        secciones: secciones.map((x) => ({ desde: x.desde, hasta: x.hasta, partes: x.partes.length })),
        seccion: { desde: s.desde, hasta: s.hasta, partes: s.partes.length, traducidas: [{ parte: 0, texto: TRADUCCION, estado: 'revisada' }] },
      },
    });
  });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    localStorage.setItem('bienvenida-vista', '1');
    localStorage.setItem('permiso-ia', 'si');
  });
  return p;
}
const shot = async (p, name) => {
  await wait(900);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/juan/3/16`);
  await p.getByRole('button', { name: 'Comentario' }).last().click();
  await p.getByRole('tab', { name: 'Padres' }).click();
  await p.getByText('Homilías sobre el Evangelio de Juan').first().waitFor({ timeout: 30000 });
  await shot(p, `${prefix}-1-padres-juan-3-16`);
  await p.getByText('¿Ves que en todo hace falta la fe?').first().scrollIntoViewIfNeeded();
  await shot(p, `${prefix}-2-padres-seguir`);
  await p.goto(`${BASE}/fuentes`);
  await p.getByText('Los siete concilios ecuménicos (cánones, decretos y actas)').first().waitFor();
  await p.getByText('Los siete concilios ecuménicos (cánones, decretos y actas)').first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await shot(p, `${prefix}-3-fuentes`);
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
