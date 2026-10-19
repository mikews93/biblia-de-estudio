// Cuentas: crear la cuenta, entrar y salir, cambiar el nombre, borrarla, y que la app pida cuenta solo
// donde hace falta (comunidad e IA) y vuelva al mismo sitio después de entrar.

import type { Page } from '@playwright/test';

import { correoUnico, cuentaNueva, expect, modoProfundo, test } from './support/fixtures';

const CLAVE = 'clave-segura-1';

/** Las confirmaciones de la web son window.confirm: se aceptan. */
const aceptarConfirmaciones = (page: Page) => page.on('dialog', (d) => d.accept());

async function registrarse(page: Page, nombre: string, correo: string, clave = CLAVE) {
  await page.getByPlaceholder('Así te verán tus grupos y amigos').fill(nombre);
  await page.getByPlaceholder('tu@correo.com').fill(correo);
  await page.getByPlaceholder('Elige una contraseña').fill(clave);
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
}

async function entrar(page: Page, correo: string, clave: string) {
  await page.getByPlaceholder('tu@correo.com').fill(correo);
  await page.getByPlaceholder('Tu contraseña').fill(clave);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

const composer = (page: Page) => page.getByText('Pregúntale algo a la comunidad…');

test('crear la cuenta desde /registro deja la sesión abierta aunque se recargue', async ({ page }) => {
  const correo = correoUnico('Rut');
  await page.goto('/registro');
  await registrarse(page, 'Rut Moabita', correo);

  // Sin pantalla anterior, vuelve a Comunidad ya con la cuenta.
  await expect(page).toHaveURL(/\/comunidades$/);
  await expect(composer(page)).toBeVisible();

  await page.reload();
  await expect(composer(page)).toBeVisible();
  await page.goto('/cuenta');
  await expect(page.getByText(`Entras con ${correo}.`)).toBeVisible();
  await expect(page.getByRole('textbox').first()).toHaveValue('Rut Moabita');
});

test('el registro avisa de la contraseña corta, el correo mal escrito y el correo ya usado', async ({ page, request }) => {
  await page.goto('/registro');
  const crear = page.getByRole('button', { name: 'Crear mi cuenta' });

  // Contraseña corta: el botón no se activa.
  await page.getByPlaceholder('Así te verán tus grupos y amigos').fill('Booz');
  await page.getByPlaceholder('tu@correo.com').fill(correoUnico('Booz'));
  await page.getByPlaceholder('Elige una contraseña').fill('corta');
  await expect(crear).toBeDisabled();
  await page.getByPlaceholder('Elige una contraseña').fill(CLAVE);
  await expect(crear).toBeEnabled();

  // Correo mal escrito: lo rechaza el servidor y no se entra.
  await page.getByPlaceholder('tu@correo.com').fill('booz@sinpunto');
  await crear.click();
  await expect(page.getByRole('alert')).toHaveText('Escribe un correo válido');
  await expect(page).toHaveURL(/\/registro$/);

  // Correo que ya tiene cuenta.
  const correo = correoUnico('Noemi');
  await request.post('/api/comunidades', { data: { accion: 'registrarse', nombre: 'Noemí', correo, clave: CLAVE } });
  await page.getByPlaceholder('tu@correo.com').fill(correo);
  await crear.click();
  await expect(page.getByRole('alert')).toContainText('Ese correo ya tiene una cuenta');
  await expect(page).toHaveURL(/\/registro$/);

  // Corregido, ya entra.
  await page.getByPlaceholder('tu@correo.com').fill(correoUnico('Booz'));
  await crear.click();
  await expect(composer(page)).toBeVisible();
});

test('cerrar sesión y volver a entrar, con aviso si la contraseña no es la correcta', async ({ page }) => {
  aceptarConfirmaciones(page);
  const correo = correoUnico('Ana');
  await page.goto('/registro');
  await registrarse(page, 'Ana Profetisa', correo);
  await expect(composer(page)).toBeVisible();

  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/comunidades$/);
  await expect(page.getByRole('button', { name: 'Crear cuenta gratis' })).toBeVisible();
  await expect(composer(page)).toHaveCount(0);

  await page.goto('/entrar');
  await entrar(page, correo, 'otra-clave-mala');
  await expect(page.getByRole('alert')).toHaveText('El correo o la contraseña no son correctos');
  await expect(page).toHaveURL(/\/entrar$/);

  await page.getByPlaceholder('Tu contraseña').fill(CLAVE);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(composer(page)).toBeVisible();
  await page.goto('/cuenta');
  await expect(page.getByRole('textbox').first()).toHaveValue('Ana Profetisa');
});

