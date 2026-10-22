// Eventos de iglesia: quien predica publica un sermón del Taller con un código, y la congregación (sin cuenta)
// lo sigue en vivo en el teléfono, abre los versículos y toma notas. Avanzar en «Presentar» avanza para todos.

import type { Page } from '@playwright/test';

import { conSesion, cuentaNueva, expect, test } from './support/fixtures';

const marca = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Un sermón ya preparado en el Taller del dispositivo. */
function sermon(id: string, titulo: string) {
  const now = new Date().toISOString();
  const s = (n: number, t: string, texto: string) => ({ id: `${id}-${n}`, titulo: t, ayuda: '', texto, minutos: 7 });
  return {
    id,
    tipo: 'sermon',
    titulo,
    pasaje: { book: 'luk', chapter: 15, from: 11, to: 24 },
    plantilla: 'expositiva',
    observacion: '',
    tema: 'El amor del Padre',
    complemento: 'corre hacia quien vuelve',
    necesidad: '',
    gracia: '',
    secciones: [
      s(1, 'Nos alejamos', 'Notas privadas del pastor. Leer Lucas 15:13.'),
      s(2, 'Volvemos en sí', 'Romanos 2:4: la bondad lleva al arrepentimiento.'),
      s(3, 'El Padre corre', 'Lucas 15:20 y Romanos 5:8.'),
    ],
    revision: [],
    seguimiento: '',
    minutos: 30,
    creado: now,
    actualizado: now,
  };
}

async function conTaller(page: Page, mensajes: unknown[]) {
  await page.addInitScript((value) => {
    if (!window.localStorage.getItem('taller')) window.localStorage.setItem('taller', value);
  }, JSON.stringify(mensajes));
}

