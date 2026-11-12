// Pantallas del video de función «Mapa mental y tarjetas de repaso» (no es una prueba).  node video/promo/scripts/funciones/repaso.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('repaso');
const v = (l) => l.filter({ visible: true }).first();
await p.goto('/juan/3');
await wait(3500);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
const mas = v(p.getByRole('button', { name: /^Más/ }));
await shot('1-lector', await toque(mas), 600);
await mas.click();
const mapa = v(p.getByText('Mapa mental', { exact: true }));
await shot('2-herramientas', await toque(mapa).catch(() => null), 1500);
await mapa.click();
await shot('3-mapa', null, 4000);
const idea = v(p.getByText('Jesús y Nicodemo'));
await shot('3-mapa', await toque(idea).catch(() => null), 300);
await idea.click().catch(() => {});
await shot('4-idea', null, 2000);
await p.goto('/tarjetas/jhn/3');
await shot('5-tarjetas', null, 4000);
const guardar = v(p.getByText(/^Guardar \d+ y repasar/));
await shot('5-tarjetas', await toque(guardar).catch(() => null), 300);
await guardar.click().catch(() => {});
await shot('6-repaso', null, 3000);
const ver = v(p.getByRole('button', { name: /toca para verla/ }));
await shot('6-repaso', await toque(ver).catch(() => null), 300);
await ver.click().catch(() => {});
await shot('7-respuesta', null, 1500);
console.log(JSON.stringify((await p.getByRole('button').filter({ visible: true }).allInnerTexts()).slice(-8)));

await cerrar();
guardarToques('repaso');
