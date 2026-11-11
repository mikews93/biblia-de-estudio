// Pantallas del video de función «Preparar un mensaje» (no es una prueba), como e2e/capturas-preparar.mjs.
//   node video/promo/scripts/funciones/preparar.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, wait, cerrar } = await abrir('preparar');
const ORACION =
  'Siento que los muchachos andan con ansiedad por el futuro, los estudios y el trabajo. En oración me vino Pedro caminando sobre el agua: quiero que vean que Jesús los mandó al barco y que no se hunden mientras lo miran a Él.';
const bajar = async (px) => {
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, px);
};

await p.goto('/taller');
await p.getByText('Preparar un mensaje').first().waitFor();
await wait(4500);
const preparar = p.getByRole('button', { name: /Preparar un mensaje/ }).first();
await shot('1-taller', await toque(preparar));
await preparar.click();
await p.getByLabel('Lo que Dios te puso').fill(ORACION);
const investigar = p.getByRole('button', { name: 'Investigar esto' });
await shot('2-orar', await toque(investigar));
await investigar.click();
await p.getByText('PREDICACIONES EN LA WEB').waitFor({ timeout: 30000 });
await p.getByRole('button', { name: 'Dar la dirección' }).waitFor({ timeout: 30000 });
const estrellas = p.getByRole('checkbox', { name: 'Me sirve' });
for (const i of [0, 1, 2]) if ((await estrellas.count()) > i) await estrellas.nth(i).click();
await bajar(-5000);
await shot('3-investigacion');
await bajar(800);
await shot('4-fuentes');
await p.getByRole('button', { name: 'Dar la dirección' }).click();
await p.getByText('Célula de las 4 E').click();
await p.getByLabel('Tu dirección para el mensaje').fill('Muy práctico para los jóvenes, que cierre con oración en parejas.');
const escribir = p.getByRole('button', { name: 'Escribir el borrador' });
await shot('5-direccion', await toque(escribir));
await escribir.click();
const abrirB = p.getByRole('button', { name: 'Abrir el borrador para revisarlo' });
await abrirB.waitFor({ timeout: 30000 });
await bajar(-5000);
await shot('6-escribiendo', await toque(abrirB));
await abrirB.click();
await p.getByText('BORRADOR DE LA IA').waitFor();
await shot('7-borrador', null, 1200);
await bajar(900);
await shot('8-partes');
await p.getByPlaceholder(/Pide un cambio/).fill('Cambia la tercera parte para usar Isaías 43:2 y añade una oración en parejas al final');
await p.getByRole('button', { name: 'Pedir cambio' }).click();
await p.getByRole('button', { name: 'Aceptar' }).first().waitFor({ timeout: 30000 });
await wait(1500);
await p.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((d) => d.textContent === 'CAMBIOS QUE PEDISTE');
  el?.scrollIntoView({ block: 'start' });
});
await shot('9-cambios');

await cerrar();
guardarToques('preparar');
