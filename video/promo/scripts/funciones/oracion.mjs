// Pantallas del video de función «Diario de oración» (no es una prueba).  node video/promo/scripts/funciones/oracion.mjs
// Ana lleva sus peticiones con los versículos que la acompañan, marca una respondida, pide a su célula que ore
// (sin su nombre) y lee los ánimos que le mandan.
import { abrir, guardarToques } from './comun.mjs';

const BASE = process.env.BASE ?? 'http://localhost:8081';
const DIA = 86_400_000;
const AHORA = new Date('2026-11-04T12:30:00Z').getTime();
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
const v = (book, chapter, verse, reference, text, dias) => ({ book, chapter, verse, reference, text, added: AHORA - dias * DIA });

const ORACIONES = [
  {
    id: 'o1',
    titulo: 'Trabajo para Andrés',
    detalle: 'Lleva tres meses buscando. Que no pierda la esperanza.',
    created: AHORA - 9 * DIA,
    versiculos: [
      v('php', 4, 19, 'Filipenses 4:19', 'Mi Dios, pues, suplirá todo lo que os falta conforme á sus riquezas en gloria en Cristo Jesús.', 8),
      v('psa', 37, 5, 'Salmos 37:5', 'Encomienda á Jehová tu camino, y espera en él; y él hará.', 3),
    ],
  },
  {
    id: 'o2',
    titulo: 'La salud de mi mamá',
    created: AHORA - 30 * DIA,
    versiculos: [v('isa', 41, 10, 'Isaías 41:10', 'No temas, que yo soy contigo; no desmayes, que yo soy tu Dios que te esfuerzo.', 29)],
    respondida: { fecha: AHORA - 2 * DIA, nota: 'Los exámenes salieron bien. Gracias, Señor, por cuidarla.' },
  },
  { id: 'o3', titulo: 'Paciencia con mis hijos', created: AHORA - 4 * DIA, versiculos: [] },
];

const { p, cuenta, shot, toque, sinAviso, wait, cerrar } = await abrir('oracion', { guardar: { oraciones: ORACIONES } });
const arriba = async (loc) => {
  await loc.waitFor();
  await loc.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.evaluate(() => document.querySelectorAll('*').forEach((el) => el.scrollTop > 0 && (el.scrollTop -= 140)));
};

// La célula de Ana, con Pedro y Marta
const pedro = await otra('Pedro Gómez');
const marta = await otra('Marta Ruiz');
const { id: grupo } = await api(cuenta, 'crearGrupo', { nombre: 'Célula de los jueves', tipo: 'celula', plan: { libro: 'jhn', inicio: '2026-10-20', porDia: 1 } });
const { grupo: g } = await api(cuenta, 'grupo', { grupo });
for (const m of [pedro, marta]) await api(m, 'unirse', { codigo: g.codigo });
await api(marta, 'nuevaPeticion', { grupo, texto: 'Por la entrevista de trabajo de mi esposo el lunes.' });

await p.goto('/diario?vista=oraciones');
await p.getByTestId('oracion').first().waitFor();
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
await shot('1-lista', null, 1200);
await p.goto('/diario?vista=camino');
await shot('2-camino', null, 2500);
await p.goto('/diario?vista=oraciones');
const primera = p.getByTestId('oracion').first();
await primera.waitFor();
await shot('3-toca', await toque(primera), 1200);
await primera.click();
const pedir = p.getByText('Pedir a mi grupo', { exact: true }).first();
await pedir.waitFor();
await shot('4-abierta', await toque(pedir), 1200);
await pedir.click();
await p.getByTestId('componer-peticion').waitFor();
await p.getByRole('radio', { name: 'Célula de los jueves' }).click().catch(() => {});
await p.getByRole('checkbox', { name: /Sin mi nombre/ }).click();
await shot('5-pedir');
await p.getByRole('button', { name: 'Pedir oración' }).click();
await p.getByTestId('peticion-enviada').waitFor().catch(() => {});
await shot('6-enviada', null, 1200);

const { peticiones } = await api(marta, 'peticiones', { grupo });
const suya = peticiones.find((x) => x.texto.toLowerCase().includes('paciencia'));
await api(pedro, 'animar', { peticion: suya.id, texto: 'Si quieres hablar o tomar un café, aquí estoy.' });
await api(marta, 'animar', { peticion: suya.id, texto: 'Dios está cerca de los quebrantados de corazón. Estoy orando cada mañana por ti.' });
await p.goto(`/grupos/${grupo}?tab=oracion`);
await p.getByText('Te enviaron 2 ánimos', { exact: false }).click();
await p.getByTestId('mis-animos').waitFor();
await arriba(p.getByTestId('peticion-grupo').first());
await shot('7-animos', null, 1200);

await cerrar();
guardarToques('oracion');
