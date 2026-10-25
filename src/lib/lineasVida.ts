// Líneas gratuitas de prevención del suicidio y apoyo emocional, para la tarjeta «No estás solo» de Hoy.
// Revisadas en octubre de 2026 con las páginas de los ministerios de salud; antes de cambiar una, comprobarla otra vez.
// El país sale del idioma del teléfono, sin pedir la ubicación. Sin React Native.

export type LineaVida = {
  pais: string;
  nombre: string;
  linea: string;
  /** Lo que se marca. */
  tel: string;
  /** Opción del menú, horario o zona, si hace falta saberlo. */
  nota?: string;
};

export const LINEAS_VIDA: LineaVida[] = [
  { pais: 'AR', nombre: 'Argentina', linea: 'Centro de Asistencia al Suicida', tel: '135', nota: 'Gratis desde CABA y Gran Buenos Aires; desde el resto del país, 0800 345 1435. De 8 a 24 h.' },
  { pais: 'CL', nombre: 'Chile', linea: 'Línea de prevención del suicidio', tel: '*4141', nota: 'Desde un celular, las 24 horas.' },
  { pais: 'CO', nombre: 'Colombia', linea: 'Línea 106', tel: '106', nota: 'Las 24 horas.' },
  { pais: 'CR', nombre: 'Costa Rica', linea: 'Línea Aquí Estoy', tel: '8002737869', nota: 'Lunes a viernes de 14 a 22 h; sábados de 9 a 16 h.' },
  { pais: 'EC', nombre: 'Ecuador', linea: 'Línea 171, opción 6', tel: '171', nota: 'Marca la opción 6. De 7 a 20 h.' },
  { pais: 'ES', nombre: 'España', linea: 'Línea 024', tel: '024', nota: 'Atención a la conducta suicida, las 24 horas.' },
  { pais: 'US', nombre: 'Estados Unidos', linea: '988 Lifeline', tel: '988', nota: 'Marca 2 para español. Las 24 horas.' },
  { pais: 'MX', nombre: 'México', linea: 'Línea de la Vida', tel: '8009112000', nota: 'Las 24 horas.' },
  { pais: 'PA', nombre: 'Panamá', linea: 'Línea 147 · Tu vida importa', tel: '147', nota: 'Las 24 horas.' },
  { pais: 'PY', nombre: 'Paraguay', linea: 'Línea de crisis 155', tel: '155', nota: 'Las 24 horas.' },
  { pais: 'PE', nombre: 'Perú', linea: 'Línea 113, opción 5', tel: '113', nota: 'Marca la opción 5. Las 24 horas.' },
  { pais: 'UY', nombre: 'Uruguay', linea: 'Línea Vida', tel: '08000767', nota: 'Desde un celular, *0767. Las 24 horas.' },
];

/** Emergencias del país: 112 en España, 131 en Chile, 123 en Colombia, 106 en Perú, 110 en Bolivia, 911 en el resto. */
export function emergenciasDe(pais: string | null) {
  return ({ ES: '112', CL: '131', CO: '123', PE: '106', BO: '110' } as Record<string, string>)[pais ?? ''] ?? '911';
}

/** «es-MX» → la línea de México; null si el país no tiene una línea revisada. */
export function lineaDe(locale: string | undefined | null): LineaVida | null {
  const m = /[-_]([A-Za-z]{2})\b/.exec(locale ?? '');
  const pais = m?.[1].toUpperCase();
  return LINEAS_VIDA.find((l) => l.pais === pais) ?? null;
}

export function paisDelTelefono(): string | null {
  try {
    const m = /[-_]([A-Za-z]{2})\b/.exec(Intl.DateTimeFormat().resolvedOptions().locale);
    return m?.[1].toUpperCase() ?? null;
  } catch {
    return null;
  }
}

/** «8009112000» → «800 911 2000»; los números cortos quedan igual. */
export function telefonoLegible(tel: string) {
  if (/^800\d{7}$/.test(tel)) return `${tel.slice(0, 3)} ${tel.slice(3, 6)} ${tel.slice(6)}`;
  if (/^0800\d{4}$/.test(tel)) return `0800 ${tel.slice(4)}`;
  return tel;
}
