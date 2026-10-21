import type { Locator } from '@playwright/test';

import { conSesion, cuentaNueva, expect, peticionesIA, test } from './support/fixtures';

// La historia de una palabra: la portada con los temas, la página de cada palabra (recorrido, relato con IA y
// pódcast) y la entrada desde la ficha de una palabra del interlineal. La IA simulada responde el relato de jésed
// con citas a pasajes concretos (e2e/support/mock-anthropic.ts).

/** La pila de pantallas deja las anteriores en el DOM, ocultas: solo cuentan las visibles. */
const v = (l: Locator) => l.filter({ visible: true });

test('la portada lleva a jésed: su recorrido, el relato en momentos y la palabra hermana del griego', async ({ page, request }) => {
  await conSesion(page, await cuentaNueva(request, 'Lector'));
  await page.goto('/palabras');
  await expect(v(page.getByText('La historia de una palabra', { exact: true })).first()).toBeVisible();
  await expect(v(page.getByText('Palabra de la semana', { exact: false })).first()).toBeVisible();
  await expect(v(page.getByText('AT · 245 veces'))).toBeVisible();

  await v(page.getByRole('link', { name: 'jésed, hebreo, 245 veces' })).click();
  await expect(page).toHaveURL(/\/palabras\/jesed$/);
  await expect(v(page.getByText('Bondad leal, el amor que cumple el pacto'))).toBeVisible();
  await expect(v(page.getByText('Salmos · 127'))).toBeVisible();
  await expect(v(page.getByText('misericordia', { exact: true })).first()).toBeVisible();

  // El relato, con cada momento anclado a su pasaje
  await expect(v(page.getByText('Una oración respondida'))).toBeVisible();
  await expect(v(page.getByText('Lamentaciones 3:22', { exact: true }))).toBeVisible();
  await expect(v(page.getByText('EL HILO'))).toBeVisible();
  await expect(v(page.getByText(/¿A quién podrías mostrar hoy una lealtad/))).toBeVisible();

  // El pasaje del momento abre el versículo
  await v(page.getByRole('link', { name: 'Génesis 24:27', exact: true })).first().click();
  await expect(page).toHaveURL(/\/genesis\/24\/27$/);
  await page.goBack();

  await v(page.getByRole('link', { name: /La misma idea en el griego: éleos/ })).click();
  await expect(page).toHaveURL(/\/palabras\/eleos$/);
  await expect(v(page.getByText('Griego · NT'))).toBeVisible();
});

test('el relato se prepara una vez y después se lee sin cuenta', async ({ page, request, browser }) => {
  const marca = 'Cuenta la historia de la palabra *jésed*';
  await conSesion(page, await cuentaNueva(request, 'Primera'));
  await page.goto('/palabras/jesed');
  await expect(v(page.getByText('Una oración respondida'))).toBeVisible();
  const despues = (await peticionesIA(request, marca)).length;
  expect(despues).toBeGreaterThan(0);

  // Otra persona, sin cuenta, lo recibe guardado y sin llamar a la IA
  const otra = await browser.newPage();
  await otra.goto('/palabras/jesed');
  await expect(v(otra.getByText('Una oración respondida'))).toBeVisible();
  await expect(v(otra.getByText('Se prepara con IA'))).toHaveCount(0);
  expect((await peticionesIA(request, marca)).length).toBe(despues);
  await otra.close();

  // La IA recibió el léxico, la concordancia y los pasajes, con la palabra griega hermana
  const [pedido] = (await peticionesIA(request, marca)).slice(-1);
  const enviado = JSON.stringify(pedido);
  expect(enviado).toContain('Léxico breve de STEPBible');
  expect(enviado).toContain('aparece 245 veces');
  expect(enviado).toContain('Lamentaciones 3:22:');
  expect(enviado).toContain('éleos');
});

test('el pódcast de la palabra: Ana y Tomás, con la opción de grabarlo con voces naturales', async ({ page, request }) => {
  await conSesion(page, await cuentaNueva(request, 'Oyente'));
  await page.goto('/palabras/jesed');
  await v(page.getByRole('link', { name: /Escúchala como pódcast/ })).click();
  await expect(page).toHaveURL(/\/palabras\/jesed\/podcast$/);
  await expect(v(page.getByText('La historia de jésed'))).toBeVisible();
  await expect(v(page.getByText('Muchísimas. Detrás de esa frase hay una palabra hebrea: jésed.'))).toBeVisible();
  await expect(v(page.getByText('Escuchar con voces naturales'))).toBeVisible();
  await expect(v(page.getByText('1 de 5 · voz del dispositivo'))).toBeVisible();
});

test('desde el interlineal, una palabra del catálogo abre su historia', async ({ page, request }) => {
  const res = await request.get('/data/interlinear/rut/2.json');
  const jesed = ((await res.json())['20'] as string[][]).find((w) => w[6] === 'H2617A')!;
  await page.goto('/rut/2/20');
  await v(page.getByRole('button', { name: 'Original' })).click();
  await v(page.getByText(jesed[0], { exact: true })).first().click();
  await expect(v(page.getByText('jésed por toda la Biblia, con pódcast'))).toBeVisible();
  await v(page.getByRole('link', { name: /La historia de esta palabra/ })).click();
  await expect(page).toHaveURL(/\/palabras\/jesed$/);
});
