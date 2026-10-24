// Capturas de presentar en vivo un sermón guardado (no es una prueba): node e2e/capturas-presentar.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). El sermón se carga ya escrito y los relojes
// se adelantan en la base de datos para que se vea cuánto lleva cada parte.
import { chromium, devices } from '@playwright/test';
import postgres from 'postgres';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/biblia_e2e', { onnotice: () => {} });

async function post(path, body, llave) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}
const cuenta = (nombre) =>
  post('/api/comunidades', { accion: 'registrarse', nombre, correo: `${nombre.split(' ')[0].toLowerCase()}${Date.now()}${Math.random().toString(36).slice(2, 6)}@prueba.test`, clave: 'clave-segura-1' });

const s = (id, titulo, texto, claves, minutos, extra = {}) => ({ id, titulo, ayuda: '', texto, claves, minutos, ...extra });
const sermon = (id) => ({
  id,
  tipo: 'sermon',
  titulo: 'El Padre que corre',
  pasaje: { book: 'luk', chapter: 15, from: 11, to: 32 },
  plantilla: 'expositiva',
  observacion: '',
  tema: 'El amor del Padre',
  complemento: 'sale corriendo a buscarnos antes de que terminemos de pedir perdón',
  necesidad: '',
  gracia: '',
  secciones: [
    s('i', 'Introducción', 'Todos hemos querido volver a algún lugar del que salimos mal.', 'Pregunta: ¿a dónde te da vergüenza volver?\nMi historia del viaje a Cali', 4),
    s('p1', 'El hijo que se va', 'Lucas 15:12-13. Pedir la herencia en vida era decirle al padre «para mí ya estás muerto».', 'Pedir la herencia = desearle la muerte\nLa provincia apartada: lejos de Dios, no solo de casa\nNo esperó a tocar fondo para ser amado', 8, {
      paraGrupo: 'Todos nos fuimos alguna vez. ¿Qué te alejó a ti?',
    }),
    s('p2', 'El padre que lo ve de lejos', 'Lucas 15:20. Un hombre mayor corriendo era una vergüenza en esa cultura, y él corre igual.', 'Lo estaba esperando: miraba el camino cada día\nCorrer era indigno para un anciano\nLo abraza antes del discurso', 8, {
      paraGrupo: 'Vuelve a contar la escena con tus palabras, como si la hubieras visto.',
      dinamica: 'recuento-en-cadena',
    }),
    s('p3', 'El hermano que no quiere entrar', 'Lucas 15:28. El mayor nunca se fue, pero tampoco estaba en casa.', 'Se puede estar cerca y lejos a la vez', 6),
    s('c', 'Conclusión', 'No tienes que terminar tu discurso. El Padre ya viene corriendo.', 'Invitación: silencio y oración', 4, { dinamica: 'yo-voy-a' }),
  ],
  revision: [],
  seguimiento: '',
  minutos: 30,
  creado: '2026-10-10T10:00:00.000Z',
  actualizado: '2026-10-24T18:00:00.000Z',
  terminado: '2026-10-18T20:00:00.000Z',
  ocasiones: [{ fecha: '2026-10-19', lugar: 'Iglesia central, culto de las 10' }],
});

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page(c, { desktop = false, theme, mensajes = [], version = 'bes' } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript(
    ([cu, t, v]) => {
      if (cu) localStorage.setItem('cuenta', cu);
      localStorage.setItem('taller', t);
      localStorage.setItem('ajustes', JSON.stringify({ version: v }));
    },
    [c ? JSON.stringify(c) : null, JSON.stringify(mensajes), version],
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  // El aviso de «Tu progreso quedó guardado» tapa parte de la pantalla: se espera a que se vaya.
  await p.getByText(/progreso (quedó guardado|de la cuenta)/).waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
  await wait(700);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};

/** Adelanta los relojes de la sala: el mensaje empezó hace `total` segundos y la parte de ahora hace `parte`. */
async function adelantarSala(codigo, total, parte) {
  const [row] = await sql`select estado from vivo_salas where codigo = ${codigo}`;
  const g = row.estado.guion;
  const now = Date.now();
  g.inicio = new Date(now - total * 1000).toISOString();
  g.desde = new Date(now - parte * 1000).toISOString();
  await sql`update vivo_salas set estado = ${sql.json({ ...row.estado, guion: g })}, version = version + 1, actualizado = now() where codigo = ${codigo}`;
}

for (const [v, opts] of [
  ['m', {}],
  ['o', { theme: 'oscuro' }],
  ['d', { desktop: true }],
]) {
  const id = `padre-${v}`;
  const ana = await cuenta('Miguel Blanco');
  const beto = await cuenta('Beto Ramírez');
  const carla = await cuenta('Carla Gómez');

  // 1. Mis sermones: el documento con «Presentarlo en vivo» y la hoja para elegir cómo.
  const pa = await page(ana, { ...opts, mensajes: [sermon(id)] });
  await pa.goto(`${BASE}/taller/${id}/documento`);
  await pa.getByText('Presentarlo en vivo').waitFor();
  await shot(pa, `${v}-1-mis-sermones`);
  await pa.getByRole('button', { name: /Presentarlo en vivo/ }).click();
  await pa.getByText('¿Cómo lo vas a presentar?').waitFor();
  await shot(pa, `${v}-2-como-presentar`);

  // 2. Con el grupo: empezar con solo los versículos del sermón.
  await pa.getByRole('button', { name: 'Con mi grupo o célula' }).click();
  await pa.getByText(/Se leerá solo/).waitFor();
  await shot(pa, `${v}-3-empezar-con-el-grupo`);
  await pa.getByRole('button', { name: 'Empezar en vivo' }).click();
  await pa.getByText('ANTES DE EMPEZAR').waitFor();
  const S = new URL(pa.url()).pathname.split('/').pop();
  for (const c of [beto, carla]) await post('/api/vivo', { accion: 'unirseSala', sala: S }, c.llave);
  await shot(pa, `${v}-4-guion-portada`);

  // 3. Ya en la segunda parte, con su reloj y las notas abiertas (solo las ve quien guía).
  await pa.getByRole('button', { name: 'Empezar la parte 1' }).click();
  await pa.getByText('PARTE 1 DE 5').waitFor();
  await pa.getByRole('button', { name: 'Parte siguiente' }).click();
  await pa.getByText('PARTE 2 DE 5').waitFor();
  await adelantarSala(S, 14 * 60 + 5, 6 * 60 + 12);
  await pa.reload();
  await pa.getByText('PARTE 2 DE 5').waitFor();
  await pa.getByRole('button', { name: 'Mis notas de esta parte' }).click();
  await shot(pa, `${v}-5-guion-parte-y-notas`);

  // 4. Quien sigue: la parte, solo los versículos 12 y 13, en la versión de quien guía.
  const pb = await page(beto, { ...opts, version: 'rv1909' });
  await pb.goto(`${BASE}/vivo/${S}`);
  await pb.getByText('PARTE 2 DE 5').waitFor();
  await shot(pb, `${v}-6-sigue-sus-versiculos`);

  // 5. La parte 3 lleva lo que escribiste para el grupo y su dinámica a cada teléfono; esta pasó de su tiempo.
  await pa.getByRole('button', { name: 'Parte siguiente' }).click();
  await pb.getByText('Vuelve a contar la escena', { exact: false }).waitFor({ timeout: 15000 });
  await adelantarSala(S, 23 * 60 + 40, 9 * 60 + 2);
  await pb.reload();
  await pb.getByText('Vuelve a contar la escena', { exact: false }).waitFor();
  await shot(pb, `${v}-7-sigue-la-dinamica`);
  await pa.reload();
  await pa.getByText('PARTE 3 DE 5').waitFor();
  await shot(pa, `${v}-8-guion-tiempo-pasado`);
  await post('/api/vivo', { accion: 'cerrarSala', sala: S }, ana.llave);

  // 6. En la iglesia: presentar con el evento y mandar la dinámica a los teléfonos.
  await pa.goto(`${BASE}/taller/${id}/documento`);
  await pa.getByRole('button', { name: /Presentarlo en vivo/ }).click();
  await pa.getByRole('button', { name: 'En la iglesia, en vivo' }).click();
  const chip = pa.getByRole('button', { name: /Empezar el evento en vivo/ });
  await chip.waitFor();
  const E = ((await chip.textContent()) ?? '').match(/([A-Z0-9]{3}) ([A-Z0-9]{3})/).slice(1).join('');
  await chip.click();
  for (let i = 0; i < 3; i++) await pa.getByText('Siguiente', { exact: true }).click();
  await pa.getByRole('button', { name: 'Mandarla a los teléfonos' }).waitFor();
  await shot(pa, `${v}-9-presentar-con-dinamica`);
  await pa.getByRole('button', { name: 'Mandarla a los teléfonos' }).click();
  await pa.getByText('En los teléfonos de todos').waitFor();

  const pc = await page(null, { ...opts, version: 'rv1909' });
  await pc.goto(`${BASE}/evento/${E}`);
  await pc.getByText('Recuento en cadena').first().waitFor();
  await shot(pc, `${v}-10-iglesia-hace-la-dinamica`);

  // 7. La página del evento de quien predica: el punto, su reloj y el total.
  await sql`update eventos set inicio = now() - interval '17 minutes 30 seconds', punto_desde = now() - interval '5 minutes 48 seconds' where codigo = ${E}`;
  await pa.goto(`${BASE}/evento/${E}`);
  await pa.getByText(/TU EVENTO · PUNTO 3 DE 5/).waitFor();
  await shot(pa, `${v}-11-evento-reloj`);
  await pa.getByRole('button', { name: 'Interactuar: que la iglesia responda' }).click();
  await pa.getByText('UNA DINÁMICA PARA HACER JUNTOS').scrollIntoViewIfNeeded();
  await shot(pa, `${v}-12-mandar-una-dinamica`);

  // 8. El pasaje del mensaje se abre en la versión de quien predica.
  await pc.keyboard.press('Escape');
  await pc.getByRole('button', { name: /Lucas 15:11-32, leer/ }).click();
  await pc.getByText(/BES · Abrir en la Biblia/).waitFor();
  await shot(pc, `${v}-13-versiculos-en-tu-version`);
  await pa.context().close();
  await pb.context().close();
  await pc.context().close();
}
await browser.close();
await sql.end();
