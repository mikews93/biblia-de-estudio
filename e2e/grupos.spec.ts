// Grupos de lectura: crear uno con plan, invitar y unirse, leer juntos, notas en versículos, peticiones de
// oración, preguntas de la IA para la reunión y la administración (salir, quitar, nuevo código, admins).

import type { APIRequestContext, Browser, Page } from '@playwright/test';

import { type Cuenta, conSesion, cuentaNueva, expect, peticionesIA, test } from './support/fixtures';

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function api(request: APIRequestContext, cuenta: Cuenta, accion: string, body: Record<string, unknown> = {}) {
  const res = await request.post('/api/comunidades', {
    headers: { Authorization: `Bearer ${cuenta.llave}` },
    data: { accion, hoy: hoy(), ...body },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

/** Prepara un grupo con plan (que empieza hoy) y sus miembros, sin pasar por la pantalla. */
async function grupoCon(request: APIRequestContext, nombre: string, admin: Cuenta, miembros: Cuenta[], libro = 'jhn') {
  const { id } = await api(request, admin, 'crearGrupo', { nombre, tipo: 'celula', plan: { libro, inicio: hoy(), porDia: 1 } });
  const { grupo } = await api(request, admin, 'grupo', { grupo: id });
  for (const m of miembros) await api(request, m, 'unirse', { codigo: grupo.codigo });
  return { id: id as string, codigo: grupo.codigo as string };
}

async function navegador(browser: Browser, cuenta: Cuenta) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  await conSesion(page, cuenta);
  return page;
}

const nombreUnico = (base: string) => `${base} ${Math.random().toString(36).slice(2, 7)}`;
const pestaña = (page: Page, nombre: string) => page.getByRole('tab', { name: nombre });
const visible = (page: Page, placeholder: string) => page.getByPlaceholder(placeholder).filter({ visible: true });

test('crear un grupo con plan, unirse con el código y ver quién leyó hoy', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Guía');
  const beto = await cuentaNueva(request, 'Beto Nuevo');
  const pa = await navegador(browser, ana);
  const pb = await navegador(browser, beto);
  const nombre = nombreUnico('Familia Pérez');

  // Ana crea el grupo: familia, Juan a un capítulo por día desde hoy.
  await pa.goto('/grupos');
  await expect(pa.getByText('Todavía no estás en ningún grupo.', { exact: false })).toBeVisible();
  await pa.getByRole('button', { name: 'Crear un grupo' }).click();
  await expect(pa).toHaveURL(/\/grupos\/nuevo$/);
  await pa.getByPlaceholder('Célula de los jueves').fill(nombre);
  await pa.getByRole('radio', { name: 'Familia' }).click();
  // Por defecto: Juan, un capítulo al día, desde hoy.
  const dia = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long' });
  await expect(pa.getByText(`Juan en 21 días: del ${dia} al`, { exact: false })).toBeVisible();
  await pa.getByRole('button', { name: 'Crear el grupo' }).click();

  await expect(pa).toHaveURL(/\/grupos\/[0-9a-f-]{36}\?nuevo=1$/);
  await expect(pa.getByText('Tu grupo está listo. Invita a los demás')).toBeVisible();
  await expect(pa.getByText('LECTURA DE HOY · DÍA 1 DE 21')).toBeVisible();
  await expect(pa.getByText('Nadie ha leído todavía hoy.')).toBeVisible();
  const codigo = (await pa.getByText(/^[A-Z0-9]{8}$/).textContent())!;

  // Beto se une escribiendo el código en sus grupos.
  await pb.goto('/grupos');
  await pb.getByRole('button', { name: 'Unirme con un código' }).click();
  await pb.getByPlaceholder('Código de invitación').fill(codigo.toLowerCase());
  await pb.getByRole('button', { name: 'Unirme', exact: true }).click();
  await expect(pb).toHaveURL(new RegExp(`/unirse/${codigo}$`));
  await expect(pb.getByText('TE INVITARON A UN GRUPO · FAMILIA')).toBeVisible();
  await expect(pb.getByText(nombre)).toBeVisible();
  await expect(pb.getByText('1 persona leyendo juntas')).toBeVisible();
  await pb.getByRole('button', { name: 'Unirme como Beto Nuevo' }).click();
  await expect(pb).toHaveURL(/\/grupos\/[0-9a-f-]{36}$/);
  await expect(pb.getByText('Ana Guía · administra')).toBeVisible();
  await expect(pb.getByText('Beto Nuevo (tú)')).toBeVisible();

  // Beto hace la lectura de hoy desde el grupo y vuelve desde el final del capítulo.
  await pb.getByRole('button', { name: 'Leer Juan 1' }).click();
  await expect(pb).toHaveURL(/\/juan\/1$/);
  await pb.getByRole('button', { name: 'Terminé este capítulo' }).click();
  await pb.getByText(`${nombre}: 1 de 2 leyeron hoy ›`).click();
  await expect(pb.getByText('1 de 2 ya leyeron hoy.')).toBeVisible();

  // Ana lo ve en el grupo y en su lista de grupos.
  await pa.reload();
  await expect(pa.getByText('Beto Nuevo', { exact: true })).toBeVisible();
  await expect(pa.getByText('1 de 2 ya leyeron hoy.')).toBeVisible();
  await expect(pa.getByText('Entre todos llevan 1 de 10 días de lectura esta semana (5 por persona).')).toBeVisible();
  await pa.goto('/grupos');
  await expect(pa.getByText(nombre)).toBeVisible();
  await expect(pa.getByText('FAMILIA · 2 PERSONAS')).toBeVisible();
  await expect(pa.getByText('Hoy: Juan 1')).toBeVisible();
  await expect(pa.getByText('1 de 2 leyeron la lectura de hoy')).toBeVisible();

  await pa.context().close();
  await pb.context().close();
});

test('notas del grupo en un versículo: se escriben en el grupo y en el lector, y las ven todos', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Nota');
  const beto = await cuentaNueva(request, 'Beto Nota');
  const { id } = await grupoCon(request, nombreUnico('Célula Norte'), ana, [beto]);
  const pa = await navegador(browser, ana);
  const pb = await navegador(browser, beto);
  const notaAna = `El Verbo se hizo carne: Dios con nosotros ${Date.now()}`;
  const notaBeto = `Habitó entre nosotros, lleno de gracia ${Date.now()}`;

  // Ana escribe en la pestaña Notas del grupo sobre Juan 1:14.
  await pa.goto(`/grupos/${id}`);
  await expect(pa.getByText('Todavía no hay notas en el grupo.')).toBeVisible();
  await expect(pa.getByLabel('Capítulo')).toHaveValue('1');
  await pa.getByLabel('Versículo').fill('14');
  await pa.getByPlaceholder('Lo que te llamó la atención').fill(notaAna);
  await pa.getByRole('button', { name: 'Compartir nota' }).click();
  await expect(pa.getByText(notaAna)).toBeVisible();
  await expect(pa.getByText('Juan 1:14')).toBeVisible();

  // Beto la encuentra al tocar ese versículo en el lector (pestaña Grupo) y responde ahí.
  await pb.goto('/juan/1');
  await pb.getByText('Y aquel Verbo fué hecho carne').click();
  await pb.getByRole('button', { name: 'Comentario', exact: true }).click();
  await pb.getByRole('tab', { name: 'Grupo' }).click();
  await expect(pb.getByText(notaAna)).toBeVisible();
  await expect(pb.getByText(/^Ana Nota · /)).toBeVisible();
  await visible(pb, 'Comparte con tu grupo lo que te dice este versículo').fill(notaBeto);
  await pb.getByRole('button', { name: 'Compartir nota' }).click();
  await expect(pb.getByText(notaBeto)).toBeVisible();

  // Ana ve la nota de Beto en el grupo; borra la suya y desaparece.
  await pa.reload();
  await expect(pa.getByText(notaBeto)).toBeVisible();
  await expect(pa.getByText(notaAna)).toBeVisible();
  await pa.getByText('Borrar', { exact: true }).click();
  await expect(pa.getByText(notaAna)).toHaveCount(0);
  await expect(pa.getByText(notaBeto)).toBeVisible();

  await pa.context().close();
  await pb.context().close();
});

