// Lectura en vivo para la célula: quien guía pasa la hoja y todos la ven, el versículo que alguien toca se
// ilumina para todos, las dinámicas aparecen en cada pantalla y al terminar todos ven el resumen.

import type { APIRequestContext, Browser } from '@playwright/test';

import { type Cuenta, conSesion, cuentaNueva, expect, test } from './support/fixtures';

const hoy = () => new Date().toISOString().slice(0, 10);

async function api(request: APIRequestContext, cuenta: Cuenta, accion: string, body: Record<string, unknown> = {}) {
  const res = await request.post('/api/comunidades', {
    headers: { Authorization: `Bearer ${cuenta.llave}` },
    data: { accion, hoy: hoy(), ...body },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

async function navegador(browser: Browser, cuenta?: Cuenta) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  if (cuenta) await conSesion(page, cuenta);
  return page;
}

test('la célula lee en vivo: pasar la hoja, iluminar, señalar, una dinámica y terminar', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Guía');
  const beto = await cuentaNueva(request, 'Beto Lector');
  const nombre = `Célula ${Math.random().toString(36).slice(2, 7)}`;
  const { id } = await api(request, ana, 'crearGrupo', { nombre, tipo: 'celula', plan: { libro: 'jhn', inicio: hoy(), porDia: 1 } });
  const { grupo } = await api(request, ana, 'grupo', { grupo: id });
  await api(request, beto, 'unirse', { codigo: grupo.codigo });

  // Ana empieza desde la pantalla del grupo, con la lectura de hoy.
  const pa = await navegador(browser, ana);
  await pa.goto(`/grupos/${id}`);
  await expect(pa.getByText('Leer juntos en vivo')).toBeVisible();
  await pa.getByRole('button', { name: 'Empezar con Juan 1' }).click();
  await expect(pa).toHaveURL(/\/vivo\/[A-Z2-9]{6}$/);
  await expect(pa.getByText('Tú guías la lectura')).toBeVisible();
  await expect(pa.getByText('En el principio era el Verbo', { exact: false })).toBeVisible();

  // Beto ve «En vivo ahora» en el grupo y entra.
  const pb = await navegador(browser, beto);
  await pb.goto(`/grupos/${id}`);
  await expect(pb.getByText('EN VIVO AHORA')).toBeVisible();
  await pb.getByRole('button', { name: /Entrar a la lectura/ }).click();
  await expect(pb.getByText('Guía: Ana Guía')).toBeVisible();
  await expect(pa.getByText('2 leyendo')).toBeVisible();

  // Ana pasa la hoja y Beto la ve, con el aviso.
  await pa.getByRole('button', { name: 'Capítulo siguiente' }).click();
  await expect(pb.getByText('Ana pasó a Juan 2')).toBeVisible();
  await expect(pb.getByText('Y al tercer día hiciéronse unas bodas', { exact: false })).toBeVisible();

  // Beto ilumina el versículo 3 y Ana lo ve con su nombre.
  await pb.getByRole('button', { name: /^Versículo 3$/ }).click();
  await expect(pa.getByRole('button', { name: 'Versículo 3, iluminado por Beto Lector' })).toBeVisible();

  // Ana señala el 5: todos lo ven señalado.
  await pa.getByRole('button', { name: /^Versículo 5/ }).click();
  await expect(pb.getByText('ANA SEÑALA')).toBeVisible();

  // Una dinámica del catálogo en todas las pantallas, con su reloj, y Ana avanza el paso.
  await pa.getByRole('button', { name: 'Mostrar' }).click();
  await pa.getByRole('tab', { name: 'Dinámicas' }).click();
  await pa.getByRole('button', { name: /Termómetro con la mano/ }).click();
  await expect(pb.getByText('Termómetro con la mano')).toBeVisible();
  await expect(pb.getByText('PARA CONECTAR', { exact: true })).toBeVisible();
  await expect(pb.getByLabel(/Quedan [45]:\d\d/)).toBeVisible();
  await pa.getByRole('button', { name: 'Paso siguiente' }).click();
  await expect(pb.getByLabel('Paso 2, el de ahora')).toBeVisible();

  // Una pregunta reemplaza la dinámica.
  await pa.getByRole('button', { name: 'Mostrar' }).click();
  await pa.getByRole('tab', { name: 'Pregunta' }).click();
  await pa.getByLabel('Pregunta para el grupo').fill('¿Qué hizo Jesús cuando faltó el vino?');
  await pa.getByRole('button', { name: 'Mostrar a todos' }).click();
  await expect(pb.getByText('¿Qué hizo Jesús cuando faltó el vino?')).toBeVisible();
  await expect(pb.getByText('PARA CONVERSAR')).toBeVisible();

  // Ana termina la lectura para todos; Beto ve el resumen.
  await pa.getByRole('button', { name: 'Ver quiénes están' }).click();
  await pa.getByRole('button', { name: 'Terminar la lectura para todos' }).click();
  await expect(pb.getByText('La lectura terminó')).toBeVisible();
  await expect(pb.getByRole('link', { name: 'Juan 2' })).toBeVisible();
  await expect(pb.getByRole('button', { name: `Volver a ${nombre}` })).toBeVisible();
});

test('entrar con el código sin cuenta: se sigue la lectura y se invita a entrar para iluminar', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Código');
  const res = await request.post('/api/vivo', {
    headers: { Authorization: `Bearer ${ana.llave}` },
    data: { accion: 'crearSala', libro: 'psa', capitulo: 23 },
  });
  const { sala } = await res.json();

  const page = await navegador(browser);
  await page.goto('/vivo');
  await expect(page.getByText('Lean juntos, cada uno en su teléfono')).toBeVisible();
  await page.getByLabel('Código de la lectura en vivo').fill(`${sala.codigo.slice(0, 3).toLowerCase()} ${sala.codigo.slice(3)}`);
  await page.getByRole('button', { name: 'Entrar a la lectura' }).click();
  await expect(page).toHaveURL(new RegExp(`/vivo/${sala.codigo}$`));
  await expect(page.getByText('Jehová es mi pastor', { exact: false })).toBeVisible();
  await expect(page.getByText('para iluminar versículos', { exact: false })).toBeVisible();

  await page.goto('/vivo/ZZZZZZ');
  await expect(page.getByText('No encontramos esa lectura', { exact: true })).toBeVisible();
});

