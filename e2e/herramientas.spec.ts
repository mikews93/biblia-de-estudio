import type { Locator, TestInfo } from '@playwright/test';

import { conSesion, cuentaNueva, expect, peticionesIA, test } from './support/fixtures';

// Herramientas de estudio: las del capítulo hechas con IA (resumen en audio, tarjetas y repaso, mapa
// mental) y las de datos (mapa de lugares, genealogías y línea de tiempo).

/** La pila de pantallas deja las anteriores en el DOM, ocultas: solo cuentan las visibles. */
const v = (l: Locator) => l.filter({ visible: true });

/**
 * Las pruebas comparten la IA simulada y corren a la vez en los dos proyectos: cada prueba usa su propio
 * capítulo de Juan, distinto en cada proyecto, para contar solo sus peticiones.
 */
const capitulo = (info: TestInfo, base: number) => base + (info.project.name === 'movil' ? 0 : 1);

test.describe('Herramientas del capítulo con IA', () => {
  test('sin cuenta, el resumen en audio pide entrar; al entrar se prepara solo', async ({ page, request }, info) => {
    const cap = capitulo(info, 4);
    const cuenta = await cuentaNueva(request, 'Oyente');
    const marca = `resumen en audio de Juan ${cap},`;
    const antes = (await peticionesIA(request, marca)).length;

    await page.goto(`/juan/${cap}`);
    await v(page.getByRole('button', { name: 'Resumen del capítulo en audio, como una conversación' })).click();
    await expect(page).toHaveURL(new RegExp(`/podcast/juan/${cap}$`));
    await expect(v(page.getByText('Se prepara con IA'))).toBeVisible();
    await expect(v(page.getByRole('button', { name: 'Crear cuenta gratis' }))).toBeVisible();
    expect((await peticionesIA(request, marca)).length).toBe(antes); // sin cuenta no se llama a la IA

    // Entrar con la cuenta y volver: el resumen se pide y aparece
    await v(page.getByText('Entra', { exact: true })).click();
    await expect(page).toHaveURL(/\/entrar$/);
    await v(page.getByPlaceholder('tu@correo.com')).fill(cuenta.usuario.correo!);
    await v(page.getByPlaceholder('Tu contraseña')).fill('clave-segura-1');
    await v(page.getByRole('button', { name: 'Entrar', exact: true })).click();
    await expect(page).toHaveURL(new RegExp(`/podcast/juan/${cap}$`));
    await expect(v(page.getByText('Este capítulo empieza con una sorpresa.'))).toBeVisible();
    await expect.poll(async () => (await peticionesIA(request, marca)).length).toBe(antes + 1);
  });

  test('resumen en audio: conversación de Ana y Tomás que se guarda y no se vuelve a pedir', async ({ page, request, browser }, info) => {
    const cap = capitulo(info, 6);
    await conSesion(page, await cuentaNueva(request, 'Oyente'));
    const marca = `resumen en audio de Juan ${cap},`;
    const antes = (await peticionesIA(request, marca)).length;

    await page.goto(`/podcast/juan/${cap}`);
    await expect(v(page.getByText(`Juan ${cap}`, { exact: true }))).toBeVisible();
    await expect(v(page.getByText('Este capítulo empieza con una sorpresa.'))).toBeVisible();
    await expect(v(page.getByText('Sí, y el versículo dieciséis lo resume todo.'))).toBeVisible();
    await expect(v(page.getByText('Ana', { exact: true }))).toHaveCount(2);
    await expect(v(page.getByText('Tomás', { exact: true }))).toHaveCount(1);
    await expect(v(page.getByText('1 de 3 · voz del dispositivo'))).toBeVisible();

    // Saltar a la intervención siguiente
    await v(page.getByLabel('Intervención siguiente')).click();
    await expect(v(page.getByText('2 de 3 · voz del dispositivo'))).toBeVisible();
    // El pódcast suena en el reproductor único, como todo lo demás
    await expect(v(page.getByText('Pódcast · habla Tomás'))).toBeVisible();
    expect((await peticionesIA(request, marca)).length).toBe(antes + 1);

    // Al volver a abrirlo sale lo guardado, sin otra petición
    await page.reload();
    await expect(v(page.getByText('¿Qué pregunta te deja a ti?'))).toBeVisible();
    expect((await peticionesIA(request, marca)).length).toBe(antes + 1);

    // Otra persona, en otro dispositivo, lo recibe ya hecho: el servidor lo guardó para todos
    const otro = await browser.newContext(info.project.use);
    const otraPagina = await otro.newPage();
    await conSesion(otraPagina, await cuentaNueva(request, 'Oyente dos'));
    await otraPagina.goto(`/podcast/juan/${cap}`);
    await expect(v(otraPagina.getByText('Este capítulo empieza con una sorpresa.'))).toBeVisible();
    expect((await peticionesIA(request, marca)).length).toBe(antes + 1);
    await otro.close();

    // «Preparar otra versión» sí vuelve a pedirlo
    await v(page.getByRole('button', { name: '↻ Preparar otra versión' })).click();
    await expect.poll(async () => (await peticionesIA(request, marca)).length).toBe(antes + 2);
    await expect(v(page.getByText('Este capítulo empieza con una sorpresa.'))).toBeVisible();
  });

  test('tarjetas: elegir las del capítulo, repasarlas y quedan programadas', async ({ page, request }, info) => {
    const cap = capitulo(info, 8);
    await conSesion(page, await cuentaNueva(request, 'Estudiante'));
    const marca = `tarjetas de repaso de Juan ${cap}`;
    const antes = (await peticionesIA(request, marca)).length;

    await page.goto(`/juan/${cap}`);
    await v(page.getByRole('button', { name: 'Tarjetas de repaso del capítulo' })).click();
    await expect(page).toHaveURL(new RegExp(`/tarjetas/juan/${cap}$`));
    const tarjetas = v(page.getByRole('checkbox'));
    await expect(tarjetas).toHaveCount(3);
    await expect(tarjetas.first()).toContainText('¿Quién visitó a Jesús de noche?');
    await expect(tarjetas.first()).toContainText('Nicodemo, un principal de los judíos');

    // Dejar fuera la segunda y guardar las otras dos
    await expect(v(page.getByRole('button', { name: 'Guardar 3 y repasar' }))).toBeVisible();
    await tarjetas.nth(1).click();
    await expect(tarjetas.nth(1)).not.toBeChecked();
    await v(page.getByRole('button', { name: 'Guardar 2 y repasar' })).click();

    // Repaso del capítulo: dos pendientes
    await expect(page).toHaveURL(new RegExp(`/repaso\\?libro=jhn&capitulo=${cap}$`));
    await expect(v(page.getByText(`▤ REPASO · JUAN ${cap}`))).toBeVisible();
    await expect(v(page.getByText('2 tarjetas pendientes'))).toBeVisible();

    // Primera: mostrar la respuesta y decir «Otra vez» (vuelve al final de la sesión)
    await expect(v(page.getByText('¿Quién visitó a Jesús de noche?'))).toBeVisible();
    await v(page.getByText('Piensa la respuesta y toca para verla')).click();
    await expect(v(page.getByText('Nicodemo, un principal de los judíos (Juan 3:1-2)'))).toBeVisible();
    await v(page.getByRole('button', { name: /^Otra vez: volver a verla ahora$/ })).click();

    // Segunda: «Bien» la programa para mañana
    await expect(v(page.getByText('Completa: «Porque de tal manera amó Dios al mundo…»'))).toBeVisible();
    await v(page.getByText('Piensa la respuesta y toca para verla')).click();
    await v(page.getByRole('button', { name: /^Bien: volver a verla en 1 día$/ })).click();

    // Vuelve la primera; «Fácil» la manda a cuatro días
    await expect(v(page.getByText('1 tarjeta pendiente'))).toBeVisible();
    await expect(v(page.getByText('¿Quién visitó a Jesús de noche?'))).toBeVisible();
    await v(page.getByText('Piensa la respuesta y toca para verla')).click();
    await v(page.getByRole('button', { name: /^Fácil: volver a verla en \d+ días$/ })).click();

    await expect(v(page.getByText('¡Repaso terminado!'))).toBeVisible();
    await expect(v(page.getByText('Repasaste 2 tarjetas. La próxima tarjeta toca mañana.'))).toBeVisible();

    // Tras recargar no queda nada pendiente hoy
    await page.reload();
    await expect(v(page.getByText('Nada pendiente por hoy'))).toBeVisible();
    await expect(v(page.getByText('La próxima tarjeta toca mañana.'))).toBeVisible();

    // En la pantalla de tarjetas, las guardadas aparecen como ya en el repaso; las tarjetas no se pidieron otra vez
    await page.goto(`/tarjetas/juan/${cap}`);
    await expect(v(page.getByText(`Ya tienes 2 tarjetas de este capítulo · Repasar ›`))).toBeVisible();
    await expect(v(page.getByText(/ya está en tu repaso/))).toHaveCount(2);
    await expect(v(page.getByRole('button', { name: 'Guardar 1 y repasar' }))).toBeVisible();
    expect((await peticionesIA(request, marca)).length).toBe(antes + 1);
  });

  test('memorizar un versículo lo lleva al repaso y aparece en Hoy', async ({ page }) => {
    await page.goto('/juan/3/16');
    await v(page.getByRole('button', { name: 'Memorizar' })).click();
    await expect(v(page.getByRole('button', { name: 'En repaso' }))).toBeVisible();

    await page.goto('/');
    await expect(v(page.getByText('1 tarjeta te espera para no olvidar lo que estudiaste.'))).toBeVisible();
    await v(page.getByText('Repasar →')).click();
    await expect(page).toHaveURL(/\/repaso$/);
    await expect(v(page.getByText('MEMORIZAR · Juan 3:16'))).toBeVisible();
    await v(page.getByText('Dilo de memoria y toca para comprobar')).click();
    await expect(v(page.getByText(/Porque de tal manera amó Dios al mundo/)).last()).toBeVisible();
    await v(page.getByRole('button', { name: /^Bien:/ })).click();
    await expect(v(page.getByText('¡Repaso terminado!'))).toBeVisible();

    await page.goto('/');
    await expect(v(page.getByText(/tarjetas? te espera/))).toHaveCount(0);
  });

  test('mapa mental: ramas del capítulo, vista de lista y abrir el versículo de una idea', async ({ page, request }, info) => {
    const cap = capitulo(info, 10);
    await conSesion(page, await cuentaNueva(request, 'Mapas'));
    const marca = `Haz el mapa mental de Juan ${cap}.`;
    const antes = (await peticionesIA(request, marca)).length;

    await page.goto(`/juan/${cap}`);
    await v(page.getByRole('button', { name: 'Mapa mental del capítulo' })).click();
    await expect(page).toHaveURL(new RegExp(`/mapa-mental/juan/${cap}$`));
    await expect(v(page.getByText('Toca una idea para leer su versículo.'))).toBeVisible();
    // El dibujo lleva la idea central y las ramas con sus versículos
    await expect(v(page.locator('svg text', { hasText: /^vv\. 1-21$/ }))).toHaveCount(1);
    await expect(v(page.locator('svg text', { hasText: /^vv\. 22-36$/ }))).toHaveCount(1);
    await expect(v(page.locator('svg text', { hasText: /^v\. 30$/ }))).toHaveCount(1);
    expect((await peticionesIA(request, marca)).length).toBe(antes + 1);

    // Como lista
    await v(page.getByRole('tab', { name: 'Lista' })).click();
    await expect(v(page.getByText('El nuevo nacimiento y el amor de Dios'))).toBeVisible();
    await expect(v(page.getByText(/^Jesús y Nicodemo vv\. 1-21$/))).toBeVisible();
    await expect(v(page.getByText(/^Testimonio de Juan el Bautista vv\. 22-36$/))).toBeVisible();
    await expect(v(page.getByText(/^Él crece, yo mengüo v\. 30$/))).toBeVisible();

    // Tras recargar sale el mismo mapa sin pedirlo otra vez
    await page.reload();
    await v(page.getByRole('tab', { name: 'Lista' })).click();
    await expect(v(page.getByText(/^Hay que nacer otra vez v\. 3$/))).toBeVisible();
    expect((await peticionesIA(request, marca)).length).toBe(antes + 1);

    // Tocar una idea abre su versículo en el lector
    await v(page.getByText(/^Dios amó al mundo v\. 16$/)).click();
    await expect(page).toHaveURL(new RegExp(`/juan/${cap}/16$`));
    await expect(v(page.getByText(`Juan ${cap}:16`, { exact: true }))).toBeVisible();
  });
});

