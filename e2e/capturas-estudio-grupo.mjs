// Capturas del estudio en grupo de la lectura en vivo (no es una prueba): node e2e/capturas-estudio-grupo.mjs <carpeta>
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const hoy = new Date().toISOString().slice(0, 10);

async function post(path, body, llave) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: JSON.stringify({ hoy, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}
const cuenta = (nombre) =>
  post('/api/comunidades', {
    accion: 'registrarse',
    nombre,
    correo: `${nombre.split(' ')[0].toLowerCase()}${Date.now()}${Math.random().toString(36).slice(2, 6)}@prueba.test`,
    clave: 'clave-segura-1',
  });

const browser = await chromium.launch();
async function page(c, { device = 'Pixel 7', theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-ES' };
  const ctx = await browser.newContext(device === 'desktop' ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices[device], ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript((cu) => cu && localStorage.setItem('cuenta', cu), c ? JSON.stringify(c) : null);
  return p;
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const mike = await cuenta('Mike Blanco');
const beto = await cuenta('Beto Ramírez');
const carla = await cuenta('Carla Gómez');
const dani = await cuenta('Daniel Ruiz');
const sala = await post('/api/vivo', { accion: 'crearSala', libro: 'col', capitulo: 3, titulo: 'Discipulado de los jueves' }, mike.llave);
const S = sala.sala.codigo;
for (const c of [beto, carla, dani]) await post('/api/vivo', { accion: 'unirseSala', sala: S }, c.llave);
const vivo = (body, c = mike) => post('/api/vivo', { sala: S, ...body }, c.llave);

// 1. Mike abre «Mostrar»: el estudio Profundo del capítulo por secciones
const pm = await page(mike);
await pm.goto(`${BASE}/vivo/${S}`);
await pm.getByText('Tú guías la lectura').waitFor();
await pm.getByRole('button', { name: 'Mostrar' }).click();
await pm.getByRole('button', { name: 'Mostrar «Panorama» a todos' }).waitFor();
await wait(500);
await shot(pm, 'm-1-guia-estudio');
await pm.keyboard.press('Escape');

// 2. Beto ve la sección en su teléfono
await vivo({
  accion: 'moverSala',
  tarjeta: {
    tipo: 'estudio',
    titulo: 'Palabras del griego',
    texto:
      '**Zēteite** («buscad», v. 1) está en presente: no es una decisión de una vez, sino una búsqueda que sigue cada día ⟦1⟧.\n\n**Kekryptai** («está escondida», v. 3) está en perfecto: la vida del creyente quedó guardada con Cristo y sigue guardada ⟦2⟧.\n\n- *Nekrōsate* («haced morir», v. 5) es un mandato decidido.\n- *Endysasthe* («vestíos», v. 12) es la imagen de ponerse ropa nueva.',
    fuentes: [
      { n: 1, label: 'Colosenses 3:1', ref: 'col.3.1' },
      { n: 2, label: 'Colosenses 3:3', ref: 'col.3.3' },
    ],
  },
});
const pb = await page(beto);
await pb.goto(`${BASE}/vivo/${S}`);
await pb.getByText('DEL ESTUDIO', { exact: true }).waitFor();
await wait(1200);
await shot(pb, 'm-2-seccion-miembro');

// 3. Una pregunta para responder en secreto: Beto escribe (oscuro)
await vivo({ accion: 'moverSala', tarjeta: { tipo: 'ronda', titulo: '¿Qué cosa «de la tierra» ocupa hoy más tu mente que Cristo?' } });
await vivo({ ronda: (await vivo({ accion: 'unirseSala' }, carla)).estado.tarjeta.id, accion: 'responderSala', texto: 'Las redes. Me doy cuenta de que las miro antes que la Biblia.' }, carla);
const pbo = await page(beto, { theme: 'oscuro' });
await pbo.goto(`${BASE}/vivo/${S}`);
await pbo.getByText('RESPONDE EN SECRETO').waitFor();
await pbo.getByLabel('Tu respuesta').fill('El trabajo nuevo. Vivo pensando en si lo estoy haciendo bien.');
await wait(800);
await shot(pbo, 'm-3-responder-oscuro');
await pbo.getByRole('button', { name: 'Enviar mi respuesta' }).click();
await pbo.getByText('Tu respuesta está guardada').waitFor();

// 4. Mike ve quiénes ya respondieron, sin leer las respuestas
await pm.reload();
await pm.getByText('2 de 4 respondieron').waitFor();
await wait(800);
await shot(pm, 'm-4-guia-esperando');

// 5. Reveladas
const ronda = (await vivo({ accion: 'unirseSala' }, dani)).estado.tarjeta.id;
await vivo({ accion: 'responderSala', ronda, texto: 'Lo que la gente piensa de mí. Quiero «vestirme» de lo que Dios dice.' }, dani);
await vivo({ accion: 'moverSala', revelar: true });
await pb.getByText('LO QUE RESPONDIÓ EL GRUPO').waitFor();
await wait(1500);
await shot(pb, 'm-5-reveladas');

// 6. El tablero de preguntas del grupo, visto por Mike
const q1 = (await vivo({ accion: 'preguntarSala', texto: '¿Qué significa que nuestra vida está «escondida con Cristo en Dios»?' }, beto)).preguntas.at(-1).id;
const q2 = (await vivo({ accion: 'preguntarSala', texto: '¿Cómo «hago morir» algo que sigo sintiendo?' }, carla)).preguntas.at(-1).id;
await vivo({ accion: 'preguntarSala', texto: '¿Por qué Pablo habla de esclavos y amos? ¿Lo aprueba?' }, dani);
await vivo({ accion: 'apoyarSala', pregunta: q2 }, beto);
await vivo({ accion: 'apoyarSala', pregunta: q2 }, dani);
await vivo({ accion: 'apoyarSala', pregunta: q1 }, carla);
await pm.reload();
await pm.getByText('Tú guías la lectura').waitFor();
await pm.getByRole('button', { name: /^Preguntas del grupo/ }).click();
await pm.getByText('Preguntar al estudio').first().waitFor();
await wait(500);
await shot(pm, 'm-6-tablero-guia');
await pm.keyboard.press('Escape');

// 7. La respuesta del estudio en el teléfono de Carla (oscuro)
await vivo({
  accion: 'moverSala',
  tarjeta: {
    tipo: 'estudio',
    pregunta: q2,
    titulo: '¿Cómo «hago morir» algo que sigo sintiendo?',
    texto:
      'Pablo no dice que dejarás de sentir, sino que ya no vives para eso. El mandato del v. 5 se apoya en algo que ya pasó: «habéis muerto, y vuestra vida está escondida con Cristo» ⟦1⟧.\n\n## En la práctica\n\n- Nombrar lo que hay que dejar, como hace la lista del v. 5.\n- Cambiarlo por algo: el v. 12 dice de qué «vestirse» ⟦2⟧.\n- Hacerlo en compañía: «soportándoos y perdonándoos» (v. 13).',
    fuentes: [
      { n: 1, label: 'Colosenses 3:3', ref: 'col.3.3' },
      { n: 2, label: 'Colosenses 3:12', ref: 'col.3.12' },
    ],
  },
});
const pco = await page(carla, { theme: 'oscuro' });
await pco.goto(`${BASE}/vivo/${S}`);
await pco.getByText('EL ESTUDIO RESPONDE').waitFor();
await wait(1500);
await shot(pco, 'm-7-respuesta-estudio-oscuro');

// 8. Escritorio: Mike con la respuesta, y el tablero en oscuro
const pd = await page(mike, { device: 'desktop' });
await pd.goto(`${BASE}/vivo/${S}`);
await pd.getByText('EL ESTUDIO RESPONDE').waitFor();
await wait(1000);
await shot(pd, 'd-1-guia-respuesta');
const pdo = await page(dani, { device: 'desktop', theme: 'oscuro' });
await pdo.goto(`${BASE}/vivo/${S}`);
await pdo.getByRole('button', { name: /^Preguntas del grupo/ }).click();
await pdo.getByText('Dejar mi pregunta').waitFor();
await wait(600);
await shot(pdo, 'd-2-tablero-oscuro');

await browser.close();
console.log('listo');
