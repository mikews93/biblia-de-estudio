// Pantallas del video de función «Compartir un versículo» (no es una prueba), como e2e/capturas-compartir.mjs.
//   node video/promo/scripts/funciones/compartir.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('compartir');
const toca = async (loc) => {
  await loc.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
  await wait(250);
  await loc.click({ force: true });
};

await p.goto('/juan/3');
await wait(3500);
await sinAviso();
const verso = p.getByText('Porque de tal manera amó Dios al mundo').filter({ visible: true }).first();
await verso.evaluate((e) => e.scrollIntoView({ block: 'center' }));
await wait(800);
await shot('1-lector', await toque(verso));
await verso.click();
await wait(1200);
const compartir = p.getByRole('button', { name: 'Compartir', exact: true }).filter({ visible: true }).first();
await shot('2-acciones', await toque(compartir));
await compartir.click();
await p.getByText('Compartir Juan 3:16').waitFor();
await shot('3-amanecer', null, 1500);
await toca(p.getByRole('radio', { name: 'Fondo Estrellas' }));
await p.getByRole('tab', { name: 'Letra' }).click();
await toca(p.getByRole('radio', { name: 'Letra Elegante' }));
await shot('4-estrellas');
await p.getByRole('tab', { name: 'Dedicar' }).click();
await toca(p.getByRole('radio', { name: 'Oré por ti hoy' }));
const vista = p.getByText('«Porque de tal manera', { exact: false }).last();
await vista.getByText('amó', { exact: true }).click();
await shot('5-dedicar');
await p.getByRole('tab', { name: 'Estudio' }).click();
await toca(p.getByRole('radio', { name: /amó/ }));
await p.getByRole('tab', { name: 'Fondo' }).click();
await toca(p.getByRole('radio', { name: 'Fondo Olivo' }));
await shot('6-original-olivo');
await toca(p.getByRole('radio', { name: 'Historia' }));
await p.getByRole('tab', { name: 'Fondo' }).click();
await toca(p.getByRole('radio', { name: 'Fondo Zarza' }));
await p.getByRole('tab', { name: 'Letra' }).click();
await toca(p.getByRole('radio', { name: 'Letra Inscripción' }));
await p.getByText('Compartir Juan 3:16').scrollIntoViewIfNeeded();
await shot('7-historia');

await cerrar();
guardarToques('compartir');
