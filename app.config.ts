import { execSync } from 'node:child_process';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * La configuración está en app.json; aquí solo se le añade de qué commit y cuándo se compiló esta copia de la app,
 * para que la pantalla «Acerca de Zarza» (src/app/acerca.tsx) diga qué versión corre al reportar un fallo.
 * Vercel da el commit en VERCEL_GIT_COMMIT_SHA y EAS en EAS_BUILD_GIT_COMMIT_HASH; en local se pregunta a git.
 * pipeline/version_web.mjs escribe lo mismo en dist/version.json, que la app consulta para saber si hay una más nueva.
 */
function commit(): string {
  const env = process.env.VERCEL_GIT_COMMIT_SHA || process.env.EAS_BUILD_GIT_COMMIT_HASH;
  if (env) return env;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    compilacion: {
      commit: commit(),
      fecha: process.env.ZARZA_FECHA_COMPILACION || new Date().toISOString(),
      rama: process.env.VERCEL_GIT_COMMIT_REF || '',
    },
  },
});
