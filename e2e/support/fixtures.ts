// Ayudas comunes de las pruebas e2e.

import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

export type Cuenta = { llave: string; usuario: { id: string; nombre: string; correo: string | null } };

const AI = `http://127.0.0.1:${process.env.AI_PORT ?? 8089}`;

/** Correo único por prueba: todas comparten la misma base de datos. */
export const correoUnico = (nombre: string) =>
  `${nombre.toLowerCase().replace(/\W/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@prueba.test`;

/** Crea una cuenta directamente en el servidor (para las pruebas que no tratan de registrarse). */
export async function cuentaNueva(request: APIRequestContext, nombre: string): Promise<Cuenta> {
  const res = await request.post('/api/comunidades', {
    data: { accion: 'registrarse', nombre, correo: correoUnico(nombre), clave: 'clave-segura-1' },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Cuenta;
}

/** Deja la sesión guardada en el navegador antes de que cargue la app, como si ya hubiera entrado. */
export async function conSesion(page: Page, cuenta: Cuenta) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('cuenta', value);
  }, JSON.stringify(cuenta));
}

/** Deja elegido el estudio profundo (el modo por omisión es el devocional guiado). */
export async function modoProfundo(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('ajustes', JSON.stringify({ enfoque: 'profundo' }));
  });
}

/** Peticiones que recibió la IA simulada cuyo primer mensaje o el último contienen `marca`. */
export async function peticionesIA(request: APIRequestContext, marca: string) {
  const res = await request.get(`${AI}/__requests`);
  const all = (await res.json()) as { system?: unknown; messages: { role: string; content: unknown }[] }[];
  return all.filter((r) => JSON.stringify(r.messages).includes(marca));
}

/** Abre una hoja de la barra del capítulo: la de escuchar (lectura, dramatizado, original) o la de «Más». */
export async function abrirHoja(page: Page, hoja: 'escuchar' | 'mas') {
  const nombre = hoja === 'mas' ? 'Más herramientas del capítulo' : /^Escuchar el capítulo: elegir/;
  await page.getByRole('button', { name: nombre }).filter({ visible: true }).click();
}

export const test = base;
export { expect };
export type { Page };

/** Desliza con el dedo en horizontal desde (x, y), dx píxeles (solo Chromium: el toque va por CDP). */
export async function deslizar(page: Page, x: number, y: number, dx: number) {
  const cdp = await page.context().newCDPSession(page);
  const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', px: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y }] });
  await toque('touchStart', x);
  for (let i = 1; i <= 10; i++) await toque('touchMove', x + (dx * i) / 10);
  await toque('touchEnd', x + dx);
  await cdp.detach();
}
