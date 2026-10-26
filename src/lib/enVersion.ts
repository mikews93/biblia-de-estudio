// Los versículos para compartir en la versión que la persona lee. Las listas fijas (ocasiones, «Para llevar a casa»,
// el devocional, que la IA arma con una versión libre) traen el texto de la RV1909; al compartir se cambia por el
// de la versión elegida y, si no se puede cargar (sin conexión, sin licencia), se queda en la RV1909.

import { useEffect, useState } from 'react';

import type { VerseToShare } from './compartir';
import { Verse, getChapter, getVersions } from './data';
import { licensedById } from './licenciadas';
import { useSettings } from './theme';

let abreviaturas: Promise<Record<string, string>> | null = null;

/** La sigla de una versión («NBLA», «RV1909»…), o null si no se conoce. */
export async function siglaDe(version: string) {
  const licenciada = licensedById(version);
  if (licenciada) return licenciada.abbr;
  abreviaturas ??= getVersions()
    .then((vs) => Object.fromEntries(vs.map((v) => [v.id, v.abbr])))
    .catch(() => ({}));
  return (await abreviaturas)[version] ?? null;
}

export async function enVersion<T extends VerseToShare>(versos: T[], version: string | undefined): Promise<T[]> {
  if (!version || version === 'rv1909') return versos;
  const sigla = await siglaDe(version);
  if (!sigla) return versos;
  return Promise.all(
    versos.map(async (v) => {
      if (v.version === sigla) return v;
      const texto = (await getChapter(v.book, v.chapter, version).catch(() => [])).find(([n]) => n === v.verse)?.[1];
      return texto ? { ...v, text: texto, version: sigla } : v;
    }),
  );
}

/**
 * Un capítulo en la versión que la persona lee; si no se puede cargar (sin conexión una con derechos), en `respaldo`
 * (la RV1909 si no se dice otra). Devuelve también la sigla de la versión en que llegó.
 */
export function useCapitulo(book: string | undefined, chapter: number | undefined, respaldo = 'rv1909') {
  const { settings } = useSettings();
  const [leido, setLeido] = useState<{ clave: string; verses: Verse[]; sigla: string } | null>(null);
  const clave = `${book}.${chapter}.${settings.version}.${respaldo}`;
  useEffect(() => {
    if (!book || !chapter) return;
    let vivo = true;
    const abrir = (v: string) => Promise.all([getChapter(book, chapter, v), siglaDe(v)]).then(([verses, sigla]) => ({ verses, sigla: sigla ?? v.toUpperCase() }));
    abrir(settings.version)
      .catch(() => abrir(respaldo))
      .then((r) => vivo && setLeido({ clave, ...r }))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  return leido?.clave === clave ? leido : null;
}
