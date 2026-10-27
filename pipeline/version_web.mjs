// Escribe dist/version.json con el commit y la fecha de esta publicación de la web. La pantalla «Acerca de Zarza»
// (src/lib/version.ts) lo pide sin caché y lo compara con la versión que corre: si el commit es otro, hay una
// más nueva. Usa la misma fecha que app.config.ts (ZARZA_FECHA_COMPILACION, fijada en el buildCommand de vercel.json).
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
let commit = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
if (!commit) {
  try {
    commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {}
}
const fecha = process.env.ZARZA_FECHA_COMPILACION || new Date().toISOString();
writeFileSync(join(dist, 'version.json'), JSON.stringify({ commit, fecha }));
console.log(`version.json: ${commit.slice(0, 7) || 'sin commit'} · ${fecha}`);
