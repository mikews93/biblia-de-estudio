// Pantallas del video de función «El mapa que sigue la lectura» (no es una prueba).  node video/promo/scripts/funciones/mapa.mjs
// Jesús en Galilea (Marcos 1) con el audio dramatizado: el mapa avanza con cada versículo.
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('mapa', { args: ['--autoplay-policy=no-user-gesture-required'] });
await p.addInitScript(() => {
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    (window.__audios ??= new Set()).add(this);
    return play.call(this);
  };
});
const adelantar = (t) => p.evaluate((t) => window.__audios?.forEach((a) => { a.currentTime = t; }), t);

await p.goto('/recorridos');
await wait(3500);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
const galilea = p.getByText('Jesús en Galilea').first();
await shot('1-recorridos', await toque(galilea), 600);
await galilea.click();
await wait(3500);
const escuchar = p.getByText('Escuchar dramatizado').first();
await shot('2-recorrido', await toque(escuchar), 600);
await escuchar.click();
await wait(2500);
await adelantar(72);
await shot('3-jordan', null, 2500);
await adelantar(98.5);
await shot('4-desierto', null, 2500);
await adelantar(113);
await shot('5-galilea', null, 2500);
await adelantar(130);
await shot('6-mar', null, 2500);

await cerrar();
guardarToques('mapa');
