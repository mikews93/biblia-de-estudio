// Capturas de «Mis grupos», los grupos en común y los avisos del grupo (no es una prueba):
// node e2e/capturas-grupos.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const hoy = new Date().toISOString().slice(0, 10);
const r = Math.random().toString(36).slice(2, 6);

async function api(accion, body = {}, llave) {
  const res = await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: JSON.stringify({ accion, hoy, ...body }),
  });
  if (!res.ok) throw new Error(`${accion}: ${await res.text()}`);
  return res.json();
}
const vivo = async (accion, body, llave) =>
  (await fetch(`${BASE}/api/vivo`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llave}` }, body: JSON.stringify({ accion, ...body }) })).json();
const cuenta = (nombre) => api('registrarse', { nombre, correo: `${nombre.replace(/\W/g, '').toLowerCase()}${r}@prueba.dev`, clave: 'clave-segura-1' });

const mike = await cuenta('Mike Blanco');
const laura = await cuenta('Laura Gómez');
const pablo = await cuenta('Pablo Ruiz');
await api('guardarPerfil', { nombre: 'Laura Gómez', bio: 'Sirvo en el grupo de conexión de los jueves', iglesia: 'Iglesia Central', ciudad: 'Bogotá' }, laura.llave);
async function grupo(nombre, tipo, admin, otros, libro) {
  const { id } = await api('crearGrupo', { nombre, tipo, ...(libro ? { plan: { libro, inicio: hoy, porDia: 1 } } : {}) }, admin.llave);
  const { grupo: g } = await api('grupo', { grupo: id }, admin.llave);
  for (const o of otros) await api('unirse', { codigo: g.codigo }, o.llave);
  return id;
}
const conexion = await grupo('Grupo de conexión', 'celula', mike, [laura, pablo], 'jhn');
await grupo('Familia Blanco', 'familia', mike, []);
const jovenes = await grupo('Jóvenes Iglesia Central', 'iglesia', laura, [mike, pablo]);
await grupo('Amigos del barrio', 'amigos', laura, []);
await api('avisosGrupo', { grupo: jovenes, si: false }, mike.llave);

const sermon = {
  id: 'padre',
  tipo: 'sermon',
  titulo: 'El Padre que corre',
  pasaje: { book: 'luk', chapter: 15, from: 11, to: 32 },
  plantilla: 'expositiva',
  observacion: '',
  tema: 'El amor del Padre',
  complemento: 'sale corriendo a buscarnos',
  necesidad: '',
  gracia: '',
  secciones: ['El hijo que se va', 'El padre que lo ve de lejos', 'El hermano que no quiere entrar'].map((titulo, i) => ({ id: `p${i}`, titulo, ayuda: '', texto: 'Notas', claves: '', minutos: 8 })),
  revision: [],
  seguimiento: '',
  minutos: 30,
  creado: '2026-10-10T10:00:00.000Z',
  actualizado: '2026-10-24T10:00:00.000Z',
};
const { evento } = await vivo('publicar', { mensaje: 'padre', titulo: sermon.titulo, puntos: sermon.secciones.map((s) => ({ titulo: s.titulo, texto: '', citas: [] })) }, mike.llave);
await vivo('gruposEvento', { codigo: evento.codigo, grupos: [conexion] }, mike.llave);
sermon.evento = { codigo: evento.codigo, conNotas: false, gradual: true };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript(([c, t]) => {
    localStorage.setItem('cuenta', c);
    localStorage.setItem('taller', t);
  }, [JSON.stringify(mike), JSON.stringify([sermon])]);
  return p;
}
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
const shot = async (p, name) => {
  await wait(1000);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/cuenta`);
  const mis = p.getByTestId('mis-grupos');
  await mis.waitFor();
  await mis.scrollIntoViewIfNeeded();
  await mis.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await shot(p, `${prefix}-1-mis-grupos`);
  await mis.getByRole('button', { name: /Grupo de conexión/ }).click();
  await shot(p, `${prefix}-2-opciones-del-grupo`);

  await p.goto(`${BASE}/comunidades/persona/${laura.usuario.id}`);
  await p.getByTestId('grupos-en-comun').waitFor();
  await shot(p, `${prefix}-3-grupos-en-comun`);

  await p.goto(`${BASE}/grupos/${conexion}`);
  await p.getByText('Te avisamos de este grupo').waitFor();
  await p.getByText('Te avisamos de este grupo').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await shot(p, `${prefix}-4-avisos-del-grupo`);

  await p.goto(`${BASE}/taller/padre?paso=compartir`);
  const avisar = p.getByTestId('avisar-grupos');
  await avisar.waitFor({ timeout: 15000 });
  await avisar.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await shot(p, `${prefix}-5-avisar-al-empezar`);
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
