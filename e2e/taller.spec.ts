// El Taller: preparar reflexiones, encuentros y sermones con la IA como acompañante (pregunta, sugiere,
// revisa), dinámicas, modo presentar y envío de la guía al grupo. Lo preparado se guarda en el dispositivo.

import type { Page } from '@playwright/test';

import { conSesion, cuentaNueva, expect, peticionesIA, test } from './support/fixtures';

const marca = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const acompanante = (page: Page) => page.getByRole('dialog').filter({ hasText: 'ACOMPAÑANTE' });
const paso = (page: Page, nombre: string) => page.getByRole('tab', { name: nombre });

/** Espera a que el Taller se haya guardado en el dispositivo con `texto` dentro. */
const guardado = (page: Page, texto: string) =>
  expect.poll(() => page.evaluate(() => localStorage.getItem('taller') ?? '')).toContain(texto);

test('prepara una reflexión desde cero con preguntas y sugerencias de la IA y se conserva', async ({ page, request }) => {
  const m = marca();
  await conSesion(page, await cuentaNueva(request, 'Reflexiva'));
  await page.goto('/taller');
  await page.getByRole('button', { name: /Reflexión ·/ }).click();
  await expect(page).toHaveURL(/\/taller\/[a-z0-9]+$/);
  await expect(page.getByText('Elige un pasaje para que la IA te acompañe.')).toBeVisible();

  // Elige el pasaje escribiéndolo de forma abreviada
  const pasaje = page.getByPlaceholder('Por ejemplo, Lucas 15:11-32');
  await pasaje.fill('jn 3:16');
  await pasaje.press('Enter');
  await expect(pasaje).toHaveValue('Juan 3:16');
  await expect(page.getByText(/Porque de tal manera amó Dios al mundo/)).toBeVisible();
  await page.getByPlaceholder('Cómo lo llamarás').fill(`Amor que da ${m}`);
  await page.getByPlaceholder(/Lo que ves en el texto/).fill(`Observo ${m}: Dios da a su Hijo`);

  // Pregúntame: la IA solo hace preguntas sobre el paso de observar
  await page.getByRole('button', { name: 'Pregúntame' }).click();
  const ia = acompanante(page);
  await expect(ia.getByText('Juan 3:16', { exact: true })).toBeVisible();
  await expect(ia.getByText('Preguntas del Taller simuladas:')).toBeVisible();
  await expect(ia.getByText('FUENTES')).toBeVisible();
  const [preguntas] = await peticionesIA(request, `Observo ${m}`);
  expect(JSON.stringify(preguntas.system)).toContain('Reglas del Taller');
  const encargo = JSON.stringify(preguntas.messages[0].content);
  expect(encargo).toContain('Estoy preparando una reflexión breve (5 a 10 minutos) sobre Juan 3:16');
  expect(encargo).toContain('Ahora estoy en el paso de observar el pasaje');
  expect(encargo).toContain('Hazme de 3 a 5 preguntas');

  // Cambia a Sugiéreme dentro del acompañante
  await ia.getByRole('tab', { name: 'Sugiéreme' }).click();
  await expect(ia.getByText('Sugerencia simulada del Taller: Dios ama y da.')).toBeVisible();
  const sugerir = (await peticionesIA(request, `Observo ${m}`)).find((r) =>
    JSON.stringify(r.messages[0].content).includes('Propón tres formulaciones'),
  );
  expect(sugerir).toBeTruthy();

  // Volver a Pregúntame no lo pide otra vez: cada pestaña guarda lo suyo
  await ia.getByRole('tab', { name: 'Pregúntame' }).click();
  await expect(ia.getByText('Preguntas del Taller simuladas:')).toBeVisible();
  await ia.getByRole('tab', { name: 'Sugiéreme' }).click();
  await expect(ia.getByText('Sugerencia simulada del Taller: Dios ama y da.')).toBeVisible();
  const pedidos = await peticionesIA(request, `Observo ${m}`);
  expect(pedidos.filter((r) => JSON.stringify(r.messages[0].content).includes('Hazme de 3 a 5 preguntas'))).toHaveLength(1);
  expect(pedidos.filter((r) => JSON.stringify(r.messages[0].content).includes('Propón tres formulaciones'))).toHaveLength(1);

  // Lleva sugerencias a los campos con un toque, sin escribirlas: la idea central y la necesidad
  await ia.getByRole('button', { name: 'Usar como idea central' }).click();
  await expect(ia.getByText('En la idea central')).toBeVisible();
  await ia.getByRole('button', { name: 'Añadir a «La necesidad»' }).click();
  await expect(ia.getByText('En «La necesidad»')).toBeVisible();
  // Una sin campo propio se elige de la lista, y se puede deshacer
  await ia.getByRole('button', { name: 'Añadir a…' }).click();
  await ia.getByLabel('Elegir campo').getByRole('button', { name: 'La gracia' }).click();
  await expect(ia.getByText('En «La gracia»')).toBeVisible();
  await guardado(page, 'Sugerencia simulada del Taller');
  await ia.getByRole('button', { name: 'Deshacer' }).first().click();
  await expect(ia.getByText('En «La gracia»')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('taller') ?? '')).not.toContain('Sugerencia simulada del Taller');

  // Responde al acompañante: la conversación sigue con el turno anterior
  const respuesta = `Me quedo con la segunda ${m}`;
  await ia.getByPlaceholder('Responde o pregunta algo más').fill(respuesta);
  await ia.getByLabel('Enviar').click();
  await expect(ia.getByText(`Respuesta simulada a «${respuesta}».`)).toBeVisible();
  const [seguimiento] = await peticionesIA(request, respuesta);
  expect(seguimiento.messages.map((x) => x.role)).toEqual(['user', 'assistant', 'user']);
  await ia.getByLabel('Cerrar').last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Idea central con sus palabras: lo que llevó desde la IA ya está en los campos
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByPlaceholder('Por ejemplo, el amor del Padre')).toHaveValue('El amor de Dios');
  await expect(page.getByPlaceholder('Lo que compartimos con los primeros lectores')).toHaveValue(/Necesidad simulada: sentirnos lejos de Dios/);
  await page.getByPlaceholder('Por ejemplo, el amor del Padre').fill('El amor de Dios');
  await page.getByPlaceholder('…sale a buscarnos antes de que lleguemos').fill(`da a su Hijo ${m}`);
  await expect(page.getByText(`El amor de Dios: da a su Hijo ${m}`)).toBeVisible();

  // Bosquejo: escribe en la primera parte del devocional
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByLabel('Título de la parte').first()).toHaveValue('El versículo');
  await page.getByPlaceholder('Escríbelo con tus palabras').first().fill(`Leemos Juan 3:16 juntos ${m}`);
  await guardado(page, `Leemos Juan 3:16 juntos ${m}`);

  // Al recargar sigue todo
  await page.reload();
  await expect(page.getByText(`Amor que da ${m}`).first()).toBeVisible();
  await expect(page.getByPlaceholder('Por ejemplo, Lucas 15:11-32')).toHaveValue('Juan 3:16');
  await paso(page, '2 Idea central').click();
  await expect(page.getByPlaceholder('…sale a buscarnos antes de que lleguemos')).toHaveValue(`da a su Hijo ${m}`);
  await paso(page, '3 Bosquejo').click();
  await expect(page.getByPlaceholder('Escríbelo con tus palabras').first()).toHaveValue(`Leemos Juan 3:16 juntos ${m}`);

  // Y aparece en «Mis mensajes» del Taller
  await page.goto('/taller');
  await expect(page.getByText('Mis mensajes')).toBeVisible();
  await page.getByText(`Amor que da ${m}`).click();
  await expect(page).toHaveURL(/\/taller\/[a-z0-9]+$/);
  await expect(page.getByPlaceholder('Por ejemplo, Lucas 15:11-32')).toHaveValue('Juan 3:16');
});

