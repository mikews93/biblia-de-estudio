// Pantallas del video de función «Pódcast del capítulo» (no es una prueba). Juan 3 tiene su pódcast grabado
// en public/audio/podcast/jhn-3.mp3.  node video/promo/scripts/funciones/podcast.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('podcast');
const v = (l) => l.filter({ visible: true }).first();

await p.goto('/juan/3');
await wait(3500);
await sinAviso();
const tab = v(p.getByRole('button', { name: 'Resumen del capítulo en audio, como una conversación' }));
await shot('1-lector', await toque(tab));
await tab.click();
await wait(6000);
const escuchar = v(p.getByRole('button', { name: 'Escuchar', exact: true }));
await shot('2-podcast', await toque(escuchar).catch(() => null));
await escuchar.click().catch(() => {});
await wait(5000);
await sinAviso();
await shot('3-sonando');
await p.mouse.wheel(0, 600);
await shot('4-sonando-abajo', null, 1500);
await p.goBack();
await wait(3500);
await p.mouse.wheel(0, 500);
await wait(1000);
await p.mouse.wheel(0, -150);
const sig = v(p.getByRole('button', { name: /Pódcast del capítulo siguiente/ }));
await shot('5-barra-lector', await toque(sig).catch(() => null), 1500);
await sig.click().catch(() => {});
await wait(5000);
await shot('6-siguiente');
const grabar = v(p.getByRole('button', { name: 'Grabar este pódcast con voces naturales' }));
await shot('7-grabar', await toque(grabar).catch(() => null), 200);
await grabar.click().catch(() => {});
await shot('8-grabando', null, 2500);

await cerrar();
guardarToques('podcast');