test('peticiones de oración: compartir, «estoy orando» y marcarla respondida', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Ora');
  const beto = await cuentaNueva(request, 'Beto Ora');
  const { id } = await grupoCon(request, nombreUnico('Grupo de oración'), ana, [beto]);
  const pa = await navegador(browser, ana);
  const pb = await navegador(browser, beto);
  const peticion = `Por la operación de mi madre el jueves ${Date.now()}`;

  await pa.goto(`/grupos/${id}`);
  await pestaña(pa, 'Oración').click();
  await expect(pa.getByText('Todavía no hay peticiones. Solo las ve tu grupo.')).toBeVisible();
  await pa.getByPlaceholder('¿Por qué podemos orar contigo?').fill(peticion);
  await pa.getByRole('button', { name: 'Compartir petición' }).click();
  await expect(pa.getByText(peticion)).toBeVisible();

  await pb.goto(`/grupos/${id}`);
  await pestaña(pb, 'Oración').click();
  await expect(pb.getByText(peticion)).toBeVisible();
  await expect(pb.getByText('Dios respondió')).toHaveCount(0); // solo quien la compartió la cierra
  await pb.getByRole('button', { name: 'Estoy orando' }).click();
  await expect(pb.getByRole('button', { name: 'Estoy orando' })).toBeVisible();
  await expect(pb.getByText('1 persona ora por esto')).toBeVisible();

  // Ana ve que Beto ora por ella y marca la petición como respondida.
  await pa.reload();
  await pestaña(pa, 'Oración').click();
  await expect(pa.getByText('1 persona ora por esto')).toBeVisible();
  await pa.getByText('Dios respondió').click();
  await expect(pa.getByText('Oraciones respondidas')).toBeVisible();
  await expect(pa.getByText('Reabrir')).toBeVisible();

  await pb.reload();
  await pestaña(pb, 'Oración').click();
  await expect(pb.getByText('Oraciones respondidas')).toBeVisible();
  await expect(pb.getByText(peticion)).toBeVisible();
  await expect(pb.getByRole('button', { name: /Estoy orando/ })).toHaveCount(0);

  await pa.context().close();
  await pb.context().close();
});

