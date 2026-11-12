// Pantallas del video de función «Notas y resaltados» (no es una prueba).  node video/promo/scripts/funciones/notas.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('notas');
const v = (l) => l.filter({ visible: true });
const tocar = (texto) => v(p.getByText(texto, { exact: false })).last();
const quitar = () => v(p.getByLabel('Quitar selección')).first().click().catch(() => {});

await p.goto('/juan/3');
await wait(3500);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
// Unos resaltados de antes
await tocar('Respondió Jesús, y díjole: De cierto, de cierto').click();
await v(p.getByRole('button', { name: 'Resaltar en verde' })).first().click();
await quitar();
await tocar('A él conviene crecer').click().catch(() => {});
await v(p.getByRole('button', { name: /Resaltar en (azul|rosa|morado)/ })).first().click().catch(() => {});
await quitar();
await tocar('Porque de tal manera amó Dios al mundo').evaluate((e) => e.scrollIntoView({ block: 'center' }));
const verso = tocar('Porque de tal manera amó Dios al mundo');
await shot('1-lector', await toque(verso), 1200);
await verso.click();
const amarillo = v(p.getByRole('button', { name: 'Resaltar en amarillo' })).first();
await shot('2-panel', await toque(amarillo), 1200);
await amarillo.click();
await wait(800);
await verso.click();
const nota = v(p.getByRole('button', { name: 'Nota', exact: true })).first();
await shot('3-resaltado', await toque(nota), 1200);
await nota.click();
await v(p.getByLabel('Texto de la nota')).first().fill('Dios me amó primero. Esto se lo quiero leer a mi hijo esta noche.');
const guardar = v(p.getByRole('button', { name: 'Guardar' })).first();
await shot('4-nota', await toque(guardar), 1200);
await guardar.click();
await quitar();
await shot('5-con-nota', null, 1500);
await p.goto('/notas');
await shot('6-mis-notas', null, 3000);
await p.goto('/exportar');
await shot('7-exportar', null, 3000);

await cerrar();
guardarToques('notas');
