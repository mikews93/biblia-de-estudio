// «Círculo de solteros»: pedir entrar, que la líder apruebe, responder la pregunta de la semana, marcarse en secreto
// y, cuando es mutuo, «Conocernos» con su primer día y la conversación.
import type { APIRequestContext } from '@playwright/test';

import { conSesion, correoUnico, cuentaNueva, expect, test, type Cuenta } from './support/fixtures';

const pad = (n: number) => String(n).padStart(2, '0');
const dia = (atras: number) => {
  const d = new Date(Date.now() - atras * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

async function post(request: APIRequestContext, body: Record<string, unknown>, llave?: string, hoy = dia(0)) {
  const res = await request.post('/api/comunidades', {
    data: { hoy, ...body },
    headers: llave ? { Authorization: `Bearer ${llave}` } : {},
  });
  const json = await res.json();
  expect(res.ok(), JSON.stringify(json)).toBeTruthy();
  return json;
}

/** La cuenta de quien cuida Zarza (CUIDADORES en e2e/support/server.ts). */
async function cuidadora(request: APIRequestContext) {
  const datos = { correo: 'cuidadora@prueba.test', clave: 'clave-segura-1' };
  const r = await request.post('/api/comunidades', { data: { accion: 'entrar', ...datos } });
  if (r.ok()) return (await r.json()).llave as string;
  return (await post(request, { accion: 'registrarse', nombre: 'Cuidadora', ...datos })).llave as string;
}

/** Una iglesia con un círculo y una líder; las personas entran con el código de la iglesia. */
async function iglesiaConCirculo(request: APIRequestContext) {
  const cuida = await cuidadora(request);
  const { iglesia } = await post(request, { accion: 'cuidarNuevaIglesia', nombre: 'Iglesia Vida Nueva' }, cuida);
  const { id } = await post(request, { accion: 'cuidarNuevoCirculo', iglesia: iglesia.id, nombre: 'Jóvenes adultos', edadMin: 18, edadMax: 35 }, cuida);
  const correo = correoUnico('Lidia');
  const lider = (await post(request, { accion: 'registrarse', nombre: 'Lidia Gómez', correo, clave: 'clave-segura-1' })) as Cuenta;
  await post(request, { accion: 'cuidarLiderCirculo', circulo: id, correo }, cuida);
  return { codigo: iglesia.codigo as string, circulo: id as string, lider };
}

test('pedir entrar al círculo, ser aprobada y responder la pregunta de la semana', async ({ page, request }) => {
  const { codigo, circulo, lider } = await iglesiaConCirculo(request);
  const ana = await cuentaNueva(request, 'Ana Ruiz');
  await post(request, { accion: 'iglesiaUnirme', codigo }, ana.llave);
  await conSesion(page, ana);

  await page.goto('/circulo');
  await expect(page.getByText('Conocerse creciendo en la Palabra').filter({ visible: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Abierto/a a conocer a alguien' }).filter({ visible: true }).click();
  await page.getByLabel('Día').filter({ visible: true }).fill('10');
  await page.getByLabel('Mes').filter({ visible: true }).fill('5');
  await page.getByLabel('Año').filter({ visible: true }).fill('2000');
  const pedir = page.getByRole('button', { name: 'Pedir entrar' }).filter({ visible: true });
  await expect(pedir).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Acepto el acuerdo' }).filter({ visible: true }).click();
  await pedir.click();
  await expect(page.getByText('PEDIDO ENVIADO').filter({ visible: true })).toBeVisible();

  // La líder aprueba desde su panel
  const lideresa = await page.context().newPage();
  await lideresa.addInitScript((v) => window.localStorage.setItem('cuenta', v), JSON.stringify(lider));
  await lideresa.goto(`/circulo/lider/${circulo}`);
  await expect(lideresa.getByText('Ana Ruiz').filter({ visible: true })).toBeVisible();
  await expect(lideresa.getByText(/años · Abierto\/a a conocer a alguien/).filter({ visible: true })).toBeVisible();
  await lideresa.getByRole('button', { name: 'Aprobar', exact: true }).filter({ visible: true }).click();
  await expect(lideresa.getByText('No hay pedidos nuevos.').filter({ visible: true })).toBeVisible();
  await lideresa.close();

  await page.reload();
  await expect(page.getByText(/^ESTA SEMANA · /).filter({ visible: true })).toBeVisible();
  await page.getByPlaceholder('Escribe lo que piensas. Lo leerá tu círculo.').filter({ visible: true }).fill('Que Dios es fiel aunque no vea el final.');
  await page.getByRole('button', { name: 'Compartir con el círculo' }).filter({ visible: true }).click();
  await expect(page.getByText('Tu respuesta').filter({ visible: true })).toBeVisible();
  await expect(page.getByText('Que Dios es fiel aunque no vea el final.').filter({ visible: true })).toBeVisible();
});

test('marcarse en secreto, que sea mutuo y empezar «Conocernos»', async ({ page, request }) => {
  const { codigo, circulo, lider } = await iglesiaConCirculo(request);
  const entra = async (nombre: string) => {
    const c = await cuentaNueva(request, nombre);
    await post(request, { accion: 'iglesiaUnirme', codigo }, c.llave);
    await post(request, { accion: 'circuloPedir', circulo, nacimiento: '1998-03-02', etapa: 'abierto', acepto: true }, c.llave);
    await post(request, { accion: 'circuloAprobar', usuario: c.usuario.id, si: true }, lider.llave);
    // Dos semanas anteriores respondidas: ya comparten algo
    for (const atras of [7, 14]) await post(request, { accion: 'circuloResponder', texto: `Mi respuesta de hace ${atras} días` }, c.llave, dia(atras));
    return c;
  };
  const ana = await entra('Ana Ruiz');
  const beto = await entra('Beto Salas');
  await conSesion(page, ana);

  await page.goto('/circulo');
  await page.getByRole('button', { name: /Beto Salas/ }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Me gustaría conocerte' }).filter({ visible: true }).click();
  await expect(page.getByText('Beto no lo sabe. Si también te marca, se avisará a los dos.').filter({ visible: true })).toBeVisible();

  // Beto marca a Ana: es mutuo
  const { mutuo } = await post(request, { accion: 'circuloMarcar', usuario: ana.usuario.id }, beto.llave);
  expect(mutuo).toBeTruthy();
  await page.reload();
  await expect(page.getByText(/CONOCERNOS · DÍA 1 DE 7/).filter({ visible: true })).toBeVisible();
  await page.getByText('Tú y Beto').filter({ visible: true }).click();

  await expect(page.getByText('Tu historia con Dios').filter({ visible: true })).toBeVisible();
  await page.getByPlaceholder(/Beto lo verá cuando también responda/).filter({ visible: true }).fill('Conocí a Jesús en un campamento a los 15.');
  await page.getByRole('button', { name: 'Guardar mi respuesta' }).filter({ visible: true }).click();
  await expect(page.getByText('Tu respuesta está guardada. Verás la de Beto cuando responda.').filter({ visible: true })).toBeVisible();

  await post(request, { accion: 'circuloConocerResponder', id: mutuo, dia: 1, texto: 'Mi abuela me llevaba a la iglesia.' }, beto.llave);
  await post(request, { accion: 'circuloMensaje', id: mutuo, texto: 'Hola Ana, ¿me prestas dinero?' }, beto.llave);
  await page.reload();
  // Con un mensaje nuevo y nada que responder hoy, se abre en la conversación
  await expect(page.getByText('Hola Ana, ¿me prestas dinero?').filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/Habla de dinero\. Ten cuidado/).filter({ visible: true })).toBeVisible();
  await page.getByPlaceholder('Mensaje para Beto').filter({ visible: true }).fill('Hola Beto, mejor no. ¿Nos vemos el domingo con el grupo?');
  await page.getByRole('button', { name: 'Enviar' }).filter({ visible: true }).click();
  await expect(page.getByText('Hola Beto, mejor no. ¿Nos vemos el domingo con el grupo?').filter({ visible: true })).toBeVisible();

  // Las respuestas del primer día ya se ven: respondieron los dos
  await page.getByRole('radio', { name: 'Los siete días' }).filter({ visible: true }).click();
  await expect(page.getByText('Mi abuela me llevaba a la iglesia.').filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/MAÑANA · DÍA 2 DE 7/).filter({ visible: true })).toBeVisible();
});
