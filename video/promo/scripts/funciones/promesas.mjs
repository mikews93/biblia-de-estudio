// Pantallas del video de función «Promesa y cumplimiento» (no es una prueba).  node video/promo/scripts/funciones/promesas.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('promesas');
await p.goto('/promesas');
await wait(3500);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
await shot('1-promesas', null, 600);
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 650);
const hilo = p.getByText('La simiente de la mujer').first();
await shot('2-hilos', await toque(hilo), 1500);
await hilo.click();
await shot('3-hilo', null, 3000);
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 700);
await shot('4-hilo-abajo', null, 1500);
await p.mouse.wheel(0, 900);
await shot('5-hilo-cristo', null, 1500);

await cerrar();
guardarToques('promesas');
