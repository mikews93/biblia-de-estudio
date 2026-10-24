// Capturas de la música de ambiente al estudiar (no es una prueba):
// node e2e/capturas-ambiente.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
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

const ahora = new Date().toISOString();
const seccion = (id, titulo, texto, minutos) => ({ id, titulo, ayuda: '', texto, minutos });
const mensaje = {
  id: 'amb1',
  tipo: 'sermon',
  titulo: 'Amor que sale a buscar',
  pasaje: { book: 'luk', chapter: 15, from: 11, to: 32 },
  plantilla: 'expositivo',
  observacion: '',
  tema: 'El Padre corre hacia nosotros',
  complemento: 'antes de que terminemos de pedir perdón',
  necesidad: '',
  gracia: '',
  secciones: [
    seccion('s1', 'Introducción: lejos de casa', 'Todos conocemos la distancia: la que ponemos nosotros y la que sentimos de Dios.', 4),
    seccion('s2', 'El hijo vuelve en sí', '«Y volviendo en sí, dijo…» (v. 17). El arrepentimiento empieza cuando miramos la verdad de frente.', 8),
    seccion('s3', 'El padre corre', 'Lo vio de lejos, fue movido a misericordia, corrió y lo besó (v. 20).', 10),
  ],
  revision: [],
  seguimiento: '',
  minutos: 30,
  creado: ahora,
  actualizado: ahora,
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--autoplay-policy=no-user-gesture-required'] });
async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript(
    ([cu, m]) => {
      localStorage.setItem('cuenta', cu);
      localStorage.setItem('permiso-ia', 'si');
      localStorage.setItem('taller', m);
    },
    [JSON.stringify(cuenta), JSON.stringify([mensaje])],
  );
  p.on('response', (r) => {
    if (r.url().includes('/audio/ambiente/')) console.log('  audio', r.status(), r.url().split('/').pop());
  });
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(900);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/juan/3/16`);
  await p.getByRole('button', { name: 'Estudiar', exact: true }).click();
  const boton = p.getByRole('button', { name: 'Poner música de ambiente' });
  await boton.waitFor();
  await wait(2500);
  await shot(p, `${prefix}-1-devocional`);
  await boton.click();
  await p.getByText('Para estudiar en calma').waitFor();
  await shot(p, `${prefix}-2-elegir`);
  await p.getByRole('button', { name: /^Quietud:/ }).click();
  await wait(1500);
  await shot(p, `${prefix}-3-sonando`);
  await p.getByLabel('Cerrar', { exact: true }).click();
  await shot(p, `${prefix}-4-devocional-sonando`);
  await p.getByRole('tab', { name: /^Profundo/ }).click();
  await wait(2500);
  await shot(p, `${prefix}-5-profundo-sonando`);
  const sonando = await p.evaluate(() => [...document.querySelectorAll('audio')].map((a) => [a.src.split('/').pop(), !a.paused, a.volume.toFixed(2)]));
  console.log('  sonando', JSON.stringify(sonando));

  await p.goto(`${BASE}/taller/amb1/presentar`);
  await p.getByText('El Padre corre hacia nosotros', { exact: false }).first().waitFor();
  await p.getByRole('button', { name: 'Poner música de ambiente' }).click();
  await p.getByRole('button', { name: /^Presencia:/ }).click();
  await wait(800);
  await shot(p, `${prefix}-6-presentar-elegir`);
  await p.getByLabel('Cerrar', { exact: true }).click();
  await p.getByText('Siguiente', { exact: true }).filter({ visible: true }).click();
  await shot(p, `${prefix}-7-presentar-sonando`);
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
