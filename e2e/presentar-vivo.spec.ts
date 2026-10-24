// Presentar en vivo un sermón guardado en «Mis sermones»: con la célula, parte por parte, solo con los versículos
// elegidos y en la versión de quien guía; y en la iglesia, con el reloj de cada punto y una dinámica que llega a
// los teléfonos.

import type { APIRequestContext, Browser, Page } from '@playwright/test';

import { type Cuenta, conSesion, cuentaNueva, expect, test } from './support/fixtures';

const s = (id: string, titulo: string, texto: string, minutos: number, extra = {}) => ({ id, titulo, ayuda: '', texto, minutos, ...extra });
const sermon = (id: string, titulo: string) => ({
  id,
  tipo: 'sermon',
  titulo,
  pasaje: { book: 'luk', chapter: 15, from: 11, to: 32 },
  plantilla: 'expositiva',
  observacion: '',
  tema: 'El amor del Padre',
  complemento: 'sale a buscarnos',
  necesidad: '',
  gracia: '',
  secciones: [
    s('i', 'Introducción', 'Todos queremos volver a casa.', 4, { claves: 'Contar lo del viaje a Cali' }),
    s('p1', 'Nos descarriamos', 'Notas privadas del pastor.', 8, { apoyo: { cita: 'Isaías 53:6', porque: 'como ovejas' } }),
    s('p2', 'El padre corre', 'Ver Romanos 5:8', 8, { paraGrupo: '¿Cuándo corrió Dios hacia ti?', dinamica: 'termometro' }),
  ],
  revision: [],
  seguimiento: '',
  minutos: 20,
  creado: '2026-10-10T10:00:00.000Z',
  actualizado: '2026-10-24T10:00:00.000Z',
  terminado: '2026-10-20T10:00:00.000Z',
  ocasiones: [],
});

async function con(page: Page, cuenta: Cuenta | null, mensajes: unknown[], version: string) {
  if (cuenta) await conSesion(page, cuenta);
  await page.addInitScript(
    ([t, v]) => {
      window.localStorage.setItem('taller', t);
      window.localStorage.setItem('ajustes', JSON.stringify({ version: v }));
    },
    [JSON.stringify(mensajes), version],
  );
}

async function navegador(browser: Browser) {
  const context = await browser.newContext({ ...test.info().project.use, storageState: undefined });
  return context.newPage();
}

async function versiculo(request: APIRequestContext, version: string, book: string, chapter: number, verse: number) {
  const res = await request.get(`/data/text/${version}/${book}/${chapter}.json`);
  return ((await res.json()) as [number, string][]).find(([n]) => n === verse)![1];
}

const marca = () => Math.random().toString(36).slice(2, 7);