test('pedir oración sin mi nombre y recibir ánimos que solo yo leo', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Callada');
  const beto = await cuentaNueva(request, 'Beto Anima');
  const caro = await cuentaNueva(request, 'Caro Mira');
  const { id } = await grupoCon(request, nombreUnico('Célula'), ana, [beto, caro]);
  const pa = await navegador(browser, ana);
  const pb = await navegador(browser, beto);
  const pc = await navegador(browser, caro);
  const peticion = `Oren por mí, es un tiempo difícil ${Date.now()}`;

  await pa.goto(`/grupos/${id}?tab=oracion`);
  await pa.getByPlaceholder('¿Por qué podemos orar contigo?').fill(peticion);
  await pa.getByRole('checkbox', { name: /Sin mi nombre/ }).click();
  await pa.getByRole('button', { name: 'Compartir petición' }).click();
  await expect(pa.getByText('Tú, sin tu nombre', { exact: false })).toBeVisible();

  // Beto no sabe quién la pidió, ni por la API; le envía ánimo.
  const { peticiones } = await api(request, beto, 'peticiones', { grupo: id });
  const suya = peticiones.find((p: { texto: string }) => p.texto === peticion);
  expect(suya.autor).toBeNull();
  expect(suya.animos).toBeNull();
  await pb.goto(`/grupos/${id}?tab=oracion`);
  await expect(pb.getByTestId('peticion-grupo').getByText('Alguien del grupo', { exact: false })).toBeVisible();
  await pb.getByRole('button', { name: 'Enviar ánimo' }).click();
  await pb.getByRole('button', { name: 'Estoy orando por ti hoy.' }).click();
  await pb.getByTestId('enviar-animo').getByRole('button', { name: 'Enviar ánimo' }).click();
  await expect(pb.getByRole('button', { name: 'Le enviaste ánimo' })).toBeVisible();

  // Caro no puede leer los ánimos de otra persona.
  const res = await request.post('/api/comunidades', {
    headers: { Authorization: `Bearer ${caro.llave}` },
    data: { accion: 'animos', peticion: suya.id },
  });
  expect(res.status()).toBe(403);
  await pc.goto(`/grupos/${id}?tab=oracion`);
  await expect(pc.getByText(peticion)).toBeVisible();
  await expect(pc.getByText('Estoy orando por ti hoy.')).toHaveCount(0);

  // Ana lo lee.
  await pa.reload();
  await pa.getByText('Te enviaron un ánimo', { exact: false }).click();
  await expect(pa.getByTestId('mis-animos').getByText('Estoy orando por ti hoy.')).toBeVisible();
  await expect(pa.getByTestId('mis-animos').getByText('Beto Anima', { exact: false })).toBeVisible();

  for (const p of [pa, pb, pc]) await p.context().close();
});

