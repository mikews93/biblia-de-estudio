// Capturas del huevo de pascua de la racha (el resplandor) y del aro de luz en la comunidad (no es una prueba):
// node e2e/capturas-resplandor.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const ZONA = 'America/Bogota';
// Domingo 25 de octubre de 2026, 7:40 de la noche en Bogotá.
const AHORA = new Date('2026-10-26T00:40:00Z');
const HOY = '2026-10-25';

const dia = (n) => new Date(Date.UTC(2026, 9, 25 + n)).toISOString().slice(0, 10);
const at = (fecha) => new Date(`${fecha}T06:30:00-05:00`).getTime();

/** Un devocional guardado cada día, los últimos `n` días hasta hoy. */
const diario = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `d${i}`,
    book: 'jhn',
    chapter: 15,
    verse: 5,
    reference: 'Juan 15:5',
    palabra: '',
    oracion: '',
    paso: '',
    created: at(dia(-i)),
  }));

async function post(body, llave) {
  const r = await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: JSON.stringify({ hoy: HOY, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });

async function page({ racha, desktop = false, theme = 'claro', cuenta } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO', timezoneId: ZONA };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.clock.install({ time: AHORA });
  await p.clock.resume();
  await p.addInitScript(
    ([d, cu]) => {
      localStorage.setItem('diario', JSON.stringify(d));
      if (cu) localStorage.setItem('cuenta', cu);
    },
    [diario(racha), cuenta ? JSON.stringify(cuenta) : null],
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });

// 1. El resplandor de cada racha, tocando la llama de la tarjeta.
for (const [dias, opts, nombre] of [
  [3, {}, 'r-03'],
  [7, {}, 'r-07'],
  [21, {}, 'r-21'],
  [40, {}, 'r-40'],
  [40, { theme: 'oscuro' }, 'r-40-oscuro'],
  [100, {}, 'r-100'],
  [365, {}, 'r-365'],
  [365, { desktop: true }, 'r-365-computador'],
]) {
  const p = await page({ racha: dias, ...opts });
  await p.goto(`${BASE}/diario`);
  await p.getByTestId('racha-llama').click();
  await wait(4500);
  await shot(p, nombre);
  await p.context().close();
}

// 2. El aro de luz en la comunidad: Ana con 40 días, y sus amigos con rachas distintas.
const gente = [
  ['Ana Martínez', 40, 'Hoy Juan 15 me recordó que separada de Él no puedo nada.'],
  ['Beto Ramírez', 100, '¿Alguien más está leyendo Éxodo? La zarza que ardía y no se consumía me tiene pensando.'],
  ['Carla Gómez', 365, 'Un año leyendo cada mañana. No fue disciplina mía, fue Su fidelidad.'],
  ['Daniel Ruiz', 7, 'Primera semana completa con el devocional. ¡Vamos!'],
  ['Eva Suárez', 3, 'Empezando de nuevo, tres días seguidos.'],
  ['Felipe Díaz', 0, '¿Por dónde me recomiendan empezar a leer la Biblia?'],
];
const cuentas = [];
for (const [nombre, dias] of gente) {
  const c = await post({ accion: 'registrarse', nombre });
  if (dias) await post({ accion: 'racha', dias, vence: HOY }, c.llave);
  cuentas.push(c);
}
const [ana, ...amigos] = cuentas;
for (const c of amigos) {
  await post({ accion: 'pedirAmistad', usuario: c.usuario.id }, ana.llave);
  await post({ accion: 'responderAmistad', usuario: ana.usuario.id, aceptar: true }, c.llave);
}
for (let i = gente.length - 1; i >= 0; i--) await post({ accion: 'publicar', tipo: 'reflexion', audiencia: 'amigos', texto: gente[i][2] }, cuentas[i].llave);

for (const [pre, opts] of [
  ['c', {}],
  ['co', { theme: 'oscuro' }],
]) {
  const p = await page({ racha: 40, cuenta: ana, ...opts });
  await p.goto(`${BASE}/comunidades`);
  await p.getByText('Un año leyendo').waitFor();
  await wait(1200);
  await shot(p, `${pre}-1-muro`);
  await p.goto(`${BASE}/comunidades/amigos`);
  await p.getByText('Carla Gómez').first().waitFor();
  await wait(900);
  await shot(p, `${pre}-2-amigos`);
  await p.goto(`${BASE}/comunidades/persona/${cuentas[2].usuario.id}`);
  await wait(1800);
  await shot(p, `${pre}-3-persona`);
  await p.context().close();
}
{
  const p = await page({ racha: 40, cuenta: ana });
  await p.goto(`${BASE}/cuenta`);
  await wait(1800);
  await shot(p, 'c-4-cuenta');
  await p.context().close();
}

await browser.close();
