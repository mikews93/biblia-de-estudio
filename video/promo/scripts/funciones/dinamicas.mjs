// Pantallas del video de función «Dinámicas para grupos» (no es una prueba).  node video/promo/scripts/funciones/dinamicas.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('dinamicas');
const v = (l) => l.filter({ visible: true }).first();
await p.goto('/taller');
await wait(3500);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 500);
const ver = v(p.getByText(/^Ver las \d+ dinámicas/));
await shot('1-taller', await toque(ver), 1200);
await ver.click();
await shot('2-lista', null, 3000);
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 700);
await shot('3-lista-abajo', null, 1500);
await p.mouse.wheel(0, -700);
await wait(800);
const primera = v(p.getByText('¿Quién soy en la historia?'));
await shot('2-lista', await toque(primera).catch(() => null), 300);
await primera.click().catch(() => {});
await shot('4-dinamica', null, 3000);
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 700);
await shot('5-dinamica-abajo', null, 1500);
console.log(JSON.stringify((await p.getByRole('button').filter({ visible: true }).allInnerTexts()).slice(-10)));

await cerrar();
guardarToques('dinamicas');