test('la IA sugiere preguntas para la reunión y el grupo las comparte sin volver a pedirlas', async ({ browser, request }, info) => {
  const ana = await cuentaNueva(request, 'Ana Líder');
  const beto = await cuentaNueva(request, 'Beto Anfitrión');
  const { id } = await grupoCon(request, nombreUnico('Célula Filipenses'), ana, [beto], 'php');
  const pa = await navegador(browser, ana);
  const pb = await navegador(browser, beto);
  // Cada proyecto usa su capítulo para contar las peticiones a la IA sin mezclarse.
  const capitulo = info.project.name === 'movil' ? 2 : 3;
  const marca = `Pasaje para la reunión: Filipenses ${capitulo} (`;
  const antes = (await peticionesIA(request, marca)).length;

  await pa.goto(`/grupos/${id}`);
  await pestaña(pa, 'Reunión').click();
  await expect(pa.getByRole('radio', { name: 'Filipenses 1' })).toBeVisible();
  await pa.getByLabel('Capítulo').fill(String(capitulo));
  await pa.getByRole('button', { name: 'Sugerir preguntas' }).click();
  await expect(pa.getByText('1. ¿Qué nos enseña este pasaje sobre Dios?')).toBeVisible();
  await expect(pa.getByText('2. ¿Cómo lo viviremos esta semana?')).toBeVisible();
  await expect(pa.getByText('Sugeridas por IA a partir de la Reina-Valera 1909.')).toBeVisible();
  const enviadas = await peticionesIA(request, marca);
  expect(enviadas.length).toBe(antes + 1);
  // La IA recibió el texto del capítulo elegido.
  expect(JSON.stringify(enviadas.at(-1)!.messages)).toContain(capitulo === 2 ? 'Haya, pues, en vosotros este sentir' : 'que os gocéis en el Señor');

  // Beto, en el mismo grupo, recibe las mismas preguntas sin otra llamada a la IA.
  await pb.goto(`/grupos/${id}`);
  await pestaña(pb, 'Reunión').click();
  await pb.getByLabel('Capítulo').fill(String(capitulo));
  await pb.getByRole('button', { name: 'Sugerir preguntas' }).click();
  await expect(pb.getByText('1. ¿Qué nos enseña este pasaje sobre Dios?')).toBeVisible();
  expect((await peticionesIA(request, marca)).length).toBe(antes + 1);

  // «Otras preguntas» sí las pide de nuevo.
  await pb.getByRole('button', { name: 'Otras preguntas' }).click();
  await expect.poll(async () => (await peticionesIA(request, marca)).length).toBe(antes + 2);
  await expect(pb.getByText('1. ¿Qué nos enseña este pasaje sobre Dios?')).toBeVisible();

  await pa.context().close();
  await pb.context().close();
});

