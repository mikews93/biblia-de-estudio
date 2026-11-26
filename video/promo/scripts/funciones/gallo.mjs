// Pantallas del video «Lo que casi nadie nota: el gallo de Pedro» (no es una prueba). Con el servidor de
// pruebas corriendo (desde la raíz: npx tsx e2e/support/server.ts):  node video/promo/scripts/funciones/gallo.mjs
// Solo datos reales sin IA: Marcos 13:35 (las cuatro vigilias), Marcos 14:72 en el interlineal y la concordancia.
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('gallo');

await p.goto('/marcos/13');
await wait(3500);
await sinAviso();
const v35 = p.getByText(/al canto del gallo/).filter({ visible: true }).first();
await v35.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await shot('1-marcos-13', null, 1500);

await p.goto('/marcos/14');
await wait(3500);
await sinAviso();
const boton = p.getByText('Interlineal', { exact: true }).filter({ visible: true }).first();
await boton.click();
await wait(1500);
await sinAviso();
const gallo = p.getByText('gallo', { exact: true }).filter({ visible: true }).last();
await gallo.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await shot('2-marcos-14', await toque(gallo), 1500);
await gallo.click();
await wait(1800);
const todas = p.getByText('Todas las veces en la Biblia').filter({ visible: true }).first();
await shot('3-palabra', await toque(todas));
await todas.click();
await wait(3500);
await shot('4-concordancia');
await p.mouse.wheel(0, 600);
await shot('5-concordancia-abajo', null, 1500);

await cerrar();
guardarToques('gallo');