test.describe('Mapas, genealogías e historia', () => {
  test('lugares de un capítulo: elegir uno en el mapa y abrir el versículo donde aparece', async ({ page }) => {
    await page.goto('/juan/3');
    await v(page.getByRole('link', { name: 'Ver en el mapa los 5 lugares de este capítulo ›' })).click();
    await expect(page).toHaveURL(/\/mapa\/juan\/3$/);

    // La lista trae los cinco lugares con sus versículos
    for (const [lugar, vv] of [
      ['Jerusalem', 'v. 22'],
      ['Judea', 'v. 22'],
      ['Enón', 'v. 23'],
      ['Salim', 'v. 23'],
      ['Jordán', 'v. 26'],
    ]) {
      await expect(v(page.getByText(vv, { exact: true })).nth(0)).toBeVisible();
      await expect(v(page.getByText(lugar, { exact: true })).last()).toBeVisible();
    }

    // Tocar Enón en el mapa muestra su ficha, con la ubicación dudosa y su versículo
    await expect(v(page.getByText('Toca un punto para ver el lugar y dónde se menciona.'))).toBeVisible();
    await v(page.locator('svg text', { hasText: 'Enón' })).last().click();
    await expect(v(page.getByText('Versículos:'))).toBeVisible();
    await expect(v(page.getByText('Otra propuesta aparece con un círculo punteado en el mapa.'))).toBeVisible();
    await v(page.getByText('23', { exact: true })).click();
    await expect(page).toHaveURL(/\/juan\/3\/23$/);
    await expect(v(page.getByText('Juan 3:23', { exact: true }))).toBeVisible();

    // Desde la lista también se llega al versículo
    await page.goBack();
    await v(page.getByText('Jordán', { exact: true })).last().click();
    await expect(page).toHaveURL(/\/juan\/3\/26$/);
  });

  test('genealogía: buscar a Booz, recorrer su familia hasta Isaí y leer dónde se le nombra', async ({ page }) => {
    await page.goto('/genealogia');
    await expect(v(page.getByText(/[\d.]+ personas con sus padres, hijos y linaje\./))).toBeVisible();
    await v(page.getByPlaceholder('Busca una persona: Rut, Isaí, Zorobabel…')).fill('booz');
    await expect(v(page.getByText('RESULTADOS'))).toBeVisible();
    await v(page.getByText('hijo de Salmón')).click();

    await expect(page).toHaveURL(/\/genealogia\/519-booz$/);
    await expect(v(page.getByText('Booz', { exact: true })).first()).toBeVisible();
    await expect(v(page.getByText('30 generaciones hasta Adam', { exact: false }))).toBeVisible();
    await expect(v(page.getByLabel('esposa: Ruth'))).toBeVisible();

    // Al hijo, desde el árbol
    await v(page.getByLabel('hijo: Obed')).click();
    await expect(page).toHaveURL(/\/genealogia\/2228-obed$/);
    await expect(v(page.getByText('hijo de Booz'))).toBeVisible();

    // Al nieto, desde la lista de hijos
    await v(page.getByText('Hijos')).scrollIntoViewIfNeeded();
    await v(page.getByText('Isaí', { exact: true })).last().click();
    await expect(page).toHaveURL(/\/genealogia\/903-isai$/);
    await expect(v(page.getByText('hijo de Obed'))).toBeVisible();
    await expect(v(page.getByText('Hijos (8)'))).toBeVisible();
    await expect(v(page.getByText('David', { exact: true })).first()).toBeVisible();

    // En el linaje, Booz aparece como abuelo y lleva a su página
    await v(page.getByLabel('Booz', { exact: true })).click();
    await expect(page).toHaveURL(/\/genealogia\/519-booz$/);
    await page.goBack();

    // Primera mención: Rut 4:17 en el lector
    await v(page.getByText('Rut 4:17 ›')).click();
    await expect(page).toHaveURL(/\/rut\/4\/17$/);
    await expect(v(page.getByText('Rut 4:17', { exact: true }))).toBeVisible();
  });

  test('línea de tiempo: el capítulo que se lee está marcado y los hechos del mundo llevan a su pasaje', async ({ page }) => {
    await page.goto('/historia?libro=2ki&cap=18');
    await expect(v(page.getByText('La Biblia y el mundo, siglo a siglo'))).toBeVisible();

    // Ezequías es el periodo de 2 Reyes 18: marcado en la línea y abierto en la ficha con lo que pasaba en el mundo
    const aqui = v(page.getByText('AQUÍ ESTÁS'));
    await expect(aqui).toHaveCount(1);
    await expect(aqui).toBeInViewport();
    await expect(v(page.getByText('Estás leyendo esta época', { exact: false }))).toBeVisible();
    await expect(v(page.getByText('Leer 2 Reyes 18 ›'))).toBeVisible();

    // En la ficha, el sitio de Senaquerib; su ficha lleva a 2 Reyes 18:13
    await v(page.getByText('Senaquerib contra Judá')).last().click();
    await expect(v(page.getByText('En la Biblia, por esos años', { exact: false }))).toBeVisible();
    await v(page.getByText('2 Reyes 18:13 ›')).click();
    await expect(page).toHaveURL(/\/2-reyes\/18\/13$/);
    await expect(v(page.getByText('2 Reyes 18:13', { exact: true }))).toBeVisible();

    // Sin capítulo no hay marca ni ficha; tocar un periodo abre su ficha y desde ella su primer capítulo
    await page.goto('/historia');
    await expect(v(page.getByText('AQUÍ ESTÁS'))).toHaveCount(0);
    await v(page.getByText('El reino dividido')).first().click();
    await v(page.getByText('Caída de Samaria')).first().click();
    await v(page.getByText('Leer 2 Reyes 17 ›')).click();
    await expect(page).toHaveURL(/\/2-reyes\/17$/);
  });
});
