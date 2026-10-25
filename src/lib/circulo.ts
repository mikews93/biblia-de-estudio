// Las reglas del «Círculo de solteros» que comparten la app y el servidor (api/_circulo.ts): las etapas del perfil,
// la edad, la pregunta de cada semana, el plan «Conocernos» y el aviso de mensajes que suenan a estafa. Sin React
// Native.
//
// La propuesta que Mike eligió (2026-10-25) está en /mnt/project-files/investigacion/circulo-solteros.html: los
// solteros de una iglesia se conocen en grupos pequeños y supervisados, compartiendo la Palabra; solo cuando dos
// personas se marcan en secreto la una a la otra se abre un plan de 7 días para conocerse. Sin deslizar, sin
// distancia, sin galerías de fotos y sin mensajes privados entre quienes no se eligieron.

export type Etapa = 'soltero' | 'abierto' | 'relacion' | 'casado';

export const ETAPAS: { value: Etapa; label: string; corta: string }[] = [
  { value: 'soltero', label: 'Soltero o soltera', corta: 'Soltero/a' },
  { value: 'abierto', label: 'Abierto/a a conocer a alguien', corta: 'Abierto/a a conocer a alguien' },
  { value: 'relacion', label: 'En una relación', corta: 'En una relación' },
  { value: 'casado', label: 'Casado o casada', corta: 'Casado/a' },
];

export const etapaDe = (v: unknown): Etapa | null => (ETAPAS.some((e) => e.value === v) ? (v as Etapa) : null);
export const etapaCorta = (v: Etapa | null | undefined) => ETAPAS.find((e) => e.value === v)?.corta ?? null;
/** Quién puede pedir entrar al círculo. */
export const puedeEntrar = (v: Etapa | null | undefined) => v === 'soltero' || v === 'abierto';

/** Solo adultos: las tiendas dejan Zarza en 13+, así que el círculo pide 18. */
export const EDAD_MINIMA = 18;
/** Un círculo es pequeño a propósito: en una iglesia grande, se abren varios (por edades, por ejemplo). */
export const MAX_CIRCULO = 30;
/** «Me gustaría conocerte» que se pueden tener abiertos a la vez, nuevos en 30 días y cuántos días dura uno. */
export const MAX_MARCAS_ABIERTAS = 2;
export const MAX_MARCAS_MES = 3;
export const DIAS_MARCA = 30;
/** Preguntas de la semana que dos personas tienen que haber respondido las dos antes de poder marcarse. */
export const SEMANAS_EN_COMUN = 2;
/** Reportes de personas distintas que pausan a alguien en el círculo hasta que un líder lo revise. */
export const REPORTES_PAUSA = 2;
/** Tras cerrar «Conocernos», dos personas no pueden volver a marcarse en este tiempo. */
export const DIAS_TRAS_CERRAR = 90;

export const ACUERDO = [
  'Tengo 18 años o más y no estoy casado ni casada.',
  'Vengo a conocer personas de mi iglesia con respeto, sin presionar a nadie.',
  'No pediré ni enviaré fotos íntimas, dinero ni datos privados.',
  'Las primeras veces que nos veamos será en la iglesia o en grupo.',
  'Si algo me incomoda, lo reporto. Los líderes del círculo me pueden pausar o quitar si no cumplo este acuerdo.',
];

