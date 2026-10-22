// Capturas de «En pareja» (no es una prueba): node e2e/capturas-pareja.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const pad = (n) => String(n).padStart(2, '0');
const dia = (atras) => {
  const d = new Date(Date.now() - atras * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

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
const cuenta = (nombre) => post({ accion: 'registrarse', nombre });

/** Dos cuentas unidas, con los primeros `dias` días hechos (uno por día, hacia atrás). */
async function pareja(a, b, etapa, plan, dias, respuestas) {
  const { pareja: p } = await post({ accion: 'parejaInvitar', etapa }, a.llave);
  await post({ accion: 'parejaUnirse', codigo: p.codigo }, b.llave);
  if (plan !== 'cordon') await post({ accion: 'parejaPlan', plan }, a.llave);
  for (let d = 1; d <= dias; d++) {
    const hoy = dia(dias - d + 1);
    await post({ accion: 'parejaResponder', plan, dia: d, texto: respuestas[(d * 2) % respuestas.length] }, a.llave, hoy);
    await post({ accion: 'parejaResponder', plan, dia: d, texto: respuestas[(d * 2 + 1) % respuestas.length] }, b.llave, hoy);
  }
}

const browser = await chromium.launch();
async function page(c, { device = 'Pixel 7', theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  // Alto de sobra para que quepa la pantalla entera (la página se desplaza dentro de la app, no el documento)
  const ctx = await browser.newContext(
    device === 'desktop' ? { viewport: { width: 1280, height: 1500 }, ...scheme } : { ...devices[device], viewport: { width: 412, height: 1700 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript((cu) => {
    if (cu) localStorage.setItem('cuenta', cu);
  }, c ? JSON.stringify({ llave: c.llave, usuario: c.usuario }) : null);
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name, espera = 700) => {
  await wait(espera);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};

const RESP = [
  'Cuando me acompañó al médico sin que se lo pidiera. Me sentí cuidada.',
  'El sábado, cuando me dijo que estaba orgulloso de mí delante de mis papás.',
  'Me encanta que aunque estemos cansados, terminamos el día orando juntos.',
  'Que me escuche sin intentar arreglarlo todo. Eso me da mucha paz.',
  'Me cuesta tener paciencia cuando llego cansado del trabajo. Me ayudaría que me des diez minutos al llegar.',
  'Cuando me escribió a mediodía solo para decirme que estaba orando por mi reunión.',
];

// Ana invita a Beto; Carla y Dani ya van por el encuentro
const ana = await cuenta('Ana Martínez');
const beto = await cuenta('Beto Ramírez');
const carla = await cuenta('Carla Gómez');
const dani = await cuenta('Daniel Ruiz');

// 1. La portada antes de unirse
let pa = await page(ana);
await pa.goto(`${BASE}/pareja`);
await pa.getByText('Un rato con Dios, los dos').waitFor();
await shot(pa, 'm-1-portada');

// 2. La invitación esperando
await pa.getByText('Crear invitación').click();
await pa.getByText('Tu invitación está lista').waitFor();
await shot(pa, 'm-2-invitacion', 8000);
const { pareja: inv } = await post({ accion: 'parejaEstado' }, ana.llave);

// 3. Beto abre el enlace
const pb = await page(beto);
await pb.goto(`${BASE}/pareja/unirse/${inv.codigo}`);
await pb.getByText('Aceptar la invitación').waitFor();
await shot(pb, 'm-3-unirse');
await pb.getByText('Aceptar la invitación').click();
await pb.getByText('Tú y Ana').waitFor();

// Dos días hechos; hoy Beto ya respondió el día 3 y oró por Ana
for (let d = 1; d <= 2; d++) {
  const hoy = dia(3 - d);
  await post({ accion: 'parejaResponder', plan: 'cordon', dia: d, texto: RESP[d * 2] }, ana.llave, hoy);
  await post({ accion: 'parejaResponder', plan: 'cordon', dia: d, texto: RESP[d * 2 + 1] }, beto.llave, hoy);
}
await post({ accion: 'parejaResponder', plan: 'cordon', dia: 3, texto: 'Que me honres preguntándome mi opinión antes de decidir lo del viaje. Me haría sentir parte.' }, beto.llave);
await post({ accion: 'parejaPedido', texto: 'Por mi entrevista del jueves, que tenga paz.' }, ana.llave);
await post({ accion: 'parejaPedido', texto: 'Por mi papá, que sigue en el hospital.' }, beto.llave);
await post({ accion: 'parejaOre' }, beto.llave);

// 4. Inicio de la pareja
pa = await page(ana);
await pa.goto(`${BASE}/pareja`);
await pa.getByText('Tú y Beto').waitFor();
await shot(pa, 'm-4a-sello', 1500);
// Sin la celebración del sello ni el aviso de la sincronía
await shot(pa, 'm-4-inicio', 8000);

// 5. El día 3 antes de responder (la de Beto espera)
await pa.goto(`${BASE}/pareja/cordon/3`);
await pa.getByText('Beto ya respondió').waitFor();
await shot(pa, 'm-5-dia');

// 6. Ana responde y se abre lo de Beto
await pa.getByPlaceholder('Escribe con calma').fill('Que me sorprendas con un rato los dos solos, sin teléfonos. Lo extraño.');
await pa.getByText('Guardar mi respuesta').click();
await pa.getByText('Que me honres preguntándome').waitFor();
await pa.getByText('Respondan, cada uno'.toUpperCase()).scrollIntoViewIfNeeded();
await shot(pa, 'm-6-revelado');

// 7. El encuentro de la semana (Carla y Dani)
await pareja(carla, dani, 'casados', 'lenguajes', 6, RESP);
const pc = await page(carla);
await pc.goto(`${BASE}/pareja/lenguajes/7`);
await pc.getByText('Ordenen las cinco formas').waitFor();
await pc.getByText('Lean juntos').click();
await shot(pc, 'm-7-encuentro', 8000);

// 8. Ayuda en caso de abuso
await pa.goto(`${BASE}/pareja/ayuda`);
await pa.getByText('No estás solo ni sola').waitFor();
await shot(pa, 'm-8-ayuda');

// Oscuro y escritorio
const po = await page(beto, { theme: 'oscuro' });
await po.goto(`${BASE}/pareja`);
await po.getByText('Tú y Ana').waitFor();
await shot(po, 'o-4-inicio', 8000);
await po.goto(`${BASE}/pareja/cordon/3`);
await po.getByText('Lo que escriba').or(po.getByText('ANA')).first().waitFor();
await shot(po, 'o-6-dia');

const pd = await page(ana, { device: 'desktop' });
await pd.goto(`${BASE}/pareja`);
await pd.getByText('Tú y Beto').waitFor();
await shot(pd, 'd-4-inicio', 8000);
await pd.goto(`${BASE}/pareja/cordon/3`);
await pd.getByText('Que me honres preguntándome').waitFor();
await shot(pd, 'd-6-dia');

// Hoy con el acceso nuevo
await pd.goto(`${BASE}/`);
await pd.getByText('En pareja').waitFor();
await pd.getByText('En pareja').scrollIntoViewIfNeeded();
await shot(pd, 'd-0-hoy');

await browser.close();
