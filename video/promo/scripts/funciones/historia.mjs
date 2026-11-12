// Pantallas del video de función «Línea de tiempo y familias» (no es una prueba).  node video/promo/scripts/funciones/historia.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('historia');
const v = (l) => l.filter({ visible: true }).first();
await p.goto('/historia');
await wait(4000);
await sinAviso();
const era = v(p.getByText('El reino dividido', { exact: true }));
await era.evaluate((e) => e.scrollIntoView({ inline: 'center', block: 'nearest' })).catch(() => {});
await wait(500);
await shot('1-linea', await toque(era).catch(() => null));
await era.click().catch((e) => console.log('sin era', e.message));
await shot('2-reino-dividido', null, 2500);
await p.goto('/genealogia');
await wait(3500);
const jesus = v(p.getByText('Jesús', { exact: true }));
await shot('3-genealogia', await toque(jesus));
await jesus.click();
await shot('4-jesus', null, 3000);
await p.mouse.move(200, 500);
await p.mouse.wheel(0, 700);
await shot('5-jesus-abajo', null, 1500);

await cerrar();
guardarToques('historia');
