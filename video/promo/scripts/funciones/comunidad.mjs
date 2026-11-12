// Pantallas del video de función «Comunidad» (no es una prueba).  node video/promo/scripts/funciones/comunidad.mjs
// Ana tiene amigos que comparten lo que leen, su célula lee Juan un capítulo al día y alguien le pide amistad.
import { abrir, guardarToques } from './comun.mjs';

const BASE = process.env.BASE ?? 'http://localhost:8081';
const sufijo = Math.random().toString(36).slice(2, 7);
async function api(cuenta, accion, body = {}) {
  const res = await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cuenta ? { Authorization: `Bearer ${cuenta.llave}` } : {}) },
    body: JSON.stringify({ accion, hoy: '2026-11-04', ...body }),
  });
  if (!res.ok) throw new Error(`${accion}: ${await res.text()}`);
  return res.json();
}
const otra = (nombre) => api(null, 'registrarse', { nombre, correo: `${nombre.split(' ')[0].toLowerCase()}.${sufijo}@prueba.test`, clave: 'clave-segura-1' });

const { p, cuenta: ana, shot, toque, sinAviso, wait, cerrar } = await abrir('comunidad');
const pedro = await otra('Pedro Gómez');
const marta = await otra('Marta Ruiz');
const laura = await otra('Laura Torres');
for (const o of [pedro, marta]) {
  await api(o, 'pedirAmistad', { usuario: ana.usuario.id });
  await api(ana, 'responderAmistad', { usuario: o.usuario.id, aceptar: true });
}
await api(marta, 'pedirAmistad', { usuario: pedro.usuario.id });
await api(pedro, 'responderAmistad', { usuario: marta.usuario.id, aceptar: true });
const { id: grupo } = await api(ana, 'crearGrupo', { nombre: 'Célula de los jueves', tipo: 'celula', plan: { libro: 'jhn', inicio: '2026-11-01', porDia: 1 } });
const { grupo: g } = await api(ana, 'grupo', { grupo });
for (const o of [pedro, marta]) await api(o, 'unirse', { codigo: g.codigo });

const pub = async (quien, body) => (await api(quien, 'publicar', { audiencia: 'amigos', ...body })).publicacion ?? null;
await pub(marta, { tipo: 'pregunta', texto: '¿Cómo le explicarían a un niño qué es «nacer de nuevo»?' });
const p1 = await pub(pedro, { tipo: 'resaltado', libro: 'jhn', capitulo: 3, versiculo: 16, version: 'rv1909', texto: 'Este versículo me sostuvo toda la semana. Dios no mandó a su Hijo a condenarnos.' });
await api(marta, 'pedirAmistad', { usuario: ana.usuario.id }).catch(() => {});
await api(laura, 'pedirAmistad', { usuario: ana.usuario.id });

await p.goto('/comunidades');
await wait(4000);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
await shot('1-muro', null, 800);
const gusta = p.getByRole('button', { name: /Me gusta/ }).first();
await shot('2-me-gusta', await toque(gusta).catch(() => null), 300);
await gusta.click().catch(() => {});
await shot('3-gustado', null, 1200);
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 600);
await shot('4-muro-abajo', null, 1500);
await p.goto('/comunidades/amigos');
await shot('5-amigos', null, 3500);
await p.goto(`/grupos/${grupo}`);
await shot('6-grupo', null, 3500);
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 700);
await shot('7-grupo-abajo', null, 1500);
await p.goto('/grupos');
await shot('8-grupos', null, 3500);
console.log('pub', JSON.stringify(p1)?.slice(0, 80));

await cerrar();
guardarToques('comunidad');
