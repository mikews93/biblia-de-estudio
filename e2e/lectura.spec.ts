// Lectura: de Hoy al capítulo, pasar de capítulo, elegir libro, el panel del versículo (original, referencias,
// comentario), versiones y ajustes de lectura, y marcar capítulos como leídos.

import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { verseOfTheDay } from '../src/lib/daily';
import { BOOK_SLUGS } from '../src/lib/routes';
import { expect, test } from './support/fixtures';

type Book = { id: string; name: string; chapters: number };
type Verse = [number, string, string?];

let books: Book[] = [];

test.beforeAll(async ({ request }) => {
  books = await (await request.get('/data/books.json')).json();
});

/** Texto de un capítulo tal como lo sirve la app. */
async function capitulo(request: APIRequestContext, book: string, chapter: number, version = 'rv1909'): Promise<Verse[]> {
  const res = await request.get(`/data/text/${version}/${book}/${chapter}.json`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

const versiculo = async (request: APIRequestContext, book: string, chapter: number, verse: number, version = 'rv1909') =>
  (await capitulo(request, book, chapter, version)).find(([n]) => n === verse)![1];

const nombre = (id: string) => books.find((b) => b.id === id)!.name;
const url = (book: string, chapter: number, verse?: number) =>
  new RegExp(`/${BOOK_SLUGS[book]}/${chapter}${verse ? `/${verse}` : ''}$`);

/** Capítulo vecino, pasando de libro si hace falta (como las flechas del lector). */
function vecino(book: string, chapter: number, delta: 1 | -1) {
  const i = books.findIndex((b) => b.id === book);
  const ch = chapter + delta;
  if (ch < 1) return { book: books[i - 1].id, chapter: books[i - 1].chapters };
  if (ch > books[i].chapters) return { book: books[i + 1].id, chapter: 1 };
  return { book, chapter: ch };
}

// La pila de pantallas deja las anteriores montadas y ocultas: se busca solo en lo que se ve.
const visible = (l: Locator) => l.filter({ visible: true });
const texto = (page: Page, t: string) => visible(page.getByText(t, { exact: false })).first();

/** Pulsa un versículo en el modo párrafo para seleccionarlo. */
async function seleccionar(page: Page, text: string) {
  await texto(page, text.slice(0, 40)).click();
}

test('desde Hoy se lee el versículo del día, se pasa de capítulo y «Leer» vuelve al último capítulo', async ({
  page,
  request,
}) => {
  const daily = verseOfTheDay();
  const dailyText = await versiculo(request, daily.book, daily.chapter, daily.verse);
  await page.goto('/');

  // Hoy muestra el versículo del día con su texto real
  await expect(texto(page, `«${dailyText}»`)).toBeVisible();
  await expect(texto(page, `${nombre(daily.book)} ${daily.chapter}:${daily.verse}`)).toBeVisible();

  // Abre el capítulo con ese versículo ya seleccionado
  await page.getByRole('button', { name: 'Leer el capítulo' }).click();
  await expect(page).toHaveURL(url(daily.book, daily.chapter, daily.verse));
  await expect(texto(page, `${nombre(daily.book)} ${daily.chapter}:${daily.verse}`)).toBeVisible();
  await visible(page.getByLabel('Quitar selección')).click();

  // Capítulo siguiente: se ve su primer versículo
  const next = vecino(daily.book, daily.chapter, 1);
  await visible(page.getByLabel('Capítulo siguiente')).click();
  await expect(page).toHaveURL(url(next.book, next.chapter));
  const [, nextFirst] = (await capitulo(request, next.book, next.chapter))[0];
  await expect(texto(page, nextFirst.slice(0, 50))).toBeVisible();

  // Dos veces atrás: vuelve al del día y pasa al anterior
  await visible(page.getByLabel('Capítulo anterior')).click();
  await expect(page).toHaveURL(url(daily.book, daily.chapter));
  // (ningún versículo del día está en Génesis 1, así que siempre hay capítulo anterior)
  const prev = vecino(daily.book, daily.chapter, -1);
  await visible(page.getByLabel('Capítulo anterior')).click();
  await expect(page).toHaveURL(url(prev.book, prev.chapter));
  const [, prevFirst] = (await capitulo(request, prev.book, prev.chapter))[0];
  await expect(texto(page, prevFirst.slice(0, 50))).toBeVisible();
  const last = prev;

  // Tras recargar en Hoy, se ofrece seguir donde se quedó y la pestaña «Leer» lleva allí
  await page.goto('/');
  await expect(texto(page, 'Seguir leyendo')).toBeVisible();
  await expect(texto(page, `${nombre(last.book)} ${last.chapter}`)).toBeVisible();
  await page.getByRole('tab', { name: 'Leer' }).click();
  await expect(page).toHaveURL(url(last.book, last.chapter));
  await expect(visible(page.getByRole('button', { name: 'Elegir libro y capítulo' }))).toHaveText(
    `${nombre(last.book)} ${last.chapter}`,
  );
});

test('el selector de libros lleva al capítulo elegido y entiende una cita escrita', async ({ page, request }) => {
  await page.goto('/juan/3');
  await visible(page.getByRole('button', { name: 'Elegir libro y capítulo' })).click();
  await expect(page).toHaveURL(/\/libros$/);

  // Al filtrar por un solo libro se despliegan sus capítulos
  await visible(page.getByPlaceholder('Buscar libro o cita (Jn 3:16)')).fill('rut');
  await expect(texto(page, 'Génesis')).toBeHidden();
  await visible(page.getByText('4', { exact: true })).click();
  await expect(page).toHaveURL(url('rut', 4));
  await expect(texto(page, (await versiculo(request, 'rut', 4, 1)).slice(0, 50))).toBeVisible();

  // Una cita en el filtro abre directamente el versículo
  await visible(page.getByRole('button', { name: 'Elegir libro y capítulo' })).click();
  await visible(page.getByPlaceholder('Buscar libro o cita (Jn 3:16)')).fill('ro 8 28');
  await visible(page.getByRole('link', { name: 'Abrir Romanos 8:28 ›' })).click();
  await expect(page).toHaveURL(url('rom', 8, 28));
  await expect(texto(page, 'Romanos 8:28')).toBeVisible();
  await expect(texto(page, (await versiculo(request, 'rom', 8, 28)).slice(0, 50))).toBeVisible();

  // Abrir un libro desde la lista y elegir el capítulo
  await visible(page.getByLabel('Quitar selección')).click();
  await visible(page.getByRole('button', { name: 'Elegir libro y capítulo' })).click();
  await visible(page.getByText('Salmos', { exact: true })).click();
  await visible(page.getByText('23', { exact: true })).click();
  await expect(page).toHaveURL(url('psa', 23));
  await expect(texto(page, (await versiculo(request, 'psa', 23, 1)).slice(0, 40))).toBeVisible();

  // El último capítulo abierto queda recordado tras recargar
  await page.goto('/');
  await expect(texto(page, 'Salmos 23')).toBeVisible();
  await page.getByRole('tab', { name: 'Leer' }).click();
  await expect(page).toHaveURL(url('psa', 23));
});

type Word = [string, string, string, string, string, string, string, string];

/** Palabras del original de un versículo, tal como las sirve la app. */
async function original(request: APIRequestContext, book: string, chapter: number, verse: number): Promise<Word[]> {
  const res = await request.get(`/data/interlinear/${book}/${chapter}.json`);
  return (await res.json())[String(verse)];
}

test('el panel del versículo muestra el griego de Juan 3:16 con lema y Strong', async ({ page, request }) => {
  const amo = (await original(request, 'jhn', 3, 16)).find((w) => w[6] === 'G0025')!;
  await page.goto('/juan/3/16');
  await expect(texto(page, 'Juan 3:16')).toBeVisible();
  await visible(page.getByRole('button', { name: 'Original' })).click();

  await expect(texto(page, 'Toca una palabra para ver su lema, significado y gramática.')).toBeVisible();
  // Palabra a palabra: «ἠγάπησεν» (amó) es el verbo ἀγαπάω, G0025
  await visible(page.getByText(amo[0], { exact: true })).click();
  await expect(texto(page, 'Significado: to love · Traducción aquí: amó')).toBeVisible();
  await expect(texto(page, 'Strong G0025')).toBeVisible();
  await expect(visible(page.getByText(amo[4], { exact: true }))).toBeVisible();
  await expect(texto(page, '¿Por qué esta palabra?')).toBeVisible();
});

test('en modo estudio cada palabra hebrea de Génesis 1:1 abre su ficha, y el modo se recuerda', async ({ page, request }) => {
  const creo = (await original(request, 'gen', 1, 1)).find((w) => w[6] === 'H1254A')!;
  await page.goto('/genesis/1');
  await visible(page.getByRole('switch', { name: 'Modo estudio' })).click();
  await expect(texto(page, 'Toca una palabra hebrea para ver su significado y gramática.')).toBeVisible();

  // «בָּרָא» (creó): lema, significado y Strong
  await visible(page.getByText(creo[0], { exact: true })).first().click();
  const ficha = visible(page.getByText('Forma de diccionario')).locator('xpath=../..');
  await expect(ficha).toContainText('Génesis 1:1');
  await expect(ficha).toContainText('«creó»');
  await expect(ficha).toContainText('to create');
  await expect(ficha).toContainText('Strong H1254A');

  // Tras recargar sigue en modo estudio
  await page.reload();
  await expect(texto(page, 'Toca una palabra hebrea para ver su significado y gramática.')).toBeVisible();
});

test('una referencia cruzada de Juan 3:16 lleva al pasaje y se puede volver', async ({ page, request }) => {
  // La primera referencia (la más relevante) según los datos de la app
  const refs: [string, number][] = (await (await request.get('/data/xrefs/jhn/3.json')).json())['16'];
  const [b, c, v] = refs[0][0].split('-')[0].split('.');
  const destino = { book: b, chapter: Number(c), verse: Number(v) };
  const etiqueta = `${nombre(destino.book)} ${destino.chapter}:${destino.verse}`;
  const textoDestino = await versiculo(request, destino.book, destino.chapter, destino.verse);

  await page.goto('/juan/3/16');
  await visible(page.getByRole('button', { name: 'Referencias' })).click();
  const fila = visible(page.getByText(etiqueta, { exact: true })).first();
  // Cada referencia muestra el comienzo de su texto
  await expect(fila.locator('xpath=..')).toContainText(textoDestino.slice(0, 30));
  await fila.click();

  await expect(page).toHaveURL(url(destino.book, destino.chapter, destino.verse));
  await expect(texto(page, etiqueta)).toBeVisible(); // queda seleccionado
  await expect(texto(page, textoDestino.slice(0, 40))).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(url('jhn', 3, 16));
  await expect(visible(page.getByRole('button', { name: 'Elegir libro y capítulo' }))).toHaveText('Juan 3');
});

test('el comentario del versículo se traduce con IA y enlaza a Enduring Word', async ({ page, context }) => {
  // Enduring Word es un sitio externo: se responde aquí para no depender de la red
  await context.route('https://enduringword.com/**', (route) => route.fulfill({ body: '<h1>Enduring Word</h1>', contentType: 'text/html' }));
  await page.goto('/juan/3/16');
  await visible(page.getByRole('button', { name: 'Comentario' })).click();

  // Matthew Henry: la sección que comenta el versículo, traducida (la IA simulada)
  await expect(visible(page.getByRole('button', { name: 'Matthew Henry' }))).toBeVisible();
  await expect(texto(page, 'Traducción simulada')).toBeVisible({ timeout: 30_000 });
  await expect(texto(page, 'Comentario de toda la Biblia, Matthew Henry (1706-1721).')).toBeVisible();

  // JFB: otra fuente, también traducida
  await visible(page.getByRole('button', { name: 'JFB' })).click();
  await expect(texto(page, 'Comentario crítico y explicativo de toda la Biblia, Robert Jamieson')).toBeVisible({
    timeout: 30_000,
  });
  await expect(texto(page, 'Traducción simulada')).toBeVisible();

  // Enduring Word se abre en su sitio, en el capítulo
  const popup = page.waitForEvent('popup');
  await visible(page.getByText('Leer Juan 3 en Enduring Word ↗')).click();
  await expect(await popup).toHaveURL('https://enduringword.com/bible-commentary/es/john-3/');
});

test('cambiar de versión cambia el texto, se recuerda y también se usa en Hoy', async ({ page, request }) => {
  const [rv, bes, pdt] = await Promise.all(['rv1909', 'bes', 'pdt'].map((v) => versiculo(request, 'jhn', 3, 16, v)));
  await page.goto('/juan/3/16');
  await expect(texto(page, rv)).toBeVisible();

  await visible(page.getByRole('button', { name: 'Versión: Reina-Valera 1909. Cambiar versión' })).click();
  await visible(page.getByRole('button', { name: /La Biblia en Español Sencillo/ })).click();
  await expect(texto(page, bes)).toBeVisible();
  await expect(texto(page, rv)).toBeHidden();
  await expect(visible(page.getByRole('button', { name: /Cambiar versión/ }))).toHaveText('BES');
  await expect(texto(page, 'La Biblia en Español Sencillo · AudioBiblia.org')).toBeVisible();

  // Tras recargar sigue en la BES
  await page.reload();
  await expect(texto(page, bes)).toBeVisible();

  // Otra versión: PDT
  await visible(page.getByRole('button', { name: 'Versión: La Biblia en Español Sencillo. Cambiar versión' })).click();
  await visible(page.getByRole('button', { name: /Palabra de Dios para ti/ })).click();
  await expect(texto(page, pdt)).toBeVisible();

  // El versículo del día de Hoy sale en la versión elegida
  const daily = verseOfTheDay();
  await page.goto('/');
  await expect(texto(page, `«${await versiculo(request, daily.book, daily.chapter, daily.verse, 'pdt')}»`)).toBeVisible();
});

test('los ajustes de lectura (tema, tamaño y versículo por línea) se aplican y se recuerdan', async ({ page, request }) => {
  const v1 = await versiculo(request, 'jhn', 1, 1);
  await page.goto('/juan/1');
  const verso = () => texto(page, v1);
  await expect(verso()).toHaveCSS('font-size', '19px');

  await visible(page.getByLabel('Ajustes de lectura')).click();
  await visible(page.getByText('Oscuro', { exact: true })).click();
  for (let i = 0; i < 3; i++) await visible(page.getByLabel('Letra más grande')).click();
  await visible(page.getByRole('button', { name: 'Un versículo por línea' })).click();
  // Se cierra tocando fuera del panel (arriba a la izquierda, donde el panel no llega)
  await visible(page.getByLabel('Cerrar ajustes')).click({ position: { x: 8, y: 8 } });

  const comprobar = async () => {
    await expect(verso()).toHaveCSS('font-size', '22px');
    await expect(verso()).toHaveCSS('color', 'rgb(237, 231, 222)'); // texto del tema oscuro
    // Un versículo por línea: el 1 y el 2 ya no están en el mismo párrafo
    await expect(verso().locator('xpath=..')).not.toContainText((await versiculo(request, 'jhn', 1, 2)).slice(0, 20));
  };
  await comprobar();
  await page.reload();
  await comprobar();
  // El tema se aplica a toda la app
  await page.goto('/');
  await expect(visible(page.getByText('Versículo del día'))).toHaveCSS('color', 'rgb(224, 160, 122)');
});

test('marcar capítulos como leídos actualiza la semana y el total en Hoy', async ({ page }) => {
  await page.goto('/');
  await expect(texto(page, '0 de 5 días esta semana · 0 capítulos leídos en total')).toBeVisible();

  await page.goto('/rut/1');
  await visible(page.getByRole('button', { name: 'Terminé este capítulo' })).click();
  await expect(texto(page, 'Capítulo leído')).toBeVisible();
  await expect(texto(page, '1 de 4 capítulos de Rut')).toBeVisible();
  await expect(texto(page, '1 de 5 días esta semana. Si un día no puedes, no pasa nada.')).toBeVisible();

  // Desde el final del capítulo se sigue con el siguiente y se marca también
  await visible(page.getByText('Rut 2 ›')).click();
  await expect(page).toHaveURL(url('rut', 2));
  await visible(page.getByRole('button', { name: 'Terminé este capítulo' })).click();
  await expect(texto(page, '2 de 4 capítulos de Rut')).toBeVisible();
  // Leer dos capítulos el mismo día cuenta un solo día
  await expect(texto(page, '1 de 5 días esta semana.')).toBeVisible();

  await page.getByRole('tab', { name: 'Hoy' }).click();
  await expect(texto(page, '1 de 5 días esta semana · 2 capítulos leídos en total')).toBeVisible();

  // Se guarda en el dispositivo
  await page.reload();
  await expect(texto(page, '1 de 5 días esta semana · 2 capítulos leídos en total')).toBeVisible();
  await page.goto('/rut/1');
  await expect(texto(page, 'Capítulo leído')).toBeVisible();
  await expect(texto(page, '2 de 4 capítulos de Rut')).toBeVisible();
});

test('al bajar leyendo se apartan la cabecera y las barras, y vuelven al subir', async ({ page }) => {
  await page.goto('/juan/3');
  const titulo = visible(page.getByRole('button', { name: 'Elegir libro y capítulo' }));
  const pestañas = page.getByRole('tablist');
  await expect(titulo).toBeInViewport();
  await expect(pestañas).toBeInViewport();

  // La rueda del ratón también llega como desplazamiento en el teléfono emulado. Con la máquina cargada
  // el primer giro puede llegar antes de que el lector escuche el desplazamiento: se vuelve a girar.
  await expect(page.getByText('Porque de tal manera amó Dios al mundo')).toBeVisible();
  await page.mouse.move(200, 400);
  await expect(async () => {
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 160);
    await expect(titulo).not.toBeInViewport({ timeout: 1000 });
  }).toPass();
  await expect(pestañas).not.toBeInViewport();

  await page.mouse.wheel(0, -120);
  await expect(titulo).toBeInViewport();
  await expect(pestañas).toBeInViewport();
});

test('en el computador el ratón selecciona texto sin pasar la hoja, y las flechas del teclado pasan de capítulo', async ({
  page,
  request,
}, info) => {
  test.skip(info.project.name !== 'escritorio', 'el ratón y el teclado son del computador');
  await page.goto('/juan/3');
  const [, primero] = (await capitulo(request, 'jhn', 3))[0];
  const verso = texto(page, primero.slice(0, 40));
  // Hasta que la app arranca se ve el texto estático de la página; al arrancar se reemplaza y la selección se perdería
  await expect(visible(page.getByLabel('Capítulo siguiente'))).toBeVisible();
  await expect(verso).toBeVisible();

  // Arrastrar hacia la izquierda sobre el texto lo selecciona; no es un gesto de pasar la hoja
  const box = (await verso.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 10, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width - 10 - i * 30, y);
  await page.mouse.up();
  await expect(page).toHaveURL(url('jhn', 3));
  expect((await page.evaluate(() => window.getSelection()?.toString() ?? '')).length).toBeGreaterThan(5);

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(url('jhn', 4));
  // Mientras la hoja está pasando no hay lector enfocado: se espera a que termine
  await page.waitForFunction(() => !('nav' in document.documentElement.dataset));
  await expect(visible(page.getByRole('button', { name: 'Elegir libro y capítulo' }))).toHaveText('Juan 4');
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(url('jhn', 3));
});