test('publica un sermón como evento y la congregación lo sigue en vivo con sus notas', async ({ page, browser, request }) => {
  const m = marca();
  const titulo = `El hijo que vuelve ${m}`;
  const pastor = await cuentaNueva(request, 'Pastora Eventos');
  await conSesion(page, pastor);
  await conTaller(page, [sermon(`ev${m}`, titulo)]);

  // En el Taller, paso Presentar: elige qué ve la congregación y publica.
  await page.goto(`/taller/ev${m}`);
  await page.getByRole('tab', { name: '5 Presentar' }).click();
  await page.getByRole('button', { name: 'Preparar el evento en vivo' }).click();
  await expect(page.getByText('EVENTO EN VIVO')).toBeVisible();
  await page.getByLabel('Para la congregación, punto 1').fill(`Todos nos alejamos ${m}`);
  await expect(page.getByText('Versículos: Lucas 15:20 · Romanos 5:8')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar como evento' }).click();
  const codigo = (await page.getByLabel(/^Código [A-Z0-9]{6}$/).getAttribute('aria-label'))!.slice(-6);
  await expect(page.getByText('EMPIEZA PRONTO', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/Código QR de/)).toBeVisible();
  await expect(page.getByText('Cambiaste el mensaje después de publicarlo.')).toHaveCount(0);
  // Queda anotado en el mensaje (y así en la cuenta)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('taller') ?? '')).toContain(codigo);

  // La congregación entra con el código, sin cuenta.
  const fiel = await browser.newContext({ ...test.info().project.use, storageState: undefined });
  const telefono = await fiel.newPage();
  await telefono.goto('/eventos');
  await telefono.getByLabel('Código del evento').fill(codigo.toLowerCase());
  await telefono.getByRole('button', { name: 'Seguir el evento' }).click();
  await expect(telefono).toHaveURL(new RegExp(`/evento/${codigo}$`));
  await expect(telefono.getByText(titulo).last()).toBeVisible();
  await expect(telefono.getByText('EMPIEZA PRONTO', { exact: true })).toBeVisible();
  await expect(telefono.getByText('Faltan 3 puntos.', { exact: false })).toBeVisible();
  await expect(telefono.getByText('Nos alejamos', { exact: true })).toHaveCount(0);

  // Quien predica empieza y muestra el primer punto.
  await page.getByRole('button', { name: 'Abrir el evento' }).click();
  await page.getByRole('button', { name: 'Empezar en vivo' }).click();
  await page.getByRole('button', { name: 'Mostrar el punto 1' }).click();
  await expect(page.getByText('TU EVENTO · PUNTO 1 DE 3')).toBeVisible();

  await telefono.reload();
  await expect(telefono.getByText('EN VIVO', { exact: true })).toBeVisible();
  await expect(telefono.getByText('Nos alejamos', { exact: true })).toBeVisible();
  await expect(telefono.getByText(`Todos nos alejamos ${m}`)).toBeVisible();
  // Las notas privadas no llegan, pero sus versículos sí.
  await expect(telefono.getByText('Notas privadas del pastor', { exact: false })).toHaveCount(0);
  await telefono.getByRole('button', { name: 'Lucas 15:13, leer' }).click();
  await expect(telefono.getByText(/desperdició su hacienda/)).toBeVisible();
  await expect(telefono.getByText('Faltan 2 puntos.', { exact: false })).toBeVisible();

  // Nota en el punto: se guarda en el teléfono.
  await telefono.getByRole('button', { name: 'Escribir una nota' }).first().click();
  await telefono.getByLabel('Mi nota de este punto').fill(`Volver a casa ${m}`);
  await expect.poll(() => telefono.evaluate(() => localStorage.getItem('eventos') ?? '')).toContain(`Volver a casa ${m}`);

  // Al avanzar, el teléfono lo ve solo (sin recargar).
  await page.getByRole('button', { name: 'Siguiente: punto 2' }).click();
  await expect(telefono.getByText('Volvemos en sí', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(telefono.getByText('Punto 2 de 3')).toBeVisible();

  // Desde Presentar en el Taller también avanza para todos.
  await page.goto(`/taller/ev${m}/presentar`);
  await expect(page.getByText(`EN VIVO · ${codigo.slice(0, 3)} ${codigo.slice(3)}`)).toBeVisible();
  await page.getByText('Siguiente', { exact: true }).click();
  await page.getByText('Siguiente', { exact: true }).click();
  await page.getByText('Siguiente', { exact: true }).click();
  await expect(telefono.getByText('El Padre corre', { exact: true })).toBeVisible({ timeout: 15_000 });

  // Termina: la congregación ve todo y guarda sus notas en Mis eventos.
  await page.goto(`/evento/${codigo}`);
  await page.getByRole('button', { name: 'Terminar el evento' }).click();
  await expect(telefono.getByText('El mensaje terminó')).toBeVisible({ timeout: 25_000 });
  await telefono.getByText('Mis eventos ›').click();
  await expect(telefono.getByText('EVENTOS QUE SEGUÍ')).toBeVisible();
  await expect(telefono.getByText(titulo).last()).toBeVisible();
  await expect(telefono.getByText('1 nota tuyas')).toBeVisible();
  await fiel.close();
});

test('la pantalla para proyectar muestra el código, el QR y el punto actual', async ({ page, request }) => {
  const m = marca();
  const pastor = await cuentaNueva(request, 'Pastor Proyecta');
  await conSesion(page, pastor);
  await conTaller(page, [sermon(`pr${m}`, `Proyectar ${m}`)]);
  await page.goto(`/taller/pr${m}`);
  await page.getByRole('tab', { name: '5 Presentar' }).click();
  await page.getByRole('button', { name: 'Preparar el evento en vivo' }).click();
  await page.getByRole('button', { name: 'Publicar como evento' }).click();
  await page.getByRole('button', { name: 'Proyectar' }).click();
  await expect(page).toHaveURL(/\/evento\/[A-Z0-9]{6}\/proyectar$/);
  await expect(page.getByText('Sigue el mensaje en tu teléfono')).toBeVisible();
  await expect(page.getByLabel(/Código QR de http/).last()).toBeVisible();
  await expect(page.getByText(`Proyectar ${m}`).last()).toBeVisible();
});

test('un código que no existe lo dice y deja escribir otro', async ({ page }) => {
  await page.goto('/evento/ZZZZZZ');
  await expect(page.getByText('No encontramos el evento')).toBeVisible();
  await page.getByRole('button', { name: 'Escribir otro código' }).click();
  await expect(page).toHaveURL(/\/eventos$/);
  await expect(page.getByText('¿Estás en la iglesia?')).toBeVisible();
});
