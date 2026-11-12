// Pantallas del video de función «Presentar en vivo» (no es una prueba), como e2e/capturas-presentador.mjs:
// quien guía en un teléfono y Beto en otro.  node video/promo/scripts/funciones/presentar.mjs
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';

const BASE = 'http://localhost:8081';
const ROOT = new URL('../../', import.meta.url).pathname;
const OUT = `${ROOT}public/capturas/funciones/presentar`;
mkdirSync(OUT, { recursive: true });
const toques = {};
const SCALE = 2.625;
const toque = async (loc) => {
  const b = await loc.boundingBox();
  return b && { x: Math.round((b.x + b.width / 2) * SCALE), y: Math.round((b.y + b.height / 2) * SCALE) };
};
const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/biblia_e2e', { onnotice: () => {} });

async function post(path, body, llave) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(llave ? { Authorization: `Bearer ${llave}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}
const cuenta = (nombre) =>
  post('/api/comunidades', {
    accion: 'registrarse',
    nombre,
    correo: `${nombre.split(' ')[0].toLowerCase()}${Date.now()}${Math.random().toString(36).slice(2, 6)}@prueba.test`,
    clave: 'clave-segura-1',
  });

const s = (id, titulo, texto, claves, minutos, extra = {}) => ({
  id,
  titulo,
  ayuda: '',
  texto,
  claves,
  minutos,
  ...extra,
});
const mensaje = (id) => ({
  id,
  tipo: 'sermon',
  titulo: 'Mirar a los demás',
  pasaje: { book: 'php', chapter: 2, from: 5, to: 11 },
  plantilla: 'expositiva',
  observacion: '',
  tema: 'La humildad de Cristo',
  complemento: 'se hace nuestra forma de mirar a los demás',
  necesidad: '',
  gracia: '',
  secciones: [
    s(
      'i',
      'Introducción',
      '¿Alguna vez has estado en un grupo donde todos hablaban y nadie escuchaba? Pablo le escribe a una iglesia que se quería, pero que empezaba a dividirse.',
      'Pregunta: ¿qué te cuesta más, escuchar o ceder?',
      6,
    ),
    s(
      'p1',
      'Mirar arriba',
      'La primera: el problema que Pablo quiere sanar. Son las «contiendas», la «vanagloria» y el mirar «a lo suyo propio». Las notas señalan que el egocentrismo es lo contrario del cuidado genuino por los demás. (Tyndale, Filipenses 2:3) Y dentro del mismo capítulo hay un retrato triste: «todos buscan lo suyo propio, no lo que es de Cristo Jesús» (RV1909, Filipenses 2:21).\n\nLa segunda: el contraste en el mismo capítulo. Dios puso a su lado a Timoteo, que se interesa «sinceramente» por ellos (Filipenses 2:20), y a Epafrodito, que arriesgó la vida por servir (Filipenses 2:30). Antes de pedirles nada, Pablo les muestra a Cristo: el v. 7 dice que «se despojó a sí mismo».',
      '¿En qué conversación de esta semana miraste solo lo tuyo?\nSe despojó: no dejó de ser Dios, dejó sus privilegios\nTimoteo y Epafrodito: la humildad tiene nombre y apellido',
      12,
      {
        dinamica: 'quien-soy-en-la-historia',
        dinamicaPasos: [
          'Lean juntos Filipenses 2:19-30 en voz alta, un párrafo cada uno.',
          'En silencio, elige a quién te pareces más hoy: a Timoteo, a Epafrodito o a los que «buscan lo suyo» (v. 21).',
          'En parejas, cuéntale al otro a quién elegiste y por qué, en dos minutos cada uno.',
          'Vuelvan al grupo: quien quiera dice en una frase qué le pide Cristo esta semana.',
        ],
      },
    ),
    s(
      'p2',
      'Doblar la rodilla',
      'Filipenses 2:9-11. El que bajó es el que Dios levanta. Toda rodilla se dobla: la pregunta no es si, sino cuándo.',
      'La humildad no es perder: es el camino de Cristo',
      8,
    ),
    s('c', 'Conclusión', 'Haya en ustedes esta actitud (Filipenses 2:5).', '¿A quién vas a mirar primero esta semana?', 4, { dinamica: 'yo-voy-a' }),
  ],
  revision: [],
  seguimiento: '',
  minutos: 30,
  creado: '2026-11-01T10:00:00.000Z',
  actualizado: '2026-11-07T18:00:00.000Z',
  ia: '2026-11-07T18:00:00.000Z',
});

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page(c, { mensajes = [] } = {}) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, colorScheme: 'dark', locale: 'es-CO', timezoneId: 'America/Bogota' });
  const p = await ctx.newPage();
  await p.addInitScript(
    ([cu, t]) => {
      if (cu) localStorage.setItem('cuenta', cu);
      localStorage.setItem('taller', t);
      localStorage.setItem('ajustes', JSON.stringify({ version: 'rv1909' }));
    },
    [c ? JSON.stringify(c) : null, JSON.stringify(mensajes)],
  );
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name, tap = null) => {
  await p.getByText(/progreso (quedó guardado|de la cuenta)/).waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
  await wait(800);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  toques[name] = tap;
  console.log(name, tap ?? '');
};

async function adelantarSala(codigo, total, parte) {
  const [row] = await sql`select estado from vivo_salas where codigo = ${codigo}`;
  const g = row.estado.guion;
  const now = Date.now();
  g.inicio = new Date(now - total * 1000).toISOString();
  g.desde = new Date(now - parte * 1000).toISOString();
  await sql`update vivo_salas set estado = ${sql.json({ ...row.estado, guion: g })}, version = version + 1, actualizado = now() where codigo = ${codigo}`;
}

const id = `mirar-video-${Date.now()}`;
const ana = await cuenta('Miguel Blanco');
const beto = await cuenta('Beto Ramírez');
const pa = await page(ana, { mensajes: [mensaje(id)] });
await pa.goto(`${BASE}/vivo?taller=${id}`);
const empezarVivo = pa.getByRole('button', { name: 'Empezar en vivo' });
await empezarVivo.waitFor();
await wait(1500);
await shot(pa, '1-empezar', await toque(empezarVivo));
await empezarVivo.click();
await pa.getByText('ANTES DE EMPEZAR').waitFor();
const S = new URL(pa.url()).pathname.split('/').pop();
await post('/api/vivo', { accion: 'unirseSala', sala: S }, beto.llave);
for (const n of ['Lucía Gómez', 'Andrés Peña']) await post('/api/vivo', { accion: 'unirseSala', sala: S }, (await cuenta(n)).llave);
const parte1 = pa.getByRole('button', { name: 'Empezar la parte 1' });
await shot(pa, '2-portada', await toque(parte1));
await parte1.click();
await pa.getByText('PARTE 1 DE 4').waitFor();
await pa.getByRole('button', { name: 'Parte siguiente' }).click();
await pa.getByText('PARTE 2 DE 4').waitFor();
await adelantarSala(S, 14 * 60 + 5, 6 * 60 + 12);
await pa.reload();
await pa.getByText('PARTE 2 DE 4').waitFor();
const cita = pa.getByRole('button', { name: 'Mostrar Filipenses 2:20 a todos' }).first();
await shot(pa, '3-notas', await toque(cita));
await cita.click();
await pa.getByText('Filipenses 2:20 en las pantallas de todos').waitFor();
const pb = await page(beto);
await pb.goto(`${BASE}/vivo/${S}`);
await pb.getByText('VERSÍCULO 20').waitFor({ timeout: 15000 });
await shot(pb, '4-todos-ven-la-cita');
await pa.getByText('TUS PREGUNTAS PARA EL GRUPO').scrollIntoViewIfNeeded();
const preg = pa.getByRole('button', { name: /Que cada uno responda: ¿En qué conversación/ });
await shot(pa, '5-preguntas', await toque(preg));
await preg.click();
await pb.getByText('¿En qué conversación de esta semana', { exact: false }).first().waitFor({ timeout: 15000 });
await shot(pb, '6-pregunta-en-el-telefono');
const din = pa.getByRole('button', { name: 'Mostrar la dinámica a todos' });
await din.scrollIntoViewIfNeeded();
await shot(pa, '7-dinamica-boton', await toque(din));
await din.click();
await pb.getByText('Lean juntos Filipenses 2:19-30', { exact: false }).waitFor({ timeout: 15000 });
await shot(pb, '8-dinamica-para-todos');

for (const p of [pa, pb]) await p.context().close();
await browser.close();
await sql.end();
writeFileSync(`${ROOT}src/funciones/presentar.taps.json`, JSON.stringify(toques, null, 1) + '\n');
