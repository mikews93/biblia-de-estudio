// Capturas de «Pedir a mi grupo que ore» y los ánimos (no es una prueba): node e2e/capturas-pedir-oracion.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts) y su base de datos.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const DIA = 86_400_000;
const sufijo = Math.random().toString(36).slice(2, 7);

async function api(cuenta, accion, body = {}) {
  const res = await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cuenta ? { Authorization: `Bearer ${cuenta.llave}` } : {}) },
    body: JSON.stringify({ accion, hoy: new Date().toISOString().slice(0, 10), ...body }),
  });
  if (!res.ok) throw new Error(`${accion}: ${await res.text()}`);
  return res.json();
}
const cuenta = (nombre) => api(null, 'registrarse', { nombre, correo: `${nombre.toLowerCase().replace(/ /g, '.')}.${sufijo}@prueba.dev`, clave: 'clave-segura-1' });

const lucia = await cuenta('Lucía');
const pedro = await cuenta('Pedro Gómez');
const marta = await cuenta('Marta Ruiz');
const grupos = [];
for (const nombre of ['Célula de los jueves', 'Familia']) {
  const { id } = await api(lucia, 'crearGrupo', { nombre, tipo: 'celula', plan: { libro: 'jhn', inicio: '2026-10-20', porDia: 1 } });
  const { grupo } = await api(lucia, 'grupo', { grupo: id });
  for (const m of [pedro, marta]) await api(m, 'unirse', { codigo: grupo.codigo });
  grupos.push(id);
}
// Otras peticiones del grupo, para que la pestaña no se vea vacía
await api(marta, 'nuevaPeticion', { grupo: grupos[0], texto: 'Por la entrevista de trabajo de mi esposo el lunes.' });

const ORACION = { id: 'c1', titulo: 'Tristeza desde que perdí el trabajo', detalle: 'Me cuesta levantarme y no quiero preocupar a mi familia.', created: Date.now() - 5 * DIA, versiculos: [] };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page(quien, { theme, oraciones = [] } = {}) {
  const ctx = await browser.newContext({
    ...devices['Pixel 7'],
    viewport: { width: 412, height: 915 },
    colorScheme: theme === 'oscuro' ? 'dark' : 'light',
    locale: 'es-CO',
  });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  await p.addInitScript(
    ([c, o]) => {
      localStorage.setItem('cuenta', c);
      localStorage.setItem('oraciones', o);
    },
    [JSON.stringify(quien), JSON.stringify(oraciones)],
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(900);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const arriba = async (p, loc) => {
  await loc.waitFor();
  await loc.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.evaluate(() => document.querySelectorAll('*').forEach((el) => el.scrollTop > 0 && (el.scrollTop -= 16)));
};

// 1. Desde «¿Cómo sigues?» en Hoy
const hoy = await page(lucia, { oraciones: [ORACION] });
await hoy.goto(`${BASE}/`);
await wait(3500);
await arriba(hoy, hoy.getByTestId('como-sigues'));
await hoy.getByRole('button', { name: 'Igual' }).click();
await arriba(hoy, hoy.getByTestId('como-sigues'));
await shot(hoy, 'p-1-como-sigues');

// 2. La hoja para pedir oración: grupo, texto corto, sin mi nombre
await hoy.getByRole('button', { name: /Pedir a mi grupo que ore/ }).click();
await hoy.getByTestId('componer-peticion').waitFor();
await hoy.getByRole('radio', { name: 'Célula de los jueves' }).click();
await hoy.getByRole('checkbox', { name: /Sin mi nombre/ }).click();
await shot(hoy, 'p-2-pedir');
await hoy.getByRole('button', { name: 'Pedir oración' }).click();
await hoy.getByTestId('peticion-enviada').waitFor();
await shot(hoy, 'p-3-enviada');

// 3. Pedro la ve sin nombre y envía ánimo
const pe = await page(pedro);
await pe.goto(`${BASE}/grupos/${grupos[0]}?tab=oracion`);
await pe.getByTestId('peticion-grupo').first().waitFor();
await pe.getByRole('button', { name: 'Enviar ánimo' }).first().click();
await pe.getByRole('button', { name: 'Si quieres hablar o tomar un café, aquí estoy.' }).click();
await arriba(pe, pe.getByTestId('peticion-grupo').first());
await shot(pe, 'p-4-enviar-animo');
await pe.getByTestId('enviar-animo').getByRole('button', { name: 'Enviar ánimo' }).click();
await pe.getByRole('button', { name: 'Le enviaste ánimo' }).waitFor();
const { peticiones } = await api(marta, 'peticiones', { grupo: grupos[0] });
const suya = peticiones.find((p) => p.texto.startsWith('Oren por mí: tristeza'));
await api(marta, 'animar', { peticion: suya.id, texto: 'Dios está cerca de los quebrantados de corazón. Estoy orando cada mañana por ti.' });

// 4. Lucía lee sus ánimos desde el diario
const dia = await page(lucia, { oraciones: [ORACION] });
await dia.goto(`${BASE}/diario?vista=oraciones`);
await dia.getByTestId('oracion').first().waitFor();
await wait(1500);
await arriba(dia, dia.getByTestId('oracion').first());
await shot(dia, 'p-5-diario');
await dia.goto(`${BASE}/grupos/${grupos[0]}?tab=oracion`);
await dia.getByText('Te enviaron 2 ánimos', { exact: false }).click();
await dia.getByTestId('mis-animos').waitFor();
await arriba(dia, dia.getByTestId('peticion-grupo').first());
await shot(dia, 'p-6-animos');

// 5. Si habla de hacerse daño, antes que al grupo: alguien que ayude hoy
const r = await page(marta);
await r.goto(`${BASE}/grupos/${grupos[1]}?tab=oracion`);
await r.getByPlaceholder('¿Por qué podemos orar contigo?').fill('Ya no quiero vivir así, nada tiene sentido');
await arriba(r, r.getByTestId('componer-peticion'));
await shot(r, 'p-7-riesgo');

// Oscuro
const o = await page(lucia, { theme: 'oscuro' });
await o.goto(`${BASE}/grupos/${grupos[0]}?tab=oracion`);
await o.getByText('Te enviaron 2 ánimos', { exact: false }).click();
await o.getByTestId('mis-animos').waitFor();
await arriba(o, o.getByTestId('peticion-grupo').first());
await shot(o, 'o-6-animos');
const op = await page(pedro, { theme: 'oscuro' });
await op.goto(`${BASE}/grupos/${grupos[0]}?tab=oracion`);
await op.getByTestId('peticion-grupo').first().waitFor();
await op.getByRole('button', { name: 'Enviar ánimo' }).last().click();
await arriba(op, op.getByTestId('enviar-animo'));
await shot(op, 'o-4-enviar-animo');

await browser.close();
