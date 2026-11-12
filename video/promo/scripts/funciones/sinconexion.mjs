// Pantallas del video de función «Leer sin conexión» (no es una prueba).
// PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 node video/promo/scripts/funciones/sinconexion.mjs
import { abrir, guardarToques } from './comun.mjs';

const { p, ctx, shot, toque, sinAviso, wait, cerrar } = await abrir('sinconexion');
const v = (l) => l.filter({ visible: true }).first();
await p.goto('/descargas');
await p.evaluate(async () => {
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
});
await wait(2000);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
const card = p.getByTestId('paquete-texto:rv1909');
const bajar = card.getByRole('button', { name: /^Descargar la traducción completa/ });
await shot('1-descargas', await toque(bajar), 500);
await bajar.click();
await card.getByRole('progressbar').waitFor();
await shot('2-bajando', null, 1500);
await card.getByText('Descargada', { exact: true }).waitFor({ timeout: 120000 });
await shot('3-descargada', null, 800);
await p.goto('/libros');
await wait(2500);
await shot('4-libros', null, 500);

await ctx.setOffline(true);
await ctx.route('**/*', (r) => r.abort('internetdisconnected'));
await p.goto('/juan/3');
await v(p.getByText('Sin conexión')).waitFor({ timeout: 20000 });
await shot('5-lector', null, 2000);
await p.goto('/buscar');
const box = p.getByRole('textbox').filter({ visible: true }).first();
await box.pressSequentially('esfuérzate y sé valiente', { delay: 40 });
await box.press('Enter');
await v(p.getByText(/Sin conexión · RV1909/)).waitFor({ timeout: 30000 });
await shot('6-buscar', null, 1500);

await cerrar();
guardarToques('sinconexion');
