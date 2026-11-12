// Pantallas del video de función «Hoy» (no es una prueba).  node video/promo/scripts/funciones/hoy.mjs
// La portada cambia con la luz de la hora (mañana y noche) y «Para ti» acompaña lo que Ana está orando.
import { abrir, guardarToques } from './comun.mjs';

const DIA = 86_400_000;
const AHORA = Date.parse('2026-11-04T11:40:00Z');
const ORACIONES = [
  { id: 'a1', titulo: 'Ansiedad por el trabajo nuevo', detalle: 'No puedo dormir pensando en todo lo que falta.', created: AHORA - 2 * DIA, versiculos: [] },
  { id: 'a2', titulo: 'Por la salud de mi mamá', created: AHORA - 6 * DIA, versiculos: [] },
];
const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('hoy', { reloj: '2026-11-04T11:40:00Z', guardar: { oraciones: ORACIONES } });
const hasta = async (id) => {
  await p.getByTestId(id).waitFor();
  await p.getByTestId(id).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.evaluate(() => document.querySelectorAll('*').forEach((el) => el.scrollTop > 0 && (el.scrollTop -= 16)));
};

await p.goto('/');
await wait(3500);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
await shot('1-manana', null, 1500);
await p.clock.setSystemTime(new Date('2026-11-05T01:30:00Z'));
await p.reload();
await wait(3500);
await shot('2-noche', null, 1500);
await hasta('para-ti');
const porque = p.getByRole('button', { name: '¿Por qué veo esto?' });
await shot('3-para-ti', await toque(porque).catch(() => null), 1200);
await porque.click().catch(() => {});
await shot('4-por-que', null, 1500);
await p.keyboard.press('Escape').catch(() => {});
await p.reload();
await wait(3500);
await p.getByRole('button', { name: 'Todo en Zarza' }).scrollIntoViewIfNeeded();
await shot('5-accesos', null, 1500);
await p.getByRole('button', { name: 'Todo en Zarza' }).click();
await shot('6-todo', null, 2500);

await cerrar();
guardarToques('hoy');
