// Capturas de «¿pregunta o búsqueda?» y de /herejias (no es una prueba): node e2e/capturas-tipo-herejias.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts); la IA simulada clasifica como pregunta lo que
// habla del cielo, de Caín o de herejías (e2e/support/mock-anthropic.ts).
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

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript((cu) => {
    localStorage.setItem('cuenta', cu);
    localStorage.setItem('permiso-ia', 'si');
  }, JSON.stringify(cuenta));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(900);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const bajar = async (p, px) => {
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, px);
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  // Sin signos ni palabras de pregunta: el servidor dice que es pregunta y se responde arriba
  await p.goto(`${BASE}/buscar?q=${encodeURIComponent('los animales van al cielo')}`);
  await p.getByText('Ver la respuesta completa ›').waitFor({ timeout: 60000 });
  await wait(3000);
  await shot(p, `${prefix}-1-pregunta-sin-signos`);
  // Una búsqueda de pasajes: no hay tarjeta de pregunta
  await p.goto(`${BASE}/buscar?q=${encodeURIComponent('cuando tengo miedo de noche')}`);
  await p.getByText('Filipenses 4:6').first().waitFor({ timeout: 60000 });
  await shot(p, `${prefix}-2-busqueda`);
  // Herejías por época
  await p.goto(`${BASE}/herejias`);
  await p.getByText('Antes de Nicea').waitFor();
  await wait(1500);
  await shot(p, `${prefix}-3-herejias`);
  await bajar(p, 1500);
  await shot(p, `${prefix}-4-concilios`);
  await bajar(p, 3200);
  await shot(p, `${prefix}-5-hoy`);
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
