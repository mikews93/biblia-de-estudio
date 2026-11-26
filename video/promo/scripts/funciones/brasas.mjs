// Pantallas del video «Lo que casi nadie nota: el fuego de brasas» (no es una prueba). Con el servidor de
// pruebas corriendo (desde la raíz: npx tsx e2e/support/server.ts):  node video/promo/scripts/funciones/brasas.mjs
// Solo datos reales sin IA: lector, interlineal y concordancia (ἀνθρακιά sale en Juan 18:18 y 21:9).
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('brasas');

const interlineal = async () => {
  const b = p.getByText('Interlineal', { exact: true }).filter({ visible: true }).first();
  await b.click();
  await wait(1500);
  await sinAviso();
};
const palabraEn = async (verso, glosa) => {
  const w = p.locator(`[data-verse="${verso}"]`).getByText(glosa, { exact: true }).first();
  return (await w.count()) ? w : p.getByText(glosa, { exact: true }).filter({ visible: true }).first();
};

await p.goto('/juan/18');
await wait(3500);
await sinAviso();
await interlineal();
const f18 = await palabraEn(18, 'fuego de carbón');
await f18.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await shot('1-juan-18', null, 1500);

await p.goto('/juan/21');
await wait(3500);
await sinAviso();
const f21 = await palabraEn(9, 'fuego de carbón');
await f21.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await shot('2-juan-21', await toque(f21), 1500);
await f21.click();
await wait(1800);
const todas = p.getByText('Todas las veces en la Biblia').filter({ visible: true }).first();
await shot('3-palabra', await toque(todas));
await todas.click();
await wait(3500);
await shot('4-concordancia');

await cerrar();
guardarToques('brasas');
