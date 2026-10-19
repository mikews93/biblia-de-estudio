// Estudio con IA desde el lector: versículo, capítulo, palabra del original, preguntas de seguimiento y cuenta.
// La IA es la simulada de e2e/support/mock-anthropic.ts.

import type { Page, Request } from '@playwright/test';

import { conSesion, correoUnico, cuentaNueva, expect, modoProfundo, peticionesIA, test } from './support/fixtures';

// «amó» en griego, tal como viene en los datos de STEPBible (con oxía, no con tonos)
const AMO = 'ἠγ\u1f71πησεν';
const ESTUDIO = 'Estudio simulado del pasaje: Dios ama al mundo y da a su Hijo.';

const esEstudio = (r: Request) => r.url().endsWith('/api/estudiar') && r.method() === 'POST';
const panel = (page: Page, kicker = 'ESTUDIO') => page.getByRole('dialog').filter({ hasText: kicker });

test.beforeEach(({ page }) => modoProfundo(page));

test('sin cuenta, el estudio pide crearla y al registrarse sigue solo', async ({ page }) => {
  await page.goto('/juan/3/16');
  await page.getByRole('button', { name: 'Estudiar', exact: true }).click();

  const estudio = panel(page);
  await expect(estudio.getByText('Estudia con IA')).toBeVisible();
  await expect(estudio.getByText(ESTUDIO)).toHaveCount(0);

  // Crea la cuenta desde la invitación: el estudio no debe tapar el formulario
  await estudio.getByRole('button', { name: 'Crear cuenta gratis' }).click();
  await expect(page).toHaveURL(/\/registro$/);
  await page.getByPlaceholder('Así te verán tus grupos y amigos').fill('Lectora Nueva');
  await page.getByPlaceholder('tu@correo.com').fill(correoUnico('lectora'));
  await page.getByPlaceholder('Elige una contraseña').fill('clave-segura-1');
  const pedido = page.waitForRequest(esEstudio);
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();

  // Vuelve al lector y el estudio se genera sin volver a pedirlo
  await expect(page).toHaveURL(/\/juan\/3\/16$/);
  expect((await pedido).headers()['authorization']).toMatch(/^Bearer .+/);
  await expect(panel(page).getByText(ESTUDIO)).toBeVisible();
});