test('administrar: hacer admin, quitar a alguien y cambiar el código de invitación', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Admin');
  const beto = await cuentaNueva(request, 'Beto Ayuda');
  const ciro = await cuentaNueva(request, 'Ciro Sale');
  const { id, codigo } = await grupoCon(request, nombreUnico('Iglesia Centro'), ana, [beto, ciro]);
  const pa = await navegador(browser, ana);
  const pb = await navegador(browser, beto);
  const pc = await navegador(browser, ciro);

  // Beto, sin ser admin, no puede editar ni cambiar el código.
  await pb.goto(`/grupos/${id}`);
  await expect(pb.getByText('Beto Ayuda (tú)')).toBeVisible();
  await expect(pb.getByRole('button', { name: 'Cambiar el código de invitación' })).toHaveCount(0);
  await expect(pb.getByText('Hacer admin')).toHaveCount(0);

  // Ana hace admin a Beto y quita a Ciro.
  await pa.goto(`/grupos/${id}`);
  await expect(pa.getByText('Beto Ayuda', { exact: true })).toBeVisible();
  await pa.getByText('Hacer admin').first().click(); // Beto, el primero en unirse
  await expect(pa.getByText('Beto Ayuda · administra')).toBeVisible();
  await expect(pa.getByText('Ciro Sale', { exact: true })).toBeVisible();
  await pa.getByText('Quitar', { exact: true }).last().click();
  await expect(pa.getByText('Ciro Sale', { exact: true })).toHaveCount(0);

  await pc.goto(`/grupos/${id}`);
  await expect(pc.getByText('No perteneces a este grupo')).toBeVisible();
  await pc.goto('/grupos');
  await expect(pc.getByText('Todavía no estás en ningún grupo.', { exact: false })).toBeVisible();

  // Beto, ya admin, cambia el código: el enlace viejo deja de valer y el nuevo funciona.
  await pb.reload();
  await expect(pb.getByText('Beto Ayuda (tú) · administra')).toBeVisible();
  await pb.getByRole('button', { name: 'Cambiar el código de invitación' }).click();
  await expect(pb.getByText(/^[A-Z0-9]{8}$/)).not.toHaveText(codigo);
  const nuevo = (await pb.getByText(/^[A-Z0-9]{8}$/).textContent())!;

  await pc.goto(`/unirse/${codigo}`);
  await expect(pc.getByText('Ese código de invitación no existe o ya cambió')).toBeVisible();
  await pc.goto(`/unirse/${nuevo}`);
  await expect(pc.getByText('2 personas leyendo juntas')).toBeVisible();
  await pc.getByRole('button', { name: 'Unirme como Ciro Sale' }).click();
  await expect(pc.getByText('Ciro Sale (tú)')).toBeVisible();

  await pa.context().close();
  await pb.context().close();
  await pc.context().close();
});

test('si el único admin sale del grupo, pasa a administrarlo quien lleva más tiempo', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Fundadora');
  const beto = await cuentaNueva(request, 'Beto Primero');
  const ciro = await cuentaNueva(request, 'Ciro Segundo');
  const nombre = nombreUnico('Amigos del martes');
  const { id } = await grupoCon(request, nombre, ana, [beto, ciro]);
  const pa = await navegador(browser, ana);
  const pb = await navegador(browser, beto);

  await pa.goto(`/grupos/${id}`);
  await expect(pa.getByText('Ana Fundadora (tú) · administra')).toBeVisible();
  await pa.getByRole('button', { name: 'Salir del grupo' }).click();
  await expect(pa).toHaveURL(/\/grupos$/);
  await expect(pa.getByText('Todavía no estás en ningún grupo.', { exact: false })).toBeVisible();

  await pb.goto(`/grupos/${id}`);
  await expect(pb.getByText('Beto Primero (tú) · administra')).toBeVisible();
  await expect(pb.getByText('Ana Fundadora')).toHaveCount(0);

  // Como admin nuevo, Beto puede editar el grupo.
  await pb.getByText('Editar', { exact: true }).click();
  await expect(pb).toHaveURL(new RegExp(`/grupos/nuevo\\?editar=${id}$`));
  await expect(pb.getByPlaceholder('Célula de los jueves')).toHaveValue(nombre);
  await pb.getByPlaceholder('Célula de los jueves').fill(`${nombre} (nuevo)`);
  await pb.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(pb).toHaveURL(new RegExp(`/grupos/${id}$`));
  await expect(pb.getByText(`${nombre} (nuevo)`).filter({ visible: true }).first()).toBeVisible();

  await pa.context().close();
  await pb.context().close();
});
