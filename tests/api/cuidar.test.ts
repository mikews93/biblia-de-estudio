// Señales de los estudios (api/_senales.ts), «Cuidar Zarza» (api/_cuidar.ts) y las iglesias anfitrionas
// (api/_iglesias.ts). Necesita DATABASE_URL (ver tests/api/helpers.ts) y public/data.
import { beforeAll, describe, expect, it } from 'vitest';

import { client, DB_URL, ensureSchema, HAS_DATA, Post, prepareEnv, request, unique } from './helpers';

let estudiar: Post;
let comunidades: Post;
let requests: { system?: unknown }[];
const cuidadora = unique('Cuidadora');

beforeAll(async () => {
  process.env.LAMPARA_DIA = '1';
  process.env.IGLESIA_TOPE_DIA = '2';
  process.env.CUIDADORES = `otra@prueba.test, ${cuidadora.correo.toUpperCase()}`;
  ({ requests } = await prepareEnv({ ai: true }));
  ({ POST: estudiar } = await import('../../api/estudiar'));
  ({ POST: comunidades } = await import('../../api/comunidades'));
  if (DB_URL && HAS_DATA) await ensureSchema(comunidades);
});

const call = () => client(comunidades, '2026-10-22');
const ask = (body: object, llave: string) => estudiar(request('/api/estudiar', body, llave));
/** Pide y lee la respuesta entera: el estudio se guarda al terminar de enviarse. */
const leer = async (body: object, llave: string) => {
  const res = await ask(body, llave);
  await res.text();
  return res.status;
};
const json = async (res: Response) => ({ status: res.status, json: (await res.json()) as Record<string, any> });

async function cuenta(nombre: string, extra: Record<string, unknown> = {}) {
  return (await call()('registrarse', { nombre, ...extra })).json.llave as string;
}

