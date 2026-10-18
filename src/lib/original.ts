// Sin dependencias de React Native: también lo usa la función api/estudiar.ts.

/** Idioma original de un libro: hebreo (con los pasajes arameos) en el AT, griego en el NT. */
export function original(book: { testament: 'AT' | 'NT' }) {
  return book.testament === 'AT'
    ? { name: 'hebreo', word: 'palabra hebrea', icon: 'א', rtl: true, source: 'TAHOT', credit: 'Hebreo y morfología: STEPBible.org, Tyndale House (CC BY 4.0) · glosas en español propias' }
    : { name: 'griego', word: 'palabra griega', icon: 'α', rtl: false, source: 'TAGNT', credit: 'Griego, glosas y morfología: STEPBible.org, Tyndale House (CC BY 4.0)' };
}
