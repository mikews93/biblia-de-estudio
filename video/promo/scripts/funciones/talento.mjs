// Pantallas del video «Lo que casi nadie nota: el talento» (no es una prueba). Con el servidor de pruebas
// corriendo (desde la raíz: npx tsx e2e/support/server.ts):  node video/promo/scripts/funciones/talento.mjs
// Solo datos reales sin IA: Mateo 25 en el lector y «Medidas antiguas» del panel de estudio.
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('talento');

await p.goto('/mateo/25');
await wait(3500);
await sinAviso();
const v15 = p.getByText(/cinco talentos/).filter({ visible: true }).first();
await v15.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await shot('1-mateo-25', await toque(v15), 1500);
await v15.click();
await wait(1500);
const estudiar = p.getByText('Estudiar', { exact: true }).filter({ visible: true }).last();
await shot('2-versiculo', await toque(estudiar));
await estudiar.click();
await wait(2500);
const profundo = p.getByText('Profundo', { exact: true }).filter({ visible: true }).first();
if (await profundo.count()) await profundo.click();
const medidas = p.getByText('Medidas antiguas').filter({ visible: true }).first();
await medidas.waitFor({ timeout: 60000 });
await medidas.evaluate((el) => el.scrollIntoView({ block: 'start' }));
// Solo la sección de medidas: el texto del estudio (la IA simulada del servidor de pruebas) queda fuera.
await p.mouse.wheel(0, -60);
await shot('3-medidas', null, 1500);
await cerrar();
guardarToques('talento');
