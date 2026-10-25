import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Pruebas unitarias (npm test): la lógica de src/lib y las funciones de api/. Las de punta a punta están en e2e/ (Playwright).
// Las pruebas de api/ que usan Postgres solo corren con DATABASE_URL (ver tests/api/db.ts).
export default defineConfig({
  tsconfig: 'tests/tsconfig.vitest.json',
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Las de api/ comparten una sola base: cada archivo corre las migraciones de su función (alter table … toma un
    // candado exclusivo) mientras otro consulta, y en paralelo eso a veces termina en «deadlock detected». Van en fila.
    projects: [
      { extends: true, test: { name: 'lib', include: ['src/**/*.test.ts'] } },
      { extends: true, test: { name: 'api', include: ['tests/**/*.test.ts'], fileParallelism: false } },
    ],
  },
});