test('estudia Juan 3:16 con fuentes y salta al versículo citado', async ({ page, request }) => {
  await conSesion(page, await cuentaNueva(request, 'Estudiante'));
  await page.goto('/juan/3/16');

  const pedido = page.waitForRequest(esEstudio);
  await page.getByRole('button', { name: 'Estudiar', exact: true }).click();
  expect((await pedido).postDataJSON()).toMatchObject({ book: 'jhn', chapter: 3, verse: 16, messages: [] });

  const estudio = panel(page);
  await expect(estudio.getByText('Juan 3:16', { exact: true })).toBeVisible();
  await expect(estudio.getByText(ESTUDIO)).toBeVisible();
  await expect(estudio.getByText('FUENTES')).toBeVisible();

  // La fuente 1 es el primer bloque del documento: Juan 3:1. Al tocarla se abre ese versículo
  await estudio.getByText('Juan 3:1', { exact: true }).click();
  await expect(page).toHaveURL(/\/juan\/3\/1$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Juan 3:1', { exact: true })).toBeVisible();
});

test('una pregunta de seguimiento lleva la conversación anterior a la IA', async ({ page, request }) => {
  await conSesion(page, await cuentaNueva(request, 'Preguntona'));
  await page.goto('/juan/3/16');
  await page.getByRole('button', { name: 'Estudiar', exact: true }).click();
  const estudio = panel(page);
  await expect(estudio.getByText(ESTUDIO)).toBeVisible();

  const pregunta = `¿Qué significa unigénito? ${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  await estudio.getByPlaceholder('Pregunta sobre Juan 3:16').fill(pregunta);
  await estudio.getByLabel('Enviar pregunta').click();

  await expect(estudio.getByText(pregunta, { exact: true })).toBeVisible();
  await expect(estudio.getByText(`Respuesta simulada a «${pregunta}».`)).toBeVisible();
  // El estudio sigue arriba
  await expect(estudio.getByText(ESTUDIO)).toBeVisible();

  // El servidor mandó el pasaje y los turnos anteriores, en orden
  const [recibida] = await peticionesIA(request, pregunta);
  expect(recibida.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  expect(JSON.stringify(recibida.messages[0].content)).toContain('Prepara un estudio de Juan 3:16');
  expect(recibida.messages[1].content).toContain(ESTUDIO);
  expect(recibida.messages[2].content).toBe(pregunta);
});

test('«¿Por qué esta palabra?» desde el interlineal estudia la palabra griega', async ({ page, request }) => {
  await conSesion(page, await cuentaNueva(request, 'Griego'));
  await page.goto('/juan/3/16');
  await page.getByRole('switch', { name: 'Modo estudio' }).click();

  // Toca «amó» bajo Juan 3:16 y abre su ficha
  await page.getByLabel(`${AMO}, amó`).click();
  const ficha = page.getByRole('dialog').filter({ hasText: 'Forma de diccionario' });
  await expect(ficha.getByText('ēgapēsen')).toBeVisible();
  await expect(ficha.getByText('Juan 3:16')).toBeVisible();

  const pedido = page.waitForRequest(esEstudio);
  await ficha.getByRole('button', { name: '¿Por qué esta palabra?' }).click();
  expect((await pedido).postDataJSON()).toMatchObject({ book: 'jhn', chapter: 3, verse: 16, word: 2 });

  const estudio = panel(page, '¿POR QUÉ ESTA PALABRA?');
  await expect(estudio.getByText(`${AMO} en Juan 3:16`)).toBeVisible();
  await expect(estudio.getByText(ESTUDIO)).toBeVisible();
  await expect(estudio.getByText('¿Por qué no se tradujo de otra forma?')).toBeVisible();

  // La IA recibió el encargo de explicar esa palabra
  const recibidas = await peticionesIA(request, `tocó la palabra griega ${AMO}`);
  expect(recibidas.length).toBeGreaterThan(0);
});

test('estudia el capítulo entero y sigue con una sugerencia', async ({ page, request }) => {
  await conSesion(page, await cuentaNueva(request, 'Capitulo'));
  await page.goto('/juan/3');

  const pedido = page.waitForRequest(esEstudio);
  await page.getByRole('button', { name: 'Estudiar este capítulo' }).click();
  const cuerpo = (await pedido).postDataJSON();
  expect(cuerpo).toMatchObject({ book: 'jhn', chapter: 3, messages: [] });
  expect(cuerpo.verse).toBeUndefined();

  const estudio = panel(page);
  await expect(estudio.getByText('Juan 3', { exact: true })).toBeVisible();
  await expect(estudio.getByText(ESTUDIO)).toBeVisible();

  const seguimiento = page.waitForRequest(esEstudio);
  await estudio.getByText('¿Cómo lo aplico hoy?', { exact: true }).click();
  const turnos = (await seguimiento).postDataJSON().messages;
  expect(turnos).toEqual([
    { role: 'assistant', text: expect.stringContaining(ESTUDIO) },
    { role: 'user', text: '¿Cómo lo aplico hoy?' },
  ]);
  await expect(estudio.getByText('Respuesta simulada a «¿Cómo lo aplico hoy?».')).toBeVisible();

  // Al cerrar se vuelve al capítulo
  await estudio.getByLabel('Cerrar estudio').last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('con la sesión caducada pide entrar de nuevo y luego estudia', async ({ page, request }) => {
  const cuenta = await cuentaNueva(request, 'Caducada');
  await conSesion(page, { ...cuenta, llave: 'llave-que-ya-no-vale' });
  await page.goto('/juan/3/16');
  await page.getByRole('button', { name: 'Estudiar', exact: true }).click();

  const estudio = panel(page);
  await expect(estudio.getByText('Estudia con IA')).toBeVisible();
  // La sesión inválida se olvida en el dispositivo
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cuenta') ?? '{}').llave ?? null))
    .toBeNull();

  await estudio.getByRole('button', { name: /Entra$/ }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByPlaceholder('tu@correo.com').fill(cuenta.usuario.correo!);
  await page.getByPlaceholder('Tu contraseña').fill('clave-segura-1');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(page).toHaveURL(/\/juan\/3\/16$/);
  await expect(panel(page).getByText(ESTUDIO)).toBeVisible();
});

test('en el devocional también se puede preguntar, y al volver a abrir el estudio sigue en ese modo', async ({ page, request }) => {
  await conSesion(page, await cuentaNueva(request, 'Devota'));
  await page.goto('/juan/3/16');
  await page.getByRole('button', { name: 'Estudiar', exact: true }).click();
  await expect(panel(page).getByText(ESTUDIO)).toBeVisible();

  const pedido = page.waitForRequest(esEstudio);
  await panel(page).getByRole('tab', { name: /^Devocional/ }).click();
  expect((await pedido).postDataJSON()).toMatchObject({ book: 'jhn', chapter: 3, verse: 16, enfoque: 'devocional' });
  const devocional = panel(page, 'DEVOCIONAL');
  await expect(devocional.getByText('Estoy listo · Leer')).toBeVisible();

  const pregunta = `¿Qué es el mundo aquí? ${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  await devocional.getByPlaceholder('¿Algo que no entiendas de Juan 3:16?').fill(pregunta);
  await devocional.getByLabel('Enviar pregunta').click();
  await expect(devocional.getByText('TUS PREGUNTAS')).toBeVisible();
  await expect(devocional.getByText(`Respuesta simulada a «${pregunta}».`)).toBeVisible();
  // El devocional sigue arriba, listo para seguir
  await expect(devocional.getByText('Estoy listo · Leer')).toBeVisible();
  const [recibida] = await peticionesIA(request, pregunta);
  expect(recibida.system).toBeDefined();
  expect(JSON.stringify(recibida.system)).toContain('devocional');

  // Al volver a abrir el estudio, empieza en el modo elegido
  await page.getByLabel('Cerrar estudio').last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Estudiar', exact: true }).click();
  await expect(panel(page, 'DEVOCIONAL').getByText('Estoy listo · Leer')).toBeVisible();
});