describe.skipIf(!DB_URL || !HAS_DATA)('Señales y Cuidar Zarza', () => {
  it('«Me ayudó» suma una vez por persona y se puede quitar; «Algo suena raro» pide un motivo', async () => {
    const ana = await cuenta('Ana');
    const beto = await cuenta('Beto');
    const pasaje = { book: 'rut', chapter: 2, verse: 3 };
    const antes = (await json(await ask({ ...pasaje, senales: true }, ana))).json.ayudo as number;

    let r = await json(await ask({ ...pasaje, senal: { tipo: 'ayudo' } }, ana));
    expect(r.json).toMatchObject({ ayudo: antes + 1, mio: { ayudo: true, raro: false }, frecuentes: [] });
    r = await json(await ask({ ...pasaje, senal: { tipo: 'ayudo' } }, ana));
    expect(r.json.ayudo).toBe(antes + 1);
    r = await json(await ask({ ...pasaje, senales: true }, beto));
    expect(r.json).toMatchObject({ ayudo: antes + 1, mio: { ayudo: false } });
    r = await json(await ask({ ...pasaje, senal: { tipo: 'ayudo', quitar: true } }, ana));
    expect(r.json.ayudo).toBe(antes);

    expect((await ask({ ...pasaje, senal: { tipo: 'raro' } }, beto)).status).toBe(400);
    r = await json(await ask({ ...pasaje, senal: { tipo: 'raro', motivo: 'dato', nota: 'Booz no era moabita' } }, beto));
    expect(r.json.mio).toEqual({ ayudo: false, raro: true });
    // Un estudio con preguntas no tiene señales
    expect((await ask({ ...pasaje, senales: true, messages: [{ role: 'assistant', text: 'x' }, { role: 'user', text: '¿y?' }] }, ana)).status).toBe(400);
  });

  it('solo quien cuida Zarza ve el resumen; descartar y preparar de nuevo limpian los reportes', async () => {
    const llave = await cuenta(cuidadora.nombre, { correo: cuidadora.correo, clave: 'una clave larga' });
    const otro = await cuenta('Curioso');
    expect((await call()('cuidarResumen', {}, otro)).status).toBe(403);
    expect((await call()('yo', {}, otro)).json.cuidador).toBe(false);
    expect((await call()('yo', {}, llave)).json.cuidador).toBe(true);

    const pasaje = { book: 'rut', chapter: 3 };
    for (const nombre of ['R1', 'R2']) await ask({ ...pasaje, senal: { tipo: 'raro', motivo: 'doctrina' } }, await cuenta(nombre));
    let resumen = (await call()('cuidarResumen', {}, llave)).json;
    const fila = resumen.raros.find((r: any) => r.clave === 'c2:profundo:rut:3::');
    expect(fila).toMatchObject({ raros: 2, libro: 'rut', capitulo: 3, versiculo: null, motivos: ['doctrina', 'doctrina'] });

    expect((await call()('cuidarDescartar', { clave: fila.clave }, llave)).status).toBe(200);
    resumen = (await call()('cuidarResumen', {}, llave)).json;
    expect(resumen.raros.some((r: any) => r.clave === fila.clave)).toBe(false);

    // Preparar de nuevo: el estudio guardado se borra y el siguiente que lo abre llama a la IA.
    await leer(pasaje, otro);
    const n = requests.length;
    await leer(pasaje, otro);
    expect(requests.length).toBe(n);
    expect((await call()('cuidarRehacer', { clave: fila.clave }, llave)).status).toBe(200);
    await leer(pasaje, otro);
    expect(requests.length).toBe(n + 1);
  });

  it('las preguntas de cinco personas se vuelven frecuentes al aprobarlas, y su respuesta se guarda para todos', async () => {
    const llave = (await call()('entrar', { correo: cuidadora.correo, clave: 'una clave larga' })).json.llave as string;
    const turno = (texto: string) => [{ role: 'assistant', text: 'Estudio' }, { role: 'user', text: texto }];
    const base = { book: 'oba', chapter: 1 };
    for (let i = 0; i < 5; i++) {
      const p = await cuenta(`Pregunta ${i}`);
      expect(await leer({ ...base, compartir: true, messages: turno(`¿Por qué Edom recibe juicio? (${i})`) }, p)).toBe(200);
    }
    const resumen = (await call()('cuidarResumen', {}, llave)).json;
    expect(resumen.minPersonas).toBe(5);
    expect(resumen.pasajes.find((p: any) => p.libro === 'oba' && p.capitulo === 1)).toMatchObject({ nuevas: expect.any(Number) });

    const detalle = (await call()('cuidarPasaje', { libro: 'oba', capitulo: 1 }, llave)).json;
    const nuevas = detalle.preguntas.filter((p: any) => p.nueva);
    expect(nuevas.length).toBeGreaterThanOrEqual(5);
    expect(detalle.preguntas[0].quien).toBe('P1');
    expect(JSON.stringify(detalle)).not.toMatch(/[0-9a-f]{24}/); // nunca el seudónimo de la base

    const { propuestas } = (await call()('cuidarProponer', { libro: 'oba', capitulo: 1 }, llave)).json;
    expect(propuestas).toEqual([{ texto: '¿Por qué Abdías anuncia juicio contra Edom?', versiculo: null, personas: 5 }]);
    const { id } = (await call()('cuidarAprobar', { libro: 'oba', capitulo: 1, texto: propuestas[0].texto, personas: 5 }, llave)).json;
    expect((await call()('cuidarRevisado', { libro: 'oba', capitulo: 1 }, llave)).status).toBe(200);
    const despues = (await call()('cuidarResumen', {}, llave)).json;
    expect(despues.pasajes.some((p: any) => p.libro === 'oba' && p.capitulo === 1)).toBe(false);

    const lector = await cuenta('Lector');
    const senales = (await json(await ask({ book: 'oba', chapter: 1, verse: 4, senales: true }, lector))).json;
    expect(senales.frecuentes).toContainEqual({ id, texto: propuestas[0].texto, versiculo: null });

    // La respuesta se prepara una vez, con el modelo de lo compartido, sin gastar la lámpara (LAMPARA_DIA=1).
    const n = requests.length;
    for (let i = 0; i < 3; i++) expect(await leer({ book: 'oba', chapter: 1, frecuente: id }, lector)).toBe(200);
    expect(requests.length).toBe(n + 1);
    expect((await ask({ book: 'rut', chapter: 1, frecuente: id }, lector)).status).toBe(404);

    expect((await call()('cuidarQuitarFrecuente', { id }, llave)).status).toBe(200);
    expect((await ask({ book: 'oba', chapter: 1, frecuente: id }, lector)).status).toBe(404);
  });

  it('una iglesia anfitriona da a sus miembros más preguntas al día', async () => {
    const llave = (await call()('entrar', { correo: cuidadora.correo, clave: 'una clave larga' })).json.llave as string;
    const nueva = (await call()('cuidarNuevaIglesia', { nombre: 'Iglesia de prueba', ciudad: 'Medellín', lampara: 3 }, llave)).json;
    expect(nueva.iglesia).toMatchObject({ nombre: 'Iglesia de prueba', lampara: 3, activa: true });
    const codigo = nueva.iglesia.codigo as string;

    expect((await call()('iglesiaVer', { codigo: codigo.toLowerCase() })).json).toMatchObject({
      iglesia: { nombre: 'Iglesia de prueba', ciudad: 'Medellín', miembros: 0 },
      soyMiembro: false,
    });
    const miembro = await cuenta('Miembro');
    expect((await call()('iglesiaUnirme', { codigo }, miembro)).json.iglesia).toMatchObject({ miembros: 1 });
    expect((await call()('yo', {}, miembro)).json.iglesia).toEqual({ nombre: 'Iglesia de prueba', codigo, lampara: 3 });

    const pregunta = (texto: string) => ({ book: 'rut', chapter: 4, messages: [{ role: 'assistant', text: 'E' }, { role: 'user', text: texto }] });
    for (const t of ['¿Uno?', '¿Dos?', '¿Tres?']) expect(await leer(pregunta(t), miembro)).toBe(200);
    expect((await ask(pregunta('¿Cuatro?'), miembro)).status).toBe(429);

    // Sin iglesia, el tope general (1) y la invitación a entrar con el código de la iglesia
    const suelto = await cuenta('Suelto');
    expect(await leer(pregunta('¿Uno?'), suelto)).toBe(200);
    const vacia = await json(await ask(pregunta('¿Dos?'), suelto));
    expect(vacia.status).toBe(429);
    expect(vacia.json.error).toContain('entra con su código');

    // Pausada, el código deja de servir y vuelve el tope general
    expect((await call()('cuidarIglesia', { id: nueva.iglesia.id, activa: false }, llave)).status).toBe(200);
    expect((await call()('iglesiaVer', { codigo })).status).toBe(404);
    expect((await call()('yo', {}, miembro)).json.iglesia).toBeNull();
    expect((await call()('cuidarIglesia', { id: nueva.iglesia.id, activa: true }, miembro)).status).toBe(403);
  });

  it('un pastor postula su iglesia; se rechaza con motivo, se corrige y al aprobarla queda de encargado', async () => {
    const llave = (await call()('entrar', { correo: cuidadora.correo, clave: 'una clave larga' })).json.llave as string;
    const pastor = await cuenta('Pastor Pablo');
    const datos = {
      nombre: 'Iglesia Bautista La Roca',
      ciudad: 'Cali, Colombia',
      responsable: 'Pablo Gómez',
      cargo: 'Pastor',
      contacto: '+57 300 000 0000',
      enlace: 'facebook.com/larocacali',
      fe: true,
    };
    expect((await call()('iglesiaPostular', { ...datos, fe: false }, pastor)).status).toBe(400);
    expect((await call()('iglesiaPostular', { ...datos, contacto: ' ' }, pastor)).status).toBe(400);
    expect((await call()('iglesiaPostular', { ...datos, enlace: 'mi iglesia' }, pastor)).status).toBe(400);
    expect((await call()('iglesiaPostular', datos)).status).toBe(401);
    let r = await call()('iglesiaPostular', datos, pastor);
    expect(r.json.postulacion).toMatchObject({ nombre: datos.nombre, estado: 'pendiente' });
    expect((await call()('iglesiaPostular', datos, pastor)).status).toBe(409);

    // Quien cuida la ve con todos sus datos, y el enlace con https
    const pendiente = (await call()('cuidarResumen', {}, llave)).json.postulaciones.find((p: any) => p.nombre === datos.nombre);
    expect(pendiente).toMatchObject({ responsable: 'Pablo Gómez', contacto: '+57 300 000 0000', enlace: 'https://facebook.com/larocacali', cuenta: 'Pastor Pablo' });
    expect((await call()('cuidarPostulacion', { id: pendiente.id, aprobar: true }, pastor)).status).toBe(403);
    expect((await call()('cuidarPostulacion', { id: pendiente.id, aprobar: false }, llave)).status).toBe(400);
    r = await call()('cuidarPostulacion', { id: pendiente.id, aprobar: false, motivo: 'No encontramos la iglesia en Maps: agrega la dirección.' }, llave);
    expect(r.json).toEqual({ estado: 'rechazada' });
    expect((await call()('iglesiaEncargo', {}, pastor)).json).toMatchObject({
      postulacion: { estado: 'rechazada', motivo: 'No encontramos la iglesia en Maps: agrega la dirección.' },
      iglesia: null,
    });

    r = await call()('iglesiaPostular', { ...datos, direccion: 'Calle 5 # 10-20' }, pastor);
    const otra = (await call()('cuidarResumen', {}, llave)).json.postulaciones.find((p: any) => p.id === r.json.postulacion.id);
    expect(otra.direccion).toBe('Calle 5 # 10-20');
    r = await call()('cuidarPostulacion', { id: otra.id, aprobar: true, lampara: 5 }, llave);
    expect(r.json).toMatchObject({ estado: 'aprobada', iglesia: { nombre: datos.nombre, ciudad: 'Cali, Colombia', lampara: 5 } });
    expect((await call()('cuidarPostulacion', { id: otra.id, aprobar: true }, llave)).status).toBe(404);

    // El encargado ya es miembro, ve su iglesia y puede cambiar el código; el viejo deja de servir
    const encargo = (await call()('iglesiaEncargo', {}, pastor)).json;
    expect(encargo.iglesia).toMatchObject({ nombre: datos.nombre, miembros: 1, semana: 1, pausa: null, lampara: 5 });
    expect((await call()('yo', {}, pastor)).json.iglesia).toMatchObject({ nombre: datos.nombre, lampara: 5 });
    const viejo = encargo.iglesia.codigo as string;
    const { codigo } = (await call()('iglesiaNuevoCodigo', {}, pastor)).json;
    expect(codigo).not.toBe(viejo);
    expect((await call()('iglesiaVer', { codigo: viejo })).status).toBe(404);
    expect((await call()('iglesiaNuevoCodigo', {}, await cuenta('Intruso'))).status).toBe(403);
    expect((await call()('iglesiaPostular', { ...datos, nombre: 'Otra' }, pastor)).status).toBe(409);

    // Con el tope de 2 miembros nuevos al día (IGLESIA_TOPE_DIA), el tercero pausa el código; los de adentro siguen
    expect((await call()('iglesiaUnirme', { codigo }, await cuenta('Uno'))).status).toBe(200);
    expect((await call()('iglesiaUnirme', { codigo }, await cuenta('Dos'))).status).toBe(200);
    const tarde = await cuenta('Tres');
    expect((await call()('iglesiaUnirme', { codigo }, tarde)).status).toBe(423);
    expect((await call()('yo', {}, pastor)).json.iglesia).toMatchObject({ nombre: datos.nombre });
    expect((await call()('iglesiaEncargo', {}, pastor)).json.iglesia.pausa).toContain('miembros nuevos');
    const pausada = (await call()('cuidarResumen', {}, llave)).json.iglesias.find((i: any) => i.nombre === datos.nombre);
    expect(pausada).toMatchObject({ encargado: 'Pastor Pablo', miembros: 3 });
    expect(pausada.pausa).toBeTruthy();

    // Al reanudarla se cuenta desde ese momento
    expect((await call()('cuidarIglesia', { id: pausada.id, reanudar: true }, llave)).status).toBe(200);
    expect((await call()('iglesiaUnirme', { codigo }, tarde)).json.iglesia).toMatchObject({ miembros: 4 });
  });
});
