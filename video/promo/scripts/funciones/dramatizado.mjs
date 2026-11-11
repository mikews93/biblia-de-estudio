// Pantallas del video de función «Audio dramatizado» (no es una prueba). Marcos 1 tiene su dramatizado
// en public/audio/dramatizado/mrk-1.mp3; el pedido de Marcos 2 se simula como en e2e/reproductor.spec.ts.
//   node video/promo/scripts/funciones/dramatizado.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('dramatizado');
const v = (l) => l.filter({ visible: true }).first();
// Para poder adelantar la grabación: se guardan los audios que empiezan a sonar.
await p.addInitScript(() => {
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    (window.__audios ??= new Set()).add(this);
    return play.call(this);
  };
});
const adelantar = (t) => p.evaluate((t) => window.__audios?.forEach((a) => { a.currentTime = t; }), t);
const hojaEscuchar = () => v(p.getByRole('button', { name: /^Escuchar el capítulo: elegir/ }));

await p.goto('/marcos/1');
await wait(3500);
await sinAviso();
await shot('1-lector', await toque(hojaEscuchar()));
await hojaEscuchar().click();
await wait(1200);
const drama = v(p.getByRole('button', { name: /dramatizado, con voces, efectos y música/ }));
await shot('2-hoja', await toque(drama));
await drama.click();
await wait(3000);
// Al bautismo de Jesús (v. 10, 80 s): el versículo se ilumina con la grabación.
await p.getByText(/los cielos abiertos/).filter({ visible: true }).first().evaluate((el) => el.scrollIntoView({ block: 'center' })).catch((e) => console.log('sin scroll', e.message));
await wait(1500);
await adelantar(81);
await shot('3-sonando', null, 2000);
await adelantar(89.5);
await shot('4-sonando-v11', null, 2000);
await v(p.getByRole('button', { name: 'Cerrar el reproductor' })).click().catch(() => {});

// Marcos 2 todavía no está: se pide y se ve cada paso.
const pasos = [
  { estado: 'grabando', fase: 'guion', hechas: 0, total: 0 },
  { estado: 'grabando', fase: 'voces', hechas: 12, total: 30 },
  { estado: 'grabando', fase: 'mezcla', hechas: 30, total: 30 },
  { estado: 'listo', url: '/audio/dramatizado/mrk-1.mp3', duracion: 394, credito: 'Audio dramatizado', tiempos: [[1, 0]] },
];
let paso = -1;
await p.route('**/api/dramatizado**', async (r) => {
  if (r.request().method() === 'POST') paso = 0;
  await r.fulfill({ json: paso < 0 ? { estado: 'ninguno' } : pasos[paso] });
});
await p.goto('/marcos/2');
await wait(3000);
await hojaEscuchar().click();
await wait(1000);
await v(p.getByRole('button', { name: /^Dramatizado: narrador, personajes/ })).click();
await wait(1500);
const pedir = v(p.getByRole('button', { name: 'Dramatizar este capítulo' }));
await shot('5-pedir', await toque(pedir));
await pedir.click();
await shot('6-guion', null, 1500);
paso = 1;
await shot('7-voces', null, 9000);
paso = 3;
await shot('8-listo', null, 9000);

await cerrar();
guardarToques('dramatizado');