test('prepara un sermón desde el lector, lo revisa con la IA, lo presenta y lo borra', async ({ page, request }) => {
  const m = marca();
  await conSesion(page, await cuentaNueva(request, 'Predicador'));
  await page.goto('/juan/3/16');
  await page.getByRole('button', { name: 'Preparar', exact: true }).click();

  await expect(page).toHaveURL(/\/taller\?libro=jhn&capitulo=3&versiculo=16/);
  await expect(page.getByText(/Preparar con Juan 3:16/)).toBeVisible();
  await page.getByRole('button', { name: /Sermón ·/ }).click();

  // Con el pasaje ya elegido empieza en la idea central
  await expect(page.getByPlaceholder('Por ejemplo, el amor del Padre')).toBeVisible();
  await expect(page.getByText('Juan 3:16', { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByPlaceholder('Por ejemplo, el amor del Padre').fill(`La entrega de Dios ${m}`);
  await page.getByPlaceholder('…sale a buscarnos antes de que lleguemos').fill('nos da vida eterna');

  // Bosquejo expositivo; al cambiar de estructura se conserva lo escrito
  await paso(page, '3 Bosquejo').click();
  await expect(page.getByLabel('Título de la parte').first()).toHaveValue('Introducción: la necesidad');
  await page.getByPlaceholder('Escríbelo con tus palabras').first().fill(`Todos buscamos amor ${m}`);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('radio', { name: 'Narrativa en cinco movimientos' }).click();
  await expect(page.getByLabel('Título de la parte').first()).toHaveValue('Desequilibrio');
  await expect(page.getByPlaceholder('Escríbelo con tus palabras').first()).toHaveValue(`Todos buscamos amor ${m}`);

  // Revisión: la lista propia y la IA que revisa sin reescribir
  await paso(page, '4 Revisar').click();
  await page.getByRole('checkbox', { name: '¿Puedo decir la idea central en una frase?' }).click();
  await expect(page.getByText(/\(1 de 9\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Revisa mi borrador' }).first().click();
  const ia = acompanante(page);
  await expect(ia.getByText('Revisión simulada: la idea sale del texto.')).toBeVisible();
  const [revision] = await peticionesIA(request, `La entrega de Dios ${m}`);
  const encargo = JSON.stringify(revision.messages[0].content);
  expect(encargo).toContain('Estoy preparando un sermón (20 a 45 minutos) sobre Juan 3:16');
  expect(encargo).toContain('con la estructura «Narrativa en cinco movimientos»');
  expect(encargo).toContain('que cada punto tenga explicación, ilustración y aplicación');
  expect(encargo).toContain(`Todos buscamos amor ${m}`);
  await ia.getByLabel('Cerrar').last().click();

  // Presentar: portada con la idea central, una parte a la vez y el pasaje a un toque
  await paso(page, '5 Presentar').click();
  await page.getByRole('button', { name: 'Presentar', exact: true }).click();
  await expect(page).toHaveURL(/\/presentar$/);
  await expect(page.getByText(`La entrega de Dios ${m}: nos da vida eterna`)).toBeVisible();
  await page.getByText('Siguiente', { exact: true }).filter({ visible: true }).click();
  await expect(page.getByText('1 DE 5')).toBeVisible();
  await expect(page.getByText('Desequilibrio')).toBeVisible();
  await expect(page.getByText(`Todos buscamos amor ${m}`)).toBeVisible();
  await page.getByText('Siguiente', { exact: true }).filter({ visible: true }).click();
  await expect(page.getByText('2 DE 5')).toBeVisible();
  await expect(page.getByText('Análisis', { exact: true })).toBeVisible();
  await page.getByText('Pasaje', { exact: true }).filter({ visible: true }).click();
  const texto = page.getByRole('dialog').getByText(/de tal manera amó Dios al mundo/);
  await expect(page.getByText('Juan 3:16 · RV1909')).toBeVisible();
  await texto.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByText('Anterior', { exact: true }).filter({ visible: true }).click();
  await expect(page.getByText('1 DE 5')).toBeVisible();
  await page.getByLabel('Salir de presentar').click();
  await expect(page).toHaveURL(/\/taller\/[a-z0-9]+$/);

  // Borrar lo quita del Taller
  await paso(page, '5 Presentar').click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Borrar' }).click();
  await expect(page).toHaveURL(/\/taller$/);
  await expect(page.getByRole('button', { name: /Sermón ·/ })).toBeVisible();
  await expect(page.getByText('Mis mensajes').filter({ visible: true })).toHaveCount(0);
  await guardado(page, '[]');
});

test('el catálogo de dinámicas se filtra por momento y muestra los pasos', async ({ page }) => {
  await page.goto('/taller');
  await page.getByText('Ver las 23 dinámicas para grupos ›').click();
  await expect(page).toHaveURL(/\/taller\/dinamicas$/);
  await expect(page.getByText('Dos verdades y un deseo')).toBeVisible();

  await page.getByRole('radio', { name: 'Para aplicar y orar' }).click();
  await expect(page.getByText('Dos verdades y un deseo')).toHaveCount(0);
  const silla = page.getByRole('button', { name: /^Silla vacía/ });
  await expect(page.getByText('El líder señala una silla vacía (o un espacio en el círculo).')).toHaveCount(0);
  await silla.click();
  await expect(page.getByText('El líder señala una silla vacía (o un espacio en el círculo).')).toBeVisible();
  await expect(page.getByText('Idea de: Dinámica popular')).toBeVisible();
});

test('prepara un encuentro con una dinámica y envía la hoja al grupo sin las notas del líder', async ({ page, request }) => {
  const m = marca();
  const cuenta = await cuentaNueva(request, 'Lider');
  const grupo = `Célula ${m}`;
  const creado = await request.post('/api/comunidades', {
    headers: { Authorization: `Bearer ${cuenta.llave}` },
    data: { accion: 'crearGrupo', nombre: grupo, tipo: 'celula' },
  });
  expect(creado.ok()).toBeTruthy();
  const { id: grupoId } = (await creado.json()) as { id: string };

  await conSesion(page, cuenta);
  await page.goto('/taller');
  await page.getByRole('button', { name: /Encuentro de grupo ·/ }).click();
  const pasaje = page.getByPlaceholder('Por ejemplo, Lucas 15:11-32');
  await pasaje.fill('Juan 3:1-16');
  await pasaje.press('Enter');
  await expect(pasaje).toHaveValue('Juan 3:1-16');
  await page.getByPlaceholder('Cómo lo llamarás').fill(`Encuentro ${m}`);

  // Bosquejo DBS: añade una dinámica a «Mirar atrás», que no trae ninguna
  await paso(page, '3 Bosquejo').click();
  await expect(page.getByLabel('Título de la parte').nth(1)).toHaveValue('Mirar atrás');
  await page.getByRole('button', { name: '+ Añadir dinámica' }).first().click();
  const picker = page.getByRole('dialog').filter({ hasText: 'Elegir dinámica' });
  await picker
    .locator('div')
    .filter({ has: page.getByText('La palabra original', { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Usar esta' }) })
    .last()
    .getByRole('button', { name: 'Usar esta' })
    .click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByText('La palabra original', { exact: true })).toBeVisible();

  await page.getByPlaceholder('Preguntas o instrucciones que verá el grupo').nth(1).fill(`¿Qué recuerdas de la semana? ${m}`);
  await page.getByPlaceholder('Solo las ves tú').nth(1).fill(`Nota secreta del líder ${m}`);

  // Sugiéreme en un encuentro propone dinámicas del catálogo de la app
  await page.getByRole('button', { name: 'Sugiéreme' }).click();
  await expect(acompanante(page).getByText('Sugerencia simulada del Taller: Dios ama y da.')).toBeVisible();
  const [sugerencia] = await peticionesIA(request, `¿Qué recuerdas de la semana? ${m}`);
  const encargo = JSON.stringify(sugerencia.messages[0].content);
  expect(encargo).toContain('un encuentro de grupo pequeño (60 a 90 minutos) sobre Juan 3:1-16');
  expect(encargo).toContain('Usa solo dinámicas de este catálogo');
  expect(encargo).toContain('Mirar atrás (dinámica: palabra-original)');
  await acompanante(page).getByLabel('Cerrar').last().click();

  // La hoja para el grupo lleva la dinámica y lo del grupo, no las notas del líder
  await paso(page, '5 Presentar').click();
  await expect(page.getByText('Dinámica: La palabra original')).toBeVisible();
  await expect(page.getByText(`¿Qué recuerdas de la semana? ${m}`)).toBeVisible();
  await expect(page.getByText(`Nota secreta del líder ${m}`)).toHaveCount(0);

  await page.getByRole('radio', { name: grupo }).click();
  await page.getByRole('button', { name: 'Enviar a mi grupo' }).click();
  await expect(page.getByText('Enviado. El grupo lo verá en la pestaña «Reunión».')).toBeVisible();

  // En el grupo, pestaña Reunión
  await page.goto(`/grupos/${grupoId}`);
  await page.getByRole('tab', { name: 'Reunión' }).click();
  await expect(page.getByText(`Encuentro ${m}`)).toBeVisible();
  await expect(page.getByText('Dinámica: La palabra original')).toBeVisible();
  await expect(page.getByText(`¿Qué recuerdas de la semana? ${m}`)).toBeVisible();
  await expect(page.getByText(`Nota secreta del líder ${m}`)).toHaveCount(0);
});

test('desde un tema: la IA busca pasajes y fuentes, arma la maqueta y el mensaje queda listo para escribir', async ({ page, request }) => {
  const m = marca();
  await conSesion(page, await cuentaNueva(request, 'Temática'));
  await page.goto('/taller');
  await page.getByRole('button', { name: /Tengo algo de qué hablar/ }).click();
  await expect(page).toHaveURL(/\/taller\/tema$/);
  await expect(page.getByText('¿De qué quieres hablar?')).toBeVisible();

  const buscar = page.getByRole('button', { name: 'Buscar pasajes y fuentes' });
  await expect(buscar).toBeDisabled();
  await page.getByRole('radio', { name: /Sermón/ }).click();
  const situacion = `Jóvenes ansiosos por el futuro ${m}`;
  await page.getByLabel('Lo que quieres tratar').fill(situacion);
  // Lo contado se guarda en el dispositivo mientras se escribe
  await expect.poll(() => page.evaluate(() => localStorage.getItem('taller-tema') ?? '')).toContain(m);
  await buscar.click();

  // La IA investiga a la vista y devuelve pasajes para elegir, lo que dicen las fuentes y preguntas
  await expect(page.getByText('PASAJES · ELIGE EL PRINCIPAL')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Filipenses 4:4-9/ })).toBeVisible();
  await expect(page.getByText(/Matthew Henry señala/)).toBeVisible();
  await expect(page.getByText(/Hodge explica/)).toBeVisible();
  await expect(page.getByText('PARA AFINAR')).toBeVisible();
  await expect(page.getByText('FUENTES', { exact: true })).toBeVisible();
  const [explorar] = await peticionesIA(request, situacion);
  expect(JSON.stringify(explorar.system)).toContain('Esta vez la persona no llega con un pasaje');
  expect(JSON.stringify((explorar as { tools?: unknown }).tools)).toContain('teologia');

  // Elige otro pasaje y arma la maqueta con la estructura expositiva
  await page.getByRole('radio', { name: /Mateo 6:25-34/ }).click();
  await page.getByRole('button', { name: 'Armar la maqueta con Mateo 6:25-34' }).click();
  await expect(page.getByText('IDEA CENTRAL · ELIGE UNA')).toBeVisible();
  await expect(page.getByText('Orar en vez de afanarse')).toBeVisible();
  await expect(page.getByText('La frase queda en tu borrador: edítala y sigue tú')).toHaveCount(5);
  await expect(page.getByText('Pablo no niega el afán: lo convierte en oración con gratitud.')).toBeVisible();
  const maqueta = (await peticionesIA(request, situacion)).find((r) => JSON.stringify(r.messages[0].content).includes('Arma la maqueta'))!;
  const encargo = JSON.stringify(maqueta.messages[0].content);
  expect(encargo).toContain('un sermón (20 a 45 minutos) sobre Mateo 6:25-34');
  expect(encargo).toContain('1. Introducción: la necesidad');

  await page.getByRole('radio', { name: /El afán por el mañana/ }).click();
  await page.getByRole('button', { name: 'Crear el mensaje con esta maqueta' }).click();
  await expect(page).toHaveURL(/\/taller\/[a-z0-9]+$/);
  await expect(page.getByText('LO QUE QUERÍAS TRATAR')).toBeVisible();
  await expect(page.getByText(situacion)).toBeVisible();
  await guardado(page, 'Orar en vez de afanarse');
  const mensaje = JSON.parse(await page.evaluate(() => localStorage.getItem('taller') ?? '[]'))[0];
  expect(mensaje.pasaje).toEqual({ book: 'mat', chapter: 6, from: 25, to: 34 });
  expect(mensaje.tema).toBe('El afán por el mañana');
  expect(mensaje.secciones.map((s: { titulo: string }) => s.titulo)).toEqual([
    'Introducción: la necesidad',
    'Orar en vez de afanarse',
    'Un Padre que sabe lo que necesitamos',
    'Pensar en lo verdadero',
    'Conclusión',
  ]);
  // Cada parte empieza con la frase que la resume, para editarla
  expect(mensaje.secciones[1].texto).toBe('Pablo no niega el afán: lo convierte en oración con gratitud.');
  // El borrador del tema se borra al crear el mensaje
  expect(await page.evaluate(() => localStorage.getItem('taller-tema'))).toBeNull();

  // En el bosquejo cada parte trae su pregunta guía y su pasaje de apoyo
  await paso(page, '3 Bosquejo').click();
  await expect(page.getByText('¿Por qué Pablo pone «con hacimiento de gracias» junto a la petición?')).toBeVisible();
  await expect(page.getByText('PASAJE DE APOYO').first()).toBeVisible();
  await expect(page.getByText('Filipenses 4:6-7', { exact: false }).first()).toBeVisible();

  // El acompañante sabe lo que quería tratar
  await page.getByRole('button', { name: 'Pregúntame' }).click();
  await expect(acompanante(page).getByText('Preguntas del Taller simuladas:')).toBeVisible();
  const preguntas = (await peticionesIA(request, situacion)).find((r) => JSON.stringify(r.messages[0].content).includes('Hazme de 3 a 5 preguntas'))!;
  expect(JSON.stringify(preguntas.messages[0].content)).toContain('Empecé por esto que quiero tratar');
});
