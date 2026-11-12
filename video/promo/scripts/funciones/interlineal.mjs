// Pantallas del video de función «Interlineal» (no es una prueba). Con el servidor de pruebas corriendo
// (desde la raíz: npx tsx e2e/support/server.ts):  node video/promo/scripts/funciones/interlineal.mjs
// Escribe public/capturas/funciones/interlineal/*.png (Pixel 7 en oscuro, 1082×2402) y, en
// src/funciones/interlineal.taps.json, dónde se toca en cada una (px de la captura).
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('interlineal');

await p.goto('/juan/3');
await wait(3500);
await sinAviso();
const boton = p.getByText('Interlineal', { exact: true }).filter({ visible: true }).first();
await shot('1-lector', await toque(boton));
await boton.click();
await wait(1500);
await sinAviso();
await shot('2-activo');

const palabra = p.getByText('amó', { exact: true }).filter({ visible: true }).first();
await palabra.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await wait(1200);
await shot('3-versiculo', await toque(palabra));
await palabra.click();
await wait(1500);
const historia = p.getByText('La historia de esta palabra').filter({ visible: true }).first();
await shot('4-palabra', await toque(historia));
await historia.click();
await wait(4000);
await shot('5-historia');
await p.mouse.wheel(0, 700);
await shot('6-historia-abajo', null, 1500);

await cerrar();
guardarToques('interlineal');
