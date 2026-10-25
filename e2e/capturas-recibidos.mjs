// Capturas de «Enviar a un amigo» y /recibidos (no es una prueba):
// node e2e/capturas-recibidos.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const post = async (llave, accion, body = {}) =>
  (
    await fetch(`${BASE}/api/comunidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
      body: JSON.stringify({ accion, ...body }),
    })
  ).json();
const nueva = (nombre) => post(null, 'registrarse', { nombre });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(cuenta, { desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript((cu) => localStorage.setItem('cuenta', cu), JSON.stringify(cuenta));
  return p;
}

async function recorrido(prefix, opts) {
  const mike = await nueva('Mike Blanco');
  const ana = await nueva('Ana Lucía');
  const beto = await nueva('Beto Ramírez');
  const sara = await nueva('Sara Gómez');
  for (const o of [ana, beto, sara]) {
    await post(mike.llave, 'pedirAmistad', { usuario: o.usuario.id });
    await post(o.llave, 'pedirAmistad', { usuario: mike.usuario.id });
  }
  await post(ana.llave, 'enviarVersiculo', {
    para: mike.usuario.id, libro: 'isa', capitulo: 41, versiculo: 10,
    datos: { estilo: 'Luz', formato: 'cuadrado', letra: 'elegante', dedicatoria: 'Oro por tu semana' },
  });
  await post(beto.llave, 'enviarVersiculo', {
    para: mike.usuario.id, libro: 'psa', capitulo: 23, versiculo: 1,
    datos: { estilo: 'Trigal', formato: 'cuadrado', letra: 'amano', dedicatoria: 'Gracias por tu vida' },
  });

  const p = await page(mike, opts);
  await p.goto(`${BASE}/comunidades`);
  await p.getByText('Versículos para ti').waitFor();
  await wait(1200);
  await p.screenshot({ path: `${OUT}/${prefix}-1-comunidad.png` });
  await p.getByText('Versículos para ti').click();
  await p.getByText('te envió un versículo').first().waitFor();
  await wait(1500);
  await p.screenshot({ path: `${OUT}/${prefix}-2-recibidos.png` });
  await p.getByRole('button', { name: 'Amén a Beto Ramírez' }).click();
  await wait(600);
  await p.screenshot({ path: `${OUT}/${prefix}-3-amen.png` });

  await p.goto(`${BASE}/juan/3`);
  await p.getByText('Porque de tal manera amó Dios al mundo').click();
  await p.getByRole('button', { name: 'Compartir', exact: true }).click();
  await p.getByText('Enviar a un amigo de Zarza').click();
  await p.getByRole('checkbox', { name: 'Sara Gómez' }).click();
  await p.getByRole('checkbox', { name: 'Ana Lucía' }).click();
  await p.getByRole('button', { name: /^Enviar a / }).evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await wait(800);
  await p.screenshot({ path: `${OUT}/${prefix}-4-enviar.png` });
  await p.getByRole('button', { name: /^Enviar a / }).click();
  await p.getByText(/^Enviado a/).waitFor();
  await post(sara.llave, 'versiculosRecibidos');
  const { recibidos } = await post(sara.llave, 'versiculosRecibidos');
  await post(sara.llave, 'responderVersiculo', { id: recibidos[0].id, respuesta: 'gracias' });
  await p.goto(`${BASE}/recibidos?ver=enviados`);
  await p.getByText('Para ').first().waitFor();
  await wait(1500);
  await p.screenshot({ path: `${OUT}/${prefix}-5-enviados.png` });
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
