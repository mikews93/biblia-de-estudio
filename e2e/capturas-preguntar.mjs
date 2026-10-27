// Capturas de «Pregúntale a la Biblia» (no es una prueba): node e2e/capturas-preguntar.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts), que simula la IA (e2e/support/mock-anthropic.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const PREGUNTA = '¿Qué dice la Biblia sobre la ansiedad?';

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `capturas-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
  })
).json();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme, conCuenta = true } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript(
    ([cu, con]) => {
      if (con) localStorage.setItem('cuenta', cu);
      localStorage.setItem('permiso-ia', 'si');
    },
    [JSON.stringify(cuenta), conCuenta],
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(800);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const bajar = async (p, px) => {
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, px);
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  // El buscador vacío: las preguntas que muchos hacen
  await p.goto(`${BASE}/buscar`);
  await p.getByText('Preguntas que muchos hacen').waitFor();
  // El aviso de «progreso guardado» se va solo
  await wait(4500);
  await bajar(p, 120);
  await shot(p, `${prefix}-1-buscador`);
  // Una pregunta escrita: la respuesta corta arriba y los pasajes debajo
  await p.goto(`${BASE}/buscar?q=${encodeURIComponent(PREGUNTA)}`);
  await p.getByText('Ver la respuesta completa ›').waitFor();
  await p.getByText('No es pecado', { exact: false }).or(p.getByText('La Biblia no llama pecado', { exact: false })).first().waitFor();
  await shot(p, `${prefix}-2-tarjeta`);
  await p.getByText('Ver la respuesta completa ›').click();
  await p.getByText('Lo que dice la Biblia').waitFor();
  await shot(p, `${prefix}-3-respuesta`);
  await bajar(p, 700);
  await shot(p, `${prefix}-4-respuesta-abajo`);
  await bajar(p, 1400);
  await shot(p, `${prefix}-5-seguir`);
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });

// Sin cuenta: una pregunta propia pide entrar; una preparada se lee gratis (si ya está guardada).
const p = await page({ conCuenta: false });
await p.goto(`${BASE}/buscar?q=${encodeURIComponent('¿Qué dice la Biblia sobre la envidia?')}`);
await p.getByText('Crear cuenta gratis').waitFor();
await shot(p, 'm-6-sin-cuenta');
await browser.close();
