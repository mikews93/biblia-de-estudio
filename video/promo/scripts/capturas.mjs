// Pantallas reales de Zarza para el video promocional (no es una prueba).
// Con el servidor de pruebas de la app corriendo (desde la raíz: npx tsx e2e/support/server.ts, que simula la IA):
//   node video/promo/scripts/capturas.mjs [carpeta]    (por defecto video/promo/public/capturas)
// Teléfono Pixel 7 en oscuro (412×915 a 2,625×: 1082×2402 px), miércoles por la mañana en Bogotá.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8081';
const OUT = process.argv[2] ?? new URL('../public/capturas', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'registrarse', nombre: 'Ana', correo: `promo-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
  })
).json();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, colorScheme: 'dark', locale: 'es-CO', timezoneId: 'America/Bogota' });
const p = await ctx.newPage();
await p.clock.install({ time: new Date('2026-11-04T12:30:00Z') });
await p.clock.resume();
await p.addInitScript((cu) => {
  localStorage.setItem('cuenta', cu);
  localStorage.setItem('permiso-ia', 'si');
  localStorage.setItem('ultima-lectura', JSON.stringify({ book: 'jhn', chapter: 3 }));
  localStorage.setItem('progreso', JSON.stringify({ chapters: { jhn: [1, 2] }, days: ['2026-11-02', '2026-11-03'] }));
}, JSON.stringify(cuenta));
const shot = async (name, ms = 900) => {
  await wait(ms);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name);
};
// El aviso «Tu progreso quedó guardado» se va solo: se espera a que no esté.
const sinAviso = () => p.getByText('Tu progreso quedó guardado').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});

// 1. Hoy
await p.goto(`${BASE}/`);
await wait(5000);
await sinAviso();
await shot('1-hoy');

// 2. El lector y el griego de Juan 3:16
await p.goto(`${BASE}/juan/3`);
await wait(3500);
await shot('2a-lector');
await p.getByText('Interlineal', { exact: true }).click();
await wait(1500);
await sinAviso();
await p.goto(`${BASE}/juan/3/16`);
await wait(3500);
const v16 = p.getByText('amó', { exact: true }).filter({ visible: true }).first();
await v16.waitFor();
await shot('2b-versiculo', 1200);
await p.getByRole('button', { name: /cerrar/i }).filter({ visible: true }).first().click().catch(() => p.keyboard.press('Escape'));
await shot('2b-interlineal', 1200);
await v16.click();
await shot('2c-palabra', 1500);

// 3. Pregúntale a la Biblia
const PREGUNTA = '¿Qué dice la Biblia sobre la ansiedad?';
await p.goto(`${BASE}/buscar`);
await p.getByText('Preguntas que muchos hacen').waitFor();
await sinAviso();
await shot('3a-buscador');
await p.goto(`${BASE}/buscar?q=${encodeURIComponent(PREGUNTA)}`);
await p.getByText('Ver la respuesta completa ›').waitFor();
await shot('3b-tarjeta', 1500);
await p.getByText('Ver la respuesta completa ›').click();
await p.getByText('Lo que dice la Biblia').waitFor();
await shot('3c-respuesta', 1500);

// 4. Escuchar: el pódcast de Ana y Tomás y la lectura en griego
await p.goto(`${BASE}/juan/3`);
await wait(3000);
await p.getByText('Pódcast', { exact: true }).click();
await wait(8000);
await shot('4a-podcast');
await p.goto(`${BASE}/juan/3`);
await wait(3000);
await p.getByText('Escuchar', { exact: true }).click();
await wait(1500);
await shot('4b-escuchar');
await p.getByText('Oír en griego').click();
await wait(4000);
await shot('4c-griego');

await browser.close();
