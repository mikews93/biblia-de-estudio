import { describe, expect, it } from 'vitest';

import { PLANS } from './planesCatalogo';
import { PARA_TI_INICIAL, contiene, enRiesgo, paraTi, planesParaTi, temasDe, temasVivos, versiculoDeHoy } from './paraTi';
import { TEMAS } from './temas';

const DIA = 86_400_000;
const ahora = new Date(2026, 9, 25, 9).getTime();
const oracion = (titulo: string, dias = 1, extra: object = {}) => ({ id: titulo, titulo, created: ahora - dias * DIA, ...extra });

describe('reconocer temas en el diario', () => {
  it('reconoce sin tildes ni mayúsculas y al comienzo de una palabra', () => {
    expect(contiene('Mucha ANSIEDAD por el examen', ['ansiedad'])).toBe(true);
    expect(contiene('Estoy ansiosa', ['ansios'])).toBe(true);
    expect(contiene('Pánico en las noches', ['panico'])).toBe(true);
    // «pequeño» no es «pecado», ni «resolución» es «solo»
    expect(contiene('Mi hijo pequeño', ['pecado'])).toBe(false);
  });

  it('da varios temas para una petición', () => {
    expect(temasDe('Ansiedad por la deuda y el trabajo').map((t) => t.id)).toEqual(['ansiedad', 'provision']);
    expect(temasDe('Mi abuela falleció').map((t) => t.id)).toEqual(['duelo']);
  });

  it('no inventa temas donde no los hay', () => {
    expect(temasDe('Por el viaje del sábado')).toEqual([]);
  });
});

describe('temas vivos', () => {
  it('pone primero lo elegido, sin repetir ni ocultos', () => {
    const t = temasVivos(
      [oracion('Ansiedad en el trabajo'), oracion('Tristeza por mi mamá', 3)],
      { ...PARA_TI_INICIAL, temas: ['miedo', 'ansiedad'], ocultos: ['familia'] },
      ahora,
    );
    expect(t.map((x) => x.tema.id)).toEqual(['miedo', 'ansiedad', 'provision']);
    expect(t[0].motivo).toEqual({ tipo: 'elegido' });
    expect(t[2].motivo).toMatchObject({ tipo: 'oracion', titulo: 'Ansiedad en el trabajo' });
  });

  it('la familia es contexto: «la salud de mi mamá» es salud', () => {
    expect(temasVivos([oracion('Por la salud de mi mamá')], PARA_TI_INICIAL, ahora).map((x) => x.tema.id)).toEqual(['salud']);
    expect(temasVivos([oracion('Por mi familia')], PARA_TI_INICIAL, ahora).map((x) => x.tema.id)).toEqual(['familia']);
  });

  it('olvida las peticiones respondidas y las muy antiguas', () => {
    const t = temasVivos([oracion('Ansiedad', 1, { respondida: { fecha: ahora - 30 * DIA } }), oracion('Miedo', 400)], PARA_TI_INICIAL, ahora);
    expect(t).toEqual([]);
  });

  it('una respuesta reciente trae unos días de gratitud', () => {
    const t = temasVivos([oracion('Trabajo para papá', 20, { respondida: { fecha: ahora - 2 * DIA } })], PARA_TI_INICIAL, ahora);
    expect(t[0]).toMatchObject({ tema: { id: 'gratitud' }, motivo: { tipo: 'respondida', titulo: 'Trabajo para papá' } });
  });
});

describe('riesgo', () => {
  it('reconoce cuando alguien no quiere vivir, y lo pone en la tristeza', () => {
    const o = [oracion('Ya no quiero vivir así')];
    expect(enRiesgo(o, ahora)).toBe(true);
    expect(temasVivos(o, PARA_TI_INICIAL, ahora)[0].tema.id).toBe('tristeza');
  });

  it('sigue aunque «Para ti» esté apagado', () => {
    const r = paraTi({ oraciones: [oracion('Pienso en el suicidio')], capitulos: {}, planes: [], ajustes: { ...PARA_TI_INICIAL, activo: false }, fecha: new Date(ahora) });
    expect(r.riesgo).toBe(true);
    expect(r.versiculo).toBeNull();
  });

  it('no salta con palabras comunes', () => {
    expect(enRiesgo([oracion('Quiero vivir para Dios'), oracion('Murió mi perro')], ahora)).toBe(false);
  });
});

describe('versículo de hoy', () => {
  const temas = temasVivos([oracion('ansiedad'), oracion('miedo', 2)], PARA_TI_INICIAL, ahora);

  it('turna los temas día a día', () => {
    const a = versiculoDeHoy(temas, new Date(ahora))!.tema.id;
    const b = versiculoDeHoy(temas, new Date(ahora + DIA))!.tema.id;
    expect(a).not.toBe(b);
  });

  it('no repite el versículo de todos', () => {
    for (let d = 0; d < 40; d++) {
      const fecha = new Date(ahora + d * DIA);
      const v = versiculoDeHoy(temas, fecha)!;
      const [book, chapter, verse] = v.palabra.ref;
      const otro = versiculoDeHoy(temas, fecha, { book, chapter, verse })!;
      expect(otro.palabra.ref).not.toEqual(v.palabra.ref);
    }
  });

  it('sin temas no hay versículo', () => {
    expect(versiculoDeHoy([], new Date(ahora))).toBeNull();
  });
});

describe('planes sugeridos', () => {
  const ansiedad = temasVivos([oracion('ansiedad')], PARA_TI_INICIAL, ahora);

  it('un plan del tema y un primer paso para quien empieza', () => {
    expect(planesParaTi(ansiedad, {}, []).map((s) => s.plan)).toEqual(['paz-ansiedad', 'juan']);
  });

  it('no sugiere un plan ya empezado', () => {
    expect(planesParaTi(ansiedad, {}, [{ def: 'paz-ansiedad' }]).map((s) => s.plan)).toEqual([]);
  });

  it('después de Juan, Romanos; y nada si ya hay un plan a tu ritmo en curso', () => {
    const juan = { jhn: Array.from({ length: 21 }, (_, i) => i + 1) };
    expect(planesParaTi([], juan, [{ def: 'juan', finished: '2026-10-01' }]).map((s) => s.plan)).toEqual(['romanos']);
    expect(planesParaTi([], juan, [{ def: 'salmos' }])).toEqual([]);
  });
});

describe('el banco de temas', () => {
  it('cada plan de un tema existe, va un capítulo por día y tiene título y pregunta para cada día', () => {
    for (const t of TEMAS.filter((x) => x.plan)) {
      const def = PLANS.find((p) => p.id === t.plan);
      expect(def, t.id).toBeTruthy();
      expect(def!.tema).toBe(t.id);
      expect(def!.spec.every(([, c]) => c), t.id).toBe(true);
      expect(def!.days?.length).toBe(def!.spec.length);
      expect(def!.questions?.length).toBe(def!.spec.length);
    }
  });

  it('cada tema tiene versículos con su línea y palabras sin tildes', () => {
    for (const t of TEMAS) {
      expect(t.versiculos.length, t.id).toBeGreaterThanOrEqual(6);
      for (const v of t.versiculos) expect(v.luz.length, `${t.id} ${v.ref}`).toBeGreaterThan(10);
      for (const p of t.palabras) expect(p).toBe(p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
    }
  });
});
