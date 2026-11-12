// Pantallas del video de función «Círculo y Hombres de pie» (no es una prueba). Basado en e2e/capturas-circulo.mjs.
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts), que trae CUIDADORES=cuidadora@prueba.test.
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:8081';
const ROOT = new URL('../../', import.meta.url).pathname;
const OUT = `${ROOT}public/capturas/funciones/circulo`;
mkdirSync(OUT, { recursive: true });
const pad = (n) => String(n).padStart(2, '0');
const dia = (atras) => {
  const d = new Date(Date.now() - atras * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const sufijo = Date.now().toString(36);

async function post(body, llave, hoy = dia(0)) {
  const r = await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
    body: JSON.stringify({ hoy, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${body.accion}: ${JSON.stringify(j)}`);
  return j;
}
const cuenta = async (nombre, bio) => {
  const correo = `${nombre.split(' ')[0].toLowerCase()}.${sufijo}@prueba.test`;
  const c = await post({ accion: 'registrarse', nombre, correo, clave: 'clave-segura-1' });
  if (bio) c.usuario = (await post({ accion: 'guardarPerfil', nombre, bio }, c.llave)).usuario;
  return { ...c, correo };
};
async function cuidadora() {
  const datos = { correo: 'cuidadora@prueba.test', clave: 'clave-segura-1' };
  const r = await fetch(`${BASE}/api/comunidades`, { method: 'POST', body: JSON.stringify({ accion: 'entrar', ...datos }) });
  if (r.ok) return r.json();
  return post({ accion: 'registrarse', nombre: 'Cuidadora', ...datos });
}

// La iglesia, dos círculos por edades y su líder
const cuida = await cuidadora();
const { iglesia } = await post({ accion: 'cuidarNuevaIglesia', nombre: 'Iglesia Vida Nueva', ciudad: 'Medellín' }, cuida.llave);
const { id: circulo } = await post({ accion: 'cuidarNuevoCirculo', iglesia: iglesia.id, nombre: 'Jóvenes adultos', edadMin: 18, edadMax: 35 }, cuida.llave);
await post({ accion: 'cuidarNuevoCirculo', iglesia: iglesia.id, nombre: 'Adultos', edadMin: 36 }, cuida.llave);
const lidia = await cuenta('Lidia Gómez');
await post({ accion: 'cuidarLiderCirculo', circulo, correo: lidia.correo }, cuida.llave);

const SEMANAS = [
  [14, 'Que Rut decidió quedarse con Noemí sin saber si alguna vez se casaría. Eso me reta: ser fiel hoy.'],
  [7, 'Que la soledad no es castigo. Dios hizo la compañía y la iglesia es parte de ella.'],
];
const R = (hijos, misiones, ministerio, estable = 'si', finanzas = 'abierto') => ({ hijos, misiones, ministerio, estable, finanzas });
const IMPORTAS = {
  Felipe: { respuestas: R('si', 'si', 'abierto'), innegociables: ['hijos'], sirvo: 'Alabanza', proposito: 'Llevar a otros a adorar a Dios con la música, aquí y en las misiones.' },
  Sara: { respuestas: R('si', 'si', 'no'), innegociables: ['hijos'], sirvo: 'Escuela dominical', proposito: 'Enseñar la Palabra a los niños y servir en misiones de verano.' },
  Daniela: { respuestas: R('si', 'abierto', 'no'), innegociables: [], sirvo: 'Bienvenida', proposito: 'Cuidar a los enfermos como lo haría Jesús.' },
  Andrés: { respuestas: R('si', 'abierto', 'abierto'), innegociables: [], sirvo: 'Sonido', proposito: 'Usar la ingeniería para servir a mi ciudad.' },
  Camila: { respuestas: R('abierto', 'abierto', 'abierto', 'abierto'), innegociables: [], sirvo: 'Diseño de la iglesia', proposito: '', solteria: true },
  Jonatán: { respuestas: R('no', 'no', 'no', 'abierto', 'no'), innegociables: ['hijos'], sirvo: '', proposito: '' },
  Mateo: { respuestas: R('si', 'si', 'si'), innegociables: ['ministerio'], sirvo: 'Jóvenes', proposito: 'Prepararme para predicar el Evangelio donde Dios me envíe.' },
};
/** Las siete etapas del camino, terminadas hace unas semanas (o solo las primeras `hasta`). */
async function camino(llave, hasta = 7) {
  for (let n = 1; n <= hasta; n++) await post({ accion: 'caminoTerminar', etapa: n }, llave, dia(40 - n));
}
const MUJERES = new Set(['Sara', 'Daniela', 'Camila', 'Valeria', 'Lucía', 'Paula', 'Juliana']);
const sexo = (nombre) => (MUJERES.has(nombre.split(' ')[0]) ? 'm' : 'h');
async function entra(nombre, bio, etapa, nacimiento, respuestas = SEMANAS, codigo = iglesia.codigo) {
  const c = await cuenta(nombre, bio);
  await camino(c.llave);
  await post({ accion: 'circuloImporta', importa: IMPORTAS[nombre.split(' ')[0]] ?? IMPORTAS.Sara }, c.llave);
  await post({ accion: 'iglesiaUnirme', codigo }, c.llave);
  await post({ accion: 'circuloPedir', circulo, nacimiento, etapa, sexo: sexo(nombre), acepto: true }, c.llave);
  await post({ accion: 'circuloAprobar', usuario: c.usuario.id, si: true }, lidia.llave);
  for (const [atras, texto] of respuestas) await post({ accion: 'circuloResponder', texto }, c.llave, dia(atras));
  return c;
}
const felipe = await entra('Felipe Ospina', 'Toco guitarra en la alabanza. Aprendiendo a esperar en Dios.', 'abierto', '1997-04-12');
const sara = await entra('Sara Vélez', 'Maestra de niños los domingos. Me encanta el café y los Salmos.', 'abierto', '1999-08-30');
const daniela = await entra('Daniela Restrepo', 'Enfermera. Sirvo en el equipo de bienvenida.', 'abierto', '1998-01-21');
const andres = await entra('Andrés Mejía', 'Ingeniero. Leo un capítulo de Proverbios cada día.', 'abierto', '1996-11-03');
const camila = await entra('Camila Torres', 'Estudio diseño. Aquí para hacer amigos que amen a Jesús.', 'soltero', '2002-06-15');
const jonatan = await entra('Jonatán Arias', null, 'abierto', '1995-02-09', [SEMANAS[0]]);

// Una iglesia hermana de la misma ciudad suma sus solteros al círculo
const { iglesia: betel } = await post({ accion: 'cuidarNuevaIglesia', nombre: 'Iglesia Betel', ciudad: 'Medellín' }, cuida.llave);
await post({ accion: 'circuloHermana', circulo, codigo: betel.codigo }, lidia.llave);
await entra('Paula Gil', 'Sirvo con los adolescentes en Betel.', 'soltero', '2000-03-18', SEMANAS, betel.codigo);
await entra('Juliana Ríos', 'Contadora. Me gusta caminar y orar en la mañana.', 'abierto', '1997-10-05', SEMANAS, betel.codigo);

// Respuestas de esta semana
await post({ accion: 'circuloResponder', texto: 'Me cuesta esperar sin ansiedad. Deleitarme en Él es buscarlo por quien es, no por lo que me da.' }, sara.llave);
await post({ accion: 'circuloResponder', texto: 'Para mí es cantarle aunque nada haya cambiado todavía. Ahí encuentro descanso.' }, andres.llave);
await post({ accion: 'circuloResponder', texto: 'Estoy aprendiendo a confiarle mis planes, no solo mis problemas.' }, camila.llave);

// Daniela y Andrés se eligieron: «Conocernos», con el primer día hecho ayer
await post({ accion: 'circuloMarcar', usuario: andres.usuario.id }, daniela.llave);
const { mutuo } = await post({ accion: 'circuloMarcar', usuario: daniela.usuario.id }, andres.llave);
await post({ accion: 'circuloConocerResponder', id: mutuo, dia: 1, texto: 'A los 15, en un campamento. Desde entonces aprendí que Dios no se cansa de mí.' }, daniela.llave, dia(1));
await post({ accion: 'circuloConocerResponder', id: mutuo, dia: 1, texto: 'Crecí en la iglesia, pero lo conocí de verdad cuando murió mi papá. Él me sostuvo.' }, andres.llave, dia(1));
await post({ accion: 'circuloMensaje', id: mutuo, texto: 'Hola Daniela. Me conmovió lo del campamento, gracias por contarlo.' }, andres.llave);
await post({ accion: 'circuloMensaje', id: mutuo, texto: '¡Gracias Andrés! Lo de tu papá también. ¿Vas al estudio del jueves?' }, daniela.llave);
await post({ accion: 'circuloMensaje', id: mutuo, texto: 'Sí, ahí estaré. Si quieres te paso mi número: 300 555 1234' }, andres.llave);

// Un pedido nuevo y un reporte para la líder
const mateo = await cuenta('Mateo Pineda', 'Recién llegado a Vida Nueva. Me bauticé en agosto.');
await camino(mateo.llave);
await post({ accion: 'circuloImporta', importa: IMPORTAS.Mateo }, mateo.llave);
await post({ accion: 'iglesiaUnirme', codigo: iglesia.codigo }, mateo.llave);
await post({ accion: 'circuloPedir', circulo, nacimiento: '2000-09-09', etapa: 'abierto', sexo: 'h', acepto: true }, mateo.llave);
await post({ accion: 'circuloReportar', usuario: jonatan.usuario.id, motivo: 'Me presionó o me incomodó', detalle: 'Me escribió varias veces por Facebook después del culto.' }, camila.llave);

// Alguien de la iglesia que todavía no pidió entrar, y alguien sin iglesia
const valeria = await cuenta('Valeria Cano');
await post({ accion: 'iglesiaUnirme', codigo: iglesia.codigo }, valeria.llave);
await post({ accion: 'circuloImporta', importa: { ...IMPORTAS.Sara, proposito: 'Acompañar a los jóvenes de mi barrio.' } }, valeria.llave);
// Alguien a mitad del camino, para las capturas del camino
const lucia = await cuenta('Lucía Herrera');
await post({ accion: 'iglesiaUnirme', codigo: iglesia.codigo }, lucia.llave);
for (let n = 1; n <= 2; n++) await post({ accion: 'caminoTerminar', etapa: n }, lucia.llave, dia(3 - n));
// Otros dos en camino, para los números de la iglesia
for (const [nombre, hasta] of [['Pablo Ríos', 4], ['Marta Gil', 1]]) {
  const x = await cuenta(nombre);
  await post({ accion: 'iglesiaUnirme', codigo: iglesia.codigo }, x.llave);
  await camino(x.llave, hasta);
}
const tomas = await cuenta('Tomás León');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page(c, { diario, extra } = {}) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, colorScheme: 'dark', locale: 'es-CO', timezoneId: 'America/Bogota' });
  const p = await ctx.newPage();
  await p.addInitScript((cu) => { localStorage.setItem('cuenta', cu); localStorage.setItem('permiso-ia', 'si'); }, JSON.stringify({ llave: c.llave, usuario: c.usuario }));
  if (diario) await p.addInitScript(([k, v]) => localStorage.setItem(k, v), [`camino-diario:${c.usuario.id}`, JSON.stringify(diario)]);
  if (extra) await p.addInitScript(([k, v]) => localStorage.setItem(k, v), extra);
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const toques = {};
const shot = async (p, name, loc = null, espera = 1200) => {
  let tap = null;
  if (loc) { const b = await loc.boundingBox(); tap = b && { x: Math.round((b.x + b.width / 2) * 2.625), y: Math.round((b.y + b.height / 2) * 2.625) }; }
  await wait(espera);
  await p.getByText('Tu progreso quedó guardado').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  await p.screenshot({ path: `${OUT}/${name}.png` });
  toques[name] = tap;
  console.log(name, tap ?? '');
};
const vis = (l) => l.filter({ visible: true }).first();

const diario = {
  1: ['En que mi familia esté orgullosa de mí. Dios dice que me escogió antes de todo.', 'Servir, mis amigos, la iglesia. Mi vida es de Dios.', '«Nos escogió en él antes de la fundación del mundo».'],
  2: ['En la escuela dominical. Dicen que explico con paciencia.', 'Los niños que no tienen a nadie que les hable de Jesús.', 'Me veo en misiones de verano, no sé si a tiempo completo.', 'Enseñar la Palabra a los niños y acompañar a sus familias.'],
  3: ['Quiero repetir las comidas en familia y orar juntos. No quiero repetir los gritos.'],
};
let p = await page(lucia, { diario });
await p.goto(`${BASE}/circulo/camino`);
await vis(p.getByText('2 DE 7 ETAPAS')).waitFor();
await shot(p, '1-camino', null, 2500);
await p.goto(`${BASE}/circulo/camino/3`);
await vis(p.getByText('ETAPA 3 DE 7')).waitFor();
await shot(p, '2-etapa', null, 2000);

p = await page(felipe);
await p.goto(`${BASE}/circulo`);
await vis(p.getByText(/^ESTA SEMANA · /)).waitFor();
await shot(p, '3-circulo', null, 2000);
await p.mouse.move(206, 450);
await p.mouse.wheel(0, 500);
const sarab = vis(p.getByRole('button', { name: /Sara Vélez/ }));
await sarab.scrollIntoViewIfNeeded();
await shot(p, '3b-circulo-abajo', sarab);
await sarab.click();
await vis(p.getByRole('button', { name: 'Me gustaría conocerte' })).scrollIntoViewIfNeeded();
await shot(p, '4-persona');

p = await page(daniela);
await p.goto(`${BASE}/circulo/conocer/${mutuo}`);
await vis(p.getByText('Tú y Andrés')).waitFor();
await shot(p, '5-conocernos', null, 2000);

const hd = { respuestas: { 1: ['En hablar de mi fe en el trabajo.'] }, hechas: { 1: '2026-10-11', 2: '2026-10-18', 3: '2026-10-24', 4: '2026-10-25' }, retos: { 1: true, 2: true, 4: true } };
p = await page(tomas, { extra: ['hombres-de-pie', JSON.stringify(hd)] });
await p.goto(`${BASE}/hombres`);
await vis(p.getByText('4 DE 8 SEMANAS')).waitFor();
await shot(p, '6-hombres', null, 2000);
await p.goto(`${BASE}/hombres/5`);
await vis(p.getByText(/Hierro con hierro se aguza/)).waitFor();
await shot(p, '7-semana', null, 1500);
await vis(p.getByText('EL RETO DE LA SEMANA')).scrollIntoViewIfNeeded();
await shot(p, '8-reto', null, 1000);

await browser.close();
writeFileSync(`${ROOT}src/funciones/circulo.taps.json`, JSON.stringify(toques, null, 1) + '\n');
