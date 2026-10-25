// Junta el texto de cada versión libre en un solo archivo, public/data/semantica/textos/<versión>.json
// ([[ref, texto], …]), para que api/_semantica.ts arme su índice de palabras leyendo un archivo por versión en vez de
// 1189 (la primera búsqueda de cada instancia tardaba unos 5 s). Lo corre `npm run semantica` después de `npm run data`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dataDir = process.argv[2] ?? 'public/data';
const books = JSON.parse(readFileSync(path.join(dataDir, 'books.json'), 'utf8'));
const versions = JSON.parse(readFileSync(path.join(dataDir, 'versions.json'), 'utf8'));
const out = path.join(dataDir, 'semantica', 'textos');
mkdirSync(out, { recursive: true });
for (const { id } of versions) {
  const rows = [];
  for (const b of books)
    for (let c = 1; c <= b.chapters; c++) {
      let verses = [];
      try {
        verses = JSON.parse(readFileSync(path.join(dataDir, 'text', id, b.id, `${c}.json`), 'utf8'));
      } catch {}
      for (const [n, t] of verses) if (t) rows.push([`${b.id}.${c}.${n}`, t]);
    }
  writeFileSync(path.join(out, `${id}.json`), JSON.stringify(rows));
  console.log(`Textos ${id}: ${rows.length} versículos`);
}
