/**
 * Huella nativa de la app (runtimeVersion «fingerprint» en app.json): decide a qué APK o app de tienda le llega cada
 * actualización publicada con EAS Update. Es el preset «balanced» de Expo más ExpoConfigExtraSection, porque
 * app.config.ts escribe en extra el commit y la fecha de compilación: si contaran, la huella cambiaría en cada commit
 * y ninguna actualización encontraría su app.
 * PackageJsonScriptsAll: los «scripts» de package.json solo sirven para compilar la web y los datos (no hay
 * postinstall ni scripts nativos); en el Lote 32 cambiar build:vercel obligó a reinstalar el APK sin necesidad.
 * @type {import('expo/fingerprint').Config}
 */
module.exports = {
  sourceSkips: [
    'PackageJsonScriptsAll',
    'ExpoConfigVersions',
    'ExpoConfigRuntimeVersionIfString',
    'EasJson',
    'Easignore',
    'AutolinkingConfigPaths',
    'ExpoConfigExtraSection',
  ],
};
