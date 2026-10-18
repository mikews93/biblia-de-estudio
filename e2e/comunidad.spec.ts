// Comunidad: amistades con dos personas en dos navegadores, el muro con publicaciones, «me gusta» y
// comentarios, compartir un versículo resaltado, las lecturas que ven los amigos, reportes y perfiles.

import type { APIRequestContext, Browser, Page } from '@playwright/test';

import { type Cuenta, conSesion, cuentaNueva, expect, test } from './support/fixtures';

const CLAVE = 'clave-segura-1';

/** Llama a /api/comunidades como esa persona (solo para preparar lo que no es el tema de la prueba). */
async function api(request: APIRequestContext, cuenta: Cuenta, accion: string, body: Record<string, unknown> = {}) {
  const res = await request.post('/api/comunidades', {
    headers: { Authorization: `Bearer ${cuenta.llave}` },
    data: { accion, ...body },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

async function hacerAmigos(request: APIRequestContext, a: Cuenta, b: Cuenta) {
  await api(request, a, 'pedirAmistad', { usuario: b.usuario.id });
  await api(request, b, 'pedirAmistad', { usuario: a.usuario.id });
}

/** Un navegador aparte (otro teléfono u ordenador) con la sesión de esa persona. */
async function navegador(browser: Browser, cuenta?: Cuenta) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  if (cuenta) await conSesion(page, cuenta);
  return page;
}

const respuesta = (page: Page, accion: string) =>
  page.waitForResponse((r) => r.url().endsWith('/api/comunidades') && (r.request().postData() ?? '').includes(`"accion":"${accion}"`));

test('dos amigos: enlace de amistad, aceptar, publicar, me gusta y comentarios', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Lucas');
  const beto = await cuentaNueva(request, 'Beto Marcos');
  const pa = await navegador(browser, ana);
  const pb = await navegador(browser); // Beto todavía no ha entrado en este navegador

  // Ana copia su código de amistad.
  await pa.goto('/comunidades/amigos');
  await expect(pa.getByText('Tu código de amistad')).toBeVisible();
  const codigo = (await pa.getByText(/^[A-Z0-9]{8}$/).textContent())!;

  // Beto abre el enlace, entra con su cuenta y vuelve al enlace para agregarla.
  await pb.goto(`/amigo/${codigo}`);
  await expect(pb.getByText('Ana Lucas quiere leer la Biblia contigo')).toBeVisible();
  await pb.getByRole('button', { name: /Entra$/ }).click();
  await expect(pb).toHaveURL(/\/entrar$/);
  await pb.getByPlaceholder('tu@correo.com').fill(beto.usuario.correo!);
  await pb.getByPlaceholder('Tu contraseña').fill(CLAVE);
  await pb.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(pb).toHaveURL(new RegExp(`/amigo/${codigo}$`));
  await pb.getByRole('button', { name: 'Agregar a Ana Lucas' }).click();
  await expect(pb).toHaveURL(new RegExp(`/comunidades/persona/${ana.usuario.id}$`));
  await expect(pb.getByRole('button', { name: 'Solicitud enviada' })).toBeVisible();

  // Ana ve el aviso en Comunidad y acepta.
  await pa.goto('/comunidades');
  await expect(pa.getByRole('link', { name: /Amigos/ })).toContainText('1');
  await pa.getByRole('link', { name: /Amigos/ }).click();
  await expect(pa.getByText('Quieren ser tus amigos')).toBeVisible();
  await pa.getByRole('button', { name: 'Aceptar' }).click();
  await expect(pa.getByText('Tus amigos (1)')).toBeVisible();
  await expect(pa.getByText('Beto Marcos')).toBeVisible();
  await expect(pa.getByText('Quieren ser tus amigos')).toHaveCount(0);

  // Ana publica algo que aprendió, solo para amigos.
  const texto = `Hoy aprendí que la fe viene por el oír ${Date.now()}`;
  await pa.goto('/comunidades');
  await pa.getByText('Pregúntale algo a la comunidad…').click();
  await expect(pa).toHaveURL(/\/comunidades\/publicar$/);
  await pa.getByRole('radio', { name: 'Algo que aprendí' }).click();
  await pa.getByPlaceholder('¿Qué te enseñó Dios hoy en su Palabra?').fill(texto);
  await pa.getByRole('radio', { name: 'Mis amigos' }).click();
  await pa.getByRole('button', { name: 'Publicar' }).click();
  await expect(pa).toHaveURL(/\/comunidades\/publicacion\//);
  await expect(pa.getByText(texto)).toBeVisible();
  await expect(pa.getByText('Ana Lucas compartió lo que aprendió')).toBeVisible();

  // Beto lo ve en su muro, le da «me gusta» y comenta.
  await pb.goto('/comunidades');
  await expect(pb.getByText(texto)).toBeVisible();
  await expect(pb.getByText(/· Amigos$/)).toBeVisible();
  const gusto = respuesta(pb, 'meGusta');
  await pb.getByRole('button', { name: 'Me gusta', exact: true }).click();
  await gusto;
  await expect(pb.getByRole('button', { name: 'Ya no me gusta' })).toContainText('1');
  await pb.getByRole('button', { name: /Comentar/ }).click();
  await expect(pb).toHaveURL(/\/comunidades\/publicacion\//);
  await pb.getByPlaceholder('Escribe un comentario…').fill('¡Amén, Ana! Romanos 10:17');
  await pb.getByRole('button', { name: 'Comentar', exact: true }).click();
  await expect(pb.getByText('¡Amén, Ana! Romanos 10:17')).toBeVisible();
  await expect(pb.getByRole('button', { name: /1 comentario/ })).toBeVisible();

  // Ana ve el «me gusta» y el comentario de Beto; borra el comentario y después la publicación.
  await pa.goto('/comunidades');
  await expect(pa.getByText(texto)).toBeVisible();
  await expect(pa.getByRole('button', { name: 'Me gusta', exact: true })).toContainText('1');
  await pa.getByRole('button', { name: /1 comentario/ }).click();
  await expect(pa.getByText('¡Amén, Ana! Romanos 10:17')).toBeVisible();
  await expect(pa.getByText('Beto Marcos', { exact: true })).toBeVisible();
  await pa.getByText('Borrar', { exact: true }).click();
  await expect(pa.getByText('¡Amén, Ana! Romanos 10:17')).toHaveCount(0);
  await expect(pa.getByText('Sé el primero en comentar')).toBeVisible();

  await pa.getByLabel('Borrar publicación').filter({ visible: true }).click();
  await expect(pa).toHaveURL(/\/comunidades$/);
  await expect(pa.getByText(texto)).toHaveCount(0);

  await pb.goto('/comunidades');
  await expect(pb.getByText('Aquí verás lo que leen tus amigos')).toBeVisible();
  await expect(pb.getByText(texto)).toHaveCount(0);

  await pa.context().close();
  await pb.context().close();
});

test('un versículo resaltado en el lector se publica y el amigo lo ve con su cita', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Resalta');
  const beto = await cuentaNueva(request, 'Beto Lee');
  await hacerAmigos(request, ana, beto);
  const pa = await navegador(browser, ana);
  const pb = await navegador(browser, beto);
  const comentario = `Mi versículo favorito ${Date.now()}`;

  await pa.goto('/juan/3');
  await pa.getByText('Porque de tal manera amó Dios al mundo').click();
  await pa.getByLabel('Resaltar en verde').click();
  await pa.getByText('Porque de tal manera amó Dios al mundo').click();
  await pa.getByRole('button', { name: 'Compartir', exact: true }).click();
  await expect(pa.getByText('Compartir Juan 3:16')).toBeVisible();
  await pa.getByText('◎ Publicar en Comunidad').click();
  await pa.getByRole('radio', { name: 'Como resaltado' }).click();
  await pa.getByPlaceholder('¿Qué te dice este versículo? (opcional)').fill(comentario);
  await pa.getByRole('radio', { name: 'Mis amigos' }).click();
  await pa.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(pa.getByText('Publicado en Comunidad')).toBeVisible();
  await pa.getByText('Ver en Comunidad').click();
  await expect(pa).toHaveURL(/\/comunidades$/);
  await expect(pa.getByText('Ana Resalta resaltó un versículo')).toBeVisible();

  await pb.goto('/comunidades');
  await expect(pb.getByText('Ana Resalta resaltó un versículo')).toBeVisible();
  await expect(pb.getByText(comentario)).toBeVisible();
  await expect(pb.getByText(/«Porque de tal manera amó Dios al mundo/)).toBeVisible();
  await expect(pb.getByText('Juan 3:16 (RV1909)')).toBeVisible();

  // La cita lleva al versículo en el lector.
  await pb.getByText('Juan 3:16 (RV1909)').click();
  await expect(pb).toHaveURL(/\/juan\/3\/16$/);

  await pa.context().close();
  await pb.context().close();
});

test('lo que se lee aparece en el muro de los amigos y «Mostrar lo que leo» lo apaga', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Lectora');
  const beto = await cuentaNueva(request, 'Beto Amigo');
  await hacerAmigos(request, ana, beto);
  const pa = await navegador(browser, ana);
  const pb = await navegador(browser, beto);

  const terminar = async (capitulo: number) => {
    await pa.goto(`/juan/${capitulo}`);
    const leido = respuesta(pa, 'leido');
    await pa.getByRole('button', { name: 'Terminé este capítulo' }).click();
    await leido;
    await expect(pa.getByText('✓ Capítulo leído')).toBeVisible();
  };
  const lectura = pb.getByText(/^Juan [\d ,y]+$/);

  await terminar(3);
  await pb.goto('/comunidades');
  await expect(pb.getByText('Ana Lectora leyó hoy')).toBeVisible();
  await expect(lectura).toHaveText('Juan 3');

  // Ana deja de compartir lo que lee: Juan 4 no llega al muro de Beto.
  await pa.goto('/comunidades/amigos');
  const interruptor = pa.getByRole('switch');
  await expect(interruptor).toBeChecked();
  let cambio = respuesta(pa, 'compartirLecturas');
  await interruptor.click();
  await cambio;
  await expect(interruptor).not.toBeChecked();
  await pa.reload();
  await expect(pa.getByRole('switch')).not.toBeChecked();
  await terminar(4);
  await pb.reload();
  await expect(lectura).toHaveText('Juan 3');

  // Al volver a encenderlo, Juan 5 se suma a la misma publicación del día.
  await pa.goto('/comunidades/amigos');
  cambio = respuesta(pa, 'compartirLecturas');
  await pa.getByRole('switch').click();
  await cambio;
  await terminar(5);
  await pb.reload();
  await expect(lectura).toHaveText('Juan 3 y 5');
  await expect(pb.getByText('Ana Lectora leyó hoy')).toHaveCount(1);

  await pa.context().close();
  await pb.context().close();
});

test('perfil de una persona: pedir amistad, aceptarla desde el perfil, ver lo que comparte y quitarla', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Perfil');
  const beto = await cuentaNueva(request, 'Beto Perfil');
  const texto = `Solo para mis amigos ${Date.now()}`;
  await api(request, ana, 'publicar', { tipo: 'reflexion', audiencia: 'amigos', texto });
  const pa = await navegador(browser, ana);
  const pb = await navegador(browser, beto);

  // Sin amistad, Beto no ve lo que Ana comparte solo con amigos.
  await pb.goto(`/comunidades/persona/${ana.usuario.id}`);
  await expect(pb.getByText('Ana Perfil', { exact: true }).last()).toBeVisible();
  await expect(pb.getByText('0 amigos')).toBeVisible();
  await expect(pb.getByText('Cuando sean amigos verás lo que lee y comparte con sus amigos.')).toBeVisible();
  await pb.getByRole('button', { name: 'Agregar como amigo' }).click();
  await expect(pb.getByRole('button', { name: 'Solicitud enviada' })).toBeVisible();

  // Ana acepta desde el perfil de Beto.
  await pa.goto(`/comunidades/persona/${beto.usuario.id}`);
  await pa.getByRole('button', { name: 'Aceptar amistad' }).click();
  await expect(pa.getByRole('button', { name: 'Amigos ✓' })).toBeVisible();
  await expect(pa.getByText('1 amigo', { exact: true })).toBeVisible();

  // Ahora Beto ve la publicación en el perfil de Ana.
  await pb.reload();
  await expect(pb.getByRole('button', { name: 'Amigos ✓' })).toBeVisible();
  await expect(pb.getByText(texto)).toBeVisible();

  // Beto quita la amistad y la publicación deja de verse.
  await pb.getByRole('button', { name: 'Amigos ✓' }).click();
  await expect(pb.getByRole('button', { name: 'Agregar como amigo' })).toBeVisible();
  await expect(pb.getByText(texto)).toHaveCount(0);

  await pa.context().close();
  await pb.context().close();
});

