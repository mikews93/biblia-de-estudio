// Capturas de la vista de quien presenta en la lectura en vivo (no es una prueba): node e2e/capturas-presentador.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). El mensaje se carga ya escrito, como lo deja
// el borrador de la IA: notas largas con citas entre paréntesis, preguntas y una dinámica con pasos propios.
import { chromium, devices } from '@playwright/test';
import postgres from 'postgres';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
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
async function page(c, { desktop = false, theme, mensajes = [], version = 'rv1909' } = {}) {
  const scheme = {
    colorScheme: theme === 'oscuro' ? 'dark' : 'light',
    locale: 'es-CO',
  };
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: 1366, height: 860 }, ...scheme }
      : {
          ...devices['Pixel 7'],
          viewport: { width: 412, height: 915 },
          ...scheme,
        },
  );
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
const shot = async (p, name, full = false) => {
  await p
    .getByText(/progreso (quedó guardado|de la cuenta)/)
    .waitFor({ state: 'hidden', timeout: 6000 })
    .catch(() => {});
  await wait(800);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
};

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
  const id = `mirar-${v}`;
  const ana = await cuenta('Miguel Blanco');
  const beto = await cuenta('Beto Ramírez');

  // 1. Empezar con el grupo y pasar a la parte 2: mandos arriba y las notas grandes.
  const pa = await page(ana, { ...opts, mensajes: [mensaje(id)] });
  await pa.goto(`${BASE}/vivo?taller=${id}`);
  await pa.getByRole('button', { name: 'Empezar en vivo' }).click();
  await pa.getByText('ANTES DE EMPEZAR').waitFor();
  const S = new URL(pa.url()).pathname.split('/').pop();
  await post('/api/vivo', { accion: 'unirseSala', sala: S }, beto.llave);
  await shot(pa, `${v}-1-portada`);
  await pa.getByRole('button', { name: 'Empezar la parte 1' }).click();
  await pa.getByText('PARTE 1 DE 4').waitFor();
  await pa.getByRole('button', { name: 'Parte siguiente' }).click();
  await pa.getByText('PARTE 2 DE 4').waitFor();
  await adelantarSala(S, 14 * 60 + 5, 6 * 60 + 12);
  await pa.reload();
  await pa.getByText('PARTE 2 DE 4').waitFor();
  await shot(pa, `${v}-2-notas-grandes`);

  // 2. Un invitado sin cuenta sigue la lectura: cuenta entre los que leen y ve la invitación a entrar.
  const pg = await page(null, opts);
  await pg.goto(`${BASE}/vivo/${S}`);
  await pg.getByText('Entra para participar').waitFor();
  await wait(1500);
  await pa.reload();
  await pa.getByText(/sin cuenta/).waitFor({ timeout: 15000 });
  await shot(pg, `${v}-3-invitado`);

  // 3. Tocar una cita de las notas: Filipenses 2:20 en las pantallas de todos.
  await pa.getByRole('button', { name: 'Mostrar Filipenses 2:20 a todos' }).first().click();
  await pa.getByText('Filipenses 2:20 en las pantallas de todos').waitFor();
  const pb = await page(beto, opts);
  await pb.goto(`${BASE}/vivo/${S}`);
  await pb.getByText('VERSÍCULO 20').waitFor({ timeout: 15000 });
  await shot(pa, `${v}-4-cita-mostrada`);
  await shot(pb, `${v}-5-todos-ven-la-cita`);

  // 4. Las preguntas y la dinámica de la parte, más abajo en las notas.
  if (v !== 'd') {
    await pa.getByText('TUS PREGUNTAS PARA EL GRUPO').scrollIntoViewIfNeeded();
    await shot(pa, `${v}-6-preguntas-y-dinamica`);
  } else {
    await pa.getByText('TUS PREGUNTAS PARA EL GRUPO').scrollIntoViewIfNeeded();
    await shot(pa, `${v}-6-preguntas-y-dinamica`);
  }
  await pa
    .getByRole('button', {
      name: /Que cada uno responda: ¿En qué conversación/,
    })
    .click();
  await pb.getByText('¿En qué conversación de esta semana', { exact: false }).first().waitFor({ timeout: 15000 });
  await pg.getByText('Entra para responder con el grupo').waitFor({ timeout: 15000 });
  await shot(pb, `${v}-7-pregunta-en-el-telefono`);
  await shot(pg, `${v}-8-invitado-quiere-responder`);

  // 5. La dinámica explicada para quienes la hacen, en todas las pantallas.
  await pa.getByRole('button', { name: 'Mostrar la dinámica a todos' }).click();
  await pb.getByText('Lean juntos Filipenses 2:19-30', { exact: false }).waitFor({ timeout: 15000 });
  await shot(pb, `${v}-9-dinamica-para-todos`);

  // 6. Quien guía abre el capítulo entero: lo ven todos.
  await pa.getByRole('button', { name: /Leer todo Filipenses 2/ }).click();
  await pb
    .getByText(/^Filipenses 2$/)
    .first()
    .waitFor({ timeout: 2000 })
    .catch(() => {});
  await wait(4000);
  await pb.getByText('VERSÍCULO 20').waitFor({ state: 'hidden', timeout: 15000 });
  await shot(pb, `${v}-a-capitulo-entero-para-todos`);

  // 7. Presentar solo (en la iglesia o con proyector): la dinámica con sus pasos para la gente y las citas a un toque.
  await post('/api/vivo', { accion: 'cerrarSala', sala: S }, ana.llave);
  await pa.goto(`${BASE}/taller/${id}/presentar`);
  await pa.getByText('Toca «Siguiente» para empezar.').waitFor();
  for (let i = 0; i < 2; i++) await pa.getByText('Siguiente', { exact: true }).click();
  await pa.getByText('DINÁMICA · 15 MIN').waitFor();
  await shot(pa, `${v}-b-presentar-dinamica`);
  await pa.getByText('Filipenses 2:21', { exact: true }).first().click();
  await pa.getByText(/Filipenses 2:21 · /).waitFor();
  await wait(800);
  await shot(pa, `${v}-c-presentar-cita`);

  for (const p of [pa, pb, pg]) await p.context().close();
}
await browser.close();
await sql.end();
