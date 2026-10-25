// Capturas de las mejoras del Taller tras usarlo en grupo (no es una prueba): opciones al mantener pulsado o deslizar,
// anuncios al final de presentar, pasaje con búsqueda por IA y campos que crecen.
// node e2e/capturas-pulir-taller.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
// La búsqueda por IA se responde aquí mismo (page.route), sin cuenta real.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const s = (id, titulo, texto, claves = '', minutos = 6) => ({ id, titulo, ayuda: '', texto, claves, minutos });
const sermon = {
  id: 'padre',
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
    s('i', 'Introducción', 'Todos hemos querido volver a algún lugar del que salimos mal.', 'Pregunta: ¿a dónde te da vergüenza volver?', 4),
    s('p1', 'El hijo que se va', 'Pedir la herencia en vida era decirle al padre «para mí ya estás muerto».', 'La provincia apartada', 8),
    s('c', 'Conclusión', 'No tienes que terminar tu discurso. El Padre ya viene corriendo.', 'Invitación: silencio y oración', 4),
  ],
  revision: [],
  seguimiento: '',
  minutos: 30,
  creado: '2026-10-10T10:00:00.000Z',
  actualizado: '2026-10-24T18:00:00.000Z',
  anuncios: 'Célula de conexión el jueves a las 7 p. m. en casa de los Blanco\nBautismos el domingo 9 de noviembre: inscripciones con Mike\nRetiro de jóvenes: últimos cupos',
  terminado: '2026-10-18T20:00:00.000Z',
  ocasiones: [{ fecha: '2026-10-19', lugar: 'Iglesia central' }],
};
const borrador = {
  ...sermon,
  id: 'ansiedad',
  titulo: 'Cuando oro y parece que Dios no escucha',
  pasaje: { book: 'php', chapter: 4, from: 6, to: 7 },
  tema: 'La paz de Dios',
  secciones: [
    s('a1', 'Introducción', 'Tres jóvenes me contaron esta semana que oran y no sienten nada.', '', 4),
    s('a2', 'Por nada estéis afanosos', '', '', 8),
  ],
  anuncios: '',
  terminado: undefined,
  ocasiones: undefined,
  actualizado: '2026-10-24T17:40:00.000Z',
};
const encuentro = {
  ...borrador,
  id: 'grupo',
  tipo: 'encuentro',
  titulo: '',
  pasaje: null,
  plantilla: 'dbs',
  tema: '',
  complemento: '',
  secciones: [],
  actualizado: '2026-10-25T04:00:00.000Z',
};
const zarza = { ...sermon, id: 'zarza', titulo: 'La zarza que no se consume', pasaje: { book: 'exo', chapter: 3, from: 1, to: 6 }, tema: 'El llamado de Dios', complemento: 'nos encuentra en lo cotidiano', terminado: '2026-08-30T20:00:00.000Z', ocasiones: [] };

