// Pantallas del video de función «Modo Jóvenes» (no es una prueba).  node video/promo/scripts/funciones/jovenes.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('jovenes');
await p.goto('/jovenes');
await wait(3500);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
await shot('1-misiones', null, 600);
const empezar = p.getByText(/^Empezar/).first();
await shot('2-toca', await toque(empezar), 300);
await empezar.click();
await shot('3-ruta', null, 2500);
const mision = p.getByRole('button', { name: /Deja las redes|^1$/ }).first();
await shot('3-ruta', await toque(mision), 300);
await mision.click();
await shot('4-lee', null, 2500);
await p.getByRole('button', { name: 'Ya lo leí' }).click();
await shot('5-entiende', null, 2000);
await p.getByText('Echaban la red en el mar').click();
await p.getByText('Dejaron a su padre en la barca').click();
await shot('6-respondio', null, 1500);
for (let i = 7; i <= 11; i++) {
  const botones = (await p.getByRole('button').filter({ visible: true }).allTextContents()).map((b) => b.trim()).filter(Boolean);
  console.log(i, JSON.stringify(botones.slice(-6)));
  const ultimo = p.getByRole('button').filter({ visible: true }).filter({ hasText: /\S/ }).last();
  await ultimo.click({ timeout: 3000 }).catch(() => console.log('no se pudo'));
  await shot(`${i}-paso`, null, 2500);
}

await cerrar();
guardarToques('jovenes');