test('el nombre nuevo se guarda en la cuenta y se ve al entrar desde otro dispositivo', async ({ page, browser }) => {
  const correo = correoUnico('Saulo');
  await page.goto('/registro');
  await registrarse(page, 'Saulo', correo);
  await expect(composer(page)).toBeVisible();

  await page.goto('/cuenta');
  const nombre = page.getByRole('textbox').first();
  await expect(nombre).toHaveValue('Saulo');
  const guardar = page.getByRole('button', { name: 'Guardar cambios' });
  await expect(guardar).toBeDisabled();
  await nombre.fill('Pablo de Tarso');
  await guardar.click();
  await expect(page.getByText('Perfil guardado')).toBeVisible();

  // Otro navegador, sin nada guardado: entra con el correo y ve el nombre nuevo.
  const otro = await browser.newContext();
  const page2 = await otro.newPage();
  await page2.goto('/entrar');
  await entrar(page2, correo, CLAVE);
  await expect(page2.getByText('Pregúntale algo a la comunidad…')).toBeVisible();
  await page2.goto('/cuenta');
  await expect(page2.getByRole('textbox').first()).toHaveValue('Pablo de Tarso');
  await otro.close();
});

test('borrar la cuenta la elimina: ya no se puede volver a entrar', async ({ page }) => {
  aceptarConfirmaciones(page);
  const correo = correoUnico('Demas');
  await page.goto('/registro');
  await registrarse(page, 'Demas', correo);
  await expect(composer(page)).toBeVisible();

  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
  await expect(page).toHaveURL(/\/comunidades$/);
  await expect(page.getByRole('button', { name: 'Crear cuenta gratis' })).toBeVisible();

  await page.goto('/entrar');
  await entrar(page, correo, CLAVE);
  await expect(page.getByRole('alert')).toHaveText('El correo o la contraseña no son correctos');
});

test('la Biblia se lee sin cuenta; Comunidad la pide y al crearla vuelve a Comunidad', async ({ page }) => {
  await page.goto('/juan/3');
  await expect(page.getByText('Porque de tal manera amó Dios al mundo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear cuenta gratis' })).toHaveCount(0);

  await page.getByRole('tablist').getByText('Comunidad').click();
  await expect(page).toHaveURL(/\/comunidades$/);
  await page.getByRole('button', { name: 'Crear cuenta gratis' }).click();
  await expect(page).toHaveURL(/\/registro$/);
  await registrarse(page, 'Lidia', correoUnico('Lidia'));

  await expect(page).toHaveURL(/\/comunidades$/);
  await expect(composer(page)).toBeVisible();
});

test('estudiar con IA sin cuenta pide entrar y, al entrar, vuelve al lector con el estudio', async ({ page, request }) => {
  const cuenta = await cuentaNueva(request, 'Apolos');
  await modoProfundo(page);
  await page.goto('/juan/3');
  await page.getByText('Porque de tal manera amó Dios al mundo').click();
  await page.getByRole('button', { name: 'Estudiar', exact: true }).click();
  await expect(page.getByText('Estudia con IA')).toBeVisible();

  await page.getByRole('button', { name: /Entra$/ }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByText('Qué bueno verte')).toBeVisible();
  await entrar(page, cuenta.usuario.correo!, CLAVE);

  // De vuelta en Juan 3, el estudio se pide solo, ya con la cuenta.
  await expect(page).toHaveURL(/\/juan\/3/);
  await expect(page.getByText('Estudio simulado del pasaje')).toBeVisible();
});
