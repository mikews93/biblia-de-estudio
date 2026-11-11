// Lo común de las capturas de los videos de funciones: cuenta «Ana», Pixel 7 en oscuro, miércoles por la
// mañana en Bogotá, y el registro de los toques (centro del elemento, en px de la captura).
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8081';
const ROOT = new URL('../../', import.meta.url).pathname;
const SCALE = 2.625;
const toques = {};
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrir(id, { progreso } = {}) {
  const OUT = `${ROOT}public/capturas/funciones/${id}`;
  mkdirSync(OUT, { recursive: true });
  const cuenta = await (
    await fetch(`${BASE}/api/comunidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'registrarse', nombre: 'Ana', correo: `fn-${id}-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
    })
  ).json();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
  const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, baseURL: BASE, colorScheme: 'dark', locale: 'es-CO', timezoneId: 'America/Bogota' });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-04T12:30:00Z') });
  await p.clock.resume();
  await p.addInitScript(
    ({ cu, prog }) => {
      localStorage.setItem('cuenta', cu);
      localStorage.setItem('permiso-ia', 'si');
      localStorage.setItem('ultima-lectura', JSON.stringify({ book: 'jhn', chapter: 3 }));
      localStorage.setItem('progreso', JSON.stringify(prog ?? { chapters: { jhn: [1, 2] }, days: ['2026-11-02', '2026-11-03'] }));
    },
    { cu: JSON.stringify(cuenta), prog: progreso },
  );
  return {
    p,
    wait,
    sinAviso: () => p.getByText('Tu progreso quedó guardado').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {}),
    /** El centro del elemento, en px de la captura. */
    toque: async (loc) => {
      const b = await loc.boundingBox();
      return b && { x: Math.round((b.x + b.width / 2) * SCALE), y: Math.round((b.y + b.height / 2) * SCALE) };
    },
    shot: async (name, tap = null, ms = 900) => {
      await wait(ms);
      await p.screenshot({ path: `${OUT}/${name}.png` });
      toques[name] = tap;
      console.log(name, tap ?? '');
    },
    cerrar: () => browser.close(),
  };
}

export function guardarToques(id) {
  mkdirSync(`${ROOT}src/funciones`, { recursive: true });
  writeFileSync(`${ROOT}src/funciones/${id}.taps.json`, JSON.stringify(toques, null, 1) + '\n');
}
