// Pantallas del video de función «Comparar versiones» (no es una prueba).  node video/promo/scripts/funciones/comparar.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('comparar');
const v = (l) => l.filter({ visible: true }).first();

await p.goto('/juan/3');
await wait(3500);
await sinAviso();
const boton = v(p.getByRole('button', { name: 'Comparar versiones de este capítulo' }));
await shot('1-lector', await toque(boton));
await boton.click();
await wait(3500);
await shot('2-capitulo');
await p.goto('/comparar/juan/3?v=16');
await wait(3500);
await shot('3-versiculo');
await p.mouse.wheel(0, 600);
await shot('4-versiculo-abajo', null, 1200);
const porque = v(p.getByText(/Por qué difieren/i));
await porque.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
await shot('5-por-que', await toque(porque).catch(() => null), 1000);
await porque.click().catch(() => {});
await shot('6-por-que-abierto', null, 3000);

await cerrar();
guardarToques('comparar');
