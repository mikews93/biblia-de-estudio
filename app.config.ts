import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * La configuración está en app.json; aquí solo se le añade de qué commit y cuándo se compiló esta copia de la app,
 * para que la pantalla «Acerca de Zarza» (src/app/acerca.tsx) diga qué versión corre al reportar un fallo, y el
 * google-services.json de Firebase que EAS entrega al compilar (variable de tipo archivo GOOGLE_SERVICES_JSON en
 * expo.dev): lo necesitan las notificaciones de Android y no se guarda en el repositorio.
 * Al publicar una actualización (.github/workflows/app-actualizar.yml) ese archivo se baja de EAS y llega en
 * ZARZA_GOOGLE_SERVICES: la huella nativa cuenta su contenido, y sin él no coincidiría con la del APK.
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

function googleServices(): string | undefined {
  const archivo = process.env.ZARZA_GOOGLE_SERVICES || process.env.GOOGLE_SERVICES_JSON;
  return archivo && existsSync(archivo) ? archivo : undefined;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    ...(googleServices() ? { googleServicesFile: googleServices() } : {}),
  },
  extra: {
    ...config.extra,
    compilacion: {
      commit: commit(),
      fecha: process.env.ZARZA_FECHA_COMPILACION || new Date().toISOString(),
      rama: process.env.VERCEL_GIT_COMMIT_REF || '',
    },
  },
});
