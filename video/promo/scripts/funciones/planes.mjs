// Pantallas del video de función «Planes de lectura» (no es una prueba).  node video/promo/scripts/funciones/planes.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('planes');
await p.goto('/planes');
await wait(3500);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
await shot('1-planes', null, 600);
const adviento = p.getByText('La promesa cumplida').first();
await shot('2-toca', await toque(adviento), 300);
await adviento.click();
await shot('3-adviento', null, 3000);
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 700);
await shot('4-adviento-abajo', null, 1500);
await p.goBack();
await wait(2500);
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 900);
await shot('5-mas-planes', null, 1500);
await p.mouse.wheel(0, 900);
await shot('6-mas-planes-2', null, 1500);

await cerrar();
guardarToques('planes');