/** La edad cumplida en `hoy` («AAAA-MM-DD») de quien nació en `nacimiento`. */
export function edad(nacimiento: string, hoy: string) {
  const [y, m, d] = nacimiento.split('-').map(Number);
  const [hy, hm, hd] = hoy.split('-').map(Number);
  return hy - y - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

export const fechaValida = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

/** El lunes de la semana de `dia`: la clave de la pregunta de la semana. */
export function lunes(dia: string) {
  const f = new Date(`${dia}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7));
  return f.toISOString().slice(0, 10);
}

export type Pasaje = { book: string; chapter: number; from: number; to: number };
const p = (book: string, chapter: number, from: number, to = from): Pasaje => ({ book, chapter, from, to });

export type Semana = { titulo: string; referencia: string; pasaje: Pasaje; pregunta: string };

/** Lo que el círculo lee y conversa cada semana. Se repite en orden; todos los círculos van en la misma semana. */
export const SEMANAS: Semana[] = [
  { titulo: 'Fiel antes de saber el final', referencia: 'Rut 1:16-18', pasaje: p('rut', 1, 16, 18), pregunta: '¿Qué te enseña Rut sobre ser fiel antes de saber cómo termina tu historia?' },
  { titulo: 'No es bueno estar solo', referencia: 'Génesis 2:18-24', pasaje: p('gen', 2, 18, 24), pregunta: '¿Qué dice este pasaje sobre por qué Dios nos hizo para la compañía, también la de los amigos y la iglesia?' },
  { titulo: 'Esperar con confianza', referencia: 'Salmo 37:3-7', pasaje: p('psa', 37, 3, 7), pregunta: '¿Qué significa para ti deleitarte en el Señor mientras esperas algo que deseas?' },
  { titulo: 'Así es el amor', referencia: '1 Corintios 13:4-7', pasaje: p('1co', 13, 4, 7), pregunta: '¿Cuál de estas descripciones del amor te cuesta más vivir hoy, con cualquier persona?' },
  { titulo: 'Contentos en toda etapa', referencia: 'Filipenses 4:11-13', pasaje: p('php', 4, 11, 13), pregunta: '¿En qué parte de tu vida estás aprendiendo a estar contento o contenta?' },
  { titulo: 'Guardar el corazón', referencia: 'Proverbios 4:20-27', pasaje: p('pro', 4, 20, 27), pregunta: '¿Qué dejas entrar a tu corazón que te llena de paz, y qué te llena de ansiedad?' },
  { titulo: 'Una etapa para servir', referencia: '1 Corintios 7:32-35', pasaje: p('1co', 7, 32, 35), pregunta: '¿Qué puertas te abre tu etapa de hoy para servir a Dios y a otros?' },
  { titulo: 'Honrar al otro', referencia: 'Romanos 12:9-13', pasaje: p('rom', 12, 9, 13), pregunta: '¿Cómo podemos honrarnos unos a otros en este círculo esta semana?' },
  { titulo: 'Con respeto y santidad', referencia: '1 Tesalonicenses 4:3-8', pasaje: p('1th', 4, 3, 8), pregunta: '¿Por qué crees que Pablo une la pureza con no hacerle daño al hermano?' },
  { titulo: 'Mejores son dos', referencia: 'Eclesiastés 4:9-12', pasaje: p('ecc', 4, 9, 12), pregunta: '¿Quiénes son las personas que te levantan cuando caes?' },
  { titulo: 'Lo que no se ve', referencia: 'Proverbios 31:25-30', pasaje: p('pro', 31, 25, 30), pregunta: '¿Qué rasgos de carácter valoras más que la apariencia, en un amigo o en una pareja?' },
  { titulo: 'Primero el reino', referencia: 'Mateo 6:31-34', pasaje: p('mat', 6, 31, 34), pregunta: '¿Qué preocupación quieres poner en manos de Dios esta semana?' },
];

// Lunes de referencia para contar las semanas (5 de enero de 2026).
const LUNES_CERO = Date.UTC(2026, 0, 5);

export function semanaDe(dia: string): Semana & { clave: string } {
  const clave = lunes(dia);
  const n = Math.floor((Date.parse(`${clave}T00:00:00Z`) - LUNES_CERO) / (7 * 86_400_000));
  return { ...SEMANAS[((n % SEMANAS.length) + SEMANAS.length) % SEMANAS.length], clave };
}

export type DiaConocer = Semana & { ora: string };

/**
 * «Conocernos»: seis días cortos, cada uno responde a solas, y un séptimo para verse en persona. Empieza por el
 * propósito y lo que no se negocia, no por los gustos: la pregunta es si pueden buscar el Reino mejor juntos.
 */
export const CONOCERNOS: DiaConocer[] = [
  { titulo: 'Tu historia con Dios', referencia: 'Salmo 40:1-3', pasaje: p('psa', 40, 1, 3), pregunta: '¿Cómo conociste a Jesús y qué ha cambiado en ti desde entonces?', ora: 'Da gracias por la historia de fe de la otra persona.' },
  { titulo: 'Tu llamado', referencia: 'Efesios 2:10', pasaje: p('eph', 2, 10), pregunta: '¿A qué sientes que Dios te llama, y cómo lo estás viviendo hoy?', ora: 'Pide que Dios confirme el llamado de los dos, juntos o no.' },
  { titulo: 'Lo que no negocias', referencia: 'Amós 3:3', pasaje: p('amo', 3, 3), pregunta: 'Miren juntos «Lo que sí importa»: hijos, misiones, ministerio. ¿Por qué es importante para ti lo que respondiste?', ora: 'Pide honestidad para hablar claro desde el principio.' },
  { titulo: 'Lo que te formó', referencia: 'Deuteronomio 6:4-9', pasaje: p('deu', 6, 4, 9), pregunta: '¿Cómo se vivía la fe en tu casa mientras crecías? ¿Qué quisieras repetir y qué cambiar?', ora: 'Ora por la familia de la otra persona.' },
  { titulo: 'Tu carácter', referencia: 'Colosenses 3:12-14', pasaje: p('col', 3, 12, 14), pregunta: '¿Cómo reaccionas cuando te enojas o te equivocas? ¿Cómo pides perdón?', ora: 'Ora para que los dos crezcan en carácter, juntos o no.' },
  { titulo: 'Servir juntos', referencia: 'Génesis 24:17-20', pasaje: p('gen', 24, 17, 20), pregunta: 'Rebeca se conoció sirviendo. Propongan algo para servir juntos esta semana con la iglesia, y cuenten: ¿podrían servir a Dios mejor juntos que por separado?', ora: 'Pide sabiduría para ver con claridad, no solo con emoción.' },
  { titulo: 'Verse en persona', referencia: 'Filipenses 2:1-4', pasaje: p('php', 2, 1, 4), pregunta: 'Después de verse en la iglesia, con el grupo o con un líder: ¿cómo fue servir y decidir juntos? ¿Llegaron a acuerdos sin que nadie se impusiera? ¿Qué te gustaría hacer ahora?', ora: 'Pide paz para decidir con libertad, sea cual sea la respuesta.' },
];
export const DIAS_CONOCER = CONOCERNOS.length;

/**
 * El día de «Conocernos» que toca: el siguiente al último que respondieron los dos, uno por día. `hechos` son los
 * días respondidos por los dos con la fecha en que se completaron.
 */
export function diaConocer(hechos: { dia: number; fecha: string }[], hoy: string) {
  const n = hechos.length;
  if (n >= DIAS_CONOCER) return { dia: DIAS_CONOCER, abierto: false, terminado: true };
  const ultimo = hechos.reduce((a, h) => (h.fecha > a ? h.fecha : a), '');
  return { dia: n + 1, abierto: !ultimo || ultimo < hoy, terminado: false };
}

/**
 * Las señales típicas de una estafa o de presión en los primeros días: pedir dinero, fotos, datos o pasar la
 * conversación a otra app. No se bloquea el mensaje: quien lo recibe ve un aviso y puede reportarlo.
 */
const ALERTAS: { re: RegExp; motivo: string }[] = [
  { re: /\b(dinero|plata|pr[ée]stamo|transfer(encia|ir)|dep[óo]sito|deposit(a|ar)|paypal|western union|bitcoin|cripto|tarjeta|cuenta bancaria|nequi|yape|zelle|bizum)\b/i, motivo: 'Habla de dinero' },
  { re: /\b(whats ?app|telegram|signal|snap(chat)?|instagram|insta|tiktok|facebook|messenger|wa\.me)\b/i, motivo: 'Pide pasar a otra app' },
  { re: /(\+?\d[\d\s().-]{7,}\d)/, motivo: 'Comparte un número de teléfono' },
  { re: /\b(fotos?|nudes?|pack|desnud[oa]s?|sexy|video ?llamada a solas)\b/i, motivo: 'Pide fotos' },
  { re: /\b(direcci[óo]n de tu casa|d[óo]nde vives|tu direcci[óo]n|vivo solo|ven a mi casa|mi casa sol[oa])\b/i, motivo: 'Pide datos de dónde vives' },
];

export function alertaMensaje(texto: string): string | null {
  for (const a of ALERTAS) if (a.re.test(texto)) return a.motivo;
  return null;
}

export const MOTIVOS_REPORTE = ['Me presionó o me incomodó', 'Pidió dinero, fotos o datos', 'Lenguaje o contenido inapropiado', 'Creo que está casado/a o miente', 'Otro'];
