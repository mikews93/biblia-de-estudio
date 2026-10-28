// Calibra cuándo una búsqueda rápida es «floja» (api/_semantica.ts esFloja): corre búsquedas con respuesta conocida
// y otras sin respuesta clara en la Biblia, e imprime sus señales y qué tan bien las separa cada umbral de parecido.
// Uso (con los datos y los vectores ya en public/data): DATA_DIR=public/data npx tsx pipeline/semantica/calibrar.ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { type Senales, quickSearch } from '../../api/_semantica';

const DATA_DIR = process.env.DATA_DIR ?? 'public/data';

// Búsqueda → versículos que deberían salir entre los 5 primeros (basta uno)
const BUENAS: [string, string[]][] = [
  ['cuando tengo miedo', ['psa.56.3', 'isa.41.10', 'jos.1.9', 'psa.23.4', '2ti.1.7', 'psa.27.1']],
  ['la ansiedad', ['php.4.6', '1pe.5.7', 'mat.6.34', 'mat.6.25']],
  ['perdonar a quien me hirió', ['mat.6.14', 'eph.4.32', 'col.3.13', 'mat.18.21', 'mat.18.22', 'luk.17.4']],
  ['dar gracias en la prueba', ['1th.5.18', 'jas.1.2', 'rom.5.3']],
  ['el amor es paciente', ['1co.13.4']],
  ['Dios tiene planes para mí', ['jer.29.11']],
  ['estoy cansado y sin fuerzas', ['isa.40.31', 'mat.11.28', 'isa.40.29']],
  ['todo lo puedo en Cristo', ['php.4.13']],
  ['el Señor es mi pastor', ['psa.23.1']],
  ['no te dejaré ni te desampararé', ['heb.13.5', 'jos.1.5', 'deu.31.6', 'deu.31.8']],
  ['la fe es la certeza de lo que se espera', ['heb.11.1']],
  ['buscad primero el reino de Dios', ['mat.6.33']],
  ['orar sin cesar', ['1th.5.17']],
  ['la paga del pecado es muerte', ['rom.6.23']],
  ['nacer de nuevo', ['jhn.3.3', 'jhn.3.7', '1pe.1.23']],
  ['honra a tu padre y a tu madre', ['exo.20.12', 'eph.6.2', 'deu.5.16']],
  ['el principio de la sabiduría', ['pro.1.7', 'pro.9.10', 'psa.111.10']],
  ['tu palabra es lámpara a mis pies', ['psa.119.105']],
  ['el amor al dinero', ['1ti.6.10', 'heb.13.5']],
  ['Dios es amor', ['1jn.4.8', '1jn.4.16']],
  ['de tal manera amó Dios al mundo', ['jhn.3.16']],
  ['la armadura de Dios', ['eph.6.11', 'eph.6.13']],
  ['los frutos del Espíritu', ['gal.5.22']],
  ['esfuérzate y sé valiente', ['jos.1.9', 'jos.1.6', 'jos.1.7', 'deu.31.6']],
  ['venid a mí los que estáis trabajados', ['mat.11.28']],
];

// Sin una respuesta clara en la Biblia: deberían salir flojas
const SIN_RESPUESTA = [
  'videojuegos',
  'criptomonedas y bitcoin',
  'inteligencia artificial',
  'qué opina Dios del fútbol',
  'receta de arepas',
  'asdf qwer zxcv',
  'contraseña del wifi',
  'la teoría de la relatividad',
  'redes sociales',
  'elecciones presidenciales',
  'cómo arreglar el carro',
  'mejores series de televisión',
];

type Fila = { q: string; buena: boolean; acierto: boolean; s: Senales; floja: boolean; primeros: string[] };

async function main() {
  const books = JSON.parse(await readFile(path.join(DATA_DIR, 'books.json'), 'utf8'));
  const filas: Fila[] = [];
  const casos: [string, string[] | null][] = [...BUENAS, ...SIN_RESPUESTA.map((q): [string, null] => [q, null])];
  for (const [q, esperados] of casos) {
    const r = await quickSearch(q, books, 20, undefined, 'rv1909');
    const primeros = r.refs.slice(0, 5);
    const acierto = !!esperados && primeros.some((ref) => esperados.some((e) => ref === e || ref.startsWith(`${e}-`)));
    filas.push({ q, buena: !!esperados, acierto, s: r.senales, floja: r.floja, primeros });
  }
  console.log('búsqueda | tipo | acierto | recordado | parecido | coinciden | total | floja | primeros');
  for (const f of filas)
    console.log(
      [f.q, f.buena ? 'buena' : 'sin resp.', f.acierto ? 'sí' : 'no', f.s.recordado ? 'sí' : '', f.s.parecido?.toFixed(3) ?? '-', f.s.coinciden, f.s.total, f.floja ? 'FLOJA' : '', f.primeros.join(' ')].join(' | '),
    );
  // Debería salir floja: las sin respuesta y las buenas que no acertaron. Qué umbral lo separa mejor.
  console.log('\numbral | bien clasificadas | buenas que se mandarían a la IA | sin respuesta que pasarían');
  for (let t = 0.7; t <= 0.95; t += 0.01) {
    let bien = 0;
    let gasto = 0;
    let escapan = 0;
    for (const f of filas) {
      const s = f.s;
      const floja = !s.recordado && (s.total < 5 || s.parecido === null || s.parecido < t || s.coinciden === 0);
      const deberia = !f.acierto;
      if (floja === deberia) bien++;
      if (floja && f.acierto) gasto++;
      if (!floja && !f.buena) escapan++;
    }
    console.log(`${t.toFixed(2)} | ${bien}/${filas.length} | ${gasto} | ${escapan}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
