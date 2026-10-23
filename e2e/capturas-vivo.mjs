// Capturas de la lectura en vivo (no es una prueba): node e2e/capturas-vivo.mjs <carpeta>
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const hoy = new Date().toISOString().slice(0, 10);

async function post(path, body, llave) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: JSON.stringify({ hoy, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}
const cuenta = (nombre) =>
  post('/api/comunidades', { accion: 'registrarse', nombre, correo: `${nombre.split(' ')[0].toLowerCase()}${Date.now()}${Math.random().toString(36).slice(2,6)}@prueba.test`, clave: 'clave-segura-1' });

const browser = await chromium.launch();
async function page(c, { device = 'Pixel 7', theme } = {}) {
  // El tema oscuro va por el sistema: los ajustes guardados en la cuenta pisarían los del navegador.
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-ES' };
  const ctx = await browser.newContext(device === 'desktop' ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices[device], ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript(([cu, th]) => {
    if (cu) localStorage.setItem('cuenta', cu);
  }, [c ? JSON.stringify(c) : null, theme ?? null]);
  return p;
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ana = await cuenta('Ana Martínez');
const beto = await cuenta('Beto Ramírez');
const carla = await cuenta('Carla Gómez');
const dani = await cuenta('Daniel Ruiz');
const { id } = await post('/api/comunidades', { accion: 'crearGrupo', nombre: 'Célula de los jueves', tipo: 'celula', plan: { libro: 'jhn', inicio: hoy, porDia: 1 } }, ana.llave);
const { grupo } = await post('/api/comunidades', { accion: 'grupo', grupo: id }, ana.llave);
for (const c of [beto, carla, dani]) await post('/api/comunidades', { accion: 'unirse', codigo: grupo.codigo }, c.llave);

// 1. La pantalla del grupo antes de empezar
const pa = await page(ana);
await pa.goto(`${BASE}/grupos/${id}`);
await pa.getByText('Leer juntos en vivo').waitFor();
await pa.getByText('Leer juntos en vivo').scrollIntoViewIfNeeded();
await wait(400);
await shot(pa, 'm-1-grupo-empezar');

// La sala: Ana guía Juan 4 con varias personas
const sala = await post('/api/vivo', { accion: 'crearSala', grupo: id, libro: 'jhn', capitulo: 4 }, ana.llave);
const S = sala.sala.codigo;
for (const c of [beto, carla, dani]) await post('/api/vivo', { accion: 'unirseSala', sala: S }, c.llave);
await post('/api/vivo', { accion: 'tocar', sala: S, versiculo: 10 }, beto.llave);
await post('/api/vivo', { accion: 'tocar', sala: S, versiculo: 13 }, carla.llave);
await post('/api/vivo', { accion: 'tocar', sala: S, versiculo: 13 }, dani.llave);
await post('/api/vivo', { accion: 'moverSala', sala: S, foco: 14 }, ana.llave);

// 2. Beto en la pantalla del grupo: En vivo ahora
const pb = await page(beto);
await pb.goto(`${BASE}/grupos/${id}`);
await pb.getByText('EN VIVO AHORA').waitFor();
await pb.getByText('EN VIVO AHORA').scrollIntoViewIfNeeded();
await wait(500);
await shot(pb, 'm-2-grupo-en-vivo');

// 3. Ana guía: versículo señalado y los iluminados
await pa.goto(`${BASE}/vivo/${S}`);
await pa.getByText('Tú guías la lectura').waitFor();
await pa.getByText('TÚ SEÑALAS').waitFor();
await pa.getByRole('button', { name: /^Versículo 10/ }).scrollIntoViewIfNeeded();
await pa.mouse.wheel(0, -120);
await wait(500);
await shot(pa, 'm-3-guia');

// 4. Ana elige una dinámica
await pa.getByRole('button', { name: 'Mostrar' }).click();
await pa.getByRole('tab', { name: 'Dinámicas' }).click();
await wait(400);
await shot(pa, 'm-4-elegir-dinamica');
await pa.getByRole('button', { name: /Termómetro con la mano/ }).click();
await post('/api/vivo', { accion: 'moverSala', sala: S, paso: 1 }, ana.llave);

// 5. Beto ve la dinámica con el reloj
await pb.goto(`${BASE}/vivo/${S}`);
await pb.getByText('Termómetro con la mano').waitFor();
await pb.getByLabel('Paso 2, el de ahora').waitFor();
await wait(1500);
await shot(pb, 'm-5-dinamica-miembro');

// 6. Una parte del encuentro del Taller, y Beto en modo oscuro
await post('/api/vivo', { accion: 'moverSala', sala: S, tarjeta: { tipo: 'parte', titulo: 'Entrar al texto', texto: 'Lean juntos Juan 4:7-15. Cada uno toque el versículo que más le llame la atención y cuente por qué.', minutos: 12 } }, ana.llave);
const pbo = await page(beto, { theme: 'oscuro' });
await pbo.goto(`${BASE}/vivo/${S}`);
await pbo.getByText('Entrar al texto').waitFor();
await wait(1500);
await shot(pbo, 'm-6-parte-oscuro');

// 7. Pregunta
await post('/api/vivo', { accion: 'moverSala', sala: S, tarjeta: { tipo: 'pregunta', titulo: '¿Qué sed tenía la mujer samaritana, además de la del agua?' } }, ana.llave);
await pb.getByText('PARA CONVERSAR').waitFor();
await wait(600);
await shot(pb, 'm-7-pregunta');

// 8. Personas
await pa.reload();
await pa.getByText('Tú guías la lectura').waitFor();
await pa.getByRole('button', { name: 'Ver quiénes están' }).click();
await pa.getByText('Darle la guía').first().waitFor();
await wait(400);
await shot(pa, 'm-8-personas');
await pa.keyboard.press('Escape');

// 9. Escritorio: guía, claro y oscuro
const pd = await page(ana, { device: 'desktop' });
await pd.goto(`${BASE}/vivo/${S}`);
await pd.getByText('Tú guías la lectura').waitFor();
await wait(800);
await shot(pd, 'd-1-guia');
const pdo = await page(carla, { device: 'desktop', theme: 'oscuro' });
await pdo.goto(`${BASE}/vivo/${S}`);
await pdo.getByText('PARA CONVERSAR').waitFor();
await wait(800);
await shot(pdo, 'd-2-miembro-oscuro');

// 10. Unirse con código
const pn = await page(null);
await pn.goto(`${BASE}/vivo`);
await pn.getByText('Lean juntos, cada uno en su teléfono').waitFor();
await pn.getByLabel('Código de la lectura en vivo').fill(S.slice(0, 4));
await wait(400);
await shot(pn, 'm-9-unirse');

// 11. Terminó
await post('/api/vivo', { accion: 'moverSala', sala: S, capitulo: 5 }, ana.llave);
await post('/api/vivo', { accion: 'cerrarSala', sala: S }, ana.llave);
await pb.getByText('La lectura terminó').waitFor();
await wait(600);
await shot(pb, 'm-10-termino');

await browser.close();
console.log('listo');
