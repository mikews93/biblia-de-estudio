// Compartir un versículo como imagen: fondos ilustrados, letras, palabras destacadas, dedicatoria y palabra original.
// La imagen descargada sale del canvas; la publicada en Comunidad se dibuja igual en el muro del amigo.

import type { APIRequestContext } from '@playwright/test';

import { type Cuenta, conSesion, cuentaNueva, expect, test } from './support/fixtures';

async function api(request: APIRequestContext, cuenta: Cuenta, accion: string, body: Record<string, unknown> = {}) {
  const res = await request.post('/api/comunidades', {
    headers: { Authorization: `Bearer ${cuenta.llave}` },
    data: { accion, ...body },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

test('la imagen se arma con fondo, letra, dedicatoria y palabra original, y se descarga', async ({ page }) => {
  await page.goto('/juan/3');
  await page.getByText('Porque de tal manera amó Dios al mundo').click();
  await page.getByRole('button', { name: 'Compartir', exact: true }).click();
  await expect(page.getByText('Compartir Juan 3:16')).toBeVisible();

  await page.getByRole('radio', { name: 'Fondo Estrellas' }).click();
  await expect(page.getByRole('radio', { name: 'Fondo Estrellas' })).toBeChecked();
  await page.getByRole('tab', { name: 'Letra' }).click();
  await page.getByRole('radio', { name: 'Letra A mano' }).click();
  await expect(page.getByRole('radio', { name: 'Letra A mano' })).toBeChecked();

  await page.getByRole('tab', { name: 'Dedicar' }).click();
  await expect(page.getByText('¿A quién le hace falta hoy este versículo?')).toBeVisible();
  await page.getByRole('radio', { name: 'Oré por ti hoy' }).click();
  await expect(page.getByLabel('Dedicatoria')).toHaveValue('Oré por ti hoy');
  await expect(page.getByText('Oré por ti hoy', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar imagen' })).toBeVisible();

  await page.getByRole('tab', { name: 'Estudio' }).click();
  await page.getByRole('radio', { name: /amó/ }).click();
  await expect(page.getByText('ēgapēsen · amó')).toBeVisible();

  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByText('Descargar', { exact: true }).click()]);
  expect(descarga.suggestedFilename()).toBe('juan-3-16.png');
  await expect(page.getByText('Imagen descargada')).toBeVisible();

  // El fondo y la letra quedan recordados para la próxima vez.
  await page.reload();
  await page.getByText('Porque de tal manera amó Dios al mundo').click();
  await page.getByRole('button', { name: 'Compartir', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Fondo Estrellas' })).toBeChecked();
});

test('la imagen publicada en Comunidad lleva su dedicatoria y su palabra original al muro del amigo', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Comparte');
  const beto = await cuentaNueva(request, 'Beto Recibe');
  await api(request, ana, 'pedirAmistad', { usuario: beto.usuario.id });
  await api(request, beto, 'pedirAmistad', { usuario: ana.usuario.id });

  const pa = await (await browser.newContext()).newPage();
  await conSesion(pa, ana);
  await pa.goto('/juan/3');
  await pa.getByText('Porque de tal manera amó Dios al mundo').click();
  await pa.getByRole('button', { name: 'Compartir', exact: true }).click();
  await pa.getByRole('radio', { name: 'Fondo Olivo' }).click();
  await pa.getByRole('tab', { name: 'Dedicar' }).click();
  await pa.getByLabel('Dedicatoria').fill('Para Beto, me acordé de ti');
  await pa.getByRole('tab', { name: 'Estudio' }).click();
  await pa.getByRole('radio', { name: /amó/ }).click();
  await pa.getByText('Publicar en Comunidad').click();
  await pa.getByRole('radio', { name: 'Mis amigos' }).click();
  await pa.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(pa.getByText('Publicado en Comunidad')).toBeVisible();

  const pb = await (await browser.newContext()).newPage();
  await conSesion(pb, beto);
  await pb.goto('/comunidades');
  await expect(pb.getByText('Para Beto, me acordé de ti')).toBeVisible();
  await expect(pb.getByText('ēgapēsen · amó')).toBeVisible();

  await pa.context().close();
  await pb.context().close();
});

test('la línea de contexto sale de los comentarios y va al pie de la imagen', async ({ page }) => {
  await page.goto('/juan/3');
  await page.getByText('Porque de tal manera amó Dios al mundo').click();
  await page.getByRole('button', { name: 'Compartir', exact: true }).click();
  await page.getByRole('tab', { name: 'Estudio' }).click();
  await page.getByRole('button', { name: 'Sugerir desde los comentarios' }).click();
  // Sin comillas ni punto final, aunque la IA los ponga.
  await expect(page.getByLabel('Contexto', { exact: true })).toHaveValue('Jesús se lo dice de noche a Nicodemo, un fariseo que vino a buscarlo');
  // En la vista previa (y en el campo para editarla).
  await expect(page.getByText('Jesús se lo dice de noche a Nicodemo, un fariseo que vino a buscarlo', { exact: true }).first()).toBeVisible();

  // Queda guardada para todos: la segunda vez no se vuelve a escribir.
  const res = await page.request.post('/api/comentario', { data: { contexto: { libro: 'jhn', capitulo: 3, versiculo: 16 } } });
  expect(await res.json()).toEqual({ texto: 'Jesús se lo dice de noche a Nicodemo, un fariseo que vino a buscarlo', fuente: 'tosn' });
});

test('una ocasión trae sus versículos, su fondo y su dedicatoria, y la IA busca para lo que pasa', async ({ page, request }) => {
  const cuenta = await cuentaNueva(request, 'Ana Ocasiones');
  await conSesion(page, cuenta);
  await page.addInitScript(() => window.localStorage.setItem('permiso-ia', 'si'));
  await page.goto('/');
  await page.getByText('Para alguien', { exact: true }).click();
  await expect(page.getByText('¿A quién le hace falta hoy un versículo?')).toBeVisible();

  await page.getByRole('radio', { name: /^Duelo/ }).click();
  await expect(page.getByText('Versículos para enviar')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar Salmos 34:18' }).click();
  await expect(page.getByText('Compartir Salmos 34:18')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Fondo Estrellas' })).toBeChecked();
  await page.getByRole('tab', { name: 'Dedicar' }).click();
  await expect(page.getByLabel('Dedicatoria')).toHaveValue('Estoy contigo');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Compartir Salmos 34:18')).toHaveCount(0);

  await page.getByLabel('Lo que está pasando').fill('mi amiga está muy angustiada por su trabajo');
  await page.getByRole('button', { name: 'Buscar versículos' }).click();
  await expect(page.getByText('Para lo que contaste')).toBeVisible();
  await expect(page.getByText('Pide no estar afanosos y presentar todo a Dios en oración.')).toBeVisible();
});

test('al llegar a la última parte de presentar, los versículos del sermón quedan como tarjetas para compartir', async ({ page }) => {
  const now = new Date().toISOString();
  const parte = (n: number, titulo: string, texto: string) => ({ id: `pl-${n}`, titulo, ayuda: '', texto, minutos: 5 });
  const mensaje = {
    id: 'para-llevar',
    tipo: 'sermon',
    titulo: 'El Padre que corre',
    pasaje: { book: 'luk', chapter: 15, from: 20, to: 24 },
    plantilla: 'expositiva',
    observacion: '',
    tema: '',
    complemento: '',
    necesidad: '',
    gracia: '',
    secciones: [parte(1, 'Lejos', 'Romanos 5:8 y Lucas 15:20.'), parte(2, 'En casa', 'Salmos 103:13.')],
    revision: [],
    seguimiento: '',
    minutos: 10,
    creado: now,
    actualizado: now,
  };
  await page.addInitScript((value) => window.localStorage.setItem('taller', value), JSON.stringify([mensaje]));
  await page.goto('/taller/para-llevar/presentar');
  await page.getByText('Siguiente', { exact: true }).click();
  await expect(page.getByText('Lejos', { exact: true })).toBeVisible();
  await expect(page.getByText('PARA LLEVAR A CASA')).toHaveCount(0);
  await page.getByText('Siguiente', { exact: true }).click();
  await expect(page.getByText('Los versículos de hoy, listos para compartir')).toBeVisible();
  // El pasaje y luego las citas de las partes, sin repetir Lucas 15:20.
  await expect(page.getByRole('button', { name: /^Compartir / })).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Compartir Romanos 5:8' })).toBeVisible();
  await page.getByRole('button', { name: 'Compartir Salmos 103:13' }).click();
  await expect(page.getByText('Compartir Salmos 103:13', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Fondo Montes' })).toBeChecked();
  await page.getByRole('tab', { name: 'Dedicar' }).click();
  await expect(page.getByLabel('Dedicatoria')).toHaveValue('El Padre que corre');
});

test('un versículo enviado a un amigo le llega con su imagen, y su «Amén» vuelve a quien lo envió', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Envía');
  const beto = await cuentaNueva(request, 'Beto Responde');
  const carla = await cuentaNueva(request, 'Carla Desconocida');
  await api(request, ana, 'pedirAmistad', { usuario: beto.usuario.id });
  await api(request, beto, 'pedirAmistad', { usuario: ana.usuario.id });

  // Solo a amigos.
  const ajeno = await request.post('/api/comunidades', {
    headers: { Authorization: `Bearer ${carla.llave}` },
    data: { accion: 'enviarVersiculo', para: beto.usuario.id, libro: 'jhn', capitulo: 3, versiculo: 16, datos: {} },
  });
  expect(ajeno.status()).toBe(403);

  const pa = await (await browser.newContext()).newPage();
  await conSesion(pa, ana);
  await pa.goto('/juan/3');
  await pa.getByText('Porque de tal manera amó Dios al mundo').click();
  await pa.getByRole('button', { name: 'Compartir', exact: true }).click();
  await pa.getByRole('radio', { name: 'Fondo Mar' }).click();
  await pa.getByRole('tab', { name: 'Dedicar' }).click();
  await pa.getByLabel('Dedicatoria').fill('Pensé en ti, Beto');
  await pa.getByText('Enviar a un amigo de Zarza').click();
  await pa.getByRole('checkbox', { name: 'Beto Responde' }).click();
  await pa.getByRole('button', { name: 'Enviar a Beto' }).click();
  await expect(pa.getByText('Enviado a Beto')).toBeVisible();

  const pb = await (await browser.newContext()).newPage();
  await conSesion(pb, beto);
  await pb.goto('/comunidades');
  await expect(pb.getByRole('link', { name: 'Versículos para ti, 1 nuevos' })).toBeVisible();
  await pb.getByRole('link', { name: 'Versículos para ti, 1 nuevos' }).click();
  await expect(pb).toHaveURL(/\/recibidos$/);
  await expect(pb.getByText('te envió un versículo')).toBeVisible();
  await expect(pb.getByText('Pensé en ti, Beto')).toBeVisible();
  await pb.getByRole('button', { name: 'Amén a Ana Envía' }).click();
  await expect(pb.getByText('Respondiste «Amén» a Ana')).toBeVisible();
  // Ya no aparece como nuevo.
  await pb.goto('/comunidades');
  await expect(pb.getByRole('link', { name: 'Versículos para ti', exact: true })).toBeVisible();

  await pa.goto('/recibidos?ver=enviados');
  await expect(pa.getByText('Beto dijo «Amén»')).toBeVisible();

  await pa.context().close();
  await pb.context().close();
});

test('el carrusel para Historias arma 3 láminas, suma una con la palabra original y las descarga todas', async ({ page }) => {
  await page.goto('/juan/3');
  await page.getByText('Porque de tal manera amó Dios al mundo').click();
  await page.getByRole('button', { name: 'Compartir', exact: true }).click();
  await page.getByRole('radio', { name: 'Carrusel' }).click();
  await expect(page.getByLabel('Lámina 1: Pregunta')).toBeVisible();
  await expect(page.getByLabel(/^Lámina \d/)).toHaveCount(3);
  await expect(page.getByLabel('Lámina 3: ¿Qué te dice?')).toBeVisible();

  await page.getByRole('radio', { name: '¿Lo sabías?' }).click();
  await expect(page.getByLabel('Pregunta para empezar')).toHaveValue('¿Lo sabías?');
  await page.getByRole('tab', { name: 'Estudio' }).click();
  await page.getByRole('radio', { name: /amó/ }).click();
  await expect(page.getByLabel('Lámina 3: A fondo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compartir 4 láminas' })).toBeVisible();

  const nombres: string[] = [];
  page.on('download', (d) => nombres.push(d.suggestedFilename()));
  await page.getByText('Descargar', { exact: true }).click();
  await expect(page.getByText('Láminas descargadas')).toBeVisible();
  await expect.poll(() => nombres.sort()).toEqual(['juan-3-16-1.png', 'juan-3-16-2.png', 'juan-3-16-3.png', 'juan-3-16-4.png']);
});

test('Mi año con la Palabra resume lo guardado y se descarga como imagen para Historias', async ({ page }) => {
  const año = new Date().getFullYear();
  const dia = (m: number, d: number) => `${año}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const ms = (m: number, d: number) => new Date(año, m - 1, d, 12).getTime();
  await page.addInitScript(
    (datos) => Object.entries(datos).forEach(([k, v]) => window.localStorage.setItem(k, JSON.stringify(v))),
    {
      progreso: { chapters: { psa: [23, 91], jhn: [3] }, days: [dia(1, 5), dia(1, 6), dia(2, 1)] },
      resaltados: { 'psa.23.1': { color: 'amarillo', at: ms(2, 1) }, 'jhn.3.16': { color: 'verde', at: ms(1, 5) } },
      notas: { 'psa.23.1': { text: 'Él me cuida', created: ms(2, 1), updated: ms(2, 1) } },
      sellos: { huellas: { 'palabra:H7462': dia(2, 1), [`dia:${dia(3, 3)}`]: dia(3, 3) }, ganados: {}, iniciado: true },
    },
  );
  await page.goto('/mi-ano');
  await expect(page.getByText(`Tu ${año} con la Palabra`)).toBeVisible();
  await expect(page.getByText('días con la Palabra')).toBeVisible();
  await expect(page.getByText('MI VERSÍCULO DEL AÑO')).toBeVisible();
  await expect(page.getByText('Salmos 23:1', { exact: true })).toBeVisible();
  await expect(page.getByText('capítulos leídos', { exact: true })).toBeVisible();
  await expect(page.getByText('el libro al que más volviste')).toBeVisible();
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByText('Descargar', { exact: true }).click()]);
  expect(d.suggestedFilename()).toBe(`mi-ano-con-la-palabra-${año}.png`);
});

test('Mi año sin nada guardado invita a empezar', async ({ page }) => {
  await page.goto('/mi-ano');
  await expect(page.getByText(/Tu año empieza hoy/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar con la lectura de hoy' })).toBeVisible();
});
