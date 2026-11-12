// Pantallas del video de función «Concordancia, diccionario y fichas» (no es una prueba).  node video/promo/scripts/funciones/fichas.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('fichas');
const v = (l) => l.filter({ visible: true }).first();
await p.goto('/buscar?q=Getsemaní');
await wait(3500);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
await shot('1-buscar', null, 3000);
await p.goto('/diccionario');
await wait(3000);
await v(p.getByPlaceholder(/Busca/)).fill('efod');
await shot('2-diccionario', null, 2000);
const art = v(p.getByText(/^Efod/));
await shot('2-diccionario', await toque(art).catch(() => null), 300);
await art.click().catch(() => {});
await shot('3-articulo', null, 3000);
await p.goto('/ficha/g3972g');
await shot('4-ficha-pablo', null, 3500);
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 700);
await shot('5-ficha-abajo', null, 1500);
await p.goto('/ficha/h3389');
await shot('6-ficha-jerusalen', null, 3500);
await p.goto('/concordancia/G0025');
await shot('7-concordancia', null, 3500);
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 900);
await shot('8-concordancia-abajo', null, 1500);

await cerrar();
guardarToques('fichas');
