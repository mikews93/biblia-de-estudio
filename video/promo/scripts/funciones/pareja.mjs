// Pantallas del video de función «En pareja» (no es una prueba).  node video/promo/scripts/funciones/pareja.mjs
// Ana invita a Beto; ya llevan dos días del plan; hoy Beto respondió primero y Ana, al responder, ve lo de él.
import { abrir, guardarToques } from './comun.mjs';

const BASE = process.env.BASE ?? 'http://localhost:8081';
// En la hora de Bogotá, como el teléfono de la captura.
const dia = (atras) => new Date(Date.now() - atras * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
async function post(body, llave, hoy = dia(0)) {
  const r = await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: JSON.stringify({ hoy, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}
const RESP = [
  'Cuando me acompañó al médico sin que se lo pidiera. Me sentí cuidada.',
  'El sábado, cuando me dijo que estaba orgulloso de mí delante de mis papás.',
  'Me encanta que aunque estemos cansados, terminamos el día orando juntos.',
  'Que me escuche sin intentar arreglarlo todo. Eso me da mucha paz.',
  'Me cuesta tener paciencia cuando llego cansado del trabajo. Me ayudaría que me des diez minutos al llegar.',
  'Cuando me escribió a mediodía solo para decirme que estaba orando por mi reunión.',
];

const { p, cuenta: ana, shot, toque, sinAviso, wait, cerrar } = await abrir('pareja', { reloj: null });
await p.goto('/pareja');
await p.getByText('Un rato con Dios, los dos').waitFor();
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
const crear = p.getByText('Crear invitación');
await shot('1-portada', await toque(crear), 1200);
await crear.click();
await p.getByText('Tu invitación está lista').waitFor();
await shot('2-invitacion', null, 3000);

const { pareja: inv } = await post({ accion: 'parejaEstado' }, ana.llave);
const beto = await post({ accion: 'registrarse', nombre: 'Beto Ramírez' });
await post({ accion: 'parejaUnirse', codigo: inv.codigo }, beto.llave);
for (let d = 1; d <= 2; d++) {
  const hoy = dia(3 - d);
  await post({ accion: 'parejaResponder', plan: 'cordon', dia: d, texto: RESP[d * 2] }, ana.llave, hoy);
  await post({ accion: 'parejaResponder', plan: 'cordon', dia: d, texto: RESP[d * 2 + 1] }, beto.llave, hoy);
}
await post({ accion: 'parejaResponder', plan: 'cordon', dia: 3, texto: 'Que me honres preguntándome mi opinión antes de decidir lo del viaje. Me haría sentir parte.' }, beto.llave);
await post({ accion: 'parejaPedido', texto: 'Por mi entrevista del jueves, que tenga paz.' }, ana.llave);
await post({ accion: 'parejaPedido', texto: 'Por mi papá, que sigue en el hospital.' }, beto.llave);
await post({ accion: 'parejaOre' }, beto.llave);

await p.goto('/pareja');
await p.getByText('Tú y Beto').waitFor();
await shot('3-inicio', null, 8000);
await p.mouse.move(200, 400);
await p.mouse.wheel(0, 700);
await shot('4-inicio-abajo', null, 1500);
await p.goto('/pareja/cordon/3');
await p.getByText('Beto ya respondió').waitFor();
await shot('5-dia', null, 1500);
await p.getByPlaceholder('Escribe con calma').fill('Que me sorprendas con un rato los dos solos, sin teléfonos. Lo extraño.');
const guardar = p.getByText('Guardar mi respuesta');
await guardar.scrollIntoViewIfNeeded();
await shot('6-responder', await toque(guardar), 800);
await guardar.click();
await p.getByText('Que me honres preguntándome').waitFor();
await p.getByText('Que me honres preguntándome').scrollIntoViewIfNeeded();
await shot('7-revelado', null, 1500);

await cerrar();
guardarToques('pareja');