test('un sermón guardado se lleva con la célula parte por parte, con sus versículos y en mi versión', async ({ page, browser, request }) => {
  const m = marca();
  const ana = await cuentaNueva(request, 'Ana Predica');
  const beto = await cuentaNueva(request, 'Beto Escucha');
  await con(page, ana, [sermon(`c${m}`, `Volver a casa ${m}`)], 'bes');

  // Desde Mis sermones: elegir cómo presentarlo.
  await page.goto(`/taller/c${m}/documento`);
  await page.getByRole('button', { name: /Presentarlo en vivo/ }).click();
  await expect(page.getByText('¿Cómo lo vas a presentar?')).toBeVisible();
  await page.getByRole('button', { name: 'Con mi grupo o célula' }).click();
  await expect(page).toHaveURL(new RegExp(`/vivo\\?taller=c${m}`));
  await expect(page.getByText('Se leerá solo los versículos 11 al 32')).toBeVisible();
  await page.getByRole('button', { name: 'Empezar en vivo' }).click();
  await expect(page).toHaveURL(/\/vivo\/[A-Z2-9]{6}/);
  const codigo = new URL(page.url()).pathname.split('/').pop()!;

  // Antes de empezar: solo los versículos del sermón, en la BES.
  await expect(page.getByText('ANTES DE EMPEZAR')).toBeVisible();
  await expect(page.getByText('VERSÍCULOS 11 AL 32')).toBeVisible();
  await expect(page.getByText('BES', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Versículo 11$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Versículo 10$/ })).toHaveCount(0);

  // Beto lee en la RV1909, pero en la sala ve la versión de Ana.
  const pb = await navegador(browser);
  await con(pb, beto, [], 'rv1909');
  await pb.goto(`/vivo/${codigo}`);
  await expect(pb.getByText('EMPIEZA PRONTO')).toBeVisible();
  await expect(pb.getByText((await versiculo(request, 'bes', 'luk', 15, 11)).slice(0, 30), { exact: false })).toBeVisible();

  // Ana empieza: ve la parte, su reloj y sus notas (solo ella).
  await page.getByRole('button', { name: 'Empezar la parte 1' }).click();
  await expect(page.getByText('PARTE 1 DE 3')).toBeVisible();
  await expect(page.getByText(/Total 0:0\d de 20 min/)).toBeVisible();
  await page.getByRole('button', { name: 'Mis notas de esta parte' }).click();
  await expect(page.getByLabel(/Parte 1 de 3/).getByText('Contar lo del viaje a Cali')).toBeVisible();
  await expect(pb.getByText('PARTE 1 DE 3')).toBeVisible({ timeout: 10_000 });
  await expect(pb.getByText('Contar lo del viaje a Cali')).toHaveCount(0);

  // La parte 2 se apoya en Isaías 53:6: todos pasan a ese versículo, y quien quiera abre el capítulo.
  await page.getByRole('button', { name: 'Parte siguiente' }).click();
  await expect(pb.getByText('PARTE 2 DE 3')).toBeVisible({ timeout: 10_000 });
  await expect(pb.getByRole('button', { name: /^Versículo 6$/ })).toBeVisible();
  await expect(pb.getByRole('button', { name: /^Versículo 5$/ })).toHaveCount(0);
  await pb.getByRole('button', { name: 'Leer todo Isaías 53' }).click();
  await expect(pb.getByRole('button', { name: /^Versículo 5$/ })).toBeVisible();

  // La parte 3 trae lo que escribió para el grupo y su dinámica.
  await page.getByRole('button', { name: 'Parte siguiente' }).click();
  await expect(pb.getByText('¿Cuándo corrió Dios hacia ti?')).toBeVisible({ timeout: 10_000 });
  await expect(pb.getByText('Notas privadas del pastor')).toHaveCount(0);
  await pb.context().close();
});

test('en la iglesia: presentar desde Mis sermones, el reloj del punto y una dinámica en los teléfonos', async ({ page, browser, request }) => {
  const m = marca();
  const pastor = await cuentaNueva(request, 'Pastor Reloj');
  await con(page, pastor, [sermon(`e${m}`, `El Padre corre ${m}`)], 'bes');

  await page.goto(`/taller/e${m}/documento`);
  await page.getByRole('button', { name: /Presentarlo en vivo/ }).click();
  await page.getByRole('button', { name: 'En la iglesia, en vivo' }).click();
  await expect(page).toHaveURL(new RegExp(`/taller/e${m}/presentar`));
  const chip = page.getByRole('button', { name: /Empezar el evento en vivo/ });
  await expect(chip).toBeVisible();
  const codigo = ((await chip.textContent()) ?? '').match(/([A-Z0-9]{3}) ([A-Z0-9]{3})/)!.slice(1).join('');
  await chip.click();
  await expect(page.getByText(/EN VIVO · /)).toBeVisible();

  // Hasta el punto con la dinámica, y se manda a los teléfonos.
  for (let i = 0; i < 3; i++) await page.getByText('Siguiente', { exact: true }).click();
  await expect(page.getByText('Termómetro con la mano', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mandarla a los teléfonos' }).click();
  await expect(page.getByText('En los teléfonos de todos')).toBeVisible();

  // La congregación la ve con sus pasos, y abre el pasaje en la versión del pastor.
  const fiel = await navegador(browser);
  await fiel.goto(`/evento/${codigo}`);
  await expect(fiel.getByText('Termómetro con la mano', { exact: true })).toBeVisible();
  await expect(fiel.getByRole('button', { name: /^Paso 1/ })).toBeVisible();
  await fiel.getByRole('button', { name: 'Lucas 15:11-32, leer' }).click();
  await expect(fiel.getByText('BES · Abrir en la Biblia ›')).toBeVisible();

  // En la página del evento, el pastor ve en qué punto va y cuánto lleva.
  await page.goto(`/evento/${codigo}`);
  await expect(page.getByText('TU EVENTO · PUNTO 3 DE 3')).toBeVisible();
  await expect(page.getByText(/Total \d+:\d\d de 20 min/)).toBeVisible();
  await expect(page.getByText(/^\d+:\d\d \/ 8:00$/)).toBeVisible();
  await fiel.context().close();
});
