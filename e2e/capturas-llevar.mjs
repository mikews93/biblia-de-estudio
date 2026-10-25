// Capturas de «Para llevar a casa» al terminar de presentar (no es una prueba):
// node e2e/capturas-llevar.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const now = new Date().toISOString();
const parte = (n, titulo, texto) => ({ id: `pl-${n}`, titulo, ayuda: '', texto, paraGrupo: '', minutos: 6 });
const mensaje = {
  id: 'para-llevar',
  tipo: 'sermon',
  titulo: 'El Padre que corre',
  pasaje: { book: 'luk', chapter: 15, from: 20, to: 24 },
  plantilla: 'expositiva',
  observacion: '',
  tema: '',
  complemento: '',
  necesidad: '',
  gracia: '',
  secciones: [
    parte(1, 'Nos alejamos', 'Romanos 5:8: aún siendo pecadores.'),
    parte(2, 'Él corre a abrazarnos', 'Como el padre se compadece de los hijos, Salmos 103:13. Nadie llega tarde a casa.'),
  ],
  revision: [],
  seguimiento: '',
  minutos: 12,
  creado: now,
  actualizado: now,
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function recorrido(prefix, { desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript((v) => localStorage.setItem('taller', v), JSON.stringify([mensaje]));
  await p.goto(`${BASE}/taller/para-llevar/presentar`);
  await p.getByText('Siguiente', { exact: true }).click();
  await p.getByText('Siguiente', { exact: true }).click();
  await p.getByText('PARA LLEVAR A CASA').waitFor();
  await p.getByText('PARA LLEVAR A CASA').scrollIntoViewIfNeeded();
  await wait(1500);
  await p.screenshot({ path: `${OUT}/${prefix}-1-presentar.png` });
  await p.getByRole('button', { name: 'Compartir Salmos 103:13' }).click();
  await p.getByText('Compartir Salmos 103:13', { exact: true }).waitFor();
  await wait(1500);
  await p.screenshot({ path: `${OUT}/${prefix}-2-imagen.png` });
  await ctx.close();
}
await recorrido('m');
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
