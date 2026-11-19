// Capturas de las dos celebraciones de pantalla completa (servicio y racha) en teléfono, tablet y computador,
// claro y oscuro, para ver que el texto queda centrado bajo el ícono (no es una prueba):
// node e2e/capturas-celebracion-centrada.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const AHORA = new Date('2026-10-26T00:40:00Z');
const dia = (n) => new Date(Date.UTC(2026, 9, 25 + n)).toISOString().slice(0, 10);
const at = (fecha) => new Date(`${fecha}T06:30:00-05:00`).getTime();

const diario = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: `d${i}`, book: 'jhn', chapter: 15, verse: 5, reference: 'Juan 15:5', palabra: '', oracion: '', paso: '', created: at(dia(-i)) }));
function sellos({ profundos, escritos, guiados }) {
  const huellas = {};
  for (let i = 0; i < profundos; i++) huellas[`profundo:${dia(-Math.floor(i / 2))}|jhn.${(i % 21) + 1}.${(i % 7) + 1}`] = dia(-Math.floor(i / 2));
  for (let i = 0; i < escritos; i++) huellas[`escrito:m${i}`] = dia(-i * 6);
  for (let i = 0; i < guiados; i++) huellas[`guiar:evento:E${i}`] = dia(-i * 4);
  return { huellas, ganados: {}, iniciado: true };
}

const PANTALLAS = {
  movil: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  escritorio: { viewport: { width: 1440, height: 900 } },
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [nombre, pantalla] of Object.entries(PANTALLAS)) {
  for (const tema of ['claro', 'oscuro']) {
    const ctx = await browser.newContext({ ...pantalla, colorScheme: tema === 'oscuro' ? 'dark' : 'light', locale: 'es-CO', timezoneId: 'America/Bogota', reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.clock.install({ time: AHORA });
    await p.clock.resume();
    await p.addInitScript(
      ([s, d]) => {
        localStorage.setItem('sellos', JSON.stringify(s));
        localStorage.setItem('servicio-visto', '5');
        localStorage.setItem('diario', JSON.stringify(d));
      },
      [sellos({ profundos: 32, escritos: 2, guiados: 6 }), diario(40)],
    );
    await p.goto(`${BASE}/diario`);
    await p.getByTestId('servicio-estrella').waitFor();
    await wait(2500);
    await p.getByTestId('servicio-estrella').click();
    await wait(2000);
    await p.screenshot({ path: `${OUT}/servicio-${nombre}-${tema}.png` });
    await p.mouse.click(10, 10);
    await wait(1200);
    await p.getByTestId('racha-llama').click();
    await wait(2000);
    await p.screenshot({ path: `${OUT}/racha-${nombre}-${tema}.png` });
    await ctx.close();
  }
}
await browser.close();
