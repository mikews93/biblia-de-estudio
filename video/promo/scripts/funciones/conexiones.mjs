// Pantallas del video de función «Conexiones» (no es una prueba).  node video/promo/scripts/funciones/conexiones.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('conexiones');
const v = (l) => l.filter({ visible: true }).first();
await p.goto('/conexiones');
await v(p.getByText('Los capítulos más conectados')).waitFor();
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
await shot('1-toda-la-biblia', null, 1500);
await p.goto('/conexiones?libro=isaias');
await v(p.getByText('CON QUIÉN CONVERSA MÁS')).waitFor();
await shot('2-isaias', null, 1500);
await p.goto('/conexiones?libro=isaias&cap=53');
await v(p.getByText('LAS MÁS FUERTES')).waitFor();
await shot('3-isaias-53', null, 1500);
await v(p.getByText('LAS MÁS FUERTES')).evaluate((e) => e.scrollIntoView({ block: 'start' }));
await shot('4-isaias-53-refs', null, 1200);

await cerrar();
guardarToques('conexiones');
