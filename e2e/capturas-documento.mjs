// Capturas del documento final y de «Mis sermones» (no es una prueba): node e2e/capturas-documento.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts). Los mensajes se cargan ya escritos.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const s = (id, titulo, texto, claves = '', minutos = 6, extra = {}) => ({ id, titulo, ayuda: '', texto, claves, minutos, ...extra });
const ahora = '2026-10-24T18:00:00.000Z';
const sermon = {
  id: 'padre',
  tipo: 'sermon',
  titulo: 'El Padre que corre',
  pasaje: { book: 'luk', chapter: 15, from: 11, to: 32 },
  plantilla: 'expositiva',
  observacion: '',
  tema: 'El amor del Padre',
  complemento: 'sale corriendo a buscarnos antes de que terminemos de pedir perdón',
  necesidad: 'Creemos que tenemos que ganarnos el regreso a casa.',
  gracia: 'En Cristo el Padre ya salió a nuestro encuentro.',
  secciones: [
    s('i', 'Introducción', 'Todos hemos querido volver a algún lugar del que salimos mal. Ensayamos lo que vamos a decir en el camino.', 'Pregunta: ¿a dónde te da vergüenza volver?\nMi historia del viaje a Cali', 4),
    s('p1', 'El hijo que se va', 'Pedir la herencia en vida era decirle al padre «para mí ya estás muerto». El hijo no solo se va: rompe la relación.', 'Pedir la herencia = desearle la muerte\nLa provincia apartada: lejos de Dios, no solo de casa\nNo esperó a tocar fondo para ser amado', 8, { apoyo: { cita: 'Isaías 53:6', porque: 'Todos nos descarriamos como ovejas' } }),
    s('p2', 'El padre que lo ve de lejos', 'El padre lo vio cuando aún estaba lejos. Estaba mirando el camino. Un hombre mayor corriendo era una vergüenza en esa cultura, y él corre igual.', 'Lo estaba esperando: miraba el camino cada día\nCorrer era indigno para un anciano: carga la vergüenza del hijo\nLo abraza antes del discurso', 8),
    s('p3', 'El hermano que no quiere entrar', 'El mayor nunca se fue, pero tampoco estaba en casa. El padre también sale a buscarlo a él.', 'Se puede estar cerca y lejos a la vez\nEl padre sale dos veces', 6),
    s('c', 'Conclusión', 'No tienes que terminar tu discurso. El Padre ya viene corriendo. Hoy puedes dar el primer paso de vuelta.', 'Repetir la idea central\nInvitación: un momento de silencio y oración', 4),
  ],
  revision: ['una-frase', 'del-texto', 'gracia'],
  seguimiento: '',
  minutos: 30,
  creado: '2026-10-10T10:00:00.000Z',
  actualizado: ahora,
  anuncios: 'Célula de conexión el jueves a las 7 p. m. en casa de los Blanco\nBautismos el domingo 9 de noviembre: inscripciones con Mike\nRetiro de jóvenes: últimos cupos',
  terminado: '2026-10-18T20:00:00.000Z',
  ocasiones: [
    { fecha: '2026-10-19', lugar: 'Iglesia central, culto de las 10' },
    { fecha: '2026-09-07', lugar: 'Célula de los martes' },
  ],
};
const borrador = {
  ...sermon,
  id: 'ansiedad',
  titulo: 'Cuando oro y parece que Dios no escucha',
  pasaje: { book: 'php', chapter: 4, from: 6, to: 7 },
  tema: 'La paz de Dios',
  complemento: 'guarda el corazón aunque la respuesta no llegue todavía',
  necesidad: 'Los jóvenes están ansiosos por el futuro.',
  gracia: '',
  secciones: [
    s('a1', 'Introducción', 'Tres jóvenes me contaron esta semana que oran y no sienten nada.', 'Empezar con la pregunta del grupo', 4),
    s('a2', 'Por nada estéis afanosos', 'Pablo escribe desde la cárcel.', '', 8),
    s('a3', 'Punto 2', '', '', 8),
    s('a4', 'Punto 3', '', '', 8),
    s('a5', 'Conclusión', '', '', 4),
  ],
  anuncios: '',
  terminado: undefined,
  ocasiones: undefined,
  creado: '2026-10-23T10:00:00.000Z',
  actualizado: '2026-10-24T17:40:00.000Z',
};
const otro = {
  ...sermon,
  id: 'zarza',
  titulo: 'La zarza que no se consume',
  pasaje: { book: 'exo', chapter: 3, from: 1, to: 6 },
  tema: 'El llamado de Dios',
  complemento: 'nos encuentra en lo cotidiano y nos envía con su presencia',
  terminado: '2026-08-30T20:00:00.000Z',
  ocasiones: [],
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript((t) => localStorage.setItem('taller', t), JSON.stringify([borrador, sermon, otro]));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name, full = false) => {
  await wait(900);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
};
const bajar = async (p, px) => {
  await p.mouse.move(200, 500);
  await p.mouse.wheel(0, px);
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/taller`);
  await p.getByText('Mis sermones', { exact: true }).waitFor();
  await bajar(p, 520);
  await shot(p, `${prefix}-1-borradores-y-sermones`);

  await p.goto(`${BASE}/taller/ansiedad`);
  await p.getByRole('tab', { name: '3 Bosquejo' }).click();
  await bajar(p, 420);
  await shot(p, `${prefix}-2-puntos-para-hablar`);
  await p.getByRole('tab', { name: '5 Documento' }).click();
  await p.getByText('ANTES DE TERMINAR').waitFor();
  await bajar(p, -2000);
  await shot(p, `${prefix}-3-documento-borrador`);

  await p.goto(`${BASE}/taller/padre/documento`);
  await p.getByText('EN MIS SERMONES', { exact: true }).waitFor();
  await shot(p, `${prefix}-4-documento`);
  await bajar(p, 1100);
  await shot(p, `${prefix}-5-documento-puntos`);
  await bajar(p, 4000);
  await shot(p, `${prefix}-6-anuncios-y-ocasiones`);
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
