// Capturas de «Mi año con la Palabra» (no es una prueba):
// node e2e/capturas-mi-ano.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const año = new Date().getFullYear();
const dia = (m, d) => `${año}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const ms = (m, d) => new Date(año, m - 1, d, 12).getTime();
const dias = [];
for (let m = 1; m <= 10; m++) for (let d = 1; d <= 28; d += m % 3 === 0 ? 2 : 1) if (d % 7 !== 3) dias.push(dia(m, d));
const huellas = Object.fromEntries(dias.map((d) => [`dia:${d}`, d]));
Object.assign(huellas, { 'palabra:G26': dia(2, 1), 'palabra:H2617': dia(5, 9), 'palabra:G5485': dia(9, 14), 'compartir:psa.23.1': dia(6, 2) });
const datos = {
  progreso: { chapters: { psa: Array.from({ length: 60 }, (_, i) => i + 1), jhn: Array.from({ length: 21 }, (_, i) => i + 1), rom: [1, 2, 3, 5, 8, 12] }, days: dias.slice(-120) },
  resaltados: Object.fromEntries(
    ['psa.23.1', 'psa.23.4', 'psa.91.1', 'jhn.3.16', 'jhn.15.5', 'rom.8.28', 'rom.5.8', 'psa.46.1', 'isa.41.10', 'php.4.13', 'lam.3.22'].map((k, i) => [k, { color: 'amarillo', at: ms(1 + (i % 9), 3 + i) }]),
  ),
  notas: { 'psa.23.1': { text: 'Él me cuida', created: ms(2, 1), updated: ms(2, 1) }, 'rom.8.28': { text: 'Todo', created: ms(4, 1), updated: ms(4, 1) } },
  sellos: { huellas, ganados: { bereano: { fecha: dia(3, 1), visto: true }, constante: { fecha: dia(6, 1), visto: true } }, iniciado: true },
  oraciones: [
    { id: 'a', titulo: 'Trabajo para papá', created: ms(2, 2), versiculos: [], respondida: { fecha: ms(5, 1), nota: 'Lo contrataron' } },
    { id: 'b', titulo: 'Salud de la abuela', created: ms(3, 2), versiculos: [], respondida: { fecha: ms(7, 1), nota: '' } },
    { id: 'c', titulo: 'Mi célula', created: ms(4, 2), versiculos: [] },
  ],
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function recorrido(prefix, { desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: 1280, height: 900 }, acceptDownloads: true, ...scheme }
      : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, acceptDownloads: true, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript((d) => Object.entries(d).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v))), datos);
  await p.goto(`${BASE}/mi-ano`);
  await p.getByText('MI VERSÍCULO DEL AÑO').waitFor();
  await wait(1800);
  await p.screenshot({ path: `${OUT}/${prefix}-1-mi-ano.png` });
  if (!desktop) {
    await p.getByText('Y además').scrollIntoViewIfNeeded();
    await wait(500);
    await p.screenshot({ path: `${OUT}/${prefix}-2-ademas.png` });
  }
  if (prefix === 'm') {
    const [d] = await Promise.all([p.waitForEvent('download'), p.getByText('Descargar', { exact: true }).click()]);
    await d.saveAs(`${OUT}/imagen-mi-ano.png`);
  }
  await ctx.close();
}
await recorrido('m');
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
