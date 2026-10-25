// Capturas de la racha devocional y de «Actividad» en Mi diario (no es una prueba): node e2e/capturas-racha.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const ZONA = 'America/Bogota';
// Domingo 25 de octubre de 2026, 7:40 de la noche en Bogotá.
const AHORA = new Date('2026-10-26T00:40:00Z');

const at = (fecha, h, m = 0) => new Date(`${fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-05:00`).getTime();
const dia = (n) => {
  const d = new Date(Date.UTC(2026, 9, 25 + n));
  return d.toISOString().slice(0, 10);
};

function datos({ hoyHecho }) {
  const registro = {};
  const anota = (fecha, tipo, ref, titulo, h, m = 0) => (registro[`${fecha}|${tipo}|${ref}`] = { tipo, t: at(fecha, h, m), titulo });
  // Una racha vieja de 8 días a principios de mes, y la de ahora desde el 12, con el 19 como día libre.
  for (let i = 1; i <= 8; i++) anota(`2026-10-0${i}`, 'devocional', `psa.${i}`, `Salmos ${i}`, 7);
  const pasajes = ['Juan 10:11', 'Juan 11:25', 'Juan 12:24', 'Juan 13:34', 'Juan 14:6', 'Juan 14:27', 'Juan 15:1', 'Juan 15:4', 'Juan 15:9', 'Juan 15:12', 'Juan 15:15', 'Juan 15:16', 'Juan 15:5'];
  const dias = [];
  for (let n = -13; n <= (hoyHecho ? 0 : -1); n++) if (dia(n) !== '2026-10-19') dias.push(dia(n));
  const diario = dias.map((f, i) => {
    const ref = pasajes[i % pasajes.length];
    const [, c, v] = ref.match(/(\d+):(\d+)/);
    return {
      id: `d${i}`,
      book: 'jhn',
      chapter: Number(c),
      verse: Number(v),
      reference: ref,
      palabra: i === dias.length - 1 ? '«Separados de mí nada podéis hacer» (v. 5)' : '',
      oracion: 'Señor, quiero permanecer en ti.',
      paso: i === dias.length - 1 ? 'Empezar el día con diez minutos de silencio antes del teléfono.' : 'Llamar a mamá',
      created: at(f, 6, 30 + (i % 3) * 7),
    };
  });
  if (hoyHecho) {
    anota(dia(0), 'profundo', 'rom.8', 'Romanos 8', 18, 10);
    anota(dia(0), 'capitulo', 'jhn.15', '', 6, 50);
    anota(dia(0), 'capitulo', 'jhn.16', '', 7, 5);
    anota(dia(0), 'podcast', 'jhn.15', 'Juan 15', 12, 20);
  }
  anota(dia(-1), 'capitulo', 'psa.23', '', 21, 0);
  anota(dia(-1), 'dramatizado', 'psa.23', 'Salmos 23', 21, 10);
  anota(dia(-2), 'profundo', 'jhn.14.6', 'Juan 14:6', 20, 15);
  anota(dia(-2), 'capitulo', 'jhn.14', '', 20, 0);
  anota(dia(-3), 'original', 'jhn.1', 'Juan 1', 19, 30);
  for (let n = -12; n <= -4; n++) if (n % 2) anota(dia(n), 'capitulo', `jhn.${n + 25}`, '', 7, 20);
  const resaltados = hoyHecho
    ? { 'jhn.15.5': { color: 'amarillo', at: at(dia(0), 7, 10) }, 'jhn.15.7': { color: 'amarillo', at: at(dia(0), 7, 11) } }
    : {};
  resaltados['psa.23.4'] = { color: 'verde', at: at(dia(-1), 21, 5) };
  const notas = { 'psa.23.1': { text: 'Si Él es mi pastor, no me falta lo que de verdad necesito.', created: at(dia(-1), 21, 12), updated: at(dia(-1), 21, 12) } };
  const oraciones = [
    { id: 'o1', titulo: 'Trabajo para papá', created: at('2026-10-20', 22), versiculos: [], respondida: { fecha: at(dia(-1), 9), nota: '¡Lo llamaron para empezar el lunes!' } },
  ];
  return { actividad: registro, diario: diario.reverse(), resaltados, notas, oraciones };
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });

async function page({ desktop = false, theme = 'claro', hoyHecho = true } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO', timezoneId: ZONA };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.clock.install({ time: AHORA });
  await p.clock.resume();
  await p.addInitScript((d) => {
    for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    localStorage.setItem('ultima-lectura', JSON.stringify({ book: 'jhn', chapter: 16 }));
  }, datos({ hoyHecho }));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name, full = false) => {
  await wait(900);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
};
const bajar = async (p, px) => {
  await p.mouse.move(200, 500);
  await p.mouse.wheel(0, px);
  await wait(500);
};

for (const [pre, opts] of [
  ['m', {}],
  ['o', { theme: 'oscuro' }],
]) {
  const p = await page(opts);
  await p.goto(`${BASE}/diario`);
  await p.getByTestId('racha').waitFor();
  await shot(p, `${pre}-1-actividad`);
  await bajar(p, 640);
  await shot(p, `${pre}-2-hoy-y-calendario`);
  await bajar(p, 760);
  await shot(p, `${pre}-3-dia-por-dia`);
  await p.goto(`${BASE}/`);
  await wait(1500);
  await bajar(p, 380);
  await shot(p, `${pre}-4-hoy-boton`);
  await p.goto(`${BASE}/sellos?sello=racha-21`);
  await wait(1200);
  await shot(p, `${pre}-5-insignia`);
  await p.context().close();
}

{
  const p = await page({ hoyHecho: false });
  await p.goto(`${BASE}/diario`);
  await p.getByTestId('racha').waitFor();
  await shot(p, 'm-6-racha-en-riesgo');
  await p.goto(`${BASE}/notificaciones`);
  await wait(1200);
  await bajar(p, 900);
  await shot(p, 'm-7-aviso-racha');
  await p.context().close();
}

{
  const p = await page({ desktop: true });
  await p.goto(`${BASE}/diario`);
  await p.getByTestId('racha').waitFor();
  await shot(p, 'd-1-actividad');
  await bajar(p, 700);
  await shot(p, 'd-2-hoy-y-calendario');
  await p.context().close();
}

await browser.close();