test('estudio en grupo: secciones del estudio, respuestas en secreto y preguntas al estudio', async ({ browser, request }) => {
  const ana = await cuentaNueva(request, 'Ana Estudio');
  const beto = await cuentaNueva(request, 'Beto Estudio');
  const res = await request.post('/api/vivo', {
    headers: { Authorization: `Bearer ${ana.llave}` },
    data: { accion: 'crearSala', libro: 'col', capitulo: 3, titulo: 'Discipulado' },
  });
  const { sala } = await res.json();

  const pa = await navegador(browser, ana);
  await pa.goto(`/vivo/${sala.codigo}`);
  await expect(pa.getByText('Tú guías la lectura')).toBeVisible();
  const pb = await navegador(browser, beto);
  await pb.goto(`/vivo/${sala.codigo}`);
  await expect(pb.getByText('Guía: Ana Estudio')).toBeVisible();

  // Ana manda el Panorama del estudio Profundo a todas las pantallas.
  await pa.getByRole('button', { name: 'Mostrar' }).click();
  await pa.getByRole('button', { name: 'Mostrar «Panorama» a todos' }).click();
  await expect(pb.getByText('DEL ESTUDIO', { exact: true })).toBeVisible();
  await expect(pb.getByText('Pablo pasa de lo que Cristo hizo', { exact: false })).toBeVisible();

  // Una pregunta de «Para aplicar» para que cada uno responda en secreto.
  await pa.getByRole('button', { name: 'Mostrar' }).click();
  await pa.getByRole('button', { name: /ocupa hoy más tu mente/ }).click();
  await expect(pb.getByText('RESPONDE EN SECRETO')).toBeVisible();
  await pb.getByLabel('Tu respuesta').fill('Las preocupaciones del trabajo.');
  await pb.getByRole('button', { name: 'Enviar mi respuesta' }).click();
  await expect(pb.getByText('Tu respuesta está guardada')).toBeVisible();
  await expect(pa.getByText('1 de 2 respondieron')).toBeVisible();
  // Antes de revelar, nadie ve lo que escribió Beto.
  await expect(pa.getByText('Las preocupaciones del trabajo.')).toHaveCount(0);
  await pa.getByRole('button', { name: 'Revelar las respuestas' }).click();
  await expect(pa.getByText('Las preocupaciones del trabajo.')).toBeVisible();
  await expect(pb.getByText('LO QUE RESPONDIÓ EL GRUPO')).toBeVisible();

  // Beto deja una duda en el tablero; Ana se la pregunta al estudio y la respuesta llega a todos.
  await pb.getByRole('button', { name: /^Preguntas del grupo/ }).click();
  await pb.getByLabel('Tu pregunta para el grupo').fill('¿Qué significa estar escondido con Cristo?');
  await pb.getByRole('button', { name: 'Dejar mi pregunta' }).click();
  await expect(pb.getByText('Tu pregunta', { exact: true })).toBeVisible();
  await pb.getByRole('button', { name: 'Cerrar' }).last().click();
  await pa.getByRole('button', { name: 'Preguntas del grupo, 1 por ver' }).click();
  await pa.getByRole('button', { name: 'Preguntar al estudio' }).click();
  await expect(pb.getByText('EL ESTUDIO RESPONDE')).toBeVisible();
  await expect(pb.getByText('Respuesta simulada a «¿Qué significa estar escondido con Cristo?»', { exact: false })).toBeVisible();
  await expect(pb.getByRole('button', { name: 'Preguntas del grupo' })).toBeVisible();
});