const RESULTADOS = {
  results: [
    { ref: 'luk.15.11-luk.15.24', label: 'Lucas 15:11-24', version: 'rv1909', text: 'Un hombre tenía dos hijos; y el menor de ellos dijo á su padre: Padre, dame la parte de la hacienda que me pertenece…', reason: 'El hijo menor vuelve a casa y el padre corre a recibirlo: la imagen más clara de volver a Dios.' },
    { ref: 'hos.14.1-hos.14.4', label: 'Oseas 14:1-4', version: 'rv1909', text: 'CONVIÉRTETE, oh Israel, á Jehová tu Dios: porque por tu pecado has caído.', reason: 'Dios llama a su pueblo a volver y promete sanar su rebelión y amarlo de pura gracia.' },
    { ref: 'isa.55.6-isa.55.7', label: 'Isaías 55:6-7', version: 'rv1909', text: 'Buscad á Jehová mientras puede ser hallado, llamadle en tanto que está cercano.', reason: 'Invitación a volver: Dios es amplio en perdonar.' },
  ],
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript(
    ([t, c]) => {
      localStorage.setItem('taller', t);
      localStorage.setItem('cuenta', c);
    },
    [JSON.stringify([encuentro, borrador, sermon, zarza]), JSON.stringify({ llave: 'prueba', usuario: { id: 'u1', nombre: 'Mike', correo: null } })],
  );
  await p.route('**/api/buscar', async (r) => {
    await wait(700);
    await r.fulfill({ json: RESULTADOS });
  });
  await p.route('**/api/sincronizar**', (r) => r.fulfill({ status: 503, json: { error: 'sin red' } }));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(800);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const bajar = async (p, px) => {
  await p.mouse.move(200, 500);
  await p.mouse.wheel(0, px);
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  // 1. La lista con la pista, y una fila deslizada
  await p.goto(`${BASE}/taller`);
  await p.getByText('Mis sermones', { exact: true }).waitFor();
  await bajar(p, 560);
  await shot(p, `${prefix}-1-lista`);
  const fila = p.getByLabel('Sermón: El Padre que corre');
  const caja = await fila.boundingBox();
  if (!opts.desktop) {
    // Con el dedo (eventos táctiles de verdad): el ratón no desliza, en el computador está el clic derecho.
    const cdp = await p.context().newCDPSession(p);
    const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const y = caja.y + caja.height / 2;
    const x0 = caja.x + caja.width - 30;
    await toque('touchStart', x0, y);
    for (let i = 1; i <= 10; i++) {
      await toque('touchMove', x0 - i * 18, y);
      await wait(16);
    }
    await toque('touchEnd');
    await shot(p, `${prefix}-2-deslizar`);
    await p.getByRole('button', { name: 'Borrar', exact: true }).click();
    await wait(300);
    await shot(p, `${prefix}-3-deshacer`);
    await p.getByRole('button', { name: 'Deshacer' }).click();
    await wait(400);
  }
  // 2. Mantener pulsado (clic derecho en el computador)
  const f2 = await p.getByLabel('Sermón: El Padre que corre').boundingBox();
  if (opts.desktop) await p.mouse.click(f2.x + 60, f2.y + 40, { button: 'right' });
  else {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: f2.x + 60, y: f2.y + 40 }] });
    await wait(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await p.getByText('Borrar este sermón').waitFor();
  await shot(p, `${prefix}-4-opciones`);

  // 3. El pasaje: idea → IA → elegir
  await p.goto(`${BASE}/taller/grupo`);
  await p.getByLabel('Pasaje: escribe una cita, unas palabras o una idea').waitFor();
  await shot(p, `${prefix}-5-pasaje-vacio`);
  await p.getByLabel('Pasaje: escribe una cita, unas palabras o una idea').fill('volver a Dios después de alejarse');
  await p.getByText('Buscar pasajes sobre').waitFor();
  await shot(p, `${prefix}-6-pasaje-idea`);
  await p.keyboard.press('Enter');
  await p.getByText('3 PASAJES PARA', { exact: false }).waitFor();
  await shot(p, `${prefix}-7-pasaje-resultados`);
  await p.getByLabel('Usar Lucas 15:11-24').click();
  await p.getByText('Ver todo el pasaje').waitFor();
  await shot(p, `${prefix}-8-pasaje-elegido`);
  await p.getByLabel('Pasaje: escribe una cita, unas palabras o una idea').fill('1 jn 4 7');
  await p.getByText('Usar 1 Juan 4:7').waitFor();
  await shot(p, `${prefix}-9-pasaje-cita`);

  // 4. Campos que crecen
  await p.goto(`${BASE}/taller/ansiedad`);
  await p.getByRole('tab', { name: '3 Bosquejo' }).click();
  const campo = p.getByPlaceholder('Escríbelo con tus palabras').nth(1);
  await campo.click();
  await campo.fill(
    'Pablo escribe desde la cárcel, no desde un lugar cómodo. No dice «no se preocupen porque todo va a salir bien», sino «en toda oración y ruego, con hacimiento de gracias». La paz no llega porque se resolvió el problema, sino porque lo pusimos en las manos de Dios.\n\nPregunta para el grupo: ¿qué te quita la paz esta semana?\n\nIlustración: la carta que mi abuela escribió durante la guerra.',
  );
  await campo.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await shot(p, `${prefix}-10-campo-crece`);

  // 5. Presentar: los anuncios al final
  await p.goto(`${BASE}/taller/padre/presentar`);
  await p.getByText('Toca «Siguiente» para empezar.', { exact: false }).waitFor();
  for (let i = 0; i < 3; i++) await p.getByText('Siguiente', { exact: true }).click();
  await p.getByText('Anuncios', { exact: true }).last().click();
  await p.getByText('AL TERMINAR').waitFor();
  await shot(p, `${prefix}-11-presentar-anuncios`);
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
