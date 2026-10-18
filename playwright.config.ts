import { defineConfig, devices } from '@playwright/test';

// Pruebas de punta a punta de la web: e2e/support/server.ts sirve dist/ y ejecuta api/ con la IA simulada.
// Antes hay que generar la web (npm run data && npm run comentarios && npm run build:web) y tener Postgres
// en DATABASE_URL (por defecto postgres://postgres:postgres@127.0.0.1:5432/biblia_e2e).
const PORT = Number(process.env.PORT ?? 8081);

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-ES',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'] } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
  ],
  webServer: {
    command: 'npx tsx e2e/support/server.ts',
    url: `http://localhost:${PORT}/data/books.json`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