test('reportar una publicación la oculta para quien reporta y, con tres reportes, para todos', async ({ browser, request }) => {
  const autora = await cuentaNueva(request, 'Autora Reportada');
  const [carla, dani, eva, fede] = await Promise.all(
    ['Carla', 'Dani', 'Eva', 'Fede'].map((n) => cuentaNueva(request, n)),
  );
  const texto = `Publicación para toda la comunidad ${Date.now()}`;
  const { id } = await api(request, autora, 'publicar', { tipo: 'pregunta', audiencia: 'todos', texto });
  const perfil = `/comunidades/persona/${autora.usuario.id}`;

  // Carla la ve en «Todos» y la reporta.
  const pc = await navegador(browser, carla);
  await pc.goto('/comunidades');
  await pc.getByRole('radio', { name: 'Todos' }).click();
  await expect(pc.getByText(texto)).toBeVisible();
  await pc.goto(perfil);
  await expect(pc.getByText(texto)).toBeVisible();
  const reporte = respuesta(pc, 'reportar');
  await pc.getByLabel('Reportar publicación').click();
  await reporte;
  await expect(pc.getByText(texto)).toHaveCount(0);
  await pc.reload();
  await expect(pc.getByText('Cuando sean amigos verás lo que lee y comparte con sus amigos.')).toBeVisible();
  await expect(pc.getByText(texto)).toHaveCount(0);

  // Con un solo reporte, los demás la siguen viendo.
  const pf = await navegador(browser, fede);
  await pf.goto(perfil);
  await expect(pf.getByText(texto)).toBeVisible();

  // Dos reportes más y se oculta para toda la comunidad, salvo para quien la escribió.
  await api(request, dani, 'reportar', { id });
  await api(request, eva, 'reportar', { id });
  await pf.reload();
  await expect(pf.getByText('Cuando sean amigos verás lo que lee y comparte con sus amigos.')).toBeVisible();
  await expect(pf.getByText(texto)).toHaveCount(0);

  const pa = await navegador(browser, autora);
  await pa.goto(perfil);
  await expect(pa.getByText(texto)).toBeVisible();

  await pc.context().close();
  await pf.context().close();
  await pa.context().close();
});
