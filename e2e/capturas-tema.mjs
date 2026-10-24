// Capturas del Taller desde un tema (no es una prueba): node e2e/capturas-tema.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts), que simula la IA (e2e/support/mock-anthropic.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const TEMA =
  'Varios jóvenes del grupo están ansiosos por el futuro: los estudios, el trabajo, si van a encontrar pareja. Algunos sienten que oran y Dios no los escucha. Quiero hablarles de la confianza sin minimizar lo que sienten.';

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
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript((cu) => {
    localStorage.setItem('cuenta', cu);
    localStorage.setItem('permiso-ia', 'si');
  }, JSON.stringify(cuenta));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(700);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
// La pantalla se desplaza dentro de su ScrollView, no en la página: se baja con la rueda.
const bajar = async (p, px) => {
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, px);
};

async function recorrido(prefix, opts, todas) {
  const p = await page(opts);
  await p.goto(`${BASE}/taller`);
  await p.getByText('Tengo algo de qué hablar').waitFor();
  // El aviso de «progreso guardado» se va solo
  await wait(4500);
  if (todas) await shot(p, `${prefix}-0-taller`);
  await p.getByRole('button', { name: /Tengo algo de qué hablar/ }).click();
  await p.getByRole('radio', { name: /Sermón/ }).click();
  await p.getByLabel('Lo que quieres tratar').fill(TEMA);
  await shot(p, `${prefix}-1-contar`);
  await p.getByRole('button', { name: 'Buscar pasajes y fuentes' }).click();
  await p.getByText('PARA AFINAR').waitFor();
  await p.evaluate(() => window.scrollTo(0, 0));
  await shot(p, `${prefix}-2-pasajes`);
  await bajar(p, 750);
  await shot(p, `${prefix}-3-fuentes`);
  if (todas) {
    await bajar(p, 900);
    await shot(p, `${prefix}-3b-estructura`);
  }
  await p.getByRole('button', { name: /Armar la maqueta/ }).click();
  await p.getByText('IDEA CENTRAL · ELIGE UNA').waitFor();
  await p.getByText('Conclusión').waitFor();
  await shot(p, `${prefix}-4-maqueta`);
  if (todas) {
    await bajar(p, 800);
    await shot(p, `${prefix}-5-partes`);
    await bajar(p, 900);
    await shot(p, `${prefix}-5b-crear`);
  }
  if (todas) {
    await p.getByRole('button', { name: 'Crear el mensaje con esta maqueta' }).click();
    await p.getByText('LO QUE QUERÍAS TRATAR').waitFor();
    await shot(p, `${prefix}-6-mensaje`);
    await p.getByRole('tab', { name: '3 Bosquejo' }).click();
    await p.getByText('PASAJE DE APOYO').first().waitFor();
    await shot(p, `${prefix}-7-bosquejo`);
  }
  await p.context().close();
}

await recorrido('m', {}, true);
await recorrido('o', { theme: 'oscuro' }, false);
await recorrido('d', { desktop: true }, false);
await browser.close();
