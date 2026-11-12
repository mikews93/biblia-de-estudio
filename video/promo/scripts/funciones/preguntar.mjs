// Pantallas del video de función «Pregúntale a la Biblia» (no es una prueba). Con el servidor de pruebas
// corriendo (la IA simulada responde sobre la ansiedad):  node video/promo/scripts/funciones/preguntar.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('preguntar');
const PREGUNTA = '¿Qué dice la Biblia sobre la ansiedad?';

await p.goto('/');
await wait(5000);
await sinAviso();
const buscador = p.getByText('Buscar en la Biblia').filter({ visible: true }).first();
await shot('1-hoy', await toque(buscador));
await p.goto('/buscar');
await p.getByText('Preguntas que muchos hacen').waitFor();
await sinAviso();
const caja = p.getByRole('searchbox').or(p.getByRole('textbox')).filter({ visible: true }).first();
await shot('2-buscador', await toque(caja));
await caja.fill(PREGUNTA);
await shot('3-escrita', null, 600);
await p.goto(`/buscar?q=${encodeURIComponent(PREGUNTA)}`);
await wait(1); const ver = p.getByText('Ver la respuesta completa ›');
await ver.waitFor();
await wait(1500);
await shot('4-tarjeta', await toque(ver));
await ver.click();
await p.getByText('Lo que dice la Biblia').waitFor();
await shot('5-respuesta', null, 1500);
await p.mouse.wheel(0, 650);
await shot('6-respuesta-abajo', null, 1200);
await p.mouse.wheel(0, 700);
await shot('7-para-pensar', null, 1200);

await cerrar();
guardarToques('preguntar');
